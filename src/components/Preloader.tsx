"use client";

import Image from "next/image";
import { motion } from "framer-motion";

interface PreloaderProps {
  label?: string;
  fullScreen?: boolean;
  className?: string;
}

function Preloader({ label = "در حال بارگذاری…", fullScreen = true, className = "" }: PreloaderProps) {
  return (
    <div
      role="status"
      aria-live="polite"
      className={`flex flex-col items-center justify-center gap-4 ${
        fullScreen ? "fixed inset-0 z-100 bg-cream" : "py-14"
      } ${className}`}
    >
      <div className="relative flex h-16 w-16 items-center justify-center">
        <motion.span
          className="absolute inset-0 rounded-full border-[3px] border-sand-100 border-t-sand-400"
          animate={{ rotate: 360 }}
          transition={{ repeat: Infinity, duration: 0.9, ease: "linear" }}
        />
        <motion.div
          animate={{ scale: [1, 1.08, 1] }}
          transition={{ repeat: Infinity, duration: 1.6, ease: "easeInOut" }}
          className="flex h-9 w-9 items-center justify-center"
        >
          <Image src="/assets/logo.png" alt="" width={36} height={36} className="h-9 w-9 object-contain" />
        </motion.div>
      </div>
      {label && <p className="text-sm font-semibold text-cocoa-500">{label}</p>}
      <span className="sr-only">در حال بارگذاری</span>
    </div>
  );
}

export default Preloader;
