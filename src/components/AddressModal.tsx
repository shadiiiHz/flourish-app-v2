"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import dynamic from "next/dynamic";
import { AnimatePresence, motion } from "framer-motion";
import { X } from "lucide-react";
import { useAddresses, type Address } from "../context/AddressContext";
import type { PickedLocation } from "./AddressMapPicker";

const AddressMapPicker = dynamic(() => import("./AddressMapPicker"), {
  ssr: false,
  loading: () => (
    <div className="flex h-72 items-center justify-center rounded-2xl border border-cocoa-900/10 bg-sand-50/40 text-xs text-cocoa-500 sm:h-96">
      در حال بارگذاری نقشه…
    </div>
  ),
});

function FieldShell({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="relative z-10">
      <span
        className="absolute -top-2.5 right-4 z-10 px-2 text-xs font-semibold text-sand-500"
        style={{background: "linear-gradient(to bottom, #F8F8F7 60%, #FFFFFF 100%)"}}
      >
        {label}
      </span>
      {children}
    </div>
  );
}

interface AddressModalProps {
  isOpen: boolean;
  editingAddress: Address | null;
  onClose: () => void;
}

function AddressModal({ isOpen, editingAddress, onClose }: AddressModalProps) {
  const { addresses, addAddress, updateAddress } = useAddresses();
  const isOnlyAddress = editingAddress ? addresses.length === 1 : addresses.length === 0;
  const [address, setAddress] = useState("");
  const [details, setDetails] = useState("");
  const [phone, setPhone] = useState("");
  const [title, setTitle] = useState("");
  const [isDefault, setIsDefault] = useState(true);
  const [location, setLocation] = useState<PickedLocation | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Reset (or prefill, when editing) the form when the modal opens
  // (adjusting state during render, per React's guidance, instead of a
  // setState-in-effect).
  const [prevIsOpen, setPrevIsOpen] = useState(isOpen);
  if (isOpen !== prevIsOpen) {
    setPrevIsOpen(isOpen);
    if (isOpen) {
      setAddress(editingAddress?.address ?? "");
      setDetails(editingAddress?.details ?? "");
      setPhone(editingAddress?.phone ?? "");
      setTitle(editingAddress?.title ?? "");
      setIsDefault(true);
      setLocation(
        editingAddress?.lng !== undefined && editingAddress?.lat !== undefined
          ? { lng: editingAddress.lng, lat: editingAddress.lat }
          : null,
      );
      setError(null);
    }
  }

  useEffect(() => {
    if (!isOpen) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKeyDown);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = previousOverflow;
    };
  }, [isOpen, onClose]);

  const handleLocationChange = (picked: PickedLocation) => {
    setLocation(picked);
    if (picked.address) setAddress(picked.address);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!address.trim()) {
      setError("لطفاً آدرس را وارد کنید");
      return;
    }
    const data = {
      address: address.trim(),
      details: details.trim() || undefined,
      phone: phone.trim() || undefined,
      title: title.trim() || undefined,
      lng: location?.lng,
      lat: location?.lat,
      isDefault: isOnlyAddress || isDefault,
    };
    if (editingAddress) updateAddress(editingAddress.id, data);
    else addAddress(data);
    onClose();
  };

  if (!mounted) return null;

  return createPortal(
    <AnimatePresence>
      {isOpen && (
        <motion.div
          className="fixed inset-0 z-100 overflow-y-auto"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.25 }}
        >
          <div className="fixed inset-0 bg-cocoa-900/40 backdrop-blur-sm" />

          <div
            className="relative flex min-h-full items-center justify-center p-3 sm:p-6"
            onClick={onClose}
          >
            <motion.div
              role="dialog"
              aria-modal="true"
              aria-labelledby="address-modal-title"
              initial={{ opacity: 0, scale: 0.94, y: 16 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.96, y: 12 }}
              transition={{ type: "spring", stiffness: 320, damping: 30 }}
              onClick={(e) => e.stopPropagation()}
              className="relative w-full max-w-2xl rounded-[1.75rem] border border-white/40 bg-white/95 shadow-[inset_0_1px_0_0_rgba(255,255,255,0.5),0_40px_80px_-30px_rgba(74,44,18,0.55)] backdrop-blur-2xl backdrop-saturate-150 sm:rounded-[2rem]"
            >
              <div className="flex items-center justify-between gap-3 border-b border-sand-50 p-5 sm:p-6">
                <h2 id="address-modal-title" className="font-display text-lg font-bold text-cocoa-900">
                  {editingAddress ? "ویرایش آدرس" : "ثبت آدرس جدید"}
                </h2>
                <button
                  type="button"
                  aria-label="بستن"
                  onClick={onClose}
                  className="flex h-9 w-9 items-center justify-center rounded-full border border-cocoa-900/10 bg-white text-cocoa-700 shadow-sm transition hover:bg-sand-50"
                >
                  <X className="h-4.5 w-4.5" />
                </button>
              </div>

              <form onSubmit={handleSubmit}>
                <div className="flex flex-col gap-4 p-5 sm:p-6">
                  <AddressMapPicker initialLocation={location} onLocationChange={handleLocationChange} />

                  <div className="flex flex-col">
                    <FieldShell label="آدرس">
                      <textarea
                        value={address}
                        onChange={(e) => {
                          setError(null);
                          setAddress(e.target.value);
                        }}
                        rows={3}
                        className={`w-full resize-none rounded-2xl border bg-white px-4 py-3.5 text-right text-base text-cocoa-900 outline-none transition focus:ring-2 focus:ring-sand-400/25 ${
                          error ? "border-danger-500" : "border-cocoa-900/10 focus:border-sand-400"
                        }`}
                      />
                    </FieldShell>
                    {error && <p className="text-xs font-semibold text-danger-500">{error}</p>}
                  </div>

                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <FieldShell label="پلاک، واحد">
                      <input
                        type="text"
                        value={details}
                        onChange={(e) => setDetails(e.target.value)}
                        className="w-full rounded-2xl border border-cocoa-900/10 bg-white px-4 py-3.5 text-right text-base text-cocoa-900 outline-none transition focus:border-sand-400 focus:ring-2 focus:ring-sand-400/25"
                      />
                    </FieldShell>

                    <FieldShell label="شماره تماس (اختیاری)">
                      <input
                        type="tel"
                        inputMode="numeric"
                        dir="ltr"
                        value={phone}
                        onChange={(e) => setPhone(e.target.value)}
                        className="w-full rounded-2xl border border-cocoa-900/10 bg-white px-4 py-3.5 text-right text-base text-cocoa-900 outline-none transition focus:border-sand-400 focus:ring-2 focus:ring-sand-400/25"
                      />
                    </FieldShell>
                  </div>

                  <FieldShell label="عنوان آدرس (اختیاری)">
                    <input
                      type="text"
                      value={title}
                      onChange={(e) => setTitle(e.target.value)}
                      className="w-full rounded-2xl border border-cocoa-900/10 bg-white px-4 py-3.5 text-right text-base text-cocoa-900 outline-none transition focus:border-sand-400 focus:ring-2 focus:ring-sand-400/25"
                    />
                  </FieldShell>

                  <label className="flex w-fit items-center gap-2 text-sm font-semibold text-cocoa-900 has-[:disabled]:cursor-not-allowed has-[:disabled]:opacity-60">
                    <input
                      type="checkbox"
                      checked={isOnlyAddress || isDefault}
                      disabled={isOnlyAddress}
                      onChange={(e) => setIsDefault(e.target.checked)}
                      className="h-4.5 w-4.5 rounded border-cocoa-900/20 accent-sand-500 focus:ring-2 focus:ring-sand-400/25"
                    />
                    پیش‌فرض
                  </label>
                </div>

                <div className="border-t border-sand-50 p-5 sm:p-6">
                  <button
                    type="submit"
                    className="w-full rounded-full bg-sand-500 px-4 py-3.5 text-sm font-bold text-white shadow-[0_10px_20px_-8px_rgba(164,72,25,0.6)] transition-transform hover:scale-[1.02] active:scale-95"
                  >
                    {editingAddress ? "ذخیره تغییرات" : "ثبت"}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body,
  );
}

export default AddressModal;
