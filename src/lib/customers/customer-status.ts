// Phase 2 Sprint 2 — Customer status & tags FOUNDATION (derived, read-only).
//
// IMPORTANT: The customers table has no dedicated `status` or `tags` columns,
// and this sprint introduces NO schema change. Status and tags are therefore
// DERIVED from existing columns. This is a foundation a future sprint can make
// editable + persisted (which would require a migration).
//
// Pure functions only — safe to import from both server and client components.

import type { CustomerDB } from "./customer-types";

export type CustomerStatusTone = "green" | "blue" | "amber" | "slate";

export interface CustomerStatus {
  key:   string;
  label: string;
  tone:  CustomerStatusTone;
}

// Engagement status, derived from reachability + LINE linkage.
export function deriveCustomerStatus(c: CustomerDB): CustomerStatus {
  if (c.line_connected) {
    return { key: "connected", label: "LINE連携済み", tone: "green" };
  }
  if ((c.phone && c.phone.trim()) || (c.email && c.email.trim())) {
    return { key: "reachable", label: "連絡可能", tone: "blue" };
  }
  return { key: "minimal", label: "情報不足", tone: "slate" };
}

// Short descriptor chips, derived from existing columns.
export function deriveCustomerTags(c: CustomerDB): string[] {
  const tags: string[] = [];

  if (c.is_business) {
    tags.push("業者");
    if (typeof c.trade_discount_pct === "number" && c.trade_discount_pct > 0) {
      tags.push(`業販${c.trade_discount_pct}%`);
    }
  }
  if (c.line_connected)                                       tags.push("LINE");
  if (c.email && c.email.trim())                              tags.push("メール");
  if ([c.prefecture, c.city, c.address1].some(v => v?.trim())) tags.push("住所");
  if (c.customer_code && c.customer_code.trim())              tags.push("コード");
  if (c.birthday && c.birthday.trim())                        tags.push("誕生日");

  return tags;
}
