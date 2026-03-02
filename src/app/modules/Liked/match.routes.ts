import { Router } from "express";
import { getMatches, getMyMatches } from "./match.controller";
import { checkAuth } from "../../middlewares/checkAuth";
import { Role } from "../user/user.interface";


const router = Router();

router.get("/matches", checkAuth(...Object.values(Role)), getMatches);
router.get("/my-matches",  checkAuth(...Object.values(Role)), getMyMatches);

export const matchRoutes = router;

