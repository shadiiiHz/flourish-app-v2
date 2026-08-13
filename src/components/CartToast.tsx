"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion } from "framer-motion";
import { CheckCircle2 } from "lucide-react";
import { useCart } from "../context/CartContext";

function CartToast() {
  const { toast } = useCart();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) return null;

  return createPortal(
    <div className="pointer-events-none fixed inset-x-0 bottom-5 z-[110] flex justify-center px-4 sm:bottom-8">
      <AnimatePresence>
        {toast && (
          <motion.div
            initial={{ opacity: 0, y: 16, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 10, scale: 0.96 }}
            transition={{ type: "spring", stiffness: 340, damping: 28 }}
            className="flex items-center gap-2 rounded-full border border-white/40 bg-sand-200/30 px-4 py-2.5 text-sm font-semibold text-cocoa-500 shadow-[0_20px_50px_-20px_rgba(0,0,0,0.6)] backdrop-blur-xl"
          >
            <CheckCircle2 className="h-4.5 w-4.5 text-cocoa-500" />
            {toast}
          </motion.div>
        )}
      </AnimatePresence>
    </div>,
    document.body,
  );
}

export default CartToast;
