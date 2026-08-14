import { Router } from "express";
import multer from "multer";
import path from "node:path";
import fs from "node:fs";
import crypto from "node:crypto";

export const adminUploadsRouter = Router();

const UPLOADS_DIR = path.join(process.cwd(), "uploads");
fs.mkdirSync(UPLOADS_DIR, { recursive: true });

const ALLOWED_MIME = new Set(["image/png", "image/jpeg", "image/webp", "image/svg+xml"]);

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, UPLOADS_DIR),
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    cb(null, `${crypto.randomUUID()}${ext}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (!ALLOWED_MIME.has(file.mimetype)) {
      cb(new Error("فرمت فایل مجاز نیست"));
      return;
    }
    cb(null, true);
  },
});

adminUploadsRouter.post("/", upload.single("file"), (req, res) => {
  if (!req.file) {
    res.status(400).json({ error: "فایلی ارسال نشد" });
    return;
  }
  res.status(201).json({ url: `/uploads/${req.file.filename}` });
});
