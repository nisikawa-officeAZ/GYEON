// DealerOS — Reputation Signal Model
//
// Sprint 11C Phase D: canonical model for all reputation signals.
//
// A ReviewSignal is any piece of data that can inform reputation analysis.
// Signals are collected from multiple sources and analyzed in Phase 11D+
// to produce ReputationInsight objects and ReputationDashboard metrics.
//
// Signal analysis dimensions (for future AI analysis, Phase 11D+):
//   - Sentiment: positive / neutral / negative
//   - Keywords: extracted terms for MEO/AEO/LLMO/AIO optimization
//   - Service quality: mentions of work craftsmanship and detail
//   - Response time: mentions of speed, scheduling, turnaround
//   - Pricing perception: mentions of value, cost, pricing
//   - Customer satisfaction: aggregate satisfaction indicators
//   - Repeat visit likelihood: signals indicating return intent
//   - Local SEO impact: location/service keywords for GBP optimization
//   - AEO relevance: question-and-answer structures in review text
//   - LLMO relevance: entity and expertise signals for LLM discoverability
//   - AIO relevance: AI search-friendly structured content signals
//
// No analysis execution in Sprint 11C — types only.

import type { ReviewPlatform, ReviewSentimentType } from "@/lib/ai/agents/reputation/types";
import type { ReviewSignalSource, ReviewSignalType }  from "./reputation-types";

// ─── ReviewSignal ─────────────────────────────────────────────────────────────

/**
 * ReviewSignal — a single unit of reputation data.
 *
 * Signals are immutable records once created.
 * Analysis fields (sentiment, keywords, etc.) are populated
 * by the reputation_agent in Phase 11D+ — null until then.
 *
 * dealer_id must always come from getCurrentDealer() when creating signals.
 */
export interface ReviewSignal {
  id:                    string;
  /** Always from getCurrentDealer() — never from client input. */
  dealer_id:             string;
  source:                ReviewSignalSource;
  signal_type:           ReviewSignalType;
  /**
   * Platform where this signal originated.
   * Null for signals from non-platform sources (completion_report, manual_input).
   */
  platform:              ReviewPlatform | null;
  /**
   * Work order or completion report that triggered this signal.
   * Null for signals not tied to a specific job.
   */
  job_id:                string | null;
  /**
   * Customer who generated this signal.
   * Null for anonymous signals (e.g., aggregate survey data).
   */
  customer_id:           string | null;
  /**
   * Numeric rating (1–5 for star ratings, 0–10 for NPS).
   * Null for text-only signals with no numeric component.
   */
  rating:                number | null;
  /**
   * The raw text content of the signal (review text, survey answer, testimonial).
   * Null for pure numeric ratings with no text.
   */
  text_content:          string | null;
  /**
   * Sentiment classification — populated by AI analysis (Phase 11D+).
   * Null until analyzed.
   */
  sentiment:             ReviewSentimentType | null;
  /**
   * Extracted keywords from text_content — populated by AI analysis (Phase 11D+).
   * Empty array until analyzed.
   */
  keywords:              string[];
  /**
   * Location/area signals found in the text (e.g., "渋谷", "Shibuya").
   * Populated by AI analysis (Phase 11D+).
   */
  location_signals:      string[];
  /**
   * Service keywords found in the text (e.g., "コーティング", "PPF").
   * Populated by AI analysis (Phase 11D+).
   */
  service_keywords:      string[];
  /**
   * Whether this signal is eligible for local SEO / MEO use.
   * True for signals from Google, GBP, or those containing local keywords.
   * Null until analyzed.
   */
  local_seo_eligible:    boolean | null;
  /**
   * Whether this signal contains a question-answer structure
   * suitable for AEO (Answer Engine Optimization) FAQ schema.
   * Null until analyzed.
   */
  aeo_faq_candidate:     boolean | null;
  /**
   * ISO 8601 timestamp when this signal was collected/created.
   * For Google reviews: the review's posted_at date.
   * For manual input: the timestamp of dealer entry.
   */
  occurred_at:           string;
  /**
   * ISO 8601 timestamp when AI analysis was completed.
   * Null until Phase 11D+ analysis runs.
   */
  analyzed_at:           string | null;
}

// ─── ReviewSignalCollection ───────────────────────────────────────────────────

/**
 * ReviewSignalCollection — an aggregated set of signals for a dealer.
 * Used as the input to ReputableInsight generation (Phase 11D+).
 */
export interface ReviewSignalCollection {
  dealer_id:         string;
  signals:           ReviewSignal[];
  total_count:       number;
  period_start:      string;   // ISO 8601 date "YYYY-MM-DD"
  period_end:        string;   // ISO 8601 date "YYYY-MM-DD"
  collected_at:      string;
}

// ─── Signal analysis metadata ─────────────────────────────────────────────────

/**
 * SignalAnalysisDimensions — the dimensions that can be scored from a signal.
 * Each dimension maps to one or more ReputationInsightType values.
 * No scoring is performed in Sprint 11C — this documents the future schema.
 */
export interface SignalAnalysisDimensions {
  /** 0–100 sentiment score (0 = very negative, 100 = very positive). */
  sentiment_score:           number | null;
  /** 0–100 service quality score derived from text analysis. */
  service_quality_score:     number | null;
  /** 0–100 response time satisfaction score. */
  response_time_score:       number | null;
  /** 0–100 pricing perception score (0 = expensive, 100 = great value). */
  pricing_perception_score:  number | null;
  /** 0–10 Net Promoter Score (NPS) for this individual signal. */
  nps_score:                 number | null;
  /** 0–1 probability that this customer will return. */
  repeat_likelihood:         number | null;
}

// ─── Signal helpers ───────────────────────────────────────────────────────────

/**
 * Returns all signals in a collection that have text content.
 * Text signals are the primary input for keyword and sentiment analysis.
 */
export function getTextSignals(collection: ReviewSignalCollection): ReviewSignal[] {
  return collection.signals.filter((s) => s.text_content !== null);
}

/**
 * Returns signals from a specific platform.
 */
export function getSignalsByPlatform(
  collection: ReviewSignalCollection,
  platform:   ReviewPlatform,
): ReviewSignal[] {
  return collection.signals.filter((s) => s.platform === platform);
}

/**
 * Returns signals from a specific source.
 */
export function getSignalsBySource(
  collection: ReviewSignalCollection,
  source:     ReviewSignalSource,
): ReviewSignal[] {
  return collection.signals.filter((s) => s.source === source);
}

/**
 * Returns signals that have been analyzed (analyzed_at is not null).
 */
export function getAnalyzedSignals(
  collection: ReviewSignalCollection,
): ReviewSignal[] {
  return collection.signals.filter((s) => s.analyzed_at !== null);
}

/**
 * Returns signals that are pending AI analysis.
 */
export function getPendingAnalysisSignals(
  collection: ReviewSignalCollection,
): ReviewSignal[] {
  return collection.signals.filter((s) => s.analyzed_at === null);
}

/**
 * Computes the average rating from all signals that have a numeric rating.
 * Returns null if no rated signals exist.
 */
export function computeAverageRating(
  signals: ReviewSignal[],
): number | null {
  const rated = signals.filter((s) => s.rating !== null);
  if (rated.length === 0) return null;
  const sum = rated.reduce((acc, s) => acc + (s.rating ?? 0), 0);
  return Math.round((sum / rated.length) * 10) / 10;
}

/**
 * Returns the rating distribution as a record (1–5 → count).
 */
export function computeRatingDistribution(
  signals: ReviewSignal[],
): Partial<Record<1 | 2 | 3 | 4 | 5, number>> {
  const dist: Partial<Record<1 | 2 | 3 | 4 | 5, number>> = {};
  for (const s of signals) {
    if (s.rating !== null && s.rating >= 1 && s.rating <= 5) {
      const r = Math.round(s.rating) as 1 | 2 | 3 | 4 | 5;
      dist[r] = (dist[r] ?? 0) + 1;
    }
  }
  return dist;
}

/**
 * Extracts all unique keywords from a set of signals.
 * Returns a frequency-sorted array of keyword strings.
 */
export function aggregateKeywords(
  signals: ReviewSignal[],
): { keyword: string; count: number }[] {
  const freq: Record<string, number> = {};
  for (const s of signals) {
    for (const kw of s.keywords) {
      freq[kw] = (freq[kw] ?? 0) + 1;
    }
  }
  return Object.entries(freq)
    .map(([keyword, count]) => ({ keyword, count }))
    .sort((a, b) => b.count - a.count);
}

/**
 * Returns all local SEO-eligible signals.
 */
export function getLocalSeoSignals(
  signals: ReviewSignal[],
): ReviewSignal[] {
  return signals.filter((s) => s.local_seo_eligible === true);
}

/**
 * Returns all signals that are AEO FAQ candidates.
 */
export function getAEOCandidateSignals(
  signals: ReviewSignal[],
): ReviewSignal[] {
  return signals.filter((s) => s.aeo_faq_candidate === true);
}

/**
 * Constructs a minimal ReviewSignal.
 * dealer_id must come from getCurrentDealer() in the server action.
 */
export function buildReviewSignal(
  id:        string,
  dealerId:  string,
  source:    ReviewSignalSource,
  signalType: ReviewSignalType,
  occurredAt: string,
  overrides?: Partial<Omit<ReviewSignal, "id" | "dealer_id" | "source" | "signal_type" | "occurred_at">>,
): ReviewSignal {
  return {
    id,
    dealer_id:           dealerId,
    source,
    signal_type:         signalType,
    platform:            overrides?.platform            ?? null,
    job_id:              overrides?.job_id              ?? null,
    customer_id:         overrides?.customer_id         ?? null,
    rating:              overrides?.rating              ?? null,
    text_content:        overrides?.text_content        ?? null,
    sentiment:           overrides?.sentiment           ?? null,
    keywords:            overrides?.keywords            ?? [],
    location_signals:    overrides?.location_signals    ?? [],
    service_keywords:    overrides?.service_keywords    ?? [],
    local_seo_eligible:  overrides?.local_seo_eligible  ?? null,
    aeo_faq_candidate:   overrides?.aeo_faq_candidate   ?? null,
    occurred_at:         occurredAt,
    analyzed_at:         overrides?.analyzed_at         ?? null,
  };
}
