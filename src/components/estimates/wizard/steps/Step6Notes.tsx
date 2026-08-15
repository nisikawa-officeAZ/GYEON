"use client";

// Step 6 — 備考・メモ. 備考 (customer-facing, printed on the estimate) and 社内メモ
// (internal only) are clearly separated. Breakpoint-agnostic.

import type { EstimateWizardApi } from "../useEstimateWizard";
import { Card, SectionTitle, Textarea } from "../ui";

export function Step6Notes({ api }: { api: EstimateWizardApi }) {
  const { store, updateStore } = api;
  return (
    <>
      <Card>
        <div className="flex items-center justify-between mb-2">
          <SectionTitle>備考（お客様向け）</SectionTitle>
          <span className="text-[10px] text-emerald-300 border border-emerald-600/40 rounded px-1.5 py-0.5">見積書に表示</span>
        </div>
        <Textarea value={store.notesCustomer} onChange={(v) => updateStore({ notesCustomer: v })} placeholder="見積書に記載する備考..." />
      </Card>
      <Card>
        <div className="flex items-center justify-between mb-2">
          <SectionTitle>社内メモ</SectionTitle>
          <span className="text-[10px] text-slate-400 border border-slate-600/60 rounded px-1.5 py-0.5">内部限定</span>
        </div>
        <Textarea value={store.notesInternal} onChange={(v) => updateStore({ notesInternal: v })} placeholder="社内向けメモ（見積書には出ません）..." />
      </Card>
    </>
  );
}
