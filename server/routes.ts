import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { insertMlbPlayerSchema, insertVideoSchema, insertDrillSchema, insertSessionSchema } from "@shared/schema";
import multer from "multer";
import path from "path";
import fs from "fs";
import express from "express";
import { execFile } from "child_process";
import { uploadToR2, getPresignedUrl, deleteFromR2, isR2Key, r2Configured } from "./r2";

const uploadDir = path.resolve("uploads");
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

// Memory storage — buffer goes straight to R2, no local disk write
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 500 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const allowed = [".mp4", ".mov", ".webm", ".avi"];
    const ext = path.extname(file.originalname).toLowerCase();
    if (allowed.includes(ext)) {
      cb(null, true);
    } else {
      cb(new Error("Only video files (mp4, mov, webm, avi) are allowed"));
    }
  },
});

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {

  app.use("/uploads", express.static(uploadDir, {
    acceptRanges: true,
    maxAge: "1d",
  }));

  app.post("/api/upload", upload.single("video"), async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ message: "No video file provided" });
      }
      if (!r2Configured()) {
        return res.status(503).json({ message: "Storage not configured. Set R2 environment variables." });
      }
      const key = await uploadToR2(req.file.buffer, req.file.originalname, req.file.mimetype);
      const presignedUrl = await getPresignedUrl(key);
      const title = (req.body.title || req.file.originalname).replace(/\.[^.]+$/, "");
      const video = await storage.createVideo({
        title,
        category: "Upload",
        source: "User Upload",
        sourceUrl: key,
        isProVideo: false,
      });
      res.status(201).json({ sourceUrl: key, presignedUrl, videoId: video.id });
    } catch (err: any) {
      console.error("Upload error:", err);
      res.status(500).json({ message: "Failed to upload video" });
    }
  });

  app.get("/api/videos/:id/presigned-url", async (req, res) => {
    try {
      const video = await storage.getVideo(req.params.id);
      if (!video || !video.sourceUrl) {
        return res.status(404).json({ message: "Video not found" });
      }
      if (!isR2Key(video.sourceUrl)) {
        // Legacy local file — return as-is
        return res.json({ url: video.sourceUrl });
      }
      const url = await getPresignedUrl(video.sourceUrl);
      res.json({ url });
    } catch (err: any) {
      console.error("Presigned URL error:", err);
      res.status(500).json({ message: "Failed to generate video URL" });
    }
  });

  app.post("/api/videos/:id/trim", async (req, res) => {
    try {
      const { startTime, endTime } = req.body;
      if (typeof startTime !== "number" || typeof endTime !== "number" ||
          startTime < 0 || endTime <= startTime || !isFinite(startTime) || !isFinite(endTime)) {
        return res.status(400).json({ message: "Invalid start/end times. startTime must be >= 0 and endTime must be > startTime." });
      }

      const video = await storage.getVideo(req.params.id);
      if (!video || !video.sourceUrl) {
        return res.status(404).json({ message: "Video not found or has no file" });
      }

      const clipDuration = endTime - startTime;
      const ext = path.extname(video.sourceUrl) || ".mp4";
      const tmpInput = path.join(uploadDir, `trim-in-${Date.now()}${ext}`);
      const tmpOutput = path.join(uploadDir, `trim-out-${Date.now()}${ext}`);

      // Download from R2 to temp file
      if (isR2Key(video.sourceUrl)) {
        const { GetObjectCommand } = await import("@aws-sdk/client-s3");
        const { r2 } = await import("./r2");
        const obj = await r2.send(new GetObjectCommand({
          Bucket: process.env.R2_BUCKET_NAME!,
          Key: video.sourceUrl,
        }));
        const chunks: Buffer[] = [];
        for await (const chunk of obj.Body as AsyncIterable<Uint8Array>) {
          chunks.push(Buffer.from(chunk));
        }
        fs.writeFileSync(tmpInput, Buffer.concat(chunks));
      } else {
        const localPath = path.join(uploadDir, path.basename(video.sourceUrl));
        if (!fs.existsSync(localPath)) {
          return res.status(404).json({ message: "Video file not found" });
        }
        fs.copyFileSync(localPath, tmpInput);
      }

      await new Promise<void>((resolve, reject) => {
        execFile("ffmpeg", [
          "-i", tmpInput,
          "-ss", startTime.toString(),
          "-t", clipDuration.toString(),
          "-c", "copy",
          "-avoid_negative_ts", "make_zero",
          "-y",
          tmpOutput,
        ], (error, _stdout, stderr) => {
          if (error) { console.error("FFmpeg error:", stderr); reject(new Error("FFmpeg trimming failed")); }
          else resolve();
        });
      });

      if (!fs.existsSync(tmpOutput)) {
        return res.status(500).json({ message: "Trimmed file was not created" });
      }

      // Upload trimmed file to R2
      const trimBuffer = fs.readFileSync(tmpOutput);
      const newKey = await uploadToR2(trimBuffer, `trimmed${ext}`, "video/mp4");

      // Delete old R2 object if applicable
      if (isR2Key(video.sourceUrl)) {
        try { await deleteFromR2(video.sourceUrl); } catch {}
      }

      // Clean up temp files
      try { fs.unlinkSync(tmpInput); fs.unlinkSync(tmpOutput); } catch {}

      const mins = Math.floor(clipDuration / 60);
      const secs = Math.floor(clipDuration % 60);
      const durationStr = `${mins}:${secs.toString().padStart(2, "0")}`;
      const updated = await storage.updateVideo(req.params.id, {
        sourceUrl: newKey,
        duration: durationStr,
      });

      res.json(updated);
    } catch (err: any) {
      console.error("Trim error:", err);
      res.status(500).json({ message: err.message || "Failed to trim video" });
    }
  });

  app.get("/api/players", async (_req, res) => {
    try {
      const players = await storage.getAllPlayers();
      res.json(players);
    } catch (err) {
      res.status(500).json({ message: "Failed to fetch players" });
    }
  });

  app.get("/api/players/:id", async (req, res) => {
    try {
      const player = await storage.getPlayer(req.params.id);
      if (!player) return res.status(404).json({ message: "Player not found" });
      res.json(player);
    } catch (err) {
      res.status(500).json({ message: "Failed to fetch player" });
    }
  });

  app.delete("/api/players/:id", async (req, res) => {
    try {
      const deleted = await storage.deletePlayer(req.params.id);
      if (!deleted) return res.status(404).json({ message: "Player not found" });
      res.json({ success: true });
    } catch (err) {
      res.status(500).json({ message: "Failed to delete player" });
    }
  });

  app.post("/api/players", async (req, res) => {
    const parsed = insertMlbPlayerSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ message: parsed.error.message });
    try {
      const player = await storage.createPlayer(parsed.data);
      res.status(201).json(player);
    } catch (err) {
      res.status(500).json({ message: "Failed to create player" });
    }
  });

  async function resolveVideoUrls(vids: any[]) {
    return Promise.all(
      vids.map(async (v) => {
        if (v.sourceUrl && isR2Key(v.sourceUrl)) {
          return { ...v, sourceUrl: await getPresignedUrl(v.sourceUrl) };
        }
        return v;
      })
    );
  }

  app.get("/api/videos", async (req, res) => {
    try {
      const { category, playerId } = req.query;
      let vids;
      if (category) {
        vids = await storage.getVideosByCategory(category as string);
      } else if (playerId) {
        vids = await storage.getVideosByPlayer(playerId as string);
      } else {
        vids = await storage.getAllVideos();
      }
      res.json(await resolveVideoUrls(vids));
    } catch (err) {
      res.status(500).json({ message: "Failed to fetch videos" });
    }
  });

  app.get("/api/videos/:id", async (req, res) => {
    try {
      const video = await storage.getVideo(req.params.id);
      if (!video) return res.status(404).json({ message: "Video not found" });
      const [resolved] = await resolveVideoUrls([video]);
      res.json(resolved);
    } catch (err) {
      res.status(500).json({ message: "Failed to fetch video" });
    }
  });

  app.post("/api/videos", async (req, res) => {
    const parsed = insertVideoSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ message: parsed.error.message });
    try {
      const video = await storage.createVideo(parsed.data);
      res.status(201).json(video);
    } catch (err) {
      res.status(500).json({ message: "Failed to create video" });
    }
  });

  app.patch("/api/videos/:id", async (req, res) => {
    const parsed = insertVideoSchema.partial().safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ message: parsed.error.message });
    try {
      const video = await storage.updateVideo(req.params.id, parsed.data);
      if (!video) return res.status(404).json({ message: "Video not found" });
      res.json(video);
    } catch (err) {
      res.status(500).json({ message: "Failed to update video" });
    }
  });

  app.delete("/api/videos/:id", async (req, res) => {
    try {
      const deleted = await storage.deleteVideo(req.params.id);
      if (!deleted) return res.status(404).json({ message: "Video not found" });
      res.json({ success: true });
    } catch (err) {
      res.status(500).json({ message: "Failed to delete video" });
    }
  });

  app.get("/api/drills", async (req, res) => {
    try {
      const { phase } = req.query;
      if (phase) {
        const d = await storage.getDrillsByPhase(phase as string);
        return res.json(d);
      }
      const d = await storage.getAllDrills();
      res.json(d);
    } catch (err) {
      res.status(500).json({ message: "Failed to fetch drills" });
    }
  });

  app.get("/api/drills/:id", async (req, res) => {
    try {
      const drill = await storage.getDrill(req.params.id);
      if (!drill) return res.status(404).json({ message: "Drill not found" });
      res.json(drill);
    } catch (err) {
      res.status(500).json({ message: "Failed to fetch drill" });
    }
  });

  app.post("/api/drills", async (req, res) => {
    const parsed = insertDrillSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ message: parsed.error.message });
    try {
      const drill = await storage.createDrill(parsed.data);
      res.status(201).json(drill);
    } catch (err) {
      res.status(500).json({ message: "Failed to create drill" });
    }
  });

  app.get("/api/sessions/:id", async (req, res) => {
    try {
      const session = await storage.getSession(req.params.id);
      if (!session) return res.status(404).json({ message: "Session not found" });
      res.json(session);
    } catch (err) {
      res.status(500).json({ message: "Failed to fetch session" });
    }
  });

  app.post("/api/sessions", async (req, res) => {
    const parsed = insertSessionSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ message: parsed.error.message });
    try {
      const session = await storage.createSession(parsed.data);
      res.status(201).json(session);
    } catch (err) {
      res.status(500).json({ message: "Failed to create session" });
    }
  });

  app.patch("/api/sessions/:id", async (req, res) => {
    const parsed = insertSessionSchema.partial().safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ message: parsed.error.message });
    try {
      const session = await storage.updateSession(req.params.id, parsed.data);
      if (!session) return res.status(404).json({ message: "Session not found" });
      res.json(session);
    } catch (err) {
      res.status(500).json({ message: "Failed to update session" });
    }
  });

  // ── MLB Stats API + Baseball Savant proxy ────────────────────────────────

  const MLB_TEAM_ABBR: Record<number, string> = {
    108: "LAA", 109: "AZ",  110: "BAL", 111: "BOS", 112: "CHC",
    113: "CIN", 114: "CLE", 115: "COL", 116: "DET", 117: "HOU",
    118: "KC",  119: "LAD", 120: "WSH", 121: "NYM", 133: "ATH",
    134: "PIT", 135: "SD",  136: "SEA", 137: "SF",  138: "STL",
    139: "TB",  140: "TEX", 141: "TOR", 142: "MIN", 143: "PHI",
    144: "ATL", 145: "CWS", 146: "MIA", 147: "NYY", 158: "MIL",
  };

  function parseSimpleCSV(raw: string): Record<string, string>[] {
    const text = raw.replace(/^\uFEFF/, "");
    const lines = text.split("\n").filter(l => l.trim());
    if (lines.length < 2) return [];
    const headers = lines[0].split(",").map(h => h.replace(/^"|"$/g, "").trim());
    const rows: Record<string, string>[] = [];
    for (let i = 1; i < lines.length; i++) {
      const vals: string[] = [];
      let cur = "", inQ = false;
      for (const ch of lines[i]) {
        if (ch === '"') { inQ = !inQ; }
        else if (ch === "," && !inQ) { vals.push(cur); cur = ""; }
        else { cur += ch; }
      }
      vals.push(cur);
      const row: Record<string, string> = {};
      headers.forEach((h, idx) => { row[h] = (vals[idx] ?? "").trim(); });
      rows.push(row);
    }
    return rows;
  }

  async function fetchSavantCSV(url: string): Promise<Record<string, string>[]> {
    try {
      const res = await fetch(url, {
        headers: { "User-Agent": "Mozilla/5.0 (compatible; SwingIQ/1.0)" },
        signal: AbortSignal.timeout(8000),
      });
      if (!res.ok) return [];
      return parseSimpleCSV(await res.text());
    } catch {
      return [];
    }
  }

  // Search active MLB players by name
  app.get("/api/mlb/search", async (req, res) => {
    const q = String(req.query.q ?? "").trim();
    if (q.length < 2) return res.status(400).json({ message: "Query too short" });
    try {
      const r = await fetch(
        `https://statsapi.mlb.com/api/v1/people/search?names=${encodeURIComponent(q)}&sportId=1&hydrate=currentTeam`,
        { signal: AbortSignal.timeout(6000) }
      );
      if (!r.ok) return res.status(502).json({ message: "MLB API error" });
      const data = await r.json() as any;
      const results = (data.people ?? [])
        .map((p: any) => ({
          mlbId:    String(p.id),
          name:     p.fullName,
          team:     MLB_TEAM_ABBR[p.currentTeam?.id] ?? p.currentTeam?.name ?? "—",
          position: p.primaryPosition?.abbreviation ?? "—",
          bats:     p.batSide?.code ?? "—",
        }));
      res.json(results);
    } catch (err: any) {
      res.status(500).json({ message: "Search failed" });
    }
  });

  // Fetch bio from MLB Stats API + Statcast data from Baseball Savant
  app.get("/api/mlb/lookup/:mlbId", async (req, res) => {
    const { mlbId } = req.params;
    if (!/^\d+$/.test(mlbId)) return res.status(400).json({ message: "Invalid mlbId" });
    try {
      const bioRes = await fetch(
        `https://statsapi.mlb.com/api/v1/people/${mlbId}?hydrate=currentTeam`,
        { signal: AbortSignal.timeout(6000) }
      );
      if (!bioRes.ok) return res.status(404).json({ message: "Player not found" });
      const bioData = await bioRes.json() as any;
      const p = bioData.people?.[0];
      if (!p) return res.status(404).json({ message: "Player not found" });

      const savantId = String(p.id);
      const imageUrl = `https://img.mlbstatic.com/mlb-photos/image/upload/d_people:generic:headshot:67:current.png/w_213,q_auto:best/v1/people/${savantId}/headshot/67/current`;
      const height = (p.height as string | undefined)?.replace(/'\s+/, "'") ?? null;
      const team = MLB_TEAM_ABBR[p.currentTeam?.id] ?? p.currentTeam?.name ?? "";
      const year = new Date().getFullYear();

      const statcastUrl = (y: number) =>
        `https://baseballsavant.mlb.com/leaderboard/statcast?type=batter&year=${y}&position=&team=&min=q&csv=false`;
      const batTrackUrl = (y: number) =>
        `https://baseballsavant.mlb.com/leaderboard/bat-tracking?seasonStart=${y}&seasonEnd=${y}&minSwings=50&csv=false`;

      let scRows = await fetchSavantCSV(statcastUrl(year));
      let sc = scRows.find(r => r.player_id === savantId) ?? null;
      if (!sc) {
        scRows = await fetchSavantCSV(statcastUrl(year - 1));
        sc = scRows.find(r => r.player_id === savantId) ?? null;
      }

      let btRows = await fetchSavantCSV(batTrackUrl(year));
      let bt = btRows.find(r => r.id === savantId) ?? null;
      if (!bt) {
        btRows = await fetchSavantCSV(batTrackUrl(year - 1));
        bt = btRows.find(r => r.id === savantId) ?? null;
      }

      res.json({
        savantId,
        name:     p.fullName,
        team,
        position: p.primaryPosition?.abbreviation ?? "",
        bats:     p.batSide?.code ?? "",
        height,
        weight:   p.weight ?? null,
        imageUrl,
        avgExitVelo:           sc ? parseFloat(sc.avg_hit_speed) || null : null,
        maxExitVelo:           sc ? parseFloat(sc.max_hit_speed) || null : null,
        barrelPct:             sc ? parseFloat(sc.brl_percent)   || null : null,
        hardHitPct:            sc ? parseFloat(sc.ev95percent)   || null : null,
        avgExitVeloPercentile: null,
        maxExitVeloPercentile: null,
        barrelPctPercentile:   null,
        hardHitPctPercentile:  null,
        batSpeed:              bt ? parseFloat(bt.avg_bat_speed) || null : null,
        attackAngle:           null,
        rotationalAccel:       null,
        savantAvailable:       !!(sc || bt),
      });
    } catch (err: any) {
      console.error("MLB lookup error:", err);
      res.status(500).json({ message: "Lookup failed" });
    }
  });

  return httpServer;
}