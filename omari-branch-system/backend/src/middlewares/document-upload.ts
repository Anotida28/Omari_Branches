import crypto from "crypto";
import fs from "fs";
import path from "path";

import multer from "multer";

const DOCUMENT_UPLOAD_DIR = path.resolve(process.cwd(), "uploads", "documents");
const MAX_DOCUMENT_SIZE_BYTES = 10 * 1024 * 1024; // 10MB

function ensureUploadDirectory(): void {
  fs.mkdirSync(DOCUMENT_UPLOAD_DIR, { recursive: true });
}

function sanitizeExtension(fileName: string): string {
  const ext = path.extname(fileName).toLowerCase();
  if (!ext) {
    return "";
  }

  const cleaned = ext.replace(/[^a-z0-9.]/g, "");
  if (cleaned.length > 12) {
    return "";
  }

  return cleaned;
}

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    try {
      ensureUploadDirectory();
      cb(null, DOCUMENT_UPLOAD_DIR);
    } catch (error) {
      cb(error as Error, DOCUMENT_UPLOAD_DIR);
    }
  },
  filename: (_req, file, cb) => {
    const extension = sanitizeExtension(file.originalname);
    const uniqueFileName = `${Date.now()}-${crypto.randomUUID()}${extension}`;
    cb(null, uniqueFileName);
  },
});

export const documentUpload = multer({
  storage,
  limits: {
    fileSize: MAX_DOCUMENT_SIZE_BYTES,
    files: 1,
  },
});

