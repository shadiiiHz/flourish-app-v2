"use client";

import { use } from "react";
import ManualOrderForm from "@/components/admin/ManualOrderForm";

export default function AdminEditOrderPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  return <ManualOrderForm orderId={id} />;
}
