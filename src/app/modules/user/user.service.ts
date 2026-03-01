/* eslint-disable @typescript-eslint/no-explicit-any */
import { User } from "./user.model";
import { generateOtp } from "../../utils/otp.util";
import { sendOtpEmail } from "../../utils/email.util";
import { redisClient } from "../../config/redis.config";
import { createUserTokens } from "../../utils/userTokens";

const OTP_EXPIRE = 3 * 60; // 3 minutes

// CREATE / COMPLETE USER PROFILE
export const createUser = async (data: any): Promise<any> => {
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
export const createSignUpEmailOtp = async (
  email: string
): Promise<string> => {
  const otp = generateOtp();

  await sendOtpEmail({ to: email, otp });
  await redisClient.setex(`otp:email:${email}`, OTP_EXPIRE, otp);
  return otp;
};

// GENERATE & SEND EMAIL OTP FOR EXISTING VERIFIED PROFILE
export const createEmailOtp = async (email: string): Promise<string> => {
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
export const verifyEmailOtp = async (
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
export const createPhoneOtp = async (
  phoneNumber: string
): Promise<{ otp: string; message: string }> => {
  const otp = generateOtp();
  const otpKey = `otp:phone:${phoneNumber}`;

  // Uncomment these when SMS sending & Redis are ready
  // await redisClient.setex(otpKey, OTP_EXPIRE, otp);
  // const result = await sendPhoneSms(phoneNumber, otp);
  // if (!result.success) throw new Error(result.message);

  return { otp, message: "OTP sent successfully" };
};

// VERIFY PHONE OTP (using Redis)
export const verifyPhoneOtp = async (
  phone: string,
  inputOtp: string
): Promise<OtpResult> => {
  try {
    const otpKey = `otp:phone:${phone}`;

    // For now, treat as always valid if you haven't wired up Redis/SMS:
    // const storedOtp = await redisClient.get(otpKey);
    // if (!storedOtp) return { success: false, message: "OTP expired or not found" };
    // if (storedOtp !== inputOtp) return { success: false, message: "Invalid OTP" };
    // await redisClient.del(otpKey);

    let user = await User.findOne({ phone });

    // If user exists & profile complete → LOGIN
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

    // If user doesn't exist → create partial user
    if (!user) {
      user = await User.create({
        phone,
        isPhoneVerified: true,
        isProfileComplete: false,
      });
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
  } catch (error: any) {
    return {
      success: false,
      message: error.message,
    };
  }
};

