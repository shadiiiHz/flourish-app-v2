"use client";

import { Search } from "lucide-react";

interface AdminSearchInputProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}

function AdminSearchInput({ value, onChange, placeholder = "جستجو…" }: AdminSearchInputProps) {
  return (
    <div className="relative">
      <Search className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-cocoa-400" />
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full min-w-0 rounded-full border border-sand-200 bg-white py-2 pr-9 pl-4 text-sm outline-none focus:border-sand-400 sm:w-64"
      />
    </div>
  );
}

export default AdminSearchInput;
