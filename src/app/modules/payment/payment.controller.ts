import { Request, Response } from "express";
import { StatusCodes } from "http-status-codes";

import { PaymentService } from "./payment.service";
import { JwtPayload } from "jsonwebtoken";
import { catchAsync } from "../../utils/catchAsync";
import { sendResponse } from "../../utils/sendResponse";

const verifyPurchase = catchAsync(async (req: Request, res: Response) => {
  const { userId } = req.user as JwtPayload;

  const result = await PaymentService.verifyPurchase({
    ...req.body,
    userId,
  });

  sendResponse(res, {
    success: true,
    statusCode: StatusCodes.OK,
    message: "Subscription verified successfully",
    data: result,
  });
});

const appleWebhook = async (req: Request, res: Response) => {
  try {
    const result = await PaymentService.handleAppleWebhook(req);

    res.status(200).json({
      success: true,
      message: "Webhook processed",
      data: result,
    });
  } catch (error: any) {
    console.error("Webhook Error:", error);

    res.status(500).json({
      success: false,
      message: error.message || "Something went wrong",
    });
  }
};

export const PaymentController = { 
    verifyPurchase,
    appleWebhook
 };