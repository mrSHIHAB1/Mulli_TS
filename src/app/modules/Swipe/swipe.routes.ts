import express from "express";

import {
  getUsersILiked,
  getUsersWhoLikedMe,
  giftUser,
  likeUser,
  passUser,
} from "./swipe.controllers";
import { checkAuth } from "../../middlewares/checkAuth";

const router = express.Router();

router.post("/pass", checkAuth("admin", "user"), passUser);

router.post("/like", checkAuth("admin", "user"), likeUser);
router.get("/liked-by-me", checkAuth("admin", "user"), getUsersILiked);
router.get("/liked-me", checkAuth("admin", "user"), getUsersWhoLikedMe);

router.post("/gift", checkAuth("admin", "user"), giftUser);

export const swipeRouter = router;

