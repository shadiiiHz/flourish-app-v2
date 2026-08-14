"use client";

import { useState } from "react";
import { MapPin, Pencil, Phone, Plus, Trash2 } from "lucide-react";
import { useAddresses, type Address } from "../context/AddressContext";
import AddressModal from "./AddressModal";
import ConfirmModal from "./ConfirmModal";
import Preloader from "./Preloader";
import { toPersianDigits } from "../utils/phone";

function AddressesPanel() {
  const { addresses, isLoading, removeAddress } = useAddresses();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingAddress, setEditingAddress] = useState<Address | null>(null);
  const [deletingAddress, setDeletingAddress] = useState<Address | null>(null);

  const openNewModal = () => {
    setEditingAddress(null);
    setIsModalOpen(true);
  };

  const openEditModal = (item: Address) => {
    setEditingAddress(item);
    setIsModalOpen(true);
  };

  return (
    <div className="rounded-[1.75rem] border border-white/40 bg-white/80 p-5 shadow-[inset_0_1px_0_0_rgba(255,255,255,0.5),0_30px_60px_-30px_rgba(74,44,18,0.35)] backdrop-blur-2xl backdrop-saturate-150 sm:rounded-[2rem] sm:p-7">
      <div className="flex items-center justify-between gap-3">
        <h2 className="flex items-center gap-2 font-display text-lg font-bold text-cocoa-900">
          آدرس‌های من
          <MapPin className="h-5 w-5 text-sand-500" />
        </h2>
        <button
          type="button"
          onClick={openNewModal}
          className="flex items-center gap-1.5 rounded-full bg-sand-500 px-4 py-2.5 text-sm font-bold text-white shadow-[0_10px_20px_-8px_rgba(164,72,25,0.6)] transition-transform hover:scale-[1.02] active:scale-95"
        >
          <Plus className="h-4 w-4" />
          ثبت آدرس جدید
        </button>
      </div>

      {isLoading ? (
        <Preloader fullScreen={false} />
      ) : addresses.length === 0 ? (
        <p className="mt-2 text-sm font-semibold text-sand-500">
          آدرسی ثبت نشده است، لطفا آدرس خود را ثبت نمایید.
        </p>
      ) : (
        <div className="mt-5 flex flex-col gap-3">
          {addresses.map((item) => (
            <div
              key={item.id}
              className="flex items-start justify-between gap-3 rounded-2xl border border-sand-100 bg-white p-4"
            >
              <div className="min-w-0 flex-1">
                <p className="flex items-center gap-2 text-sm font-bold text-cocoa-900">
                  {item.title || "بدون عنوان"}
                  {item.isDefault && (
                    <span className="rounded-full bg-sand-50 px-2 py-0.5 text-[11px] font-semibold text-sand-500">
                      پیش‌فرض
                    </span>
                  )}
                </p>
                <p className="mt-0.5 text-sm text-cocoa-700">
                  {item.address}
                  {item.details && ` — ${item.details}`}
                </p>
                {item.phone && (
                  <p className="mt-1 flex items-center gap-1.5 text-xs text-cocoa-500" dir="ltr">
                    <Phone className="h-3.5 w-3.5 shrink-0" />
                    {toPersianDigits(item.phone)}
                  </p>
                )}
              </div>
              <div className="flex shrink-0 items-center gap-1">
                <button
                  type="button"
                  aria-label="ویرایش آدرس"
                  onClick={() => openEditModal(item)}
                  className="text-cocoa-400 transition hover:text-sand-500"
                >
                  <Pencil className="h-4.5 w-4.5" />
                </button>
                <button
                  type="button"
                  aria-label="حذف آدرس"
                  disabled={item.isDefault || addresses.length <= 1}
                  onClick={() => setDeletingAddress(item)}
                  className="text-cocoa-400 transition hover:text-danger-500 disabled:pointer-events-none disabled:opacity-30"
                >
                  <Trash2 className="h-4.5 w-4.5" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      <AddressModal
        isOpen={isModalOpen}
        editingAddress={editingAddress}
        onClose={() => setIsModalOpen(false)}
      />

      <ConfirmModal
        isOpen={!!deletingAddress}
        title="حذف آدرس"
        description={
          deletingAddress
            ? `آیا مطمئنید می‌خواهید «${deletingAddress.title || deletingAddress.address}» را حذف کنید؟`
            : undefined
        }
        confirmLabel="بله، حذف شود"
        cancelLabel="انصراف"
        onConfirm={() => {
          if (deletingAddress) removeAddress(deletingAddress.id);
        }}
        onClose={() => setDeletingAddress(null)}
      />
    </div>
  );
}

export default AddressesPanel;
