import { Router } from "express";
import { SubscriptionController } from "./subscription.controller";
import { checkAuth } from "../../middlewares/checkAuth";
import { Role } from "../user/user.interface";

const router = Router();

router.post(
  "/add",
  checkAuth(...Object.values(Role)),
  SubscriptionController.createSubscription
);

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
  "/status/:transactionId",
  checkAuth(...Object.values(Role)), // Ensure only admins can update status manually
  SubscriptionController.updateSubscription
);

router.post(
  "/cancel",
  checkAuth(...Object.values(Role)),
  SubscriptionController.cancelSubscription
);

router.post(
  "/trial",
  checkAuth(...Object.values(Role)), // Ensure authenticated users can create trial subscriptions
  SubscriptionController.createTrialSubscription
);

// Note: webhook endpoints often don't require the same authentication 
// as they are called by external services (Apple/Google).
// router.post(
//   "/webhook",
//   SubscriptionController.subscriptionWebhook
// );

export const subscriptionRoutes = router;