import { Router } from "express";

import {
  createDocumentHandler,
  deleteDocumentHandler,
  openDocumentHandler,
  uploadDocumentHandler,
} from "../controllers/documents.controller";
import { documentUpload } from "../middlewares/document-upload";

const router = Router();

router.post("/upload", documentUpload.single("file"), uploadDocumentHandler);
router.post("/", createDocumentHandler);
router.get("/:id/open", openDocumentHandler);
router.delete("/:id", deleteDocumentHandler);

export default router;
