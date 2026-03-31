/* eslint-disable @typescript-eslint/no-explicit-any */
import { User } from "./user.model";
import { generateOtp } from "../../utils/otp.util";
import { sendOtpEmail } from "../../utils/email.util";
import { redisClient } from "../../config/redis.config";
import { createUserTokens } from "../../utils/userTokens";
import mongoose from "mongoose";
import { sendOTP } from "../../config/twillio.config";
import getPlaceNameGoogle from "../../utils/getGoogleLocation";
import { fileUploader } from "../../helpers/fileUpload";

const OTP_EXPIRE = 3 * 60; // 3 minutes

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
    { new: true }
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

  await sendOtpEmail({ to: email, otp });
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
 const createPhoneOtp = async ( phoneNumber: string): Promise<{ message: string }> => {
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
 const verifyPhoneOtp = async (phone: string,inputOtp: string): Promise<OtpResult> => {
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

const updateFcmToken = async (userId: string,fcmToken: string): Promise<string[]> => {
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

  // Handle location if lat/lng provided
  if (bodyData.lat && bodyData.lng) {
    const lat = parseFloat(bodyData.lat);
    const lng = parseFloat(bodyData.lng);
    const placeName = await getPlaceNameGoogle(lat, lng);

    updateData.location = {
      type: "Point",
      coordinates: [lng, lat], // GeoJSON format
      placeName,
    };
  }

  const updatedUser = await User.findByIdAndUpdate(
    new mongoose.Types.ObjectId(userId),
    { $set: updateData },
    { new: true }
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
    { new: true }
  );
};
export const userService={
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
isBlockedService
}