import { Request, Response } from "express";
import { catchAsync } from "../../utils/catchAsync";
import { sendResponse } from "../../utils/sendResponse";
import { discoveryService } from "./discovery.service";

export const getDiscoveryUsers = catchAsync(async (req: Request, res: Response) => {
  const authUser = (req as any).user;
  // Optional query filters
     const parseNumber = (value: any) =>
      value !== undefined ? Number(value) : undefined;

    const parseBoolean = (value: any) =>
      value !== undefined ? value === "true" : undefined;

    const parseArray = (value: any) =>
      value ? String(value).split(",") : undefined;

  const filters = {
    gender: req.query.gender as string | undefined,
    minAge: req.query.minAge ? Number(req.query.minAge) : undefined,
    maxAge: req.query.maxAge ? Number(req.query.maxAge) : undefined,
    minDistance: req.query.minDistance ? Number(req.query.minDistance) : undefined,
    maxDistance: req.query.maxDistance ? Number(req.query.maxDistance) : undefined,
    skillLevel: req.query.skillLevel as string | undefined,
    hopingToFind: req.query.hopingToFind as string | undefined,
    
    // Premium Filters (Birdie+)
    minPhotos: parseNumber(req.query.minPhotos),
    hasBio: parseBoolean(req.query.hasBio),
    minHeight: parseNumber(req.query.minHeight),
    maxHeight: parseNumber(req.query.maxHeight),

    // Top Tier Filters (Ace/Eagle)
    ethnicity: req.query.ethnicity as string | undefined,
    playstyle: req.query.playstyle as string | undefined,
    politics: req.query.politics as string | undefined,
    religion: req.query.religion as string | undefined,
    zodiac: req.query.zodiac as string | undefined,
    educationPlan: req.query.educationPlan as string | undefined,
    communicationStyle: req.query.communicationStyle as string | undefined,
    loveLanguage: req.query.loveLanguage as string | undefined,
    cannabis: req.query.cannabis as string | undefined,
    workout: req.query.workout as string | undefined,
    petType: req.query.petType as string | undefined,

    interests: parseArray(req.query.interests),
    languages: parseArray(req.query.languages),
    openTo: req.query.openTo as string | undefined,
  };
console.log("Discovery filters received:", filters);
  // Pagination
  const page = req.query.page ? Number(req.query.page) : 1;

  const result = await discoveryService(authUser, filters, page);
  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: "Discovery users loaded",
    data: result.users,
    meta: {
      currentPage: result.pagination.currentPage,
      totalPages: result.pagination.totalPages,
      perPage: result.pagination.perPage,
      total: result.pagination.total
    }
  });
});