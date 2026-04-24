import { Router } from "express";
import { AuthControllers } from "./auth.controller";
import { checkAuth } from "../../middlewares/checkAuth";
import { Role } from "../user/user.interface";

const router = Router();

// Public routes - Send OTP
router.post("/login/email/send-otp", AuthControllers.sendEmailOtp);
router.post("/login/phone/send-otp", AuthControllers.sendPhoneOtp);

// Public routes - Login with OTP
router.post("/login/email", AuthControllers.loginWithEmail);
router.post("/login/phone", AuthControllers.loginWithPhone);

//admin login

// Public routes - Token refresh
router.post("/refresh-token", AuthControllers.refreshToken);

// Protected routes
router.get("/me", checkAuth(...Object.values(Role)), AuthControllers.getMe);

router.post("/logout", AuthControllers.logout);

export const authRoutes = router;

