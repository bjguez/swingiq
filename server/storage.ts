import { eq, and, ilike, or, sql } from "drizzle-orm";
import { db } from "./db";
import {
  users, mlbPlayers, videos, drills, sessions, athleteProfiles,
  type InsertUser, type User,
  type InsertMlbPlayer, type MlbPlayer,
  type InsertVideo, type Video,
  type InsertDrill, type Drill,
  type InsertSession, type Session,
  type AthleteProfile, type InsertAthleteProfile,
} from "@shared/schema";

export interface IStorage {
  getUser(id: string): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  getUserByEmail(email: string): Promise<User | undefined>;
  getUserByGoogleId(googleId: string): Promise<User | undefined>;
  getAllUsers(): Promise<User[]>;
  createUser(user: InsertUser & { username: string }): Promise<User>;
  updateUser(id: string, data: Partial<Omit<User, "id">>): Promise<User | undefined>;

  getAllPlayers(): Promise<MlbPlayer[]>;
  getPlayers(opts: { search?: string; bats?: string; limit?: number; offset?: number; seed?: number }): Promise<{ players: MlbPlayer[]; total: number }>;
  getPlayer(id: string): Promise<MlbPlayer | undefined>;
  createPlayer(player: InsertMlbPlayer): Promise<MlbPlayer>;
  updatePlayer(id: string, data: Partial<Omit<MlbPlayer, "id">>): Promise<MlbPlayer | undefined>;
  deletePlayer(id: string): Promise<boolean>;

  getAllVideos(limit?: number): Promise<Video[]>;
  getProVideos(): Promise<Video[]>;
  getVideosByUser(userId: string): Promise<Video[]>;
  getVideosByCategory(category: string): Promise<Video[]>;
  getVideosByPlayer(playerId: string): Promise<Video[]>;
  getVideo(id: string): Promise<Video | undefined>;
  createVideo(video: InsertVideo): Promise<Video>;
  updateVideo(id: string, data: Partial<InsertVideo>): Promise<Video | undefined>;
  deleteVideo(id: string): Promise<boolean>;

  getAllDrills(): Promise<Drill[]>;
  getDrillsByPhase(phase: string): Promise<Drill[]>;
  getDrill(id: string): Promise<Drill | undefined>;
  createDrill(drill: InsertDrill): Promise<Drill>;

  getSession(id: string): Promise<Session | undefined>;
  getSessionsByUser(userId: string): Promise<Session[]>;
  createSession(session: InsertSession): Promise<Session>;
  updateSession(id: string, data: Partial<InsertSession>): Promise<Session | undefined>;

  getAthletesByParent(parentUserId: string): Promise<AthleteProfile[]>;
  getAllAthletes(): Promise<AthleteProfile[]>;
  getAthlete(id: string): Promise<AthleteProfile | undefined>;
  createAthlete(athlete: InsertAthleteProfile): Promise<AthleteProfile>;
  updateAthlete(id: string, data: Partial<Omit<AthleteProfile, "id" | "parentUserId">>): Promise<AthleteProfile | undefined>;
  deleteAthlete(id: string): Promise<boolean>;
}

export class DatabaseStorage implements IStorage {
  async getUser(id: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user;
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.username, username.toLowerCase()));
    return user;
  }

  async getUserByEmail(email: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.email, email.toLowerCase()));
    return user;
  }

  async getUserByGoogleId(googleId: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.googleId, googleId));
    return user;
  }

  async createUser(user: InsertUser & { username: string }): Promise<User> {
    const [created] = await db.insert(users).values(user as any).returning();
    return created;
  }

  async getAllUsers(): Promise<User[]> {
    return db.select().from(users);
  }

  async updateUser(id: string, data: Partial<Omit<User, "id">>): Promise<User | undefined> {
    const [updated] = await db.update(users).set(data).where(eq(users.id, id)).returning();
    return updated;
  }

  async getAllPlayers(): Promise<MlbPlayer[]> {
    return db.select().from(mlbPlayers);
  }

  async getPlayers(opts: { search?: string; bats?: string; limit?: number; offset?: number; seed?: number }): Promise<{ players: MlbPlayer[]; total: number }> {
    const { search, bats, limit = 9, offset = 0, seed = 0 } = opts;
    const conditions = [
      ...(bats ? [eq(mlbPlayers.bats, bats)] : []),
      ...(search ? [or(ilike(mlbPlayers.name, `%${search}%`), ilike(mlbPlayers.team, `%${search}%`))] : []),
    ];
    const where = conditions.length > 0 ? and(...conditions) : undefined;
    const [players, [{ total }]] = await Promise.all([
      db.select().from(mlbPlayers).where(where)
        .orderBy(sql`md5(${mlbPlayers.id}::text || ${String(seed)})`)
        .limit(limit).offset(offset),
      db.select({ total: sql<number>`count(*)::int` }).from(mlbPlayers).where(where),
    ]);
    return { players, total };
  }

  async getPlayer(id: string): Promise<MlbPlayer | undefined> {
    const [player] = await db.select().from(mlbPlayers).where(eq(mlbPlayers.id, id));
    return player;
  }

  async createPlayer(player: InsertMlbPlayer): Promise<MlbPlayer> {
    const [created] = await db.insert(mlbPlayers).values(player).returning();
    return created;
  }

  async updatePlayer(id: string, data: Partial<Omit<MlbPlayer, "id">>): Promise<MlbPlayer | undefined> {
    const [updated] = await db.update(mlbPlayers).set(data).where(eq(mlbPlayers.id, id)).returning();
    return updated;
  }

  async deletePlayer(id: string): Promise<boolean> {
    const result = await db.delete(mlbPlayers).where(eq(mlbPlayers.id, id)).returning();
    return result.length > 0;
  }

  async getAllVideos(limit?: number): Promise<Video[]> {
    const q = db.select().from(videos);
    return limit ? q.limit(limit) : q;
  }

  async getProVideos(): Promise<Video[]> {
    return db.select().from(videos).where(eq(videos.isProVideo, true));
  }

  async getVideosByUser(userId: string): Promise<Video[]> {
    return db.select().from(videos).where(
      and(eq(videos.isProVideo, false), eq(videos.userId, userId))
    );
  }

  async getVideosByCategory(category: string): Promise<Video[]> {
    return db.select().from(videos).where(eq(videos.category, category));
  }

  async getVideosByPlayer(playerId: string): Promise<Video[]> {
    return db.select().from(videos).where(eq(videos.playerId, playerId));
  }

  async getVideo(id: string): Promise<Video | undefined> {
    const [video] = await db.select().from(videos).where(eq(videos.id, id));
    return video;
  }

  async createVideo(video: InsertVideo): Promise<Video> {
    const [created] = await db.insert(videos).values(video).returning();
    return created;
  }

  async updateVideo(id: string, data: Partial<InsertVideo>): Promise<Video | undefined> {
    const [updated] = await db.update(videos).set(data).where(eq(videos.id, id)).returning();
    return updated;
  }

  async deleteVideo(id: string): Promise<boolean> {
    const result = await db.delete(videos).where(eq(videos.id, id)).returning();
    return result.length > 0;
  }

  async getAllDrills(): Promise<Drill[]> {
    return db.select().from(drills);
  }

  async getDrillsByPhase(phase: string): Promise<Drill[]> {
    return db.select().from(drills).where(eq(drills.phase, phase));
  }

  async getDrill(id: string): Promise<Drill | undefined> {
    const [drill] = await db.select().from(drills).where(eq(drills.id, id));
    return drill;
  }

  async createDrill(drill: InsertDrill): Promise<Drill> {
    const [created] = await db.insert(drills).values(drill).returning();
    return created;
  }

  async getSession(id: string): Promise<Session | undefined> {
    const [session] = await db.select().from(sessions).where(eq(sessions.id, id));
    return session;
  }

  async getSessionsByUser(userId: string): Promise<Session[]> {
    return db.select().from(sessions).where(eq(sessions.userId, userId));
  }

  async createSession(session: InsertSession): Promise<Session> {
    const [created] = await db.insert(sessions).values(session).returning();
    return created;
  }

  async updateSession(id: string, data: Partial<InsertSession>): Promise<Session | undefined> {
    const [updated] = await db.update(sessions).set(data).where(eq(sessions.id, id)).returning();
    return updated;
  }

  async getAthletesByParent(parentUserId: string): Promise<AthleteProfile[]> {
    return db.select().from(athleteProfiles).where(eq(athleteProfiles.parentUserId, parentUserId));
  }

  async getAllAthletes(): Promise<AthleteProfile[]> {
    return db.select().from(athleteProfiles);
  }

  async getAthlete(id: string): Promise<AthleteProfile | undefined> {
    const [athlete] = await db.select().from(athleteProfiles).where(eq(athleteProfiles.id, id));
    return athlete;
  }

  async createAthlete(athlete: InsertAthleteProfile): Promise<AthleteProfile> {
    const [created] = await db.insert(athleteProfiles).values(athlete).returning();
    return created;
  }

  async updateAthlete(id: string, data: Partial<Omit<AthleteProfile, "id" | "parentUserId">>): Promise<AthleteProfile | undefined> {
    const [updated] = await db.update(athleteProfiles).set(data).where(eq(athleteProfiles.id, id)).returning();
    return updated;
  }

  async deleteAthlete(id: string): Promise<boolean> {
    const result = await db.delete(athleteProfiles).where(eq(athleteProfiles.id, id)).returning();
    return result.length > 0;
  }
}

export const storage = new DatabaseStorage();