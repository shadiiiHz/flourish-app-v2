"use client";

import { useEffect } from "react";
import { useOrderType } from "@/context/OrderTypeContext";
import { useSiteStatus } from "@/context/SiteStatusContext";

const AUTO_SWITCHED_KEY = "flourish-auto-preorder";

function readFlag() {
  try {
    return window.localStorage.getItem(AUTO_SWITCHED_KEY) === "1";
  } catch {
    return false;
  }
}

function writeFlag(on: boolean) {
  try {
    if (on) window.localStorage.setItem(AUTO_SWITCHED_KEY, "1");
    else window.localStorage.removeItem(AUTO_SWITCHED_KEY);
  } catch {
    // storage unavailable — the flag is only a convenience
  }
}

/**
 * Keeps the customer's order type in step with the site's open/closed state:
 * while the site is closed, an instant order is switched to a preorder
 * automatically and the order-type modal opens to pick its date/time. Once the
 * site opens again, a customer who was switched that way and never picked a
 * preorder time quietly goes back to an instant order (no modal).
 */
function ClosureOrderTypeSync() {
  const { siteClosed } = useSiteStatus();
  const { orderType, preorder, setInstant, startPreorder, openModal } = useOrderType();

  useEffect(() => {
    if (siteClosed) {
      if (orderType === "instant") {
        writeFlag(true);
        startPreorder();
        // Ask for the preorder date/time right away, rather than leaving the customer in a half-set preorder.
        openModal();
      }
      return;
    }
    if (readFlag()) {
      writeFlag(false);
      if (!preorder) setInstant();
    }
  }, [siteClosed, orderType, preorder, setInstant, startPreorder, openModal]);

  return null;
}

export default ClosureOrderTypeSync;
