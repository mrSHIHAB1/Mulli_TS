/* eslint-disable @typescript-eslint/no-explicit-any */
import { User } from "../user/user.model";
import { Comment } from "./clubhouse.model";
import { ReactionType } from "./clubhouse.interface ";
import { ClubhouseBadge, ClubhouseStatus } from "../user/user.interface";

// ─── CONSTANTS ────────────────────────────────────────────────────────────────

const POINTS = {
  LIKE_RECEIVED: 1,
  STRONG_REACTION_RECEIVED: 2,
  COMMENT_RECEIVED: 4,
  REPLY_RECEIVED: 3,
  POST_CREATED: 8,
  POST_10_COMMENT_BONUS: 10,
  LIKE_GIVEN: 0.2,
  STRONG_REACTION_GIVEN: 0.5,
  COMMENT_GIVEN: 4,
} as const;

const CAPS = {
  POSTS_CREATED_PER_DAY: 5,
  BONUS_POSTS_PER_DAY: 3,
  LIKES_GIVEN_PER_DAY: 20,
  STRONG_REACTIONS_GIVEN_PER_DAY: 20,
  COMMENTS_GIVEN_PER_DAY: 10,
  COMMENTS_PER_POST_PER_USER: 5,
  GIVEN_POINTS_PER_DAY: 150, // confirmed top of spec range (100–150)
} as const;

// BADGE_REQUIREMENTS must remain sorted highest → lowest.
// computeBadge relies on this order to return the best matching badge.
const BADGE_REQUIREMENTS = [
  { badge: ClubhouseBadge.CLUBHOUSE_CHAMPION, minPoints: 1500, minActiveDays: 14 },
  { badge: ClubhouseBadge.LOCAL_LEGEND, minPoints: 500, minActiveDays: 7 },
  { badge: ClubhouseBadge.RISING_STAR, minPoints: 100, minActiveDays: 3 },
] as const;

const BADGE_RANK: Record<string, number> = {
  [ClubhouseBadge.CLUBHOUSE_CHAMPION]: 3,
  [ClubhouseBadge.LOCAL_LEGEND]: 2,
  [ClubhouseBadge.RISING_STAR]: 1,
};

const BADGE_PROTECTION_DAYS = 7;
const DECAY_GRACE_DAYS = 3;
const DECAY_RATE = 0.02; // 2% per day

// Spec requirement: a user in CHECKED_OUT must earn more than this many points
// in a single return session before their status reverts to IN_CLUBHOUSE.
// This blocks cheap one-like resets (0.2 pts) from clearing the decay period.
const REENTRY_POINTS_THRESHOLD = 3;

// ─── HELPERS ──────────────────────────────────────────────────────────────────

function isSameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

function daysBetween(from: Date, to: Date = new Date()): number {
  return Math.floor((to.getTime() - from.getTime()) / 86400000);
}

function ensureDailyStats(user: any): void {
  const today = new Date();
  const stats = user.dailyClubhouseStats;
  if (!stats || !stats.date || !isSameDay(new Date(stats.date), today)) {
    user.dailyClubhouseStats = {
      date: today,
      givenPoints: 0,
      postsCreated: 0,
      bonusPostsAwarded: 0,
      likesGiven: 0,
      strongReactionsGiven: 0,
      commentsGiven: 0,
      // Tracks points earned this return session while status is CHECKED_OUT.
      // Resets to 0 whenever the user transitions back to IN_CLUBHOUSE.
      reentryPoints: 0,
    };
  }
}

function computeBadge(points: number, activeDays: number): ClubhouseBadge | null {
  for (const req of BADGE_REQUIREMENTS) {
    if (points >= req.minPoints && activeDays >= req.minActiveDays) return req.badge;
  }
  return null;
}

function applyBadgeAndStatus(user: any): void {
  // Status is driven by lastClubhouseActivity, but CHECKED_OUT → IN_CLUBHOUSE
  // transitions are gated by the 3-point re-entry threshold (see addGivenPoints).
  // This function only moves status *into* COOLING_DOWN or CHECKED_OUT; the
  // upward transition back to IN_CLUBHOUSE is handled in addGivenPoints.
  const lastActivity: Date | null = user.lastClubhouseActivity
    ? new Date(user.lastClubhouseActivity)
    : null;

  if (!lastActivity) {
    user.clubhouseStatus = ClubhouseStatus.IN_CLUBHOUSE;
  } else {
    const days = daysBetween(lastActivity);
    if (days === 0) {
      // Only set IN_CLUBHOUSE here if not already CHECKED_OUT awaiting re-entry.
      // If CHECKED_OUT, addGivenPoints controls the upward transition.
      if (user.clubhouseStatus !== ClubhouseStatus.CHECKED_OUT) {
        user.clubhouseStatus = ClubhouseStatus.IN_CLUBHOUSE;
      }
    } else if (days <= DECAY_GRACE_DAYS) {
      user.clubhouseStatus = ClubhouseStatus.COOLING_DOWN;
    } else {
      user.clubhouseStatus = ClubhouseStatus.CHECKED_OUT;
    }
  }

  // Badge
  const activeDays = user.clubhouseActiveSince
    ? daysBetween(new Date(user.clubhouseActiveSince))
    : 0;
  const newBadge = computeBadge(user.badgePoints || 0, activeDays);
  const currentBadge: ClubhouseBadge | null = user.clubhouseBadge ?? null;

  // 7-day protection: prevent downgrades within protection window
  if (currentBadge && user.badgeEarnedAt) {
    const daysSinceEarned = daysBetween(new Date(user.badgeEarnedAt));
    if (daysSinceEarned < BADGE_PROTECTION_DAYS) {
      const newRank = newBadge ? (BADGE_RANK[newBadge] ?? 0) : 0;
      const currentRank = BADGE_RANK[currentBadge] ?? 0;
      if (newRank <= currentRank) return; // keep existing badge
    }
  }

  if (newBadge !== currentBadge) {
    user.clubhouseBadge = newBadge;
    const wasUpgrade =
      !currentBadge ||
      (newBadge && (BADGE_RANK[newBadge] ?? 0) > (BADGE_RANK[currentBadge] ?? 0));
    if (wasUpgrade) {
      user.badgeEarnedAt = new Date();
    }
  }
}

// ─── CORE AWARD / DEDUCT FUNCTIONS ───────────────────────────────────────────

/**
 * Award received points (from others' engagement with your content). No daily cap.
 */
async function addReceivedPoints(userId: string, points: number): Promise<void> {
  const user = await User.findById(userId);
  if (!user) return;

  if (!(user as any).clubhouseActiveSince) {
    (user as any).clubhouseActiveSince = new Date();
  }
  (user as any).badgePoints = ((user as any).badgePoints || 0) + points;
  applyBadgeAndStatus(user);
  await user.save();
}

/**
 * Deduct received points (when the reaction is removed from your content).
 */
async function deductReceivedPoints(userId: string, points: number): Promise<void> {
  const user = await User.findById(userId);
  if (!user) return;

  (user as any).badgePoints = Math.max(0, ((user as any).badgePoints || 0) - points);
  applyBadgeAndStatus(user);
  await user.save();
}

/**
 * Deduct given points and restore the daily slot so the user can react again.
 */
async function deductGivenPoints(
  userId: string,
  points: number,
  dailyCountField: string
): Promise<void> {
  const user = await User.findById(userId);
  if (!user) return;

  ensureDailyStats(user);
  const stats = (user as any).dailyClubhouseStats;

  // Restore the daily action slot
  stats[dailyCountField] = Math.max(0, (stats[dailyCountField] || 0) - 1);
  // Restore the daily given-points budget
  stats.givenPoints = Math.max(0, (stats.givenPoints || 0) - points);
  // Deduct from lifetime total
  // NOTE: if the original award was capped (partial points granted), this
  // deducts the full nominal amount, which can over-correct. A complete fix
  // requires storing the actual points awarded on the Comment/Post document.
  (user as any).badgePoints = Math.max(0, ((user as any).badgePoints || 0) - points);

  applyBadgeAndStatus(user);
  await user.save();
}

/**
 * Award given points for the user's own active actions. Subject to daily caps.
 *
 * Re-entry rule (spec): if the user is currently CHECKED_OUT, they must
 * accumulate more than REENTRY_POINTS_THRESHOLD points across their return
 * actions before their status flips back to IN_CLUBHOUSE and decay stops.
 * This prevents a single cheap like (0.2 pts) from clearing the decay period.
 *
 * Activity stamping: lastClubhouseActivity is always updated when the user
 * attempts any point-earning action, even if no points are awarded due to caps.
 * Per spec, "inactivity" means no engagement at all — the attempt resets the
 * decay timer regardless of whether points were granted, but it does NOT
 * immediately clear CHECKED_OUT status (that still requires 3+ pts).
 *
 * @param dailyCountField - field on dailyClubhouseStats to check/increment (or null)
 * @param dailyCountLimit - max per-day count for that field (or null)
 */
async function addGivenPoints(
  userId: string,
  points: number,
  dailyCountField: string | null,
  dailyCountLimit: number | null
): Promise<boolean> {
  const user = await User.findById(userId);
  if (!user) return false;

  const now = new Date();
  if (!(user as any).clubhouseActiveSince) {
    (user as any).clubhouseActiveSince = now;
  }

  // Always stamp activity — the attempt itself keeps the grace period alive.
  // Do NOT reset lastDecayAppliedAt or force IN_CLUBHOUSE yet; the re-entry
  // threshold check below controls the status transition.
  (user as any).lastClubhouseActivity = now;

  ensureDailyStats(user);
  const stats = (user as any).dailyClubhouseStats;

  // ── Per-action daily cap check (checked before incrementing) ──
  if (dailyCountField !== null && dailyCountLimit !== null) {
    if ((stats[dailyCountField] || 0) >= dailyCountLimit) {
      await user.save(); // save activity timestamp even on cap
      return false;
    }
  }

  // ── Overall daily given-points cap ──
  if ((stats.givenPoints || 0) >= CAPS.GIVEN_POINTS_PER_DAY) {
    await user.save(); // save activity timestamp even on cap
    return false;
  }

  // Both caps passed — now increment the per-action counter and award points.
  if (dailyCountField !== null) {
    stats[dailyCountField] = (stats[dailyCountField] || 0) + 1;
  }

  const remaining = CAPS.GIVEN_POINTS_PER_DAY - (stats.givenPoints || 0);
  const actual = Math.min(points, remaining);
  stats.givenPoints = (stats.givenPoints || 0) + actual;
  (user as any).badgePoints = ((user as any).badgePoints || 0) + actual;

  // ── Re-entry threshold: gate IN_CLUBHOUSE transition for CHECKED_OUT users ──
  const wasCheckedOut =
    (user as any).clubhouseStatus === ClubhouseStatus.CHECKED_OUT;

  if (wasCheckedOut) {
    // Accumulate return-session points. Reset when the user fully re-enters.
    const reentryPoints = ((stats.reentryPoints || 0) + actual);
    stats.reentryPoints = reentryPoints;

    if (reentryPoints > REENTRY_POINTS_THRESHOLD) {
      // Threshold crossed — fully re-enter the clubhouse
      (user as any).clubhouseStatus = ClubhouseStatus.IN_CLUBHOUSE;
      (user as any).lastDecayAppliedAt = null; // reset grace period
      stats.reentryPoints = 0;
    }
    // If still below threshold, leave status as CHECKED_OUT (decay continues)
  } else {
    // Normal case: not checked out, status transitions freely
    (user as any).lastDecayAppliedAt = null;
  }

  applyBadgeAndStatus(user);
  await user.save();
  return true;
}

// ─── PUBLIC POINT EVENTS ──────────────────────────────────────────────────────

/**
 * User created a post → +8 to creator (cap 5 posts/day).
 */
export async function onPostCreated(userId: string): Promise<void> {
  await addGivenPoints(
    userId,
    POINTS.POST_CREATED,
    "postsCreated",
    CAPS.POSTS_CREATED_PER_DAY
  );
}

/**
 * User reacted to a post or comment.
 * Pass oldReactionType when an existing reaction was changed or removed.
 * Pass newReactionType as null when the reaction was toggled off.
 *
 * - Reactor: given points awarded on add, deducted on remove (daily slot restored)
 * - Content author: received points awarded on add, deducted on remove
 * - No points for reacting to your own content
 */
export async function onReactionGiven(
  reactorId: string,
  contentAuthorId: string,
  newReactionType: ReactionType | null, // null = reaction was removed
  oldReactionType: ReactionType | null  // null = no prior reaction
): Promise<void> {
  if (reactorId === contentAuthorId) return; // anti-spam

  // ── Deduct points for the reaction being removed / replaced ──
  if (oldReactionType) {
    const wasStrong =
      oldReactionType === ReactionType.FIRE || oldReactionType === ReactionType.HAHA;
    if (wasStrong) {
      await deductGivenPoints(reactorId, POINTS.STRONG_REACTION_GIVEN, "strongReactionsGiven");
      await deductReceivedPoints(contentAuthorId, POINTS.STRONG_REACTION_RECEIVED);
    } else {
      await deductGivenPoints(reactorId, POINTS.LIKE_GIVEN, "likesGiven");
      await deductReceivedPoints(contentAuthorId, POINTS.LIKE_RECEIVED);
    }
  }

  // ── Award points for the new reaction ──
  if (newReactionType) {
    const isStrong =
      newReactionType === ReactionType.FIRE || newReactionType === ReactionType.HAHA;
    if (isStrong) {
      await addGivenPoints(
        reactorId,
        POINTS.STRONG_REACTION_GIVEN,
        "strongReactionsGiven",
        CAPS.STRONG_REACTIONS_GIVEN_PER_DAY
      );
      await addReceivedPoints(contentAuthorId, POINTS.STRONG_REACTION_RECEIVED);
    } else {
      await addGivenPoints(
        reactorId,
        POINTS.LIKE_GIVEN,
        "likesGiven",
        CAPS.LIKES_GIVEN_PER_DAY
      );
      await addReceivedPoints(contentAuthorId, POINTS.LIKE_RECEIVED);
    }
  }
}

/**
 * User posted a top-level comment.
 * - Commenter: +4 (cap 10/day, and max 5 comments per post per user)
 * - Post author: +4 received (no cap, same 5-per-user-per-post limit)
 *
 * countDocuments is called BEFORE the new comment is inserted, so the count
 * reflects existing interactions. We use >= (not >) so that when the user
 * already has 5 interactions, this 6th one is correctly blocked.
 */
export async function onCommentCreated(
  commenterId: string,
  postAuthorId: string,
  postId: string
): Promise<void> {
  if (commenterId === postAuthorId) return; // anti-spam

  // Count ALL interactions (comments + replies) by this user on this post.
  // The cap is 5 total per user per post, not 5 comments + 5 replies separately.
  const countOnPost = await Comment.countDocuments({ post: postId, user: commenterId });
  if (countOnPost >= CAPS.COMMENTS_PER_POST_PER_USER) return; // FIX: was >

  await addGivenPoints(
    commenterId,
    POINTS.COMMENT_GIVEN,
    "commentsGiven",
    CAPS.COMMENTS_GIVEN_PER_DAY
  );
  await addReceivedPoints(postAuthorId, POINTS.COMMENT_RECEIVED);
}

/**
 * User replied to a comment.
 * - Replier: +4 (cap 10/day, max 5 total interactions per post per user)
 * - Comment author: +3 received (no cap)
 */
export async function onReplyCreated(
  replierId: string,
  commentAuthorId: string,
  postId: string
): Promise<void> {
  if (replierId === commentAuthorId) return;

  // Count all interactions (comments + replies) by this user on this post.
  // >= so the 6th interaction is blocked (count reflects pre-insert state).
  const countOnPost = await Comment.countDocuments({
    post: postId,
    user: replierId,
  });
  if (countOnPost >= CAPS.COMMENTS_PER_POST_PER_USER) return; // FIX: was >

  await addGivenPoints(
    replierId,
    POINTS.COMMENT_GIVEN,
    "commentsGiven",
    CAPS.COMMENTS_GIVEN_PER_DAY
  );
  await addReceivedPoints(commentAuthorId, POINTS.REPLY_RECEIVED);
}

/**
 * Check if a post just hit 10 comments and award the milestone bonus.
 * Must be called with the post's commentsCount AFTER the increment.
 * Post author gets +10 (cap 3 such bonuses/day).
 */
export async function checkCommentMilestone(
  postAuthorId: string,
  newCommentsCount: number,
  postId: string
): Promise<void> {
  if (newCommentsCount !== 10) return;

  // Atomically mark the post as milestone-awarded so this can never fire twice
  // (e.g. if a comment is deleted and a new one brings count back to 10)
  const { Post } = await import("./clubhouse.model");
  const claimed = await Post.findOneAndUpdate(
    { _id: postId, milestoneAwarded: false },
    { $set: { milestoneAwarded: true } }
  );
  if (!claimed) return; // already awarded or post not found

  const user = await User.findById(postAuthorId);
  if (!user) return;

  if (!(user as any).clubhouseActiveSince) {
    (user as any).clubhouseActiveSince = new Date();
  }

  ensureDailyStats(user);
  const stats = (user as any).dailyClubhouseStats;

  if ((stats.bonusPostsAwarded || 0) >= CAPS.BONUS_POSTS_PER_DAY) return;

  stats.bonusPostsAwarded = (stats.bonusPostsAwarded || 0) + 1;
  (user as any).badgePoints =
    ((user as any).badgePoints || 0) + POINTS.POST_10_COMMENT_BONUS;
  applyBadgeAndStatus(user);
  await user.save();
}

// ─── DELETION REVERSALS ───────────────────────────────────────────────────────

/**
 * Call BEFORE deleting a top-level comment.
 * Reverses the points earned when that comment was created.
 *
 * Because countDocuments is called before the deletion, it still reflects the
 * comment being deleted. We use > (not >=) here: if the current count is 6,
 * comments 6 and above never earned points and need no reversal. If count is
 * exactly 5 (at the cap), this comment did earn points and should be reversed.
 *
 * Known limitation: if the original award was partially capped by the daily
 * givenPoints budget, deductGivenPoints will over-deduct. A complete fix
 * requires storing the actual awarded amount on the Comment document.
 */
export async function onCommentDeleted(
  commenterId: string,
  postAuthorId: string,
  postId: string
): Promise<void> {
  if (commenterId === postAuthorId) return;
  // countDocuments called before deletion — count includes the comment to be deleted.
  // Comments beyond position 5 never earned points; skip reversal for those.
  const count = await Comment.countDocuments({ post: postId, user: commenterId });
  if (count > CAPS.COMMENTS_PER_POST_PER_USER) return;
  await deductGivenPoints(commenterId, POINTS.COMMENT_GIVEN, "commentsGiven");
  await deductReceivedPoints(postAuthorId, POINTS.COMMENT_RECEIVED);
}

/**
 * Call BEFORE deleting a reply.
 * Reverses the points earned when that reply was created.
 */
export async function onReplyDeleted(
  replierId: string,
  commentAuthorId: string,
  postId: string
): Promise<void> {
  if (replierId === commentAuthorId) return;
  const count = await Comment.countDocuments({ post: postId, user: replierId });
  if (count > CAPS.COMMENTS_PER_POST_PER_USER) return;
  await deductGivenPoints(replierId, POINTS.COMMENT_GIVEN, "commentsGiven");
  await deductReceivedPoints(commentAuthorId, POINTS.REPLY_RECEIVED);
}

/**
 * Call BEFORE deleting a post.
 * Reverses the post-creation points awarded to the author.
 *
 * Known limitation: if the original +8 award was partially capped by the daily
 * givenPoints budget, this will deduct the full 8 pts and over-correct.
 * Fix: store the actual awarded amount on the Post document.
 */
export async function onPostDeleted(authorId: string): Promise<void> {
  await deductGivenPoints(authorId, POINTS.POST_CREATED, "postsCreated");
}

// ─── DECAY ────────────────────────────────────────────────────────────────────
//
// How it works (day-by-day):
//
//  lastActivity       grace ends       decay runs each day
//  ────────────────────────────────────────────────────────►
//  Day 0              Day 3            Day 4   Day 5   Day 6 ...
//                                      -2%     -2%     -2%
//
// lastDecayAppliedAt tracks the last time this function ran for the user.
// Each cron run only decays for (today - lastDecayAppliedAt) days, NOT for
// total days since lastActivity. This prevents double-compounding.
//
// Example (1000 pts, inactive since Day 0):
//   Day 4 cron: lastDecayAppliedAt=null → decayFrom = Day 0+3 = Day 3
//               daysToDecay = today(4) - Day 3 = 1 → 1000 * 0.98^1 = 980
//               lastDecayAppliedAt = Day 4
//   Day 5 cron: lastDecayAppliedAt = Day 4 → daysToDecay = 1 → 980 * 0.98 ≈ 960
//               lastDecayAppliedAt = Day 5
//   Day 6 cron: → 960 * 0.98 ≈ 940   (and so on)
//
// If a user becomes active again between cron runs, lastActivity resets and
// decay stops (daysSinceActivity ≤ 3 guard). When they go inactive again,
// a fresh grace period starts from the new lastActivity.

/**
 * Apply one incremental day of decay for a single user.
 * Safe to call multiple times — uses lastDecayAppliedAt to avoid double-applying.
 */
export async function applyPointDecay(userId: string): Promise<void> {
  const user = await User.findById(userId);
  if (!user) return;

  const lastActivity: Date | null = (user as any).lastClubhouseActivity
    ? new Date((user as any).lastClubhouseActivity)
    : null;
  if (!lastActivity) return;

  // Still within the grace period — no decay yet
  const daysSinceActivity = daysBetween(lastActivity);
  if (daysSinceActivity <= DECAY_GRACE_DAYS) return;

  const current: number = (user as any).badgePoints || 0;
  if (current <= 0) return;

  const lastDecayAppliedAt: Date | null = (user as any).lastDecayAppliedAt
    ? new Date((user as any).lastDecayAppliedAt)
    : null;

  // Determine the reference point for this decay run:
  // - First ever run (or user was active after last decay): start from grace period end
  // - Subsequent runs: start from when decay was last applied
  const useLastDecay =
    lastDecayAppliedAt !== null && lastDecayAppliedAt > lastActivity;
  const decayFrom = useLastDecay
    ? lastDecayAppliedAt!
    : new Date(lastActivity.getTime() + DECAY_GRACE_DAYS * 86400000);

  const daysToDecay = daysBetween(decayFrom);
  if (daysToDecay < 1) return; // already ran today

  // Apply -2% for each outstanding day
  const newPoints = Math.floor(current * Math.pow(1 - DECAY_RATE, daysToDecay));

  if (newPoints < current) {
    (user as any).badgePoints = newPoints;
    (user as any).lastDecayAppliedAt = new Date();
    applyBadgeAndStatus(user);
    await user.save();
  }
}

/**
 * Apply decay to all eligible users.
 * Wire this up to a daily cron job (runs once per day, e.g. at 02:00):
 *
 *   import cron from "node-cron";
 *   import { applyDecayToAllUsers } from "../modules/Clubhouse/clubhouse.points";
 *   cron.schedule("0 2 * * *", applyDecayToAllUsers);
 *
 * Performance note: this currently runs sequentially (N+1 queries). For large
 * user bases, consider batching with bulkWrite and computing decay inline.
 */
export async function applyDecayToAllUsers(): Promise<number> {
  const graceCutoff = new Date(Date.now() - DECAY_GRACE_DAYS * 86400000);

  // Only users who have been inactive beyond the grace period
  const users = await User.find({
    lastClubhouseActivity: { $lt: graceCutoff },
    badgePoints: { $gt: 0 },
  }).select("_id");

  for (const u of users) {
    await applyPointDecay((u as any)._id.toString());
  }

  return users.length; // ← only new line
}

// ─── PROFILE ──────────────────────────────────────────────────────────────────

/**
 * Get a user's clubhouse stats profile with a live status refresh.
 */
export async function getClubhouseProfile(userId: string): Promise<any> {
  const user = await User.findById(userId).select(
    "firstName lastName profileImage badgePoints clubhouseStatus clubhouseBadge badgeEarnedAt lastClubhouseActivity clubhouseActiveSince dailyClubhouseStats"
  );
  if (!user) throw new Error("User not found");

  const prevStatus = (user as any).clubhouseStatus;
  const prevBadge = (user as any).clubhouseBadge;
  applyBadgeAndStatus(user);

  // Only write to DB if something actually changed
  if (
    (user as any).clubhouseStatus !== prevStatus ||
    (user as any).clubhouseBadge !== prevBadge
  ) {
    await user.save();
  }

  return user;
}