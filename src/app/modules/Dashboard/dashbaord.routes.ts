import express from 'express';
import { DashboardController } from './dashboard.controller';
import { checkAuth } from '../../middlewares/checkAuth';
import { Role } from '../user/user.interface';

const router = express.Router();

router.get('/data', checkAuth(Role.ADMIN), DashboardController.getDashboardStats);
router.get('/clubhouse-weekly-engagement', checkAuth(Role.ADMIN), DashboardController.getClubhouseWeeklyEngagement);
router.get('/clubhouse-reports', checkAuth(Role.ADMIN), DashboardController.getClubhouseReports);
router.post('/ban-user', checkAuth(Role.ADMIN), DashboardController.banUser);
router.get('/trust-safety-reports', checkAuth(Role.ADMIN), DashboardController.getTrustSafetyReports);

export const dashboardRoutes = router;
