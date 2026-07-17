"use client";

// Step 7 — 確認. Shows the estimate summary + action buttons: 修正 / キャンセル / 保存 /
// PDF / LINE(送信 or 文章コピー) / 予約カレンダー / 請求書 / 納品書 / 納品請求書.
// Cancel = no auto-save; all other actions auto-save then navigate to their module.
// Real save/PDF/LINE and module navigation wire in Phase 2 (existing logic, unchanged).

import type { EstimateWizardApi } from "../useEstimateWizard";
import { Card, SectionTitle, PhaseTwoNotice } from "../ui";

export function Step7Review({ api }: { api: EstimateWizardApi }) {
  const s = api.store;
  return (
    <>
      <Card>
        <SectionTitle>確認</SectionTitle>
        <dl className="text-xs text-slate-300 space-y-1">
          <div className="flex justify-between"><dt className="text-slate-500">顧客</dt><dd>{s.customer.name || "—"}</dd></div>
          <div className="flex justify-between"><dt className="text-slate-500">車両</dt><dd>{[s.vehicle.maker, s.vehicle.model].filter(Boolean).join(" ") || "—"}</dd></div>
          <div className="flex justify-between"><dt className="text-slate-500">作業</dt><dd>{s.categories.join(" / ") || "—"}</dd></div>
        </dl>
      </Card>
      <PhaseTwoNotice screen="保存 / PDF / LINE(送信・文章コピー) / 予約カレンダー / 請求書・納品書・納品請求書" />
    </>
  );
}
