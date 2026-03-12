import express from "express";

import { userRoutes } from "../modules/user/user.routes";
import { authRoutes } from "../modules/auth/auth.routes";
import { clubhouseRoutes } from "../modules/Clubhouse/clubhouse.routes";
import { discoveryRoutes } from "../modules/Discovery/discovery.routes";
import { swipeRouter } from "../modules/Swipe/swipe.routes";
import { matchRoutes } from "../modules/Liked/match.routes";
import { chatRoutes } from "../modules/chat/chat.route";
import path from "node:path";

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
  
];

moduleRoutes.forEach((route) => router.use(route.path, route.route));

export default router;