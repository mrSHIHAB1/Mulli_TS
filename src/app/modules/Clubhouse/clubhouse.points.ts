/* eslint-disable @typescript-eslint/no-explicit-any */
import { User } from "../user/user.model";
import { Comment } from "./clubhouse.model";
import { ReactionType } from "./clubhouse.interface ";
import { ClubhouseBadge, ClubhouseStatus } from "../user/user.interface";
import { NotificationService } from "../notification/notification.service";

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
const DECAY_RATE = 0.02; 
const BADGE_PROXIMITY_THRESHOLD = 15; 


const REENTRY_POINTS_THRESHOLD = 3;

// ─── HELPERS ──────────────────────────────────────────────────────────────────

function badgeToProximityKey(badge: ClubhouseBadge): string {
  switch (badge) {
    case ClubhouseBadge.RISING_STAR: return "risingstar";
    case ClubhouseBadge.LOCAL_LEGEND: return "locallegend";
    case ClubhouseBadge.CLUBHOUSE_CHAMPION: return "clubhousechampion";
  }
}

function prepareBadgeProximity(user: any): ClubhouseBadge | null {
  const current: ClubhouseBadge | null = user.clubhouseBadge ?? null;
  const points: number = user.badgePoints || 0;

  // Determine the next badge target based on current badge
  let targetBadge: ClubhouseBadge | null = null;
  let minPoints = 0;

  if (!current) {
    targetBadge = ClubhouseBadge.RISING_STAR;
    minPoints = 100;
  } else if (current === ClubhouseBadge.RISING_STAR) {
    targetBadge = ClubhouseBadge.LOCAL_LEGEND;
    minPoints = 500;
  } else if (current === ClubhouseBadge.LOCAL_LEGEND) {
    targetBadge = ClubhouseBadge.CLUBHOUSE_CHAMPION;
    minPoints = 1500;
  }

  if (!targetBadge) return null; 


  if (points < minPoints - BADGE_PROXIMITY_THRESHOLD || points >= minPoints) return null;

  const key = badgeToProximityKey(targetBadge);
  if (user.badgeProximityNotified?.[key]) return null; 

  // Mark before save
  if (!user.badgeProximityNotified) {
    user.badgeProximityNotified = { risingstar: false, locallegend: false, clubhousechampion: false };
  }
  user.badgeProximityNotified[key] = true;

  return targetBadge;
}

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
  const lastActivity: Date | null = user.lastClubhouseActivity
    ? new Date(user.lastClubhouseActivity)
    : null;

  if (!lastActivity) {
    user.clubhouseStatus = ClubhouseStatus.IN_CLUBHOUSE;
  } else {
    const days = daysBetween(lastActivity);
    if (days === 0) {

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

async function addReceivedPoints(userId: string, points: number): Promise<void> {
  const user = await User.findById(userId);
  if (!user) return;

  if (!(user as any).clubhouseActiveSince) {
    (user as any).clubhouseActiveSince = new Date();
  }
  (user as any).badgePoints = ((user as any).badgePoints || 0) + points;

  const prevBadge: ClubhouseBadge | null = (user as any).clubhouseBadge ?? null;
  const proximityTarget = prepareBadgeProximity(user);
  applyBadgeAndStatus(user);
  await user.save();

  const newBadge: ClubhouseBadge | null = (user as any).clubhouseBadge ?? null;
  if (newBadge && newBadge !== prevBadge && (!prevBadge || (BADGE_RANK[newBadge] ?? 0) > (BADGE_RANK[prevBadge] ?? 0))) {
    void NotificationService.notifyBadgeEarned(userId, newBadge);
  }
  if (proximityTarget) {
    void NotificationService.notifyBadgeProximity(userId, proximityTarget);
  }
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
  stats[dailyCountField] = Math.max(0, (stats[dailyCountField] || 0) - 1);
  stats.givenPoints = Math.max(0, (stats.givenPoints || 0) - points);
  (user as any).badgePoints = Math.max(0, ((user as any).badgePoints || 0) - points);

  applyBadgeAndStatus(user);
  await user.save();
}

/**
  * Award given points for taking an action (e.g. reacting, commenting).
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

  (user as any).lastClubhouseActivity = now;

  ensureDailyStats(user);
  const stats = (user as any).dailyClubhouseStats;

  if (dailyCountField !== null && dailyCountLimit !== null) {
    if ((stats[dailyCountField] || 0) >= dailyCountLimit) {
      await user.save();
      return false;
    }
  }

  if ((stats.givenPoints || 0) >= CAPS.GIVEN_POINTS_PER_DAY) {
    await user.save(); 
    return false;
  }

  if (dailyCountField !== null) {
    stats[dailyCountField] = (stats[dailyCountField] || 0) + 1;
  }

  const remaining = CAPS.GIVEN_POINTS_PER_DAY - (stats.givenPoints || 0);
  const actual = Math.min(points, remaining);
  stats.givenPoints = (stats.givenPoints || 0) + actual;
  (user as any).badgePoints = ((user as any).badgePoints || 0) + actual;
  const wasCheckedOut =
    (user as any).clubhouseStatus === ClubhouseStatus.CHECKED_OUT;

  if (wasCheckedOut) {
  
    const reentryPoints = ((stats.reentryPoints || 0) + actual);
    stats.reentryPoints = reentryPoints;

    if (reentryPoints > REENTRY_POINTS_THRESHOLD) {
   
      (user as any).clubhouseStatus = ClubhouseStatus.IN_CLUBHOUSE;
      (user as any).lastDecayAppliedAt = null; // reset grace period
      stats.reentryPoints = 0;
    }
  } else {

    (user as any).lastDecayAppliedAt = null;
  }

  const prevBadge: ClubhouseBadge | null = (user as any).clubhouseBadge ?? null;
  const proximityTarget = prepareBadgeProximity(user);
  applyBadgeAndStatus(user);
  await user.save();

  const newBadge: ClubhouseBadge | null = (user as any).clubhouseBadge ?? null;
  if (newBadge && newBadge !== prevBadge && (!prevBadge || (BADGE_RANK[newBadge] ?? 0) > (BADGE_RANK[prevBadge] ?? 0))) {
    void NotificationService.notifyBadgeEarned(userId, newBadge);
  }
  if (proximityTarget) {
    void NotificationService.notifyBadgeProximity(userId, proximityTarget);
  }

  return true;
}

// ─── PUBLIC POINT EVENTS ──────────────────────────────────────────────────────

export async function onPostCreated(userId: string): Promise<void> {
  await addGivenPoints(
    userId,
    POINTS.POST_CREATED,
    "postsCreated",
    CAPS.POSTS_CREATED_PER_DAY
  );
}


export async function onReactionGiven(
  reactorId: string,
  contentAuthorId: string,
  newReactionType: ReactionType | null, 
  oldReactionType: ReactionType | null  
): Promise<void> {
  if (reactorId === contentAuthorId) return; 

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


export async function onCommentCreated(
  commenterId: string,
  postAuthorId: string,
  postId: string
): Promise<void> {
  if (commenterId === postAuthorId) return; // anti-spam


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


export async function onReplyCreated(
  replierId: string,
  commentAuthorId: string,
  postId: string
): Promise<void> {
  if (replierId === commentAuthorId) return;


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


export async function checkCommentMilestone(
  postAuthorId: string,
  newCommentsCount: number,
  postId: string
): Promise<void> {
  if (newCommentsCount !== 10) return;

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

  const prevBadge: ClubhouseBadge | null = (user as any).clubhouseBadge ?? null;
  const proximityTarget = prepareBadgeProximity(user);
  applyBadgeAndStatus(user);
  await user.save();

  const newBadge: ClubhouseBadge | null = (user as any).clubhouseBadge ?? null;
  if (newBadge && newBadge !== prevBadge && (!prevBadge || (BADGE_RANK[newBadge] ?? 0) > (BADGE_RANK[prevBadge] ?? 0))) {
    void NotificationService.notifyBadgeEarned(postAuthorId, newBadge);
  }
  if (proximityTarget) {
    void NotificationService.notifyBadgeProximity(postAuthorId, proximityTarget);
  }
}

// ─── DELETION REVERSALS ───────────────────────────────────────────────────────


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

export async function onPostDeleted(authorId: string): Promise<void> {
  await deductGivenPoints(authorId, POINTS.POST_CREATED, "postsCreated");
}

// ─── DECAY ────────────────────────────────────────────────────────────────────

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