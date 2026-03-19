import { Express } from "express";
import { randomBytes } from "crypto";
import { db } from "./db";
import { coachPlayers, coachTeams, users } from "../shared/schema";
import { eq, and, or } from "drizzle-orm";
import { sendCoachInviteEmail } from "./email";
import { User } from "../shared/schema";

export function setupCoachRoutes(app: Express) {

  // ── TEAMS ───────────────────────────────────────────────────────────────────

  // GET /api/coach/teams — list coach's teams; auto-seeds org team on first call
  app.get("/api/coach/teams", async (req, res, next) => {
    try {
      const coach = req.user as User | undefined;
      if (!coach) return res.status(401).json({ message: "Not authenticated" });

      let teams = await db.select().from(coachTeams).where(eq(coachTeams.coachId, coach.id));

      // Auto-seed from organization on first call if empty
      if (teams.length === 0 && coach.organization) {
        const [created] = await db.insert(coachTeams)
          .values({ coachId: coach.id, name: coach.organization })
          .returning();
        teams = [created];
      }

      res.json(teams);
    } catch (err) { next(err); }
  });

  // POST /api/coach/teams — create a new team
  app.post("/api/coach/teams", async (req, res, next) => {
    try {
      const coach = req.user as User | undefined;
      if (!coach) return res.status(401).json({ message: "Not authenticated" });

      const { name } = req.body;
      if (!name?.trim()) return res.status(400).json({ message: "Team name is required" });

      // Check for duplicate
      const existing = await db.select().from(coachTeams)
        .where(and(eq(coachTeams.coachId, coach.id), eq(coachTeams.name, name.trim())));
      if (existing.length > 0) return res.status(400).json({ message: "Team already exists" });

      const [team] = await db.insert(coachTeams)
        .values({ coachId: coach.id, name: name.trim() })
        .returning();

      res.json(team);
    } catch (err) { next(err); }
  });

  // DELETE /api/coach/teams/:id — delete a team (moves players to unassigned)
  app.delete("/api/coach/teams/:id", async (req, res, next) => {
    try {
      const coach = req.user as User | undefined;
      if (!coach) return res.status(401).json({ message: "Not authenticated" });

      const [team] = await db.select().from(coachTeams)
        .where(and(eq(coachTeams.id, req.params.id), eq(coachTeams.coachId, coach.id)));
      if (!team) return res.status(404).json({ message: "Team not found" });

      // Unassign players from this team
      await db.update(coachPlayers)
        .set({ teamName: null })
        .where(and(eq(coachPlayers.coachId, coach.id), eq(coachPlayers.teamName, team.name)));

      await db.delete(coachTeams)
        .where(eq(coachTeams.id, req.params.id));

      res.json({ message: "Team deleted" });
    } catch (err) { next(err); }
  });

  // ── INVITES & PLAYERS ───────────────────────────────────────────────────────

  // POST /api/coach/invite — coach invites a player by email
  app.post("/api/coach/invite", async (req, res, next) => {
    try {
      const coach = req.user as User | undefined;
      if (!coach) return res.status(401).json({ message: "Not authenticated" });
      if (coach.accountType !== "coach") return res.status(403).json({ message: "Coach account required" });

      const { email, teamName } = req.body;
      if (!email) return res.status(400).json({ message: "Email is required" });
      if (email.toLowerCase() === coach.email?.toLowerCase())
        return res.status(400).json({ message: "You cannot invite yourself" });

      // Check if already invited / connected
      const existing = await db
        .select()
        .from(coachPlayers)
        .where(and(eq(coachPlayers.coachId, coach.id), eq(coachPlayers.inviteEmail, email.toLowerCase())));
      if (existing.length > 0)
        return res.status(400).json({ message: "You've already invited this player" });

      // Check if player has an account
      const [player] = await db.select().from(users).where(eq(users.email, email.toLowerCase()));

      const token = randomBytes(32).toString("hex");
      const coachName = [coach.firstName, coach.lastName].filter(Boolean).join(" ") || coach.username;

      await db.insert(coachPlayers).values({
        coachId: coach.id,
        playerId: player?.id ?? null,
        status: "pending",
        inviteEmail: email.toLowerCase(),
        inviteToken: token,
        teamName: teamName?.trim() || null,
      });

      await sendCoachInviteEmail(email, coachName, token, !!player);

      res.json({ message: "Invitation sent" });
    } catch (err) { next(err); }
  });

  // GET /api/coach/invite/accept?token= — player accepts an invite
  app.get("/api/coach/invite/accept", async (req, res, next) => {
    try {
      const { token } = req.query as { token?: string };
      if (!token) return res.status(400).json({ message: "Missing token" });

      const [invite] = await db
        .select()
        .from(coachPlayers)
        .where(eq(coachPlayers.inviteToken, token));

      if (!invite) return res.status(404).json({ message: "Invitation not found or already used" });
      if (invite.status === "active") return res.json({ message: "Already accepted" });

      const player = req.user as User | undefined;

      // Link to the logged-in player if not already linked, or match by email
      let playerId = invite.playerId ?? player?.id;
      if (!playerId && invite.inviteEmail) {
        const [matchedUser] = await db.select().from(users).where(eq(users.email, invite.inviteEmail));
        playerId = matchedUser?.id ?? null;
      }
      if (!playerId) return res.status(401).json({ message: "Please sign in to accept this invitation" });

      await db
        .update(coachPlayers)
        .set({ status: "active", playerId, inviteToken: null })
        .where(eq(coachPlayers.id, invite.id));

      // Return coach info so client can show a confirmation
      const [coach] = await db.select().from(users).where(eq(users.id, invite.coachId));
      res.json({
        message: "Invitation accepted",
        coachName: [coach?.firstName, coach?.lastName].filter(Boolean).join(" ") || coach?.username,
      });
    } catch (err) { next(err); }
  });

  // GET /api/coach/players — coach gets their player list
  app.get("/api/coach/players", async (req, res, next) => {
    try {
      const coach = req.user as User | undefined;
      if (!coach) return res.status(401).json({ message: "Not authenticated" });

      let rows: any[];
      try {
        rows = await db
          .select({
            id: coachPlayers.id,
            status: coachPlayers.status,
            inviteEmail: coachPlayers.inviteEmail,
            teamName: coachPlayers.teamName,
            createdAt: coachPlayers.createdAt,
            playerId: users.id,
            firstName: users.firstName,
            lastName: users.lastName,
            email: users.email,
            skillLevel: users.skillLevel,
          })
          .from(coachPlayers)
          .leftJoin(users, eq(coachPlayers.playerId, users.id))
          .where(eq(coachPlayers.coachId, coach.id));
      } catch {
        // teamName column may not exist yet (migration pending) — fall back without it
        rows = await db
          .select({
            id: coachPlayers.id,
            status: coachPlayers.status,
            inviteEmail: coachPlayers.inviteEmail,
            createdAt: coachPlayers.createdAt,
            playerId: users.id,
            firstName: users.firstName,
            lastName: users.lastName,
            email: users.email,
            skillLevel: users.skillLevel,
          })
          .from(coachPlayers)
          .leftJoin(users, eq(coachPlayers.playerId, users.id))
          .where(eq(coachPlayers.coachId, coach.id));
      }

      res.json(rows);
    } catch (err) { next(err); }
  });

  // GET /api/coach/coaches — player gets their coaches
  app.get("/api/coach/coaches", async (req, res, next) => {
    try {
      const player = req.user as User | undefined;
      if (!player) return res.status(401).json({ message: "Not authenticated" });

      const rows = await db
        .select({
          id: coachPlayers.id,
          status: coachPlayers.status,
          coachId: users.id,
          firstName: users.firstName,
          lastName: users.lastName,
          email: users.email,
          organization: users.organization,
          coachingLevel: users.coachingLevel,
        })
        .from(coachPlayers)
        .leftJoin(users, eq(coachPlayers.coachId, users.id))
        .where(and(eq(coachPlayers.playerId, player.id), eq(coachPlayers.status, "active")));

      res.json(rows);
    } catch (err) { next(err); }
  });

  // POST /api/coach/invite/resend/:id — resend invite email for a pending relationship
  app.post("/api/coach/invite/resend/:id", async (req, res, next) => {
    try {
      const coach = req.user as User | undefined;
      if (!coach) return res.status(401).json({ message: "Not authenticated" });

      const [invite] = await db
        .select()
        .from(coachPlayers)
        .where(and(eq(coachPlayers.id, req.params.id), eq(coachPlayers.coachId, coach.id)));

      if (!invite) return res.status(404).json({ message: "Invite not found" });
      if (invite.status === "active") return res.status(400).json({ message: "Player is already connected" });

      // Regenerate token
      const { randomBytes } = await import("crypto");
      const token = randomBytes(32).toString("hex");
      await db.update(coachPlayers).set({ inviteToken: token }).where(eq(coachPlayers.id, invite.id));

      const email = invite.inviteEmail!;
      const [player] = await db.select().from(users).where(eq(users.email, email));
      const coachName = [coach.firstName, coach.lastName].filter(Boolean).join(" ") || coach.username;

      await sendCoachInviteEmail(email, coachName, token, !!player);
      res.json({ message: "Invitation resent" });
    } catch (err) { next(err); }
  });

  // PATCH /api/coach/players/:id — update team name
  app.patch("/api/coach/players/:id", async (req, res, next) => {
    try {
      const coach = req.user as User | undefined;
      if (!coach) return res.status(401).json({ message: "Not authenticated" });

      const { teamName } = req.body;
      await db
        .update(coachPlayers)
        .set({ teamName: teamName?.trim() || null })
        .where(and(eq(coachPlayers.id, req.params.id), eq(coachPlayers.coachId, coach.id)));

      res.json({ message: "Updated" });
    } catch (err) { next(err); }
  });

  // DELETE /api/coach/players/:id — coach removes a player relationship
  app.delete("/api/coach/players/:id", async (req, res, next) => {
    try {
      const coach = req.user as User | undefined;
      if (!coach) return res.status(401).json({ message: "Not authenticated" });

      await db
        .delete(coachPlayers)
        .where(and(eq(coachPlayers.id, req.params.id), eq(coachPlayers.coachId, coach.id)));

      res.json({ message: "Player removed" });
    } catch (err) { next(err); }
  });
}
