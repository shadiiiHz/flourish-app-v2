"use client";

import { motion } from "framer-motion";
import Link from "next/link";
import Image from "next/image";
import { useCart } from "../context/CartContext";
import { useAuth } from "../context/AuthContext";
import ProfileMenu from "./ProfileMenu";

function Header() {
  const { totalCount, openCart } = useCart();
  const { isAuthenticated, openAuth } = useAuth();

  return (
    <motion.header
      id="site-header"
      initial={{ opacity: 0, y: -24 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6, ease: "easeOut" }}
      className="sticky top-0 z-50 px-3 pt-3 sm:px-6 sm:pt-5"
    >
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 rounded-full border border-white/40 bg-white/40 px-3 py-2.5 shadow-[inset_0_1px_0_0_rgba(255,255,255,0.5),0_10px_30px_-12px_rgba(138,84,39,0.25)] backdrop-blur-2xl backdrop-saturate-150 sm:px-6 sm:py-3">
        {/* Logo + nav — right side in RTL */}
        <div className="flex items-center justify-center gap-3 sm:gap-5">
          <Link
            href="/"
            onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
            className="flex h-10 w-10 shrink-0 items-center justify-center self-center overflow-hidden sm:h-14 sm:w-14"
          >
            <Image
              src="/assets/textLogo.png"
              alt="لوگوی فلوریش"
              width={112}
              height={112}
              priority
              className="h-full w-full object-contain object-center"
            />
          </Link>

          {/* <nav className="flex items-center">
            <Link
              to="/menu"
              className="text-sm font-bold text-sand-500 transition-colors hover:text-sand-500 sm:text-base"
            >
              منو
            </Link>
          </nav> */}
        </div>

        {/* Actions — left side in RTL */}
        <div className="flex items-center gap-2 sm:gap-4">
          {isAuthenticated ? (
            <ProfileMenu />
          ) : (
            <button
              type="button"
              onClick={() => openAuth()}
              className="flex items-center gap-1.5 rounded-full px-2 py-1.5 transition-colors hover:bg-sand-50/60 sm:gap-2 sm:px-3"
            >
              <span className="text-sm font-medium text-sand-500 sm:text-base">ورود</span>
              <span className="h-4 w-px bg-cocoa-700/30" />
              <span className="text-sm font-bold text-sand-500 sm:text-base">ثبت‌نام</span>
            </button>
          )}

          <button
            type="button"
            onClick={openCart}
            aria-label="سبد خرید"
            className="relative flex h-10 w-10 shrink-0 items-center justify-center text-cocoa-900 sm:h-11 sm:w-11"
          >
            <Image
              src="/assets/basketShopping.svg"
              alt=""
              width={100}
              height={100}
              className="h-25 w-25 object-cover rounded-full bg-transparent"
            />
            {totalCount > 0 && (
              <span className="absolute -top-0.5 -end-0.5 flex h-4.5 min-w-4.5 items-center justify-center rounded-full bg-sand-500 px-1 text-[10px] font-bold text-white ring-2 ring-white">
                {totalCount.toLocaleString("fa-IR")}
              </span>
            )}
          </button>
        </div>
      </div>
    </motion.header>
  );
}

export default Header;
