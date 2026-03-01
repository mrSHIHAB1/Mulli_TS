import httpStatus from "http-status-codes";
import { Request, Response } from "express";
import { catchAsync } from "../../utils/catchAsync";
import { sendResponse } from "../../utils/sendResponse";
import { AuthServices } from "./auth.service";
import { setAuthCookie } from "../../utils/setCookie";

// Send OTP to Email
const sendEmailOtp = catchAsync(async (req: Request, res: Response) => {
  const { email } = req.body as { email?: string };

  if (!email) {
    return sendResponse(res, {
      statusCode: httpStatus.BAD_REQUEST,
      success: false,
      message: "Email is required",
      data: null,
    });
  }

  const result = await AuthServices.sendEmailOtp(email);

  if (!result.success) {
    return sendResponse(res, {
      statusCode: httpStatus.BAD_REQUEST,
      success: false,
      message: result.message,
      data: null,
    });
  }

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "OTP sent to your email",
    data: result.data,
  });
});

// Send OTP to Phone
const sendPhoneOtp = catchAsync(async (req: Request, res: Response) => {
  const { phoneNumber } = req.body as { phoneNumber?: string };

  if (!phoneNumber) {
    return sendResponse(res, {
      statusCode: httpStatus.BAD_REQUEST,
      success: false,
      message: "Phone number is required",
      data: null,
    });
  }

  const result = await AuthServices.sendPhoneOtp(phoneNumber);

  if (!result.success) {
    return sendResponse(res, {
      statusCode: httpStatus.BAD_REQUEST,
      success: false,
      message: result.message,
      data: null,
    });
  }

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "OTP sent to your phone",
    data: result.data,
  });
});

// Login with Email OTP
const loginWithEmail = catchAsync(async (req: Request, res: Response) => {
  const { email, otp } = req.body as { email?: string; otp?: string };

  if (!email || !otp) {
    return sendResponse(res, {
      statusCode: httpStatus.BAD_REQUEST,
      success: false,
      message: "Email and OTP required",
      data: null,
    });
  }

  const result = await AuthServices.loginWithEmail(email, otp);

  if (!result.success || !result.data) {
    return sendResponse(res, {
      statusCode: httpStatus.BAD_REQUEST,
      success: false,
      message: result.message,
      data: null,
    });
  }

  setAuthCookie(res, {
    accessToken: result.data.accessToken,
    refreshToken: result.data.refreshToken,
  });

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: result.message,
    data: result.data,
  });
});

// Login with Phone OTP
const loginWithPhone = catchAsync(async (req: Request, res: Response) => {
  const { phoneNumber, otp } = req.body as {
    phoneNumber?: string;
    otp?: string;
  };

  if (!phoneNumber || !otp) {
    return sendResponse(res, {
      statusCode: httpStatus.BAD_REQUEST,
      success: false,
      message: "Phone number and OTP required",
      data: null,
    });
  }

  const result = await AuthServices.loginWithPhone(phoneNumber, otp);

  if (!result.success || !result.data) {
    return sendResponse(res, {
      statusCode: httpStatus.BAD_REQUEST,
      success: false,
      message: result.message,
      data: null,
    });
  }

  setAuthCookie(res, {
    accessToken: result.data.accessToken,
    refreshToken: result.data.refreshToken,
  });

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: result.message,
    data: result.data,
  });
});

// Get current user
const getMe = catchAsync(async (req: Request, res: Response) => {
  const userSession = req.cookies;
  const result = await AuthServices.getMe(userSession);

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "User retrieved successfully",
    data: result,
  });
});

// Logout
const logout = catchAsync(async (_req: Request, res: Response) => {
  res.clearCookie("accessToken", {
    httpOnly: true,
    secure: false,
    sameSite: "lax",
  });
  res.clearCookie("refreshToken", {
    httpOnly: true,
    secure: false,
    sameSite: "lax",
  });

  sendResponse(res, {
    success: true,
    statusCode: httpStatus.OK,
    message: "User logged out successfully",
    data: null,
  });
});

// Refresh token
const refreshToken = catchAsync(async (req: Request, res: Response) => {
  const { refreshToken } = req.cookies as { refreshToken?: string };

  if (!refreshToken) {
    return sendResponse(res, {
      statusCode: httpStatus.UNAUTHORIZED,
      success: false,
      message: "Refresh token missing",
      data: null,
    });
  }

  const result = await AuthServices.getNewAccessToken(refreshToken);

  res.cookie("accessToken", result.accessToken, {
    httpOnly: true,
    secure: false,
    sameSite: "lax",
  });

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Access token refreshed successfully",
    data: result,
  });
});

export const AuthControllers = {
  sendEmailOtp,
  sendPhoneOtp,
  loginWithEmail,
  loginWithPhone,
  getMe,
  logout,
  refreshToken,
};

