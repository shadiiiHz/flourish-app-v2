"use client";

import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";

function GoToTop() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const handleScroll = () => setVisible(window.scrollY > 400);
    handleScroll();
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  const scrollToTop = () => {
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  return (
    <AnimatePresence>
      {visible && (
        <motion.button
          type="button"
          onClick={scrollToTop}
          aria-label="بازگشت به بالا"
          initial={{ opacity: 0, y: 20, scale: 0.8 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 20, scale: 0.8 }}
          whileHover={{ scale: 1.06, y: -2 }}
          whileTap={{ scale: 0.94 }}
          transition={{ duration: 0.25, ease: "easeOut" }}
          className="fixed z-50 flex items-center justify-center  sm:bottom-8 sm:inset-s-4 sm:h-10 sm:w-10"
        >
          <motion.img
            src="/assets/go-to-top.svg"
            alt=""
            aria-hidden="true"
            className="h-full w-full select-none"
          />
        </motion.button>
      )}
    </AnimatePresence>
  );
}

export default GoToTop;
