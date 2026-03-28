import { Express } from "express";
import { db } from "./db";
import { statlePlayers } from "../shared/schema";
import { eq, ilike, asc, and } from "drizzle-orm";

const EPOCH = new Date("2025-01-01T00:00:00Z");
const MAX_GUESSES = 6;

function getDayIndex(dateStr: string): number {
  const d = new Date(dateStr + "T00:00:00Z");
  const diff = Math.floor((d.getTime() - EPOCH.getTime()) / (1000 * 60 * 60 * 24));
  return Math.max(0, diff);
}

function todayStr(): string {
  return new Date().toISOString().split("T")[0];
}

async function getActivePlayers() {
  return db
    .select()
    .from(statlePlayers)
    .where(eq(statlePlayers.active, true))
    .orderBy(asc(statlePlayers.mlbId));
}

async function getDailyPlayer(dateStr: string) {
  const players = await getActivePlayers();
  if (!players.length) return null;
  const idx = getDayIndex(dateStr) % players.length;
  return players[idx];
}

function buildClues(player: any) {
  const isPitcher = player.position === "P" || player.position === "SP" || player.position === "RP" || player.position === "CL";
  const stats = (player.careerStats ?? {}) as Record<string, any>;

  const careerSpan =
    player.careerStart && player.careerEnd
      ? player.careerStart === player.careerEnd
        ? String(player.careerStart)
        : `${player.careerStart} - ${player.careerEnd}`
      : "Unknown";

  const keyStats = isPitcher
    ? `${stats.wins ?? "?"}W  ${stats.era ?? "?"}ERA  ${stats.so ?? "?"}K`
    : `${stats.hr ?? "?"}HR  ${stats.rbi ?? "?"}RBI  .${String(Math.round((stats.avg ?? 0) * 1000)).padStart(3, "0")} AVG`;

  // Better clues first: teams, stats, birthplace — then narrowing clues
  return [
    { label: "Teams", value: Array.isArray(player.teams) && player.teams.length ? player.teams.join(", ") : "N/A" },
    { label: isPitcher ? "Career pitching" : "Career hitting", value: keyStats },
    { label: "Born in", value: player.birthCountry ?? "Unknown" },
    { label: "Position", value: player.position },
    { label: "Bats / Throws", value: `${player.bats ?? "?"}/${player.throwsHand ?? "?"}` },
    { label: "Career", value: careerSpan },
    { label: "Career WAR", value: player.careerWar != null ? player.careerWar.toFixed(1) : "N/A" },
  ];
}

export function setupStatdleRoutes(app: Express) {

  // GET /api/statdle/daily
  app.get("/api/statdle/daily", async (_req, res) => {
    try {
      const date = todayStr();
      const player = await getDailyPlayer(date);
      if (!player) return res.status(503).json({ error: "No players in pool yet" });
      res.json({ date, clues: buildClues(player), totalClues: 7, maxGuesses: MAX_GUESSES, mlbId: player.mlbId, nameLength: player.name });
    } catch {
      res.status(500).json({ error: "Server error" });
    }
  });

  // GET /api/statdle/game/:date — clues for an archive date
  app.get("/api/statdle/game/:date", async (req, res) => {
    try {
      const { date } = req.params;
      if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return res.status(400).json({ error: "Invalid date" });
      const player = await getDailyPlayer(date);
      if (!player) return res.status(503).json({ error: "No players in pool yet" });
      res.json({ date, clues: buildClues(player), totalClues: 7, maxGuesses: MAX_GUESSES, mlbId: player.mlbId, nameLength: player.name });
    } catch {
      res.status(500).json({ error: "Server error" });
    }
  });

  // GET /api/statdle/archive — last 30 days, player name revealed
  app.get("/api/statdle/archive", async (_req, res) => {
    try {
      const players = await getActivePlayers();
      if (!players.length) return res.json([]);

      const today = todayStr();
      const archive = [];

      for (let i = 1; i <= 30; i++) {
        const d = new Date(today + "T00:00:00Z");
        d.setUTCDate(d.getUTCDate() - i);
        const dateStr = d.toISOString().split("T")[0];
        const idx = getDayIndex(dateStr) % players.length;
        const p = players[idx];
        archive.push({ date: dateStr, playerName: p.name, position: p.position });
      }

      res.json(archive);
    } catch {
      res.status(500).json({ error: "Server error" });
    }
  });

  // GET /api/statdle/players/search?q=
  app.get("/api/statdle/players/search", async (req, res) => {
    try {
      const q = ((req.query.q as string) ?? "").trim();
      if (!q || q.length < 2) return res.json([]);

      const results = await db
        .select({ id: statlePlayers.id, name: statlePlayers.name })
        .from(statlePlayers)
        .where(and(ilike(statlePlayers.name, `%${q}%`), eq(statlePlayers.active, true)))
        .orderBy(asc(statlePlayers.name))
        .limit(10);

      res.json(results);
    } catch {
      res.status(500).json({ error: "Server error" });
    }
  });

  // POST /api/statdle/guess
  app.post("/api/statdle/guess", async (req, res) => {
    try {
      const { date, guessName, reveal } = req.body as {
        date: string;
        guessName: string;
        reveal?: boolean;
      };

      if (!date || !guessName) return res.status(400).json({ error: "Missing date or guessName" });

      const player = await getDailyPlayer(date);
      if (!player) return res.status(503).json({ error: "No player found" });

      const correct = player.name.toLowerCase() === guessName.toLowerCase();
      const response: any = { correct };

      if (correct || reveal) {
        response.answer = { name: player.name, clues: buildClues(player) };
      }

      res.json(response);
    } catch {
      res.status(500).json({ error: "Server error" });
    }
  });
}
