// DealerOS — Centralized Feature Registry
// Single source of truth for feature metadata: name, description, plan tier, status, category.
//
// IMPORTANT: This file is for metadata and discovery only.
// For runtime gate checking, use checkFeatureAccess() from src/lib/plans/can-use-feature.ts
// or checkFeatureAccess() from src/lib/subscription/subscription.ts.
//
// Status "planned" features are declared in AppFeature (plan-types.ts) but intentionally
// absent from PLAN_FEATURES arrays — they are not accessible in any plan yet.

import { AppFeature, DealerPlan } from "@/lib/plans/plan-types";

export type FeatureStatus   = "active" | "planned";
export type FeatureCategory = "core" | "line" | "ai_platform";

export interface FeatureMetadata {
  key:           AppFeature;
  nameJa:        string;
  descriptionJa: string;
  plan:          DealerPlan;       // minimum plan required when active
  status:        FeatureStatus;    // "active" = implemented; "planned" = future
  category:      FeatureCategory;
}

// ─── Registry ─────────────────────────────────────────────────────────────────

export const FEATURE_REGISTRY: FeatureMetadata[] = [
  // ── Basic ──────────────────────────────────────────────────────────────────
  { key: "customers",        nameJa: "顧客管理",       descriptionJa: "顧客情報の登録・管理",              plan: "basic",    status: "active",  category: "core" },
  { key: "vehicles",         nameJa: "車両管理",       descriptionJa: "車両情報の登録・管理",              plan: "basic",    status: "active",  category: "core" },
  { key: "estimates",        nameJa: "見積",           descriptionJa: "施工見積の作成・送付",              plan: "basic",    status: "active",  category: "core" },
  { key: "estimate_pdf",     nameJa: "見積PDF",        descriptionJa: "見積書PDFの出力",                  plan: "basic",    status: "active",  category: "core" },
  { key: "products",         nameJa: "商品管理",       descriptionJa: "商品カタログの管理",               plan: "basic",    status: "active",  category: "core" },
  { key: "product_orders",   nameJa: "商品注文",       descriptionJa: "商品注文の管理",                   plan: "basic",    status: "active",  category: "core" },
  // ── Pro ────────────────────────────────────────────────────────────────────
  { key: "work_orders",      nameJa: "作業指示",       descriptionJa: "施工作業の管理",                   plan: "pro",      status: "active",  category: "core" },
  { key: "calendar",         nameJa: "カレンダー",     descriptionJa: "予約カレンダーの表示",              plan: "pro",      status: "active",  category: "core" },
  { key: "reservations",     nameJa: "予約管理",       descriptionJa: "来店予約の管理",                   plan: "pro",      status: "active",  category: "core" },
  { key: "completion_reports", nameJa: "完了報告",     descriptionJa: "施工完了報告書の作成",              plan: "pro",      status: "active",  category: "core" },
  { key: "invoices",         nameJa: "請求書",         descriptionJa: "請求書の発行・管理",               plan: "pro",      status: "active",  category: "core" },
  { key: "payments",         nameJa: "入金管理",       descriptionJa: "入金記録の管理",                   plan: "pro",      status: "active",  category: "core" },
  { key: "maintenance",      nameJa: "メンテナンス管理", descriptionJa: "定期メンテナンスのリマインダー管理", plan: "pro",      status: "active",  category: "core" },
  // ── Pro Plus — LINE (active) ───────────────────────────────────────────────
  { key: "line",             nameJa: "LINE連携",       descriptionJa: "LINEメッセージング機能",            plan: "pro_plus", status: "active",  category: "line" },
  { key: "line_crm",         nameJa: "LINE CRM",       descriptionJa: "LINE友だちと顧客の紐付け",          plan: "pro_plus", status: "active",  category: "line" },
  { key: "line_rich_menu",   nameJa: "LINEリッチメニュー", descriptionJa: "顧客向けLINEリッチメニューの管理", plan: "pro_plus", status: "active",  category: "line" },
  { key: "message_logs",     nameJa: "メッセージ履歴", descriptionJa: "LINEメッセージ送信履歴",            plan: "pro_plus", status: "active",  category: "line" },
  { key: "notification_queue", nameJa: "通知キュー",   descriptionJa: "LINE通知の送信キュー管理",          plan: "pro_plus", status: "active",  category: "line" },
  { key: "auto_notifications", nameJa: "自動通知",     descriptionJa: "メンテナンスリマインダーの自動送信", plan: "pro_plus", status: "active",  category: "line" },
  // ── Pro Plus — AI Platform (feature-gate active; UI not yet built) ────────
  //   Access key is in PLAN_FEATURES.pro_plus so checks work when UI is added.
  //   No UI components or server actions exist yet — "planned" reflects UI status.
  { key: "ai_gateway",          nameJa: "AI Gateway",           descriptionJa: "AIプロバイダー管理（OpenAI/Claude/Gemini/OpenRouter等）",    plan: "pro_plus", status: "planned", category: "ai_platform" },
  { key: "ai_marketing",        nameJa: "AIマーケティング",      descriptionJa: "施工記録からSNSコンテンツを自動生成・公開（PHASE 71–75）",  plan: "pro_plus", status: "planned", category: "ai_platform" },
  { key: "ai_reputation",       nameJa: "AI評判管理",           descriptionJa: "レビュー依頼・Googleレビュー連携・評判分析（PHASE 77–81）", plan: "pro_plus", status: "planned", category: "ai_platform" },
  { key: "ai_growth",           nameJa: "AI成長エージェント",   descriptionJa: "AIによる事業成長分析・提案（PHASE 76）",                   plan: "pro_plus", status: "planned", category: "ai_platform" },
  // ── Pro Plus — AI Platform sub-features (AppFeature type only; not in PLAN_FEATURES yet) ──
  { key: "ai_video_generation", nameJa: "AI動画生成",           descriptionJa: "施工写真からマーケティング動画を自動生成（PHASE 72）",       plan: "pro_plus", status: "planned", category: "ai_platform" },
  { key: "ai_review_assistant", nameJa: "AIレビュー支援",       descriptionJa: "Googleレビュー返信文の下書き生成（PHASE 79）",              plan: "pro_plus", status: "planned", category: "ai_platform" },
  { key: "ai_social_scheduler", nameJa: "SNSスケジューラー",    descriptionJa: "SNS投稿の予約・自動公開（PHASE 74）",                      plan: "pro_plus", status: "planned", category: "ai_platform" },
  { key: "ai_marketing_analytics", nameJa: "マーケティング分析", descriptionJa: "投稿パフォーマンス・MEO/SEO効果分析（PHASE 75）",          plan: "pro_plus", status: "planned", category: "ai_platform" },
];

// ─── Lookup helpers ───────────────────────────────────────────────────────────

export function getFeatureMetadata(key: AppFeature): FeatureMetadata | undefined {
  return FEATURE_REGISTRY.find((f) => f.key === key);
}

export function getFeaturesByCategory(category: FeatureCategory): FeatureMetadata[] {
  return FEATURE_REGISTRY.filter((f) => f.category === category);
}

export function getFeaturesByPlan(plan: DealerPlan): FeatureMetadata[] {
  return FEATURE_REGISTRY.filter((f) => f.plan === plan);
}

export function getActiveFeatures(): FeatureMetadata[] {
  return FEATURE_REGISTRY.filter((f) => f.status === "active");
}

export function getPlannedFeatures(): FeatureMetadata[] {
  return FEATURE_REGISTRY.filter((f) => f.status === "planned");
}
