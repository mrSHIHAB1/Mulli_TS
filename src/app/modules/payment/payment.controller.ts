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

export const PaymentController = { 
    verifyPurchase
 };