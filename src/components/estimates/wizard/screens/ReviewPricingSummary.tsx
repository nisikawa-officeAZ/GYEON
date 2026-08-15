"use client";

// Estimate Wizard Ver2.2 — Screen 7 pricing summary (Phase 10D → 10F-R, read-only display).
//
// Renders the WizardPricingResult produced by the PRODUCTION pricing engine under the hybrid model.
// Performs NO arithmetic — every number is displayed verbatim from the result. Distinguishes
// catalog-priced lines, manual-priced lines, and unresolved (not-priced) items, and shows an explicit
// pricing-completeness state. A "complete" state is NEVER shown while required manual amounts are
// missing. Coupons are always excluded (deferred). Nothing here saves, calculates, or mutates.

import { formatYen } from "../foundation/tokens";
import type { WizardPricingResult, WizardPricingCompleteness } from "../pricing/wizard-pricing-types";
import { WIZARD_PRICING_ERRORS } from "../pricing/wizard-pricing-types";

// Item-level (unresolved) codes are rendered in their own box; everything else is document-level.
const UNRESOLVED_CODES = new Set<string>([
  WIZARD_PRICING_ERRORS.MANUAL_PRICE_REQUIRED,
  WIZARD_PRICING_ERRORS.MANUAL_PRICING_IDENTITY_MISSING,
  WIZARD_PRICING_ERRORS.INVALID_MANUAL_PRICE,
  WIZARD_PRICING_ERRORS.INVALID_QUANTITY,
  WIZARD_PRICING_ERRORS.UNKNOWN_PRICING_REFERENCE,
]);

const yenOrDash = (v: number | null) => (v == null ? "—" : formatYen(v));

function Row({ label, value, emphasis, sign }: { label: string; value: number | null; emphasis?: boolean; sign?: "minus" }) {
  return (
    <div className={`flex items-center justify-between py-1.5 border-b border-slate-800/60 last:border-b-0 ${emphasis ? "pt-2" : ""}`}>
      <dt className={emphasis ? "text-sm font-semibold text-slate-100" : "text-xs text-slate-400"}>{label}</dt>
      <dd className={`tabular-nums ${emphasis ? "text-base font-semibold text-slate-100" : "text-sm text-slate-200"}`}>
        {value != null && sign === "minus" && value > 0 ? "− " : ""}{yenOrDash(value)}
      </dd>
    </div>
  );
}

const COMPLETENESS_BADGE: Record<WizardPricingCompleteness, { text: string; cls: string }> = {
  complete:    { text: "価格確定", cls: "text-emerald-300 border-emerald-600/40" },
  partial:     { text: "一部未価格", cls: "text-amber-300 border-amber-500/40" },
  unavailable: { text: "未価格", cls: "text-slate-300 border-slate-600/50" },
  error:       { text: "入力エラー", cls: "text-rose-300 border-rose-600/50" },
};

const KIND_TAG: Record<"catalog" | "manual", { text: string; cls: string }> = {
  catalog: { text: "カタログ", cls: "text-sky-300 border-sky-600/40" },
  manual:  { text: "手入力", cls: "text-violet-300 border-violet-500/40" },
};

export function ReviewPricingSummary({ pricing }: { pricing: WizardPricingResult }) {
  const couponSelected = pricing.couponState.status === "selected_not_priced";
  const badge = COMPLETENESS_BADGE[pricing.completeness];
  const documentErrors = pricing.errors.filter((e) => !UNRESOLVED_CODES.has(e.code));

  return (
    <section className="bg-[#0f172a] border border-slate-700 rounded-xl shadow-lg p-5" aria-label="金額サマリー">
      <div className="flex items-center justify-between gap-2 mb-2">
        <h3 className="text-sm font-semibold text-slate-100">金額サマリー</h3>
        <div className="flex items-center gap-1.5">
          <span className={`text-[10px] border rounded px-1.5 py-0.5 ${badge.cls}`}>{badge.text}</span>
          <span className="text-[10px] text-emerald-300/80 border border-emerald-600/40 rounded px-1.5 py-0.5">読み取り専用（本エンジン計算）</span>
        </div>
      </div>

      {pricing.completeness === "unavailable" && (
        <p className="text-[11px] text-amber-300 mb-2">計算可能なサービスがまだありません。対応する項目を選択・入力すると本エンジンで計算されます。</p>
      )}
      {pricing.completeness === "partial" && (
        <p className="text-[11px] text-amber-300 mb-2">一部の項目は金額が未入力のため合計に含まれていません。下記の未価格項目をご確認ください。</p>
      )}

      {/* Line breakdown — catalog vs manual identity source (display only) */}
      {pricing.lines.length > 0 && (
        <ul className="flex flex-col gap-1 mb-3">
          {pricing.lines.map((l, i) => {
            const tag = KIND_TAG[l.kind];
            return (
              <li key={`${l.sourceId}-${i}`} className="flex items-center justify-between gap-2 py-1 border-b border-slate-800/40 last:border-b-0">
                <span className="flex items-center gap-1.5 min-w-0">
                  <span className={`text-[9px] border rounded px-1 py-0.5 shrink-0 ${tag.cls}`}>{tag.text}</span>
                  <span className="text-xs text-slate-300 truncate">{l.label}{l.quantity > 1 ? ` ×${l.quantity}` : ""}</span>
                </span>
                <span className="text-xs text-slate-200 tabular-nums shrink-0">{yenOrDash(l.lineTotal)}</span>
              </li>
            );
          })}
        </ul>
      )}

      <dl className="flex flex-col">
        <Row label="サービス小計" value={pricing.subtotal} />
        <Row label="値引き" value={pricing.discountTotal} sign="minus" />
        <Row label="クーポン" value={pricing.couponTotal} sign="minus" />
        <Row label="課税対象額" value={pricing.taxableSubtotal} />
        <Row label="消費税" value={pricing.taxTotal} />
        <Row label="合計" value={pricing.grandTotal} emphasis />
      </dl>

      {couponSelected && (
        <p className="text-[10px] text-amber-300/90 mt-3">
          クーポンが選択されています。本番のクーポン計算は未対応のため、クーポンは合計に含まれません。
        </p>
      )}

      {/* Unresolved (not-priced) selected services — surfaced, never silently dropped */}
      {pricing.unresolvedItems.length > 0 && (
        <div className="mt-3 rounded-lg border border-amber-600/40 bg-amber-500/10 p-2.5 flex flex-col gap-1">
          <span className="text-[10px] text-amber-300 uppercase tracking-wider">未価格（合計に含まれません）</span>
          {pricing.unresolvedItems.map((e, i) => (
            <p key={i} className="text-[11px] text-amber-200/90">{e.message}</p>
          ))}
        </div>
      )}

      {documentErrors.length > 0 && (
        <div className="mt-2 rounded-lg border border-rose-600/40 bg-rose-500/5 p-2.5 flex flex-col gap-1">
          {documentErrors.map((e, i) => (
            <p key={i} className="text-[11px] text-rose-200/90">{e.message}</p>
          ))}
        </div>
      )}

      {pricing.warnings.length > 0 && (
        <div className="mt-2 rounded-lg border border-amber-500/30 bg-amber-500/5 p-2.5 flex flex-col gap-1">
          {pricing.warnings.map((w, i) => (
            <p key={i} className="text-[11px] text-amber-300/90">{w.message}</p>
          ))}
        </div>
      )}

      <p className="text-[10px] text-slate-600 mt-3">
        金額は既存の本番価格エンジンが算出しています（読み取り専用）。保存・PDF・送信は行いません。
      </p>
    </section>
  );
}
