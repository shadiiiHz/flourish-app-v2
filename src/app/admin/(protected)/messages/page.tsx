"use client";

import { useEffect, useState } from "react";
import { Cake, ChevronDown, Gift, Mail, MailOpen, Trash2 } from "lucide-react";
import {
  ApiError,
  adminBulkDeleteMessages,
  adminCreateBirthdayDiscountFromMessage,
  adminDeleteMessage,
  adminGetMessages,
  adminMarkMessageRead,
} from "@/lib/api";
import { toPersianDigits } from "@/lib/formatNumber";
import type { AdminMessage } from "@/types/admin";
import ConfirmModal from "@/components/ConfirmModal";

const TYPE_ICON: Record<AdminMessage["type"], typeof Cake> = {
  birthday: Cake,
};

function formatMessageDate(iso: string): string {
  const d = new Date(iso);
  return `${d.toLocaleDateString("fa-IR")} — ${d.toLocaleTimeString("fa-IR", {
    hour: "2-digit",
    minute: "2-digit",
  })}`;
}

function BirthdayDiscountAction({
  message,
  onCreated,
}: {
  message: AdminMessage;
  onCreated: (code: string) => void;
}) {
  const [percent, setPercent] = useState("20");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleCreate = async () => {
    const value = Number(percent);
    if (!Number.isInteger(value) || value < 1 || value > 100) {
      setError("درصد تخفیف باید بین ۱ تا ۱۰۰ باشد");
      return;
    }
    setError(null);
    setSubmitting(true);
    try {
      const created = await adminCreateBirthdayDiscountFromMessage(message.id, value);
      onCreated(created.code);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "خطا در ایجاد کد تخفیف");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      onClick={(e) => e.stopPropagation()}
      className="mt-3 flex flex-wrap items-center gap-2 rounded-xl bg-sand-50/60 p-3"
    >
      <label className="flex items-center gap-1.5 text-xs font-semibold text-cocoa-600">
        درصد تخفیف
        <input
          type="number"
          min={1}
          max={100}
          value={percent}
          onChange={(e) => setPercent(e.target.value)}
          dir="ltr"
          className="w-16 rounded-lg border border-cocoa-900/10 bg-white px-2 py-1.5 text-center text-sm outline-none focus:border-sand-400"
        />
        ٪
      </label>
      <button
        type="button"
        onClick={handleCreate}
        disabled={submitting}
        className="flex items-center gap-1.5 rounded-full bg-sand-500 px-4 py-2 text-xs font-bold text-white shadow-[0_8px_16px_-8px_rgba(164,72,25,0.6)] transition-transform hover:scale-[1.02] active:scale-95 disabled:opacity-60"
      >
        <Gift className="h-3.5 w-3.5" />
        {submitting ? "در حال ایجاد…" : "ایجاد کد تخفیف"}
      </button>
      {error && <p className="w-full text-xs font-semibold text-danger-500">{error}</p>}
    </div>
  );
}

function MessageRow({
  message,
  selected,
  onToggleSelect,
  onRead,
  onDeleteRequest,
}: {
  message: AdminMessage;
  selected: boolean;
  onToggleSelect: (id: string) => void;
  onRead: (id: string) => void;
  onDeleteRequest: (message: AdminMessage) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const [createdCode, setCreatedCode] = useState<string | null>(null);
  const Icon = TYPE_ICON[message.type];

  const handleToggle = () => {
    setExpanded((v) => !v);
    if (!message.isRead) onRead(message.id);
  };

  return (
    <div
      onClick={handleToggle}
      className={`cursor-pointer rounded-2xl border p-4 transition ${
        message.isRead
          ? "border-cocoa-900/10 bg-white"
          : "border-sand-300 bg-sand-50/70 shadow-[0_10px_30px_-20px_rgba(164,72,25,0.5)]"
      }`}
    >
      <div className="flex items-start gap-3">
        <input
          type="checkbox"
          checked={selected}
          onChange={() => onToggleSelect(message.id)}
          onClick={(e) => e.stopPropagation()}
          className="mt-1.5 h-4 w-4 shrink-0 accent-sand-500"
          aria-label="انتخاب پیام"
        />
        <span
          className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${
            message.isRead ? "bg-sand-50 text-sand-400" : "bg-sand-500 text-white"
          }`}
        >
          <Icon className="h-5 w-5" />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            {!message.isRead && (
              <span className="h-2 w-2 shrink-0 rounded-full bg-sand-500" aria-label="خوانده‌نشده" />
            )}
            <p
              className={`truncate text-sm ${
                message.isRead ? "font-semibold text-cocoa-700" : "font-bold text-cocoa-900"
              }`}
            >
              {message.title}
            </p>
          </div>
          <p className="mt-1 text-xs text-cocoa-500">{message.body}</p>
          <p className="mt-1.5 text-[11px] text-cocoa-400">{formatMessageDate(message.createdAt)}</p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <span className="text-cocoa-400">
            {message.isRead ? (
              <MailOpen className="h-4 w-4" />
            ) : (
              <Mail className="h-4 w-4 text-sand-500" />
            )}
          </span>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onDeleteRequest(message);
            }}
            className="flex h-8 w-8 items-center justify-center rounded-full border border-danger-500/30 text-danger-500 outline-none transition hover:bg-danger-50 focus-visible:ring-2 focus-visible:ring-danger-500/40"
            aria-label="حذف پیام"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
          <ChevronDown
            className={`h-4 w-4 text-cocoa-400 transition-transform ${
              expanded ? "rotate-180" : ""
            }`}
          />
        </div>
      </div>

      {expanded && message.type === "birthday" && message.customerId && (
        <>
          {message.actionedAt || createdCode ? (
            <p className="mt-3 flex items-center gap-1.5 rounded-xl bg-sand-50/60 p-3 text-xs font-semibold text-sand-600">
              <Gift className="h-3.5 w-3.5" />
              {createdCode ? `کد تخفیف ایجاد شد: ${createdCode}` : "برای این پیام قبلاً کد تخفیف ایجاد شده است."}
            </p>
          ) : (
            <BirthdayDiscountAction message={message} onCreated={setCreatedCode} />
          )}
        </>
      )}
    </div>
  );
}

function AdminMessagesPage() {
  const [messages, setMessages] = useState<AdminMessage[]>([]);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [deletingMessage, setDeletingMessage] = useState<AdminMessage | null>(null);
  const [bulkDeleteOpen, setBulkDeleteOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const pageSize = 20;

  const load = () => {
    setLoading(true);
    adminGetMessages(page, pageSize)
      .then((res) => {
        setMessages(res.items);
        setTotal(res.total);
        setSelectedIds(new Set());
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
  }, [page]);

  const handleRead = (id: string) => {
    setMessages((prev) => prev.map((m) => (m.id === id ? { ...m, isRead: true } : m)));
    adminMarkMessageRead(id).catch(() => {
      // Best-effort — a failed sync here just means it'll be marked read again next click.
    });
  };

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleSelectAll = () => {
    setSelectedIds((prev) =>
      prev.size === messages.length ? new Set() : new Set(messages.map((m) => m.id)),
    );
  };

  const handleDelete = async (id: string) => {
    setError(null);
    try {
      await adminDeleteMessage(id);
      load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "خطا در حذف پیام");
    }
  };

  const handleBulkDelete = async () => {
    setError(null);
    try {
      await adminBulkDeleteMessages([...selectedIds]);
      load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "خطا در حذف گروهی");
    }
  };

  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-xl font-bold text-cocoa-900">پیام‌ها</h1>
          <p className="mt-1 text-sm text-cocoa-500">
            اعلان‌هایی مثل تولد مشتریان — از همین‌جا می‌تونی کد تخفیف تولدشون رو ایجاد کنی.
          </p>
        </div>
        {selectedIds.size > 0 && (
          <button
            type="button"
            onClick={() => setBulkDeleteOpen(true)}
            className="flex items-center gap-1.5 rounded-full bg-danger-500 px-4 py-2 text-xs font-bold text-white shadow-[0_10px_20px_-8px_rgba(193,97,90,0.6)] transition-transform hover:scale-[1.02] active:scale-95"
          >
            <Trash2 className="h-3.5 w-3.5" />
            حذف {toPersianDigits(String(selectedIds.size))} پیام
          </button>
        )}
      </div>

      {error && <p className="mt-3 text-xs font-semibold text-danger-500">{error}</p>}

      {messages.length > 0 && (
        <label className="mt-4 flex w-fit items-center gap-2 text-xs font-semibold text-cocoa-600">
          <input
            type="checkbox"
            checked={selectedIds.size === messages.length}
            onChange={toggleSelectAll}
            className="h-4 w-4 accent-sand-500"
          />
          انتخاب همه
        </label>
      )}

      <div className="mt-2.5 flex flex-col gap-2.5">
        {loading ? (
          <p className="text-sm text-cocoa-500">در حال بارگذاری…</p>
        ) : messages.length === 0 ? (
          <p className="rounded-2xl border border-cocoa-900/10 bg-white p-5 text-sm text-cocoa-500">
            پیامی وجود ندارد.
          </p>
        ) : (
          messages.map((message) => (
            <MessageRow
              key={message.id}
              message={message}
              selected={selectedIds.has(message.id)}
              onToggleSelect={toggleSelect}
              onRead={handleRead}
              onDeleteRequest={setDeletingMessage}
            />
          ))
        )}
      </div>

      <ConfirmModal
        isOpen={!!deletingMessage}
        title="حذف پیام"
        description="آیا مطمئنید می‌خواهید این پیام را حذف کنید؟"
        confirmLabel="بله، حذف شود"
        cancelLabel="انصراف"
        onConfirm={() => (deletingMessage ? handleDelete(deletingMessage.id) : undefined)}
        onClose={() => setDeletingMessage(null)}
      />

      <ConfirmModal
        isOpen={bulkDeleteOpen}
        title="حذف گروهی پیام‌ها"
        description={`آیا مطمئنید می‌خواهید ${toPersianDigits(
          String(selectedIds.size),
        )} پیام را حذف کنید؟`}
        confirmLabel="بله، حذف شوند"
        cancelLabel="انصراف"
        onConfirm={handleBulkDelete}
        onClose={() => setBulkDeleteOpen(false)}
      />

      {totalPages > 1 && (
        <div className="mt-4 flex items-center justify-center gap-2">
          <button
            type="button"
            disabled={page <= 1}
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            className="rounded-full border border-cocoa-900/10 px-4 py-2 text-xs font-bold text-cocoa-700 transition hover:bg-sand-50 disabled:opacity-40"
          >
            قبلی
          </button>
          <span className="text-xs font-semibold text-cocoa-600">
            {toPersianDigits(String(page))} از {toPersianDigits(String(totalPages))}
          </span>
          <button
            type="button"
            disabled={page >= totalPages}
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            className="rounded-full border border-cocoa-900/10 px-4 py-2 text-xs font-bold text-cocoa-700 transition hover:bg-sand-50 disabled:opacity-40"
          >
            بعدی
          </button>
        </div>
      )}
    </div>
  );
}

export default AdminMessagesPage;
