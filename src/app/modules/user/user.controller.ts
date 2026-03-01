import { fileUploader } from "../../helpers/fileUpload";
import { sendResponse } from "../../utils/sendResponse";
import * as userService from "./user.service";
import getPlaceNameGoogle from "../../utils/getGoogleLocation";
import { setAuthCookie } from "../../utils/setCookie";

import { NextFunction, Request, Response } from "express";
import { catchAsync } from "../../utils/catchAsync";

/* eslint-disable @typescript-eslint/no-explicit-any */

const createUser = catchAsync(
  async (req: Request, res: Response, _next: NextFunction) => {
    try {
      let bodyData: any = {};
      if (req.body.data) {
        bodyData = JSON.parse(req.body.data);
      } else {
        bodyData = req.body;
      }

      const files = req.files as Express.Multer.File[] | undefined;

      if (files && files.length > 0) {
        const uploadResults = await Promise.all(
          files.map((f) => fileUploader.uploadToCloudinary(f))
        );
        const urls = uploadResults
          .map((r: any) => r?.secure_url as string | undefined)
          .filter(Boolean) as string[];
        bodyData.images = urls;
        bodyData.profileImage = urls[0];
      }

      if (bodyData.lat && bodyData.lng) {
        const lat = parseFloat(bodyData.lat);
        const lng = parseFloat(bodyData.lng);

        const name = await getPlaceNameGoogle(lat, lng);

        bodyData.location = {
          type: "Point",
          coordinates: [lng, lat], // [Long, Lat] for GeoJSON
          placeName: name,
        };
      }

      const userData = await userService.createUser(bodyData);

      if (userData.accessToken || userData.refreshToken) {
        setAuthCookie(res, {
          accessToken: userData.accessToken,
          refreshToken: userData.refreshToken,
        });
      }

      sendResponse(res, {
        statusCode: 201,
        success: true,
        message: "User created successfully",
        data: userData,
      });
    } catch (err: any) {
      sendResponse(res, {
        statusCode: 500,
        success: false,
        message: "Parsing or Upload Error: " + err.message,
        data: null,
      });
    }
  }
);

const sendEmailOtp = async (req: Request, res: Response): Promise<void> => {
  try {
    const { email } = req.body as { email?: string };
    if (!email) {
      return sendResponse(res, {
        statusCode: 400,
        success: false,
        message: "Email required",
        data: null,
      });
    }
  //  const checkUser=await User.findOne({email});
  //  if(checkUser && checkUser.isProfileComplete && checkUser.isEmailVerified){
  //   return sendResponse(res, {
  //     statusCode: 400,
  //     success: false,
  //     message: "Account already exists with this email. Please login.",
  //     data: null,
  //   });
  //  }

    const otp = await userService.createSignUpEmailOtp(email);

    sendResponse(res, {
      statusCode: 200,
      success: true,
      message: "OTP sent",
      data: { otp }, // optional: include OTP for testing
    });
  } catch (err: any) {
    sendResponse(res, {
      statusCode: 500,
      success: false,
      message: err.message,
      data: null,
    });
  }
};

const verifyEmailOtp = async (req: Request, res: Response): Promise<void> => {
  try {
    const { email, otp } = req.body as { email?: string; otp?: string };
    if (!email || !otp) {
      return sendResponse(res, {
        statusCode: 400,
        success: false,
        message: "Email and OTP required",
        data: null,
      });
    }

    const result = await userService.verifyEmailOtp(email, otp);
    console.log("OTP Verification Result:", result);
    if (
      result.success &&
      result.data &&
      (result.data as any).accessToken &&
      (result.data as any).refreshToken
    ) {
      const data: any = result.data;
      setAuthCookie(res, {
        accessToken: data.accessToken,
        refreshToken: data.refreshToken,
      });
    }

    sendResponse(res, {
      statusCode: result.success ? 200 : 400,
      success: result.success,
      message: result.message,
      data: result.data || null,
    });
  } catch (err: any) {
    sendResponse(res, {
      statusCode: 500,
      success: false,
      message: err.message,
      data: null,
    });
  }
};

const sendPhoneOtp = async (req: Request, res: Response): Promise<void> => {
  try {
    const { phoneNumber } = req.body as { phoneNumber?: string };
    if (!phoneNumber) {
      return sendResponse(res, {
        statusCode: 400,
        success: false,
        message: "Phone required",
        data: null,
      });
    }

    const result = await userService.createPhoneOtp(phoneNumber);

    sendResponse(res, {
      statusCode: 200,
      success: true,
      message: result.message,
      data: { otp: result.otp },
    });
  } catch (err: any) {
    sendResponse(res, {
      statusCode: 500,
      success: false,
      message: err.message,
      data: null,
    });
  }
};

const verifyPhoneOtp = async (req: Request, res: Response): Promise<void> => {
  try {
    const { phoneNumber, otp } = req.body as {
      phoneNumber?: string;
      otp?: string;
    };
    if (!phoneNumber || !otp) {
      return sendResponse(res, {
        statusCode: 400,
        success: false,
        message: "Phone and OTP required",
        data: null,
      });
    }

    const result = await userService.verifyPhoneOtp(phoneNumber, otp);

    sendResponse(res, {
      statusCode: result.success ? 200 : 400,
      success: result.success,
      message: result.message,
      data: result.data || null,
    });
  } catch (err: any) {
    sendResponse(res, {
      statusCode: 500,
      success: false,
      message: err.message,
      data: null,
    });
  }
};



export const userControllers = {
  createUser,
  sendEmailOtp,
  verifyEmailOtp,
  sendPhoneOtp,
  verifyPhoneOtp,
};
