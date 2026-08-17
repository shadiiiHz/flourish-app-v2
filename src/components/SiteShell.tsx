"use client";

import { useEffect, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { AnimatePresence } from "framer-motion";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import GoToTop from "@/components/GoToTop";
import CartDrawer from "@/components/CartDrawer";
import CartToast from "@/components/CartToast";
import AuthModal from "@/components/AuthModal";
import AuthToast from "@/components/AuthToast";
import PreorderBanner from "@/components/PreorderBanner";
import OrderTypeModal from "@/components/OrderTypeModal";
import { useCart } from "@/context/CartContext";
import { SiteStatusProvider } from "@/context/SiteStatusContext";
import SiteClosedBanner from "./SiteClosedBanner";

function CartOverlay() {
  const { isOpen } = useCart();
  return (
    <>
      <AnimatePresence>{isOpen && <CartDrawer />}</AnimatePresence>
      <CartToast />
    </>
  );
}

export default function SiteShell({
  children,
  siteClosed = false,
}: {
  children: ReactNode;
  siteClosed?: boolean;
}) {
  const router = useRouter();

  // Neither router.push() call site for these two destinations goes
  // through <Link>, so they'd never get Next's automatic prefetch —
  // warm the RSC payload once up front instead of paying full latency
  // on every click into the menu or checkout.
  useEffect(() => {
    router.prefetch("/menu");
    router.prefetch("/checkout");
  }, [router]);

  return (
    <SiteStatusProvider siteClosed={siteClosed}>
      <div className="relative min-h-svh overflow-x-clip bg-cream text-cocoa-900">
        <div
          aria-hidden="true"
          className="pointer-events-none fixed inset-0 z-0 opacity-[0.03]"
          style={{
            backgroundImage: "url(/assets/logo.png)",
            backgroundRepeat: "repeat",
            backgroundSize: "100px 100px",
          }}
        />

        <div className="relative z-10">
          <div id="site-header" className="sticky top-0 z-50">
            <SiteClosedBanner />
            <PreorderBanner />
            <Header />
          </div>
          <main>{children}</main>
          <Footer />
        </div>
        <GoToTop />
        <CartOverlay />
        <AuthModal />
        <AuthToast />
        <OrderTypeModal />
      </div>
    </SiteStatusProvider>
  );
}
