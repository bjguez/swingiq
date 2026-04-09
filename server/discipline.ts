import { Express } from "express";
import { db } from "./db";
import { disciplineSessions } from "../shared/schema";
import { eq, desc } from "drizzle-orm";
import type { User } from "../shared/schema";
import { checkAndAwardBadges } from "./badges";
import { sendMilestoneEmailIfNeeded } from "./cron";

export function setupDisciplineRoutes(app: Express) {

  // GET recent discipline sessions for the current user
  app.get("/api/discipline/sessions", async (req, res) => {
    if (!req.user) return res.status(401).json({ message: "Not authenticated" });
    const user = req.user as User;
    try {
      const rows = await db
        .select()
        .from(disciplineSessions)
        .where(eq(disciplineSessions.userId, user.id))
        .orderBy(desc(disciplineSessions.completedAt))
        .limit(20);
      res.json(rows);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  // POST save a completed discipline session
  app.post("/api/discipline/sessions", async (req, res) => {
    if (!req.user) return res.status(401).json({ message: "Not authenticated" });
    const user = req.user as User;
    try {
      const {
        totalPitches, swings, goodSwings, chases,
        calledStrikes, goodTakes, disciplinePct,
        chaseRate, calledStrikeRate, avgReactionMs, level,
      } = req.body;

      if (typeof totalPitches !== "number" || totalPitches < 1) {
        return res.status(400).json({ message: "Invalid session data" });
      }

      const [row] = await db.insert(disciplineSessions).values({
        userId: user.id,
        totalPitches,
        swings: swings ?? 0,
        goodSwings: goodSwings ?? 0,
        chases: chases ?? 0,
        calledStrikes: calledStrikes ?? 0,
        goodTakes: goodTakes ?? 0,
        disciplinePct: disciplinePct ?? 0,
        chaseRate: chaseRate ?? 0,
        calledStrikeRate: calledStrikeRate ?? 0,
        avgReactionMs: avgReactionMs ?? null,
        level: level ?? "rookie",
      }).returning();

      res.status(201).json(row);
      checkAndAwardBadges(user.id).then(async (newBadges) => {
        if (newBadges.length > 0) {
          const u = req.user as any;
          if (u?.email) await sendMilestoneEmailIfNeeded(user.id, u.email, u.firstName || "Hitter", newBadges);
        }
      }).catch(() => {});
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });
}
