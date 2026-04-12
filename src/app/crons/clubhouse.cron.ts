import cron from "node-cron";
import { applyDecayToAllUsers } from "../modules/Clubhouse/clubhouse.points";
import { User } from "../modules/user/user.model";
import { ClubhouseBadge, ClubhouseStatus } from "../modules/user/user.interface";
import { NotificationService } from "../modules/notification/notification.service";
import { NotificationType } from "../modules/notification/notification.interface";

const MS_PER_DAY = 86_400_000;
const NOTIFICATION_COOLDOWN_MS = 3 * MS_PER_DAY; // never more than once per 3 days

// ─── BADGE HELPERS (mirrored from clubhouse.points.ts to avoid circular deps) ─

const BADGE_RANK: Record<string, number> = {
  [ClubhouseBadge.CLUBHOUSE_CHAMPION]: 3,
  [ClubhouseBadge.LOCAL_LEGEND]: 2,
  [ClubhouseBadge.RISING_STAR]: 1,
};

const BADGE_REQUIREMENTS = [
  { badge: ClubhouseBadge.CLUBHOUSE_CHAMPION, minPoints: 1500, minActiveDays: 14 },
  { badge: ClubhouseBadge.LOCAL_LEGEND, minPoints: 500, minActiveDays: 7 },
  { badge: ClubhouseBadge.RISING_STAR, minPoints: 100, minActiveDays: 3 },
] as const;

function daysBetween(from: Date, to: Date = new Date()): number {
  return Math.floor((to.getTime() - from.getTime()) / MS_PER_DAY);
}

function computeBadge(points: number, activeDays: number): ClubhouseBadge | null {
  for (const req of BADGE_REQUIREMENTS) {
    if (points >= req.minPoints && activeDays >= req.minActiveDays) return req.badge;
  }
  return null;
}

// ─── INACTIVITY NOTIFICATIONS ─────────────────────────────────────────────────

interface InactivityEntry {
  /** Days since last clubhouse activity that trigger this message. */
  day: number;
  body: string;
  /** If true, only send when status is CHECKED_OUT. */
  requireCheckedOut?: boolean;
}

const INACTIVITY_SCHEDULE: InactivityEntry[] = [
  {
    day: 2,
    body: "Stay engaged with what is happening in the Clubhouse!",
  },
  {
    day: 4,
    body: "You've stepped out. Create a new post to keep your badge\u26F3",
    requireCheckedOut: true,
  },
  {
    day: 7,
    body: "New posts are waiting in the Clubhouse\uD83D\uDD25",
    requireCheckedOut: true,
  },
  {
    day: 11,
    body: "The Clubhouse is still open \u26F3\nSee what's new!",
    requireCheckedOut: true,
  },
  {
    day: 20,
    body: "Someone just started a conversation you'd like \u26F3 Check it out!",
    requireCheckedOut: true,
  },
];

/**
 * For each schedule entry, find users who crossed that inactivity day threshold
 * within the current cron window and haven't been notified in the last 3 days.
 *
 * @param filterUserId  When provided, only that user is checked (test mode).
 */
async function sendInactivityNotifications(filterUserId?: string): Promise<number> {
  const now = Date.now();
  const cooldownCutoff = new Date(now - NOTIFICATION_COOLDOWN_MS);
  let count = 0;

  for (const entry of INACTIVITY_SCHEDULE) {
    // Users whose last activity falls in the 24-hour window starting at `entry.day` days ago
    const windowEnd = new Date(now - entry.day * MS_PER_DAY);
    const windowStart = new Date(now - (entry.day + 1) * MS_PER_DAY);

    const query: Record<string, unknown> = {
      lastClubhouseActivity: { $gte: windowStart, $lt: windowEnd },
      $or: [
        { lastInactivityNotificationAt: null },
        { lastInactivityNotificationAt: { $lt: cooldownCutoff } },
      ],
    };

    if (entry.requireCheckedOut) {
      query.clubhouseStatus = ClubhouseStatus.CHECKED_OUT;
    }

    if (filterUserId) {
      query._id = filterUserId;
    }

    const users = await User.find(query).select("_id").lean();

    for (const u of users) {
      const userId = (u as any)._id.toString();
      try {
        await NotificationService.notifyClubhouseSystem(
          userId,
          NotificationType.CLUBHOUSE_INACTIVITY,
          "Clubhouse",
          entry.body,
        );
        await User.updateOne(
          { _id: (u as any)._id },
          { $set: { lastInactivityNotificationAt: new Date() } },
        );
        count++;
      } catch (err: any) {
        console.error(`[ClubhouseCron] Inactivity notify failed for ${userId}:`, err.message);
      }
    }
  }

  return count;
}

/** Exported for test script — filters to a single user. */
export const sendInactivityNotificationsForTest = (userId?: string) =>
  sendInactivityNotifications(userId);

// ─── BADGE DOWNGRADE WARNINGS ─────────────────────────────────────────────────

/**
 * Find badge holders whose 7-day protection expires in exactly 2 days AND whose
 * current points (post-decay) would result in a downgrade once protection lifts.
 * Sends "You're still a {badge}! Jump back in anytime!" and respects the 3-day
 * notification cooldown.
 *
 * @param filterUserId  When provided, only that user is checked (test mode).
 */
async function sendBadgeDowngradeWarnings(filterUserId?: string): Promise<number> {
  const now = Date.now();
  const cooldownCutoff = new Date(now - NOTIFICATION_COOLDOWN_MS);

  // Badge was earned 5–6 days ago → protection expires in 1–2 days
  const earnedWindowStart = new Date(now - 6 * MS_PER_DAY);
  const earnedWindowEnd = new Date(now - 5 * MS_PER_DAY);

  const baseQuery: Record<string, unknown> = {
    clubhouseBadge: { $ne: null },
    badgeEarnedAt: { $gte: earnedWindowStart, $lt: earnedWindowEnd },
    clubhouseStatus: ClubhouseStatus.CHECKED_OUT,
    $or: [
      { lastInactivityNotificationAt: null },
      { lastInactivityNotificationAt: { $lt: cooldownCutoff } },
    ],
  };

  if (filterUserId) {
    baseQuery._id = filterUserId;
  }

  const users = await User.find(baseQuery).select("_id clubhouseBadge badgePoints clubhouseActiveSince lastInactivityNotificationAt");

  let count = 0;

  for (const u of users) {
    const badge = (u as any).clubhouseBadge as ClubhouseBadge;
    const points: number = (u as any).badgePoints || 0;
    const activeDays = (u as any).clubhouseActiveSince
      ? daysBetween(new Date((u as any).clubhouseActiveSince))
      : 0;

    const badgeWithoutProtection = computeBadge(points, activeDays);
    const currentRank = BADGE_RANK[badge] ?? 0;
    const projectedRank = badgeWithoutProtection ? (BADGE_RANK[badgeWithoutProtection] ?? 0) : 0;

    if (projectedRank >= currentRank) continue; // no downgrade projected

    const userId = (u as any)._id.toString();
    const body = `You're still a ${badge}! Jump back in anytime!`;

    try {
      await NotificationService.notifyClubhouseSystem(
        userId,
        NotificationType.BADGE_DOWNGRADE_WARNING,
        "Keep your badge!",
        body,
        { badge },
      );
      await User.updateOne(
        { _id: (u as any)._id },
        { $set: { lastInactivityNotificationAt: new Date() } },
      );
      count++;
    } catch (err: any) {
      console.error(`[ClubhouseCron] Downgrade warn failed for ${userId}:`, err.message);
    }
  }

  return count;
}

/** Exported for test script — filters to a single user. */
export const sendBadgeDowngradeWarningsForTest = (userId?: string) =>
  sendBadgeDowngradeWarnings(userId);

// ─── CRON REGISTRATION ────────────────────────────────────────────────────────

let isRunning = false;

/**
 * Runs every day at 02:00 AM UTC.
 *
 * In order:
 * 1. Apply -2%/day point decay to all eligible users.
 * 2. Send inactivity push notifications per the schedule.
 * 3. Send badge-downgrade warnings to users whose protection expires in ~2 days.
 */
export const startClubhouseDecayCron = (): void => {
  cron.schedule(
    "0 2 * * *",
    async () => {
      if (isRunning) {
        console.warn("[ClubhouseCron] Previous run still in progress, skipping.");
        return;
      }

      isRunning = true;
      console.log("[ClubhouseCron] Starting daily jobs...");

      try {
        const decayCount = await applyDecayToAllUsers();
        console.log(`[ClubhouseCron] Decay complete. Users processed: ${decayCount}`);

        const inactivityCount = await sendInactivityNotifications();
        console.log(`[ClubhouseCron] Inactivity notifications sent: ${inactivityCount}`);

        const warningCount = await sendBadgeDowngradeWarnings();
        console.log(`[ClubhouseCron] Badge downgrade warnings sent: ${warningCount}`);
      } catch (err: any) {
        console.error("[ClubhouseCron] Daily job failed:", err.message);
      } finally {
        isRunning = false;
      }
    },
    { timezone: "UTC" },
  );

  console.log("[ClubhouseCron] Daily cron scheduled (02:00 UTC every day)");
};
