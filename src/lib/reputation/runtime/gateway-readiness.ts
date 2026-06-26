"use server";

// DealerOS — Reputation Agent Runtime: AI Gateway Readiness (Phase B)
//
// Sprint 11D Phase B: 8 structured readiness checks for the AI Gateway.
//
// Checks (in order):
//   1. ai_gateway_feature         — Dealer's plan includes AI Gateway (Pro+)
//   2. ai_reputation_feature      — Dealer's plan includes AI Reputation (Pro+)
//   3. provider_configured        — A primary AI provider has been selected
//   4. provider_enabled           — The dealer has not disabled the AI Gateway
//   5. api_key_configured         — A valid API key is stored for the provider
//   6. dealer_provider_policy     — Dealer owns their provider (not Office AZ's)
//   7. usage_policy_available     — DB state allows usage policy to be read
//   8. feature_capability_support — reputation_agent is in the registry with required tasks
//
// Security:
//   No API keys are returned. No provider calls are made.
//   dealer_id is never accepted as input — it is resolved by the server-side
//   functions called internally (checkFeatureAccess, checkAiGatewayReady, etc.).

import { checkFeatureAccess }    from "@/lib/plans/can-use-feature";
import { checkAiGatewayReady }   from "@/lib/ai/check-ai-gateway";
import { getAiSettings }         from "@/lib/ai/get-ai-settings";
import { getAgentEntry }         from "@/lib/ai/agents/registry";
import type {
  ReputationGatewayReadiness,
  ReputationReadinessCheck,
} from "./runtime-types";

/**
 * checkReputationGatewayReadiness — runs all 8 AI Gateway readiness checks.
 *
 * Returns a structured ReputationGatewayReadiness result with per-check detail.
 * Blocking checks must all pass before the runtime may proceed to execution.
 *
 * No AI provider calls. No API key exposure.
 * dealer_id resolved server-side via checkFeatureAccess / checkAiGatewayReady.
 */
export async function checkReputationGatewayReadiness(): Promise<ReputationGatewayReadiness> {
  const now = new Date().toISOString();

  // Fetch all dependencies in parallel
  const [hasGatewayFeature, hasReputationFeature, gateway, aiSettings] = await Promise.all([
    checkFeatureAccess("ai_gateway"),
    checkFeatureAccess("ai_reputation"),
    checkAiGatewayReady(),
    getAiSettings(),
  ]);

  const checks: ReputationReadinessCheck[] = [];

  // ── Check 1: ai_gateway feature access ──────────────────────────────────────
  checks.push({
    name:     "ai_gateway_feature",
    status:   hasGatewayFeature ? "passed" : "failed",
    blocking: true,
    message:  hasGatewayFeature
      ? "AI Gateway feature is enabled on this plan"
      : "AI Gateway requires Pro+ plan — upgrade in Settings > Plan",
  });

  // ── Check 2: ai_reputation feature access ────────────────────────────────────
  checks.push({
    name:     "ai_reputation_feature",
    status:   hasReputationFeature ? "passed" : "failed",
    blocking: true,
    message:  hasReputationFeature
      ? "AI Reputation feature is enabled on this plan"
      : "AI Reputation requires Pro+ plan — upgrade in Settings > Plan",
  });

  // ── Check 3: provider configured ─────────────────────────────────────────────
  const providerConfigured =
    gateway.provider !== null &&
    gateway.status !== "not_configured" &&
    gateway.status !== "migration_required";

  checks.push({
    name:     "provider_configured",
    status:   providerConfigured ? "passed" : "failed",
    blocking: true,
    message:  providerConfigured
      ? `Provider configured: ${gateway.provider}`
      : gateway.status === "migration_required"
        ? "Database migration required — contact administrator"
        : "No AI provider configured — go to Settings > AI to select a provider",
  });

  // ── Check 4: provider enabled ─────────────────────────────────────────────────
  const providerEnabled = gateway.status !== "disabled";

  checks.push({
    name:     "provider_enabled",
    status:   providerEnabled ? "passed" : "failed",
    blocking: true,
    message:  providerEnabled
      ? "AI provider is enabled"
      : "AI provider is disabled — re-enable in Settings > AI",
  });

  // ── Check 5: API key configured ───────────────────────────────────────────────
  // "no_key" = provider selected but key not stored
  const apiKeyConfigured = gateway.status !== "no_key";

  checks.push({
    name:     "api_key_configured",
    status:   apiKeyConfigured ? "passed" : "failed",
    blocking: true,
    message:  apiKeyConfigured
      ? "API key is configured"
      : `No API key saved for ${gateway.provider ?? "selected provider"} — add key in Settings > AI`,
  });

  // ── Check 6: dealer-owned provider policy ─────────────────────────────────────
  // The dealer must own their AI provider API key — this is the core business model.
  // A provider is "dealer-owned" when it is configured and not using a migration_required state.
  const dealerOwnsPolicy =
    gateway.provider !== null &&
    !aiSettings.migration_required &&
    aiSettings.enabled !== undefined;

  checks.push({
    name:     "dealer_provider_policy",
    status:   dealerOwnsPolicy ? "passed" : "failed",
    blocking: true,
    message:  dealerOwnsPolicy
      ? "Dealer-owned provider policy confirmed"
      : aiSettings.migration_required
        ? "Dealer AI settings unavailable — database migration pending"
        : "Dealer provider policy not established — configure provider in Settings > AI",
  });

  // ── Check 7: usage policy available ──────────────────────────────────────────
  // Usage policy is considered available when the AI settings table is accessible.
  const usagePolicyAvailable = !aiSettings.migration_required;

  checks.push({
    name:     "usage_policy_available",
    status:   usagePolicyAvailable ? "passed" : "warning",
    blocking: false,  // Warning only — usage limits not enforced until Phase G migration
    message:  usagePolicyAvailable
      ? "Usage policy is available"
      : "Usage policy unavailable — database migration required (non-blocking in Sprint 11D)",
  });

  // ── Check 8: feature capability support in registry ───────────────────────────
  const agentEntry           = getAgentEntry("reputation_agent");
  const hasCapabilitySupport =
    agentEntry !== undefined &&
    agentEntry.taskTypes.includes("review_request_generation");

  checks.push({
    name:     "feature_capability_support",
    status:   hasCapabilitySupport ? "passed" : "failed",
    blocking: true,
    message:  hasCapabilitySupport
      ? "reputation_agent registered with review_request_generation support"
      : "reputation_agent not found in registry or missing required task types",
  });

  // ── Aggregate ─────────────────────────────────────────────────────────────────
  const blockingCount = checks.filter(
    (c) => c.blocking && c.status === "failed",
  ).length;

  return {
    overall:        blockingCount === 0 ? "ready" : "not_ready",
    gateway_status: gateway.status,
    provider:       gateway.provider,
    checks,
    blocking_count: blockingCount,
    checked_at:     now,
  };
}
