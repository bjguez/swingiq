import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { insertMlbPlayerSchema, insertVideoSchema, insertDrillSchema, insertSessionSchema } from "@shared/schema";
import multer from "multer";
import path from "path";
import fs from "fs";
import express from "express";

const uploadDir = path.resolve("uploads");
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const upload = multer({
  storage: multer.diskStorage({
    destination: (_req, _file, cb) => cb(null, uploadDir),
    filename: (_req, file, cb) => {
      const unique = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
      cb(null, `${unique}${path.extname(file.originalname)}`);
    },
  }),
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
      const fileUrl = `/uploads/${req.file.filename}`;
      const video = await storage.createVideo({
        title: req.body.title || req.file.originalname,
        category: req.body.category || "Full Swings",
        playerName: req.body.playerName || "Amateur",
        source: "Upload",
        sourceUrl: fileUrl,
        duration: req.body.duration || null,
        fps: req.body.fps ? parseInt(req.body.fps) : null,
        isProVideo: false,
        playerId: null,
        thumbnailUrl: null,
      });
      res.status(201).json(video);
    } catch (err: any) {
      console.error("Upload error:", err);
      res.status(500).json({ message: "Failed to save uploaded video" });
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

  app.get("/api/videos", async (req, res) => {
    try {
      const { category, playerId } = req.query;
      if (category) {
        const vids = await storage.getVideosByCategory(category as string);
        return res.json(vids);
      }
      if (playerId) {
        const vids = await storage.getVideosByPlayer(playerId as string);
        return res.json(vids);
      }
      const vids = await storage.getAllVideos();
      res.json(vids);
    } catch (err) {
      res.status(500).json({ message: "Failed to fetch videos" });
    }
  });

  app.get("/api/videos/:id", async (req, res) => {
    try {
      const video = await storage.getVideo(req.params.id);
      if (!video) return res.status(404).json({ message: "Video not found" });
      res.json(video);
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
    try {
      const video = await storage.updateVideo(req.params.id, req.body);
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
    try {
      const session = await storage.updateSession(req.params.id, req.body);
      if (!session) return res.status(404).json({ message: "Session not found" });
      res.json(session);
    } catch (err) {
      res.status(500).json({ message: "Failed to update session" });
    }
  });

  return httpServer;
}