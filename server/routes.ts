import type { Express } from "express";
import { hasCoachAccess } from "./coachAccess";
import { createProxyMiddleware } from "http-proxy-middleware";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { insertMlbPlayerSchema, insertVideoSchema, insertDrillSchema, insertSessionSchema } from "@shared/schema";
import multer from "multer";
import path from "path";
import fs from "fs";
import express from "express";
import { execFile } from "child_process";
import { uploadToR2, getVideoUrl, getPresignedUrl, deleteFromR2, isR2Key, r2Configured, checkR2Exists } from "./r2";
import { createCheckoutSession, createPortalSession, handleWebhook, PRICES } from "./stripe";
import { setupCoachRoutes } from "./coach";
import { setupCoachingRoutes } from "./coaching";
import { setupBiometricsRoutes } from "./biometrics";
import { setupBlueprintRoutes } from "./blueprint";
import { setupStatdleRoutes } from "./statdle";
import { setupAthleteRoutes } from "./athletes";

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

  // PostHog reverse proxy — bypasses ad blockers
  app.use("/ingest/static", createProxyMiddleware({
    target: "https://us-assets.i.posthog.com",
    changeOrigin: true,
    pathRewrite: { "^/": "/static/" },
  }));
  app.use("/ingest", createProxyMiddleware({
    target: "https://us.i.posthog.com",
    changeOrigin: true,
    pathRewrite: { "^/": "/" },
  }));


  app.post("/api/upload", upload.single("video"), async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ message: "No video file provided" });
      }
      if (!r2Configured()) {
        return res.status(503).json({ message: "Storage not configured. Set R2 environment variables." });
      }

      // Transcode non-mp4 files (e.g. .mov, .avi, .webm) to H.264 mp4 for broad browser compatibility
      let uploadBuffer = req.file.buffer;
      let uploadName = req.file.originalname;
      const uploadExt = path.extname(req.file.originalname).toLowerCase();
      if (uploadExt !== ".mp4") {
        const tmpIn = path.join(uploadDir, `upload-in-${Date.now()}${uploadExt}`);
        const tmpOut = path.join(uploadDir, `upload-out-${Date.now()}.mp4`);
        try {
          fs.writeFileSync(tmpIn, uploadBuffer);
          await new Promise<void>((resolve, reject) => {
            execFile("ffmpeg", [
              "-i", tmpIn,
              "-c:v", "libx264",
              "-preset", "fast",
              "-crf", "23",
              "-c:a", "aac",
              "-movflags", "+faststart",
              "-y",
              tmpOut,
            ], { maxBuffer: 100 * 1024 * 1024 }, (error, _stdout, stderr) => {
              if (error) { console.error("FFmpeg transcode error:", stderr); reject(new Error("Transcoding failed")); }
              else resolve();
            });
          });
          uploadBuffer = fs.readFileSync(tmpOut);
          uploadName = uploadName.replace(/\.[^.]+$/, ".mp4");
        } finally {
          try { fs.unlinkSync(tmpIn); } catch {}
          try { fs.unlinkSync(tmpOut); } catch {}
        }
      }

      // Trim to user-selected window (required when video exceeds max duration)
      const startTime = parseFloat(req.body.startTime ?? "");
      const endTime = parseFloat(req.body.endTime ?? "");
      if (!isNaN(startTime) && !isNaN(endTime) && endTime > startTime) {
        const clipDuration = endTime - startTime;
        if (clipDuration > 5) {
          return res.status(400).json({ message: "Clip must be 5 seconds or less." });
        }
        const tmpTrimIn = path.join(uploadDir, `trim-in-${Date.now()}.mp4`);
        const tmpTrimOut = path.join(uploadDir, `trim-out-${Date.now()}.mp4`);
        try {
          fs.writeFileSync(tmpTrimIn, uploadBuffer);
          await new Promise<void>((resolve, reject) => {
            execFile("ffmpeg", [
              "-ss", startTime.toString(),
              "-i", tmpTrimIn,
              "-t", clipDuration.toString(),
              "-c:v", "libx264", "-preset", "fast", "-crf", "23",
              "-c:a", "aac",
              "-movflags", "+faststart",
              "-avoid_negative_ts", "make_zero",
              "-y", tmpTrimOut,
            ], { maxBuffer: 100 * 1024 * 1024 }, (err, _stdout, stderr) => {
              if (err) { console.error("Trim error:", stderr); reject(new Error("Trim failed")); }
              else resolve();
            });
          });
          uploadBuffer = fs.readFileSync(tmpTrimOut);
          uploadName = uploadName.replace(/\.[^.]+$/, ".mp4");
        } finally {
          try { fs.unlinkSync(tmpTrimIn); } catch {}
          try { fs.unlinkSync(tmpTrimOut); } catch {}
        }
      }

      const key = await uploadToR2(uploadBuffer, uploadName, "video/mp4");
      const presignedUrl = await getVideoUrl(key);
      const title = (req.body.title || req.file.originalname).replace(/\.[^.]+$/, "");
      const userId = (req.user as any)?.id ?? null;

      // Admin uploads (skipRecord=1) only store the file — the admin form creates the proper record.
      // Regular user uploads create a non-pro video record immediately.
      if (req.body.skipRecord === "1") {
        return res.status(201).json({ sourceUrl: key, presignedUrl });
      }

      const allowedUserCategories = ["Full Swing", "Game Swing", "Gather", "Launch", "Swing"];
      const requestedCategory = req.body.category;
      const category = allowedUserCategories.includes(requestedCategory) ? requestedCategory : "Full Swing";

      const video = await storage.createVideo({
        title,
        category,
        source: "User Upload",
        sourceUrl: key,
        isProVideo: false,
        userId,
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
      // Normalize full URL (CDN or presigned) back to R2 key
      let key = video.sourceUrl;
      if (key.startsWith("https://")) {
        const match = key.match(/videos\/[^?#]+/);
        if (match) key = match[0];
      }
      if (!isR2Key(key)) {
        // Legacy local file or external URL — return as-is
        return res.json({ url: video.sourceUrl });
      }
      const url = await getPresignedUrl(key);
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
      const srcExt = path.extname(video.sourceUrl) || ".mp4";
      const tmpInput = path.join(uploadDir, `trim-in-${Date.now()}${srcExt}`);
      const tmpOutput = path.join(uploadDir, `trim-out-${Date.now()}.mp4`);

      // Download from R2 to temp file
      if (isR2Key(video.sourceUrl)) {
        const { GetObjectCommand } = await import("@aws-sdk/client-s3");
        const { r2 } = await import("./r2");
        const obj = await r2.send(new GetObjectCommand({
          Bucket: process.env.R2_BUCKET_NAME!,
          Key: video.sourceUrl,
        }));
        const { pipeline } = await import("stream/promises");
        const writeStream = fs.createWriteStream(tmpInput);
        await pipeline(obj.Body as NodeJS.ReadableStream, writeStream);
      } else {
        const localPath = path.join(uploadDir, path.basename(video.sourceUrl));
        if (!fs.existsSync(localPath)) {
          return res.status(404).json({ message: "Video file not found" });
        }
        fs.copyFileSync(localPath, tmpInput);
      }

      await new Promise<void>((resolve, reject) => {
        execFile("ffmpeg", [
          "-ss", startTime.toString(),
          "-i", tmpInput,
          "-t", clipDuration.toString(),
          "-c:v", "libx264",
          "-preset", "fast",
          "-crf", "23",
          "-c:a", "aac",
          "-movflags", "+faststart",
          "-avoid_negative_ts", "make_zero",
          "-y",
          tmpOutput,
        ], { maxBuffer: 100 * 1024 * 1024 }, (error, _stdout, stderr) => {
          if (error) { console.error("FFmpeg error:", stderr); reject(new Error("FFmpeg trimming failed")); }
          else resolve();
        });
      });

      if (!fs.existsSync(tmpOutput)) {
        return res.status(500).json({ message: "Trimmed file was not created" });
      }

      // Upload trimmed file to R2
      const trimBuffer = fs.readFileSync(tmpOutput);
      const newKey = await uploadToR2(trimBuffer, "trimmed.mp4", "video/mp4");

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

  app.get("/api/admin/users", async (req, res) => {
    const adminUsername = process.env.ADMIN_USERNAME;
    if (!req.user || (req.user as any).username !== adminUsername) {
      return res.status(403).json({ message: "Forbidden" });
    }
    try {
      const allUsers = await storage.getAllUsers();
      const allVideos = await storage.getAllVideos();
      const userVideoMap = new Map<string, typeof allVideos>();
      allVideos.filter(v => !v.isProVideo && v.userId).forEach(v => {
        const list = userVideoMap.get(v.userId!) ?? [];
        list.push(v);
        userVideoMap.set(v.userId!, list);
      });
      const result = await Promise.all(allUsers.map(async u => ({
        id: u.id,
        username: u.username,
        email: u.email,
        emailVerified: u.emailVerified,
        subscriptionTier: u.subscriptionTier,
        skillLevel: u.skillLevel,
        bats: u.bats,
        throws: u.throws,
        age: u.age,
        heightInches: u.heightInches,
        weightLbs: u.weightLbs,
        city: u.city,
        state: u.state,
        profileComplete: u.profileComplete,
        accountType: u.accountType ?? "player",
        uploadCount: userVideoMap.get(u.id)?.length ?? 0,
        videos: await Promise.all((userVideoMap.get(u.id) ?? []).map(async v => ({
          id: v.id,
          title: v.title,
          sourceUrl: v.sourceUrl && isR2Key(v.sourceUrl) ? await getVideoUrl(v.sourceUrl) : v.sourceUrl,
          createdAt: v.createdAt,
        }))),
      })));
      res.json(result);
    } catch (err: any) {
      res.status(500).json({ message: err.message || "Failed to fetch users" });
    }
  });

  app.post("/api/admin/reset-visibility", async (req, res) => {
    const adminUsername = process.env.ADMIN_USERNAME;
    if (!req.user || (req.user as any).username !== adminUsername) {
      return res.status(403).json({ message: "Forbidden" });
    }
    await db.update(videos).set({ showInLibrary: true, showInDevelopment: true });
    res.json({ message: "All videos reset to visible" });
  });

  app.post("/api/admin/set-tier", async (req, res) => {
    const adminUsername = process.env.ADMIN_USERNAME;
    if (!req.user || (req.user as any).username !== adminUsername) {
      return res.status(403).json({ message: "Forbidden" });
    }
    const { userId, tier } = req.body;
    const validTiers = ["free", "rookie", "player", "pro", "coach"];
    if (!userId || !validTiers.includes(tier)) {
      return res.status(400).json({ message: `tier must be one of: ${validTiers.join(", ")}` });
    }
    const updated = await storage.updateUser(userId, { subscriptionTier: tier });
    if (!updated) return res.status(404).json({ message: "User not found" });
    res.json({ id: updated.id, username: updated.username, subscriptionTier: updated.subscriptionTier });
  });

  app.get("/api/admin/r2-health", async (req, res) => {
    const adminUsername = process.env.ADMIN_USERNAME;
    if (!req.user || (req.user as any).username !== adminUsername) {
      return res.status(403).json({ message: "Forbidden" });
    }
    try {
      const allVideos = await storage.getAllVideos();
      const r2Videos = allVideos.filter(v => v.sourceUrl && isR2Key(v.sourceUrl));
      const results = await Promise.all(r2Videos.map(async v => ({
        id: v.id,
        title: v.title,
        playerName: v.playerName,
        isProVideo: v.isProVideo,
        key: v.sourceUrl!,
        exists: await checkR2Exists(v.sourceUrl!),
      })));
      res.json({
        total: results.length,
        missing: results.filter(r => !r.exists).length,
        ok: results.filter(r => r.exists).length,
        videos: results,
      });
    } catch (err: any) {
      res.status(500).json({ message: err.message || "Failed to check R2 health" });
    }
  });

  // Returns list of videos that still need transcoding
  app.get("/api/admin/transcode-mov/pending", async (req, res) => {
    const adminUsername = process.env.ADMIN_USERNAME;
    if (!req.user || (req.user as any).username !== adminUsername) {
      return res.status(403).json({ message: "Forbidden" });
    }
    try {
      const allVideos = await storage.getAllVideos();
      const pending = allVideos
        .filter(v => v.sourceUrl && isR2Key(v.sourceUrl) && /\.(mov|avi|webm)$/i.test(v.sourceUrl))
        .map(v => ({ id: v.id, title: v.title, key: v.sourceUrl! }));
      res.json({ pending, total: pending.length });
    } catch (err: any) {
      res.status(500).json({ message: err.message || "Failed to fetch pending" });
    }
  });

  // Transcodes a single video by ID
  app.post("/api/admin/transcode-mov/:id", async (req, res) => {
    const adminUsername = process.env.ADMIN_USERNAME;
    if (!req.user || (req.user as any).username !== adminUsername) {
      return res.status(403).json({ message: "Forbidden" });
    }
    try {
      const video = await storage.getVideo(req.params.id);
      if (!video || !video.sourceUrl || !isR2Key(video.sourceUrl)) {
        return res.status(404).json({ message: "Video not found or not an R2 key" });
      }
      if (!/\.(mov|avi|webm)$/i.test(video.sourceUrl)) {
        return res.json({ message: "Already mp4, skipping", id: video.id });
      }

      const oldKey = video.sourceUrl;
      const ext = path.extname(oldKey).toLowerCase();
      const tmpIn = path.join(uploadDir, `transcode-in-${Date.now()}${ext}`);
      const tmpOut = path.join(uploadDir, `transcode-out-${Date.now()}.mp4`);

      try {
        const { GetObjectCommand } = await import("@aws-sdk/client-s3");
        const { r2 } = await import("./r2");
        const { pipeline } = await import("stream/promises");

        const obj = await r2.send(new GetObjectCommand({ Bucket: process.env.R2_BUCKET_NAME!, Key: oldKey }));
        await pipeline(obj.Body as NodeJS.ReadableStream, fs.createWriteStream(tmpIn));

        await new Promise<void>((resolve, reject) => {
          execFile("ffmpeg", [
            "-i", tmpIn,
            "-c:v", "libx264",
            "-preset", "fast",
            "-crf", "23",
            "-c:a", "aac",
            "-movflags", "+faststart",
            "-y",
            tmpOut,
          ], { maxBuffer: 100 * 1024 * 1024 }, (error, _stdout, stderr) => {
            if (error) reject(new Error(`FFmpeg failed: ${stderr?.slice(-500)}`));
            else resolve();
          });
        });

        const mp4Buffer = fs.readFileSync(tmpOut);
        const newKey = await uploadToR2(mp4Buffer, `transcoded.mp4`, "video/mp4");
        await storage.updateVideo(video.id, { sourceUrl: newKey });
        try { await deleteFromR2(oldKey); } catch {}

        res.json({ success: true, id: video.id, title: video.title, newKey });
      } finally {
        try { fs.unlinkSync(tmpIn); } catch {}
        try { fs.unlinkSync(tmpOut); } catch {}
      }
    } catch (err: any) {
      console.error(`Transcode failed for ${req.params.id}:`, err);
      res.status(500).json({ message: err.message || "Transcode failed", id: req.params.id });
    }
  });

  app.get("/api/players", async (req, res) => {
    try {
      const { search, bats, limit, offset, seed } = req.query as Record<string, string | undefined>;
      if (search !== undefined || bats !== undefined || limit !== undefined || seed !== undefined) {
        const result = await storage.getPlayers({
          search: search || undefined,
          bats: bats || undefined,
          limit: limit ? Number(limit) : 9,
          offset: offset ? Number(offset) : 0,
          seed: seed ? Number(seed) : 0,
        });
        return res.json(result);
      }
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

  // Backfill career stats for all players with a savantId but missing batting stats
  app.post("/api/admin/backfill-player-stats", async (_req, res) => {
    try {
      const allPlayers = await storage.getAllPlayers();
      const needsStats = allPlayers.filter(p => p.savantId && p.battingAvg == null);
      let updated = 0;
      let failed = 0;
      for (const player of needsStats) {
        try {
          const careerRes = await fetch(
            `https://statsapi.mlb.com/api/v1/people/${player.savantId}/stats?stats=career&group=hitting`,
            { signal: AbortSignal.timeout(6000) }
          );
          if (!careerRes.ok) { failed++; continue; }
          const careerData = await careerRes.json() as any;
          const stat = careerData.stats?.[0]?.splits?.[0]?.stat ?? null;
          if (!stat) { failed++; continue; }
          const toNum = (v: any) => v != null && v !== "" ? parseFloat(v) || null : null;
          const toInt = (v: any) => v != null && v !== "" ? parseInt(v, 10) || null : null;
          await storage.updatePlayer(player.id, {
            battingAvg: toNum(stat.avg),
            homeRuns: toInt(stat.homeRuns),
            rbi: toInt(stat.rbi),
            obp: toNum(stat.obp),
            slg: toNum(stat.slg),
            ops: toNum(stat.ops),
          });
          updated++;
        } catch {
          failed++;
        }
      }
      res.json({ total: needsStats.length, updated, failed });
    } catch (err) {
      res.status(500).json({ message: "Backfill failed" });
    }
  });

  // MLB Stats API proxy — avoids CORS and keeps API calls server-side
  app.get("/api/mlb/players/:mlbId/stats", async (req, res) => {
    const { mlbId } = req.params;
    try {
      const [yearByYearRes, careerRes] = await Promise.all([
        fetch(`https://statsapi.mlb.com/api/v1/people/${mlbId}/stats?stats=yearByYear&group=hitting`),
        fetch(`https://statsapi.mlb.com/api/v1/people/${mlbId}/stats?stats=career&group=hitting`),
      ]);
      const [yearByYear, career] = await Promise.all([yearByYearRes.json(), careerRes.json()]) as any[];
      res.json({
        seasons: (yearByYear.stats?.[0]?.splits ?? []).filter((s: any) => s.stat?.atBats > 0),
        career: career.stats?.[0]?.splits?.[0]?.stat ?? null,
      });
    } catch (err) {
      res.status(500).json({ message: "Failed to fetch MLB stats" });
    }
  });

  // MLB awards proxy
  app.get("/api/mlb/players/:mlbId/awards", async (req, res) => {
    const { mlbId } = req.params;
    // Only surface recognized MLB-level awards. Use ID matching for awards with generic
    // names (MVP, ROY, All-Star) to avoid false positives from minor league equivalents.
    // Only use name matching for awards with truly unique names.
    const MLB_IDS = /^(ALMVP|NLMVP|ALSS|NLSS|ALGG|NLGG|ALROY|NLROY|MLBAS|ALAS|NLAS|AAHAA|NAHAA)/i;
    const MLB_NAMES = /silver slugger|gold glove|hank aaron/i;
    try {
      const response = await fetch(`https://statsapi.mlb.com/api/v1/people/${mlbId}/awards`);
      const data = await response.json() as any;
      const awards = (data.awards ?? [])
        .filter((a: any) => MLB_IDS.test(a.id ?? "") || MLB_NAMES.test(a.name ?? ""))
        .map((a: any) => ({ award: { id: a.id ?? "", name: a.name ?? "" }, season: a.season ?? "" }));
      res.json(awards);
    } catch {
      res.status(500).json({ message: "Failed to fetch MLB awards" });
    }
  });

  // MLB schedule/scores proxy — today's games across MLB + Spring Training
  app.get("/api/mlb/scores", async (_req, res) => {
    try {
      // Use Eastern Time — MLB schedules are always expressed in ET
      const etDate = new Date().toLocaleString("en-US", { timeZone: "America/New_York" });
      const et = new Date(etDate);
      const today = `${et.getFullYear()}-${String(et.getMonth() + 1).padStart(2, "0")}-${String(et.getDate()).padStart(2, "0")}`;
      const url = `https://statsapi.mlb.com/api/v1/schedule?sportId=1,17&date=${today}&hydrate=linescore,team`;
      const response = await fetch(url, { headers: { "User-Agent": "Mozilla/5.0" } });
      if (!response.ok) return res.status(502).json({ message: "MLB API error" });
      const data = await response.json() as any;

      const abbr = (team: any): string =>
        team?.abbreviation ?? team?.teamCode?.toUpperCase() ?? team?.name?.slice(0, 3).toUpperCase() ?? "?";

      const allGames = (data.dates ?? []).flatMap((d: any) => d.games ?? []);
      const games = allGames.map((g: any) => ({
        gamePk: g.gamePk,
        status: g.status?.abstractGameState ?? "Preview",
        detailedState: g.status?.detailedState ?? "",
        awayTeam: abbr(g.teams?.away?.team),
        awayScore: g.teams?.away?.score ?? 0,
        homeTeam: abbr(g.teams?.home?.team),
        homeScore: g.teams?.home?.score ?? 0,
        inning: g.linescore?.currentInning ?? null,
        isTopInning: g.linescore?.isTopInning ?? true,
        gameDate: g.gameDate,
        sportId: g.sport?.id ?? g.teams?.away?.team?.sport?.id ?? 1,
      }));
      res.json({ games, date: today });
    } catch (err) {
      res.status(500).json({ message: "Failed to fetch scores" });
    }
  });

  // Baseball Savant spray chart proxy — parses statcast CSV, returns JSON batted ball points
  app.get("/api/mlb/players/:mlbId/spray-chart", async (req, res) => {
    const { mlbId } = req.params;
    const year = (req.query.year as string) || "2024";
    try {
      const url = `https://baseballsavant.mlb.com/statcast_search/csv?all=true&hfGT=R%7C&hfSea=${year}%7C&player_type=batter&batters_lookup%5B%5D=${mlbId}&type=details`;
      const response = await fetch(url, {
        headers: {
          "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36",
          "Accept": "text/csv,*/*",
        },
      });
      if (!response.ok) return res.json({ points: [], year });
      const csv = await response.text();
      const lines = csv.trim().split("\n");
      if (lines.length < 2) return res.json({ points: [], year });
      const headers = lines[0].split(",").map(h => h.trim().replace(/^"|"$/g, ""));
      const idx = {
        hcX: headers.indexOf("hc_x"),
        hcY: headers.indexOf("hc_y"),
        events: headers.indexOf("events"),
        exitVelo: headers.indexOf("launch_speed"),
        distance: headers.indexOf("hit_distance_sc"),
      };
      if (idx.hcX === -1 || idx.hcY === -1) return res.json({ points: [], year });
      const points = lines.slice(1).map(line => {
        const cols = line.split(",");
        const x = parseFloat(cols[idx.hcX]);
        const y = parseFloat(cols[idx.hcY]);
        if (!x || !y || isNaN(x) || isNaN(y)) return null;
        return {
          x,
          y,
          event: (cols[idx.events] ?? "").replace(/^"|"$/g, "").trim(),
          exitVelo: idx.exitVelo !== -1 ? parseFloat(cols[idx.exitVelo]) || null : null,
          distance: idx.distance !== -1 ? parseFloat(cols[idx.distance]) || null : null,
        };
      }).filter(Boolean);
      res.json({ points, year, total: points.length });
    } catch (err) {
      res.status(500).json({ message: "Failed to fetch spray chart data" });
    }
  });

  async function resolveVideoUrls(vids: any[]) {
    return Promise.all(
      vids.map(async (v) => {
        if (!v.sourceUrl) return v;
        let key = v.sourceUrl;
        // Normalize full URLs (CDN or presigned) back to R2 key
        if (key.startsWith("https://")) {
          const match = key.match(/videos\/[^?#]+/);
          if (match) key = match[0];
        }
        if (isR2Key(key)) {
          return { ...v, sourceUrl: await getVideoUrl(key) };
        }
        return v;
      })
    );
  }

  app.get("/api/videos", async (req, res) => {
    try {
      const { category, playerId, context } = req.query;
      const userId = (req.user as any)?.id ?? null;
      const adminUsername = process.env.ADMIN_USERNAME;
      const isAdmin = !!(adminUsername && (req.user as any)?.username === adminUsername);

      let vids;
      if (category) {
        vids = (await storage.getVideosByCategory(category as string)).filter(v => v.isProVideo);
      } else if (playerId) {
        vids = await storage.getVideosByPlayer(playerId as string);
      } else {
        const proVideos = await storage.getProVideos();
        const userVideos = userId ? await storage.getVideosByUser(userId) : [];
        // Apply visibility filtering for non-admin requests
        const filteredPro = isAdmin ? proVideos : proVideos.filter(v => {
          if (context === "development") return v.showInDevelopment !== false;
          if (context === "coaching") return v.showInLibrary !== false || v.showInDevelopment !== false;
          return v.showInLibrary !== false; // default: library context
        });
        vids = [...filteredPro, ...userVideos];
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
      // Normalize sourceUrl: if a full URL was sent (CDN or presigned), extract just the R2 key
      const data = { ...parsed.data };
      if (data.sourceUrl && data.sourceUrl.startsWith("https://")) {
        const match = data.sourceUrl.match(/videos\/[^?#]+/);
        if (match) data.sourceUrl = match[0];
      }
      const video = await storage.updateVideo(req.params.id, data);
      if (!video) return res.status(404).json({ message: "Video not found" });
      res.json(video);
    } catch (err) {
      res.status(500).json({ message: "Failed to update video" });
    }
  });

  app.delete("/api/videos/:id", async (req, res) => {
    try {
      const video = await storage.getVideo(req.params.id);
      if (!video) return res.status(404).json({ message: "Video not found" });
      // Pro videos can be deleted by admin (no userId); user videos only by their owner
      const userId = (req.user as any)?.id ?? null;
      if (!video.isProVideo && video.userId && video.userId !== userId) {
        return res.status(403).json({ message: "Not authorized to delete this video" });
      }
      if (video.sourceUrl && isR2Key(video.sourceUrl)) {
        // Only delete the R2 file if no other video record references the same key
        const allVids = await storage.getAllVideos();
        const otherRefs = allVids.filter(v => v.id !== video.id && v.sourceUrl === video.sourceUrl);
        if (otherRefs.length === 0) {
          try { await deleteFromR2(video.sourceUrl); } catch {}
        }
      }
      await storage.deleteVideo(req.params.id);
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

      // Fetch career batting stats from MLB Stats API
      let careerStat: any = null;
      try {
        const careerRes = await fetch(
          `https://statsapi.mlb.com/api/v1/people/${savantId}/stats?stats=career&group=hitting`,
          { signal: AbortSignal.timeout(6000) }
        );
        if (careerRes.ok) {
          const careerData = await careerRes.json() as any;
          careerStat = careerData.stats?.[0]?.splits?.[0]?.stat ?? null;
        }
      } catch { /* non-fatal */ }

      const toStatNum = (v: any) => (v != null && v !== "" ? parseFloat(v) || null : null);
      const toStatInt = (v: any) => (v != null && v !== "" ? parseInt(v, 10) || null : null);

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
        battingAvg:            toStatNum(careerStat?.avg),
        homeRuns:              toStatInt(careerStat?.homeRuns),
        rbi:                   toStatInt(careerStat?.rbi),
        obp:                   toStatNum(careerStat?.obp),
        slg:                   toStatNum(careerStat?.slg),
        ops:                   toStatNum(careerStat?.ops),
        savantAvailable:       !!(sc || bt),
      });
    } catch (err: any) {
      console.error("MLB lookup error:", err);
      res.status(500).json({ message: "Lookup failed" });
    }
  });

  // ── Stripe ──────────────────────────────────────────────────────────────

  // Webhook — must use raw body, registered before express.json parses it
  app.post("/api/stripe/webhook", express.raw({ type: "application/json" }), async (req, res) => {
    const sig = req.headers["stripe-signature"] as string;
    try {
      await handleWebhook(req.body as Buffer, sig);
      res.json({ received: true });
    } catch (err: any) {
      console.error("Stripe webhook error:", err.message);
      res.status(400).json({ message: err.message });
    }
  });

  // Get available prices (for the pricing page)
  app.get("/api/billing/plans", (_req, res) => {
    res.json(PRICES);
  });

  // Create checkout session
  app.post("/api/billing/checkout", async (req, res) => {
    if (!req.isAuthenticated()) return res.status(401).json({ message: "Unauthorized" });
    const { priceId } = req.body;
    if (!priceId) return res.status(400).json({ message: "priceId required" });
    try {
      const url = await createCheckoutSession(
        (req.user as any).id,
        (req.user as any).email,
        priceId,
      );
      res.json({ url });
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  // Open Stripe customer portal (manage/cancel subscription)
  app.post("/api/billing/portal", async (req, res) => {
    if (!req.isAuthenticated()) return res.status(401).json({ message: "Unauthorized" });
    try {
      const url = await createPortalSession((req.user as any).id);
      res.json({ url });
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  setupCoachRoutes(app);
  setupCoachingRoutes(app);
  setupBiometricsRoutes(app);
  setupBlueprintRoutes(app);
  setupStatdleRoutes(app);
  setupAthleteRoutes(app);

  // ── Coach recording upload ─────────────────────────────────────────────────
  // Accept webm blobs from the canvas recorder, store in R2 under recordings/
  const recordingUpload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 500 * 1024 * 1024 },
  });
  app.post("/api/coaching/recordings/upload", recordingUpload.single("file"), async (req, res, next) => {
    try {
      const user = req.user as any;
      if (!user) return res.status(401).json({ message: "Not authenticated" });
      const adminUsername = process.env.ADMIN_USERNAME;
      const isAdmin = adminUsername && user.username === adminUsername;
      if ((user.accountType !== "coach" || !hasCoachAccess(user)) && !isAdmin) return res.status(403).json({ message: "Coach subscription required" });
      if (!req.file) return res.status(400).json({ message: "No file provided" });
      if (!r2Configured()) return res.status(503).json({ message: "Storage not configured" });

      const key = await uploadToR2(req.file.buffer, "recording.webm", "video/webm", "recordings");
      const url = await getVideoUrl(key);
      res.json({ key, url });
    } catch (err) { next(err); }
  });

  return httpServer;
}