// DealerOS — AI Gateway: Dealer Settings Types
// All types in this file are SAFE for client use — no raw API keys.
//
// API keys flow: client input → server action → encrypt → store in dealer_settings.ai_settings
// Read back: server action returns AiSettingsView (has_key: boolean, never the raw key)
//
// DB requirement: dealer_settings.ai_settings jsonb column (Sprint 10C migration — see docs).

import type { AIProviderId, AITaskType, AITaskRouting } from "./types";

// ─── Gateway readiness (re-used by agents/types.ts) ───────────────────────────

export interface AIGatewayReadiness {
  status:   AIGatewayStatus;
  provider: AIProviderId | null;
  message:  string;
}

// ─── Provider status (client-safe) ────────────────────────────────────────────

export interface AiProviderStatus {
  /** Whether an encrypted key is stored for this provider. Never the raw key. */
  has_key: boolean;
  /** ISO timestamp of last successful format validation. null if never validated. */
  validated_at: string | null;
}

// ─── Settings view (client-safe) ─────────────────────────────────────────────

export interface AiSettingsView {
  enabled:           boolean;
  primary_provider:  AIProviderId | null;
  monthly_limit_usd: number;        // 0 = no limit configured
  hard_limit:        boolean;       // true = block when limit reached; false = warn only
  task_routing:      Partial<Record<AITaskType, AITaskRouting>>;
  /** Status per provider — keys present, but raw API keys are never included. */
  providers:         Partial<Record<AIProviderId, AiProviderStatus>>;
  /** true when dealer_settings.ai_settings column is not yet in the DB. */
  migration_required: boolean;
}

// ─── Save input ───────────────────────────────────────────────────────────────

export interface AiSettingsSaveInput {
  provider:           AIProviderId;
  api_key:            string;   // Write-only — encrypted before storage, never returned
  azure_endpoint?:    string;   // Required for azure_openai only
  monthly_limit_usd:  number;
  hard_limit:         boolean;
  enabled:            boolean;
}

// ─── Connection test result ───────────────────────────────────────────────────

export interface AiConnectionTestResult {
  success:   boolean;
  provider:  AIProviderId;
  message:   string;          // Japanese, user-readable
  tested_at: string;          // ISO 8601
  /** Honest label — this sprint validates format only, no network calls. */
  test_type: "format_validation";
}

// ─── Gateway readiness ────────────────────────────────────────────────────────

export type AIGatewayStatus =
  | "ready"               // Configured and enabled
  | "not_pro_plus"        // Pro+ feature gate not met
  | "not_configured"      // No provider configured
  | "disabled"            // Provider configured but AI disabled by dealer
  | "no_key"              // Provider selected but key not saved
  | "migration_required"; // dealer_settings.ai_settings column not yet created

// ─── Defaults ─────────────────────────────────────────────────────────────────

export const AI_SETTINGS_DEFAULT: AiSettingsView = {
  enabled:            false,
  primary_provider:   null,
  monthly_limit_usd:  0,
  hard_limit:         false,
  task_routing:       {},
  providers:          {},
  migration_required: false,
};
