import { Express } from "express";
import { db } from "./db";
import { blueprintContent, playerPhaseFocus } from "../shared/schema";
import { eq, and, asc } from "drizzle-orm";
import { getVideoUrl, isR2Key } from "./r2";
import type { User } from "../shared/schema";

const VALID_PHASES = ["foundation", "gather", "lag", "on_plane", "contact", "finish"] as const;

async function resolveUrl(key: string | null | undefined): Promise<string | null> {
  if (!key) return null;
  if (isR2Key(key)) return getVideoUrl(key);
  return key;
}

export function setupBlueprintRoutes(app: Express) {

  // ── GET all blueprint content (optionally filtered by phase) ─────────────
  app.get("/api/blueprint/content", async (req, res) => {
    try {
      const { phase } = req.query;
      const rows = phase
        ? await db.select().from(blueprintContent)
            .where(eq(blueprintContent.phase, phase as string))
            .orderBy(asc(blueprintContent.sortOrder), asc(blueprintContent.createdAt))
        : await db.select().from(blueprintContent)
            .orderBy(asc(blueprintContent.phase), asc(blueprintContent.sortOrder), asc(blueprintContent.createdAt));

      const resolved = await Promise.all(
        rows.map(async (row) => ({
          ...row,
          videoUrl: await resolveUrl(row.sourceUrl),
        }))
      );
      res.json(resolved);
    } catch (err) {
      console.error("Blueprint content fetch error:", err);
      res.status(500).json({ message: "Failed to fetch blueprint content" });
    }
  });

  // ── POST create blueprint content (admin only) ───────────────────────────
  app.post("/api/blueprint/content", async (req, res) => {
    try {
      const user = req.user as User | undefined;
      const adminUsername = process.env.ADMIN_USERNAME;
      if (!user || !adminUsername || user.username !== adminUsername) {
        return res.status(403).json({ message: "Admin only" });
      }
      const { phase, contentType, title, description, sourceUrl, thumbnailUrl, sortOrder } = req.body;
      if (!phase || !title) {
        return res.status(400).json({ message: "phase and title are required" });
      }
      if (!VALID_PHASES.includes(phase)) {
        return res.status(400).json({ message: "Invalid phase" });
      }
      const [created] = await db.insert(blueprintContent).values({
        phase,
        contentType: contentType ?? "drill",
        title,
        description: description ?? null,
        sourceUrl: sourceUrl ?? null,
        thumbnailUrl: thumbnailUrl ?? null,
        sortOrder: sortOrder ?? 0,
      }).returning();
      const videoUrl = await resolveUrl(created.sourceUrl);
      res.status(201).json({ ...created, videoUrl });
    } catch (err) {
      console.error("Blueprint content create error:", err);
      res.status(500).json({ message: "Failed to create blueprint content" });
    }
  });

  // ── PATCH update blueprint content (admin only) ──────────────────────────
  app.patch("/api/blueprint/content/:id", async (req, res) => {
    try {
      const user = req.user as User | undefined;
      const adminUsername = process.env.ADMIN_USERNAME;
      if (!user || !adminUsername || user.username !== adminUsername) {
        return res.status(403).json({ message: "Admin only" });
      }
      const { title, description, contentType, sortOrder } = req.body;
      const [updated] = await db.update(blueprintContent)
        .set({ title, description, contentType, sortOrder })
        .where(eq(blueprintContent.id, req.params.id))
        .returning();
      if (!updated) return res.status(404).json({ message: "Not found" });
      res.json({ ...updated, videoUrl: await resolveUrl(updated.sourceUrl) });
    } catch (err) {
      res.status(500).json({ message: "Failed to update blueprint content" });
    }
  });

  // ── DELETE blueprint content (admin only) ────────────────────────────────
  app.delete("/api/blueprint/content/:id", async (req, res) => {
    try {
      const user = req.user as User | undefined;
      const adminUsername = process.env.ADMIN_USERNAME;
      if (!user || !adminUsername || user.username !== adminUsername) {
        return res.status(403).json({ message: "Admin only" });
      }
      await db.delete(blueprintContent).where(eq(blueprintContent.id, req.params.id));
      res.json({ ok: true });
    } catch (err) {
      res.status(500).json({ message: "Failed to delete blueprint content" });
    }
  });

  // ── GET player phase focus ────────────────────────────────────────────────
  app.get("/api/blueprint/focus", async (req, res) => {
    try {
      const user = req.user as User | undefined;
      if (!user) return res.status(401).json({ message: "Unauthorized" });
      const rows = await db.select().from(playerPhaseFocus)
        .where(eq(playerPhaseFocus.userId, user.id));
      res.json(rows.map(r => r.phase));
    } catch (err) {
      res.status(500).json({ message: "Failed to fetch focus phases" });
    }
  });

  // ── POST toggle phase focus ───────────────────────────────────────────────
  app.post("/api/blueprint/focus/:phase", async (req, res) => {
    try {
      const user = req.user as User | undefined;
      if (!user) return res.status(401).json({ message: "Unauthorized" });
      const { phase } = req.params;
      if (!VALID_PHASES.includes(phase as any)) {
        return res.status(400).json({ message: "Invalid phase" });
      }
      // Toggle: if exists, delete; if not, insert
      const existing = await db.select().from(playerPhaseFocus)
        .where(and(eq(playerPhaseFocus.userId, user.id), eq(playerPhaseFocus.phase, phase)));
      if (existing.length > 0) {
        await db.delete(playerPhaseFocus)
          .where(and(eq(playerPhaseFocus.userId, user.id), eq(playerPhaseFocus.phase, phase)));
        res.json({ active: false });
      } else {
        await db.insert(playerPhaseFocus).values({ userId: user.id, phase });
        res.json({ active: true });
      }
    } catch (err) {
      res.status(500).json({ message: "Failed to update focus" });
    }
  });
}
