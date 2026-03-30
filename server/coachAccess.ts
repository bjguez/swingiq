import type { User } from "../shared/schema";

const TRIAL_DAYS = 14;

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
