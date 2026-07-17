"use client";

// Step 4 — 見積. Shows only the categories selected in Step 3. PPF branches into
// フル施工/部分施工 here; coating uses layer-first selection; store options are dynamic.
// ALL pricing routes through the existing engine (buildLineItems / calculateEstimateTotals)
// — wired in Phase 2. No pricing math is embedded in the UI.

import type { EstimateWizardApi } from "../useEstimateWizard";
import { Card, SectionTitle, PhaseTwoNotice } from "../ui";

export function Step4Estimate({ api }: { api: EstimateWizardApi }) {
  const cats = api.store.categories;
  return (
    <>
      <Card>
        <SectionTitle>見積（選択カテゴリのみ表示）</SectionTitle>
        {cats.length === 0 ? (
          <p className="text-xs text-slate-500">Step 3 でカテゴリが未選択です。作業内容を選択してください。</p>
        ) : (
          <p className="text-xs text-slate-400">対象カテゴリ: {cats.join(" / ")}</p>
        )}
      </Card>
      <PhaseTwoNotice screen="施工内容入力・明細生成（価格エンジン接続）" />
    </>
  );
}
