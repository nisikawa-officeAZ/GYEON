"use client";

// Phase 2 Sprint 2 — Derived customer tag chips (read-only foundation).

import type { CustomerDB } from "@/lib/customers/customer-types";
import { deriveCustomerTags } from "@/lib/customers/customer-status";

export default function CustomerTagList({ customer }: { customer: CustomerDB }) {
  const tags = deriveCustomerTags(customer);
  if (tags.length === 0) return null;

  return (
    <div className="flex flex-wrap gap-1.5">
      {tags.map((t) => (
        <span
          key={t}
          className="inline-flex items-center px-2 py-0.5 rounded-md border border-white/[.08] bg-[#1a2236] text-[11px] text-slate-300"
        >
          {t}
        </span>
      ))}
    </div>
  );
}
