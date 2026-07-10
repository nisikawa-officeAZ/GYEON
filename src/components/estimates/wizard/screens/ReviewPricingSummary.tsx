"use client";

// Estimate Wizard Ver2.2 — Screen 7 pricing summary (Phase 10D, read-only display).
//
// Renders the WizardPricingResult produced by the PRODUCTION pricing engine. Performs NO arithmetic
// — every number is displayed verbatim from the result. Shows Service Subtotal / Discount / Coupon /
// Tax / Grand Total plus warnings and errors. Coupons are always excluded (deferred). Nothing here
// saves, calculates, or mutates.

import { formatYen } from "../foundation/tokens";
import type { WizardPricingResult } from "../pricing/wizard-pricing-types";

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

export function ReviewPricingSummary({ pricing }: { pricing: WizardPricingResult }) {
  const couponSelected = pricing.couponState.status === "selected_not_priced";

  return (
    <section className="bg-[#0f172a] border border-slate-700 rounded-xl shadow-lg p-5" aria-label="金額サマリー">
      <div className="flex items-center justify-between gap-2 mb-2">
        <h3 className="text-sm font-semibold text-slate-100">金額サマリー</h3>
        <span className="text-[10px] text-emerald-300/80 border border-emerald-600/40 rounded px-1.5 py-0.5">読み取り専用（本エンジン計算）</span>
      </div>

      {pricing.status === "incomplete" && (
        <p className="text-[11px] text-amber-300 mb-2">計算可能なサービスがまだありません。対応する項目を選択すると本エンジンで計算されます。</p>
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

      {pricing.warnings.length > 0 && (
        <div className="mt-3 rounded-lg border border-amber-500/30 bg-amber-500/5 p-2.5 flex flex-col gap-1">
          {pricing.warnings.map((w, i) => (
            <p key={i} className="text-[11px] text-amber-300/90">{w.message}</p>
          ))}
        </div>
      )}

      {pricing.errors.length > 0 && (
        <div className="mt-2 rounded-lg border border-amber-600/40 bg-amber-500/10 p-2.5 flex flex-col gap-1">
          <span className="text-[10px] text-amber-300 uppercase tracking-wider">計算に含まれない項目</span>
          {pricing.errors.map((e, i) => (
            <p key={i} className="text-[11px] text-amber-200/90">{e.message}</p>
          ))}
        </div>
      )}

      <p className="text-[10px] text-slate-600 mt-3">
        金額は既存の本番価格エンジンが算出しています（読み取り専用）。保存・PDF・送信は行いません。
      </p>
    </section>
  );
}
