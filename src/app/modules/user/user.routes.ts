import { Router } from "express";
import { fileUploader } from "../../helpers/fileUpload";
import { blockUser, getBlockedUsers, unblockUser, userControllers } from "./user.controller";

import { checkAuth } from "../../middlewares/checkAuth";
import { Role } from "./user.interface";

const router = Router();

// Email Signup Flow
router.post("/signup/email", userControllers.sendEmailOtp);
router.post("/signup/email/verify", userControllers.verifyEmailOtp);

//

// Phone Signup Flow
router.post("/signup/phone", userControllers.sendPhoneOtp);
router.post("/signup/phone/verify", userControllers.verifyPhoneOtp);

//apple signup flow
router.post("/signup/apple", userControllers.appleLoginController);

// Complete User Profile
router.patch("/profile/complete",fileUploader.upload.array("image", 6),userControllers.createUser);

router.patch("/update-fcm-token",checkAuth(...Object.values(Role)),userControllers.updateFcmToken);

router.post("/block",checkAuth(...Object.values(Role)) ,blockUser);      // Block a user
router.post("/unblock",checkAuth(...Object.values(Role)), unblockUser);  // Unblock a user
router.get("/blocked",checkAuth(...Object.values(Role)), getBlockedUsers); // List blocked users
router.patch("/profile",checkAuth(...Object.values(Role)), userControllers.updateUserProfile);
router.patch("/profile/image", checkAuth(...Object.values(Role)), fileUploader.upload.single("image"), userControllers.updateProfileImages);
router.post("/profile/boost", checkAuth(...Object.values(Role)), userControllers.activateBoost);
router.patch("/profile/incognito", checkAuth(...Object.values(Role)), userControllers.toggleIncognitoMode);
router.patch("/profile/location", checkAuth(...Object.values(Role)), userControllers.changeLocation);
router.delete("/delete-account",checkAuth(...Object.values(Role)), userControllers.deleteAccount);
router.get("/all", checkAuth(...Object.values(Role)), userControllers.getAllUsers);

export const userRoutes = router;


