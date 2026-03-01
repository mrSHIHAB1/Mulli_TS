import { Router } from "express";
import { getMatches, getMyMatches } from "./match.controller";
import { checkAuth } from "../../middlewares/checkAuth";

const router = Router();

router.get("/matches", checkAuth("user", "admin"), getMatches);
router.get("/my-matches", checkAuth("user", "admin"), getMyMatches);

export const matchRoutes = router;

