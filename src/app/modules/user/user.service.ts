/* eslint-disable @typescript-eslint/no-explicit-any */
import { User } from "./user.model";
import { Post, Comment } from "../Clubhouse/clubhouse.model";
import { generateOtp } from "../../utils/otp.util";
// import { sendOtpEmail } from "../../utils/email.util";
import { redisClient } from "../../config/redis.config";
import { createUserTokens } from "../../utils/userTokens";
import mongoose from "mongoose";
import { sendOTP } from "../../config/twillio.config";
import getPlaceNameGoogle from "../../utils/getGoogleLocation";
import { fileUploader } from "../../helpers/fileUpload";
import { SubscriptionService } from "../subscription/subscription.service";
import { Plan } from "../subscription/subscription.interface";
import { verifyAppleToken } from "../../utils/appleVerify";
import { get } from "node:http";
import { Swipe } from "../Swipe/swipe.model";
import { Match } from "../Liked/match.model";
import { sendOtpEmail } from "../../utils/email.util";
import { Role } from "./user.interface";


const OTP_EXPIRE = 5 * 60; // 3 minutes

// CREATE / COMPLETE USER PROFILE
const createUser = async (data: any): Promise<any> => {
  let filter: any = {};

  if (data.email) {
    const subUser = await User.findOne({ email: data.email });
    if (subUser?.isProfileComplete) {
      throw new Error("User is already registerd with this email");
    }
    if (!subUser || !subUser.isEmailVerified) {
      throw new Error("Email verification required");
    }
    filter = { email: data.email };
  } else if (data.phone) {
    const subUser = await User.findOne({ phone: data.phone });
    if (subUser?.isProfileComplete) {
      throw new Error("User is already registered with this phone");
    }
    if (!subUser || !subUser.isPhoneVerified) {
      throw new Error("Phone verification required");
    }
    filter = { phone: data.phone };
  } else {
    throw new Error("Email or phone is required");
  }

  const userData = await User.findOneAndUpdate(
    filter,
    { ...data, isProfileComplete: true },
    { returnDocument: 'after' }
  );

  if (!userData) {
    throw new Error("User not found for profile completion");
  }

  const tokens = createUserTokens(userData.toObject());

  return {
    ...userData.toObject(),
    accessToken: tokens.accessToken,
    refreshToken: tokens.refreshToken,
  };
};

// SIGNUP EMAIL OTP (no pre-existing user required)
const createSignUpEmailOtp = async (
  email: string
): Promise<string> => {
  const otp = generateOtp();

  await sendOtpEmail({ to: email, otp });
  // await sendOTPEmail(email, otp );
  await redisClient.setex(`otp:email:${email}`, OTP_EXPIRE, otp);
  return otp;
};

// GENERATE & SEND EMAIL OTP FOR EXISTING VERIFIED PROFILE
const createEmailOtp = async (email: string): Promise<string> => {
  const otp = generateOtp();
  const user = await User.findOne({ email });

  if (!user || !user.isEmailVerified || !user.isProfileComplete) {
    throw new Error("Create Your Account First");
  }

  // await sendOtpEmail({ to: email, otp });
  await redisClient.setex(`otp:email:${email}`, OTP_EXPIRE, otp);
  return otp;
};

interface OtpResult<T = any> {
  success: boolean;
  message: string;
  data?: T;
}

// VERIFY EMAIL OTP
const verifyEmailOtp = async (
  email: string,
  inputOtp: string
): Promise<OtpResult> => {
  try {
    const redisKey = `otp:email:${email}`;

    const storedOtp = await redisClient.get(redisKey);
    if (!storedOtp) {
      return { success: false, message: "OTP expired or not found" };
    }

    if (storedOtp !== inputOtp) {
      return { success: false, message: "Invalid OTP" };
    }

    // OTP valid → remove it
    await redisClient.del(redisKey);

    // 🔹 Find or create partial user
    let user = await User.findOne({ email });

    // Check if user already exists with complete profile → LOGIN
    if (user && user.isProfileComplete && user.isEmailVerified) {
      const tokens = createUserTokens(user.toObject());
      return {
        success: true,
        message: "Login successful",
        data: {
          user: {
            id: user._id,
            name: user.firstName || user.name,
            isProfileComplete: user.isProfileComplete,
          },
          accessToken: tokens.accessToken,
          refreshToken: tokens.refreshToken,
        },
      };
    }

    // Create new user if doesn't exist
    if (!user) {
      user = await User.create({
        email,
        isEmailVerified: true,
        isProfileComplete: false,
      });
    } else {
      // Update existing incomplete user
      user.isEmailVerified = true;
      await user.save();
    }

    return {
      success: true,
      message: "Email verified successfully",
      data: {
        userId: user._id,
        isEmailVerified: true,
        isProfileComplete: user.isProfileComplete,
        signupStep: (user as any).signupStep,
      },
    };
  } catch (error: any) {
    return {
      success: false,
      message: error.message || "Verification failed",
    };
  }
};

// GENERATE & SEND PHONE OTP
const createPhoneOtp = async (phoneNumber: string): Promise<{ message: string }> => {
  const otp = generateOtp();
  const otpKey = `otp:phone:${phoneNumber}`;

  await redisClient.setex(otpKey, OTP_EXPIRE, otp);
  const smsResult = await sendOTP(phoneNumber, otp);
  if (!smsResult.success) {
    throw new Error(smsResult.error || "Failed to send OTP");
  }

  return { message: "OTP sent successfully" };
};

// VERIFY PHONE OTP 
const verifyPhoneOtp = async (phone: string, inputOtp: string): Promise<OtpResult> => {
  const otpKey = `otp:phone:${phone}`;
  const storedOtp = await redisClient.get(otpKey);
  if (!storedOtp) return { success: false, message: "OTP expired or not found" };

  if (storedOtp !== inputOtp) return { success: false, message: "Invalid OTP" };

  await redisClient.del(otpKey);
  let user = await User.findOne({ phone });

  if (user && user.isProfileComplete && user.isPhoneVerified) {
    const tokens = createUserTokens(user.toObject());
    return {
      success: true,
      message: "Login successful",
      data: {
        user: {
          id: user._id,
          name: user.firstName || user.name,
          isProfileComplete: user.isProfileComplete,
        },
        accessToken: tokens.accessToken,
        refreshToken: tokens.refreshToken,
      },
    };
  }

  if (!user) {
    user = await User.create({ phone, isPhoneVerified: true, isProfileComplete: false });
  } else {
    user.isPhoneVerified = true;
    await user.save();
  }

  return {
    success: true,
    message: "Phone verified successfully",
    data: {
      userId: user._id,
      isPhoneVerified: true,
      isProfileComplete: user.isProfileComplete,
    },
  };
};

const updateFcmToken = async (userId: string, fcmToken: string): Promise<string[]> => {
  const user = await User.findByIdAndUpdate(
    userId,
    { $addToSet: { fcmTokens: fcmToken } },
    { new: true, select: "fcmTokens" }
  );

  return user?.fcmTokens || [];
};

const blockUserService = async (userId: string, blockedId: string) => {
  if (userId === blockedId) throw new Error("Cannot block yourself");

  const user = await User.findById(userId);
  if (!user) throw new Error("User not found");

  if (user.blockedUsers.includes(new mongoose.Types.ObjectId(blockedId))) {
    throw new Error("User already blocked");
  }

  user.blockedUsers.push(new mongoose.Types.ObjectId(blockedId));
  await user.save();
  return user;
};

// Unblock a user
const unblockUserService = async (userId: string, blockedId: string) => {
  const user = await User.findById(userId);
  if (!user) throw new Error("User not found");

  user.blockedUsers = user.blockedUsers.filter(
    (id) => id.toString() !== blockedId
  );
  await user.save();
  return user;
};

// Get blocked users list
const getBlockedUsersService = async (userId: string) => {
  const user = await User.findById(userId).populate(
    "blockedUsers",
    "firstName lastName profileImage"
  );
  if (!user) throw new Error("User not found");

  return user.blockedUsers;
};

// Check if a user is blocked
const isBlockedService = async (userId: string, otherUserId: string) => {
  const user = await User.findById(userId);
  if (!user) return false;

  return user.blockedUsers.some(
    (id) => id.toString() === otherUserId
  );
};

const updateUserProfileService = async (
  userId: string,
  bodyData: any,
  files?: Express.Multer.File[]
) => {
  const updateData: any = { ...bodyData };

  // Handle profile images
  if (files && files.length > 0) {
    const uploadResults = await Promise.all(
      files.map((f) => fileUploader.uploadToCloudinary(f))
    );
    const urls = uploadResults
      .map((r: any) => r?.secure_url)
      .filter(Boolean);
    updateData.images = urls;
    updateData.profileImage = urls[0]; // first image as profile
  }

  // Handle nested objects to avoid overwriting the entire field
  if (bodyData.vibe) {
    for (const [key, value] of Object.entries(bodyData.vibe)) {
      updateData[`vibe.${key}`] = value;
    }
    delete updateData.vibe;
  }

  if (bodyData.play) {
    for (const [key, value] of Object.entries(bodyData.play)) {
      updateData[`play.${key}`] = value;
    }
    delete updateData.play;
  }

  const updatedUser = await User.findByIdAndUpdate(
    new mongoose.Types.ObjectId(userId),
    { $set: updateData },
    { returnDocument: 'after' }
  );

  if (!updatedUser) {
    throw new Error("User not found");
  }

  return updatedUser;
};

const updateUserStatus = async (userId: string, isOnline: boolean) => {
  return await User.findByIdAndUpdate(
    userId,
    { isOnline },
   { returnDocument: 'after' }
  );
};
const deleteUserService = async (userId: string) => {
  const user = await User.findById(userId);
  if (!user) {
    throw new Error("User not found");
  }

  // Delete all posts authored by this user
  await Post.deleteMany({ author: userId });

  // Delete all comments made by this user
  await Comment.deleteMany({ user: userId });

  // Finally delete the user
  await User.findByIdAndDelete(userId);

  return { success: true, message: "User and their clubhouse data deleted successfully" };
};

const activateBoost = async (userId: string) => {
  const user = await User.findById(userId);
  if (!user) throw new Error("User not found");

  const mySubscription = await SubscriptionService.getMySubscription(userId);
  if (!mySubscription) throw new Error("Active subscription required to boost profile");

  const plan = mySubscription.plan_type as Plan;

  let boostLimit = 1;
  if (plan === Plan.EAGLE) {
    boostLimit = 3;
  } else if (plan === Plan.BIRDIE) {
    boostLimit = 10;
  } else if (plan === Plan.ACE) {
    throw new Error("Ace members are already prioritized at the top of the feed");
  } else {
    throw new Error("Boosting is not available for your current plan");
  }

  const now = new Date();

  // Reset monthly counter if it's a new month
  const lastReset = user.lastBoostResetDate || new Date(0);
  const isNewMonth =
    now.getMonth() !== lastReset.getMonth() ||
    now.getFullYear() !== lastReset.getFullYear();

  if (isNewMonth) {
    user.boostsUsedThisMonth = 0;
    user.lastBoostResetDate = now;
  }

  if ((user.boostsUsedThisMonth || 0) >= boostLimit) {
    throw new Error(`You have used your ${boostLimit} monthly boost(s).`);
  }

  // Activate boost for 30 minutes
  user.boostedUntil = new Date(now.getTime() + 30 * 60 * 1000);
  user.boostsUsedThisMonth = (user.boostsUsedThisMonth || 0) + 1;

  await user.save();
  return user;
};

const changeLocation = async (userId: string, data: { lat: number; lng: number; placeName?: string }) => {
  const user = await User.findById(userId);
  if (!user) throw new Error("User not found");

  const mySubscription = await SubscriptionService.getMySubscription(userId);

  const plan = mySubscription ? (mySubscription.plan_type as Plan) : null;

  let changeLimit = 0;
  if (plan === Plan.ACE) {
    changeLimit = Infinity;
  } else if (plan === Plan.EAGLE) {
    changeLimit = 5;
  } else if (plan === Plan.BIRDIE) {
    changeLimit = 1;
  } else {
    throw new Error("Changing location is restricted for free users. Please upgrade to Birdie, Eagle, or Ace plan.");
  }

  const now = new Date();

  const lastReset = user.lastLocationChangeResetDate || new Date(0);

  // Check if 30 days have passed since the last reset
  // Using 30 days accurately reflects a monthly billing cycle even if bought mid-month
  const msIn30Days = 30 * 24 * 60 * 60 * 1000;
  const isNewBillingCycle = (now.getTime() - lastReset.getTime()) >= msIn30Days;

  if (isNewBillingCycle) {
    user.locationChangesThisMonth = 0;
    // Set the reset date to today so they have another 30 days from now to use their fresh changes
    user.lastLocationChangeResetDate = now;
  }

  if (plan !== Plan.ACE && (user.locationChangesThisMonth || 0) >= changeLimit) {
    throw new Error(`You have used your ${changeLimit} monthly location change(s).`);
  }

  let name = data.placeName;
  if (!name) {
    name = await getPlaceNameGoogle(data.lat, data.lng);
  }

  user.location = {
    type: "Point",
    coordinates: [data.lng, data.lat],
    placeName: name,
  };

  if (plan !== Plan.ACE) {
    user.locationChangesThisMonth = (user.locationChangesThisMonth || 0) + 1;
  }

  await user.save();
  return user;
};

const updateProfileImagesService = async (
  userId: string,
  file: Express.Multer.File
): Promise<any> => {
  const result = await fileUploader.uploadToCloudinary(file);

  if (!result?.secure_url) {
    throw new Error("Image upload failed");
  }

  const updated = await User.findByIdAndUpdate(
    userId,
    { profileImage: result.secure_url },
    { returnDocument: 'after' }
  ).select("profileImage firstName lastName");

  return updated;
};

const getAllUsers = async (): Promise<any[]> => {
  const users = await User.find().select("-password");
  return users;
};

const toggleIncognitoMode = async (userId: string): Promise<any> => {
  const user = await User.findById(userId);
  if (!user) throw new Error("User not found");

  const mySubscription = await SubscriptionService.getMySubscription(userId);
  if (!mySubscription || mySubscription.plan_type !== Plan.ACE) {
    throw new Error("Incognito mode is only available for Ace subscribers");
  }

  user.isIncognito = !user.isIncognito;
  await user.save();
  return user;
};

export const appleLogin = async (identityToken: string) => {

  const appleUser: any = await verifyAppleToken(identityToken);
 

  const appleId = appleUser.sub;
  const email = appleUser.email;

  // 1. Try finding by appleId
  let user = await User.findOne({ appleId });

  // 2. If not found by appleId, try finding by email and link
  if (!user && email) {
    user = await User.findOne({ email });
    if (user) {
      user.appleId = appleId;
      user.isEmailVerified = true;
      await user.save();
    }
  }

  // 3. If still no user, create a new one
  if (!user) {
    user = await User.create({
      appleId,
      email,
      isEmailVerified: true,
      isProfileComplete: false,
    });
  }

  // ✅ CASE 1: Existing user + profile complete → LOGIN
  if (user && user.isProfileComplete) {
    const tokens = createUserTokens(user.toObject());

    return {
      success: true,
      message: "Login successful",
      data: {
        user: {
          id: user._id,
          name: user.firstName || user.name,
          isProfileComplete: user.isProfileComplete,
        },
        accessToken: tokens.accessToken,
        refreshToken: tokens.refreshToken,
      },
    };
  }

  // ✅ CASE 2: New/Incomplete user → prompt profile completion
  return {
    success: true,
    message: "Complete your profile",
    data: {
      userId: user._id,
      isEmailVerified: true,
      isProfileComplete: user.isProfileComplete,
    },
  };
};

const getUserById = async (userId: string): Promise<any> => {
  const user = await User.findById(userId)
  if (!user) throw new Error("User not found");
  return user;
}

const getUserProfileWithRelationship = async (currentUserId: string, targetUserId: string): Promise<any> => {
  // Get target user info
  const targetUser = await User.findById(targetUserId);
  if (!targetUser) throw new Error("User not found");

  // Check if there's a match
  const match = await Match.findOne({
    $or: [
      { user1: new mongoose.Types.ObjectId(currentUserId), user2: new mongoose.Types.ObjectId(targetUserId) },
      { user1: new mongoose.Types.ObjectId(targetUserId), user2: new mongoose.Types.ObjectId(currentUserId) }
    ]
  });

  // Check swipe history - did current user like target user
  const currentUserLike = await Swipe.findOne({
    fromUser: new mongoose.Types.ObjectId(currentUserId),
    toUser: new mongoose.Types.ObjectId(targetUserId)
  });

  // Check if target user liked current user
  const targetUserLike = await Swipe.findOne({
    fromUser: new mongoose.Types.ObjectId(targetUserId),
    toUser: new mongoose.Types.ObjectId(currentUserId)
  });

  // Check if current user blocked target user
  // const isBlocked = targetUser.blockedBy?.includes(new mongoose.Types.ObjectId(currentUserId));

  return {
    user: targetUser.toObject(),
    relationship: {
      // isBlocked: !!isBlocked,
      Status: match ? "MATCHED" : (currentUserLike || targetUserLike ? "PENDING" : "NONE")
    }
  };
}
export const adminLogin = async (email: string) => {
  const existingUser = await User.findOne({ email });

  if (!existingUser) {
    return {
      success: false,
      message: "User not found",
    };
  }

  if (existingUser.role !== Role.ADMIN) {
    return {
      success: false,
      message: "User is not admin",
    };
  }

  const otp = generateOtp();

  await sendOtpEmail({ to: email, otp });
  await redisClient.setex(`otp:email:${email}`, OTP_EXPIRE, otp);

  return {
    success: true,
    message: "OTP sent successfully",
    data: {otp}
  };
};



export const userService = {
  createUser,
  createEmailOtp,
  verifyEmailOtp,
  createSignUpEmailOtp,
  createPhoneOtp,
  verifyPhoneOtp,
  blockUserService,
  unblockUserService,
  getBlockedUsersService,
  updateUserProfileService,
  updateFcmToken,
  updateUserStatus,
  isBlockedService,
  deleteUserService,
  activateBoost,
  updateProfileImagesService,
  getAllUsers,
  changeLocation,
  appleLogin,
  toggleIncognitoMode,
  getUserById,
  getUserProfileWithRelationship,
  adminLogin
}