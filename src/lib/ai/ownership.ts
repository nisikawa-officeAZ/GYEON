// DealerOS — AI Provider Ownership Policy
// CLIENT-SAFE — this file contains NO API keys and NO key access. It only
// declares WHO owns (and pays for) the API key behind each AI feature.
//
//   - gyeon_managed  → GYEON Japan (Office AZ) platform key. Read server-side
//                      from the OPENAI_API_KEY environment variable. The dealer
//                      is never asked to configure a key for these features.
//   - dealer_managed → the dealer's own per-dealer key, stored encrypted in
//                      dealer_settings.ai_settings (AI Gateway). Used for AI that
//                      processes dealer-specific business data at high or
//                      unpredictable volume.
//
// See: docs/AI_API_OWNERSHIP_POLICY.md

// ─── Ownership concept ────────────────────────────────────────────────────────

export type AIProviderOwnership = "gyeon_managed" | "dealer_managed";

// ─── Owned features ───────────────────────────────────────────────────────────

/** AI features whose provider key ownership is governed by this policy. */
export type AIOwnedFeature =
  // ── GYEON-managed (platform key — OPENAI_API_KEY) ──
  | "vehicle_registration_ocr"          // 車検証OCR
  | "gyeon_estimate_recommendation"     // GYEON商品・サービス見積提案AI
  | "gyeon_inventory_sales_diagnostics" // GYEON全体の在庫・販売診断
  | "gyeon_system_ai"                   // GYEON Japanが管理するシステムレベルAI
  // ── Dealer-managed (dealer's own key) ──
  | "dealer_customer_analysis"          // 店舗の顧客分析AI
  | "dealer_line_reply"                 // 店舗のLINE返信AI
  | "dealer_inventory_analysis"         // 店舗の個別在庫分析AI
  | "dealer_sales_profit_analysis";     // 店舗の売上・利益分析AI

export const AI_FEATURE_OWNERSHIP: Record<AIOwnedFeature, AIProviderOwnership> = {
  // GYEON owns the key — GYEON pays for inference.
  vehicle_registration_ocr:          "gyeon_managed",
  gyeon_estimate_recommendation:     "gyeon_managed",
  gyeon_inventory_sales_diagnostics: "gyeon_managed",
  gyeon_system_ai:                   "gyeon_managed",

  // Dealer owns the key — dealer pays for inference.
  dealer_customer_analysis:     "dealer_managed",
  dealer_line_reply:            "dealer_managed",
  dealer_inventory_analysis:    "dealer_managed",
  dealer_sales_profit_analysis: "dealer_managed",
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

export function getFeatureOwnership(feature: AIOwnedFeature): AIProviderOwnership {
  return AI_FEATURE_OWNERSHIP[feature];
}

export function isGyeonManaged(feature: AIOwnedFeature): boolean {
  return AI_FEATURE_OWNERSHIP[feature] === "gyeon_managed";
}

export function isDealerManaged(feature: AIOwnedFeature): boolean {
  return AI_FEATURE_OWNERSHIP[feature] === "dealer_managed";
}

// ─── Visible policy labels (for AI Center display) ────────────────────────────
// Human-readable Japanese feature lists shown in the AI Center ownership panel.

export const GYEON_MANAGED_FEATURE_LABELS_JA: readonly string[] = [
  "車検証OCR",
  "GYEON商品・施工見積提案AI",
  "GYEON全体在庫分析AI",
  "GYEON全体売上分析AI",
  "システム共通AI",
];

export const DEALER_MANAGED_FEATURE_LABELS_JA: readonly string[] = [
  "顧客分析AI",
  "LINE返信AI",
  "ディテーラー自社在庫分析AI",
  "ディテーラー売上分析AI",
  "店舗固有で利用量が大きいAI",
];

// ─── Standard user-facing message ─────────────────────────────────────────────

/**
 * Shown when a dealer-managed AI feature is invoked but the dealer has not
 * configured their own AI API key. GYEON-managed features never surface this.
 */
export const DEALER_AI_KEY_REQUIRED_MESSAGE =
  "このAI機能を利用するには、AI APIキーの設定が必要です。";
