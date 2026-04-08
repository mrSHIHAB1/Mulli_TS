
import User from "../user/user.model";
import { calculateAge } from "../../utils/calculateAge";
import { SubscriptionService } from "../subscription/subscription.service";
import { Plan } from "../subscription/subscription.interface";
import AppError from "../../errorHelpers/AppError";

interface Filters {
  // Basic
  gender?: string;
  minAge?: number;
  maxAge?: number;
  minDistance?: number;
  maxDistance?: number;

  // Premium
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
}

export const discoveryService = async (
  authUser: any,
  filters: Filters = {}
) => {
  if (!authUser?.id) throw new Error("Unauthorized");

  //  Get logged-in user
  const me = await User.findById(authUser.id);
  if (!me) throw new Error("User not found");

  if (!me.location?.coordinates?.length) return [];

  const today = new Date();

  //  Age Filter
  const ageFilter: any = {};
  if (filters.minAge || filters.maxAge) {
    ageFilter.birthdate = {};

    if (filters.minAge) {
      const maxBirth = new Date();
      maxBirth.setFullYear(today.getFullYear() - filters.minAge);
      ageFilter.birthdate.$lte = maxBirth;
    }

    if (filters.maxAge) {
      const minBirth = new Date();
      minBirth.setFullYear(today.getFullYear() - filters.maxAge);
      ageFilter.birthdate.$gte = minBirth;
    }
  }

  //  Base Query
  const query: any = {
    _id: { $ne: me._id },
    isProfileComplete: true,
    isDeleted: false,
    isblocked: false,
    ...ageFilter,
  };

  //  Gender Logic
  const genderToShow = filters.gender ?? me.genderPreference ?? "ALL";
  if (genderToShow && genderToShow !== "ALL") {
    query.gender = genderToShow;
  }

  //  Distance Setup
  const geoNear: any = {
    near: { type: "Point", coordinates: me.location.coordinates },
    distanceField: "distance",
    spherical: true,
  };

  if (filters.minDistance)
    geoNear.minDistance = filters.minDistance * 1000;

  if (filters.maxDistance)
    geoNear.maxDistance = filters.maxDistance * 1000;

  // PREMIUM check
  const mySubscription = await SubscriptionService.getMySubscription(authUser.id);
  const isPremium = mySubscription && [Plan.MULLI_PLUS, Plan.MULLI_X].includes(mySubscription.plan_type as Plan);

  const hasPremiumFilters = filters.minPhotos !== undefined ||
    filters.hasBio !== undefined ||
    filters.minHeight !== undefined ||
    filters.maxHeight !== undefined ||
    filters.ethnicity !== undefined ||
    filters.politics !== undefined ||
    filters.religion !== undefined ||
    filters.openTo !== undefined ||
    (filters.interests && filters.interests.length > 0) ||
    (filters.languages && filters.languages.length > 0);

  if (hasPremiumFilters && !isPremium) {
    throw new AppError(403, "Please upgrade to Mulli Plus or Mulli X to use these filters.");
  }

  if (isPremium) {
    // Min Photos
    if (filters.minPhotos) {
  query.$expr = {
    $gte: [
      { $size: { $ifNull: ["$images", []] } },
      filters.minPhotos,
    ],
  };
}

    //  Has Bio
    if (filters.hasBio === true) {
      query.bio = { $exists: true, $ne: "" };
    }

    // Height Range
    if (filters.minHeight || filters.maxHeight) {
      query.height = {};
      if (filters.minHeight) query.height.$gte = filters.minHeight;
      if (filters.maxHeight) query.height.$lte = filters.maxHeight;
    }

    // Simple Match Fields
    if (filters.ethnicity) query.ethnicity = filters.ethnicity;
    if (filters.politics) query.politics = filters.politics;
    if (filters.religion) query.religion = filters.religion;
    if (filters.openTo) query.openTo = filters.openTo;

    // Array Match
    if (filters.interests?.length) {
      query.interests = { $in: filters.interests };
    }

    if (filters.languages?.length) {
      query.languages = { $in: filters.languages };
    }
  }

  // Aggregation Pipeline
  const pipeline: any[] = [
    { $geoNear: geoNear },
    { $match: query },
    {
      $addFields: {
        distanceKm: {
          $round: [{ $divide: ["$distance", 1000] }, 1],
        },
      },
    },
    // Subscription ranking for feed priority
    {
      $lookup: {
        from: "subscriptions",
        localField: "_id",
        foreignField: "userId",
        pipeline: [
          { $match: { status: "ACTIVE" } },
          { $sort: { createdAt: -1 } },
          { $limit: 1 },
          { $project: { plan_type: 1 } }
        ],
        as: "activeSubscription"
      }
    },
    {
      $addFields: {
        subscriptionPlan: { $arrayElemAt: ["$activeSubscription.plan_type", 0] }
      }
    },
    {
      $addFields: {
        subscriptionRank: {
          $switch: {
            branches: [
              { case: { $eq: ["$subscriptionPlan", Plan.MULLI_X] }, then: 5 },
              { case: { $eq: ["$subscriptionPlan", Plan.MULLI_PLUS] }, then: 4 },
              { case: { $eq: ["$subscriptionPlan", Plan.MULLI_ACE] }, then: 3 },
              { case: { $eq: ["$subscriptionPlan", Plan.MULLI_BRIDIE] }, then: 2 },
              { case: { $eq: ["$subscriptionPlan", Plan.MULLI_TRIAL] }, then: 1 }
            ],
            default: 0
          }
        }
      }
    },
    {
      $sort: { subscriptionRank: -1, distanceKm: 1 }
    },
    { $limit: 50 },
    {
      $project: {
        password: 0,
        email: 0,
        phone: 0,
        auth_providers: 0,
        __v: 0,
        createdAt: 0,
        updatedAt: 0,
        activeSubscription: 0,
      },
    },
  ];

  const users = await User.aggregate(pipeline);

  // Transform Response
  const transformed = users.map((u: any) => ({
    id: u._id,
    firstName: u.firstName,
    lastName: u.lastName,
    age: calculateAge(u.birthdate),
    distanceKm: u.distanceKm,
    profileImage: u.profileImage,
    images: u.images,
    skillLevel: u.skillLevel,
    hopingToFind: u.hopingToFind,
    gender: u.gender,
    playstyle: u.playstyle,
    height: u.height,
    religion: u.religion,
    handicaprange: u.handicaprange, 
    tcp:"N/A",
    hasMullix: u.subscriptionPlan === Plan.MULLI_X,
    subscriptionType: u.subscriptionPlan || "NONE"
  }));

  return transformed;
};