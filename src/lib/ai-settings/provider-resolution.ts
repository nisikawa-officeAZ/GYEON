// DealerOS — AI Settings Platform: Provider Resolution (Sprint 11R Phase D)
//
// 4-level provider resolution chain:
//   1. Dealer preference     — capability_assignments[capability].preferred_provider
//   2. Capability preference — capability_assignments[capability] (fallback_provider)
//   3. Fallback provider     — provider_selection.fallback_providers[0]
//   4. System default        — first configured provider in provider_configurations
//
// Returns null if no provider can be resolved at any level.
// No provider execution. No SDK imports. No external API calls.
// Pure — no "use server", no async, no DB calls.

import type { AICapability }      from "@/lib/ai/capabilities";
import type { AIProviderId }      from "@/lib/ai/types";
import type { AISettingsProfile } from "./settings-profile-types";

// ─── Resolution source ────────────────────────────────────────────────────────

export type AIProviderResolutionSource =
  | "dealer_preference"     // primary_provider or capability assignment preferred_provider
  | "capability_preference" // capability assignment fallback_provider
  | "fallback_provider"     // provider_selection.fallback_providers list
  | "system_default";       // first configured provider in provider_configurations

// ─── Resolution result ────────────────────────────────────────────────────────

export interface AIResolvedProvider {
  provider_id:        AIProviderId;
  resolution_source:  AIProviderResolutionSource;
  /** Dealer-configured model override for this provider. null = use provider default. */
  model_override:     string | null;
  /** Whether this provider has a stored (encrypted) key in dealer_settings. */
  is_configured:      boolean;
  resolution_reason:  string;
}

// ─── Resolution chain (diagnostic) ───────────────────────────────────────────

export interface AIProviderResolutionStep {
  source:      AIProviderResolutionSource;
  candidate:   AIProviderId | null;
  considered:  boolean;
  reason:      string;
}

export interface AIProviderResolutionChain {
  capability:   AICapability;
  steps:        AIProviderResolutionStep[];
  resolved:     AIResolvedProvider | null;
  resolved_at:  string;
}

// ─── Context ──────────────────────────────────────────────────────────────────

export interface AIProviderResolutionContext {
  /** Always from getCurrentDealer() via server action. */
  dealer_id:   string;
  capability:  AICapability;
  profile:     AISettingsProfile;
}

// ─── Core resolution ─────────────────────────────────────────────────────────

/**
 * resolveProvider — returns the best available provider for a capability.
 *
 * Walks the 4-level resolution chain and returns the first match.
 * Returns null only if no configured provider exists at any level.
 */
export function resolveProvider(
  context: AIProviderResolutionContext,
): AIResolvedProvider | null {
  const { capability, profile } = context;
  const assignment = profile.capability_assignments[capability];

  // Level 1 — dealer preferred provider for this capability
  if (assignment && assignment.status !== "disabled" && assignment.preferred_provider) {
    const pid = assignment.preferred_provider;
    const config = profile.provider_configurations[pid];
    return {
      provider_id:       pid,
      resolution_source: "dealer_preference",
      model_override:    config?.model_overrides?.[capability] ?? null,
      is_configured:     config?.is_enabled ?? false,
      resolution_reason: `Capability assignment preferred_provider for '${capability}'`,
    };
  }

  // Level 2 — capability assignment fallback provider
  if (assignment && assignment.status !== "disabled" && assignment.fallback_provider) {
    const pid = assignment.fallback_provider;
    const config = profile.provider_configurations[pid];
    return {
      provider_id:       pid,
      resolution_source: "capability_preference",
      model_override:    config?.model_overrides?.[capability] ?? null,
      is_configured:     config?.is_enabled ?? false,
      resolution_reason: `Capability assignment fallback_provider for '${capability}'`,
    };
  }

  // Level 3 — primary provider from provider_selection (via getProviderForCapability)
  const primary = profile.provider_selection.primary_provider;
  if (primary) {
    const config = profile.provider_configurations[primary];
    return {
      provider_id:       primary,
      resolution_source: "dealer_preference",
      model_override:    config?.model_overrides?.[capability] ?? null,
      is_configured:     config?.is_enabled ?? false,
      resolution_reason: `Primary provider from provider_selection config`,
    };
  }

  // Level 3b — fallback providers from provider_selection
  for (const pid of profile.provider_selection.fallback_providers) {
    const config = profile.provider_configurations[pid];
    if (config?.is_enabled) {
      return {
        provider_id:       pid,
        resolution_source: "fallback_provider",
        model_override:    config.model_overrides?.[capability] ?? null,
        is_configured:     true,
        resolution_reason: `Fallback provider from provider_selection.fallback_providers`,
      };
    }
  }

  // Level 4 — system default: first configured provider in configurations map
  for (const [pid, config] of Object.entries(profile.provider_configurations)) {
    if (config?.is_enabled && config.is_selected) {
      return {
        provider_id:       pid as AIProviderId,
        resolution_source: "system_default",
        model_override:    config.model_overrides?.[capability] ?? null,
        is_configured:     true,
        resolution_reason: `First configured provider in provider_configurations`,
      };
    }
  }

  return null;
}

/**
 * resolveProviderWithChain — resolves a provider and returns the full diagnostic chain.
 *
 * Use this when the caller needs to explain the resolution decision (e.g. settings UI).
 * For execution paths, use resolveProvider() for minimal overhead.
 */
export function resolveProviderWithChain(
  context: AIProviderResolutionContext,
): AIProviderResolutionChain {
  const { capability, profile } = context;
  const now = new Date().toISOString();
  const steps: AIProviderResolutionStep[] = [];
  const assignment = profile.capability_assignments[capability];

  // Step 1 — capability assignment preferred_provider
  const capPref = assignment?.status !== "disabled" ? assignment?.preferred_provider ?? null : null;
  steps.push({
    source:     "dealer_preference",
    candidate:  capPref,
    considered: capPref !== null,
    reason:     capPref !== null
      ? `capability_assignments['${capability}'].preferred_provider = '${capPref}'`
      : assignment?.status === "disabled"
        ? `capability '${capability}' is disabled`
        : `no preferred_provider in capability assignment`,
  });

  // Step 2 — capability assignment fallback_provider
  const capFallback = assignment?.status !== "disabled" ? assignment?.fallback_provider ?? null : null;
  steps.push({
    source:     "capability_preference",
    candidate:  capFallback,
    considered: capPref === null && capFallback !== null,
    reason:     capFallback !== null
      ? `capability_assignments['${capability}'].fallback_provider = '${capFallback}'`
      : `no fallback_provider in capability assignment`,
  });

  // Step 3 — primary provider
  const primary = profile.provider_selection.primary_provider;
  steps.push({
    source:     "dealer_preference",
    candidate:  primary,
    considered: capPref === null && capFallback === null && primary !== null,
    reason:     primary !== null
      ? `provider_selection.primary_provider = '${primary}'`
      : `no primary_provider configured`,
  });

  // Step 3b — fallback providers
  const firstEnabledFallback = profile.provider_selection.fallback_providers.find(
    (pid) => profile.provider_configurations[pid]?.is_enabled,
  ) ?? null;
  steps.push({
    source:     "fallback_provider",
    candidate:  firstEnabledFallback,
    considered: capPref === null && capFallback === null && primary === null && firstEnabledFallback !== null,
    reason:     firstEnabledFallback !== null
      ? `provider_selection.fallback_providers[0] = '${firstEnabledFallback}'`
      : `no enabled fallback providers`,
  });

  // Step 4 — system default
  const systemDefault = (Object.entries(profile.provider_configurations).find(
    ([, config]) => config?.is_enabled && config.is_selected,
  )?.[0] ?? null) as AIProviderId | null;
  steps.push({
    source:     "system_default",
    candidate:  systemDefault,
    considered: capPref === null && capFallback === null && primary === null
      && firstEnabledFallback === null && systemDefault !== null,
    reason:     systemDefault !== null
      ? `first configured provider in provider_configurations = '${systemDefault}'`
      : `no configured providers found`,
  });

  return {
    capability,
    steps,
    resolved: resolveProvider(context),
    resolved_at: now,
  };
}

/**
 * resolveAllCapabilities — returns a provider for each AICapability in the list.
 *
 * Used by the orchestrator to pre-resolve all required capabilities before
 * passing the resolved context to checkProviderExecutionReadiness().
 */
export function resolveAllCapabilities(
  dealer_id:    string,
  capabilities: AICapability[],
  profile:      AISettingsProfile,
): Map<AICapability, AIResolvedProvider | null> {
  const result = new Map<AICapability, AIResolvedProvider | null>();
  for (const cap of capabilities) {
    result.set(cap, resolveProvider({ dealer_id, capability: cap, profile }));
  }
  return result;
}
