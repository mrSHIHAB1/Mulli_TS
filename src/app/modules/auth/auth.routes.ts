import { Router } from "express";
import { AuthControllers } from "./auth.controller";
import { checkAuth } from "../../middlewares/checkAuth";

const router = Router();

// Public routes - Send OTP
router.post("/login/email/send-otp", AuthControllers.sendEmailOtp);
router.post("/login/phone/send-otp", AuthControllers.sendPhoneOtp);

// Public routes - Login with OTP
router.post("/login/email", AuthControllers.loginWithEmail);
router.post("/login/phone", AuthControllers.loginWithPhone);

// Public routes - Token refresh
router.post("/refresh-token", AuthControllers.refreshToken);

// Protected routes
router.get("/me", checkAuth("user", "admin"), AuthControllers.getMe);
router.post("/logout", AuthControllers.logout);

export const authRoutes = router;

