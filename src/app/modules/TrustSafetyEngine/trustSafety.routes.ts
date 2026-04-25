import express from 'express';
import { checkAuth } from '../../middlewares/checkAuth';
import { Role } from '../user/user.interface';
import { TrustSafetyController } from './trustSafety.controller';

const router = express.Router();

router.post(
  '/report',
  checkAuth(...Object.values(Role)),
  TrustSafetyController.reportUser
);

router.get(
  '/my-score',
  checkAuth(...Object.values(Role)),
  TrustSafetyController.getMyTrustScore
);

export const TrustSafetyRoutes = router;
