import { sql } from "drizzle-orm";
import { pgTable, text, varchar, integer, real, jsonb, boolean, timestamp, uniqueIndex, index } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  username: text("username").notNull().unique(),
  password: text("password"),
  // Auth
  email: text("email").unique(),
  emailVerified: boolean("email_verified").default(false).notNull(),
  googleId: text("google_id").unique(),
  // Profile
  firstName: text("first_name"),
  lastName: text("last_name"),
  age: integer("age"),
  city: text("city"),
  state: text("state"),
  skillLevel: text("skill_level"),
  bats: text("bats"),
  throws: text("throws"),
  heightInches: integer("height_inches"),
  weightLbs: integer("weight_lbs"),
  profileComplete: boolean("profile_complete").default(false).notNull(),
  // Account type — "player" | "coach"
  accountType: text("account_type").default("player").notNull(),
  // Coach-specific profile fields
  organization: text("organization"),
  coachingLevel: text("coaching_level"), // "youth" | "high_school" | "college" | "pro"
  // Coach trial
  coachTrialStartedAt: timestamp("coach_trial_started_at"),
  // Subscription — tiers: "free" | "player" | "pro" | "coach"
  subscriptionTier: text("subscription_tier").default("free").notNull(),
  stripeCustomerId: text("stripe_customer_id"),
  stripeSubscriptionId: text("stripe_subscription_id"),
  subscriptionStatus: text("subscription_status"), // active | canceled | past_due | trialing
});

export const emailVerifications = pgTable("email_verifications", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  token: text("token").notNull().unique(),
  expiresAt: timestamp("expires_at").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
}, (t) => ({
  userIdIdx: index("email_verifications_user_id_idx").on(t.userId),
}));

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
  athleteProfileId: varchar("athlete_profile_id").references(() => athleteProfiles.id, { onDelete: "set null" }),
  isProVideo: boolean("is_pro_video").default(false),
  season: integer("season"),
  createdAt: timestamp("created_at").defaultNow(),
  // Swing Notes
  notes: text("notes"),
  tags: text("tags").array(),
  // Visibility
  showInLibrary: boolean("show_in_library").default(true),
  showInDevelopment: boolean("show_in_development").default(true),
}, (t) => ({
  userIdIdx: index("videos_user_id_idx").on(t.userId),
  playerIdIdx: index("videos_player_id_idx").on(t.playerId),
  isProVideoIdx: index("videos_is_pro_video_idx").on(t.isProVideo),
}));

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

export const coachTeams = pgTable("coach_teams", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  coachId: varchar("coach_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
}, (t) => ({
  coachIdIdx: index("coach_teams_coach_id_idx").on(t.coachId),
}));

export const coachPlayers = pgTable("coach_players", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  coachId: varchar("coach_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  playerId: varchar("player_id").references(() => users.id, { onDelete: "cascade" }),
  status: text("status").default("pending").notNull(), // "pending" | "active" | "declined"
  inviteEmail: text("invite_email"), // email used to send invite
  inviteToken: text("invite_token").unique(), // token for accept link
  teamName: text("team_name"), // optional team grouping
  createdAt: timestamp("created_at").defaultNow(),
}, (t) => ({
  coachIdIdx: index("coach_players_coach_id_idx").on(t.coachId),
  playerIdIdx: index("coach_players_player_id_idx").on(t.playerId),
}));

export const sessions = pgTable("sessions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").references(() => users.id),
  proPlayerId: varchar("pro_player_id").references(() => mlbPlayers.id),
  amateurVideoId: varchar("amateur_video_id").references(() => videos.id),
  proVideoId: varchar("pro_video_id").references(() => videos.id),
  annotations: jsonb("annotations"),
  notes: text("notes"),
}, (t) => ({
  userIdIdx: index("sessions_user_id_idx").on(t.userId),
}));

// Coach sessions shared with players
export const coachSessions = pgTable("coach_sessions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  coachId: varchar("coach_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  playerId: varchar("player_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  playerVideoId: varchar("player_video_id").references(() => videos.id, { onDelete: "set null" }),
  proVideoId: varchar("pro_video_id").references(() => videos.id, { onDelete: "set null" }),
  notes: text("notes"),
  voiceoverUrl: text("voiceover_url"), // R2/blob key for coach audio
  highlightStart: real("highlight_start"), // optional moment marker (seconds)
  highlightEnd: real("highlight_end"),
  sharedAt: timestamp("shared_at"),
  createdAt: timestamp("created_at").defaultNow(),
}, (t) => ({
  coachIdIdx: index("coach_sessions_coach_id_idx").on(t.coachId),
  playerIdIdx: index("coach_sessions_player_id_idx").on(t.playerId),
}));

// In-app notifications
export const notifications = pgTable("notifications", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  type: text("type").notNull(), // "coach_session" | "coach_invite" | "message"
  title: text("title").notNull(),
  message: text("message").notNull(),
  read: boolean("read").default(false).notNull(),
  metadata: jsonb("metadata"), // e.g. { sessionId, coachId }
  createdAt: timestamp("created_at").defaultNow(),
}, (t) => ({
  userIdIdx: index("notifications_user_id_idx").on(t.userId),
}));

// Coach-player messages
export const messages = pgTable("messages", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  coachPlayerId: varchar("coach_player_id").notNull().references(() => coachPlayers.id, { onDelete: "cascade" }),
  senderId: varchar("sender_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  content: text("content").notNull(),
  read: boolean("read").default(false).notNull(),
  createdAt: timestamp("created_at").defaultNow(),
}, (t) => ({
  coachPlayerIdIdx: index("messages_coach_player_id_idx").on(t.coachPlayerId),
}));

// Player's saved MLB comps (auto-matched + manually added study players)
export const userPlayerComps = pgTable("user_player_comps", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  mlbPlayerId: varchar("mlb_player_id").notNull().references(() => mlbPlayers.id, { onDelete: "cascade" }),
  compType: text("comp_type").notNull().default("auto"), // "auto" | "manual"
  rank: integer("rank"), // 1-3 for auto, null for manual
  createdAt: timestamp("created_at").defaultNow(),
}, (t) => ({
  userPlayerUnique: uniqueIndex("user_player_comps_user_player_unique").on(t.userId, t.mlbPlayerId),
}));

export const blueprintContent = pgTable("blueprint_content", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  phase: text("phase").notNull(), // "foundation"|"gather"|"lag"|"on_plane"|"contact"|"finish"
  contentType: text("content_type").notNull().default("drill"), // "drill"|"reference"|"voiceover"
  title: text("title").notNull(),
  description: text("description"),
  sourceUrl: text("source_url"), // R2 key
  thumbnailUrl: text("thumbnail_url"),
  sortOrder: integer("sort_order").default(0),
  createdAt: timestamp("created_at").defaultNow(),
});

export const playerPhaseFocus = pgTable("player_phase_focus", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  phase: text("phase").notNull(),
  startedAt: timestamp("started_at").defaultNow(),
}, (t) => ({
  userIdIdx: index("player_phase_focus_user_id_idx").on(t.userId),
}));

export const athleteProfiles = pgTable("athlete_profiles", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  parentUserId: varchar("parent_user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  firstName: text("first_name").notNull(),
  lastName: text("last_name").notNull(),
  age: integer("age"),
  bats: text("bats"),
  throws: text("throws"),
  skillLevel: text("skill_level"),
  city: text("city"),
  state: text("state"),
  createdAt: timestamp("created_at").defaultNow(),
}, (t) => ({
  parentUserIdIdx: index("athlete_profiles_parent_user_id_idx").on(t.parentUserId),
}));

export const statlePlayers = pgTable("statdle_players", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  mlbId: text("mlb_id").unique().notNull(),
  name: text("name").notNull(),
  position: text("position").notNull(),
  bats: text("bats"),
  throwsHand: text("throws_hand"),
  birthCountry: text("birth_country"),
  careerStart: integer("career_start"),
  careerEnd: integer("career_end"),
  teams: jsonb("teams").$type<string[]>(),
  careerWar: real("career_war"),
  careerStats: jsonb("career_stats").$type<Record<string, any>>(),
  active: boolean("active").default(true).notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

export type StatdlePlayer = typeof statlePlayers.$inferSelect;
export type InsertStatdlePlayer = typeof statlePlayers.$inferInsert;

export const insertUserSchema = createInsertSchema(users).pick({
  username: true,
  password: true,
  email: true,
}).partial({ username: true });

export type EmailVerification = typeof emailVerifications.$inferSelect;

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
export type CoachTeam = typeof coachTeams.$inferSelect;
export type CoachPlayer = typeof coachPlayers.$inferSelect;
export type CoachSession = typeof coachSessions.$inferSelect;
export type Notification = typeof notifications.$inferSelect;
export type Message = typeof messages.$inferSelect;
export type UserPlayerComp = typeof userPlayerComps.$inferSelect;
export type BlueprintContent = typeof blueprintContent.$inferSelect;
export type InsertBlueprintContent = typeof blueprintContent.$inferInsert;
export type PlayerPhaseFocus = typeof playerPhaseFocus.$inferSelect;
export type AthleteProfile = typeof athleteProfiles.$inferSelect;
export type InsertAthleteProfile = typeof athleteProfiles.$inferInsert;

export const cognitionSessions = pgTable("cognition_sessions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").references(() => users.id, { onDelete: "cascade" }),
  completedAt: timestamp("completed_at").defaultNow(),
  threshold: real("threshold").notNull(),
  accuracy: real("accuracy").notNull(),
  correctRounds: integer("correct_rounds").notNull(),
  totalRounds: integer("total_rounds").notNull(),
  speedHistory: jsonb("speed_history").$type<number[]>(),
}, (t) => ({
  userIdIdx: index("cognition_sessions_user_id_idx").on(t.userId),
}));

export type CognitionSession = typeof cognitionSessions.$inferSelect;
export type InsertCognitionSession = typeof cognitionSessions.$inferInsert;

export const acuityCompletions = pgTable("acuity_completions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").references(() => users.id, { onDelete: "cascade" }),
  exerciseId: varchar("exercise_id").notNull(), // "pursuit" | "peripheral_lock" | "peripheral_flash" | "ghost_ball" | "color_filter"
  completedAt: timestamp("completed_at").defaultNow(),
  durationSecs: integer("duration_secs"),       // how long the session lasted
  maxSpeed: real("max_speed"),                  // highest speed reached (exercises 1,2,3)
  accuracy: real("accuracy"),                   // 0-100 for exercises 4,5
}, (t) => ({
  userIdIdx: index("acuity_completions_user_id_idx").on(t.userId),
}));

export type AcuityCompletion = typeof acuityCompletions.$inferSelect;
export type InsertAcuityCompletion = typeof acuityCompletions.$inferInsert;

export const disciplineSessions = pgTable("discipline_sessions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").references(() => users.id, { onDelete: "cascade" }),
  completedAt: timestamp("completed_at").defaultNow(),
  totalPitches: integer("total_pitches").notNull(),
  swings: integer("swings").notNull(),           // total swings taken
  goodSwings: integer("good_swings").notNull(),  // swings at strikes
  chases: integer("chases").notNull(),           // swings at balls
  calledStrikes: integer("called_strikes").notNull(), // strikes taken
  goodTakes: integer("good_takes").notNull(),    // balls correctly taken
  disciplinePct: real("discipline_pct").notNull(), // (goodSwings + goodTakes) / totalPitches
  chaseRate: real("chase_rate").notNull(),        // chases / balls
  calledStrikeRate: real("called_strike_rate").notNull(), // calledStrikes / strikes
  avgReactionMs: real("avg_reaction_ms"),        // avg ms from decision window open to swing
  level: text("level").default("rookie"),         // "rookie" | "high_school" | "college" | "mlb"
}, (t) => ({
  userIdIdx: index("discipline_sessions_user_id_idx").on(t.userId),
}));

export type DisciplineSession = typeof disciplineSessions.$inferSelect;
export type InsertDisciplineSession = typeof disciplineSessions.$inferInsert;

export const confidenceSessions = pgTable("confidence_sessions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").references(() => users.id, { onDelete: "cascade" }),
  completedAt: timestamp("completed_at").defaultNow(),
  durationMinutes: integer("duration_minutes").notNull(), // 1 or 3
  cyclesCompleted: integer("cycles_completed").notNull(),
}, (t) => ({
  userIdIdx: index("confidence_sessions_user_id_idx").on(t.userId),
}));

export type ConfidenceSession = typeof confidenceSessions.$inferSelect;
export type InsertConfidenceSession = typeof confidenceSessions.$inferInsert;

export const userAffirmations = pgTable("user_affirmations", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").references(() => users.id, { onDelete: "cascade" }).notNull(),
  text: text("text").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
}, (t) => ({
  userIdIdx: index("user_affirmations_user_id_idx").on(t.userId),
}));

export type UserAffirmation = typeof userAffirmations.$inferSelect;
export type InsertUserAffirmation = typeof userAffirmations.$inferInsert;