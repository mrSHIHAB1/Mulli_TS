
import User from "../user/user.model";
import Swipe from "../Swipe/swipe.model";
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
  filters: Filters = {},
  page: number = 1
) => {
  if (!authUser?.id) throw new Error("Unauthorized");

  //  Get logged-in user
  const me = await User.findById(authUser.id);
  if (!me) throw new Error("User not found");

  if (!me.location?.coordinates?.length) return { users: [], pagination: { total: 0, currentPage: 1, perPage: 20, totalPages: 0 } };

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

  // Get swiped user IDs to exclude them from the feed
  const swipedUserIds = await Swipe.find({ fromUser: authUser.id }).distinct("toUser");
  
  // Combine swiped IDs and blocked IDs for exclusion
  const excludedIds = [...swipedUserIds, ...(me.blockedUsers || [])];

  //  Base Query
  const query: any = {
    _id: { $ne: me._id, $nin: excludedIds },
    blockedUsers: { $ne: me._id }, // Don't show users who have blocked me
    isProfileComplete: true,
    isDeleted: false,
    isblocked: false,
    isIncognito: { $ne: true },
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
  const plan = mySubscription?.plan_type as Plan;

  const isAceOrEagle = mySubscription && [Plan.ACE, Plan.EAGLE].includes(plan);
  const isBirdie = mySubscription && plan === Plan.BIRDIE;
  const isPremium = isAceOrEagle || isBirdie;

  // Filters Birdie can use
  const hasBirdieFilters = filters.hasBio !== undefined || filters.minHeight !== undefined;

  // Filters ONLY Ace/Eagle can use
  const hasTopTierFilters = filters.minPhotos !== undefined ||
    filters.maxHeight !== undefined ||
    filters.ethnicity !== undefined ||
    filters.politics !== undefined ||
    filters.religion !== undefined ||
    filters.openTo !== undefined ||
    (filters.interests && filters.interests.length > 0) ||
    (filters.languages && filters.languages.length > 0);

  if (hasTopTierFilters && !isAceOrEagle) {
    throw new AppError(403, "Please upgrade to Ace or Eagle to use these advanced filters.");
  }

  if (hasBirdieFilters && !isPremium) {
    throw new AppError(403, "Please upgrade to Birdie, Ace or Eagle to use these filters.");
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
  const perPage = 20;
  const skip = (page - 1) * perPage;

  const basePipeline: any[] = [
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
              { case: { $eq: ["$subscriptionPlan", Plan.ACE] }, then: 10 },
              {
                case: {
                  $and: [
                    { $eq: ["$subscriptionPlan", Plan.EAGLE] },
                    { $gt: ["$boostedUntil", today] }
                  ]
                },
                then: 9
              },
              {
                case: {
                  $and: [
                    { $eq: ["$subscriptionPlan", Plan.BIRDIE] },
                    { $gt: ["$boostedUntil", today] }
                  ]
                },
                then: 8
              }
            ],
            default: 0
          }
        }
      }
    },
    {
      $sort: { subscriptionRank: -1, distanceKm: 1 }
    }
  ];

  // Faceted aggregation for count and paginated results
  const pipeline: any[] = [
    ...basePipeline,
    {
      $facet: {
        metadata: [
          { $count: "total" }
        ],
        data: [
          { $skip: skip },
          { $limit: perPage },
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
        ]
      }
    }
  ];

  const result = await User.aggregate(pipeline);
  const total = result[0]?.metadata[0]?.total || 0;
  const users = result[0]?.data || [];

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
    hasMullix: u.subscriptionPlan === Plan.ACE || u.subscriptionPlan === Plan.EAGLE,
    subscriptionType: u.subscriptionPlan || "NONE"
  }));

  return {
    users: transformed,
    pagination: {
      total,
      currentPage: page,
      perPage,
      totalPages: Math.ceil(total / perPage)
    }
  };
};