import { pool } from "./db";
import { db } from "./db";
import { userBadges } from "../shared/schema";
import { eq, inArray } from "drizzle-orm";

// ── Badge definitions ─────────────────────────────────────────────────────────

export const BADGE_DEFINITIONS = [
  // Milestones
  { id: "first_cognition",   name: "First Rep",       description: "Complete your first Cognition session",    category: "milestone" },
  { id: "first_discipline",  name: "First At-Bat",    description: "Complete your first Discipline session",   category: "milestone" },
  { id: "first_acuity",      name: "Eyes Up",         description: "Complete your first Visual Acuity drill",  category: "milestone" },
  { id: "first_confidence",  name: "Locked In",       description: "Complete your first Confidence session",   category: "milestone" },
  { id: "first_upload",      name: "On Film",         description: "Upload your first swing for analysis",     category: "milestone" },
  { id: "blueprint_active",  name: "Blueprint Set",   description: "Activate your Development Blueprint",      category: "milestone" },
  // Streaks
  { id: "streak_3",          name: "3-Day Streak",    description: "Train 3 days in a row",                    category: "streak" },
  { id: "streak_7",          name: "Week Warrior",    description: "Train 7 days in a row",                    category: "streak" },
  { id: "streak_14",         name: "Two Weeks",       description: "Train 14 days in a row",                   category: "streak" },
  { id: "streak_30",         name: "30-Day Grind",    description: "Train 30 days in a row",                   category: "streak" },
  { id: "streak_100",        name: "Elite Mindset",   description: "Train 100 days in a row",                  category: "streak" },
  // Volume — Discipline
  { id: "discipline_10",     name: "Zone Control",    description: "Complete 10 Discipline sessions",          category: "volume" },
  { id: "discipline_25",     name: "Pitch Expert",    description: "Complete 25 Discipline sessions",          category: "volume" },
  { id: "discipline_50",     name: "Plate Mastery",   description: "Complete 50 Discipline sessions",          category: "volume" },
  // Volume — Cognition
  { id: "cognition_10",      name: "Locked Vision",   description: "Complete 10 Cognition sessions",           category: "volume" },
  { id: "cognition_25",      name: "Visual Elite",    description: "Complete 25 Cognition sessions",           category: "volume" },
  // Volume — Confidence
  { id: "confidence_10",     name: "Mental Edge",     description: "Complete 10 Confidence sessions",          category: "volume" },
  // Volume — Uploads
  { id: "upload_10",         name: "Film Room",       description: "Upload 10 swings for analysis",            category: "volume" },
] as const;

export type BadgeId = typeof BADGE_DEFINITIONS[number]["id"];
export type BadgeDefinition = typeof BADGE_DEFINITIONS[number];

// ── Streak calculation ────────────────────────────────────────────────────────

export async function computeStreak(userId: string): Promise<{ streak: number; lastActiveDate: string | null }> {
  const { rows } = await pool.query<{ day: string }>(`
    WITH activity_days AS (
      SELECT DATE(completed_at) AS day FROM cognition_sessions  WHERE user_id = $1
      UNION
      SELECT DATE(completed_at) AS day FROM discipline_sessions WHERE user_id = $1
      UNION
      SELECT DATE(completed_at) AS day FROM acuity_completions  WHERE user_id = $1
      UNION
      SELECT DATE(completed_at) AS day FROM confidence_sessions WHERE user_id = $1
      UNION
      SELECT DATE(created_at)   AS day FROM videos              WHERE user_id = $1 AND source = 'User Upload'
      UNION
      SELECT DATE(started_at)   AS day FROM player_phase_focus  WHERE user_id = $1
    )
    SELECT day::text FROM activity_days ORDER BY day DESC
  `, [userId]);

  if (!rows.length) return { streak: 0, lastActiveDate: null };

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  let streak = 0;
  let expected = new Date(today);

  // Allow streak to count if most recent activity is today or yesterday
  const mostRecent = new Date(rows[0].day);
  const diffDays = Math.round((today.getTime() - mostRecent.getTime()) / 86400000);
  if (diffDays > 1) return { streak: 0, lastActiveDate: rows[0].day };

  if (diffDays === 1) expected.setDate(expected.getDate() - 1);

  for (const row of rows) {
    const day = new Date(row.day);
    const diff = Math.round((expected.getTime() - day.getTime()) / 86400000);
    if (diff === 0) {
      streak++;
      expected.setDate(expected.getDate() - 1);
    } else {
      break;
    }
  }

  return { streak, lastActiveDate: rows[0].day };
}

// ── Activity counts ───────────────────────────────────────────────────────────

async function getActivityCounts(userId: string) {
  const { rows } = await pool.query(`
    SELECT
      (SELECT COUNT(*) FROM cognition_sessions  WHERE user_id = $1) AS cognition,
      (SELECT COUNT(*) FROM discipline_sessions WHERE user_id = $1) AS discipline,
      (SELECT COUNT(*) FROM acuity_completions  WHERE user_id = $1) AS acuity,
      (SELECT COUNT(*) FROM confidence_sessions WHERE user_id = $1) AS confidence,
      (SELECT COUNT(*) FROM videos              WHERE user_id = $1 AND source = 'User Upload') AS uploads,
      (SELECT COUNT(*) FROM player_phase_focus  WHERE user_id = $1) AS blueprint_phases
  `, [userId]);
  const r = rows[0];
  return {
    cognition:       Number(r.cognition),
    discipline:      Number(r.discipline),
    acuity:          Number(r.acuity),
    confidence:      Number(r.confidence),
    uploads:         Number(r.uploads),
    blueprintPhases: Number(r.blueprint_phases),
  };
}

// ── Check and award badges ────────────────────────────────────────────────────

export async function checkAndAwardBadges(userId: string): Promise<BadgeId[]> {
  const [earned, counts, { streak }] = await Promise.all([
    db.select({ badgeId: userBadges.badgeId }).from(userBadges).where(eq(userBadges.userId, userId)),
    getActivityCounts(userId),
    computeStreak(userId),
  ]);

  const earnedSet = new Set(earned.map(r => r.badgeId));

  const criteria: Record<BadgeId, boolean> = {
    first_cognition:  counts.cognition >= 1,
    first_discipline: counts.discipline >= 1,
    first_acuity:     counts.acuity >= 1,
    first_confidence: counts.confidence >= 1,
    first_upload:     counts.uploads >= 1,
    blueprint_active: counts.blueprintPhases >= 1,
    streak_3:         streak >= 3,
    streak_7:         streak >= 7,
    streak_14:        streak >= 14,
    streak_30:        streak >= 30,
    streak_100:       streak >= 100,
    discipline_10:    counts.discipline >= 10,
    discipline_25:    counts.discipline >= 25,
    discipline_50:    counts.discipline >= 50,
    cognition_10:     counts.cognition >= 10,
    cognition_25:     counts.cognition >= 25,
    confidence_10:    counts.confidence >= 10,
    upload_10:        counts.uploads >= 10,
  };

  const newlyEarned: BadgeId[] = [];
  for (const [badgeId, met] of Object.entries(criteria) as [BadgeId, boolean][]) {
    if (met && !earnedSet.has(badgeId)) {
      newlyEarned.push(badgeId);
    }
  }

  if (newlyEarned.length > 0) {
    await db.insert(userBadges).values(
      newlyEarned.map(badgeId => ({ userId, badgeId }))
    );
  }

  return newlyEarned;
}
