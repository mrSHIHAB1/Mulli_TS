/* eslint-disable @typescript-eslint/no-explicit-any */
import { Request, Response, NextFunction } from "express";
import { Swipe } from "./swipe.model";
import Match from "../Liked/match.model";
import User from "../user/user.model";
import { catchAsync } from "../../utils/catchAsync";
import { sendResponse } from "../../utils/sendResponse";
import { IUser } from "../user/user.interface";
import { NotificationService } from "../notification/notification.service";
import { SubscriptionService } from "../subscription/subscription.service";
import { Plan } from "../subscription/subscription.interface";
import Subscription from "../subscription/subscription.model";

const calculateAge = (birthdate: Date): number => {
  const diffMs = Date.now() - new Date(birthdate).getTime();
  const ageDate = new Date(diffMs);
  return Math.abs(ageDate.getUTCFullYear() - 1970);
};

const getDistance = (
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number => {
  const R = 6371; // Earth's radius in km
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
    Math.cos((lat2 * Math.PI) / 180) *
    Math.sin(dLon / 2) *
    Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
};

const checkCompatibility = (userA: IUser, userB: IUser): boolean => {
  // Skill Level match
  if (userA.skillLevel !== userB.skillLevel) return false;

  // Religion match
  if (userA.religion !== userB.religion) return false;

  // Age match (+/- 5 years)
  if (!userA.birthdate || !userB.birthdate) return false;
  const ageA = calculateAge(userA.birthdate);
  const ageB = calculateAge(userB.birthdate);
  if (Math.abs(ageA - ageB) > 5) return false;

  // Playstyle match
  if (userA.playstyle !== userB.playstyle) return false;

  // Location range (30km)
  if (
    !userA.location?.coordinates ||
    !userB.location?.coordinates ||
    userA.location.coordinates.length < 2 ||
    userB.location.coordinates.length < 2
  ) {
    return false;
  }
  const [lon1, lat1] = userA.location.coordinates;
  const [lon2, lat2] = userB.location.coordinates;
  const distance = getDistance(lat1, lon1, lat2, lon2);
  if (distance > 30) return false;

  // Languages match (at least one in common)
  const commonLanguages = userA.languages?.filter((lang) =>
    userB.languages?.includes(lang)
  );
  if (!commonLanguages || commonLanguages.length === 0) return false;

  // Hoping to find match
  if (userA.hopingToFind !== userB.hopingToFind) return false;

  // Ethnicity match
  if (userA.ethnicity !== userB.ethnicity) return false;

  // Gender preferences match
  // User A must be what User B wants
  const userAIsWhatUserBWants =
    userB.genderPreference === "ALL" || userB.genderPreference === userA.gender;

  // User B must be what User A wants
  const userBIsWhatUserAWants =
    userA.genderPreference === "ALL" || userA.genderPreference === userB.gender;

  if (!userAIsWhatUserBWants || !userBIsWhatUserAWants) return false;

  return true;
};

export const passUser = catchAsync(async (req: Request, res: Response) => {
  const fromUser = (req as any).user?.id;
  const toUser = req.params.id;

  await Swipe.create({
    fromUser,
    toUser,
    action: "pass",
    status: "ignored",
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
      const toUser = req.params.id;

      if (fromUser === toUser) {
        return sendResponse(res, {
          statusCode: 400,
          success: false,
          message: "Cannot like yourself",
          data: null,
        });
      }

      // -------------------------------------------------------------
      // Subscription Check: Unlimited likes for ACE or EAGLE
      // -------------------------------------------------------------
      const mySubscription = await SubscriptionService.getMySubscription(fromUser);
      
      if (!mySubscription || ![Plan.ACE, Plan.EAGLE].includes(mySubscription.plan_type as Plan)) {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        
        const likesToday = await Swipe.countDocuments({
          fromUser,
          action: "like",
          createdAt: { $gte: today }
        });
        
        const DAILY_LIKE_LIMIT = 10;
        if (likesToday >= DAILY_LIKE_LIMIT) {
          return sendResponse(res, {
            statusCode: 403, // Or 402 Payment Required
            success: false,
            message: "Daily like limit reached. Upgrade to Ace or Eagle for unlimited likes!",
            data: null,
          });
        }
      }

      const existingSwipe = await Swipe.findOne({ fromUser, toUser, action: { $in: ["like", "superlike"] } });

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
        status: "pending",
      });

      const reverseLike = await Swipe.findOne({
        fromUser: toUser,
        toUser: fromUser,
        action: { $in: ["like", "superlike"] },
      });

      if (reverseLike) {
        // Update both swipes to matched
        await Swipe.updateMany(
          {
            $or: [
              { fromUser, toUser, action: "like" },
              { fromUser: toUser, toUser: fromUser, action: { $in: ["like", "superlike"] } },
            ],
          },
          { status: "matched" }
        );

        const [u1, u2] = [fromUser, toUser].sort();
        let matchData = await Match.findOne({ user1: u1, user2: u2 });

        if (!matchData) {
          matchData = await Match.create({
            users: [fromUser, toUser],
            user1: u1,
            user2: u2,
            matchType: "mutual_like",
          });
        }

        await NotificationService.notifyNewMatch(
          fromUser,
          toUser as string,
          matchData._id.toString()
        );

        return sendResponse(res, {
          statusCode: 200,
          success: true,
          message: "It's a match!",
          data: { match: true, matchData },
        });
      }

      // Start Automatic Matching Check
      const currentUser = await User.findById(fromUser);
      const targetUser = await User.findById(toUser);

      if (currentUser && targetUser) {
        const isCompatible = checkCompatibility(currentUser, targetUser);

        if (isCompatible) {
          // Update current swipe to matched
          await Swipe.updateOne(
            { fromUser, toUser, action: "like" },
            { status: "matched" }
          );

          const [u1, u2] = [fromUser, toUser].sort();
          let matchData = await Match.findOne({ user1: u1, user2: u2 });

          if (!matchData) {
            matchData = await Match.create({
              users: [fromUser, toUser],
              user1: u1,
              user2: u2,
              matchType: "profile_based",
            });
          }

          await NotificationService.notifyNewMatch(
            fromUser,
            toUser as string,
            matchData._id.toString()
          );

          return sendResponse(res, {
            statusCode: 200,
            success: true,
            message: "It's a profile based match!",
            data: { match: true, matchData },
          });
        }
      }
      // End Automatic Matching Check

      const senderName = currentUser
        ? `${currentUser.firstName || ""} ${currentUser.lastName || ""}`.trim()
        : "Someone";
      await NotificationService.notifyNewLike(toUser as string, fromUser, senderName);

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

export const superLikeUser = catchAsync(
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const fromUser = (req as any).user?.id;
      const toUser = req.params.id;

      if (fromUser === toUser) {
        return sendResponse(res, {
          statusCode: 400,
          success: false,
          message: "Cannot super like yourself",
          data: null,
        });
      }

      // -------------------------------------------------------------
      // Subscription Check: 1 free, Birdie 3, Eagle 10, Ace unlimited
      // -------------------------------------------------------------
      const user = await User.findById(fromUser);
      if (!user) {
        return sendResponse(res, { statusCode: 404, success: false, message: "User not found", data: null });
      }

      const mySubscription = await SubscriptionService.getMySubscription(fromUser);
      const plan = mySubscription ? (mySubscription.plan_type as Plan) : null;

      let superLikeLimit = 1;
      if (plan === Plan.BIRDIE) superLikeLimit = 3;
      if (plan === Plan.EAGLE) superLikeLimit = 10;
      if (plan === Plan.ACE) superLikeLimit = Infinity;

      const now = new Date();
      const lastReset = user.lastSuperLikeResetDate || new Date(0);
      
      const msIn30Days = 30 * 24 * 60 * 60 * 1000;
      const isNewBillingCycle = (now.getTime() - lastReset.getTime()) >= msIn30Days;

      if (isNewBillingCycle) {
        user.superLikesThisMonth = 0;
        user.lastSuperLikeResetDate = now;
      }

      if (plan !== Plan.ACE && (user.superLikesThisMonth || 0) >= superLikeLimit) {
        return sendResponse(res, {
          statusCode: 403,
          success: false,
          message: `You have reached your limit of ${superLikeLimit} super like(s) this month. Upgrade your plan for more!`,
          data: null,
        });
      }

      const existingSwipe = await Swipe.findOne({ fromUser, toUser, action: { $in: ["like", "superlike"] } });

      if (existingSwipe) {
        return sendResponse(res, {
          statusCode: 200,
          success: true,
          message: "Already liked or super liked",
          data: { match: false },
        });
      }

      await Swipe.create({
        fromUser,
        toUser,
        action: "superlike",
        status: "pending",
      });

      if (plan !== Plan.ACE) {
        user.superLikesThisMonth = (user.superLikesThisMonth || 0) + 1;
        await user.save();
      }

      const reverseLike = await Swipe.findOne({
        fromUser: toUser,
        toUser: fromUser,
        action: { $in: ["like", "superlike"] },
      });

      if (reverseLike) {
        // Update both swipes to matched
        await Swipe.updateMany(
          {
            $or: [
              { fromUser, toUser, action: "superlike" },
              { fromUser: toUser, toUser: fromUser, action: { $in: ["like", "superlike"] } },
            ],
          },
          { status: "matched" }
        );

        const [u1, u2] = [fromUser, toUser].sort();
        let matchData = await Match.findOne({ user1: u1, user2: u2 });

        if (!matchData) {
          matchData = await Match.create({
            users: [fromUser, toUser],
            user1: u1,
            user2: u2,
            matchType: "mutual_like",
          });
        }

        await NotificationService.notifyNewMatch(
          fromUser,
          toUser as string,
          matchData._id.toString()
        );

        return sendResponse(res, {
          statusCode: 200,
          success: true,
          message: "It's a match!",
          data: { match: true, matchData },
        });
      }

      // Start Automatic Matching Check
      const targetUser = await User.findById(toUser);

      if (user && targetUser) {
        const isCompatible = checkCompatibility(user, targetUser);

        if (isCompatible) {
          // Update current swipe to matched
          await Swipe.updateOne(
            { fromUser, toUser, action: "superlike" },
            { status: "matched" }
          );

          const [u1, u2] = [fromUser, toUser].sort();
          let matchData = await Match.findOne({ user1: u1, user2: u2 });

          if (!matchData) {
            matchData = await Match.create({
              users: [fromUser, toUser],
              user1: u1,
              user2: u2,
              matchType: "profile_based",
            });
          }

          await NotificationService.notifyNewMatch(
            fromUser,
            toUser as string,
            matchData._id.toString()
          );

          return sendResponse(res, {
            statusCode: 200,
            success: true,
            message: "It's a profile based match!",
            data: { match: true, matchData },
          });
        }
      }
      // End Automatic Matching Check

      const senderName = user
        ? `${user.firstName || ""} ${user.lastName || ""}`.trim()
        : "Someone";
      await NotificationService.notifyNewLike(toUser as string, fromUser, senderName);

      sendResponse(res, {
        statusCode: 200,
        success: true,
        message: "Super Liked successfully",
        data: { match: false },
      });
    } catch (error) {
      next(error);
    }
  }
);

// export const giftUser = catchAsync(async (req: Request, res: Response) => {
//   const fromUser = (req as any).user?.id;
//   const { toUser, coins } = req.body as { toUser: string; coins: number };

//   await User.findByIdAndUpdate(fromUser, {
//     $inc: { coins: -coins },
//   });

//   await Swipe.create({
//     fromUser,
//     toUser,
//     action: "gift",
//   });

//   sendResponse(res, {
//     statusCode: 200,
//     success: true,
//     message: "Gift sent",
//     data: null,
//   });
// });

export const getUsersWhoLikedMe = catchAsync(
  
  async (req: Request, res: Response) => {
    const myId = (req as any).user?.id;
// ----------------------------------------------------------
    // Check subscription: MUST have Mulli Plus or Mulli X
    // ----------------------------------------------------------
    const mySubscription = await SubscriptionService.getMySubscription(myId);
    console.log("My Subscription:", mySubscription);
    if (
      !mySubscription || 
      ![Plan.ACE, Plan.EAGLE].includes(mySubscription.plan_type as Plan)
    ) {
      return sendResponse(res, {
        statusCode: 403,
        success: false,
        message: "Upgrade to Ace or Eagle to see who liked you!",
        data: null,
      });
    }

    const swipes = await Swipe.find({
      toUser: myId,
      action: { $in: ["like", "superlike"] },
    }).populate("fromUser", "firstName lastName images birthdate");

    const usersWhoLikedMe = swipes.map((swipe: any) => {
      const user = swipe.fromUser;
      return {
        _id: user?._id,
        firstName: user?.firstName, 
        lastName: user?.lastName,
        images: user?.images,
        age: user?.birthdate ? calculateAge(user.birthdate) : null,
        status: swipe.status,
        action: swipe.action,
        isSuperLike: swipe.action === "superlike",
      };
    });
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
      action: { $in: ["like", "superlike"] },
    }).populate("toUser", "firstName lastName images birthdate");

    const likedUsers = swipes.map((swipe: any) => {
      const user = swipe.toUser;
      return {
        _id: user?._id,
        firstName: user?.firstName,
        lastName: user?.lastName,
        images: user?.images,
        age: user?.birthdate ? calculateAge(user.birthdate) : null,
        status: swipe.status,
        action: swipe.action,
        isSuperLike: swipe.action === "superlike",
      };
    });

    sendResponse(res, {
      statusCode: 200,
      success: true,
      message: "Users I liked fetched successfully",
      data: likedUsers,
    });
  }
);

