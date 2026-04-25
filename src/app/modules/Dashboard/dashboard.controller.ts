import { Request, Response } from 'express';
import { catchAsync } from '../../utils/catchAsync';
import { sendResponse } from '../../utils/sendResponse';
import { DashboardService } from './dashboard.service';
import { TrustSafetyService } from '../TrustSafetyEngine/trustSafety.service';
import httpStatus from 'http-status';

const getDashboardStats = catchAsync(async (req: Request, res: Response) => {
  const result = await DashboardService.getDashboardStats();

  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: 'Dashboard stats retrieved successfully',
    data: result,
  });
});

const getClubhouseWeeklyEngagement = catchAsync(async (req: Request, res: Response) => {
  const result = await DashboardService.getClubhouseWeeklyEngagement();

  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: 'Clubhouse weekly engagement retrieved successfully',
    data: result,
  });
});

const getClubhouseReports = catchAsync(async (req: Request, res: Response) => {
  const result = await DashboardService.getClubhouseReports();

  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: 'Clubhouse reports retrieved successfully',
    data: result,
  });
});

const banUser = catchAsync(async (req: Request, res: Response) => {
  const { userId } = req.body;
  const result = await TrustSafetyService.banUser(userId);

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'User banned successfully',
    data: result,
  });
});

const getTrustSafetyReports = catchAsync(async (req: Request, res: Response) => {
  const result = await TrustSafetyService.getReportsForAdmin();

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'Trust safety reports retrieved successfully',
    data: result,
  });
});

export const DashboardController = {
  getDashboardStats,
  getClubhouseWeeklyEngagement,
  getClubhouseReports,
  banUser,
  getTrustSafetyReports,
};
