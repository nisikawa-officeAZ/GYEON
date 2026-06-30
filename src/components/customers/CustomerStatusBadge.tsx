"use client";

// Phase 2 Sprint 2 — Derived customer status badge (read-only foundation).

import type { CustomerDB } from "@/lib/customers/customer-types";
import { deriveCustomerStatus, type CustomerStatusTone } from "@/lib/customers/customer-status";

const TONE_CLASS: Record<CustomerStatusTone, string> = {
  green: "text-green-400 border-green-500/30 bg-green-500/10",
  blue:  "text-blue-400 border-blue-500/30 bg-blue-500/10",
  amber: "text-amber-400 border-amber-500/30 bg-amber-500/10",
  slate: "text-slate-400 border-slate-600/40 bg-slate-700/30",
};

export default function CustomerStatusBadge({ customer }: { customer: CustomerDB }) {
  const status = deriveCustomerStatus(customer);
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded border text-[11px] font-semibold ${TONE_CLASS[status.tone]}`}>
      {status.label}
    </span>
  );
}
