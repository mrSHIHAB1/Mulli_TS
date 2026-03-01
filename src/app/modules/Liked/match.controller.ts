/* eslint-disable @typescript-eslint/no-explicit-any */
import { Request, Response } from "express";
import Match from "./match.model";
import { catchAsync } from "../../utils/catchAsync";
import { sendResponse } from "../../utils/sendResponse";

// Get all matches where current user is included
export const getMatches = catchAsync(async (req: Request, res: Response) => {
  const userId = (req as any).user?.id;

  const matches = await Match.find({
    users: userId,
  })
    .populate("users", "name profileImage age location")
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
  }).populate("users");

  const matchedProfiles = matches.map((match: any) =>
    match.users.find(
      (user: any) => user._id.toString() !== currentUserId.toString()
    )
  );

  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: "Matched profiles fetched successfully",
    data: matchedProfiles,
  });
});

