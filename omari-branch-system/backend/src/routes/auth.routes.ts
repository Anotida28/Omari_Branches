import { Router } from "express";

import {
  loginHandler,
  getCurrentUserHandler,
  logoutHandler,
} from "../controllers/auth.controller";
import { requireAuthenticatedUser } from "../middlewares/auth";

const router = Router();

router.post("/login", loginHandler);
router.get("/me", requireAuthenticatedUser, getCurrentUserHandler);
router.post("/logout", requireAuthenticatedUser, logoutHandler);

export default router;
