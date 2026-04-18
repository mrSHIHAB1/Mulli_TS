/* eslint-disable @typescript-eslint/no-explicit-any */
import { Request, Response } from "express";
import Match from "./match.model";
import { catchAsync } from "../../utils/catchAsync";
import { sendResponse } from "../../utils/sendResponse";
import Subscription from "../subscription/subscription.model";
import { Swipe } from "../Swipe/swipe.model";
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

  const matchedProfiles = await Promise.all(matches.map(async (match: any) => {
    const otherUser = match.users.find(
      (user: any) => user._id.toString() !== currentUserId.toString()
    );

    const superLikeSwipe = await Swipe.findOne({
      $or: [
        { fromUser: currentUserId, toUser: otherUser?._id, action: "superlike" },
        { fromUser: otherUser?._id, toUser: currentUserId, action: "superlike" },
      ]
    });

    return {
      _id: otherUser?._id,
      firstName: otherUser?.firstName,
      lastName: otherUser?.lastName,
      images: otherUser?.images,
      location: otherUser?.location,
      age: otherUser?.birthdate ? calculateAge(otherUser.birthdate) : null,
      timestamp: match.createdAt,
      status: "matched",
      matchType: match.matchType,
      isSuperLike: !!superLikeSwipe,
    };
  }));

  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: "Matched profiles fetched successfully",
    data: matchedProfiles,
  });
});
