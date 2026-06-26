// DealerOS — AI Reputation Agent: Main Agent Class
//
// Implements AIAgent<ReputationAgentRequest, ReputationAgentResponse>.
// All inference deferred to Phase G via AIAgentNotImplementedError.
// Validation is production-quality and runs unconditionally.

import type { AIAgent, AIAgentContext, AIAgentValidationResult } from "@/lib/ai/agents/types";
import { AIAgentNotImplementedError }  from "@/lib/ai/agents/types";
import type { AIAgentCapability }      from "@/lib/ai/capabilities";
import type { AITaskType }             from "@/lib/ai/types";
import type {
  ReputationAgentRequest,
  ReputationAgentResponse,
  ReputationCapability,
} from "./types";
import { DEFAULT_REPUTATION_CONTEXT } from "./types";
import { REPUTATION_COMPLIANCE }       from "./workflow";

export class ReputationAgent
  implements AIAgent<ReputationAgentRequest, ReputationAgentResponse>
{
  readonly id              = "reputation_agent" as const;
  readonly nameJa          = "AI評判管理エージェント";
  readonly descJa          =
    "Googleレビュー分析・返答ドラフト・評判スコア追跡・MEO/AEOフィードバックループ。ライン経由のレビューリクエスト生成。";
  readonly capabilities: AIAgentCapability[] = [
    "review_management",
    "analytics_reporting",
    "search_optimization",
  ];
  readonly requiredFeature = "ai_reputation" as const;
  readonly requiredTaskTypes: AITaskType[] = [
    "review_request_generation",
    "review_response_drafting",
    "reputation_analysis",
  ];

  /** Agent-level capabilities beyond the framework's AIAgentCapability. */
  readonly reputationCapabilities: ReputationCapability[] = [
    "generate_review_request",
    "draft_review_response",
    "analyze_reputation",
    "extract_seo_signals",
    "generate_marketing_feed",
  ];

  // Compliance rules are permanently locked — surface for inspection.
  readonly compliance = REPUTATION_COMPLIANCE;

  // ─── Lifecycle: initialize ─────────────────────────────────────────────────

  async initialize(ctx: AIAgentContext): Promise<void> {
    // Validate context — dealer_id must be populated by createAgentContext().
    if (!ctx.dealer_id) {
      throw new Error("ReputationAgent: dealer_id missing from context");
    }
    // Platform config loaded here in Phase G from dealer_settings.
    // For Sprint 10E, defaults are used.
    void DEFAULT_REPUTATION_CONTEXT; // Accessed at Phase G
  }

  // ─── Lifecycle: validate ───────────────────────────────────────────────────

  async validate(
    _ctx: AIAgentContext,
    input: ReputationAgentRequest,
  ): Promise<AIAgentValidationResult> {
    const errors: Array<{ field: string; message: string }> = [];

    switch (input.task_type) {

      case "review_request_generation": {
        const p = input.payload;
        if (!p.customer_id?.trim()) {
          errors.push({ field: "customer_id", message: "顧客IDが必要です" });
        }
        if (!p.customer_name?.trim()) {
          errors.push({ field: "customer_name", message: "顧客名が必要です" });
        }
        if (!p.job_id?.trim()) {
          errors.push({ field: "job_id", message: "施工IDが必要です" });
        }
        if (!p.review_url?.trim()) {
          errors.push({ field: "review_url", message: "レビューURLが必要です" });
        } else if (!isValidUrl(p.review_url)) {
          errors.push({ field: "review_url", message: "有効なURLを入力してください" });
        }
        if (!p.platform) {
          errors.push({ field: "platform", message: "レビュープラットフォームを選択してください" });
        }
        break;
      }

      case "review_response_drafting": {
        const p = input.payload;
        if (!p.review?.review_id?.trim()) {
          errors.push({ field: "review.review_id", message: "レビューIDが必要です" });
        }
        if (!p.review?.text?.trim()) {
          errors.push({ field: "review.text", message: "レビュー本文が必要です" });
        }
        if (p.review?.rating !== undefined) {
          const r = p.review.rating;
          if (r < 1 || r > 5 || !Number.isInteger(r)) {
            errors.push({ field: "review.rating", message: "評価は1〜5の整数で入力してください" });
          }
        }
        break;
      }

      case "reputation_analysis": {
        const p = input.payload;
        if (!p.period_start) {
          errors.push({ field: "period_start", message: "分析期間の開始日が必要です" });
        } else if (!isIsoDate(p.period_start)) {
          errors.push({ field: "period_start", message: "開始日はYYYY-MM-DD形式で入力してください" });
        }
        if (!p.period_end) {
          errors.push({ field: "period_end", message: "分析期間の終了日が必要です" });
        } else if (!isIsoDate(p.period_end)) {
          errors.push({ field: "period_end", message: "終了日はYYYY-MM-DD形式で入力してください" });
        }
        if (p.period_start && p.period_end && p.period_start > p.period_end) {
          errors.push({ field: "period_end", message: "終了日は開始日より後の日付を設定してください" });
        }
        if (!p.reviews || p.reviews.length === 0) {
          errors.push({ field: "reviews", message: "分析対象のレビューが1件以上必要です" });
        }
        break;
      }

      default:
        errors.push({ field: "task_type", message: "未対応のタスクタイプです" });
    }

    if (errors.length > 0) return { valid: false, errors };
    return { valid: true };
  }

  // ─── Lifecycle: execute ────────────────────────────────────────────────────

  async execute(
    _ctx: AIAgentContext,
    input: ReputationAgentRequest,
  ): Promise<ReputationAgentResponse> {
    // Phase G: call the AI provider adapter via AI Gateway.
    // Sprint 10E: all three task types defer to Phase G.
    throw new AIAgentNotImplementedError(this.id);
    // TypeScript satisfaction — unreachable but required for return type.
    // eslint-disable-next-line no-unreachable
    void input;
  }

  // ─── Lifecycle: postProcess ────────────────────────────────────────────────

  async postProcess(
    _ctx: AIAgentContext,
    output: ReputationAgentResponse,
  ): Promise<ReputationAgentResponse> {
    // Phase G: apply compliance filters — strip any star rating suggestions,
    // incentive language, or direct submission of review content.
    // Sprint 10E: pass through unchanged.
    return output;
  }
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function isValidUrl(raw: string): boolean {
  try {
    const u = new URL(raw);
    return u.protocol === "https:" || u.protocol === "http:";
  } catch {
    return false;
  }
}

function isIsoDate(raw: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(raw);
}
