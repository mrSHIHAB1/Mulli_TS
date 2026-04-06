/* eslint-disable @typescript-eslint/no-explicit-any */
import {
  createUserTokens,
  createNewAccessTokenWithRefreshToken,
} from "../../utils/userTokens";
import { verifyToken } from "../../utils/jwt";
import { envVars } from "../../config/env";
import User from "../user/user.model";
import { userService } from "../user/user.service";

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

  const {
    _id,
    email: userEmail,
    firstName,
    profileImage,
    isProfileComplete,
    phone,
    location,
  } = user.toObject();

  return {
    id: _id,
    email: userEmail,
    firstName,
    profileImage,
    isProfileComplete,
    phone,
    location,
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

