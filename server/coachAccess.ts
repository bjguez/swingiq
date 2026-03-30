import type { User } from "../shared/schema";
import { db } from "./db";
import { users } from "../shared/schema";
import { eq } from "drizzle-orm";

const TRIAL_DAYS = 14;

// Coaches who existed before the trial system was introduced have no
// coachTrialStartedAt. Backfill it to today so they get a fresh 14-day trial.
export async function ensureCoachTrialStarted(user: User): Promise<User> {
  if (user.subscriptionTier === "coach") return user;
  if (user.accountType !== "coach") return user;
  if (user.coachTrialStartedAt) return user;
  const now = new Date();
  const [updated] = await db
    .update(users)
    .set({ coachTrialStartedAt: now })
    .where(eq(users.id, user.id))
    .returning();
  return updated ?? user;
}

export function hasCoachAccess(user: User): boolean {
  if (user.subscriptionTier === "coach") return true;
  if (!user.coachTrialStartedAt) return false;
  const ms = Date.now() - new Date(user.coachTrialStartedAt).getTime();
  return ms < TRIAL_DAYS * 24 * 60 * 60 * 1000;
}

export function coachTrialDaysRemaining(user: User): number {
  if (user.subscriptionTier === "coach") return Infinity;
  if (!user.coachTrialStartedAt) return 0;
  const ms = Date.now() - new Date(user.coachTrialStartedAt).getTime();
  return Math.max(0, Math.ceil(TRIAL_DAYS - ms / (24 * 60 * 60 * 1000)));
}
