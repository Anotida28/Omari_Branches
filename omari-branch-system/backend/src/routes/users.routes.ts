import { Router } from "express";

import {
  createUserHandler,
  listUsersHandler,
  updateUserHandler,
} from "../controllers/users.controller";
import { requireSuperAdmin } from "../middlewares/auth";

const router = Router();

router.use(requireSuperAdmin);

router.get("/", listUsersHandler);
router.post("/", createUserHandler);
router.patch("/:id", updateUserHandler);

export default router;
