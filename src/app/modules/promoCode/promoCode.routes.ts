import express from "express";

import { PromoCodeController } from "./promoCode.controller";
import { checkAuth } from "../../middlewares/checkAuth";
import { Role } from "../user/user.interface";

const router = express.Router();

router.post(
  "/create",
  checkAuth(Role.ADMIN), 
 
  PromoCodeController.createPromoCode
);

router.get(
  "/",
  checkAuth(Role.ADMIN),
  PromoCodeController.getAllPromoCodes
);

router.delete(
  "/:id",
  checkAuth(Role.ADMIN),
  PromoCodeController.deletePromoCode
);

router.post(
  "/apply",
  checkAuth(Role.USER, Role.ADMIN),
  PromoCodeController.applyPromoCode
);

router.get(
  "/generate-qr/:code",
  PromoCodeController.generateQRCode
);

export const promoCodeRoutes = router;
