// DealerOS — AI Orchestration Engine: Provider Execution Guard (Sprint 11M Phase B)
//
// 12-check execution guard that must be satisfied before any AI provider call.
//
// Check order:
//   1.  run_execute_flag                 — run_execute must be explicitly true
//   2.  dealer_pro_plus_access           — ai_gateway must be in active_features
//   3.  ai_gateway_feature_enabled       — gateway status not "not_pro_plus" or "not_configured"
//   4.  target_agent_feature_enabled     — agent's requiredFeature must be active
//   5.  provider_configured              — gateway.provider must be non-null
//   6.  provider_enabled                 — gateway.status not "disabled"
//   7.  encrypted_key_exists             — gateway.status not "no_key"
//   8.  capability_supported_by_provider — provider must support all required caps
//   9.  usage_policy_allows              — usage policy not hard-blocking
//  10.  monthly_limit_not_exceeded       — current spend within monthly_limit_usd
//  11.  dealer_billing_acknowledged      — billing policy confirmed in AIProviderExecutionPolicy
//  12.  no_key_exposure_risk             — structural: no raw key in execution context
//
// All 12 checks are evaluated. The decision is determined by the first required
// check that fails. Skipped checks (due to upstream failures) are marked passed: false.
//
// Pure — no "use server", no async, no DB calls, no external calls.

import type { AICapability }       from "@/lib/ai/capabilities";
import { getAgentEntry }           from "@/lib/ai/agents/registry";
import { getMissingCapabilities }  from "./capability-routing";
import { evaluateBudgetGuard }     from "./budget-guard";
import { inspectAdapterRegistry }  from "../provider-adapters";
import type {
  AIProviderExecutionCheckId,
  AIProviderExecutionCheckResult,
  AIProviderExecutionContext,
  AIProviderExecutionDecision,
  AIProviderExecutionGuardResult,
  AIProviderExecutionPolicy,
  AIProviderExecutionRequest,
} from "./execution-readiness-types";

// ─── Internal check builder ───────────────────────────────────────────────────

function makeCheck(
  check_id: AIProviderExecutionCheckId,
  passed:   boolean,
  required: boolean,
  message:  string,
  details:  Record<string, unknown> = {},
): AIProviderExecutionCheckResult {
  return { check_id, passed, required, message, details };
}

// ─── 12 individual checks ─────────────────────────────────────────────────────

function checkRunExecuteFlag(
  ctx:    AIProviderExecutionContext,
  policy: AIProviderExecutionPolicy,
): AIProviderExecutionCheckResult {
  const passed = ctx.run_execute === true && policy.run_execute === true;
  return makeCheck(
    "run_execute_flag",
    passed,
    true,
    passed
      ? "run_execute is explicitly true — execution is authorized"
      : "run_execute must be explicitly set to true before any AI provider call (Sprint 11N+)",
    { context_run_execute: ctx.run_execute, policy_run_execute: policy.run_execute },
  );
}

function checkDealerProPlusAccess(
  ctx: AIProviderExecutionContext,
): AIProviderExecutionCheckResult {
  const passed = ctx.active_features.includes("ai_gateway");
  return makeCheck(
    "dealer_pro_plus_access",
    passed,
    true,
    passed
      ? "Dealer has Pro+ plan with ai_gateway feature active"
      : "ai_gateway feature is not active — dealer requires Pro+ plan to use AI providers",
    { active_features_sample: ctx.active_features.slice(0, 6) },
  );
}

function checkAiGatewayFeatureEnabled(
  ctx: AIProviderExecutionContext,
): AIProviderExecutionCheckResult {
  const blocking_statuses = ["not_pro_plus", "not_configured", "migration_required"] as const;
  const passed = !blocking_statuses.includes(ctx.gateway_status as typeof blocking_statuses[number]);
  return makeCheck(
    "ai_gateway_feature_enabled",
    passed,
    true,
    passed
      ? `AI Gateway is operational (status: ${ctx.gateway_status})`
      : `AI Gateway is not available (status: ${ctx.gateway_status})`,
    { gateway_status: ctx.gateway_status },
  );
}

function checkTargetAgentFeatureEnabled(
  ctx: AIProviderExecutionContext,
): AIProviderExecutionCheckResult {
  const entry = getAgentEntry(ctx.agent_id);
  if (!entry) {
    return makeCheck(
      "target_agent_feature_enabled",
      false,
      true,
      `Agent '${ctx.agent_id}' is not registered in AI_AGENT_REGISTRY`,
      { agent_id: ctx.agent_id },
    );
  }
  const passed = ctx.active_features.includes(entry.requiredFeature);
  return makeCheck(
    "target_agent_feature_enabled",
    passed,
    true,
    passed
      ? `Required feature '${entry.requiredFeature}' is active for agent '${ctx.agent_id}'`
      : `Required feature '${entry.requiredFeature}' is not active — cannot run '${ctx.agent_id}'`,
    { agent_id: ctx.agent_id, required_feature: entry.requiredFeature },
  );
}

function checkProviderConfigured(
  ctx: AIProviderExecutionContext,
): AIProviderExecutionCheckResult {
  const passed = ctx.gateway_provider !== null;
  return makeCheck(
    "provider_configured",
    passed,
    true,
    passed
      ? `Provider is configured: ${ctx.gateway_provider}`
      : "No AI provider is configured — dealer must select a provider in AI Gateway settings",
    { gateway_provider: ctx.gateway_provider },
  );
}

function checkProviderEnabled(
  ctx: AIProviderExecutionContext,
): AIProviderExecutionCheckResult {
  const passed = ctx.gateway_status !== "disabled";
  return makeCheck(
    "provider_enabled",
    passed,
    true,
    passed
      ? "Provider is not disabled"
      : "AI Gateway is disabled — dealer must re-enable it in AI settings",
    { gateway_status: ctx.gateway_status },
  );
}

function checkEncryptedKeyExists(
  ctx: AIProviderExecutionContext,
): AIProviderExecutionCheckResult {
  const passed = ctx.gateway_status !== "no_key";
  return makeCheck(
    "encrypted_key_exists",
    passed,
    true,
    passed
      ? "Encrypted API key is stored for the configured provider"
      : "No encrypted API key is stored — dealer must add their provider API key in AI Gateway settings",
    { gateway_status: ctx.gateway_status },
  );
}

function checkCapabilitySupportedByProvider(
  ctx:             AIProviderExecutionContext,
  required_caps:   AICapability[],
): AIProviderExecutionCheckResult {
  if (!ctx.gateway_provider) {
    return makeCheck(
      "capability_supported_by_provider",
      false,
      true,
      "Cannot evaluate capability support — no provider configured (see check #5)",
      { required_caps },
    );
  }
  const missing = getMissingCapabilities(ctx.gateway_provider, required_caps);
  const passed  = missing.length === 0;
  return makeCheck(
    "capability_supported_by_provider",
    passed,
    true,
    passed
      ? `Provider '${ctx.gateway_provider}' supports all required capabilities: ${required_caps.join(", ")}`
      : `Provider '${ctx.gateway_provider}' does not support: ${missing.join(", ")}`,
    { provider: ctx.gateway_provider, required_caps, missing_caps: missing },
  );
}

function checkUsagePolicyAllows(
  ctx:    AIProviderExecutionContext,
  policy: AIProviderExecutionPolicy,
): AIProviderExecutionCheckResult {
  const { limit_reached, hard_limit } = ctx.usage_policy;
  const blocked = hard_limit && limit_reached && policy.enforce_hard_limit;
  return makeCheck(
    "usage_policy_allows",
    !blocked,
    true,
    !blocked
      ? "Usage policy allows execution"
      : "Usage policy is blocking execution — monthly limit has been reached (hard_limit: true)",
    {
      hard_limit,
      limit_reached,
      enforce_hard_limit: policy.enforce_hard_limit,
      monthly_limit_usd:  ctx.usage_policy.monthly_limit_usd,
    },
  );
}

function checkMonthlyLimitNotExceeded(
  ctx:                 AIProviderExecutionContext,
  estimated_cost_usd:  number,
  policy:              AIProviderExecutionPolicy,
): AIProviderExecutionCheckResult {
  const { monthly_limit_usd, current_month_usd } = ctx.usage_policy;

  // No limit configured — always passes
  if (monthly_limit_usd === 0) {
    return makeCheck(
      "monthly_limit_not_exceeded",
      true,
      true,
      "No monthly spending limit configured",
      { monthly_limit_usd: 0 },
    );
  }

  const projected = current_month_usd + estimated_cost_usd;
  const would_exceed = projected > monthly_limit_usd;
  const blocked = would_exceed && policy.enforce_hard_limit;

  return makeCheck(
    "monthly_limit_not_exceeded",
    !blocked,
    true,
    !blocked
      ? `Projected spend $${projected.toFixed(4)} is within monthly limit $${monthly_limit_usd.toFixed(2)}`
      : `Projected spend $${projected.toFixed(4)} would exceed monthly limit $${monthly_limit_usd.toFixed(2)}`,
    {
      monthly_limit_usd,
      current_month_usd,
      estimated_cost_usd,
      projected_total_usd: projected,
      enforce_hard_limit:  policy.enforce_hard_limit,
    },
  );
}

function checkDealerBillingAcknowledged(
  policy: AIProviderExecutionPolicy,
): AIProviderExecutionCheckResult {
  const passed = policy.dealer_billing_policy_confirmed === true;
  return makeCheck(
    "dealer_billing_acknowledged",
    passed,
    true,
    passed
      ? "Dealer billing policy confirmed — dealer acknowledges AI inference is billed to their own provider key"
      : "Dealer billing policy not confirmed — dealer must acknowledge they own AI inference costs",
    { dealer_billing_policy_confirmed: policy.dealer_billing_policy_confirmed },
  );
}

// ─── Check 13 (Sprint 11N): Adapter registry inspection ──────────────────────

function checkAdapterRegistryStatus(
  ctx:            AIProviderExecutionContext,
  required_caps:  AICapability[],
): AIProviderExecutionCheckResult {
  // If no provider configured, check #5 already handles it — pass trivially here
  if (!ctx.gateway_provider) {
    return makeCheck(
      "adapter_registry_check",
      true,
      false, // Non-required — check #5 already enforces provider_configured
      "No provider configured — adapter registry check not applicable",
      { registry_decision: "provider_unknown" },
    );
  }

  const inspection = inspectAdapterRegistry(ctx.gateway_provider, required_caps);

  switch (inspection.decision) {
    case "provider_unknown":
      return makeCheck(
        "adapter_registry_check",
        false,
        true,  // Blocking — unknown providers cannot be used
        inspection.message,
        { registry_decision: "provider_unknown", provider_id: ctx.gateway_provider },
      );

    case "capability_unavailable":
      return makeCheck(
        "adapter_registry_check",
        false,
        true,  // Blocking — unavailable capabilities cannot be implemented for this provider
        inspection.message,
        {
          registry_decision:  "capability_unavailable",
          provider_id:        ctx.gateway_provider,
          unavailable_caps:   inspection.unavailable_caps,
        },
      );

    case "needs_adapter":
      return makeCheck(
        "adapter_registry_check",
        false,
        false, // Non-blocking in Sprint 11N — adapter will be available in Sprint 11O+
        inspection.message,
        {
          registry_decision:      "needs_adapter",
          provider_id:            ctx.gateway_provider,
          planned_sprint:         "Sprint 11O+",
          descriptor_found:       inspection.descriptor_found,
        },
      );

    case "adapter_available":
      return makeCheck(
        "adapter_registry_check",
        true,
        false,
        inspection.message,
        { registry_decision: "adapter_available", provider_id: ctx.gateway_provider },
      );
  }
}

function checkNoKeyExposureRisk(
  ctx: AIProviderExecutionContext,
): AIProviderExecutionCheckResult {
  // Structural check: AIProviderExecutionContext deliberately has no api_key field.
  // This check always passes as long as the type contract is maintained.
  // If a future code change ever adds a raw key to the context, this check becomes
  // the compile-time and runtime assertion point.
  const context_keys = Object.keys(ctx as unknown as Record<string, unknown>);
  const risky_fields = context_keys.filter((k) =>
    k.toLowerCase().includes("key") ||
    k.toLowerCase().includes("secret") ||
    k.toLowerCase().includes("token"),
  );
  const passed = risky_fields.length === 0;
  return makeCheck(
    "no_key_exposure_risk",
    passed,
    true,
    passed
      ? "Execution context contains no raw API key, secret, or token fields"
      : `Execution context contains potentially sensitive fields: ${risky_fields.join(", ")}`,
    { context_field_count: context_keys.length, risky_fields },
  );
}

// ─── Main guard function ──────────────────────────────────────────────────────

/**
 * checkProviderExecutionReadiness — evaluates all 12 execution guard checks.
 *
 * Runs all checks in order. Returns the first required check that failed as
 * `failed_check`. Decision is "deny" or "needs_configuration" depending on
 * which check failed. "allow" only if all required checks pass.
 *
 * Decision classification:
 *   needs_configuration → check #3, #4, #5, #6, #7, #8 (dealer must configure something)
 *   deny               → check #1, #2, #9, #10, #11, #12 (execution is not permitted)
 *
 * dealer_id must come from getCurrentDealer() in the calling server action.
 */
export function checkProviderExecutionReadiness(
  request: AIProviderExecutionRequest,
  policy:  AIProviderExecutionPolicy,
  now:     string,
): AIProviderExecutionGuardResult {
  const { context: ctx, estimated_cost_usd } = request;
  const required_caps = ctx.required_caps;

  const checks: AIProviderExecutionCheckResult[] = [
    checkRunExecuteFlag(ctx, policy),
    checkDealerProPlusAccess(ctx),
    checkAiGatewayFeatureEnabled(ctx),
    checkTargetAgentFeatureEnabled(ctx),
    checkProviderConfigured(ctx),
    checkProviderEnabled(ctx),
    checkEncryptedKeyExists(ctx),
    checkCapabilitySupportedByProvider(ctx, required_caps),
    checkUsagePolicyAllows(ctx, policy),
    checkMonthlyLimitNotExceeded(ctx, estimated_cost_usd, policy),
    checkDealerBillingAcknowledged(policy),
    checkNoKeyExposureRisk(ctx),
    checkAdapterRegistryStatus(ctx, required_caps), // Sprint 11N check #13
  ];

  // Find the first required check that failed
  const failed = checks.find((c) => c.required && !c.passed);

  if (!failed) {
    return {
      decision:           "allow",
      checks,
      failed_check:       null,
      denial_reason:      null,
      configuration_step: null,
      evaluated_at:       now,
    };
  }

  // For the adapter_registry_check, read the specific decision from check details
  const decision: AIProviderExecutionDecision =
    failed.check_id === "adapter_registry_check"
      ? classifyAdapterRegistryDecision(failed.details)
      : classifyDecision(failed.check_id);

  // "deny" → denial_reason; any non-allow, non-deny decision → configuration_step
  const is_configuration_issue = decision !== "allow" && decision !== "deny";

  return {
    decision,
    checks,
    failed_check:       failed.check_id,
    denial_reason:      decision === "deny" ? failed.message : null,
    configuration_step: is_configuration_issue ? failed.message : null,
    evaluated_at:       now,
  };
}

// ─── Decision classification ──────────────────────────────────────────────────

/**
 * classifyDecision — maps a failed check ID (checks 1–12) to its decision type.
 *
 * "needs_configuration" checks are ones the dealer can fix by configuring the
 * AI Gateway or enabling a feature — not fundamental access denials.
 *
 * "deny" checks represent hard blockers: execution policy is false, plan limit
 * is reached, billing is not acknowledged, or a security constraint is violated.
 *
 * Check #13 (adapter_registry_check) uses classifyAdapterRegistryDecision() instead.
 */
function classifyDecision(
  check_id: AIProviderExecutionCheckId,
): AIProviderExecutionDecision {
  const configuration_checks: AIProviderExecutionCheckId[] = [
    "ai_gateway_feature_enabled",
    "target_agent_feature_enabled",
    "provider_configured",
    "provider_enabled",
    "encrypted_key_exists",
    "capability_supported_by_provider",
  ];
  return configuration_checks.includes(check_id) ? "needs_configuration" : "deny";
}

/**
 * classifyAdapterRegistryDecision — maps the adapter registry check's details
 * to the specific Sprint 11N decision type.
 *
 * Called when check #13 (adapter_registry_check) is the failed check.
 */
function classifyAdapterRegistryDecision(
  details: Record<string, unknown>,
): AIProviderExecutionDecision {
  const registry_decision = details["registry_decision"] as string | undefined;
  switch (registry_decision) {
    case "provider_unknown":       return "provider_unknown";
    case "capability_unavailable": return "capability_unavailable";
    case "needs_adapter":          return "needs_adapter";
    default:                       return "needs_configuration";
  }
}

// ─── Guard object (implements AIProviderExecutionGuard interface) ─────────────

export const PROVIDER_EXECUTION_GUARD = {
  evaluate(
    request: AIProviderExecutionRequest,
    policy:  AIProviderExecutionPolicy,
    now:     string,
  ): AIProviderExecutionGuardResult {
    return checkProviderExecutionReadiness(request, policy, now);
  },
} as const;
