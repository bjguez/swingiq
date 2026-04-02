import { Express } from "express";
import { db } from "./db";
import { acuityCompletions } from "../shared/schema";
import { eq, desc, count as drizzleCount, and } from "drizzle-orm";
import type { User } from "../shared/schema";

const FREE_EXERCISES = ["pursuit"];
const ALL_EXERCISES = ["pursuit", "peripheral_lock", "peripheral_flash", "ghost_ball", "color_filter"];
const FREE_COMPLETIONS_LIMIT = 3; // free users can complete exercise 1 up to 3 times before upsell

export function setupAcuityRoutes(app: Express) {

  // GET completed exercises + counts for the current user
  app.get("/api/acuity/completions", async (req, res) => {
    if (!req.user) return res.status(401).json({ message: "Not authenticated" });
    const user = req.user as User;
    const tier = (user as any).subscriptionTier ?? "free";
    const isAdmin = !!process.env.ADMIN_USERNAME && (user as any).username === process.env.ADMIN_USERNAME;
    const isFree = !["player", "pro", "coach"].includes(tier) && !isAdmin;
    try {
      const rows = await db
        .select()
        .from(acuityCompletions)
        .where(eq(acuityCompletions.userId, user.id))
        .orderBy(desc(acuityCompletions.completedAt))
        .limit(100);

      if (isFree) {
        // Only return pursuit completions for free users
        const freeRows = rows.filter(r => r.exerciseId === "pursuit");
        return res.json({
          completions: freeRows,
          freeCompletionCount: freeRows.length,
          freeLimit: FREE_COMPLETIONS_LIMIT,
        });
      }

      res.json({ completions: rows });
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  // POST log a completed exercise session
  app.post("/api/acuity/completions", async (req, res) => {
    if (!req.user) return res.status(401).json({ message: "Not authenticated" });
    const user = req.user as User;
    const tier = (user as any).subscriptionTier ?? "free";
    const isAdmin = !!process.env.ADMIN_USERNAME && (user as any).username === process.env.ADMIN_USERNAME;
    const isFree = !["player", "pro", "coach"].includes(tier) && !isAdmin;

    try {
      const { exerciseId, durationSecs, maxSpeed, accuracy } = req.body;

      if (!ALL_EXERCISES.includes(exerciseId)) {
        return res.status(400).json({ message: "Invalid exerciseId" });
      }

      // Free users can only complete free exercises
      if (isFree && !FREE_EXERCISES.includes(exerciseId)) {
        return res.status(403).json({ message: "free_plan_restricted" });
      }

      // Free users: enforce completion limit on pursuit
      if (isFree && exerciseId === "pursuit") {
        const [{ count }] = await db
          .select({ count: drizzleCount() })
          .from(acuityCompletions)
          .where(and(eq(acuityCompletions.userId, user.id), eq(acuityCompletions.exerciseId, "pursuit")));
        if (Number(count) >= FREE_COMPLETIONS_LIMIT) {
          return res.status(403).json({ message: "free_limit_reached" });
        }
      }

      const [row] = await db.insert(acuityCompletions).values({
        userId: user.id,
        exerciseId,
        durationSecs: durationSecs ?? null,
        maxSpeed: maxSpeed ?? null,
        accuracy: accuracy ?? null,
      }).returning();

      res.status(201).json(row);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });
}
