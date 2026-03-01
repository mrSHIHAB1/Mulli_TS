/* eslint-disable @typescript-eslint/no-explicit-any */
import { Request, Response, NextFunction } from "express";
import { Swipe } from "./swipe.model";
import Match from "../Liked/match.model";
import User from "../user/user.model";
import { catchAsync } from "../../utils/catchAsync";
import { sendResponse } from "../../utils/sendResponse";

export const passUser = catchAsync(async (req: Request, res: Response) => {
  const fromUser = (req as any).user?.id;
  const { toUser } = req.body as { toUser: string };

  await Swipe.create({
    fromUser,
    toUser,
    action: "pass",
    expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
  });

  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: "User passed",
    data: null,
  });
});

export const likeUser = catchAsync(
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const fromUser = (req as any).user?.id;
      const { toUser } = req.body as { toUser: string };

      if (fromUser === toUser) {
        return sendResponse(res, {
          statusCode: 400,
          success: false,
          message: "Cannot like yourself",
          data: null,
        });
      }

      const existingSwipe = await Swipe.findOne({ fromUser, toUser });

      if (existingSwipe) {
        return sendResponse(res, {
          statusCode: 200,
          success: true,
          message: "Already liked",
          data: { match: false },
        });
      }

      await Swipe.create({
        fromUser,
        toUser,
        action: "like",
      });

      const reverseLike = await Swipe.findOne({
        fromUser: toUser,
        toUser: fromUser,
        action: "like",
      });

      if (reverseLike) {
        const existingMatch = await Match.findOne({
          users: { $all: [fromUser, toUser] },
        });

        if (!existingMatch) {
          await Match.create({
            users: [fromUser, toUser],
          });
        }

        return sendResponse(res, {
          statusCode: 200,
          success: true,
          message: "It's a match!",
          data: { match: true },
        });
      }

      sendResponse(res, {
        statusCode: 200,
        success: true,
        message: "Liked successfully",
        data: { match: false },
      });
    } catch (error) {
      next(error);
    }
  }
);

export const giftUser = catchAsync(async (req: Request, res: Response) => {
  const fromUser = (req as any).user?.id;
  const { toUser, coins } = req.body as { toUser: string; coins: number };

  await User.findByIdAndUpdate(fromUser, {
    $inc: { coins: -coins },
  });

  await Swipe.create({
    fromUser,
    toUser,
    action: "gift",
  });

  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: "Gift sent",
    data: null,
  });
});

export const getUsersWhoLikedMe = catchAsync(
  async (req: Request, res: Response) => {
    const myId = (req as any).user?.id;

    const swipes = await Swipe.find({
      toUser: myId,
      action: "like",
    }).populate("fromUser");

    const usersWhoLikedMe = swipes.map((swipe: any) => swipe.fromUser);

    sendResponse(res, {
      statusCode: 200,
      success: true,
      message: "Users who liked me fetched successfully",
      data: usersWhoLikedMe,
    });
  }
);

export const getUsersILiked = catchAsync(
  async (req: Request, res: Response) => {
    const myId = (req as any).user?.id;

    const swipes = await Swipe.find({
      fromUser: myId,
      action: "like",
    }).populate("toUser");

    const likedUsers = swipes.map((swipe: any) => swipe.toUser);

    sendResponse(res, {
      statusCode: 200,
      success: true,
      message: "Users I liked fetched successfully",
      data: likedUsers,
    });
  }
);

