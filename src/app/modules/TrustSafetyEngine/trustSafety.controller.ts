import { Request, Response } from 'express';
import { catchAsync } from '../../utils/catchAsync';
import { sendResponse } from '../../utils/sendResponse';
import { TrustSafetyService } from './trustSafety.service';
import httpStatus from 'http-status';
import { JwtPayload } from 'jsonwebtoken';

const reportUser = catchAsync(async (req: Request, res: Response) => {
   const { id } = req.user as JwtPayload;
  const reporterId = id
  const result = await TrustSafetyService.reportUser({
    ...req.body,
    reporterId,
  });

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'User reported successfully',
    data: result,
  });
});

const getMyTrustScore = catchAsync(async (req: Request, res: Response) => {
    const { id } = req.user as JwtPayload;
  const userId = id
  const user = req.user as any; // Assuming user is populated in req.user

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'Trust score retrieved successfully',
    data: {
      trustScore: user?.trustScore,
      level: TrustSafetyService.getTrustLevel(user?.trustScore || 70),
    },
  });
});

export const TrustSafetyController = {
  reportUser,
  getMyTrustScore,
};
