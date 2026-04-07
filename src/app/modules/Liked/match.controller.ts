/* eslint-disable @typescript-eslint/no-explicit-any */
import { Request, Response } from "express";
import Match from "./match.model";
import { catchAsync } from "../../utils/catchAsync";
import { sendResponse } from "../../utils/sendResponse";
import Subscription from "../subscription/subscription.model";
import { Plan } from "../subscription/subscription.interface";

const calculateAge = (birthdate: Date): number => {
  const diffMs = Date.now() - new Date(birthdate).getTime();
  const ageDate = new Date(diffMs);
  return Math.abs(ageDate.getUTCFullYear() - 1970);
};

// Get all matches where current user is included
export const getMatches = catchAsync(async (req: Request, res: Response) => {
  const userId = (req as any).user?.id;

  const matches = await Match.find({
    users: userId,
  })
    .populate("users", "name images location")
    .sort({ createdAt: -1 });

  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: "Matches fetched successfully",
    data: matches,
  });
});

// Get profiles I matched with (other side of each match)
export const getMyMatches = catchAsync(async (req: Request, res: Response) => {
  const currentUserId = (req as any).user?.id;

  const matches = await Match.find({
    users: currentUserId,
  }).populate("users", " firstName lastName images location birthdate");

  const matchedProfiles = matches.map((match: any) => {
    const otherUser = match.users.find(
      (user: any) => user._id.toString() !== currentUserId.toString()
    );

    return {
      _id: otherUser?._id,
      firstName: otherUser?.firstName,
      lastName: otherUser?.lastName,
      images: otherUser?.images,
      location: otherUser?.location,
      age: otherUser?.birthdate ? calculateAge(otherUser.birthdate) : null,
      status: "matched",
      matchType: match.matchType,
    };
  });
  // -------------------------------------------------------------
      // Subscription Check: Unlimited likes for MULLI_X only
      // -------------------------------------------------------------


  const userIds = matchedProfiles.map((p: any) => p._id).filter(Boolean);
  const activeSubs = await Subscription.find({
    userId: { $in: userIds },
    status: "ACTIVE",
    plan_type: Plan.MULLI_X
  }).select("userId");

  const privilegedUserIds = new Set(activeSubs.map(s => s.userId.toString()));

  matchedProfiles.forEach((p: any) => {
    p.hasMullix = p._id ? privilegedUserIds.has(p._id.toString()) : false;
  });

  matchedProfiles.sort((a: any, b: any) => {
    if (a.hasMullix && !b.hasMullix) return -1;
    if (!a.hasMullix && b.hasMullix) return 1;
    return 0;
  });
//finish
  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: "Matched profiles fetched successfully",
    data: matchedProfiles,
  });
});
