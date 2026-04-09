import { Express } from "express";
import { db } from "./db";
import { confidenceSessions, userAffirmations } from "../shared/schema";
import { eq, desc, count as drizzleCount } from "drizzle-orm";
import type { User } from "../shared/schema";

const FREE_CONFIDENCE_LIMIT = 3;

function isPaidUser(user: User): boolean {
  return (user as any).isAdmin || ["player", "pro", "coach"].includes((user as any).subscriptionTier ?? "free");
}

export function setupConfidenceRoutes(app: Express) {

  // ── Confidence sessions ───────────────────────────────────────────────────

  app.get("/api/confidence/sessions", async (req, res) => {
    if (!req.user) return res.status(401).json({ message: "Not authenticated" });
    const user = req.user as User;
    try {
      if (!isPaidUser(user)) {
        const [{ count }] = await db
          .select({ count: drizzleCount() })
          .from(confidenceSessions)
          .where(eq(confidenceSessions.userId, user.id));
        return res.json({ freeSessionCount: Number(count), limit: FREE_CONFIDENCE_LIMIT });
      }
      const sessions = await db
        .select()
        .from(confidenceSessions)
        .where(eq(confidenceSessions.userId, user.id))
        .orderBy(desc(confidenceSessions.completedAt))
        .limit(30);
      res.json(sessions);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.post("/api/confidence/sessions", async (req, res) => {
    if (!req.user) return res.status(401).json({ message: "Not authenticated" });
    const user = req.user as User;
    try {
      const { durationMinutes, cyclesCompleted } = req.body;
      if (typeof durationMinutes !== "number" || typeof cyclesCompleted !== "number") {
        return res.status(400).json({ message: "Missing required fields" });
      }
      if (!isPaidUser(user)) {
        const [{ count }] = await db
          .select({ count: drizzleCount() })
          .from(confidenceSessions)
          .where(eq(confidenceSessions.userId, user.id));
        if (Number(count) >= FREE_CONFIDENCE_LIMIT) {
          return res.status(403).json({ message: "free_limit_reached" });
        }
      }
      const [session] = await db.insert(confidenceSessions).values({
        userId: user.id,
        durationMinutes,
        cyclesCompleted,
      }).returning();
      res.status(201).json(session);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  // ── User affirmations ─────────────────────────────────────────────────────

  app.get("/api/confidence/affirmations", async (req, res) => {
    if (!req.user) return res.status(401).json({ message: "Not authenticated" });
    const user = req.user as User;
    try {
      const rows = await db
        .select()
        .from(userAffirmations)
        .where(eq(userAffirmations.userId, user.id))
        .orderBy(desc(userAffirmations.createdAt));
      res.json(rows);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.post("/api/confidence/affirmations", async (req, res) => {
    if (!req.user) return res.status(401).json({ message: "Not authenticated" });
    const user = req.user as User;
    try {
      const { text } = req.body;
      if (!text || typeof text !== "string" || text.trim().length === 0) {
        return res.status(400).json({ message: "Affirmation text is required" });
      }
      if (text.trim().length > 200) {
        return res.status(400).json({ message: "Affirmation must be 200 characters or fewer" });
      }
      const [row] = await db.insert(userAffirmations).values({
        userId: user.id,
        text: text.trim(),
      }).returning();
      res.status(201).json(row);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.delete("/api/confidence/affirmations/:id", async (req, res) => {
    if (!req.user) return res.status(401).json({ message: "Not authenticated" });
    const user = req.user as User;
    try {
      const { id } = req.params;
      // Only delete if it belongs to this user
      const [deleted] = await db
        .delete(userAffirmations)
        .where(eq(userAffirmations.id, id))
        .returning();
      if (!deleted || deleted.userId !== user.id) {
        return res.status(404).json({ message: "Not found" });
      }
      res.json({ ok: true });
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });
}
