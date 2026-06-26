// DealerOS — AI Content Automation Platform: Optimization Model (Sprint 11I Phase D)
//
// Metadata models for the five search optimization paradigms applied in the pipeline.
//
// SEO  — Search Engine Optimization: keywords, structured data, canonical URLs
// MEO  — Map Engine Optimization: local signals, NAP consistency, GBP presence
// AEO  — Answer Engine Optimization: FAQ schema, featured snippets, concise answers
// LLMO — Large Language Model Optimization: entity clarity, citation structure, prose density
// AIO  — AI-native search: Perplexity/SearchGPT discoverability, structured Q&A
//
// Relationship to AI Marketing Platform:
//   @/lib/marketing exports OptimizationTarget, SeoMetadata, MeoMetadata, AeoMetadata,
//   LlmoMetadata, AioMetadata, and ContentOptimizationProfile — all defined in
//   marketing-optimization.ts (Sprint 11A).
//
//   This module EXTENDS those types for Content Automation-specific needs:
//   - ContentOptimizationBundle: associates an optimization profile with a ContentProject
//   - ContentOptimizationStatus: tracks per-stage completion within the pipeline
//   - buildEmptyOptimizationBundle: factory for deferred optimization
//
// No re-definition of types already in @/lib/marketing.
// No runtime optimization — all computation is deferred to Phase 11J+.
//
// Pure — no "use server", no external calls.

import type {
  OptimizationTarget,
  ContentOptimizationProfile,
  SeoMetadata,
  MeoMetadata,
  AeoMetadata,
  LlmoMetadata,
  AioMetadata,
} from "@/lib/marketing";
import {
  buildEmptyOptimizationProfile,
} from "@/lib/marketing";

// ─── Optimization status ───────────────────────────────────────────────────────

/**
 * ContentOptimizationStageStatus — completion status for a single optimization stage.
 */
export type ContentOptimizationStageStatus =
  | "pending"    // Not yet computed
  | "applied"    // Optimization metadata has been applied to the content
  | "skipped"    // Stage skipped (e.g., no GBP channel — meo skipped)
  | "deferred";  // Requires AI or API — deferred to Phase 11J+

/**
 * ContentOptimizationStatus — tracks which optimization stages have been applied.
 */
export interface ContentOptimizationStatus {
  seo:   ContentOptimizationStageStatus;
  meo:   ContentOptimizationStageStatus;
  aeo:   ContentOptimizationStageStatus;
  llmo:  ContentOptimizationStageStatus;
  aio:   ContentOptimizationStageStatus;
  /** Overall: "complete" when all applicable stages are "applied" or "skipped". */
  overall: "pending" | "partial" | "complete";
}

// ─── ContentOptimizationBundle ─────────────────────────────────────────────────

/**
 * ContentOptimizationBundle — associates a full optimization profile with a ContentProject.
 *
 * Extends ContentOptimizationProfile (from @/lib/marketing) with:
 *   - content_project_id: ties the profile to a specific project
 *   - optimization_status: tracks completion per stage
 *   - applicable_targets: which paradigms apply for this project's destinations
 *   - ai_enhanced: true when AI has enriched the metadata (Phase 11J+)
 *
 * SEO/MEO metadata is computed deterministically from dealer settings.
 * AEO/LLMO/AIO metadata requires AI enrichment (Phase 11J+).
 */
export interface ContentOptimizationBundle {
  content_project_id:   string;
  /** Always from getCurrentDealer(). */
  dealer_id:            string;
  profile:              ContentOptimizationProfile;
  status:               ContentOptimizationStatus;
  /** Which optimization targets are applicable for this project's destinations. */
  applicable_targets:   OptimizationTarget[];
  /** True when AI has enriched any metadata field (Phase 11J+). */
  ai_enhanced:          boolean;
  /** ISO 8601 timestamp of last profile update. */
  updated_at:           string;
  /** Always true — full optimization requires Phase 11J+ AI pipeline. */
  execution_deferred:   true;
}

// ─── Content-specific optimization hints ──────────────────────────────────────

/**
 * ContentSeoHints — SEO metadata suggestions specific to before/after auto detailing content.
 *
 * These hints are used to populate ContentOptimizationProfile.seo when a dealer
 * hasn't fully configured their SEO settings. They are defaults derived from
 * the service summary and dealer name — not AI-generated.
 */
export interface ContentSeoHints {
  /** Primary keyword phrase for this service (e.g., "GYEON ceramic coating Tokyo"). */
  primary_keyword:       string;
  /** Supporting keyword phrases (2–4 recommended). */
  secondary_keywords:    string[];
  /** Suggested page title for website news posts. */
  suggested_title:       string;
  /** Suggested meta description for website news posts. */
  suggested_description: string;
  /** Whether to include LocalBusiness or Service JSON-LD structured data. */
  structured_data_hint:  "LocalBusiness" | "Service" | "none";
}

/**
 * ContentMeoHints — MEO signals specific to detailing service posts on GBP.
 */
export interface ContentMeoHints {
  /** Primary local keyword (e.g., "ceramic coating [city name]"). */
  local_keyword:         string;
  /** Category tag relevant to this post (e.g., "Ceramic Coating", "PPF", "Maintenance"). */
  service_category:      string;
  /** True when this content type is eligible for a GBP update post. */
  gbp_eligible:          boolean;
  /** Suggested CTA for the GBP post (e.g., "Book Now", "Learn More"). */
  gbp_cta:               "BOOK" | "ORDER" | "SHOP" | "LEARN_MORE" | "SIGN_UP" | "CALL" | null;
}

// ─── Optimization bundle factory ───────────────────────────────────────────────

/**
 * buildEmptyOptimizationBundle — creates an optimization bundle with default metadata.
 *
 * All status fields are "pending" or "deferred" (for AI-required stages).
 * dealer_id must come from getCurrentDealer().
 */
export function buildEmptyOptimizationBundle(
  content_project_id: string,
  dealer_id:          string,
  applicable_targets: OptimizationTarget[],
  now:                string,
): ContentOptimizationBundle {
  const profile: ContentOptimizationProfile = buildEmptyOptimizationProfile(dealer_id);

  const isApplicable = (t: OptimizationTarget) => applicable_targets.includes(t);

  const status: ContentOptimizationStatus = {
    seo:  isApplicable("seo")  ? "pending"  : "skipped",
    meo:  isApplicable("meo")  ? "pending"  : "skipped",
    aeo:  isApplicable("aeo")  ? "deferred" : "skipped",  // AEO requires AI
    llmo: isApplicable("llmo") ? "deferred" : "skipped",  // LLMO requires AI
    aio:  isApplicable("aio")  ? "deferred" : "skipped",  // AIO requires AI
    overall: "pending",
  };

  return {
    content_project_id,
    dealer_id,
    profile,
    status,
    applicable_targets,
    ai_enhanced:        false,
    updated_at:         now,
    execution_deferred: true,
  };
}

// ─── Optimization target helpers ───────────────────────────────────────────────

/**
 * getApplicableTargets — returns which optimization targets apply given a set of
 * publishing destinations and their optimization support.
 *
 * Called by the pipeline when building an optimization bundle for a ContentProject.
 */
export function getApplicableTargets(
  destinationApplicabilities: OptimizationTarget[][],
): OptimizationTarget[] {
  const all: OptimizationTarget[] = ["seo", "meo", "aeo", "llmo", "aio"];
  return all.filter((target) =>
    destinationApplicabilities.some((targets) => targets.includes(target)),
  );
}

/**
 * isOptimizationComplete — returns true when all applicable stages have been applied.
 */
export function isOptimizationComplete(status: ContentOptimizationStatus): boolean {
  return status.overall === "complete";
}

// ─── Re-export marketing optimization types for consumers ─────────────────────
// Consumers of content-automation that also need optimization types can import
// them here rather than coupling directly to @/lib/marketing.
export type {
  OptimizationTarget,
  ContentOptimizationProfile,
  SeoMetadata,
  MeoMetadata,
  AeoMetadata,
  LlmoMetadata,
  AioMetadata,
};
export { buildEmptyOptimizationProfile };
