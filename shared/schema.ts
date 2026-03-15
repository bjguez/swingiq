import { sql } from "drizzle-orm";
import { pgTable, text, varchar, integer, real, jsonb, boolean, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
  // Profile
  age: integer("age"),
  city: text("city"),
  state: text("state"),
  skillLevel: text("skill_level"), // 'little_league' | 'select' | 'high_school' | 'college' | 'pro'
  bats: text("bats"), // 'L' | 'R'
  throws: text("throws"), // 'L' | 'R'
  heightInches: integer("height_inches"),
  weightLbs: integer("weight_lbs"),
  profileComplete: boolean("profile_complete").default(false).notNull(),
  // Subscription
  subscriptionTier: text("subscription_tier").default("free").notNull(),
});

export const mlbPlayers = pgTable("mlb_players", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  team: text("team").notNull(),
  position: text("position").notNull(),
  bats: text("bats").notNull(),
  height: text("height"),
  weight: integer("weight"),
  savantId: text("savant_id"),
  imageUrl: text("image_url"),
  avgExitVelo: real("avg_exit_velo"),
  maxExitVelo: real("max_exit_velo"),
  barrelPct: real("barrel_pct"),
  hardHitPct: real("hard_hit_pct"),
  avgExitVeloPercentile: integer("avg_exit_velo_percentile"),
  maxExitVeloPercentile: integer("max_exit_velo_percentile"),
  barrelPctPercentile: integer("barrel_pct_percentile"),
  hardHitPctPercentile: integer("hard_hit_pct_percentile"),
  batSpeed: real("bat_speed"),
  attackAngle: real("attack_angle"),
  rotationalAccel: real("rotational_accel"),
  // Traditional batting stats
  battingAvg: real("batting_avg"),
  homeRuns: integer("home_runs"),
  rbi: integer("rbi"),
  obp: real("obp"),
  slg: real("slg"),
  ops: real("ops"),
});

export const videos = pgTable("videos", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  title: text("title").notNull(),
  category: text("category").notNull(),
  playerId: varchar("player_id").references(() => mlbPlayers.id),
  playerName: text("player_name"),
  source: text("source").notNull(),
  sourceUrl: text("source_url"),
  duration: text("duration"),
  fps: integer("fps"),
  thumbnailUrl: text("thumbnail_url"),
  userId: varchar("user_id").references(() => users.id, { onDelete: "set null" }),
  isProVideo: boolean("is_pro_video").default(false),
  season: integer("season"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const drills = pgTable("drills", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  phase: text("phase").notNull(),
  reps: text("reps"),
  description: text("description"),
  steps: text("steps").array(),
  videoUrl: text("video_url"),
  thumbnailUrl: text("thumbnail_url"),
});

export const sessions = pgTable("sessions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").references(() => users.id),
  proPlayerId: varchar("pro_player_id").references(() => mlbPlayers.id),
  amateurVideoId: varchar("amateur_video_id").references(() => videos.id),
  proVideoId: varchar("pro_video_id").references(() => videos.id),
  annotations: jsonb("annotations"),
  notes: text("notes"),
});

export const insertUserSchema = createInsertSchema(users).pick({
  username: true,
  password: true,
});

export const insertMlbPlayerSchema = createInsertSchema(mlbPlayers).omit({ id: true });
export const insertVideoSchema = createInsertSchema(videos).omit({ id: true, createdAt: true });
export const insertDrillSchema = createInsertSchema(drills).omit({ id: true });
export const insertSessionSchema = createInsertSchema(sessions).omit({ id: true });

export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;
export type InsertMlbPlayer = z.infer<typeof insertMlbPlayerSchema>;
export type MlbPlayer = typeof mlbPlayers.$inferSelect;
export type InsertVideo = z.infer<typeof insertVideoSchema>;
export type Video = typeof videos.$inferSelect;
export type InsertDrill = z.infer<typeof insertDrillSchema>;
export type Drill = typeof drills.$inferSelect;
export type InsertSession = z.infer<typeof insertSessionSchema>;
export type Session = typeof sessions.$inferSelect;