import { Router } from "express";
import { z } from "zod";
import { prisma } from "../../lib/prisma.js";
import { asyncHandler } from "../../lib/asyncHandler.js";
import { deleteUploadedFile } from "../../lib/uploads.js";

export const adminHeroSlidesRouter = Router();

const heroSlideSchema = z.object({
  image: z.string().min(1),
  sortOrder: z.number().int().optional(),
});

adminHeroSlidesRouter.get(
  "/",
  asyncHandler(async (_req, res) => {
    const slides = await prisma.heroSlide.findMany({
      orderBy: [{ sortOrder: "asc" }, { id: "asc" }],
    });
    res.json(slides);
  }),
);

adminHeroSlidesRouter.post(
  "/",
  asyncHandler(async (req, res) => {
    const parsed = heroSlideSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "اطلاعات اسلاید نامعتبر است" });
      return;
    }
    const slide = await prisma.heroSlide.create({ data: parsed.data });
    res.status(201).json(slide);
  }),
);

adminHeroSlidesRouter.put(
  "/:id",
  asyncHandler(async (req, res) => {
    const parsed = heroSlideSchema.partial().safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "اطلاعات اسلاید نامعتبر است" });
      return;
    }
    const previous = await prisma.heroSlide.findUnique({ where: { id: req.params.id } });
    const slide = await prisma.heroSlide.update({
      where: { id: req.params.id },
      data: parsed.data,
    });
    if (parsed.data.image !== undefined && previous && previous.image !== slide.image) {
      await deleteUploadedFile(previous.image);
    }
    res.json(slide);
  }),
);

adminHeroSlidesRouter.delete(
  "/:id",
  asyncHandler(async (req, res) => {
    const slide = await prisma.heroSlide.delete({ where: { id: req.params.id } });
    await deleteUploadedFile(slide.image);
    res.status(204).end();
  }),
);
