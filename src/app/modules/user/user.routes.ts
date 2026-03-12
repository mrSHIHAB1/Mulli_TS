import { Router } from "express";
import { fileUploader } from "../../helpers/fileUpload";
import { blockUser, getBlockedUsers, unblockUser, userControllers } from "./user.controller";

import { checkAuth } from "../../middlewares/checkAuth";
import { Role } from "./user.interface";

const router = Router();

// Email Signup Flow
router.post("/signup/email", userControllers.sendEmailOtp);
router.post("/signup/email/verify", userControllers.verifyEmailOtp);

// Phone Signup Flow
router.post("/signup/phone", userControllers.sendPhoneOtp);
router.post("/signup/phone/verify", userControllers.verifyPhoneOtp);

// Complete User Profile
router.patch(
  "/profile/complete",
  fileUploader.upload.array("image", 6),
  userControllers.createUser
);

router.patch(
  "/update-fcm-token",
  checkAuth(Role.USER, Role.ADMIN),
  userControllers.updateFcmToken
);
router.post("/block", blockUser);      // Block a user
router.post("/unblock", unblockUser);  // Unblock a user
router.get("/blocked", getBlockedUsers); // List blocked users
export const userRoutes = router;


