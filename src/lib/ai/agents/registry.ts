// DealerOS — AI Agent Framework: Registry
//
// Central registry for all GYEON AI agents.
// Provides registration, lookup, and capability discovery.
// Agents are registered here before their implementation modules exist.

import type { AppFeature }        from "@/lib/plans/plan-types";
import type { AITaskType }        from "../types";
import type { AIAgentCapability } from "../capabilities";
import type { AICapability }      from "../capabilities";
import type { AIAgentId }         from "./types";

// ─── Registry entry ───────────────────────────────────────────────────────────

export type AIAgentStatus = "active" | "planned";

export interface AIAgentRegistryEntry {
  id:                    AIAgentId;
  nameJa:                string;
  descJa:                string;
  /** High-level capabilities this agent provides. */
  capabilities:          AIAgentCapability[];
  /** Provider-level capabilities this agent requires to function. */
  requiredProviderCaps:  AICapability[];
  /** AppFeature gate — must be active for the dealer before this agent runs. */
  requiredFeature:       AppFeature;
  /** Task types this agent can handle. */
  taskTypes:             AITaskType[];
  /** "active" = framework registered; "planned" = architecture reserved. */
  status:                AIAgentStatus;
  /** Roadmap phase reference for documentation traceability. */
  phase:                 string;
}

// ─── Registry ─────────────────────────────────────────────────────────────────

export const AI_AGENT_REGISTRY: AIAgentRegistryEntry[] = [
  {
    id:                   "marketing_agent",
    nameJa:               "AIマーケティングエージェント",
    descJa:               "SNSキャプション・ブログ・施工説明文の生成、SEO/MEO/AEO/LLMO/AIO最適化、コンテンツカレンダー管理。",
    capabilities:         ["content_creation", "search_optimization", "social_media", "analytics_reporting"],
    requiredProviderCaps: ["text_generation", "function_calling", "seo_analysis"],
    requiredFeature:      "ai_marketing",
    taskTypes:            ["content_writing", "keyword_extraction", "reputation_analysis"],
    status:               "planned",
    phase:                "PHASE 71–75",
  },
  {
    id:                   "reputation_agent",
    nameJa:               "AI評判管理エージェント",
    descJa:               "Googleレビュー分析・返答ドラフト・評判スコア追跡・MEO/AEOフィードバックループ。ライン経由のレビューリクエスト生成。",
    capabilities:         ["review_management", "analytics_reporting", "search_optimization"],
    requiredProviderCaps: ["text_generation", "chat_completion", "function_calling", "meo_analysis"],
    requiredFeature:      "ai_reputation",
    taskTypes:            [
      "review_request_generation",
      "review_response_drafting",
      "reputation_analysis",
      "keyword_extraction",
    ],
    status:               "active",
    phase:                "PHASE 77–81 (Sprint 10E foundation)",
  },
  {
    id:                   "growth_agent",
    nameJa:               "AI成長エージェント",
    descJa:               "成長シグナル分析・競合トレンド検出・施策レコメンデーション・KPIレポート。",
    capabilities:         ["analytics_reporting", "search_optimization"],
    requiredProviderCaps: ["text_generation", "function_calling", "analytics"],
    requiredFeature:      "ai_growth",
    taskTypes:            ["keyword_extraction", "reputation_analysis"],
    status:               "planned",
    phase:                "PHASE 76",
  },
  {
    id:                   "ocr_agent",
    nameJa:               "AI OCRエージェント",
    descJa:               "ディーラー所有APIキーによる汎用OCR（書類・フォーム・施工仕様書）。車検証OCRとは別コンテキスト。",
    capabilities:         ["document_reading", "image_understanding"],
    requiredProviderCaps: ["vision", "ocr", "function_calling"],
    requiredFeature:      "ai_gateway",
    taskTypes:            ["image_analysis"],
    status:               "planned",
    phase:                "AI Gateway拡張（PHASE G後）",
  },
  {
    id:                   "review_agent",
    nameJa:               "AIレビューエージェント",
    descJa:               "LINE経由でのレビュー依頼メッセージ生成・Googleレビュー返答ドラフト（ディーラーが最終確認して投稿）。",
    capabilities:         ["review_management", "line_integration"],
    requiredProviderCaps: ["text_generation", "chat_completion"],
    requiredFeature:      "ai_reputation",
    taskTypes:            [
      "review_request_generation",
      "review_writing_support",
      "review_response_drafting",
    ],
    status:               "active",
    phase:                "PHASE 77–78 (Sprint 10E foundation)",
  },
  {
    id:                   "line_agent",
    nameJa:               "AI LINEエージェント",
    descJa:               "LINEメッセージのAI生成・パーソナライズ・施工完了通知・メンテナンスリマインダー文の自動作成。",
    capabilities:         ["line_integration", "content_creation"],
    requiredProviderCaps: ["text_generation", "chat_completion"],
    requiredFeature:      "ai_marketing",
    taskTypes:            ["review_request_generation", "content_writing"],
    status:               "planned",
    phase:                "PHASE 69–70 LINE拡張",
  },
  {
    id:                   "seo_agent",
    nameJa:               "AI SEO/MEO/AEOエージェント",
    descJa:               "ローカルSEO・Googleビジネスプロフィール最適化・AEO（回答エンジン）・LLMO・AIOへの対応。",
    capabilities:         ["search_optimization", "analytics_reporting"],
    requiredProviderCaps: ["text_generation", "seo_analysis", "meo_analysis", "aeo_analysis"],
    requiredFeature:      "ai_marketing",
    taskTypes:            ["keyword_extraction", "content_writing", "reputation_analysis"],
    status:               "planned",
    phase:                "PHASE 71–72",
  },
];

// ─── Lookup functions ─────────────────────────────────────────────────────────

export function getAgentEntry(id: AIAgentId): AIAgentRegistryEntry | undefined {
  return AI_AGENT_REGISTRY.find((a) => a.id === id);
}

export function getAgentsByCapability(
  capability: AIAgentCapability,
): AIAgentRegistryEntry[] {
  return AI_AGENT_REGISTRY.filter((a) => a.capabilities.includes(capability));
}

export function getAgentsByFeature(
  feature: AppFeature,
): AIAgentRegistryEntry[] {
  return AI_AGENT_REGISTRY.filter((a) => a.requiredFeature === feature);
}

export function getActiveAgents(): AIAgentRegistryEntry[] {
  return AI_AGENT_REGISTRY.filter((a) => a.status === "active");
}

export function getPlannedAgents(): AIAgentRegistryEntry[] {
  return AI_AGENT_REGISTRY.filter((a) => a.status === "planned");
}
