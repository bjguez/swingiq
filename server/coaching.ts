import { Express } from "express";
import { db } from "./db";
import { coachSessions, notifications, messages, coachPlayers, videos, users } from "../shared/schema";
import { eq, and, desc, or, isNull } from "drizzle-orm";
import { User } from "../shared/schema";
import { hasCoachAccess } from "./coachAccess";
import { Resend } from "resend";
import { getVideoUrl, isR2Key } from "./r2";

const resend = new Resend(process.env.RESEND_API_KEY);
const FROM = "Swing Studio <noreply@swingstudio.ai>";
const APP_URL = process.env.APP_URL || "https://swingstudio.ai";

const PAID_TIERS = ["player", "pro", "coach"];

async function createNotification(
  userId: string,
  type: string,
  title: string,
  message: string,
  metadata?: Record<string, any>,
) {
  await db.insert(notifications).values({ userId, type, title, message, metadata: metadata ?? null });
}

export function setupCoachingRoutes(app: Express) {

  // ── SESSIONS ──────────────────────────────────────────────────────────────

  // GET /api/coaching/players/:playerId/videos — coach views a player's swings
  app.get("/api/coaching/players/:playerId/videos", async (req, res, next) => {
    try {
      const coach = req.user as User | undefined;
      if (!coach) return res.status(401).json({ message: "Not authenticated" });
      if (coach.accountType !== "coach" || !hasCoachAccess(coach)) return res.status(403).json({ message: "Coach subscription required" });

      // Verify relationship exists
      const [rel] = await db.select().from(coachPlayers).where(
        and(eq(coachPlayers.coachId, coach.id), eq(coachPlayers.playerId, req.params.playerId), eq(coachPlayers.status, "active"))
      );
      if (!rel) return res.status(403).json({ message: "No active coaching relationship with this player" });

      const playerVideos = await db.select().from(videos)
        .where(and(eq(videos.userId, req.params.playerId), or(eq(videos.isProVideo, false), isNull(videos.isProVideo))))
        .orderBy(desc(videos.createdAt));

      // Batch-resolve all R2 keys (source + thumbnail) in one pass
      const sourceKeys = playerVideos.map(v => (v.sourceUrl && isR2Key(v.sourceUrl) ? v.sourceUrl : null));
      const thumbKeys = playerVideos.map(v => (v.thumbnailUrl && isR2Key(v.thumbnailUrl) ? v.thumbnailUrl : null));
      const [sourceUrls, thumbUrls] = await Promise.all([
        Promise.all(sourceKeys.map(k => (k ? getVideoUrl(k) : Promise.resolve(null)))),
        Promise.all(thumbKeys.map(k => (k ? getVideoUrl(k) : Promise.resolve(null)))),
      ]);
      const resolved = playerVideos.map((v, i) => ({
        ...v,
        sourceUrl: sourceUrls[i] ?? v.sourceUrl,
        thumbnailUrl: thumbUrls[i] ?? v.thumbnailUrl,
      }));

      res.json(resolved);
    } catch (err) { next(err); }
  });

  // POST /api/coaching/sessions — coach creates + shares a session
  app.post("/api/coaching/sessions", async (req, res, next) => {
    try {
      const coach = req.user as User | undefined;
      if (!coach) return res.status(401).json({ message: "Not authenticated" });
      if (coach.accountType !== "coach" || !hasCoachAccess(coach)) return res.status(403).json({ message: "Coach subscription required" });

      const { playerId, playerVideoId, proVideoId, notes, highlightStart, highlightEnd, voiceoverUrl } = req.body;
      if (!playerId) return res.status(400).json({ message: "playerId is required" });

      // Verify relationship
      const [rel] = await db.select().from(coachPlayers).where(
        and(eq(coachPlayers.coachId, coach.id), eq(coachPlayers.playerId, playerId), eq(coachPlayers.status, "active"))
      );
      if (!rel) return res.status(403).json({ message: "No active coaching relationship with this player" });

      // Check player is on a paid tier
      const [player] = await db.select().from(users).where(eq(users.id, playerId));
      if (!player || !PAID_TIERS.includes(player.subscriptionTier ?? "free")) {
        return res.status(403).json({ message: "Player must be on a paid plan to receive coaching sessions" });
      }

      const [session] = await db.insert(coachSessions).values({
        coachId: coach.id,
        playerId,
        playerVideoId: playerVideoId || null,
        proVideoId: proVideoId || null,
        notes: notes || null,
        voiceoverUrl: voiceoverUrl || null,
        highlightStart: highlightStart ?? null,
        highlightEnd: highlightEnd ?? null,
        sharedAt: new Date(),
      }).returning();

      const coachName = [coach.firstName, coach.lastName].filter(Boolean).join(" ") || coach.username;

      // In-app notification
      await createNotification(
        playerId,
        "coach_session",
        `New session from ${coachName}`,
        notes ? notes.slice(0, 120) + (notes.length > 120 ? "..." : "") : "Your coach shared a new analysis session.",
        { sessionId: session.id, coachId: coach.id },
      );

      // Email notification
      const playerName = [player.firstName, player.lastName].filter(Boolean).join(" ") || player.username;
      const sessionUrl = `${APP_URL}/development?session=${session.id}`;
      if (player.email) {
        resend.emails.send({
          from: FROM,
          to: player.email,
          subject: `${coachName} shared a coaching session with you`,
          html: `
            <div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:32px 24px">
              <h2 style="margin:0 0 8px;font-size:22px">New coaching session</h2>
              <p style="color:#666;margin:0 0 8px">Hey ${playerName}, <strong>${coachName}</strong> shared a new analysis session with you.</p>
              ${notes ? `<p style="color:#444;background:#f5f5f5;border-radius:6px;padding:12px;margin:0 0 24px">"${notes.slice(0, 200)}"</p>` : `<br>`}
              <a href="${sessionUrl}" style="display:inline-block;background:#2563eb;color:#fff;text-decoration:none;padding:12px 28px;border-radius:6px;font-weight:600;font-size:15px">View Session</a>
            </div>
          `,
        }).catch(() => {});
      }

      res.json(session);
    } catch (err) { next(err); }
  });

  // GET /api/coaching/sessions — coach's sent sessions, optional ?playerId= filter
  app.get("/api/coaching/sessions", async (req, res, next) => {
    try {
      const coach = req.user as User | undefined;
      if (!coach) return res.status(401).json({ message: "Not authenticated" });

      const filterPlayerId = req.query.playerId as string | undefined;
      const condition = filterPlayerId
        ? and(eq(coachSessions.coachId, coach.id), eq(coachSessions.playerId, filterPlayerId))
        : eq(coachSessions.coachId, coach.id);

      const rows = await db.select({
        id: coachSessions.id,
        playerId: coachSessions.playerId,
        playerVideoId: coachSessions.playerVideoId,
        proVideoId: coachSessions.proVideoId,
        notes: coachSessions.notes,
        voiceoverUrl: coachSessions.voiceoverUrl,
        sharedAt: coachSessions.sharedAt,
        createdAt: coachSessions.createdAt,
        playerFirstName: users.firstName,
        playerLastName: users.lastName,
        playerUsername: users.username,
      }).from(coachSessions)
        .leftJoin(users, eq(coachSessions.playerId, users.id))
        .where(condition)
        .orderBy(desc(coachSessions.createdAt));

      // Batch-resolve all voiceover R2 keys at once
      const r2Keys = rows.map(r => (r.voiceoverUrl && isR2Key(r.voiceoverUrl) ? r.voiceoverUrl : null));
      const resolvedUrls = await Promise.all(r2Keys.map(k => (k ? getVideoUrl(k) : Promise.resolve(null))));
      const resolved = rows.map((row, i) => resolvedUrls[i] !== null ? { ...row, voiceoverUrl: resolvedUrls[i] } : row);

      res.json(resolved);
    } catch (err) { next(err); }
  });

  // GET /api/coaching/sessions/received — player's received sessions
  app.get("/api/coaching/sessions/received", async (req, res, next) => {
    try {
      const player = req.user as User | undefined;
      if (!player) return res.status(401).json({ message: "Not authenticated" });

      const rows = await db.select({
        id: coachSessions.id,
        notes: coachSessions.notes,
        sharedAt: coachSessions.sharedAt,
        createdAt: coachSessions.createdAt,
        playerVideoId: coachSessions.playerVideoId,
        proVideoId: coachSessions.proVideoId,
        highlightStart: coachSessions.highlightStart,
        highlightEnd: coachSessions.highlightEnd,
        voiceoverUrl: coachSessions.voiceoverUrl,
        coachFirstName: users.firstName,
        coachLastName: users.lastName,
        coachUsername: users.username,
        coachOrganization: users.organization,
      }).from(coachSessions)
        .leftJoin(users, eq(coachSessions.coachId, users.id))
        .where(eq(coachSessions.playerId, player.id))
        .orderBy(desc(coachSessions.sharedAt));

      // Batch-resolve all voiceover R2 keys at once
      const r2Keys = rows.map(r => (r.voiceoverUrl && isR2Key(r.voiceoverUrl) ? r.voiceoverUrl : null));
      const resolvedUrls = await Promise.all(r2Keys.map(k => (k ? getVideoUrl(k) : Promise.resolve(null))));
      const resolved = rows.map((row, i) => resolvedUrls[i] !== null ? { ...row, voiceoverUrl: resolvedUrls[i] } : row);

      res.json(resolved);
    } catch (err) { next(err); }
  });

  // GET /api/coaching/sessions/:id — single session detail (with resolved video URLs)
  app.get("/api/coaching/sessions/:id", async (req, res, next) => {
    try {
      const user = req.user as User | undefined;
      if (!user) return res.status(401).json({ message: "Not authenticated" });

      const [session] = await db.select().from(coachSessions).where(eq(coachSessions.id, req.params.id));
      if (!session) return res.status(404).json({ message: "Session not found" });
      if (session.coachId !== user.id && session.playerId !== user.id)
        return res.status(403).json({ message: "Access denied" });

      // Batch both video lookups and voiceover URL resolution in parallel
      const [playerVideoRows, proVideoRows] = await Promise.all([
        session.playerVideoId ? db.select().from(videos).where(eq(videos.id, session.playerVideoId)) : Promise.resolve([]),
        session.proVideoId ? db.select().from(videos).where(eq(videos.id, session.proVideoId)) : Promise.resolve([]),
      ]);
      const pv = playerVideoRows[0];
      const prv = proVideoRows[0];

      const [playerVideoUrl, proVideoUrl, voiceoverUrl] = await Promise.all([
        pv?.sourceUrl ? (isR2Key(pv.sourceUrl) ? getVideoUrl(pv.sourceUrl) : Promise.resolve(pv.sourceUrl)) : Promise.resolve(null),
        prv?.sourceUrl ? (isR2Key(prv.sourceUrl) ? getVideoUrl(prv.sourceUrl) : Promise.resolve(prv.sourceUrl)) : Promise.resolve(null),
        session.voiceoverUrl && isR2Key(session.voiceoverUrl) ? getVideoUrl(session.voiceoverUrl) : Promise.resolve(session.voiceoverUrl),
      ]);

      res.json({ ...session, playerVideoUrl, proVideoUrl, voiceoverUrl });
    } catch (err) { next(err); }
  });

  // ── NOTIFICATIONS ─────────────────────────────────────────────────────────

  // GET /api/notifications
  app.get("/api/notifications", async (req, res, next) => {
    try {
      const user = req.user as User | undefined;
      if (!user) return res.status(401).json({ message: "Not authenticated" });

      const rows = await db.select().from(notifications)
        .where(eq(notifications.userId, user.id))
        .orderBy(desc(notifications.createdAt))
        .limit(50);

      res.json(rows);
    } catch (err) { next(err); }
  });

  // POST /api/notifications/:id/read
  app.post("/api/notifications/:id/read", async (req, res, next) => {
    try {
      const user = req.user as User | undefined;
      if (!user) return res.status(401).json({ message: "Not authenticated" });

      await db.update(notifications)
        .set({ read: true })
        .where(and(eq(notifications.id, req.params.id), eq(notifications.userId, user.id)));

      res.json({ message: "Marked as read" });
    } catch (err) { next(err); }
  });

  // POST /api/notifications/read-all
  app.post("/api/notifications/read-all", async (req, res, next) => {
    try {
      const user = req.user as User | undefined;
      if (!user) return res.status(401).json({ message: "Not authenticated" });

      await db.update(notifications)
        .set({ read: true })
        .where(eq(notifications.userId, user.id));

      res.json({ message: "All marked as read" });
    } catch (err) { next(err); }
  });

  // ── MESSAGES ──────────────────────────────────────────────────────────────

  // GET /api/coaching/messages/:coachPlayerId
  app.get("/api/coaching/messages/:coachPlayerId", async (req, res, next) => {
    try {
      const user = req.user as User | undefined;
      if (!user) return res.status(401).json({ message: "Not authenticated" });

      // Verify user is part of this relationship
      const [rel] = await db.select().from(coachPlayers)
        .where(and(
          eq(coachPlayers.id, req.params.coachPlayerId),
          or(eq(coachPlayers.coachId, user.id), eq(coachPlayers.playerId, user.id))
        ));
      if (!rel) return res.status(403).json({ message: "Access denied" });

      const rows = await db.select({
        id: messages.id,
        content: messages.content,
        read: messages.read,
        createdAt: messages.createdAt,
        senderId: messages.senderId,
        senderFirstName: users.firstName,
        senderLastName: users.lastName,
        senderUsername: users.username,
      }).from(messages)
        .leftJoin(users, eq(messages.senderId, users.id))
        .where(eq(messages.coachPlayerId, req.params.coachPlayerId))
        .orderBy(messages.createdAt)
        .limit(200);

      // Mark messages from the other person as read
      await db.update(messages).set({ read: true })
        .where(and(eq(messages.coachPlayerId, req.params.coachPlayerId), eq(messages.read, false)));

      res.json(rows);
    } catch (err) { next(err); }
  });

  // POST /api/coaching/messages
  app.post("/api/coaching/messages", async (req, res, next) => {
    try {
      const sender = req.user as User | undefined;
      if (!sender) return res.status(401).json({ message: "Not authenticated" });

      const { coachPlayerId, content } = req.body;
      if (!content?.trim()) return res.status(400).json({ message: "Message cannot be empty" });

      const [rel] = await db.select().from(coachPlayers)
        .where(and(
          eq(coachPlayers.id, coachPlayerId),
          or(eq(coachPlayers.coachId, sender.id), eq(coachPlayers.playerId, sender.id))
        ));
      if (!rel) return res.status(403).json({ message: "Access denied" });

      const [msg] = await db.insert(messages).values({
        coachPlayerId,
        senderId: sender.id,
        content: content.trim(),
      }).returning();

      // Notify the other person
      const recipientId = rel.coachId === sender.id ? rel.playerId : rel.coachId;
      if (recipientId) {
        const senderName = [sender.firstName, sender.lastName].filter(Boolean).join(" ") || sender.username;
        await createNotification(
          recipientId,
          "message",
          `Message from ${senderName}`,
          content.trim().slice(0, 120),
          { coachPlayerId, senderId: sender.id },
        );
      }

      res.json(msg);
    } catch (err) { next(err); }
  });

  // GET /api/coaching/relationships — get coach-player relationship ID for messaging
  app.get("/api/coaching/relationships", async (req, res, next) => {
    try {
      const user = req.user as User | undefined;
      if (!user) return res.status(401).json({ message: "Not authenticated" });

      const rows = await db.select().from(coachPlayers)
        .where(and(
          or(eq(coachPlayers.coachId, user.id), eq(coachPlayers.playerId, user.id)),
          eq(coachPlayers.status, "active")
        ));

      res.json(rows);
    } catch (err) { next(err); }
  });
}
