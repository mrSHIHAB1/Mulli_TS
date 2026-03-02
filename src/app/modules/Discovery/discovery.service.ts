
import User from "../user/user.model";
import { calculateAge } from "../../utils/calculateAge";

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
  const isPremium = true;

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
  }));

  return transformed;
};