// DealerOS — Marketing Content Optimization Model
//
// Sprint 11A Phase E: production-ready optimization models for five search paradigms.
//
// Optimization targets:
//   SEO  — Search Engine Optimization (Google organic search)
//   MEO  — Map Engine Optimization (Local SEO — Google Maps, Google Business Profile)
//   AEO  — Answer Engine Optimization (featured snippets, People Also Ask, knowledge panels)
//   LLMO — Large Language Model Optimization (ChatGPT, Claude, Gemini search responses)
//   AIO  — AI Optimization (AI-native search systems: Perplexity, SearchGPT, etc.)
//
// This module defines metadata structures only.
// No optimization execution. No keyword analysis. No ranking checks.
// All computation is deferred to the seo_agent (Phase 11B+).

// ─── Optimization targets ─────────────────────────────────────────────────────

/**
 * The five search optimization paradigms supported by GYEON Detailer Agent.
 *
 * Each target has a distinct optimization approach:
 *   SEO:  Keywords, backlinks, structured data, page speed
 *   MEO:  Local signals, NAP consistency, proximity, reviews
 *   AEO:  FAQ schema, concise direct answers, featured snippet formatting
 *   LLMO: Entity clarity, citation-worthy content, LLM-readable prose
 *   AIO:  AI assistant discoverability, structured Q&A, semantic clarity
 */
export type OptimizationTarget = "seo" | "meo" | "aeo" | "llmo" | "aio";

// ─── SEO metadata ─────────────────────────────────────────────────────────────

export type SeoStructuredDataType =
  | "LocalBusiness"    // Generic local business schema
  | "AutoRepair"       // Auto repair shop — closest type for detailers
  | "Service"          // Specific service offering
  | "Review"           // Customer review
  | "FAQPage"          // FAQ page schema
  | "HowTo"            // Step-by-step guide
  | "Product"          // Product listing (coating, PPF products)
  | "Organization"     // Business entity
  | "WebPage";         // Generic web page

/**
 * Core SEO metadata for a dealer's marketing content and web presence.
 *
 * Fields are used for:
 *   - HTML <title> and <meta description>
 *   - Open Graph (OG) tags for social sharing
 *   - JSON-LD structured data for Google rich results
 *   - Canonical URL to prevent duplicate content penalties
 */
export interface SeoMetadata {
  title:                  string | null;   // Page title — recommended ≤ 60 chars
  description:            string | null;   // Meta description — recommended ≤ 160 chars
  keywords:               string[];        // Target keyword phrases
  og_title:               string | null;   // Open Graph title for social shares
  og_description:         string | null;   // Open Graph description
  og_image_url:           string | null;   // Open Graph image (1200x630 recommended)
  canonical_url:          string | null;   // Canonical URL to consolidate link equity
  structured_data_type:   SeoStructuredDataType | null;
  structured_data_json:   Record<string, unknown> | null;  // Raw JSON-LD object
}

// ─── MEO metadata ─────────────────────────────────────────────────────────────

/**
 * Local SEO (Map Engine Optimization) metadata for Google Business Profile and
 * local search ranking.
 *
 * NAP = Name, Address, Phone — must be consistent across all online listings.
 * local_keywords should target city + service combinations (e.g., "ceramic coating Tokyo").
 */
export interface MeoMetadata {
  business_name:                  string | null;
  primary_category:               string | null;   // GBP business category
  service_area_radius_km:         number | null;   // Service radius from shop location
  google_business_profile_url:    string | null;   // GBP profile URL
  google_place_id:                string | null;   // Google Place ID for direct linking
  local_keywords:                 string[];        // Location-specific keyword phrases
  opening_hours_schema:           Record<string, string> | null;  // DayOfWeek → HH:MM-HH:MM
  citation_sites:                 string[];        // URLs of consistent NAP citations
}

// ─── AEO metadata ─────────────────────────────────────────────────────────────

export interface AeoFaqItem {
  question: string;
  answer:   string;   // Direct, concise answer — 1–3 sentences
}

export interface AeoHowToStep {
  position:  number;
  name:      string;
  text:      string;
  image_url: string | null;
}

/**
 * Answer Engine Optimization metadata for featured snippets and knowledge panels.
 *
 * Google features:
 *   - FAQ schema → FAQ rich result in SERPs
 *   - HowTo schema → HowTo rich result
 *   - featured_snippet_target → the exact question this page should answer
 */
export interface AeoMetadata {
  faq_items:                  AeoFaqItem[];
  how_to_steps:               AeoHowToStep[] | null;
  featured_snippet_target:    string | null;   // The question this content answers
  is_faq_schema_ready:        boolean;
  is_how_to_schema_ready:     boolean;
}

// ─── LLMO metadata ────────────────────────────────────────────────────────────

/**
 * Large Language Model Optimization metadata.
 *
 * LLMs like ChatGPT, Claude, and Gemini answer questions about local businesses.
 * This metadata helps LLMs generate accurate, helpful, citation-worthy responses
 * when users ask about this dealer.
 *
 * entity_description should be a concise, factually accurate paragraph about the
 * dealer that an LLM could quote or paraphrase in a response.
 */
export interface LlmoMetadata {
  /** Concise factual description — what an LLM should say about this dealer. */
  entity_description:     string | null;
  /** Service-level descriptions — service_key → 1–2 sentence description. */
  service_descriptions:   Record<string, string>;
  /** Factual expertise signals — certifications, years, specializations. */
  expertise_signals:      string[];
  /** URLs an LLM should cite when mentioning this dealer. */
  citation_anchors:       string[];
  /** The dealer's preferred voice and tone for AI-generated content. */
  brand_voice:            string | null;
  /** Key facts about the dealer for entity disambiguation. */
  disambiguation_facts:   string[];
}

// ─── AIO metadata ─────────────────────────────────────────────────────────────

/**
 * AI Optimization metadata for AI-native search engines.
 *
 * Targets systems like Perplexity AI, SearchGPT, Google AI Overview, and
 * other AI-powered answer engines that synthesize answers from web content.
 *
 * structured_answer_ready indicates the content is formatted for extraction by
 * AI summarization systems (clear headings, concise paragraphs, no ambiguity).
 */
export interface AioMetadata {
  /** True if this dealer's content is indexed by Perplexity or AI Overview. */
  ai_overview_presence:       boolean;
  /** True if content is structured for AI answer extraction. */
  structured_answer_ready:    boolean;
  /** Disambiguating phrase to help AI engines distinguish this dealer. */
  entity_disambiguation:      string | null;
  /** Keywords optimized for AI search query matching. */
  ai_search_keywords:         string[];
  /** Semantic topic clusters this content should be associated with. */
  semantic_topic_clusters:    string[];
}

// ─── Content Optimization Profile ────────────────────────────────────────────

/**
 * ContentOptimizationProfile — the complete optimization metadata for a dealer.
 *
 * Aggregates all five optimization target profiles into a single domain object.
 * The seo_agent populates and updates this profile (Phase 11B+).
 *
 * Security: dealer_id is always from getCurrentDealer().
 */
export interface ContentOptimizationProfile {
  dealer_id:          string;
  /** Which optimization targets are actively managed for this dealer. */
  active_targets:     OptimizationTarget[];
  seo:                SeoMetadata;
  meo:                MeoMetadata;
  aeo:                AeoMetadata;
  llmo:               LlmoMetadata;
  aio:                AioMetadata;
  /** ISO 8601 — when the seo_agent last ran an optimization pass. */
  last_optimized_at:  string | null;
  updated_at:         string;
}

// ─── Default profiles ─────────────────────────────────────────────────────────

export const DEFAULT_SEO_METADATA: SeoMetadata = {
  title:                null,
  description:          null,
  keywords:             [],
  og_title:             null,
  og_description:       null,
  og_image_url:         null,
  canonical_url:        null,
  structured_data_type: "AutoRepair",
  structured_data_json: null,
};

export const DEFAULT_MEO_METADATA: MeoMetadata = {
  business_name:               null,
  primary_category:            null,
  service_area_radius_km:      null,
  google_business_profile_url: null,
  google_place_id:             null,
  local_keywords:              [],
  opening_hours_schema:        null,
  citation_sites:              [],
};

export const DEFAULT_AEO_METADATA: AeoMetadata = {
  faq_items:                 [],
  how_to_steps:              null,
  featured_snippet_target:   null,
  is_faq_schema_ready:       false,
  is_how_to_schema_ready:    false,
};

export const DEFAULT_LLMO_METADATA: LlmoMetadata = {
  entity_description:    null,
  service_descriptions:  {},
  expertise_signals:     [],
  citation_anchors:      [],
  brand_voice:           null,
  disambiguation_facts:  [],
};

export const DEFAULT_AIO_METADATA: AioMetadata = {
  ai_overview_presence:      false,
  structured_answer_ready:   false,
  entity_disambiguation:     null,
  ai_search_keywords:        [],
  semantic_topic_clusters:   [],
};

/**
 * Builds an empty ContentOptimizationProfile for a dealer with default metadata.
 * The seo_agent populates real values during optimization passes.
 */
export function buildEmptyOptimizationProfile(
  dealerId: string,
): ContentOptimizationProfile {
  return {
    dealer_id:         dealerId,
    active_targets:    [],
    seo:               DEFAULT_SEO_METADATA,
    meo:               DEFAULT_MEO_METADATA,
    aeo:               DEFAULT_AEO_METADATA,
    llmo:              DEFAULT_LLMO_METADATA,
    aio:               DEFAULT_AIO_METADATA,
    last_optimized_at: null,
    updated_at:        new Date().toISOString(),
  };
}

/**
 * Returns the optimization target descriptions for documentation and UI.
 */
export const OPTIMIZATION_TARGET_LABELS: Record<OptimizationTarget, { label: string; description: string }> = {
  seo:  { label: "SEO",  description: "Search Engine Optimization — Google organic search ranking" },
  meo:  { label: "MEO",  description: "Map Engine Optimization — Google Maps and local search visibility" },
  aeo:  { label: "AEO",  description: "Answer Engine Optimization — featured snippets and knowledge panels" },
  llmo: { label: "LLMO", description: "Large Language Model Optimization — ChatGPT, Claude, and Gemini responses" },
  aio:  { label: "AIO",  description: "AI Optimization — Perplexity, Google AI Overview, and AI-native search" },
};
