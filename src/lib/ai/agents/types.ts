// DealerOS — AI Agent Framework: Core Types
//
// Every future AI module must implement the AIAgent<TInput, TOutput> interface.
// All lifecycle orchestration flows through runAgentLifecycle() in lifecycle.ts.
//
// Strict rules (non-negotiable):
//   - dealer_id is ALWAYS in AIAgentContext, injected via createAgentContext()
//   - Never pass dealer_id from client input
//   - Agent execute() throws AIAgentNotImplementedError until Phase G adapters exist
//   - All errors use Japanese user-readable messages

import type { DealerPlan }            from "@/lib/plans/plan-types";
import type { AppFeature }            from "@/lib/plans/plan-types";
import type { AIProviderId, AITaskType } from "../types";
import type { AIUsageEstimate, AIUsagePolicy } from "../usage-policy";
import type { AIGatewayReadiness }    from "../ai-settings-types";
import type { AIAgentCapability }     from "../capabilities";

// ─── Agent identifiers ────────────────────────────────────────────────────────

export type AIAgentId =
  | "marketing_agent"    // Content, SNS, SEO/MEO/AEO/LLMO/AIO (PHASE 71–75)
  | "reputation_agent"   // Review requests, GBP responses, analytics (PHASE 77–81)
  | "growth_agent"       // Growth signals, keyword trends, recommendations (PHASE 76)
  | "ocr_agent"          // Dealer-key OCR for general documents
  | "review_agent"       // LINE review request + GBP response drafting (PHASE 77–78)
  | "line_agent"         // LINE message generation and automation
  | "seo_agent";         // SEO / MEO / AEO / LLMO / AIO optimization (PHASE 71–72)

// ─── Agent context ────────────────────────────────────────────────────────────

/**
 * Injected by createAgentContext() — never constructed from client input.
 * Every agent lifecycle call starts with this context.
 */
export interface AIAgentContext {
  /** Always from getCurrentDealer() — never from client. */
  dealer_id: string;
  plan:      DealerPlan;
  gateway:   AIGatewayReadiness;
  policy:    AIUsagePolicy;
  /** UUID generated per request for observability and future log correlation. */
  trace_id:  string;
}

// ─── Base request ─────────────────────────────────────────────────────────────

export interface AIAgentRequest {
  agent_id:  AIAgentId;
  task_type: AITaskType;
  /** Caller-provided trace ID. Auto-generated if omitted. */
  trace_id?: string;
}

// ─── Base response ────────────────────────────────────────────────────────────

export interface AIAgentResponse {
  agent_id:        AIAgentId;
  success:         boolean;
  trace_id:        string;
  executed_at:     string;          // ISO 8601
  provider_used?:  AIProviderId;    // Set on successful inference (Phase G+)
  usage_estimate?: AIUsageEstimate; // Advisory — set when inference was performed
  /** User-readable Japanese error message. Set when success === false. */
  error?:          string;
}

// ─── Validation ───────────────────────────────────────────────────────────────

export interface AIAgentValidationError {
  field:   string;
  message: string;
}

export type AIAgentValidationResult =
  | { valid: true }
  | { valid: false; errors: AIAgentValidationError[] };

// ─── Lifecycle ────────────────────────────────────────────────────────────────

export type AIAgentLifecycleState =
  | "idle"
  | "initializing"
  | "validating"
  | "executing"
  | "post_processing"
  | "logging_usage"
  | "complete"
  | "failed";

export interface AIAgentLifecycleResult<T extends AIAgentResponse = AIAgentResponse> {
  state:       AIAgentLifecycleState;
  response?:   T;
  /** Japanese error message. Set when state === "failed". */
  error?:      string;
  duration_ms: number;
  trace_id:    string;
}

// ─── Core agent interface ─────────────────────────────────────────────────────

/**
 * Every AI agent module must implement this interface.
 * Generic parameters default to the base request/response for agents that
 * don't need a specialized input/output type.
 */
export interface AIAgent<
  TInput  extends AIAgentRequest  = AIAgentRequest,
  TOutput extends AIAgentResponse = AIAgentResponse,
> {
  readonly id:               AIAgentId;
  readonly nameJa:           string;
  readonly descJa:           string;
  readonly capabilities:     AIAgentCapability[];
  readonly requiredFeature:  AppFeature;
  readonly requiredTaskTypes: AITaskType[];

  /**
   * Called once before validate/execute.
   * Load config, verify dependencies, warm caches.
   * Must be idempotent — may be called multiple times.
   */
  initialize(ctx: AIAgentContext): Promise<void>;

  /**
   * Validate inputs without side effects.
   * Called before execute(). Return early with errors to skip inference.
   */
  validate(ctx: AIAgentContext, input: TInput): Promise<AIAgentValidationResult>;

  /**
   * Execute the agent task.
   * Sprint 10D: all concrete agents throw AIAgentNotImplementedError.
   * Phase G: replaced with provider adapter calls.
   */
  execute(ctx: AIAgentContext, input: TInput): Promise<TOutput>;

  /**
   * Transform or enrich the response after successful execution.
   * Called only when execute() returns successfully.
   * May filter, format, or append metadata to the output.
   */
  postProcess(ctx: AIAgentContext, output: TOutput): Promise<TOutput>;
}

// ─── Execution policy ─────────────────────────────────────────────────────────

export interface ExecutionPolicyResult {
  allowed:  boolean;
  agent_id: AIAgentId;
  /** Japanese message explaining why execution was blocked. Set when !allowed. */
  reason?:  string;
}

// ─── Error types ─────────────────────────────────────────────────────────────

export class AIAgentError extends Error {
  constructor(
    public readonly agent_id: AIAgentId,
    message: string,
  ) {
    super(message);
    this.name = "AIAgentError";
  }
}

/**
 * Thrown by all agent execute() methods in Sprint 10D.
 * Replaced by real implementations when Phase G adapters are built.
 * lifecycle.ts catches this and returns a structured "not yet implemented" response.
 */
export class AIAgentNotImplementedError extends AIAgentError {
  constructor(agent_id: AIAgentId) {
    super(
      agent_id,
      `Agent "${agent_id}" inference is not yet implemented — deferred to Phase G (adapter implementation)`,
    );
    this.name = "AIAgentNotImplementedError";
  }
}

export class AIAgentGatewayError extends AIAgentError {
  constructor(agent_id: AIAgentId, gatewayMessage: string) {
    super(agent_id, `AI Gateway not ready for "${agent_id}": ${gatewayMessage}`);
    this.name = "AIAgentGatewayError";
  }
}

export class AIAgentValidationFailedError extends AIAgentError {
  constructor(agent_id: AIAgentId, errors: AIAgentValidationError[]) {
    super(
      agent_id,
      `Validation failed for "${agent_id}": ${errors.map((e) => e.message).join(", ")}`,
    );
    this.name = "AIAgentValidationFailedError";
  }
}
