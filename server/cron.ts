import { pool, db } from "./db";
import { emailLog, users } from "../shared/schema";
import { eq, and, gte, lt } from "drizzle-orm";
import { computeStreak, BADGE_DEFINITIONS } from "./badges";
import {
  sendStreakAtRiskEmail,
  sendStreakBrokenEmail,
  sendStreakMilestoneEmail,
  sendWeeklyRecapEmail,
  sendReengagementEmail,
} from "./email";

// ── Helpers ───────────────────────────────────────────────────────────────────

function startOfDay(date: Date) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

async function alreadySentToday(userId: string, emailType: string): Promise<boolean> {
  const todayStart = startOfDay(new Date());
  const rows = await db
    .select({ id: emailLog.id })
    .from(emailLog)
    .where(
      and(
        eq(emailLog.userId, userId),
        eq(emailLog.emailType, emailType),
        gte(emailLog.sentAt, todayStart),
      )
    )
    .limit(1);
  return rows.length > 0;
}

async function logEmail(userId: string, emailType: string) {
  await db.insert(emailLog).values({ userId, emailType });
}

async function hadActivityOnDate(userId: string, date: Date): Promise<boolean> {
  const start = startOfDay(date);
  const end = new Date(start);
  end.setDate(end.getDate() + 1);

  const { rows } = await pool.query(`
    SELECT 1 FROM (
      SELECT completed_at AS ts FROM cognition_sessions  WHERE user_id = $1
      UNION ALL
      SELECT completed_at        FROM discipline_sessions WHERE user_id = $1
      UNION ALL
      SELECT completed_at        FROM acuity_completions  WHERE user_id = $1
      UNION ALL
      SELECT completed_at        FROM confidence_sessions WHERE user_id = $1
      UNION ALL
      SELECT created_at          FROM videos              WHERE user_id = $1 AND source = 'User Upload'
      UNION ALL
      SELECT started_at          FROM player_phase_focus  WHERE user_id = $1
    ) act
    WHERE ts >= $2 AND ts < $3
    LIMIT 1
  `, [userId, start, end]);

  return rows.length > 0;
}

async function getLastWeekModules(userId: string): Promise<{ sessions: number; modules: string[] }> {
  const weekAgo = new Date();
  weekAgo.setDate(weekAgo.getDate() - 7);

  const { rows } = await pool.query(`
    SELECT
      (SELECT COUNT(*) FROM cognition_sessions  WHERE user_id = $1 AND completed_at >= $2) AS cog,
      (SELECT COUNT(*) FROM discipline_sessions WHERE user_id = $1 AND completed_at >= $2) AS dis,
      (SELECT COUNT(*) FROM acuity_completions  WHERE user_id = $1 AND completed_at >= $2) AS acu,
      (SELECT COUNT(*) FROM confidence_sessions WHERE user_id = $1 AND completed_at >= $2) AS con,
      (SELECT COUNT(*) FROM videos              WHERE user_id = $1 AND created_at >= $2 AND source = 'User Upload') AS upl
  `, [userId, weekAgo]);

  const r = rows[0];
  const modules: string[] = [];
  if (Number(r.cog) > 0) modules.push("Cognition");
  if (Number(r.dis) > 0) modules.push("Discipline");
  if (Number(r.acu) > 0) modules.push("Visual Acuity");
  if (Number(r.con) > 0) modules.push("Confidence");
  if (Number(r.upl) > 0) modules.push("Swings");

  const sessions = Number(r.cog) + Number(r.dis) + Number(r.acu) + Number(r.con) + Number(r.upl);
  return { sessions, modules };
}

// ── Daily job ─────────────────────────────────────────────────────────────────

export async function runDailyJob(): Promise<{ processed: number; emails: string[] }> {
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);
  const twoDaysAgo = new Date(today);
  twoDaysAgo.setDate(today.getDate() - 2);
  const isMonday = today.getDay() === 1;

  // Get all users with email addresses
  const allUsers = await db
    .select({ id: users.id, email: users.email, firstName: users.firstName })
    .from(users)
    .where(eq(users.emailVerified, true));

  const emailsSent: string[] = [];

  for (const user of allUsers) {
    if (!user.email) continue;
    const firstName = user.firstName || "Hitter";

    try {
      const [trainedYesterday, trainedTwoDaysAgo, trainedToday] = await Promise.all([
        hadActivityOnDate(user.id, yesterday),
        hadActivityOnDate(user.id, twoDaysAgo),
        hadActivityOnDate(user.id, today),
      ]);

      const { streak } = await computeStreak(user.id);

      // ── Streak at risk: trained yesterday, nothing yet today ──────────────
      if (trainedYesterday && !trainedToday && streak > 0) {
        const alreadySent = await alreadySentToday(user.id, "streak_at_risk");
        if (!alreadySent) {
          await sendStreakAtRiskEmail(user.email, firstName, streak);
          await logEmail(user.id, "streak_at_risk");
          emailsSent.push(`streak_at_risk → ${user.email}`);
        }
      }

      // ── Streak broken: trained 2 days ago, missed yesterday ───────────────
      if (trainedTwoDaysAgo && !trainedYesterday) {
        const alreadySent = await alreadySentToday(user.id, "streak_broken");
        if (!alreadySent) {
          // streak here reflects the broken state (0 or previous count)
          // use yesterday's streak: streak + 1 approximate
          const brokenStreak = streak + 1;
          if (brokenStreak >= 2) {
            await sendStreakBrokenEmail(user.email, firstName, brokenStreak);
            await logEmail(user.id, "streak_broken");
            emailsSent.push(`streak_broken → ${user.email}`);
          }
        }
      }

      // ── Re-engagement: last activity was exactly 7 days ago ───────────────
      if (!trainedToday && !trainedYesterday && streak === 0) {
        const sevenDaysAgo = new Date(today);
        sevenDaysAgo.setDate(today.getDate() - 7);
        const trainedSevenDaysAgo = await hadActivityOnDate(user.id, sevenDaysAgo);
        if (trainedSevenDaysAgo) {
          const alreadySent = await alreadySentToday(user.id, "reengagement_7d");
          if (!alreadySent) {
            await sendReengagementEmail(user.email, firstName, 7);
            await logEmail(user.id, "reengagement_7d");
            emailsSent.push(`reengagement_7d → ${user.email}`);
          }
        }
      }

      // ── Weekly recap: every Monday ────────────────────────────────────────
      if (isMonday) {
        const alreadySent = await alreadySentToday(user.id, "weekly_recap");
        if (!alreadySent) {
          const { sessions, modules } = await getLastWeekModules(user.id);
          if (sessions > 0) {
            await sendWeeklyRecapEmail(user.email, firstName, sessions, streak, modules);
            await logEmail(user.id, "weekly_recap");
            emailsSent.push(`weekly_recap → ${user.email}`);
          }
        }
      }

    } catch (err) {
      console.error(`[cron] error processing user ${user.id}:`, err);
    }
  }

  return { processed: allUsers.length, emails: emailsSent };
}

// ── Milestone email helper (called from badge award) ─────────────────────────

export async function sendMilestoneEmailIfNeeded(
  userId: string,
  email: string,
  firstName: string,
  newBadgeIds: string[],
) {
  const streakBadges = ["streak_3", "streak_7", "streak_14", "streak_30", "streak_100"];
  for (const badgeId of newBadgeIds) {
    if (!streakBadges.includes(badgeId)) continue;
    const badge = BADGE_DEFINITIONS.find(b => b.id === badgeId);
    if (!badge) continue;
    const streak = parseInt(badgeId.split("_")[1]);
    try {
      await sendStreakMilestoneEmail(email, firstName, streak, badge.name);
      await logEmail(userId, `milestone_${badgeId}`);
    } catch (err) {
      console.error(`[cron] milestone email error for ${userId}:`, err);
    }
  }
}
