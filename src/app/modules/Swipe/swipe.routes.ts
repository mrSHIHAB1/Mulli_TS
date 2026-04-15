import express from "express";

import {
  getUsersILiked,
  getUsersWhoLikedMe,
  // giftUser,
  likeUser,
  superLikeUser,
  passUser,
} from "./swipe.controllers";
import { checkAuth } from "../../middlewares/checkAuth";
import { Role } from "../user/user.interface";

const router = express.Router();

router.post("/pass/:id", checkAuth(...Object.values(Role)), passUser);

router.post("/like/:id", checkAuth(...Object.values(Role)), likeUser);
router.post("/super-like/:id", checkAuth(...Object.values(Role)), superLikeUser);
router.get("/liked-by-me", checkAuth(...Object.values(Role)), getUsersILiked);
router.get("/liked-me", checkAuth(...Object.values(Role)), getUsersWhoLikedMe);

// router.post("/gift", checkAuth(...Object.values(Role)), giftUser);

export const swipeRouter = router;

