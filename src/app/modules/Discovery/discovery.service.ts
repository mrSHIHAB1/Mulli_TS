
import User from "../user/user.model";
import Swipe from "../Swipe/swipe.model";
import DiscoveryScore from "./discovery-score.model";
import { calculateAge } from "../../utils/calculateAge";
import { SubscriptionService } from "../subscription/subscription.service";
import { Plan } from "../subscription/subscription.interface";
import AppError from "../../errorHelpers/AppError";
import { SwipeDeckService } from "./swiped-deck.service";
import { BucketCategorization } from "./bucket.service";
import { calculateAndUpdateUserScores } from "./scoring.service";

interface Filters {
  // Basic
  gender?: string;
  minAge?: number;
  maxAge?: number;
  minDistance?: number;
  maxDistance?: number;

  // PremiumFm
  minPhotos?: number;
  hasBio?: boolean;

  minHeight?: number;
  maxHeight?: number;

  ethnicity?: string;
  politics?: string;
  religion?: string;

  interests?: string[];
  openTo?: string;
  languages?: string[];
  hopingToFind?: string;
}

export const discoveryService = async (
  authUser: any,
  filters: Filters = {},
  page: number = 1
) => {
  if (!authUser?.id) throw new Error("Unauthorized");

  // Get logged-in user
  const me = await User.findById(authUser.id);
  if (!me) throw new Error("User not found");

  if (!me.location?.coordinates?.length) {
    return {
      users: [],
      pagination: { total: 0, currentPage: 1, perPage: 20, totalPages: 0 },
    };
  }

  // Determine mode from user's playstyle or default to buddy
  const mode = me.playstyle === "Golf_Date" ? "date" : "buddy";

  // PREMIUM check for filters
  const mySubscription = await SubscriptionService.getMySubscription(authUser.id);
  const plan = mySubscription?.plan_type as Plan;

  const isAceOrEagle =
    mySubscription && [Plan.ACE, Plan.EAGLE].includes(plan);
  const isBirdie = mySubscription && plan === Plan.BIRDIE;
  const isPremium = isAceOrEagle || isBirdie;

  // Filters Birdie can use
  const hasBirdieFilters =
    filters.hasBio !== undefined || filters.minHeight !== undefined;

  // Filters ONLY Ace/Eagle can use
  const hasTopTierFilters =
    filters.minPhotos !== undefined ||
    filters.maxHeight !== undefined ||
    filters.ethnicity !== undefined ||
    filters.politics !== undefined ||
    filters.religion !== undefined ||
    filters.openTo !== undefined ||
    filters.hopingToFind !== undefined ||
    (filters.interests && filters.interests.length > 0) ||
    (filters.languages && filters.languages.length > 0);

  if (hasTopTierFilters && !isAceOrEagle) {
    throw new AppError(
      403,
      "Please upgrade to Ace or Eagle to use these advanced filters."
    );
  }

  if (hasBirdieFilters && !isPremium) {
    throw new AppError(
      403,
      "Please upgrade to Birdie, Ace or Eagle to use these filters."
    );
  }

  // Ensure buckets are calculated for all users
  const latestBucketCalc = await DiscoveryScore.findOne({ mode })
    .sort({ bucketCalculatedAt: -1 })
    .select("bucketCalculatedAt");

  const bucketLastCalc = latestBucketCalc?.bucketCalculatedAt
    ? new Date(latestBucketCalc.bucketCalculatedAt)
    : new Date(0);
  const hoursSinceCalc = (Date.now() - bucketLastCalc.getTime()) / (1000 * 60 * 60);

  // Initialize scores if none exist for this mode
  const scoreCount = await DiscoveryScore.countDocuments({ mode });
  const totalEligibleUsers = await User.countDocuments({
    isProfileComplete: true,
    isDeleted: false,
    isblocked: false,
    "location.coordinates": { $exists: true, $ne: null },
  });

  console.log(
    `[Discovery] Mode: ${mode}, Eligible users: ${totalEligibleUsers}, DiscoveryScore records: ${scoreCount}`
  );

  // Initialize scores if missing or incomplete
  if (scoreCount === 0 || scoreCount < totalEligibleUsers) {
    console.log(
      `Initializing/updating discovery scores for ${mode} mode (${scoreCount}/${totalEligibleUsers})...`
    );
    const allUsers = await User.find({
      isProfileComplete: true,
      isDeleted: false,
      isblocked: false,
      "location.coordinates": { $exists: true, $ne: null },
    }).select("_id");

    const userIds = allUsers.map((u) => u._id.toString());
    await calculateAndUpdateUserScores(userIds, authUser.id);
    console.log(`Score initialization complete for ${mode} mode`);
  }

  // Recalculate buckets every 24 hours
  if (hoursSinceCalc > 24) {
    console.log(`Recalculating buckets for ${mode} mode...`);
    await BucketCategorization.recategorizeAllUsers(mode);
  }

  // Generate swipe deck using the new ranking system
  const deck = await SwipeDeckService.generateSwipeDeck(
    authUser.id,
    mode,
    filters,
    page
  );

  // Transform response to match expected format
  const transformed = deck.users.map((u) => ({
    id: u._id,
    firstName: u.firstName,
    lastName: u.lastName,
    age: u.age,
    distanceKm: u.distanceKm,
    profileImage: u.profileImage,
    images: u.images,
    skillLevel: u.skillLevel,
    hopingToFind: u.hopingToFind,
    gender: u.gender,
    playstyle: u.playstyle,
    height: u.height || 0,
    religion: u.religion || "",
    handicaprange: { minRange: 0, maxRange: 100 },
    tcp: u.baseScore.toString(),
    hasMullix: u.isBoosted,
    subscriptionType: u.subscriptionType || "FREE", // User's subscription tier
    // New ranking fields
    bucket: u.bucket,
    baseScore: u.baseScore,
    finalScore: u.finalScore,
    isNewUser: u.isNewUser,
    trustScore: u.trustScore,
    // Filter fields
    bio: u.bio,
    ethnicity: u.ethnicity,
    politics: u.politics,
    interests: u.interests,
    languages: u.languages,
    openTo: u.openTo,
  }));

  return {
    users: transformed,
    pagination: {
      total: deck.pagination.total,
      currentPage: deck.pagination.currentPage,
      perPage: deck.pagination.perPage,
      totalPages: deck.pagination.totalPages,
    },
    metadata: deck.metadata,
  };
};