import { Express } from "express";
import { db } from "./db";
import { statlePlayers } from "../shared/schema";
import { eq, asc, and, isNotNull, gte } from "drizzle-orm";

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

// Normalize a string to plain a-z letters only
function normalizeLetters(s: string): string {
  return s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z]/g, "");
}

// Returns letter counts per word (spaces excluded), e.g. "Mike Trout" → [4, 5]
function getNameStructure(name: string): number[] {
  return name.split(" ").map(w => normalizeLetters(w).length).filter(n => n > 0);
}

// Wordle-style letter comparison
function compareLetters(guessLetters: string, answerName: string): ("correct" | "present" | "absent")[] {
  const answer = normalizeLetters(answerName).split("");
  const guess = normalizeLetters(guessLetters).split("").slice(0, answer.length);
  while (guess.length < answer.length) guess.push("");

  const result: ("correct" | "present" | "absent")[] = Array(answer.length).fill("absent");
  const remaining = [...answer];

  for (let i = 0; i < answer.length; i++) {
    if (guess[i] === answer[i]) {
      result[i] = "correct";
      remaining[i] = "_";
    }
  }
  for (let i = 0; i < answer.length; i++) {
    if (result[i] === "correct") continue;
    const idx = remaining.indexOf(guess[i]);
    if (idx !== -1) {
      result[i] = "present";
      remaining[idx] = "_";
    }
  }
  return result;
}

async function getActivePlayers() {
  return db
    .select()
    .from(statlePlayers)
    .where(and(
      eq(statlePlayers.active, true),
      isNotNull(statlePlayers.careerStats),
      gte(statlePlayers.careerStart, 2000),
    ))
    .orderBy(asc(statlePlayers.mlbId));
}

async function getDailyPlayer(dateStr: string) {
  const players = await getActivePlayers();
  if (!players.length) return null;
  const idx = getDayIndex(dateStr) % players.length;
  return players[idx];
}

function buildClues(player: any) {
  const isPitcher = ["P", "SP", "RP", "CL"].includes(player.position);
  const stats = (player.careerStats ?? {}) as Record<string, any>;

  const careerSpan =
    player.careerStart && player.careerEnd
      ? player.careerStart === player.careerEnd
        ? String(player.careerStart)
        : `${player.careerStart} - ${player.careerEnd}`
      : "Unknown";

  let keyStats = "N/A";
  if (isPitcher && stats.wins != null) {
    keyStats = `${stats.wins}W  ${stats.era ?? "?"}ERA  ${stats.so ?? "?"}K`;
  } else if (!isPitcher && stats.hr != null) {
    const avgStr = stats.avg != null
      ? `.${String(Math.round(stats.avg * 1000)).padStart(3, "0")}`
      : ".???";
    keyStats = `${stats.hr}HR  ${stats.rbi ?? "?"}RBI  ${avgStr} AVG`;
  }

  return [
    { label: "Position", value: player.position },
    { label: "Born in", value: player.birthCountry ?? "Unknown" },
    { label: isPitcher ? "Career pitching" : "Career hitting", value: keyStats },
    { label: "Career", value: careerSpan },
    { label: "Teams", value: Array.isArray(player.teams) && player.teams.length ? player.teams.join(", ") : "N/A" },
    { label: "Bats / Throws", value: `${player.bats ?? "?"}/${player.throwsHand ?? "?"}` },
    { label: "Career WAR", value: player.careerWar != null ? player.careerWar.toFixed(1) : "N/A" },
  ];
}

function buildGameResponse(player: any, date: string) {
  return {
    date,
    clues: buildClues(player),
    totalClues: 7,
    maxGuesses: MAX_GUESSES,
    mlbId: player.mlbId,
    nameStructure: getNameStructure(player.name),
  };
}

export function setupStatdleRoutes(app: Express) {

  // GET /api/statdle/random?seed=
  app.get("/api/statdle/random", async (req, res) => {
    try {
      const players = await getActivePlayers();
      if (!players.length) return res.status(503).json({ error: "No players in pool yet" });
      const seed = parseInt(req.query.seed as string) || Math.floor(Math.random() * 999999);
      const player = players[((seed % players.length) + players.length) % players.length];
      res.json({ ...buildGameResponse(player, `random-${seed}`), seed });
    } catch {
      res.status(500).json({ error: "Server error" });
    }
  });


  // GET /api/statdle/daily
  app.get("/api/statdle/daily", async (_req, res) => {
    try {
      const date = todayStr();
      const player = await getDailyPlayer(date);
      if (!player) return res.status(503).json({ error: "No players in pool yet" });
      res.json(buildGameResponse(player, date));
    } catch {
      res.status(500).json({ error: "Server error" });
    }
  });

  // GET /api/statdle/game/:date
  app.get("/api/statdle/game/:date", async (req, res) => {
    try {
      const { date } = req.params;
      if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return res.status(400).json({ error: "Invalid date" });
      const player = await getDailyPlayer(date);
      if (!player) return res.status(503).json({ error: "No players in pool yet" });
      res.json(buildGameResponse(player, date));
    } catch {
      res.status(500).json({ error: "Server error" });
    }
  });

  // GET /api/statdle/archive — last 30 days, dates only (no player names)
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
        archive.push({ date: dateStr });
      }

      res.json(archive);
    } catch {
      res.status(500).json({ error: "Server error" });
    }
  });

  // POST /api/statdle/guess
  app.post("/api/statdle/guess", async (req, res) => {
    try {
      const { date, guessLetters, reveal } = req.body as {
        date: string;
        guessLetters?: string;
        reveal?: boolean;
      };

      if (!date) return res.status(400).json({ error: "Missing date" });

      let player;
      const randomMatch = date.match(/^random-(\d+)$/);
      if (randomMatch) {
        const players = await getActivePlayers();
        const seed = parseInt(randomMatch[1]);
        player = players[((seed % players.length) + players.length) % players.length];
      } else {
        player = await getDailyPlayer(date);
      }
      if (!player) return res.status(503).json({ error: "No player found" });

      if (reveal) {
        return res.json({ correct: false, answer: { name: player.name } });
      }

      if (!guessLetters) return res.status(400).json({ error: "Missing guessLetters" });

      const correct = normalizeLetters(guessLetters) === normalizeLetters(player.name);
      const letterResults = compareLetters(guessLetters, player.name);
      const response: any = { correct, letterResults };

      if (correct) {
        response.answer = { name: player.name };
      }

      res.json(response);
    } catch {
      res.status(500).json({ error: "Server error" });
    }
  });
}
