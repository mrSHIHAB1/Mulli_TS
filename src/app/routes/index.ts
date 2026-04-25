import express from "express";

import { userRoutes } from "../modules/user/user.routes";
import { authRoutes } from "../modules/auth/auth.routes";
import { clubhouseRoutes } from "../modules/Clubhouse/clubhouse.routes";
import { discoveryRoutes } from "../modules/Discovery/discovery.routes";
import { swipeRouter } from "../modules/Swipe/swipe.routes";
import { matchRoutes } from "../modules/Liked/match.routes";
import { chatRoutes } from "../modules/chat/chat.route";
import { subscriptionRoutes } from "../modules/subscription/subscription.routes";
import { dashboardRoutes } from "../modules/Dashboard/dashbaord.routes";
import { notificationRoutes } from "../modules/notification/notification.router";
import { emailRouter } from "../modules/Waitlist/waitlist.route";
import { PaymentRoutes } from "../modules/payment/payment.route";
import { promoCodeRoutes } from "../modules/promoCode/promoCode.routes";
import { TrustSafetyRoutes } from "../modules/TrustSafetyEngine/trustSafety.routes";


const router = express.Router();

const moduleRoutes = [
  {
    path: "/user",
    route: userRoutes,
  },
  {
    path: "/auth",
    route: authRoutes,
  },
  {
    path: "/clubhouse",
    route: clubhouseRoutes,
  },
  {
    path: "/discovery",
    route: discoveryRoutes,
  },
  {
    path: "/swipe",
    route: swipeRouter,
  },
  {
    path: "/match",
    route: matchRoutes,
  },
  {
    path: "/chat",
    route: chatRoutes,
  },
  {
    path: "/subscription",
    route: subscriptionRoutes,
  },
  {
    path: "/dashboard",
    route: dashboardRoutes,
  },
  {
    path:"/notification",
    route:notificationRoutes
  },
  {
        path:"/waitlists",
    route:emailRouter
  },
  {
    path:"/payment",
    route:PaymentRoutes
  },
  {
    path: "/promo-code",
    route: promoCodeRoutes,
  },
  {
    path: "/trust-safety",
    route: TrustSafetyRoutes,
  }
  
  
];

moduleRoutes.forEach((route) => router.use(route.path, route.route));

export default router;