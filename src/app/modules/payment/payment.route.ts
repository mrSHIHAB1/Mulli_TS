import express from "express";
import { PaymentController } from "./payment.controller";
import { checkAuth } from "../../middlewares/checkAuth";
import { Role } from "../user/user.interface";

const router = express.Router();

router.post(
  "/verify-purchase",
  checkAuth(...Object.values(Role)),
  PaymentController.verifyPurchase
);

router.post("/apple-webhook", PaymentController.appleWebhook);

// 📜 Get transaction history for user
router.get(
  "/transaction-history",
  checkAuth(...Object.values(Role)),
  PaymentController.getTransactionHistory
);

// 📊 Get payment summary for user
router.get(
  "/payment-summary",
  checkAuth(...Object.values(Role)),
  PaymentController.getPaymentSummary
);

export const PaymentRoutes = router;