"use client";

// Step 5 — 値引き / クーポン. Discount = amount OR percentage (mutually exclusive);
// coupons multi-select from dealer settings. Real coupon list + discount calc wire
// in Phase 2 (via calculateEstimateTotals). Phase 1 tracks the mode selection.

import type { EstimateWizardApi } from "../useEstimateWizard";
import type { DiscountMode } from "../wizard-types";
import { Card, SectionTitle, SelectButton, ChoiceGrid, PhaseTwoNotice } from "../ui";

const MODES: Array<{ id: DiscountMode; label: string }> = [
  { id: "none",    label: "値引きなし" },
  { id: "amount",  label: "金額で値引き" },
  { id: "percent", label: "％で値引き" },
];

export function Step5Discount({ api }: { api: EstimateWizardApi }) {
  const { store, updateStore } = api;
  return (
    <>
      <Card>
        <SectionTitle>値引き方式（金額 または ％・排他）</SectionTitle>
        <ChoiceGrid cols={3}>
          {MODES.map((m) => (
            <SelectButton key={m.id} selected={store.discountMode === m.id} onClick={() => updateStore({ discountMode: m.id })}>
              {m.label}
            </SelectButton>
          ))}
        </ChoiceGrid>
      </Card>
      <PhaseTwoNotice screen="クーポン選択（店舗設定由来）・値引き計算" />
    </>
  );
}
