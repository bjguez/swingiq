import { eq } from "drizzle-orm";
import { db } from "./db";
import {
  users, mlbPlayers, videos, drills, sessions,
  type InsertUser, type User,
  type InsertMlbPlayer, type MlbPlayer,
  type InsertVideo, type Video,
  type InsertDrill, type Drill,
  type InsertSession, type Session,
} from "@shared/schema";

export interface IStorage {
  getUser(id: string): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;

  getAllPlayers(): Promise<MlbPlayer[]>;
  getPlayer(id: string): Promise<MlbPlayer | undefined>;
  createPlayer(player: InsertMlbPlayer): Promise<MlbPlayer>;
  deletePlayer(id: string): Promise<boolean>;

  getAllVideos(): Promise<Video[]>;
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
}

export class DatabaseStorage implements IStorage {
  async getUser(id: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user;
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.username, username));
    return user;
  }

  async createUser(user: InsertUser): Promise<User> {
    const [created] = await db.insert(users).values(user).returning();
    return created;
  }

  async getAllPlayers(): Promise<MlbPlayer[]> {
    return db.select().from(mlbPlayers);
  }

  async getPlayer(id: string): Promise<MlbPlayer | undefined> {
    const [player] = await db.select().from(mlbPlayers).where(eq(mlbPlayers.id, id));
    return player;
  }

  async createPlayer(player: InsertMlbPlayer): Promise<MlbPlayer> {
    const [created] = await db.insert(mlbPlayers).values(player).returning();
    return created;
  }

  async deletePlayer(id: string): Promise<boolean> {
    const result = await db.delete(mlbPlayers).where(eq(mlbPlayers.id, id)).returning();
    return result.length > 0;
  }

  async getAllVideos(): Promise<Video[]> {
    return db.select().from(videos);
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
}

export const storage = new DatabaseStorage();