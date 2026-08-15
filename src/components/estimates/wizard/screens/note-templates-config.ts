// Estimate Wizard Ver2.2 — Customer-facing quick note templates (Phase 6, presentation-only).
//
// Hardcoded sample templates for the customer-facing notes field ONLY. No template master, no
// tenant settings, no DB, no API. These are appended to `customerNotes` — never to
// `internalMemo`. Do not treat as a production catalog.

import type { QuickNoteTemplate } from "./step-types";

export const CUSTOMER_NOTE_TEMPLATES: QuickNoteTemplate[] = [
  { id: "tpl-duration", category: "作業時間", label: "作業時間の目安", text: "作業には約〇日（〇時間）お時間をいただきます。仕上がり次第ご連絡いたします。" },
  { id: "tpl-precaution", category: "施工後の注意", label: "施工後の注意事項", text: "施工後48時間は洗車・雨天走行をお控えください。完全硬化まで約〇日かかります。" },
  { id: "tpl-courtesy", category: "代車", label: "代車のご案内", text: "代車をご用意しております。ガソリンは満タン返却にてお願いいたします。" },
  { id: "tpl-reservation", category: "予約", label: "ご予約のご案内", text: "ご来店は事前予約制です。ご希望日時をお知らせください。" },
  { id: "tpl-payment", category: "お支払い", label: "お支払いのご案内", text: "お支払いは現金・各種クレジットカード・電子マネーがご利用いただけます。" },
  { id: "tpl-warranty", category: "保証・証明書", label: "保証・証明書のご案内", text: "施工完了後、保証書・施工証明書を発行いたします。次回メンテナンス時期は別途ご案内します。" },
];

/**
 * Append `addition` to the customer-facing note `current`, preserving existing content and line
 * breaks. Inserts a single newline separator only when needed (never a duplicate separator).
 * The result is capped at `maxLength` characters. Pure — no side effects, no internalMemo access.
 */
export function appendCustomerNote(current: string, addition: string, maxLength: number): string {
  const next =
    current.length === 0
      ? addition
      : current.endsWith("\n")
        ? current + addition
        : current + "\n" + addition;
  return next.length > maxLength ? next.slice(0, maxLength) : next;
}
