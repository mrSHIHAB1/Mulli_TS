import { StatusCodes } from "http-status-codes";
import AppError from "../../errorHelpers/AppError";
import PromoCode from "./promoCode.model";
import { IPromoCode } from "./promoCode.interface";
import { SubscriptionService } from "../subscription/subscription.service";
import { Plan, SubscriptionStatus } from "../subscription/subscription.interface";
import QRCode from "qrcode";

const createPromoCode = async (payload: IPromoCode) => {
  const result = await PromoCode.create(payload);
  return result;
};

const getAllPromoCodes = async () => {
  const result = await PromoCode.find().sort({ createdAt: -1 });
  return result;
};

const deletePromoCode = async (id: string) => {
  const result = await PromoCode.findByIdAndDelete(id);
  if (!result) {
    throw new AppError(StatusCodes.NOT_FOUND, "Promo code not found");
  }
  return result;
};

const applyPromoCode = async (userId: string, code: string) => {
  const promoCode = await PromoCode.findOne({ code });

  if (!promoCode) {
    throw new AppError(StatusCodes.NOT_FOUND, "Invalid promo code");
  }

  // Check if expired
  if (promoCode.expires_at && new Date() > new Date(promoCode.expires_at)) {
    throw new AppError(StatusCodes.BAD_REQUEST, "Promo code has expired");
  }

  // Check usage limit
  if (promoCode.uses_count >= promoCode.max_uses) {
    throw new AppError(StatusCodes.BAD_REQUEST, "Promo code usage limit reached");
  }

  // Check if user already has an active subscription
  const hasActiveSub = await SubscriptionService.hasActiveSubscription(userId);
  if (hasActiveSub) {
    throw new AppError(StatusCodes.BAD_REQUEST, "User already has an active subscription");
  }

  // Create subscription
  const startDate = new Date();
  const endDate = new Date();
  endDate.setMonth(endDate.getMonth() + 1);

  const subscriptionPayload: any = {
    userId,
    plan_type: Plan.BIRDIE, 
    platform: "ios", // Defaulting to ios as per enum restriction
    productId: `promo_${promoCode.tier.toLowerCase()}`,
    transactionId: `promo_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    originalTransactionId: `promo_${promoCode.code}`,
    start_date: startDate,
    end_date: endDate,
    status: SubscriptionStatus.ACTIVE,
    auto_renew: false,
    total_spent: 0,
    metadata: {
      promoCode: promoCode.code,
      partner: promoCode.partner_name
    }
  };

  const newSub = await SubscriptionService.createSubscription(subscriptionPayload);

  // Update promo code usage count
  await PromoCode.findByIdAndUpdate(promoCode._id, {
    $inc: { uses_count: 1 }
  });

  return newSub;
};

const generateQRCode = async (code: string) => {
  const promoCode = await PromoCode.findOne({ code });

  if (!promoCode) {
    throw new AppError(StatusCodes.NOT_FOUND, "Promo code not found");
  }

  const url = `https://mulli.app/join?promo=${code}`;
  const qrCodeBuffer = await QRCode.toBuffer(url, { width: 600 });
  
  return qrCodeBuffer;
};

export const PromoCodeService = {
  createPromoCode,
  getAllPromoCodes,
  deletePromoCode,
  applyPromoCode,
  generateQRCode
};
