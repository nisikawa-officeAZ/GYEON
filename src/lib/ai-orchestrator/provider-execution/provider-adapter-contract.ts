// DealerOS — AI Orchestration Engine: Provider Adapter Contract (Sprint 11M Phase E)
//
// Type contract that all concrete provider adapters must satisfy.
//
// Sprint 11M scope — CONTRACT ONLY:
//   - No implementations here
//   - No adapter instances here
//   - No AI provider SDK imports here
//   - No fake API calls or placeholder responses
//   - adapter_available: false on all types (locked until Sprint 11N+)
//
// Billing rule (non-negotiable):
//   AI inference costs are ALWAYS billed to the dealer's own API key.
//   The adapter must NEVER use Office AZ credentials for inference.
//   The dealer_id is used to look up the dealer's encrypted key server-side.
//   Raw API keys must NEVER appear in AIProviderAdapterRequest or response types.
//
// Concrete adapter implementations per provider are delivered in Sprint 11N+.
// Each concrete adapter will live in src/lib/ai/adapters/{provider_id}.ts and
// register itself in the provider registry.

import type { AIProviderId }                from "@/lib/ai/types";
import type { AITaskType }                  from "@/lib/ai/types";
import type { AICapability }                from "@/lib/ai/capabilities";
import type { AIOrchestrationWorkflowId }   from "@/lib/ai-orchestrator/orchestrator-types";
import type { AIRetryableErrorCategory }    from "@/lib/ai-orchestrator/failure-strategy";

// ─── Adapter capability descriptor ───────────────────────────────────────────

/**
 * AIProviderAdapterCapability — describes one capability the adapter exposes.
 *
 * Concrete adapters declare this list at construction time.
 * The execution guard uses it to verify provider–task compatibility.
 */
export interface AIProviderAdapterCapability {
  capability:           AICapability;
  supported_task_types: AITaskType[];
  /**
   * Maximum input+output tokens for the default model.
   * null if the adapter does not enforce a specific limit.
   */
  max_tokens:           number | null;
  supports_streaming:   boolean;
}

// ─── Adapter request ──────────────────────────────────────────────────────────

/**
 * AIProviderAdapterRequest — the input to a concrete adapter's execute() call.
 *
 * Security rules:
 *   - dealer_id comes from getCurrentDealer() in the calling server action
 *   - NO raw API key field — the adapter fetches the key from the secure
 *     server-side encrypted key store using dealer_id
 *   - input_payload must not contain PII beyond what the agent explicitly puts there
 */
export interface AIProviderAdapterRequest {
  /** Always from getCurrentDealer(). Used to look up the dealer's encrypted API key. */
  dealer_id:      string;
  task_type:      AITaskType;
  /** The specific model to invoke (e.g. "gpt-4o", "claude-opus-4-8"). */
  model:          string;
  capability:     AICapability;
  workflow_id:    AIOrchestrationWorkflowId;
  /** ID of the execution step this request belongs to. */
  step_id:        string;
  /** Parent plan ID for tracing. */
  plan_id:        string;
  /** Cross-request trace ID for observability. */
  trace_id:       string;
  /**
   * Structured input payload — populated from step feed outputs in Sprint 11N+.
   * No API key, no raw secrets, no PII beyond what the agent explicitly sets.
   */
  input_payload:  Record<string, unknown>;
}

// ─── Adapter response ─────────────────────────────────────────────────────────

/**
 * AIProviderAdapterResponse — what a concrete adapter returns from execute().
 *
 * In Sprint 11M: execution_deferred is always true — no inference yet.
 * In Sprint 11N+: output_payload is populated, execution_deferred is still
 * typed as true (a literal) but its runtime semantics change — concrete
 * adapters will set success: true and populate output_payload.
 */
export interface AIProviderAdapterResponse {
  success:              boolean;
  provider:             AIProviderId;
  model:                string;
  capability:           AICapability;
  /**
   * Output from the AI provider call.
   * null in Sprint 11M — no inference executes.
   * Populated by concrete adapters in Sprint 11N+.
   */
  output_payload:       Record<string, unknown> | null;
  tokens_used:          number | null;
  estimated_cost_usd:   number | null;
  /**
   * Literal true in Sprint 11M — no AI inference executes in this sprint.
   * Concrete adapters in Sprint 11N+ retain this field as a structural marker
   * that the response came from the execution layer.
   */
  execution_deferred:   true;
  /** User-readable error string. Never includes raw API errors, keys, or stack traces. */
  error_message:        string | null;
  responded_at:         string;
}

// ─── Health check ─────────────────────────────────────────────────────────────

/**
 * AIProviderAdapterHealthCheck — result of a lightweight provider reachability check.
 *
 * healthCheck() does NOT perform inference — it is a connectivity/auth check only.
 * In Sprint 11M: all concrete adapter health checks are deferred.
 */
export interface AIProviderAdapterHealthCheck {
  provider:    AIProviderId;
  reachable:   boolean;
  /** Round-trip latency in milliseconds. null if check was not performed. */
  latency_ms:  number | null;
  checked_at:  string;
  /** Human-readable note about the check result. */
  note:        string;
}

// ─── Adapter error ────────────────────────────────────────────────────────────

/**
 * AIProviderAdapterErrorCategory — classification of errors a provider adapter can return.
 *
 * Structured so the execution guard and retry policy can decide whether to retry.
 */
export type AIProviderAdapterErrorCategory =
  | AIRetryableErrorCategory    // Inherited: rate_limit, server_error, network_timeout, etc.
  | "authentication_failed"     // API key invalid or expired
  | "model_not_found"           // Requested model ID doesn't exist
  | "context_too_long"          // Input exceeds model context window
  | "content_policy_violation"  // Provider rejected content due to policy
  | "billing_error"             // Provider billing or quota issue
  | "unsupported_capability"    // Adapter does not support this AICapability
  | "configuration_error"       // Adapter configuration missing or invalid
  | "unknown";                  // Unclassified error

/**
 * AIProviderAdapterError — structured error from a concrete adapter.
 *
 * message must be user-readable and must NEVER include:
 *   - Raw API error bodies
 *   - API key fragments
 *   - Stack traces
 *   - Internal service names or URLs
 */
export interface AIProviderAdapterError {
  category:    AIProviderAdapterErrorCategory;
  provider:    AIProviderId;
  /** User-readable explanation. Safe to display in dealer UI. */
  message:     string;
  retryable:   boolean;
  occurred_at: string;
}

// ─── Adapter contract ─────────────────────────────────────────────────────────

/**
 * AIProviderAdapterContract — the interface all concrete provider adapters must implement.
 *
 * Implementation notes for Sprint 11N+:
 *   - adapter_available must be updated to true when the implementation is complete
 *   - The execute() method must use the dealer's encrypted key from the server-side
 *     key store — it must NEVER accept an api_key parameter
 *   - healthCheck() must be a lightweight connectivity check, not a full inference call
 *   - All errors must be caught and wrapped in AIProviderAdapterError
 *   - No API provider SDK may be imported by the contract type — only by the concrete adapter
 *
 * Security constraints:
 *   - dealer_id must be validated against getCurrentDealer() before key lookup
 *   - The execution guard must return "allow" before execute() is called
 *   - Raw API response bodies must never be returned — map to AIProviderAdapterResponse
 */
export interface AIProviderAdapterContract {
  /** The AI provider this adapter targets. */
  readonly provider_id:       AIProviderId;
  /** Capabilities this adapter supports, with per-capability metadata. */
  readonly capabilities:      AIProviderAdapterCapability[];
  /**
   * Always false until the concrete adapter is fully implemented.
   * Set to true in Sprint 11N+ when the adapter passes all integration tests.
   * The execution guard checks this when require_adapter_available: true.
   */
  readonly adapter_available: false;

  /**
   * Check whether the provider endpoint is reachable and the dealer's key is valid.
   *
   * In Sprint 11M: returns a deferred health check (no real network call).
   * In Sprint 11N+: performs a real, low-cost API call to verify auth + connectivity.
   *
   * dealer_id is used to look up the dealer's encrypted key.
   * Must not call execute() or generate any tokens.
   */
  healthCheck(dealer_id: string, now: string): Promise<AIProviderAdapterHealthCheck>;

  /**
   * Execute a task through the provider.
   *
   * In Sprint 11M: MUST NOT be called. The execution guard blocks all calls
   * because run_execute is false.
   * In Sprint 11N+: performs real AI inference using the dealer's encrypted key.
   *
   * PRECONDITION: The execution guard must have returned decision: "allow" before
   * this method is invoked. Calling execute() without a prior "allow" decision
   * is a programming error and concrete adapters may throw.
   */
  execute(request: AIProviderAdapterRequest): Promise<AIProviderAdapterResponse>;
}
