import { Request, Response } from "express";
import { catchAsync } from "../../utils/catchAsync";
import { sendResponse } from "../../utils/sendResponse";
import { StatusCodes } from "http-status-codes";
import { PromoCodeService } from "./promoCode.service";
import { JwtPayload } from "jsonwebtoken";

const createPromoCode = catchAsync(async (req: Request, res: Response) => {
  const result = await PromoCodeService.createPromoCode(req.body);
  sendResponse(res, {
    statusCode: StatusCodes.CREATED,
    success: true,
    message: "Promo code created successfully",
    data: result,
  });
});

const getAllPromoCodes = catchAsync(async (req: Request, res: Response) => {
  const result = await PromoCodeService.getAllPromoCodes();
  sendResponse(res, {
    statusCode: StatusCodes.OK,
    success: true,
    message: "Promo codes retrieved successfully",
    data: result,
  });
});

const deletePromoCode = catchAsync(async (req: Request, res: Response) => {
  const { id } = req.params;
  const result = await PromoCodeService.deletePromoCode(id as string);
  sendResponse(res, {
    statusCode: StatusCodes.OK,
    success: true,
    message: "Promo code deleted successfully",
    data: result,
  });
});

const applyPromoCode = catchAsync(async (req: Request, res: Response) => {
  const { promo } = req.body;
  const userId = (req as any).user?.id;
  const result = await PromoCodeService.applyPromoCode(userId, promo);
  sendResponse(res, {
    statusCode: StatusCodes.OK,
    success: true,
    message: "Promo code applied successfully. Enjoy your Birdie subscription!",
    data: result,
  });
});

const generateQRCode = catchAsync(async (req: Request, res: Response) => {
  const { code } = req.params;
  const buffer = await PromoCodeService.generateQRCode(code as string);

  res.setHeader("Content-Type", "image/png");
  res.setHeader("Content-Disposition", `attachment; filename=promo_${code}.png`);
  res.send(buffer);
});

export const PromoCodeController = {
  createPromoCode,
  getAllPromoCodes,
  deletePromoCode,
  applyPromoCode,
  generateQRCode
};
