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

export const PaymentRoutes = router;