import { Express } from "express";
import { db } from "./db";
import { mlbPlayers, userPlayerComps } from "../shared/schema";
import { eq, and } from "drizzle-orm";
import { User } from "../shared/schema";

// ── CDC Growth Chart data for boys (ages 10–18) ──────────────────────────────
// [P5, P25, P50, P75, P95] in inches / lbs
const CDC_HEIGHT: Record<number, [number, number, number, number, number]> = {
  10: [51.4, 53.2, 54.8, 56.5, 59.0],
  11: [53.2, 55.2, 57.0, 59.0, 62.0],
  12: [55.0, 57.2, 59.2, 61.5, 65.0],
  13: [57.3, 59.8, 62.0, 64.3, 67.8],
  14: [60.0, 62.5, 64.5, 66.8, 70.0],
  15: [62.0, 64.3, 66.3, 68.5, 71.5],
  16: [63.4, 65.4, 67.2, 69.2, 72.0],
  17: [64.2, 66.0, 67.8, 69.7, 72.4],
  18: [64.5, 66.3, 68.1, 70.0, 72.7],
};
const CDC_WEIGHT: Record<number, [number, number, number, number, number]> = {
  10: [57,  68,  80,  97,  130],
  11: [63,  76,  90,  110, 149],
  12: [70,  85,  101, 124, 170],
  13: [79,  96,  115, 142, 191],
  14: [89,  107, 128, 156, 203],
  15: [99,  117, 139, 167, 212],
  16: [107, 126, 148, 176, 221],
  17: [112, 131, 154, 182, 226],
  18: [117, 136, 159, 186, 230],
};
// Adult male reference (19+) — approximate population percentiles
const ADULT_HEIGHT: [number, number, number, number, number] = [65.0, 67.5, 69.3, 71.0, 73.5];
const ADULT_WEIGHT: [number, number, number, number, number] = [135, 160, 185, 210, 245];

function interpolatePercentile(value: number, bp: [number, number, number, number, number]): number {
  const [p5, p25, p50, p75, p95] = bp;
  if (value <= p5)  return 5  * (value / p5);
  if (value <= p25) return 5  + (value - p5)  / (p25 - p5)  * 20;
  if (value <= p50) return 25 + (value - p25) / (p50 - p25) * 25;
  if (value <= p75) return 50 + (value - p50) / (p75 - p50) * 25;
  if (value <= p95) return 75 + (value - p75) / (p95 - p75) * 20;
  return Math.min(99, 95 + (value - p95) / (p95 * 0.05) * 4);
}

function getHeightBreakpoints(age: number) {
  if (age <= 10) return CDC_HEIGHT[10];
  if (age >= 18) return CDC_HEIGHT[18];
  return CDC_HEIGHT[Math.round(age)] ?? ADULT_HEIGHT;
}
function getWeightBreakpoints(age: number) {
  if (age <= 10) return CDC_WEIGHT[10];
  if (age >= 18) return CDC_WEIGHT[18];
  return CDC_WEIGHT[Math.round(age)] ?? ADULT_WEIGHT;
}

// Parse "6'2"" or "6' 2"" → total inches
function parseHeight(h: string): number {
  const m = h.match(/(\d+)'\s*(\d*)/);
  if (!m) return 0;
  return parseInt(m[1]) * 12 + (parseInt(m[2]) || 0);
}

export function setupBiometricsRoutes(app: Express) {

  // GET /api/biometrics/comps — return saved comps with full player data
  app.get("/api/biometrics/comps", async (req, res, next) => {
    try {
      const user = req.user as User | undefined;
      if (!user) return res.status(401).json({ message: "Not authenticated" });

      const rows = await db
        .select({
          id: userPlayerComps.id,
          compType: userPlayerComps.compType,
          rank: userPlayerComps.rank,
          createdAt: userPlayerComps.createdAt,
          player: mlbPlayers,
        })
        .from(userPlayerComps)
        .leftJoin(mlbPlayers, eq(userPlayerComps.mlbPlayerId, mlbPlayers.id))
        .where(eq(userPlayerComps.userId, user.id));

      // Sort: auto comps by rank (1,2,3), then manual
      const sorted = rows.sort((a, b) => {
        if (a.compType === "auto" && b.compType === "auto") return (a.rank ?? 99) - (b.rank ?? 99);
        if (a.compType === "auto") return -1;
        if (b.compType === "auto") return 1;
        return 0;
      });

      res.json(sorted);
    } catch (err) { next(err); }
  });

  // POST /api/biometrics/find-comps — run algorithm, replace auto comps
  app.post("/api/biometrics/find-comps", async (req, res, next) => {
    try {
      const user = req.user as User | undefined;
      if (!user) return res.status(401).json({ message: "Not authenticated" });

      const { age, heightInches, weightLbs, bats } = user as any;
      if (!age || !heightInches || !weightLbs || !bats) {
        return res.status(400).json({ message: "Profile incomplete: need age, height, weight, and batting hand" });
      }

      // Get all MLB players with height + weight
      const players = await db.select().from(mlbPlayers);
      const validPlayers = players.filter(p => p.height && p.weight);

      // Compute MLB height/weight percentile arrays for dynamic ranking
      const mlbHeights = validPlayers
        .map(p => ({ id: p.id, val: parseHeight(p.height!) }))
        .filter(x => x.val > 0)
        .sort((a, b) => a.val - b.val);
      const mlbWeights = validPlayers
        .map(p => ({ id: p.id, val: p.weight! }))
        .sort((a, b) => a.val - b.val);

      function mlbPercentileForVal(sorted: { id: string; val: number }[], val: number): number {
        const idx = sorted.findIndex(x => x.val >= val);
        if (idx === -1) return 99;
        return (idx / sorted.length) * 100;
      }

      // Youth player's CDC percentiles
      const userHeightPct = interpolatePercentile(heightInches, getHeightBreakpoints(age));
      const userWeightPct = interpolatePercentile(weightLbs, getWeightBreakpoints(age));

      // Target MLB values at those same percentiles
      const targetMLBHeight = mlbHeights[Math.round((userHeightPct / 100) * (mlbHeights.length - 1))]?.val ?? 73;
      const targetMLBWeight = mlbWeights[Math.round((userWeightPct / 100) * (mlbWeights.length - 1))]?.val ?? 205;

      // Score each player
      const scored = validPlayers
        .filter(p => {
          if (!bats || bats === "S") return true; // switch hitter matches anyone
          if (!p.bats) return true;
          return p.bats === bats || p.bats === "S";
        })
        .map(p => {
          const ph = parseHeight(p.height!);
          const pw = p.weight!;
          const heightDiff = Math.abs(ph - targetMLBHeight);
          const weightDiff = Math.abs(pw - targetMLBWeight);
          // Normalize diffs: 1 inch ≈ same weight as 5 lbs
          const score = heightDiff * 5 + weightDiff;
          return { player: p, score };
        })
        .sort((a, b) => a.score - b.score)
        .slice(0, 3);

      // Delete existing auto comps for this user
      await db.delete(userPlayerComps).where(
        and(eq(userPlayerComps.userId, user.id), eq(userPlayerComps.compType, "auto"))
      );

      // Insert new auto comps
      for (let i = 0; i < scored.length; i++) {
        await db.insert(userPlayerComps)
          .values({ userId: user.id, mlbPlayerId: scored[i].player.id, compType: "auto", rank: i + 1 })
          .onConflictDoUpdate({ target: [userPlayerComps.userId, userPlayerComps.mlbPlayerId], set: { compType: "auto", rank: i + 1 } });
      }

      res.json({ count: scored.length, comps: scored.map(s => s.player) });
    } catch (err) { next(err); }
  });

  // POST /api/biometrics/comps/favorite — add a manual study player
  app.post("/api/biometrics/comps/favorite", async (req, res, next) => {
    try {
      const user = req.user as User | undefined;
      if (!user) return res.status(401).json({ message: "Not authenticated" });

      const { mlbPlayerId } = req.body;
      if (!mlbPlayerId) return res.status(400).json({ message: "mlbPlayerId required" });

      // Verify player exists
      const [player] = await db.select().from(mlbPlayers).where(eq(mlbPlayers.id, mlbPlayerId));
      if (!player) return res.status(404).json({ message: "Player not found" });

      await db.insert(userPlayerComps)
        .values({ userId: user.id, mlbPlayerId, compType: "manual", rank: null })
        .onConflictDoNothing();

      res.json({ message: "Added" });
    } catch (err) { next(err); }
  });

  // DELETE /api/biometrics/comps/:id — remove a comp
  app.delete("/api/biometrics/comps/:id", async (req, res, next) => {
    try {
      const user = req.user as User | undefined;
      if (!user) return res.status(401).json({ message: "Not authenticated" });

      await db.delete(userPlayerComps).where(
        and(eq(userPlayerComps.id, req.params.id), eq(userPlayerComps.userId, user.id))
      );

      res.json({ message: "Removed" });
    } catch (err) { next(err); }
  });
}
