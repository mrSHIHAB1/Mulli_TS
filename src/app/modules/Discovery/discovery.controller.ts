/* eslint-disable @typescript-eslint/no-explicit-any */
import { Request, Response } from "express";
import User from "../user/user.model";
import Swipe from "../Swipe/swipe.model";
import { catchAsync } from "../../utils/catchAsync";
import { sendResponse } from "../../utils/sendResponse";

const toNum = (v: any): number | undefined =>
  v === undefined || v === null || v === "" ? undefined : Number(v);

// Helper function to calculate age from birthdate
const calculateAge = (birthdate?: Date | string | null): number | null => {
  if (!birthdate) return null;
  const today = new Date();
  const birth = new Date(birthdate);
  let age = today.getFullYear() - birth.getFullYear();
  const monthDiff = today.getMonth() - birth.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) {
    age--;
  }
  return age;
};

export const getHomeProfiles = catchAsync(
  async (req: Request, res: Response) => {
    const userId = (req as any).user?.id;
    if (!userId) {
      return sendResponse(res, {
        statusCode: 401,
        success: false,
        message: "Unauthorized",
        data: null,
      });
    }

    // Query overrides (optional)
    const qGender = req.query.gender as string | undefined;
    const qMinAge = toNum(req.query.minAge);
    const qMaxAge = toNum(req.query.maxAge);
    const qDistance = toNum(req.query.distance); // km
    const qMinImages = toNum(req.query.minImages);
    const qReligion = req.query.religion as string | undefined;
    const qMinHeight = toNum(req.query.minHeight);
    const qMaxHeight = toNum(req.query.maxHeight);
    const qSkill = req.query.skillLevel as string | undefined;

    const qCountry = req.query.country as string | undefined;
    const qEthnicity = req.query.ethnicity as string | undefined;

    const me: any = await User.findById(userId);
    if (!me?.location?.coordinates?.length) {
      return sendResponse(res, {
        statusCode: 400,
        success: false,
        message: "Location required",
        data: null,
      });
    }

    const swipes = await Swipe.find({ fromUser: userId }).select("toUser");
    const excludedUsers = swipes.map((s: any) => s.toUser);

    const genderToShow = qGender ?? (me.genderPreference || "ALL");
    const distanceKm =
      qDistance ?? (me?.handicaprange?.maxRange ?? 50); // fallback 50km
    const skillToShow = qSkill ?? undefined;

    const today = new Date();
    const ageFilter: any = {};
    if (qMinAge || qMaxAge) {
      ageFilter.birthdate = {};
      if (qMinAge) {
        const maxBirthDate = new Date();
        maxBirthDate.setFullYear(today.getFullYear() - qMinAge);
        ageFilter.birthdate.$lte = maxBirthDate;
      }
      if (qMaxAge) {
        const minBirthDate = new Date();
        minBirthDate.setFullYear(today.getFullYear() - qMaxAge);
        ageFilter.birthdate.$gte = minBirthDate;
      }
    }

    const match: any = {
      _id: { $nin: [...excludedUsers, me._id] },
      isProfileComplete: true,
      ...ageFilter,
    };

    if (genderToShow && genderToShow !== "ALL") {
      match.gender = genderToShow;
    }

    if (me.gender) {
      match.$or = [
        { genderPreference: me.gender },
        { genderPreference: "ALL" },
      ];
    }

    if (qReligion) match.religion = qReligion;
    if (qEthnicity) match.ethnicity = qEthnicity;
    if (qCountry) match.country = qCountry;

    if (skillToShow) match.skillLevel = skillToShow;

    if (qMinHeight || qMaxHeight) {
      match.height = {};
      if (qMinHeight) match.height.$gte = qMinHeight;
      if (qMaxHeight) match.height.$lte = qMaxHeight;
    }

    const pipeline: any[] = [
      {
        $geoNear: {
          near: { type: "Point", coordinates: me.location.coordinates },
          distanceField: "distance",
          maxDistance: (distanceKm || 50) * 1000,
          spherical: true,
        },
      },
      {
        $addFields: {
          distanceKm: { $round: [{ $divide: ["$distance", 1000] }, 1] },
        },
      },
      { $match: match },
    ];

    if (qMinImages) {
      pipeline.push({
        $match: {
          $expr: { $gte: [{ $size: "$images" }, qMinImages] },
        },
      });
    }

    pipeline.push(
      { $limit: 20 },
      {
        $project: {
          email: 0,
          phone: 0,
          isPhoneVerified: 0,
          isEmailVerified: 0,
          role: 0,
          trackactivity: 0,
          enableFaceId: 0,
          createdAt: 0,
          updatedAt: 0,
          __v: 0,
        },
      }
    );

    const users = await User.aggregate(pipeline);

    const transformedUsers = users.map((user: any) => {
      const age = calculateAge(user.birthdate);

      return {
        id: user._id,
        firstName: user.firstName,
        lastName: user.lastName,
        age,
        distanceKm,
        images: user.images,
        verified: user.isProfileComplete === true,
      };
    });

    sendResponse(res, {
      statusCode: 200,
      success: true,
      message: "Discovery profiles loaded successfully",
      data: transformedUsers,
    });
  }
);

