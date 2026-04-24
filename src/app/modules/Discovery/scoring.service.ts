/**
 * Scoring Service - Calculates Compatibility & Desire Scores
 * 
 * Buddy Mode:
 * - BCS (Buddy Compatibility Score) = 30% Skill Match + 20% Play Style + 15% Play Vibe + 15% Intent + 10% Home Course + 10% Location
 * - BDS (Buddy Desire Score) = 80% Match Rate + 20% Like Rate
 * 
 * Dating Mode:
 * - DCS (Dating Compatibility Score) = 20% Skill Match + 30% Dating Intent + 30% Lifestyle + 20% Location
 * - DDS (Dating Desire Score) = 80% Match Rate + 20% Like Rate
 */

import User from "../user/user.model";
import Swipe from "../Swipe/swipe.model";
import DiscoveryScore from "./discovery-score.model";
import { IUser } from "../user/user.interface";

interface SkillMatchResult {
  score: number;
  skillLevels: string[];
}

interface PlayStyleMatchResult {
  score: number;
  matchCount: number;
  totalComparable: number;
}

interface DesireScoreInput {
  userId: string;
  totalSwipesReceived: number;
  likesReceived: number;
}

/**
 * BUDDY MODE COMPATIBILITY SCORE CALCULATION
 * Considers: Skill, Play Style, Play Vibe, Intent, Home Course, Location
 */
export class BuddyCompatibilityScoring {
  /**
   * Calculate Skill Match (30% weight)
   * Score based on similarity in skill levels
   */
  static calculateSkillMatch(userSkillLevel: string, targetSkillLevel: string): number {
    const skillHierarchy: { [key: string]: number } = {
      "Beginner": 1,
      "Novice": 2,
      "Intermediate": 3,
      "Advanced": 4,
      "Expert": 5,
    };

    if (!userSkillLevel || !targetSkillLevel) return 50;

    const userLevel = skillHierarchy[userSkillLevel] || 3;
    const targetLevel = skillHierarchy[targetSkillLevel] || 3;

    // If within 1 level, high compatibility
    const diff = Math.abs(userLevel - targetLevel);
    if (diff === 0) return 100;
    if (diff === 1) return 85;
    if (diff === 2) return 60;
    return 40;
  }

  /**
   * Calculate Play Style Match (20% weight)
   * Compare play styles (competitive, chill, fun, practice, social)
   */
  static calculatePlayStyleMatch(userPlayStyle: string, targetPlayStyle: string): number {
    if (!userPlayStyle || !targetPlayStyle) return 50;
    if (userPlayStyle === targetPlayStyle) return 100;

    // Define compatible styles
    const compatiblePairs: { [key: string]: string[] } = {
      "COMPETITIVE": ["PRACTICE_FOCUSED"],
      "CHILL": ["SOCIAL_GOLFER", "JUST_FOR_FUN"],
      "JUST_FOR_FUN": ["CHILL", "SOCIAL_GOLFER"],
      "PRACTICE_FOCUSED": ["COMPETITIVE"],
      "SOCIAL_GOLFER": ["CHILL", "JUST_FOR_FUN"],
    };

    if (compatiblePairs[userPlayStyle]?.includes(targetPlayStyle)) {
      return 75;
    }

    return 40;
  }

  /**
   * Calculate Play Vibe Match (15% weight)
   * Compare energy/vibe preferences
   */
  static calculatePlayVibeMatch(userVibe: string, targetVibe: string): number {
    if (!userVibe || !targetVibe) return 50;
    if (userVibe === targetVibe) return 100;

    // Define compatible vibes
    const compatibleVibes: { [key: string]: string[] } = {
      "QUIET_FOCUSED": ["QUIET_FOCUSED"],
      "FRIENDLY_SOCIAL": ["MUSIC_VIBES", "DRINKS"],
      "MUSIC_VIBES": ["FRIENDLY_SOCIAL", "DRINKS"],
      "DRINKS": ["FRIENDLY_SOCIAL", "MUSIC_VIBES"],
    };

    if (compatibleVibes[userVibe]?.includes(targetVibe)) {
      return 75;
    }

    return 40;
  }

  /**
   * Calculate Intent Match (15% weight)
   * For Buddy mode, intent would be whether they're looking for a golf buddy
   */
  static calculateIntentMatch(userIntent: string, targetIntent: string): number {
    if (!userIntent || !targetIntent) return 50;
    if (userIntent === targetIntent) return 100;
    return 60;
  }

  /**
   * Calculate Home Course Match (10% weight)
   * Whether users prefer the same home course
   */
  static calculateHomeCourseMatch(userPreferredDistance: number, targetPreferredDistance: number): number {
    if (!userPreferredDistance || !targetPreferredDistance) return 50;

    const diff = Math.abs(userPreferredDistance - targetPreferredDistance);
    if (diff === 0) return 100;
    if (diff <= 10) return 85;
    if (diff <= 25) return 70;
    if (diff <= 50) return 55;
    return 40;
  }

  /**
   * Calculate Location Distance Score (10% weight)
   * Closer proximity = higher score
   */
  static calculateLocationScore(distanceKm: number): number {
    if (distanceKm <= 5) return 100;
    if (distanceKm <= 15) return 90;
    if (distanceKm <= 30) return 75;
    if (distanceKm <= 50) return 60;
    if (distanceKm <= 100) return 45;
    return 30;
  }

  /**
   * Calculate complete Buddy Compatibility Score
   */
  static calculateBCS(
    user: Partial<IUser>,
    target: Partial<IUser>,
    distanceKm: number
  ): number {
    const skillMatch = this.calculateSkillMatch(
      user.skillLevel || "Intermediate",
      target.skillLevel || "Intermediate"
    );

    const playStyleMatch = this.calculatePlayStyleMatch(
      user.vibe?.playStyles || "JUST_FOR_FUN",
      target.vibe?.playStyles || "JUST_FOR_FUN"
    );

    const playVibeMatch = this.calculatePlayVibeMatch(
      user.vibe?.courseVibes || "FRIENDLY_SOCIAL",
      target.vibe?.courseVibes || "FRIENDLY_SOCIAL"
    );

    const intentMatch = this.calculateIntentMatch(
      user.hopingToFind || "Casual",
      target.hopingToFind || "Casual"
    );

    const homeCourseMatch = this.calculateHomeCourseMatch(
      Number(user.preferredDistance) || 100,
      Number(target.preferredDistance) || 100
    );

    const locationScore = this.calculateLocationScore(distanceKm);

    // Weighted average
    const bcs =
      (skillMatch * 0.3) +
      (playStyleMatch * 0.2) +
      (playVibeMatch * 0.15) +
      (intentMatch * 0.15) +
      (homeCourseMatch * 0.1) +
      (locationScore * 0.1);

    return Math.round(bcs);
  }
}

/**
 * DATING MODE COMPATIBILITY SCORE CALCULATION
 */
export class DatingCompatibilityScoring {
  /**
   * Calculate Dating Skill Match (20% weight)
   * Based on how they want to spend time and lifestyle alignment
   */
  static calculateSkillMatch(userSkillLevel: string, targetSkillLevel: string): number {
    const skillHierarchy: { [key: string]: number } = {
      "Beginner": 1,
      "Novice": 2,
      "Intermediate": 3,
      "Advanced": 4,
      "Expert": 5,
    };

    if (!userSkillLevel || !targetSkillLevel) return 50;

    const userLevel = skillHierarchy[userSkillLevel] || 3;
    const targetLevel = skillHierarchy[targetSkillLevel] || 3;
    const diff = Math.abs(userLevel - targetLevel);

    if (diff === 0) return 100;
    if (diff === 1) return 80;
    if (diff === 2) return 60;
    return 40;
  }

  /**
   * Calculate Dating Intent Alignment (30% weight)
   * Long term vs casual, ethical, etc.
   */
  static calculateDatingIntentMatch(userIntent: string, targetIntent: string): number {
    if (!userIntent || !targetIntent) return 50;
    if (userIntent === targetIntent) return 100;

    // Some flexibility between similar intents
    const compatibleIntents: { [key: string]: string[] } = {
      "Long_Term": ["Long_Term"],
      "Short_Term": ["Casual", "Short_Term"],
      "Casual": ["Casual", "Short_Term"],
      "Ethical": ["Long_Term", "Ethical"],
    };

    if (compatibleIntents[userIntent]?.includes(targetIntent)) {
      return 80;
    }

    return 40;
  }

  /**
   * Calculate Lifestyle Compatibility (30% weight)
   * Based on education, politics, religion, cannabis, workout habits
   */
  static calculateLifestyleMatch(user: Partial<IUser>, target: Partial<IUser>): number {
    let matchCount = 0;
    let totalFactors = 0;

    const factors = [
      { user: user.educationPlan, target: target.educationPlan },
      { user: user.politics, target: target.politics },
      { user: user.religion, target: target.religion },
      { user: user.cannabis, target: target.cannabis },
      { user: user.workout, target: target.workout },
      { user: user.communicationStyle, target: target.communicationStyle },
    ];

    for (const factor of factors) {
      if (factor.user && factor.target) {
        totalFactors++;
        if (factor.user === factor.target) {
          matchCount++;
        }
      }
    }

    if (totalFactors === 0) return 50;
    return Math.round((matchCount / totalFactors) * 100);
  }

  /**
   * Calculate Dating Location Score (20% weight)
   */
  static calculateLocationScore(distanceKm: number): number {
    if (distanceKm <= 10) return 100;
    if (distanceKm <= 25) return 85;
    if (distanceKm <= 50) return 70;
    if (distanceKm <= 100) return 55;
    return 40;
  }

  /**
   * Calculate complete Dating Compatibility Score
   */
  static calculateDCS(
    user: Partial<IUser>,
    target: Partial<IUser>,
    distanceKm: number
  ): number {
    const skillMatch = this.calculateSkillMatch(
      user.skillLevel || "Intermediate",
      target.skillLevel || "Intermediate"
    );

    const datingIntentMatch = this.calculateDatingIntentMatch(
      user.hopingToFind || "Casual",
      target.hopingToFind || "Casual"
    );

    const lifestyleMatch = this.calculateLifestyleMatch(user, target);
    const locationScore = this.calculateLocationScore(distanceKm);

    // Weighted average
    const dcs =
      (skillMatch * 0.2) +
      (datingIntentMatch * 0.3) +
      (lifestyleMatch * 0.3) +
      (locationScore * 0.2);

    return Math.round(dcs);
  }
}

/**
 * DESIRE SCORE CALCULATION (Both modes use same logic)
 * DS = 80% Match Rate + 20% Like Rate
 * 
 * Match Rate: When this person likes others, do they get liked back?
 * Like Rate: How often do other users like this person regardless of how many likes they send?
 */
export class DesireScoring {
  /**
   * Calculate Match Rate for a user
   * Likes sent vs likes received back
   */
  static async calculateMatchRate(userId: string): Promise<number> {
    try {
      const user = await User.findById(userId);
      if (!user) return 0;

      // Get all likes sent by this user
      const likesSent = await Swipe.countDocuments({
        fromUser: userId,
        action: { $in: ["like", "superlike"] },
      });

      if (likesSent === 0) return 50; // Default middle score if no likes sent

      // Get matched count (likes that were reciprocated)
      const matched = await Swipe.countDocuments({
        fromUser: userId,
        action: { $in: ["like", "superlike"] },
        status: "matched",
      });

      const matchRate = (matched / likesSent) * 100;
      return Math.min(100, Math.round(matchRate));
    } catch (error) {
      console.error("Error calculating match rate:", error);
      return 50;
    }
  }

  /**
   * Calculate Like Rate for a user
   * How often do others like this person?
   */
  static async calculateLikeRate(userId: string): Promise<number> {
    try {
      // Get count of likes received by this user
      const likesReceived = await Swipe.countDocuments({
        toUser: userId,
        action: { $in: ["like", "superlike"] },
      });

      // Get total swipes received
      const totalSwipesReceived = await Swipe.countDocuments({
        toUser: userId,
      });

      if (totalSwipesReceived === 0) return 50; // Default score

      const likeRate = (likesReceived / totalSwipesReceived) * 100;
      return Math.min(100, Math.round(likeRate));
    } catch (error) {
      console.error("Error calculating like rate:", error);
      return 50;
    }
  }

  /**
   * Calculate Buddy Desire Score
   */
  static async calculateBDS(userId: string): Promise<number> {
    const matchRate = await this.calculateMatchRate(userId);
    const likeRate = await this.calculateLikeRate(userId);

    const bds = (matchRate * 0.8) + (likeRate * 0.2);
    return Math.round(bds);
  }

  /**
   * Calculate Dating Desire Score (same calculation as BDS)
   */
  static async calculateDDS(userId: string): Promise<number> {
    const matchRate = await this.calculateMatchRate(userId);
    const likeRate = await this.calculateLikeRate(userId);

    const dds = (matchRate * 0.8) + (likeRate * 0.2);
    return Math.round(dds);
  }
}

/**
 * Batch calculate scores for multiple users
 */
export async function calculateAndUpdateUserScores(
  userIds: string[],
  targetUserId: string
) {
  const targetUser = await User.findById(targetUserId);
  if (!targetUser) return;

  const targetLat = targetUser.location?.coordinates?.[1];
  const targetLng = targetUser.location?.coordinates?.[0];

  if (!targetLat || !targetLng) return;

  for (const userId of userIds) {
    try {
      const user = await User.findById(userId);
      if (!user) continue;

      // Calculate distance
      const userLat = user.location?.coordinates?.[1];
      const userLng = user.location?.coordinates?.[0];

      if (!userLat || !userLng) continue;

      const distanceKm = calculateDistance(targetLat, targetLng, userLat, userLng);

      // Calculate scores
      const bcs = BuddyCompatibilityScoring.calculateBCS(targetUser, user, distanceKm);
      const dcs = DatingCompatibilityScoring.calculateDCS(targetUser, user, distanceKm);
      const bds = await DesireScoring.calculateBDS(userId);
      const dds = await DesireScoring.calculateDDS(userId);

      // Get desire score metrics
      const totalLikesReceived = await Swipe.countDocuments({
        toUser: userId,
        action: { $in: ["like", "superlike"] },
      });
      const totalSwipesReceived = await Swipe.countDocuments({
        toUser: userId,
      });

      // Save Buddy Mode scores to DiscoveryScore
      await DiscoveryScore.findOneAndUpdate(
        { userId, mode: "buddy" },
        {
          userId,
          mode: "buddy",
          compatibilityScore: bcs,
          desireScore: bds,
          baseScore: Math.round((bcs * 0.7) + (bds * 0.3)),
          matchRate: bds,
          likeRate: (bds * 0.2),
          totalLikesReceived,
          totalSwipesReceived,
          scoreCalculatedAt: new Date(),
          lastUpdatedAt: new Date(),
        },
        { upsert: true, new: true }
      );

      // Save Dating Mode scores to DiscoveryScore
      await DiscoveryScore.findOneAndUpdate(
        { userId, mode: "date" },
        {
          userId,
          mode: "date",
          compatibilityScore: dcs,
          desireScore: dds,
          baseScore: Math.round((dcs * 0.4) + (dds * 0.6)),
          matchRate: dds,
          likeRate: (dds * 0.2),
          totalLikesReceived,
          totalSwipesReceived,
          scoreCalculatedAt: new Date(),
          lastUpdatedAt: new Date(),
        },
        { upsert: true, new: true }
      );
    } catch (error) {
      console.error(`Error calculating scores for user ${userId}:`, error);
    }
  }
}

/**
 * Calculate distance between two coordinates using Haversine formula
 */
export function calculateDistance(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number
): number {
  const R = 6371; // Earth's radius in km
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}
