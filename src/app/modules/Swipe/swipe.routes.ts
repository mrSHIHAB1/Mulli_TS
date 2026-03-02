import express from "express";

import {
  getUsersILiked,
  getUsersWhoLikedMe,
  giftUser,
  likeUser,
  passUser,
} from "./swipe.controllers";
import { checkAuth } from "../../middlewares/checkAuth";
import { Role } from "../user/user.interface";

const router = express.Router();

router.post("/pass", checkAuth(...Object.values(Role)), passUser);

router.post("/like", checkAuth(...Object.values(Role)), likeUser);
router.get("/liked-by-me", checkAuth(...Object.values(Role)), getUsersILiked);
router.get("/liked-me", checkAuth(...Object.values(Role)), getUsersWhoLikedMe);

router.post("/gift", checkAuth(...Object.values(Role)), giftUser);

export const swipeRouter = router;

