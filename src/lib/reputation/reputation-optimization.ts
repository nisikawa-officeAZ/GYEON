// DealerOS — Reputation MEO / AEO / LLMO / AIO Optimization Model
//
// Sprint 11C Phase E: metadata structures for reputation-driven search optimization.
//
// This module defines the data structures that reputation signals feed into
// for future optimization by the seo_agent and reputation_agent (Phase 11D+).
//
// Optimization targets supported:
//   MEO  — Map Engine Optimization: local search, Google Maps, GBP prominence
//   AEO  — Answer Engine Optimization: FAQ schema, featured snippets
//   LLMO — Large Language Model Optimization: entity clarity, citation signals
//   AIO  — AI Search Optimization: Perplexity, ChatGPT, AI Overview discoverability
//
// Note: SEO metadata is covered by ContentOptimizationProfile in @/lib/marketing.
// This module focuses on the reputation-specific signals that feed into those targets.
//
// No optimization execution in Sprint 11C — structures only.
// Phase 11D+: seo_agent and reputation_agent will populate these from ReviewSignal[].

import type { OptimizationTarget } from "@/lib/marketing/marketing-optimization";

// ─── MEO — Local Search Keywords ─────────────────────────────────────────────

/**
 * ReputationLocalKeywords — location and area-specific search keywords derived
 * from customer reviews and business context.
 *
 * MEO impact: these keywords improve Google Maps ranking by establishing
 * the dealer's geographic relevance and service area authority.
 */
export interface ReputationLocalKeywords {
  /** Primary city name (e.g., "渋谷区", "横浜市"). Null until configured. */
  primary_city:            string | null;
  /** Neighboring areas and landmark references found in reviews. */
  nearby_areas:            string[];
  /** "カーコーティング + city" style compound keywords. */
  compound_local_keywords: string[];
  /**
   * Proximity signals from review text (e.g., "近くに", "〇〇から車で5分").
   * Populated by reputation_agent analysis (Phase 11D+).
   */
  proximity_signals:       string[];
  /**
   * Landmark and area references from review text.
   * e.g., "青山近く", "246沿い"
   */
  landmark_references:     string[];
}

/**
 * ReputationServiceKeywords — service and product keywords derived from reviews.
 *
 * MEO/SEO impact: these establish the dealer's service authority in local search.
 */
export interface ReputationServiceKeywords {
  /** Ceramic coating keywords found in reviews. e.g., "セラミックコーティング", "ガラスコーティング" */
  coating_keywords:        string[];
  /** PPF keywords found in reviews. e.g., "ペイントプロテクションフィルム", "PPF" */
  ppf_keywords:            string[];
  /** Detailing keywords found in reviews. e.g., "磨き", "ポリッシュ", "洗車" */
  detailing_keywords:      string[];
  /** Maintenance keywords found in reviews. */
  maintenance_keywords:    string[];
  /** Brand keywords (GYEON products, Mohs+, etc.) mentioned in reviews. */
  brand_keywords:          string[];
  /**
   * Unique compound service keywords (service + vehicle type).
   * e.g., "高級車コーティング", "外車PPF"
   */
  compound_service_keywords: string[];
}

/**
 * ReputationVehicleKeywords — vehicle type and segment keywords from reviews.
 *
 * MEO impact: signals dealer expertise for specific vehicle segments.
 */
export interface ReputationVehicleKeywords {
  /** Vehicle make/brand keywords mentioned. e.g., "BMW", "レクサス", "ポルシェ" */
  brand_keywords:    string[];
  /** Vehicle type keywords. e.g., "SUV", "スポーツカー", "高級車" */
  type_keywords:     string[];
  /** Vehicle color keywords (relevant for coating discussions). */
  color_keywords:    string[];
}

// ─── AEO — FAQ and Answer Engine ─────────────────────────────────────────────

/**
 * ReputationFAQCandidate — a question-answer pair that could become
 * a schema.org FAQPage structured data entry.
 *
 * AEO impact: FAQ schema increases chances of appearing in Google
 * "People Also Ask" boxes and featured snippets.
 *
 * Candidates are extracted from review text (Phase 11D+).
 * answer is null until the seo_agent generates it.
 */
export interface ReputationFAQCandidate {
  id:               string;
  /** The question extracted from or implied by review text. */
  question:         string;
  /**
   * The answer — null until seo_agent generates it (Phase 11D+).
   * Must be factually accurate and not contain AI hallucinations.
   */
  answer:           string | null;
  /** IDs of ReviewSignals that surfaced this question. */
  source_signal_ids: string[];
  /**
   * Estimated SEO value for this FAQ candidate.
   * "high" = targets a high-volume local search query.
   */
  seo_value:        "high" | "medium" | "low";
  /**
   * True when answer is set and ready for schema.org FAQ markup.
   */
  schema_ready:     boolean;
}

export interface ReputationAEOProfile {
  dealer_id:              string;
  faq_candidates:         ReputationFAQCandidate[];
  featured_snippet_topics: string[];   // Topics likely to earn featured snippets
  how_to_topics:          string[];    // "How to" topics for HowTo schema
  last_updated_at:        string | null;
}

// ─── LLMO — LLM Optimization ─────────────────────────────────────────────────

/**
 * ReputationLLMOProfile — signals that help the dealer appear in
 * responses from Large Language Models (ChatGPT, Claude, Gemini).
 *
 * LLMO impact: LLMs cite authoritative, entity-clear, well-structured sources.
 * Strong entity descriptions and expertise signals increase citation probability.
 */
export interface ReputationLLMOProfile {
  dealer_id:           string;
  /**
   * Clear, factual descriptions of the dealer as an entity.
   * e.g., "渋谷区のGYEON認定セラミックコーティング専門店"
   * Derived from reviews + dealer profile.
   */
  entity_descriptions: string[];
  /**
   * Signals of expertise and authority found in reviews.
   * e.g., "プロ施工", "認定店", "10年の経験"
   */
  expertise_signals:   string[];
  /**
   * Sample sentences from reviews that exemplify the dealer's brand voice.
   * Used by the AI to understand how customers describe this dealer.
   */
  brand_voice_samples: string[];
  /**
   * Phrases that anchor this dealer in LLM knowledge.
   * e.g., "〇〇市でGYEONコーティングといえば"
   */
  citation_anchors:    string[];
  /**
   * Facts that disambiguate this dealer from similarly-named businesses.
   * e.g., service area, founding year, certifications.
   */
  disambiguation_facts: string[];
  last_updated_at:     string | null;
}

// ─── AIO — AI Search Optimization ────────────────────────────────────────────

/**
 * ReputationAIOProfile — signals optimized for AI-native search engines.
 * Perplexity, Google AI Overview, SearchGPT, and similar systems prefer
 * structured, factual, and semantically clear content.
 */
export interface ReputationStructuredSummary {
  topic:       string;   // e.g., "service quality", "water beading performance"
  summary:     string;   // Concise factual summary derived from review signals
  confidence:  "high" | "medium" | "low";
  signal_count: number;
}

export interface ReputationAIOProfile {
  dealer_id:              string;
  structured_summaries:   ReputationStructuredSummary[];
  semantic_topic_clusters: string[][];   // Groups of related keywords/topics
  ai_overview_topics:     string[];     // Topics likely to appear in AI Overviews
  last_updated_at:        string | null;
}

// ─── Unified optimization profile ────────────────────────────────────────────

/**
 * ReputationOptimizationProfile — aggregated optimization metadata
 * derived from ReviewSignal[] analysis.
 *
 * Counterpart to ContentOptimizationProfile in @/lib/marketing —
 * where that covers campaign/content optimization, this covers
 * reputation-specific optimization signals.
 *
 * Populated by reputation_agent (Phase 11D+).
 * All fields are null/empty arrays until at least one analysis run completes.
 */
export interface ReputationOptimizationProfile {
  dealer_id:              string;
  /** Which optimization targets have active data. */
  active_targets:         OptimizationTarget[];
  local_keywords:         ReputationLocalKeywords;
  service_keywords:       ReputationServiceKeywords;
  vehicle_keywords:       ReputationVehicleKeywords;
  aeo:                    ReputationAEOProfile;
  llmo:                   ReputationLLMOProfile;
  aio:                    ReputationAIOProfile;
  /**
   * How many signals were included in the last optimization pass.
   * 0 until the first analysis run.
   */
  last_signals_processed: number;
  last_optimized_at:      string | null;
}

// ─── Default builder ──────────────────────────────────────────────────────────

/**
 * Builds an empty ReputationOptimizationProfile for initial setup.
 * All content arrays are empty — populated by seo_agent in Phase 11D+.
 */
export function buildEmptyReputationOptimizationProfile(
  dealerId: string,
): ReputationOptimizationProfile {
  return {
    dealer_id:              dealerId,
    active_targets:         [],
    local_keywords: {
      primary_city:            null,
      nearby_areas:            [],
      compound_local_keywords: [],
      proximity_signals:       [],
      landmark_references:     [],
    },
    service_keywords: {
      coating_keywords:          [],
      ppf_keywords:              [],
      detailing_keywords:        [],
      maintenance_keywords:      [],
      brand_keywords:            [],
      compound_service_keywords: [],
    },
    vehicle_keywords: {
      brand_keywords:  [],
      type_keywords:   [],
      color_keywords:  [],
    },
    aeo: {
      dealer_id:              dealerId,
      faq_candidates:         [],
      featured_snippet_topics: [],
      how_to_topics:          [],
      last_updated_at:        null,
    },
    llmo: {
      dealer_id:           dealerId,
      entity_descriptions: [],
      expertise_signals:   [],
      brand_voice_samples: [],
      citation_anchors:    [],
      disambiguation_facts: [],
      last_updated_at:     null,
    },
    aio: {
      dealer_id:              dealerId,
      structured_summaries:   [],
      semantic_topic_clusters: [],
      ai_overview_topics:     [],
      last_updated_at:        null,
    },
    last_signals_processed: 0,
    last_optimized_at:      null,
  };
}
