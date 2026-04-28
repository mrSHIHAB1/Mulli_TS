/**
 * Bucket Categorization Service
 * 
 * Categorizes users into 3 buckets based on their base scores:
 * - Bucket A: Top 30% (highest base scores)
 * - Bucket B: Middle 40%
 * - Bucket C: Bottom 30%
 * 
 * Base Score calculation:
 * - Buddy Mode: (BCS × 0.7) + (BDS × 0.3)
 * - Dating Mode: (DCS × 0.4) + (DDS × 0.6)
 */

import User from "../user/user.model";
import DiscoveryScore from "./discovery-score.model";
import { IUser } from "../user/user.interface";

export type BucketType = "A" | "B" | "C";
export type ModeType = "buddy" | "date";

interface BucketThresholds {
  aMin: number;
  bMin: number;
  cMin: number;
}

interface UserBucketAssignment {
  userId: string;
  baseScore: number;
  bucket: BucketType;
}

export class BucketCategorization {
  /**
   * Note: Base scores are calculated in scoring.service.ts and stored in DiscoveryScore model
   * These methods are deprecated - baseScore is already available in DiscoveryScore documents
   */

  /**
   * Get bucket thresholds based on scores
   * Bucket A: 70-100 (top 30%)
   * Bucket B: 40-69 (middle 40%)
   * Bucket C: 0-39 (bottom 30%)
   */
  static getBucketThresholds(): BucketThresholds {
    return {
      aMin: 70,
      bMin: 40,
      cMin: 0,
    };
  }

  /**
   * Assign bucket based on base score
   */
  static assignBucket(baseScore: number): BucketType {
    const thresholds = this.getBucketThresholds();

    if (baseScore >= thresholds.aMin) return "A";
    if (baseScore >= thresholds.bMin) return "B";
    return "C";
  }

  /**
   * Calculate and update all user buckets for a specific mode
   * This should be run periodically (e.g., daily) to recalculate buckets
   */
  static async recategorizeAllUsers(mode: ModeType = "buddy"): Promise<void> {
    try {
      // Get all discovery scores for this mode
      const scores = await DiscoveryScore.find({ mode }).sort({ baseScore: -1 });

      const bucketAssignments: UserBucketAssignment[] = [];

      // Collect all with their base scores
      for (const score of scores) {
        bucketAssignments.push({
          userId: score.userId.toString(),
          baseScore: score.baseScore,
          bucket: this.assignBucket(score.baseScore),
        });
      }

      // Calculate percentile-based thresholds
      const totalUsers = bucketAssignments.length;
      const aCount = Math.ceil(totalUsers * 0.3); // Top 30%
      const bCount = Math.ceil(totalUsers * 0.4); // Middle 40%
      // cCount = remaining (30%)

      // Update buckets based on percentiles
      const updates: Promise<void>[] = [];

      for (let i = 0; i < bucketAssignments.length; i++) {
        let bucket: BucketType;

        if (i < aCount) {
          bucket = "A";
        } else if (i < aCount + bCount) {
          bucket = "B";
        } else {
          bucket = "C";
        }

        updates.push(
          DiscoveryScore.findOneAndUpdate(
            { userId: bucketAssignments[i].userId, mode },
            {
              bucket,
              bucketCalculatedAt: new Date(),
              lastUpdatedAt: new Date(),
            }
          )
            .then(() => {})
            .catch((error) => console.error(`Error updating bucket for user ${bucketAssignments[i].userId}:`, error))
        );
      }

      await Promise.all(updates);
      console.log(
        `Successfully recategorized ${totalUsers} users for ${mode} mode. A: ${aCount}, B: ${bCount}, C: ${totalUsers - aCount - bCount}`
      );
    } catch (error) {
      console.error("Error recategorizing users:", error);
    }
  }

  /**
   * Get bucket distribution for a batch
   * Bucket A: 50% (10 out of 20)
   * Bucket B: 30% (6 out of 20)
   * Bucket C: 20% (4 out of 20)
   */
  static getBucketDistribution(batchSize: number = 20): {
    A: number;
    B: number;
    C: number;
  } {
    return {
      A: Math.ceil(batchSize * 0.5), // 50%
      B: Math.ceil(batchSize * 0.3), // 30%
      C: Math.ceil(batchSize * 0.2), // 20%
    };
  }

  /**
   * Get users by bucket for a specific mode
   * Returns User objects with their associated score data
   */
  static async getUsersByBucket(
    bucket: BucketType,
    mode: ModeType,
    excludeUserIds: string[] = [],
    limit?: number
  ): Promise<any[]> {
    try {
      const scores = await DiscoveryScore.find({
        mode,
        bucket,
        userId: { $nin: excludeUserIds.map((id) => id) },
      })
        .sort({ finalScore: -1 })
        .limit(limit || 0)
        .populate("userId", "-password -auth_providers -email -phone");

      // Return User objects with score data attached
      return scores
        .filter((score) => score.userId) // Ensure userId is populated
        .map((score) => {
          const userObj = (score.userId as any).toObject ? (score.userId as any).toObject() : score.userId;
          return {
            ...userObj,
            // Attach score data
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
      console.error(`Error fetching users for bucket ${bucket}:`, error);
      return [];
    }
  }

  /**
   * Verify and fix bucket assignments (maintenance function)
   */
  static async verifyAndFixBuckets(mode: ModeType = "buddy"): Promise<{
    processed: number;
    fixed: number;
  }> {
    try {
      // Sort descending so index-based percentile assignment matches recategorizeAllUsers
      const scores = await DiscoveryScore.find({ mode }).sort({ baseScore: -1 });
      const total = scores.length;
      const aCount = Math.ceil(total * 0.3);
      const bCount = Math.ceil(total * 0.4);

      let processed = 0;
      let fixed = 0;

      for (let i = 0; i < scores.length; i++) {
        processed++;

        let correctBucket: BucketType;
        if (i < aCount) {
          correctBucket = "A";
        } else if (i < aCount + bCount) {
          correctBucket = "B";
        } else {
          correctBucket = "C";
        }

        if (scores[i].bucket !== correctBucket) {
          fixed++;
          await DiscoveryScore.findByIdAndUpdate(scores[i]._id, {
            bucket: correctBucket,
            lastUpdatedAt: new Date(),
          });
        }
      }

      return { processed, fixed };
    } catch (error) {
      console.error("Error verifying buckets:", error);
      return { processed: 0, fixed: 0 };
    }
  }
}

/**
 * Helper function to get bucket display name
 */
export function getBucketDisplayName(bucket: BucketType): string {
  const names: { [key in BucketType]: string } = {
    A: "Premium Profile (Top 30%)",
    B: "Popular Profile (Middle 40%)",
    C: "Standard Profile (Bottom 30%)",
  };
  return names[bucket];
}
