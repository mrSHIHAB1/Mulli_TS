/**
 * Ranking Utilities Service
 * 
 * Handles:
 * 1. Score Modifiers (Trust Score, Paid Boosts)
 * 2. New User Detection & Boost Logic
 * 3. Spacing Algorithm for New Users
 * 4. Final Score Calculation
 */

import User from "../user/user.model";
import DiscoveryScore from "./discovery-score.model";
import { IUser } from "../user/user.interface";

export type TrustScoreStatus = "RED" | "ORANGE" | "GREEN";

/**
 * Trust Score Penalties
 * - RED: -40% to final score
 * - ORANGE: -20% to final score
 * - GREEN: No penalty
 */
export class TrustScoreModifier {
  static getPenaltyMultiplier(trustScore: TrustScoreStatus): number {
    const penalties: { [key in TrustScoreStatus]: number } = {
      RED: 0.6, // 40% reduction
      ORANGE: 0.8, // 20% reduction
      GREEN: 1.0, // No penalty
    };
    return penalties[trustScore];
  }

  static applyTrustScorePenalty(finalScore: number, trustScore: TrustScoreStatus): number {
    const multiplier = this.getPenaltyMultiplier(trustScore);
    return Math.round(finalScore * multiplier);
  }

  /**
   * Determine trust score status based on user behavior
   * This is a placeholder - actual logic depends on your trust score criteria
   */
  static async determineTrustScore(userId: string): Promise<TrustScoreStatus> {
    try {
      // Placeholder logic - replace with actual trust score calculation
      // Could be based on: report count, block count, verified status, etc.
      return "GREEN";
    } catch (error) {
      console.error("Error determining trust score:", error);
      return "GREEN";
    }
  }
}

/**
 * Paid Boost Handler
 * - Manual Boost: +20% to final score
 * - Subscription Boost: +20% to final score
 */
export class PaidBoostModifier {
  static BOOST_BONUS = 1.2; // +20% multiplier

  static isCurrentlyBoosted(user: Partial<IUser>): boolean {
    if (!user.boostedUntil) return false;
    return new Date() < new Date(user.boostedUntil);
  }

  static applyBoostBonus(finalScore: number, isBoosted: boolean): number {
    if (!isBoosted) return finalScore;
    return Math.round(finalScore * this.BOOST_BONUS);
  }
}

/**
 * New User Boost Handler
 * 
 * New users are defined as: signed up within last 72 hours
 * They receive a special boost window but are tracked separately
 */
export class NewUserBoost {
  static NEW_USER_WINDOW_HOURS = 72;
  static NEW_USERS_PER_BATCH = 3; // 3 new users per batch of 20

  /**
   * Check if user is still in new user window based on DiscoveryScore creation
   */
  static isNewUser(discoverScore: any): boolean {
    if (!discoverScore?.createdAt) return false;

    const signupTime = new Date(discoverScore.createdAt);
    const now = new Date();
    const hoursSinceSignup =
      (now.getTime() - signupTime.getTime()) / (1000 * 60 * 60);

    return hoursSinceSignup <= this.NEW_USER_WINDOW_HOURS;
  }

  /**
   * Get remaining hours in new user window
   */
  static getRemainingNewUserHours(discoverScore: any): number {
    if (!discoverScore?.createdAt) return 0;

    const signupTime = new Date(discoverScore.createdAt);
    const now = new Date();
    const hoursSinceSignup =
      (now.getTime() - signupTime.getTime()) / (1000 * 60 * 60);

    const remaining = this.NEW_USER_WINDOW_HOURS - hoursSinceSignup;
    return Math.max(0, remaining);
  }

  /**
   * Update discovery score's new user status
   */
  static async updateNewUserStatus(userId: string, mode: "buddy" | "date"): Promise<void> {
    try {
      const score = await DiscoveryScore.findOne({ userId, mode });
      if (!score) return;

      const isNewUser = this.isNewUser(score);

      await DiscoveryScore.findByIdAndUpdate(score._id, {
        isNewUser,
        newUserWindowExpiresAt: isNewUser
          ? new Date(score.createdAt!.getTime() + this.NEW_USER_WINDOW_HOURS * 60 * 60 * 1000)
          : null,
        lastUpdatedAt: new Date(),
      });
    } catch (error) {
      console.error(`Error updating new user status for ${userId}:`, error);
    }
  }

  /**
   * Get new users available for swipe deck
   * Queries DiscoveryScore for users in new user window
   * Excludes users already swiped on by the current user
   */
  static async getAvailableNewUsers(
    currentUserId: string,
    excludeUserIds: string[] = [],
    limit: number = 10
  ): Promise<any[]> {
    try {
      // Query DiscoveryScore for users still in new user window
      const newUserScores = await DiscoveryScore.find({
        isNewUser: true,
        userId: {
          $ne: currentUserId,
          $nin: excludeUserIds,
        },
      })
        .sort({ createdAt: -1 })
        .limit(limit)
        .populate("userId", "-password -auth_providers -email -phone");

      // Return User objects with score data attached
      return newUserScores
        .filter((score) => score.userId)
        .map((score) => {
          const userObj = (score.userId as any).toObject ? (score.userId as any).toObject() : score.userId;
          return {
            ...userObj,
            _discoveryScore: {
              baseScore: score.baseScore,
              finalScore: score.finalScore,
              bucket: score.bucket,
              trustScore: score.trustScore,
              isBoosted: score.isBoosted,
              isNewUser: score.isNewUser,
            },
          };
        });
    } catch (error) {
      console.error("Error fetching new users:", error);
      return [];
    }
  }
}

/**
 * Final Score Calculation
 * 
 * Combines all components:
 * 1. Base Score (CS + DS)
 * 2. Trust Score Modifier
 * 3. Paid Boost
 * 4. Not combined with dealbreaker filters (those are handled separately)
 */
export class FinalScoreCalculator {
  /**
   * Calculate final score for ranking within a bucket
   */
  static calculateFinalScore(
    baseScore: number,
    trustScore: TrustScoreStatus,
    isBoosted: boolean
  ): number {
    let finalScore = baseScore;

    // Apply trust score penalty
    finalScore = TrustScoreModifier.applyTrustScorePenalty(finalScore, trustScore);

    // Apply boost bonus
    finalScore = PaidBoostModifier.applyBoostBonus(finalScore, isBoosted);

    return Math.round(finalScore);
  }

  /**
   * Prepare user for final score calculation
   */
  static async prepareUserScore(userId: string, mode: "buddy" | "date"): Promise<{
    baseScore: number;
    finalScore: number;
    trustScore: TrustScoreStatus;
    isBoosted: boolean;
  } | null> {
    try {
      // Get discovery score for this user and mode
      const score = await DiscoveryScore.findOne({ userId, mode });
      if (!score) return null;

      const baseScore = score.baseScore;
      const trustScore = score.trustScore as TrustScoreStatus;
      const isBoosted = score.isBoosted;

      // Calculate final score
      const finalScore = this.calculateFinalScore(baseScore, trustScore, isBoosted);

      return {
        baseScore,
        finalScore,
        trustScore,
        isBoosted,
      };
    } catch (error) {
      console.error(`Error preparing score for user ${userId}:`, error);
      return null;
    }
  }
}

/**
 * Spacing Algorithm for New Users
 * 
 * Rules:
 * - Maximum 1 new user every 3-5 swipes
 * - Exception: If more new users than normal users remain, show them more frequently
 * 
 * Example pattern: New > Normal > Normal > Normal > New > Normal > Normal
 */
export class NewUserSpacing {
  /**
   * Determine if a new user should be placed at current position
   * Returns true if we should insert a new user here
   */
  static shouldInsertNewUser(
    currentIndex: number,
    newUsersUsed: number,
    totalNewUsersAvailable: number,
    normalUsersRemaining: number
  ): boolean {
    // If more new users than normal users, show them more frequently
    if (totalNewUsersAvailable > 0 && normalUsersRemaining <= totalNewUsersAvailable) {
      return newUsersUsed < totalNewUsersAvailable;
    }

    // Standard spacing: 1 new user every 3-5 swipes
    // Using a pattern of 4 swipes between new users (middle ground)
    const spacingInterval = 4;
    return currentIndex > 0 && currentIndex % spacingInterval === 0;
  }

  /**
   * Build spaced array of new and normal users
   * Returns array of user IDs with proper spacing
   */
  static buildSpacedDeck(
    normalUserIds: string[],
    newUserIds: string[]
  ): string[] {
    const deck: string[] = [];
    let normalIndex = 0;
    let newIndex = 0;

    const maxNewUsersPerBatch = 3;
    const normalUsersPerBatch = 20 - maxNewUsersPerBatch; // 17 normal users

    // Ensure we have a balance
    const newUsersToUse = Math.min(newUserIds.length, maxNewUsersPerBatch);
    const normalUsersToUse = Math.min(normalUserIds.length, normalUsersPerBatch);

    // Build deck with spacing
    while (normalIndex < normalUsersToUse || newIndex < newUsersToUse) {
      // Decide if we should add a new user at this position
      if (
        this.shouldInsertNewUser(
          deck.length,
          newIndex,
          newUsersToUse,
          normalUsersToUse - normalIndex
        ) &&
        newIndex < newUsersToUse
      ) {
        deck.push(newUserIds[newIndex]);
        newIndex++;
      } else if (normalIndex < normalUsersToUse) {
        deck.push(normalUserIds[normalIndex]);
        normalIndex++;
      } else if (newIndex < newUsersToUse) {
        // If we've run out of normal users, fill with remaining new users
        deck.push(newUserIds[newIndex]);
        newIndex++;
      }
    }

    return deck;
  }

  /**
   * Validate spacing in a deck
   * Returns violations or empty array if valid
   */
  static validateSpacing(
    deck: string[],
    newUserIds: Set<string>
  ): {
    isValid: boolean;
    violations: string[];
  } {
    const violations: string[] = [];

    // Check for consecutive new users (should be max 1 every 3-5)
    let lastNewUserIndex = -999;

    for (let i = 0; i < deck.length; i++) {
      if (newUserIds.has(deck[i])) {
        if (i - lastNewUserIndex < 3) {
          violations.push(
            `New users too close together: index ${lastNewUserIndex} and ${i}`
          );
        }
        lastNewUserIndex = i;
      }
    }

    return {
      isValid: violations.length === 0,
      violations,
    };
  }
}

/**
 * Dealbreaker Filter Handler
 * 
 * When a dealbreaker filter is selected, those users are completely excluded
 * from the swipe deck regardless of any other scores
 */
export class DealBreakerFilter {
  /**
   * Check if user passes dealbreaker filters
   * This is a placeholder - implement actual logic based on your dealbreaker fields
   */
  static userPassesDealBreakerFilters(
    user: Partial<IUser>,
    filters: any
  ): boolean {
    // Example dealbreaker checks:
    // - If user wants kids and you don't (and you have dealbreaker selected)
    // - If smoking/drinking mismatch with dealbreaker
    // - If religion mismatch with dealbreaker
    // - Location dealbreaker
    // - Age dealbreaker

    // For now, return true (pass all filters)
    // This should be customized based on your dealbreaker requirements
    return true;
  }
}
