import { Router } from "express";
import multer from "multer";
import path from "node:path";
import fs from "node:fs";
import crypto from "node:crypto";
import { UPLOADS_DIR } from "../../lib/uploads.js";

export const adminUploadsRouter = Router();

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

adminUploadsRouter.post("/", (req, res) => {
  // Handled inline (not via asyncHandler) so multer's fileFilter/limit
  // errors surface as the specific message here instead of falling through
  // to the app's generic 500 error handler.
  upload.single("file")(req, res, (err: unknown) => {
    if (err instanceof multer.MulterError && err.code === "LIMIT_FILE_SIZE") {
      res.status(400).json({ error: "حجم فایل نباید بیشتر از ۵ مگابایت باشد" });
      return;
    }
    if (err) {
      const message = err instanceof Error ? err.message : "خطا در آپلود فایل";
      res.status(400).json({ error: message });
      return;
    }
    if (!req.file) {
      res.status(400).json({ error: "فایلی ارسال نشد" });
      return;
    }
    res.status(201).json({ url: `/uploads/${req.file.filename}` });
  });
});
