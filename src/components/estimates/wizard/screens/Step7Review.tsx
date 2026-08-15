"use client";

// Estimate Wizard Ver2.2 — Screen7 (Final Review) container (Phase 7, presentation-only).
//
// Read-only aggregation of the preview state from Screens 1–6, with per-section edit navigation
// (existing wizard step controller — no browser navigation, no second state owner) and a
// preview-only confirmation. Computes NO prices/tax/discounts, performs NO save/API/DB/PDF/LINE,
// and never mutates EstimateEditor. `internalMemo` is rendered in its own isolated internal-only
// block — never merged with customerNotes and never passed into the customer-facing block.

import type { ReactNode } from "react";
import { ReviewSection, FieldList } from "./ReviewSection";
import { ReviewPricingSummary } from "./ReviewPricingSummary";
import { ReviewConfirmation } from "./ReviewConfirmation";
import type { Step7ReviewProps } from "./step-types";

export function Step7Review(props: Step7ReviewProps & { savePanel?: ReactNode }) {
  const {
    customerName, vehicleName, categoryCount,
    customerFields, vehicleFields, serviceLines, discountFields, couponSummaries,
    customerNotes, internalMemo, pricing,
    previewConfirmed, onPreviewConfirm,
    onEditCustomer, onEditVehicle, onEditServices, onEditDiscount, onEditNotes, onBack,
    savePanel,
  } = props;

  return (
    <div className="flex flex-col gap-4">
      {/* Compact summary header */}
      <header className="bg-[#1e293b] rounded-xl shadow-lg p-5">
        <div className="flex items-center gap-2">
          <h2 className="text-base font-semibold text-slate-100">最終確認</h2>
          {previewConfirmed && (
            <span className="text-[10px] text-emerald-300 border border-emerald-600/40 rounded px-1.5 py-0.5">確定済み（プレビュー）</span>
          )}
        </div>
        <p className="text-[11px] text-slate-500 mt-0.5">入力内容をご確認のうえ、必要に応じて各項目を編集してください。</p>
        <dl className="grid grid-cols-1 sm:grid-cols-3 gap-2 mt-3">
          <div className="rounded-lg border border-slate-700/60 p-2.5">
            <dt className="text-[10px] text-slate-500">お客様</dt>
            <dd className="text-sm text-slate-200 break-words">{customerName}</dd>
          </div>
          <div className="rounded-lg border border-slate-700/60 p-2.5">
            <dt className="text-[10px] text-slate-500">車両</dt>
            <dd className="text-sm text-slate-200 break-words">{vehicleName}</dd>
          </div>
          <div className="rounded-lg border border-slate-700/60 p-2.5">
            <dt className="text-[10px] text-slate-500">選択カテゴリ数</dt>
            <dd className="text-sm text-slate-200 tabular-nums">{categoryCount} カテゴリ</dd>
          </div>
        </dl>
      </header>

      {/* Section 1 — Customer */}
      <ReviewSection title="お客様情報" editLabel="お客様情報を編集" onEdit={onEditCustomer}>
        <FieldList fields={customerFields} />
      </ReviewSection>

      {/* Section 2 — Vehicle */}
      <ReviewSection title="車両情報" editLabel="車両情報を編集" onEdit={onEditVehicle}>
        <FieldList fields={vehicleFields} />
      </ReviewSection>

      {/* Section 3 — Service Selection */}
      <ReviewSection title="施工内容" editLabel="施工内容を編集" onEdit={onEditServices}>
        {serviceLines.length === 0 ? (
          <p className="text-xs text-slate-500">未選択</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {serviceLines.map((s, i) => (
              <li key={`${s.category}-${i}`} className="rounded-lg border border-slate-700/60 p-3">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[10px] text-slate-500">{s.category}</span>
                  {s.amount && <span className="text-sm text-slate-200 tabular-nums">{s.amount}</span>}
                </div>
                <p className="text-sm text-slate-100 mt-0.5 break-words">{s.name}</p>
                {s.detail && <p className="text-[11px] text-slate-500 mt-0.5 whitespace-pre-wrap break-words">{s.detail}</p>}
              </li>
            ))}
          </ul>
        )}
      </ReviewSection>

      {/* Section 4 — Discounts and Coupons */}
      <ReviewSection title="値引き・クーポン" editLabel="値引き・クーポンを編集" onEdit={onEditDiscount}>
        <FieldList fields={discountFields} />
        <div className="mt-2">
          <p className="text-[11px] text-slate-500 mb-1">クーポン</p>
          {couponSummaries.length === 0 ? (
            <p className="text-xs text-slate-500">なし</p>
          ) : (
            <ul className="flex flex-col gap-1">
              {couponSummaries.map((c, i) => (
                <li key={i} className="text-sm text-slate-200 break-words">・{c}</li>
              ))}
            </ul>
          )}
        </div>
      </ReviewSection>

      {/* Section 5 — Notes (two strictly separated blocks) */}
      <ReviewSection title="備考・ご案内" editLabel="備考・ご案内を編集" onEdit={onEditNotes}>
        {/* Customer-facing notes (may appear on customer output later) */}
        <div className="rounded-lg border border-slate-700/60 p-3">
          <div className="flex items-center gap-2 mb-1">
            <span aria-hidden>💬</span>
            <span className="text-xs font-medium text-slate-200">お客様向けメモ</span>
            <span className="text-[10px] text-blue-300 border border-blue-500/30 rounded px-1.5 py-0.5">お客様に表示される場合あり</span>
          </div>
          {customerNotes.trim() ? (
            <p className="text-sm text-slate-200 whitespace-pre-wrap break-words">{customerNotes}</p>
          ) : (
            <p className="text-xs text-slate-500">未入力</p>
          )}
        </div>

        {/* Internal staff memo — isolated internal-only block (never customer-facing) */}
        <div className="rounded-lg border border-amber-500/25 bg-[#0b1220] p-3 mt-2">
          <div className="flex items-center gap-2 mb-1">
            <span aria-hidden>🔒</span>
            <span className="text-xs font-medium text-amber-200/90">社内メモ（スタッフ専用）</span>
            <span className="text-[10px] text-amber-300/90 border border-amber-500/40 rounded px-1.5 py-0.5">お客様には表示されません</span>
          </div>
          {internalMemo.trim() ? (
            <p className="text-sm text-slate-100 whitespace-pre-wrap break-words">{internalMemo}</p>
          ) : (
            <p className="text-xs text-amber-200/50">未入力</p>
          )}
        </div>
      </ReviewSection>

      {/* Price summary — real read-only totals from the production pricing engine (Phase 10D) */}
      <ReviewPricingSummary pricing={pricing} />

      {/* Final action: real save panel (Phase 11I) when provided; else the preview-only confirmation. */}
      {savePanel ?? (
        <ReviewConfirmation previewConfirmed={previewConfirmed} onPreviewConfirm={onPreviewConfirm} onBack={onBack} />
      )}
    </div>
  );
}
