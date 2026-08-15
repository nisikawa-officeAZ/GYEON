"use client";

// Estimate Wizard Ver2.2 — Coupon selector (Phase 5, presentation-only).
//
// MULTIPLE-selection visual cards (re-click deselects). No pull-down. No Apply button —
// selection takes effect immediately in presentation state. Coupons, disabled state, and
// conflict/combinability are ALL supplied through PROPS: this component contains NO
// coupon-combination business logic, does not touch the coupon master / backend, and computes
// no discount. `discountType`/`discountValue` are DISPLAY data only.

import { formatYen, cn } from "../foundation/tokens";
import type { CouponOption } from "./step-types";

const SECHDR = "text-xs font-semibold text-slate-400 uppercase tracking-wider";

function couponValueText(c: CouponOption): string {
  return c.discountType === "percent" ? `${c.discountValue}% 引き` : `${formatYen(c.discountValue)} 引き`;
}

function CouponCard({
  coupon, selected, disabled, disabledReason, onToggle,
}: {
  coupon: CouponOption; selected: boolean; disabled: boolean; disabledReason?: string; onToggle: () => void;
}) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      disabled={disabled}
      onClick={disabled ? undefined : onToggle}
      className={cn(
        "text-left rounded-lg border p-3 min-h-[72px] transition-colors flex flex-col gap-1",
        disabled
          ? "bg-[#0f172a] border-slate-800 text-slate-600 opacity-50 cursor-not-allowed"
          : selected
            ? "bg-blue-950/40 border-[#1d4ed8]"
            : "bg-[#0f172a] border-slate-700 hover:border-slate-500",
      )}
    >
      <div className="flex items-center justify-between gap-2">
        <span className={cn("text-sm font-medium truncate", disabled ? "text-slate-600" : "text-slate-100")}>{coupon.name}</span>
        <div className="flex items-center gap-1.5 shrink-0">
          {coupon.badge && !disabled && <span className="text-[9px] text-emerald-300 border border-emerald-600/40 rounded px-1 py-0.5">{coupon.badge}</span>}
          {selected && !disabled && <span aria-hidden className="text-blue-300 text-xs">✓</span>}
        </div>
      </div>
      {coupon.description && <span className="text-[11px] text-slate-500 truncate">{coupon.description}</span>}
      <div className="flex items-center gap-2">
        <span className={cn("text-sm tabular-nums", disabled ? "text-slate-600" : "text-slate-200")}>{couponValueText(coupon)}</span>
        {coupon.combinable === false && !disabled && (
          <span className="text-[9px] text-amber-300/80 border border-amber-500/30 rounded px-1 py-0.5">併用不可</span>
        )}
      </div>
      {coupon.validityText && !disabled && <span className="text-[10px] text-slate-500">{coupon.validityText}</span>}
      {disabled && disabledReason && <span className="text-[10px] text-slate-500">（{disabledReason}）</span>}
    </button>
  );
}

export function CouponSelector(props: {
  availableCoupons: CouponOption[];
  selectedCouponIds: string[];
  disabledCouponIds?: string[];
  disabledReasonByCoupon?: Record<string, string>;
  onCouponToggle: (id: string) => void;
}) {
  const { availableCoupons, selectedCouponIds, disabledCouponIds, disabledReasonByCoupon, onCouponToggle } = props;

  const disabledIds = new Set(disabledCouponIds ?? []);
  const coupons = [...availableCoupons]
    .filter((c) => c.enabled !== false)
    .sort((a, b) => (a.displayOrder ?? 0) - (b.displayOrder ?? 0));

  const isDisabled = (c: CouponOption) => disabledIds.has(c.id);
  const reasonFor = (c: CouponOption) => disabledReasonByCoupon?.[c.id] ?? c.disabledReason;
  const selectedCount = coupons.filter((c) => selectedCouponIds.includes(c.id) && !isDisabled(c)).length;

  return (
    <div className="bg-[#1e293b] rounded-xl shadow-lg p-5">
      <h3 className={SECHDR}>クーポン</h3>
      <p className="text-[11px] text-slate-500 mt-1 mb-3">利用可能なクーポンから選択します（複数選択可）。</p>

      {coupons.length === 0 ? (
        <p className="text-[11px] text-slate-500">利用可能なクーポンはありません。</p>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
          {coupons.map((c) => (
            <CouponCard
              key={c.id}
              coupon={c}
              selected={selectedCouponIds.includes(c.id)}
              disabled={isDisabled(c)}
              disabledReason={reasonFor(c)}
              onToggle={() => onCouponToggle(c.id)}
            />
          ))}
        </div>
      )}

      {selectedCount > 0 && <p className="text-[11px] text-slate-400 mt-2">選択中: {selectedCount} クーポン</p>}
    </div>
  );
}
