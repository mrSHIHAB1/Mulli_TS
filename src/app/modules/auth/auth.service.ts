/* eslint-disable @typescript-eslint/no-explicit-any */
import {
  createUserTokens,
  createNewAccessTokenWithRefreshToken,
} from "../../utils/userTokens";
import { verifyToken } from "../../utils/jwt";
import { envVars } from "../../config/env";
import User from "../user/user.model";
import { userService } from "../user/user.service";
import Subscription from "../subscription/subscription.model";
import { SubscriptionStatus } from "../subscription/subscription.interface";
import { getClubhouseProfile } from "../Clubhouse/clubhouse.points";
import { error } from "node:console";
import { Role } from "../user/user.interface";

interface ServiceResult<T = any> {
  success: boolean;
  message: string;
  data?: T;
}

// Send OTP to Email
const sendEmailOtp = async (email: string): Promise<ServiceResult> => {
  try {
    await userService.createEmailOtp(email);
    return {
      success: true,
      message: "OTP sent successfully to your email",
      data: { email },
    };
  } catch (error: any) {
    return {
      success: false,
      message: error.message || "Failed to send OTP",
    };
  }
};

// Send OTP to Phone
const sendPhoneOtp = async (phoneNumber: string): Promise<ServiceResult> => {
  try {
    const result = await userService.createPhoneOtp(phoneNumber);
    return {
      success: true,
      message: result.message || "OTP sent successfully to your phone",
      data: { phoneNumber },
    };
  } catch (error: any) {
    return {
      success: false,
      message: error.message || "Failed to send OTP",
    };
  }
};

// Login with Email OTP
const loginWithEmail = async (
  email: string,
  otp: string
): Promise<ServiceResult> => {
  try {
    const otpVerification = await userService.verifyEmailOtp(email, otp);

    if (!otpVerification.success) {
      return {
        success: false,
        message: otpVerification.message,
      };
    }

    let user = await User.findOne({ email });

    if (!user) {
      return {
        success: false,
        message: "User not found. Please sign up first.",
      };
    }

    user.isEmailVerified = true;
    await user.save();

    const tokens = createUserTokens(user.toObject());

    return {
      success: true,
      message: "Login successful",
      data: {
        user: {
          id: user._id,
          name: user.firstName,
        },
        accessToken: tokens.accessToken,
        refreshToken: tokens.refreshToken,
      },
    };
  } catch (error: any) {
    return {
      success: false,
      message: error.message || "Login failed",
    };
  }
};

// Login with Phone OTP
const loginWithPhone = async (
  phoneNumber: string,
  otp: string
): Promise<ServiceResult> => {
  try {
    const otpVerification = await userService.verifyPhoneOtp(phoneNumber, otp);

    if (!otpVerification.success) {
      return {
        success: false,
        message: otpVerification.message,
      };
    }

    let user = await User.findOne({ phone: phoneNumber });

    if (!user) {
      return {
        success: false,
        message: "User not found. Please sign up first.",
      };
    }

    user.isPhoneVerified = true;
    await user.save();

    const tokens = createUserTokens(user.toObject());
    const { password, ...userWithoutPassword } = user.toObject();

    return {
      success: true,
      message: "Login successful",
      data: {
        user: userWithoutPassword,
        accessToken: tokens.accessToken,
        refreshToken: tokens.refreshToken,
      },
    };
  } catch (error: any) {
    return {
      success: false,
      message: error.message || "Login failed",
    };
  }
};

// Get current user from cookies
const getMe = async (authUser: any): Promise<any> => {
  const email = authUser.email
  const user = await User.findOne({ email });
  if (!user) {
    throw new Error("User not found");
  }

  // Fetch updated clubhouse profile data (includes status, badge, points, etc.)
  try {
    const clubhouseProfile = await getClubhouseProfile(user._id.toString());
    // Merge clubhouse fields into user object
    if (clubhouseProfile) {
      user.badgePoints = clubhouseProfile.badgePoints;
      user.clubhouseStatus = clubhouseProfile.clubhouseStatus;
      user.clubhouseBadge = clubhouseProfile.clubhouseBadge;
      user.badgeEarnedAt = clubhouseProfile.badgeEarnedAt;
      user.lastClubhouseActivity = clubhouseProfile.lastClubhouseActivity;
      user.clubhouseActiveSince = clubhouseProfile.clubhouseActiveSince;
      user.dailyClubhouseStats = clubhouseProfile.dailyClubhouseStats;
    }
  } catch (error: any) {
    console.error("Error fetching clubhouse profile:", error.message);
    // Continue with regular user data if clubhouse profile fetch fails
  }

  // Fetch active subscription
  let subscription = null;
  try {
    const activeSubscription = await Subscription.findOne(
      {
        userId: user._id,
        status: SubscriptionStatus.ACTIVE,
      },
      null,
      { sort: { createdAt: -1 } } // Get most recent subscription
    );

    // Check if subscription exists and hasn't expired
    if (activeSubscription && activeSubscription.end_date > new Date()) {
      subscription = {
        _id: activeSubscription._id,
        plan_type: activeSubscription.plan_type,
        platform: activeSubscription.platform,
        start_date: activeSubscription.start_date,
        end_date: activeSubscription.end_date,
        auto_renew: activeSubscription.auto_renew,
        status: activeSubscription.status,
      };
    }
  } catch (error) {
    console.error("Error fetching subscription:", error);
    // Continue without subscription data if there's an error
  }

  return {
    user,
    subscription, // null if no active subscription or expired
  };
};

// Refresh access token
const getNewAccessToken = async (refreshToken: string) => {
  const newAccessToken =
    await createNewAccessTokenWithRefreshToken(refreshToken);

  return {
    accessToken: newAccessToken,
  };
};



export const AuthServices = {
  sendEmailOtp,
  sendPhoneOtp,
  loginWithEmail,
  loginWithPhone,
  getMe,
  getNewAccessToken,
};

