/**
 * Swipe Deck Generation Service
 * 
 * Orchestrates the complete ranking and deck building process:
 * 1. Applies dealbreaker filters
 * 2. Categorizes users by bucket
 * 3. Applies score modifiers (trust, boost)
 * 4. Creates balanced batches with proper distribution
 * 5. Handles new user spacing
 */

import User from "../user/user.model";
import Swipe from "../Swipe/swipe.model";
import DiscoveryScore from "./discovery-score.model";
import Subscription from "../subscription/subscription.model";
import { BucketCategorization, BucketType, ModeType } from "./bucket.service";
import {
  FinalScoreCalculator,
  NewUserBoost,
  NewUserSpacing,
  TrustScoreModifier,
  PaidBoostModifier,
  DealBreakerFilter,
} from "./ranking.utils";
import { IUser } from "../user/user.interface";
import { Plan, SubscriptionStatus } from "../subscription/subscription.interface";

interface UserWithScore {
  _id: string;
  firstName: string;
  lastName: string;
  age: number;
  profileImage: string;
  images: string[];
  gender: string;
  distanceKm: number;
  skillLevel: string;
  hopingToFind: string;
  playstyle: string;
  bucket: BucketType;
  baseScore: number;
  finalScore: number;
  isNewUser: boolean;
  trustScore: string;
  isBoosted: boolean;
  bio?: string;
  height?: number;
  ethnicity?: string;
  politics?: string;
  religion?: string;
  interests?: string[];
  languages?: string[];
  openTo?: string;
  subscriptionType?: string; // User's subscription tier (for visibility filtering)
}

interface SwipeDeck {
  users: UserWithScore[];
  pagination: {
    total: number;
    currentPage: number;
    perPage: number;
    totalPages: number;
  };
  metadata: {
    bucketDistribution: { A: number; B: number; C: number };
    newUsersIncluded: number;
    averageScore: number;
  };
}

export class SwipeDeckService {
  static readonly BATCH_SIZE = 20;
  static readonly BUCKET_DISTRIBUTION = { A: 0.5, B: 0.3, C: 0.2 };

  /**
   * Generate a complete swipe deck for a user
   * 
   * Process:
   * 1. Get all eligible users (excluding swiped, blocked, filtered)
   * 2. Apply dealbreaker filters
   * 3. Separate new users and normal users
   * 4. Get users from each bucket
   * 5. Apply score modifiers
   * 6. Build balanced batches
   * 7. Apply new user spacing
   */
  static async generateSwipeDeck(
    authUserId: string,
    mode: ModeType = "buddy",
    filters: any = {},
    page: number = 1
  ): Promise<SwipeDeck> {
    try {
      const authUser = await User.findById(authUserId);
      if (!authUser) {
        throw new Error("User not found");
      }

      // Get excluded user IDs (already swiped, blocked)
      const swipedUserIds = await Swipe.find({
        fromUser: authUserId,
      }).distinct("toUser");
      const excludedIds = [...swipedUserIds, ...(authUser.blockedUsers || [])];
      const excludedIdStrings = excludedIds.map((id) => id.toString());

      console.log(`[Discovery Debug] Mode: ${mode}, Excluded: ${excludedIdStrings.length}`);

      // Check DiscoveryScore counts
      const totalScores = await DiscoveryScore.countDocuments({ mode });
      const aCount = await DiscoveryScore.countDocuments({ mode, bucket: "A" });
      const bCount = await DiscoveryScore.countDocuments({ mode, bucket: "B" });
      const cCount = await DiscoveryScore.countDocuments({ mode, bucket: "C" });

      console.log(
        `[Discovery Debug] DiscoveryScore counts - Total: ${totalScores}, A: ${aCount}, B: ${bCount}, C: ${cCount}`
      );

      // Base query for eligible users
      const baseQuery: any = {
        _id: { $ne: authUserId, $nin: excludedIds },
        blockedUsers: { $ne: authUserId },
        isProfileComplete: true,
        isDeleted: false,
        isblocked: false,
        isIncognito: { $ne: true },
      };

      // Apply basic filters
      if (filters.gender && filters.gender !== "ALL") {
        baseQuery.gender = filters.gender;
      }

      // Get users from each bucket (request extra to account for filtering)
      const bucketA = await BucketCategorization.getUsersByBucket(
        "A",
        mode,
        excludedIdStrings,
        100 // Request 100 to have buffer after filters
      );
      const bucketB = await BucketCategorization.getUsersByBucket(
        "B",
        mode,
        excludedIdStrings,
        100
      );
      const bucketC = await BucketCategorization.getUsersByBucket(
        "C",
        mode,
        excludedIdStrings,
        100
      );

      console.log(
        `[Discovery Debug] Users from buckets - A: ${bucketA.length}, B: ${bucketB.length}, C: ${bucketC.length}`
      );

      // Get new users
      const newUsers = await NewUserBoost.getAvailableNewUsers(
        authUserId,
        excludedIdStrings,
        5
      );

      console.log(`[Discovery Debug] New users available: ${newUsers.length}`);

      // Process and separate users
      const processedBucketA = await this.processAndScoreUsers(
        bucketA,
        authUser,
        "A",
        mode,
        newUsers
      );
      const processedBucketB = await this.processAndScoreUsers(
        bucketB,
        authUser,
        "B",
        mode,
        newUsers
      );
      const processedBucketC = await this.processAndScoreUsers(
        bucketC,
        authUser,
        "C",
        mode,
        newUsers
      );

      console.log(
        `[Discovery Debug] Processed users - A: ${processedBucketA.length}, B: ${processedBucketB.length}, C: ${processedBucketC.length}`
      );

      // Apply filters to all processed users
      const filteredA = this.applyFilters(processedBucketA, filters, authUser);
      const filteredB = this.applyFilters(processedBucketB, filters, authUser);
      const filteredC = this.applyFilters(processedBucketC, filters, authUser);

      console.log(
        `[Discovery Debug] After filters - A: ${filteredA.length}, B: ${filteredB.length}, C: ${filteredC.length}`
      );

      // Separate normal and new users
      const normalUsersByBucket = {
        A: filteredA.filter((u) => !u.isNewUser),
        B: filteredB.filter((u) => !u.isNewUser),
        C: filteredC.filter((u) => !u.isNewUser),
      };

      const newUsersInBatches = [
        ...filteredA.filter((u) => u.isNewUser),
        ...filteredB.filter((u) => u.isNewUser),
        ...filteredC.filter((u) => u.isNewUser),
      ].sort((a, b) => b.finalScore - a.finalScore);

      console.log(
        `[Discovery Debug] Normal users - A: ${normalUsersByBucket.A.length}, B: ${normalUsersByBucket.B.length}, C: ${normalUsersByBucket.C.length}`
      );
      console.log(`[Discovery Debug] New users in batches: ${newUsersInBatches.length}`);

      // Build batch with proper distribution
      const batch = this.buildBalancedBatch(
        normalUsersByBucket,
        newUsersInBatches
      );

      console.log(`[Discovery Debug] Final batch size: ${batch.length}`);

      // Handle pagination
      const skip = (page - 1) * this.BATCH_SIZE;
      const paginatedBatch = batch.slice(skip, skip + this.BATCH_SIZE);

      console.log(`[Discovery Debug] Paginated batch (page ${page}): ${paginatedBatch.length} users`);

      // Calculate metadata
      const bucketCounts = {
        A: paginatedBatch.filter((u) => u.bucket === "A").length,
        B: paginatedBatch.filter((u) => u.bucket === "B").length,
        C: paginatedBatch.filter((u) => u.bucket === "C").length,
      };

      const newUserCount = paginatedBatch.filter((u) => u.isNewUser).length;
      const averageScore = Math.round(
        paginatedBatch.reduce((sum, u) => sum + u.finalScore, 0) /
          paginatedBatch.length
      );

      return {
        users: paginatedBatch,
        pagination: {
          total: batch.length,
          currentPage: page,
          perPage: this.BATCH_SIZE,
          totalPages: Math.ceil(batch.length / this.BATCH_SIZE),
        },
        metadata: {
          bucketDistribution: bucketCounts,
          newUsersIncluded: newUserCount,
          averageScore,
        },
      };
    } catch (error) {
      console.error("Error generating swipe deck:", error);
      throw error;
    }
  }

  /**
   * Process users: calculate scores, apply modifiers, add metadata
   */
  private static async processAndScoreUsers(
    users: any[],
    authUser: Partial<IUser>,
    bucket: BucketType,
    mode: ModeType,
    newUsers: any[]
  ): Promise<UserWithScore[]> {
    const newUserIds = new Set(newUsers.map((u) => u._id.toString()));
    const processed: UserWithScore[] = [];
    let skipped = 0;

    // Bulk fetch subscriptions for all users at once (more efficient)
    const userIds = users.map((u) => u._id);
    const subscriptions = await Subscription.find({
      userId: { $in: userIds },
      status: SubscriptionStatus.ACTIVE,
    }).lean();

    const subscriptionMap = new Map<string, string>();
    subscriptions.forEach((sub) => {
      subscriptionMap.set(sub.userId.toString(), sub.plan_type);
    });

    for (const user of users) {
      try {
        // Validate required fields
        if (!user._id || !user.firstName || !user.lastName || !user.birthdate) {
          skipped++;
          continue;
        }

        const isNewUser = newUserIds.has(user._id.toString());

        // Get score data (already calculated and stored in DiscoveryScore)
        const scoreData = user._discoveryScore || {};
        const baseScore = scoreData.baseScore || 0;
        const trustScore = (scoreData.trustScore || "GREEN") as "RED" | "ORANGE" | "GREEN";
        const isBoosted = scoreData.isBoosted || false;

        // Calculate final score with modifiers
        const finalScore = FinalScoreCalculator.calculateFinalScore(
          baseScore,
          trustScore,
          isBoosted
        );

        // Calculate age
        const age = this.calculateAge(user.birthdate);

        // Calculate distance
        const distanceKm = this.calculateDistance(
          authUser.location?.coordinates || [0, 0],
          user.location?.coordinates || [0, 0]
        );

        // Get subscription tier
        const subscriptionType = subscriptionMap.get(user._id.toString()) || Plan.FREE;

        processed.push({
          _id: user._id.toString(),
          firstName: user.firstName,
          lastName: user.lastName,
          age,
          profileImage: user.profileImage,
          images: user.images || [],
          gender: user.gender,
          distanceKm,
          skillLevel: user.skillLevel,
          hopingToFind: user.hopingToFind,
          playstyle: user.playstyle,
          bucket,
          baseScore,
          finalScore,
          isNewUser,
          trustScore,
          isBoosted,
          // Filter-related fields
          bio: user.bio,
          height: user.height,
          ethnicity: user.ethnicity,
          politics: user.politics,
          religion: user.religion,
          interests: user.interests,
          languages: user.languages,
          openTo: user.openTo,
          subscriptionType,
        });
      } catch (error) {
        skipped++;
        console.error(`Error processing user ${user._id}: ${error}`);
      }
    }

    console.log(
      `[Discovery Debug] Processing ${bucket} bucket: ${users.length} input, ${processed.length} processed, ${skipped} skipped`
    );

    // Sort by final score descending
    return processed.sort((a, b) => b.finalScore - a.finalScore);
  }

  /**
   * Build balanced batch respecting bucket distribution
   * 50% Bucket A, 30% Bucket B, 20% Bucket C
   */
  private static buildBalancedBatch(
    normalUsersByBucket: { A: UserWithScore[]; B: UserWithScore[]; C: UserWithScore[] },
    newUsers: UserWithScore[]
  ): UserWithScore[] {
    const batch: UserWithScore[] = [];
    const distribution = BucketCategorization.getBucketDistribution(
      this.BATCH_SIZE
    );

    // Reserve spots for new users (max 3 per batch)
    const newUsersPerBatch = Math.min(3, newUsers.length);
    const normalUsersNeeded = this.BATCH_SIZE - newUsersPerBatch;

    // Calculate how many from each bucket (maintaining 50/30/20 ratio for normal users)
    const aCount = Math.ceil(normalUsersNeeded * 0.5);
    const bCount = Math.ceil(normalUsersNeeded * 0.3);
    const cCount = normalUsersNeeded - aCount - bCount;

    // Add users from each bucket in order of final score
    const usersA = normalUsersByBucket.A.slice(0, aCount);
    const usersB = normalUsersByBucket.B.slice(0, bCount);
    const usersC = normalUsersByBucket.C.slice(0, cCount);

    // Combine and sort by final score
    const normalUsers = [...usersA, ...usersB, ...usersC].sort(
      (a, b) => b.finalScore - a.finalScore
    );

    // Build deck with spacing
    const newUserIds = new Set(newUsers.map((u) => u._id));
    const spacedDeck = NewUserSpacing.buildSpacedDeck(
      normalUsers.map((u) => u._id),
      newUsers.map((u) => u._id)
    );

    // Map back to user objects
    const userMap = new Map<string, UserWithScore>();
    [...normalUsers, ...newUsers].forEach((u) => userMap.set(u._id, u));

    for (const userId of spacedDeck) {
      const user = userMap.get(userId);
      if (user) batch.push(user);
    }

    return batch;
  }

  /**
   * Calculate age from birthdate
   */
  private static calculateAge(birthdate: Date): number {
    const today = new Date();
    let age = today.getFullYear() - new Date(birthdate).getFullYear();
    const monthDiff = today.getMonth() - new Date(birthdate).getMonth();

    if (
      monthDiff < 0 ||
      (monthDiff === 0 && today.getDate() < new Date(birthdate).getDate())
    ) {
      age--;
    }

    return age;
  }

  /**
   * Calculate distance between coordinates
   */
  private static calculateDistance(
    coord1: [number, number],
    coord2: [number, number]
  ): number {
    const R = 6371;
    const lat1 = coord1[1];
    const lng1 = coord1[0];
    const lat2 = coord2[1];
    const lng2 = coord2[0];

    const dLat = ((lat2 - lat1) * Math.PI) / 180;
    const dLng = ((lng2 - lng1) * Math.PI) / 180;

    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos((lat1 * Math.PI) / 180) *
        Math.cos((lat2 * Math.PI) / 180) *
        Math.sin(dLng / 2) *
        Math.sin(dLng / 2);

    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return Math.round(R * c * 10) / 10;
  }

  /**
   * Apply user-specified filters to users
   */
  private static applyFilters(
    users: UserWithScore[],
    filters: any,
    authUser: Partial<IUser>
  ): UserWithScore[] {
    return users.filter((user) => {
      // Gender filter
      if (filters.gender && filters.gender !== "ALL" && user.gender !== filters.gender) {
        return false;
      }

      // Age filters
      if (filters.minAge && user.age < filters.minAge) {
        return false;
      }
      if (filters.maxAge && user.age > filters.maxAge) {
        return false;
      }

      // Distance filters
      if (filters.minDistance && user.distanceKm < filters.minDistance) {
        return false;
      }
      if (filters.maxDistance && user.distanceKm > filters.maxDistance) {
        return false;
      }

      // Skill level filter
      if (filters.skillLevel && user.skillLevel !== filters.skillLevel) {
        return false;
      }

      // Photos filter (from User document)
      if (filters.minPhotos && (!user.images || user.images.length < filters.minPhotos)) {
        return false;
      }

      // Has bio filter
      if (filters.hasBio && (!user.bio || user.bio.trim().length === 0)) {
        return false;
      }

      // Height filter
      if (filters.minHeight && (!user.height || user.height < filters.minHeight)) {
        return false;
      }
      if (filters.maxHeight && (!user.height || user.height > filters.maxHeight)) {
        return false;
      }

      // Ethnicity filter
      if (filters.ethnicity && user.ethnicity !== filters.ethnicity) {
        return false;
      }

      // Politics filter
      if (filters.politics && user.politics !== filters.politics) {
        return false;
      }

      // Religion filter
      if (filters.religion && user.religion !== filters.religion) {
        return false;
      }

      // Interests filter (match any)
      if (filters.interests && filters.interests.length > 0) {
        const userInterests = user.interests || [];
        const hasMatch = filters.interests.some((interest: string) =>
          userInterests.includes(interest)
        );
        if (!hasMatch) return false;
      }

      // Languages filter (match any)
      if (filters.languages && filters.languages.length > 0) {
        const userLanguages = user.languages || [];
        const hasMatch = filters.languages.some((lang: string) =>
          userLanguages.includes(lang)
        );
        if (!hasMatch) return false;
      }

      // Open to filter
      if (filters.openTo && user.openTo !== filters.openTo) {
        return false;
      }

      // Hoping to find filter
      if (filters.hopingToFind && user.hopingToFind !== filters.hopingToFind) {
        return false;
      }

      return true;
    });
  }
}
