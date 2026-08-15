// Estimate Wizard Ver2.2 — Integration preview types (Phase 8).
//
// NEUTRAL preview data shape shared between the wizard bridge and EstimateEditor. This file is a
// LEAF: it imports NOTHING from the wizard (no wizard state/components/config) so that a module
// depending only on this type (e.g. EstimateEditor) never transitively pulls in wizard internals.
// The dependency direction is Wizard → Adapter → EstimateEditor, never the reverse. This data is
// DISPLAY-ONLY: all strings are already resolved/formatted; no ids, no calculation, no actions.

export interface PreviewField {
  label: string;
  value: string; // display-ready ("未入力" / "未選択" / "なし" for empty)
}

export interface PreviewServiceLine {
  category: string;
  name:     string;
  detail?:  string;
  amount?:  string; // user-entered amount (display only — NOT a calculated total)
}

export interface PreviewPriceSummary {
  mockRows?: { label: string; value: string }[]; // preview/mock values only, clearly marked
  note:      string;
}

/** Read-only preview payload EstimateEditor renders in "wizard-preview" mode. `internalMemo` is
 *  kept as an explicit isolated field — the renderer never merges it with `customerNotes` and
 *  never places it in a customer-facing block. */
export interface EstimateEditorPreviewData {
  mode:            "wizard-preview";
  customerName:    string;
  vehicleName:     string;
  categoryCount:   number;
  customerFields:  PreviewField[];
  vehicleFields:   PreviewField[];
  serviceLines:    PreviewServiceLine[];
  discountFields:  PreviewField[];
  couponSummaries: string[];
  customerNotes:   string;
  internalMemo:    string; // staff-only — isolated, never customer-facing
  priceSummary:    PreviewPriceSummary;
}
