// DealerOS — AI Capability Marketplace: Core Domain Types (Sprint 11S Phase A)
//
// Foundation types for the AI Capability Marketplace subsystem.
// Extends the gateway-layer AICapability / AIProviderId types to cover
// the full marketplace scope, including future providers not yet in the gateway.
//
// Architecture:
//   AICapability (16)   ⊂  AIMarketplaceCapability (19)
//   AIProviderId (5)    ⊂  AIMarketplaceProviderId  (11)
//
// Strict rules (non-negotiable):
//   - No SDK imports
//   - No external API calls
//   - No persistence
//   - No "use server"
//   - Pure TypeScript domain types only

import type { AICapability } from "@/lib/ai/capabilities";
import type { AIProviderId } from "@/lib/ai/types";

// ─── Capability categories ────────────────────────────────────────────────────

export type AICapabilityCategory =
  | "chat"
  | "ocr"
  | "translation"
  | "image_generation"
  | "video_generation"
  | "voice"
  | "seo"
  | "meo"
  | "aeo"
  | "llmo"
  | "aio"
  | "analytics"
  | "marketing"
  | "reporting";

// ─── Extended capabilities ────────────────────────────────────────────────────

// New capabilities beyond the 16 in src/lib/ai/capabilities.ts.
// Require providers that are not yet in the AI Gateway (e.g. ElevenLabs for voice).
export type AIMarketplaceCapabilityExtension =
  | "translation"      // Natural language translation between languages
  | "voice_synthesis"  // Text-to-speech voice generation
  | "voice_cloning";   // Custom voice cloning from audio samples

export type AIMarketplaceCapability = AICapability | AIMarketplaceCapabilityExtension;

// ─── Extended providers ───────────────────────────────────────────────────────

// Providers beyond the 5 in src/lib/ai/types.ts.
// Profiled in the marketplace but not yet integrated into the AI Gateway.
export type AIMarketplaceProviderExtension =
  | "google_veo"    // Google Veo — video generation (separate from Gemini)
  | "runway"        // Runway ML — video and image generation
  | "kling"         // Kling AI — video generation
  | "pika"          // Pika Labs — short-form video generation
  | "luma"          // Luma AI (Dream Machine) — video and image generation
  | "elevenlabs";   // ElevenLabs — voice synthesis and voice cloning

export type AIMarketplaceProviderId = AIProviderId | AIMarketplaceProviderExtension;

// ─── Provider marketplace status ──────────────────────────────────────────────

export type AIMarketplaceProviderStatus =
  | "gateway_active"    // In AIProviderId and adapter is live
  | "gateway_planned"   // In AIProviderId; adapter implementation planned
  | "marketplace_only"  // In marketplace profiles; not yet in AI Gateway
  | "deprecated";       // Removed from active use

// ─── Capability support level ─────────────────────────────────────────────────

export type AICapabilitySupportLevel =
  | "native"         // Provider has a first-class API endpoint for this capability
  | "via_prompting"  // Capability achieved through prompt engineering (no native API)
  | "planned"        // Support planned; adapter not yet implemented
  | "unavailable";   // Provider cannot support this capability

// ─── Recommendation mode ──────────────────────────────────────────────────────

export type AIRecommendationMode =
  | "best_quality"     // Prioritize output quality above cost and speed
  | "lowest_cost"      // Minimize cost per operation
  | "fastest"          // Minimize response latency
  | "balanced"         // Weighted balance: quality × 0.5, cost × 0.25, speed × 0.25
  | "dealer_selected"; // Dealer has explicitly overridden the system recommendation

// ─── Benchmark scores ─────────────────────────────────────────────────────────

export interface AIProviderBenchmark {
  provider_id:       AIMarketplaceProviderId;
  capability:        AIMarketplaceCapability;
  quality_score:     number;     // 0–100; higher = better output quality
  cost_score:        number;     // 0–100; higher = more cost-effective
  speed_score:       number;     // 0–100; higher = lower latency
  reliability_score: number;     // 0–100; higher = better uptime / consistency
  benchmark_version: string;     // e.g. "1.0.0"
  last_updated:      string;     // "YYYY-MM"
  notes:             string;
}

// ─── Capability entry in a provider profile ───────────────────────────────────

export interface AIProviderCapabilityEntry {
  capability:        AIMarketplaceCapability;
  support_level:     AICapabilitySupportLevel;
  recommended_model: string | null;
  benchmark:         AIProviderBenchmark | null;
}

// ─── Provider profile ─────────────────────────────────────────────────────────

export interface AIProviderProfile {
  provider_id:                 AIMarketplaceProviderId;
  display_name:                string;
  vendor:                      string;
  description:                 string;
  pricing_model:               "per_token" | "per_second" | "per_image" | "per_video" | "subscription" | "credits";
  estimated_monthly_cost_tier: "free" | "budget" | "standard" | "premium" | "enterprise";
  supported_capabilities:      AIMarketplaceCapability[];
  specialty_capabilities:      AIMarketplaceCapability[];  // capabilities where this provider excels
  marketplace_status:          AIMarketplaceProviderStatus;
  gateway_provider_id:         AIProviderId | null;    // null for marketplace-only providers
  adapter_sprint:              string | null;          // planned adapter sprint
  requires_api_key:            boolean;
  supports_key_rotation:       boolean;
  is_early_access:             boolean;
  profile_version:             string;
}

// ─── Recommendation ───────────────────────────────────────────────────────────

export interface AIProviderRecommendation {
  capability:           AIMarketplaceCapability;
  recommended_provider: AIMarketplaceProviderId;
  alternatives:         AIMarketplaceProviderId[];
  recommendation_mode:  AIRecommendationMode;
  confidence_score:     number;   // 0–100
  reasoning:            string;
  last_updated:         string;   // "YYYY-MM"
}

// ─── Marketplace descriptor ───────────────────────────────────────────────────

export interface AICapabilityMarketplace {
  version:                    string;
  sprint:                     string;
  capability_count:           number;   // total AIMarketplaceCapability values (19)
  provider_count:             number;   // total AIMarketplaceProviderId values (11)
  gateway_provider_count:     number;   // current AIProviderId count (5)
  extension_provider_count:   number;   // marketplace-only providers (6)
  category_count:             number;   // AICapabilityCategory values (14)
  marketplace_ui_available:   false;    // locked — marketplace UI not yet built
  settings_integration_ready: boolean;  // bridge types defined
  target_sprint:              string;
}
