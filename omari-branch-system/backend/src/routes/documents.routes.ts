import { Router } from "express";

import {
  createDocumentHandler,
  deleteDocumentHandler,
} from "../controllers/documents.controller";

const router = Router();

router.post("/", createDocumentHandler);
router.delete("/:id", deleteDocumentHandler);

export default router;
