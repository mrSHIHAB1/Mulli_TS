import { fileUploader } from "../../helpers/fileUpload";
import { sendResponse } from "../../utils/sendResponse";
import {appleLogin, userService} from "./user.service";
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
      console.log("Parsed body data:", bodyData);
//  if (!bodyData.email || !bodyData.phone) {
//         return sendResponse(res, {
//           statusCode: 400,
//           success: false,
//           message: "Email and phone are required",
//           data: null,
//         });
//       }
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
if (bodyData.fcmToken) {
  bodyData.fcmTokens = [bodyData.fcmToken]; // convert to array
  delete bodyData.fcmToken; // optional cleanup
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

const sendPhoneOtp = catchAsync(async (req: Request, res: Response) => {
  const { phoneNumber } = req.body as { phoneNumber?: string };

  if (!phoneNumber) {
    return sendResponse(res, {
      statusCode: 400,
      success: false,
      message: "Phone number is required",
      data: null,
    });
  }

  // Call service to generate OTP and send SMS via Twilio
  const result = await userService.createPhoneOtp(phoneNumber);

  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: result.message,
    // OTP is not returned in production for security reasons
    // data: { otp: result.otp } // optional for testing only
    data: null,
  });
});


const verifyPhoneOtp = catchAsync(async (req: Request, res: Response) => {
  const { phoneNumber, otp } = req.body as { phoneNumber?: string; otp?: string };

  if (!phoneNumber || !otp) {
    return sendResponse(res, {
      statusCode: 400,
      success: false,
      message: "Phone number and OTP are required",
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
});


const updateFcmToken = catchAsync(async (req: Request, res: Response) => {
  const { fcmToken } = req.body;
  const user = (req as any).user; // Assuming auth middleware attaches user
console.log(user)
  if (!fcmToken) {
    return sendResponse(res, {
      statusCode: 400,
      success: false,
      message: "FCM token is required",
      data: null,
    });
  }

  const result = await userService.updateFcmToken(user?.id || req.body.userId, fcmToken);

  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: "FCM token updated successfully",
    data: "Done",
  });
});

export const blockUser = catchAsync(async (req: Request, res: Response) => {
  const currentUser: any = (req as any).user;
  const { blockedId } = req.body;

  const result = await userService.blockUserService(currentUser.id, blockedId);

  sendResponse(res, {
    success: true,
    statusCode: 200,
    message: "User blocked successfully",
    data: result.blockedUsers,
  });
});

export const unblockUser = catchAsync(async (req: Request, res: Response) => {
  const currentUser: any = (req as any).user;
  const { blockedId } = req.body;

  const result = await userService.unblockUserService(currentUser.id, blockedId);

  sendResponse(res, {
    success: true,
    statusCode: 200,
    message: "User unblocked successfully",
    data: result.blockedUsers,
  });
});

export const getBlockedUsers = catchAsync(async (req: Request, res: Response) => {
  const currentUser: any = (req as any).user;

  const result = await userService.getBlockedUsersService(currentUser.id);

  sendResponse(res, {
    success: true,
    statusCode: 200,
    message: "Blocked users fetched successfully",
    data: result,
  });
});
export const updateUserProfile = catchAsync(
  async (req: Request, res: Response) => {
    const currentUser: any = (req as any).user;
    console.log("Current user in updateUserProfile:", currentUser);
    const files = req.files as Express.Multer.File[] | undefined;
    let bodyData: any = {};

    if (req.body.data) {
      bodyData = JSON.parse(req.body.data);
    } else {
      bodyData = req.body;
    }

    const updatedUser = await userService.updateUserProfileService(
      currentUser.id,
      bodyData,
      files
    );

    sendResponse(res, {
      statusCode: 200,
      success: true,
      message: "Profile updated successfully",
      data: updatedUser,
    });
  }
);

export const deleteAccount = catchAsync(async (req: Request, res: Response) => {
  const currentUser: any = (req as any).user;
  const result = await userService.deleteUserService(currentUser._id);

  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: result.message,
    data: null,
  });
});

const updateProfileImages = catchAsync(async (req: Request, res: Response) => {
  const userId = (req as any).user?.id || (req as any).user?._id;
  const file = req.file as Express.Multer.File | undefined;

  if (!file) {
    return sendResponse(res, {
      statusCode: 400,
      success: false,
      message: "Image file is required",
      data: null,
    });
  }

  const updated = await userService.updateProfileImagesService(userId, file);

  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: "Profile image updated successfully",
    data: updated,
  });
});

const activateBoost = catchAsync(async (req: Request, res: Response) => {
  const userId = (req as any).user?.id || (req as any).user?._id;
  const user = await userService.activateBoost(userId);

  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: "Profile boosted for 30 minutes!",
    data: user,
  });
});

const changeLocation = catchAsync(async (req: Request, res: Response) => {
  const userId = (req as any).user?.id || (req as any).user?._id;
  const { lat, lng, placeName } = req.body;

  if (lat === undefined || lng === undefined) {
    return sendResponse(res, {
      statusCode: 400,
      success: false,
      message: "Latitude (lat) and Longitude (lng) are required",
      data: null,
    });
  }

  const user = await userService.changeLocation(userId, { lat, lng, placeName });

  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: "Location updated successfully",
    data: user,
  });
});

const toggleIncognitoMode = catchAsync(async (req: Request, res: Response) => {
  const userId = (req as any).user?.id || (req as any).user?._id;
  const result = await userService.toggleIncognitoMode(userId);

  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: `${result.isIncognito ? "ENABLED" : "DISABLED"}`,
    data: null,
  });
});

const getAllUsers = catchAsync(async (req: Request, res: Response) => {
  const users = await userService.getAllUsers();

  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: "All users fetched successfully",
    data: users,
  });
});


export const appleLoginController = async (req: Request, res: Response) => {
  try {
    const { identityToken } = req.body;

    if (!identityToken) {
      return sendResponse(res, {
        statusCode: 400,
        success: false,
        message: "identityToken required",
        data: null,
      });
    }

    const result = await appleLogin(identityToken);

    // ✅ set cookie ONLY if login success
    if (result.success && result.data?.accessToken && result.data?.refreshToken) {
      setAuthCookie(res, {
        accessToken: result.data.accessToken,
        refreshToken: result.data.refreshToken,
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
const getUserById = catchAsync(async (req: Request, res: Response) => {
  const { userId } = req.params;
  
  if (!userId) {
    return sendResponse(res, {
      statusCode: 400,
      success: false,
      message: "User ID is required",
      data: null,
    });
  }

  const user = await userService.getUserById(userId as string);

  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: "User retrieved successfully",
    data: user,
  });
});

const getUserProfile = catchAsync(async (req: Request, res: Response) => {
  const { userId } = req.params;
  const currentUserId =  (req as any).user?.id ;

  if (!userId) {
    return sendResponse(res, {
      statusCode: 400,
      success: false,
      message: "User ID is required",
      data: null,
    });
  }

  if (!currentUserId) {
    return sendResponse(res, {
      statusCode: 401,
      success: false,
      message: "Unauthorized - Current user not found",
      data: null,
    });
  }

  const profileData = await userService.getUserProfileWithRelationship(currentUserId as string, userId as string);

  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: "User profile retrieved successfully",
    data: profileData,
  });
});

export const userControllers = {
  createUser,
  sendEmailOtp,
  verifyEmailOtp,
  sendPhoneOtp,
  verifyPhoneOtp,
  updateFcmToken,
  updateUserProfile,
  updateProfileImages,
  deleteAccount,
  activateBoost,
  getAllUsers,
  changeLocation,
  appleLoginController,
  toggleIncognitoMode,
  getUserById,
  getUserProfile
};

