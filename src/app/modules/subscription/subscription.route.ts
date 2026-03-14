import { Router } from "express";
import { SubscriptionController } from "./subscription.controller";
import { checkAuth } from "../../middlewares/checkAuth";
import { Role } from "../user/user.interface";

const router = Router();

router.get(
  "/me",
  checkAuth(...Object.values(Role)),
  SubscriptionController.getMySubscription
);

router.get(
  "/all",
  checkAuth(Role.ADMIN), // Ensure only admins can get all subscriptions
  SubscriptionController.getAllSubscriptions
);

router.patch(
  "/:transactionId",
  checkAuth(Role.ADMIN), // Ensure only admins can update status manually
  SubscriptionController.updateSubscription
);

router.post(
  "/cancel",
  checkAuth(...Object.values(Role)),
  SubscriptionController.cancelSubscription
);

// Note: webhook endpoints often don't require the same authentication 
// as they are called by external services (Apple/Google).
router.post(
  "/webhook",
  SubscriptionController.subscriptionWebhook
);

export const subscriptionRoutes = router;