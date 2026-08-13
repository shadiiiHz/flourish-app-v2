"use client";

import { useState } from "react";
import { AnimatePresence, motion, type PanInfo } from "framer-motion";
import { ChevronLeft, ChevronRight } from "lucide-react";

const placeholder = "/assets/placeholder.png";

const SWIPE_THRESHOLD = 40;

function ImagePlaceholder({ alt }: { alt: string }) {
  return (
    <div
      role="img"
      aria-label={alt}
      className="absolute inset-0 flex h-full w-full items-center justify-center bg-white"
    >
      <img src={placeholder} alt="" className="object-contain" />
    </div>
  );
}

function ProductImageSlider({
  images,
  alt,
  aspectClassName = "aspect-square",
}: {
  images: string[];
  alt: string;
  aspectClassName?: string;
}) {
  const [index, setIndex] = useState(0);
  const [failedSrcs, setFailedSrcs] = useState<Record<number, boolean>>({});
  const hasImages = images.length > 0;
  const hasMultiple = images.length > 1;

  const go = (direction: 1 | -1) => {
    setIndex((i) => (i + direction + images.length) % images.length);
  };

  const handlePanEnd = (
    _event: MouseEvent | TouchEvent | PointerEvent,
    info: PanInfo,
  ) => {
    if (info.offset.x <= -SWIPE_THRESHOLD) go(1);
    else if (info.offset.x >= SWIPE_THRESHOLD) go(-1);
  };

  const currentFailed = !hasImages || failedSrcs[index];

  return (
    <div className={`group/slider relative ${aspectClassName} w-full overflow-hidden bg-white`}>
      <motion.div
        className="relative h-full w-full touch-pan-y"
        onPanEnd={hasMultiple ? handlePanEnd : undefined}
      >
        {currentFailed ? (
          <ImagePlaceholder alt={alt} />
        ) : (
          <AnimatePresence initial={false} mode="wait">
            <motion.img
              key={index}
              src={images[index]}
              alt={alt}
              draggable={false}
              onError={() =>
                setFailedSrcs((prev) => ({ ...prev, [index]: true }))
              }
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.4, ease: "easeInOut" }}
              className="absolute inset-0 h-full w-full object-cover"
            />
          </AnimatePresence>
        )}
      </motion.div>

      {hasMultiple && (
        <>
          <button
            type="button"
            aria-label="تصویر بعدی"
            onClick={(e) => {
              e.stopPropagation();
              go(1);
            }}
            className="absolute left-2 top-1/2 z-10 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-full bg-white/85 text-cocoa-700 opacity-0 shadow-sm backdrop-blur transition-opacity group-hover/slider:opacity-100"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <button
            type="button"
            aria-label="تصویر قبلی"
            onClick={(e) => {
              e.stopPropagation();
              go(-1);
            }}
            className="absolute right-2 top-1/2 z-10 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-full bg-white/85 text-cocoa-700 opacity-0 shadow-sm backdrop-blur transition-opacity group-hover/slider:opacity-100"
          >
            <ChevronRight className="h-4 w-4" />
          </button>

          <div className="absolute inset-x-0 bottom-2 flex items-center justify-center gap-1.5">
            {images.map((_, i) => (
              <button
                key={i}
                type="button"
                aria-label={`رفتن به تصویر ${i + 1}`}
                onClick={(e) => {
                  e.stopPropagation();
                  setIndex(i);
                }}
                className={`h-1.5 rounded-full transition-all duration-300 ${
                  i === index ? "w-4 bg-white" : "w-1.5 bg-white/60"
                }`}
              />
            ))}
          </div>
        </>
      )}
    </div>
  );
}

export default ProductImageSlider;
