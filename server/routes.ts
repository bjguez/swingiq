import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { insertMlbPlayerSchema, insertVideoSchema, insertDrillSchema, insertSessionSchema } from "@shared/schema";

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {

  // MLB Players
  app.get("/api/players", async (_req, res) => {
    const players = await storage.getAllPlayers();
    res.json(players);
  });

  app.get("/api/players/:id", async (req, res) => {
    const player = await storage.getPlayer(req.params.id);
    if (!player) return res.status(404).json({ message: "Player not found" });
    res.json(player);
  });

  app.post("/api/players", async (req, res) => {
    const parsed = insertMlbPlayerSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ message: parsed.error.message });
    const player = await storage.createPlayer(parsed.data);
    res.status(201).json(player);
  });

  // Videos
  app.get("/api/videos", async (req, res) => {
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
  });

  app.get("/api/videos/:id", async (req, res) => {
    const video = await storage.getVideo(req.params.id);
    if (!video) return res.status(404).json({ message: "Video not found" });
    res.json(video);
  });

  app.post("/api/videos", async (req, res) => {
    const parsed = insertVideoSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ message: parsed.error.message });
    const video = await storage.createVideo(parsed.data);
    res.status(201).json(video);
  });

  // Drills
  app.get("/api/drills", async (req, res) => {
    const { phase } = req.query;
    if (phase) {
      const d = await storage.getDrillsByPhase(phase as string);
      return res.json(d);
    }
    const d = await storage.getAllDrills();
    res.json(d);
  });

  app.get("/api/drills/:id", async (req, res) => {
    const drill = await storage.getDrill(req.params.id);
    if (!drill) return res.status(404).json({ message: "Drill not found" });
    res.json(drill);
  });

  app.post("/api/drills", async (req, res) => {
    const parsed = insertDrillSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ message: parsed.error.message });
    const drill = await storage.createDrill(parsed.data);
    res.status(201).json(drill);
  });

  // Sessions
  app.get("/api/sessions/:id", async (req, res) => {
    const session = await storage.getSession(req.params.id);
    if (!session) return res.status(404).json({ message: "Session not found" });
    res.json(session);
  });

  app.post("/api/sessions", async (req, res) => {
    const parsed = insertSessionSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ message: parsed.error.message });
    const session = await storage.createSession(parsed.data);
    res.status(201).json(session);
  });

  app.patch("/api/sessions/:id", async (req, res) => {
    const session = await storage.updateSession(req.params.id, req.body);
    if (!session) return res.status(404).json({ message: "Session not found" });
    res.json(session);
  });

  return httpServer;
}