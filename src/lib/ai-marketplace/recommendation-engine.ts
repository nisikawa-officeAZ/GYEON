// DealerOS — AI Capability Marketplace: Recommendation Engine (Sprint 11S Phase D)
//
// Static recommendation metadata per capability and recommendation mode.
// No runtime provider selection, no network calls, no adapter invocation.
//
// Recommendations are pre-computed metadata that inform the AI Settings UI.
// Dealers can override any recommendation via dealer_selected mode.
//
// Scoring model (all scores 0–100):
//   quality_score:     output quality relative to peers for this capability
//   cost_score:        cost-effectiveness (higher = cheaper per operation)
//   speed_score:       response latency (higher = faster)
//   balanced_score:    quality × 0.5 + cost × 0.25 + speed × 0.25
//
// Pure — no "use server", no async, no DB calls, no external calls.

import type {
  AIMarketplaceCapability,
  AIMarketplaceProviderId,
  AIProviderBenchmark,
  AIProviderRecommendation,
  AIRecommendationMode,
} from "./marketplace-types";

// ─── Per-provider, per-capability benchmarks ──────────────────────────────────

const BENCHMARK_LAST_UPDATED = "2026-06";
const BENCHMARK_VERSION      = "1.0.0";

function bench(
  provider_id:       AIMarketplaceProviderId,
  capability:        AIMarketplaceCapability,
  quality_score:     number,
  cost_score:        number,
  speed_score:       number,
  reliability_score: number,
  notes:             string,
): AIProviderBenchmark {
  return {
    provider_id,
    capability,
    quality_score,
    cost_score,
    speed_score,
    reliability_score,
    benchmark_version: BENCHMARK_VERSION,
    last_updated:      BENCHMARK_LAST_UPDATED,
    notes,
  };
}

// ─── Benchmark table ──────────────────────────────────────────────────────────
// Format: bench(provider, capability, quality, cost, speed, reliability, notes)

export const PROVIDER_BENCHMARKS: AIProviderBenchmark[] = [
  // ── chat_completion ─────────────────────────────────────────────────────────
  bench("openai",     "chat_completion", 92, 65, 90, 96, "gpt-4o: top-tier reasoning with fast API"),
  bench("anthropic",  "chat_completion", 95, 45, 78, 95, "claude-sonnet-4-6: best for complex reasoning and long context"),
  bench("gemini",     "chat_completion", 88, 80, 85, 93, "gemini-1.5-pro: strong and cost-competitive"),
  bench("azure_openai","chat_completion",90, 40, 85, 98, "enterprise SLA; higher cost per token"),
  bench("openrouter", "chat_completion", 85, 90, 82, 88, "routes to cheapest capable model; variable quality"),

  // ── text_generation ─────────────────────────────────────────────────────────
  bench("openai",     "text_generation", 91, 68, 91, 96, "gpt-4o-mini: fast and cheap for bulk generation"),
  bench("anthropic",  "text_generation", 94, 48, 76, 95, "haiku fast; sonnet best quality"),
  bench("gemini",     "text_generation", 87, 82, 87, 93, "gemini-flash: very cost-effective for volume"),
  bench("azure_openai","text_generation",90, 42, 85, 98, "enterprise deployment; higher baseline cost"),
  bench("openrouter", "text_generation", 84, 92, 84, 88, "aggregator routing minimizes cost"),

  // ── ocr ─────────────────────────────────────────────────────────────────────
  bench("openai",     "ocr", 88, 62, 85, 96, "gpt-4o vision: strong single-page OCR"),
  bench("anthropic",  "ocr", 90, 44, 76, 95, "claude-sonnet-4-6: accurate on complex documents"),
  bench("gemini",     "ocr", 93, 78, 82, 93, "gemini-1.5-pro: best multi-page document OCR"),
  bench("azure_openai","ocr", 87, 40, 82, 98, "gpt-4o on Azure; enterprise compliance"),

  // ── vision ──────────────────────────────────────────────────────────────────
  bench("openai",     "vision", 91, 62, 88, 96, "gpt-4o: reliable image understanding"),
  bench("anthropic",  "vision", 92, 44, 76, 95, "strong visual analysis and detailed description"),
  bench("gemini",     "vision", 91, 80, 84, 93, "multimodal native; good for mixed content"),

  // ── image_generation ────────────────────────────────────────────────────────
  bench("openai",     "image_generation", 90, 55, 75, 94, "DALL-E 3: photorealistic quality, per-image pricing"),
  bench("gemini",     "image_generation", 82, 70, 72, 88, "Imagen 3: strong but limited API access"),
  bench("openrouter", "image_generation", 85, 72, 74, 85, "routes to DALL-E 3; slightly higher overhead"),

  // ── video_generation ────────────────────────────────────────────────────────
  bench("runway",     "video_generation", 92, 25, 50, 88, "Gen-3 Alpha: cinema quality, credit-based pricing"),
  bench("google_veo", "video_generation", 90, 30, 48, 82, "Veo 2: physics-aware; limited API availability"),
  bench("luma",       "video_generation", 88, 40, 55, 86, "Dream Machine: strong product visualization"),
  bench("kling",      "video_generation", 86, 55, 58, 85, "competitive quality/cost ratio"),
  bench("pika",       "video_generation", 82, 70, 72, 84, "fastest for short social clips"),
  bench("gemini",     "video_generation", 80, 65, 60, 83, "Veo via Gemini API; limited availability"),

  // ── voice_synthesis ─────────────────────────────────────────────────────────
  bench("elevenlabs", "voice_synthesis", 96, 55, 85, 94, "industry-leading naturalness; wide voice library"),

  // ── voice_cloning ────────────────────────────────────────────────────────────
  bench("elevenlabs", "voice_cloning", 95, 50, 80, 93, "best-in-class voice cloning from short audio samples"),

  // ── translation ─────────────────────────────────────────────────────────────
  bench("gemini",     "translation", 91, 78, 85, 93, "Google-native translation context; strong Japanese↔English"),
  bench("openai",     "translation", 89, 62, 88, 96, "gpt-4o: excellent translation via prompting"),
  bench("anthropic",  "translation", 88, 46, 75, 95, "strong but no dedicated translation endpoint"),

  // ── seo_analysis ────────────────────────────────────────────────────────────
  bench("anthropic",  "seo_analysis", 92, 44, 72, 95, "best for nuanced content and keyword strategy"),
  bench("openai",     "seo_analysis", 89, 62, 86, 96, "gpt-4o: reliable structured SEO output"),
  bench("gemini",     "seo_analysis", 90, 78, 84, 93, "Google-native context for search intent"),

  // ── aio_analysis ────────────────────────────────────────────────────────────
  bench("gemini",     "aio_analysis", 95, 75, 82, 93, "Google-native: best insight into AI Overview factors"),
  bench("openai",     "aio_analysis", 82, 60, 84, 96, "good but lacks Google-native context"),
  bench("anthropic",  "aio_analysis", 84, 42, 74, 95, "analytical strength; no Google-native advantage"),

  // ── analytics ───────────────────────────────────────────────────────────────
  bench("anthropic",  "analytics", 94, 42, 70, 95, "200K context: best for large dataset analysis"),
  bench("gemini",     "analytics", 90, 75, 80, 93, "long context and strong structured output"),
  bench("openai",     "analytics", 88, 60, 84, 96, "gpt-4o: reliable for structured data tasks"),

  // ── reporting ───────────────────────────────────────────────────────────────
  bench("anthropic",  "reporting", 95, 40, 68, 95, "best structured output quality for business reports"),
  bench("openai",     "reporting", 90, 60, 82, 96, "function_calling: reliable structured generation"),
  bench("gemini",     "reporting", 88, 72, 78, 93, "good quality with competitive cost"),

  // ── social_post ─────────────────────────────────────────────────────────────
  bench("openai",     "social_post", 90, 65, 90, 96, "gpt-4o: creative and on-brand social content"),
  bench("anthropic",  "social_post", 88, 45, 74, 95, "high quality; slightly slower"),
  bench("gemini",     "social_post", 86, 80, 86, 93, "cost-effective for high-volume social posting"),
  bench("openrouter", "social_post", 83, 90, 82, 88, "lowest cost; routes to cheapest capable model"),
];

// ─── Recommendation table ─────────────────────────────────────────────────────

function rec(
  capability:           AIMarketplaceCapability,
  mode:                 AIRecommendationMode,
  recommended_provider: AIMarketplaceProviderId,
  alternatives:         AIMarketplaceProviderId[],
  confidence_score:     number,
  reasoning:            string,
): AIProviderRecommendation {
  return {
    capability,
    recommended_provider,
    alternatives,
    recommendation_mode:  mode,
    confidence_score,
    reasoning,
    last_updated: BENCHMARK_LAST_UPDATED,
  };
}

export const PROVIDER_RECOMMENDATIONS: AIProviderRecommendation[] = [
  // ── best_quality ────────────────────────────────────────────────────────────
  rec("chat_completion",  "best_quality", "anthropic",  ["openai", "gemini"],        92, "Claude Sonnet 4.6 scores highest on complex reasoning and nuanced multi-turn dialogue"),
  rec("text_generation",  "best_quality", "anthropic",  ["openai", "gemini"],        90, "Highest quality prose and structured text output across benchmarks"),
  rec("ocr",              "best_quality", "gemini",     ["anthropic", "openai"],     88, "Gemini 1.5 Pro has best multi-page document handling and layout preservation"),
  rec("vision",           "best_quality", "anthropic",  ["openai", "gemini"],        87, "Claude leads on detailed visual analysis and accurate description"),
  rec("image_generation", "best_quality", "openai",     ["gemini"],                  89, "DALL-E 3 produces most photorealistic output with strong prompt adherence"),
  rec("video_generation", "best_quality", "runway",     ["google_veo", "luma"],      88, "Gen-3 Alpha: cinema-quality motion with fine control"),
  rec("voice_synthesis",  "best_quality", "elevenlabs", [],                          96, "Industry-leading naturalness; no close competitor at this quality tier"),
  rec("voice_cloning",    "best_quality", "elevenlabs", [],                          95, "Best voice cloning accuracy from minimal samples"),
  rec("translation",      "best_quality", "gemini",     ["openai", "anthropic"],     88, "Google-native translation quality for Asian languages"),
  rec("seo_analysis",     "best_quality", "anthropic",  ["gemini", "openai"],        88, "Best for nuanced keyword strategy and content gap analysis"),
  rec("meo_analysis",     "best_quality", "gemini",     ["anthropic", "openai"],     86, "Google-native context for local search signals"),
  rec("aeo_analysis",     "best_quality", "anthropic",  ["openai", "gemini"],        85, "Strong structured output for featured snippet optimization"),
  rec("llmo_analysis",    "best_quality", "anthropic",  ["openai"],                  84, "Analytical depth for LLM training data visibility analysis"),
  rec("aio_analysis",     "best_quality", "gemini",     ["openai", "anthropic"],     93, "Google-native: authoritative insight into AI Overview ranking factors"),
  rec("analytics",        "best_quality", "anthropic",  ["gemini", "openai"],        92, "200K context window; best for large dataset business analysis"),
  rec("reporting",        "best_quality", "anthropic",  ["openai", "gemini"],        93, "Highest quality structured business reports with deep analysis"),
  rec("social_post",      "best_quality", "openai",     ["anthropic", "gemini"],     88, "gpt-4o: creative, on-brand social content with strong tone control"),

  // ── lowest_cost ─────────────────────────────────────────────────────────────
  rec("chat_completion",  "lowest_cost",  "openrouter", ["gemini", "openai"],        85, "Routes to cheapest capable model; gemini-flash as fallback"),
  rec("text_generation",  "lowest_cost",  "openrouter", ["gemini"],                  87, "Aggregator routing; gemini-flash is cheapest direct option"),
  rec("ocr",              "lowest_cost",  "gemini",     ["openai"],                  82, "gemini-flash offers strong OCR at lowest per-token cost"),
  rec("vision",           "lowest_cost",  "gemini",     ["openai"],                  80, "gemini-flash: cost-effective vision for high-volume tasks"),
  rec("image_generation", "lowest_cost",  "openai",     ["gemini"],                  78, "DALL-E 3 per-image pricing is competitive for moderate volume"),
  rec("video_generation", "lowest_cost",  "pika",       ["kling", "luma"],           82, "Pika: lowest credit cost for short social media videos"),
  rec("voice_synthesis",  "lowest_cost",  "elevenlabs", [],                          90, "No lower-cost alternative at acceptable quality"),
  rec("voice_cloning",    "lowest_cost",  "elevenlabs", [],                          88, "Only capable provider; optimize usage volume"),
  rec("translation",      "lowest_cost",  "gemini",     ["openai"],                  85, "gemini-flash: cheapest per-token with strong translation quality"),
  rec("seo_analysis",     "lowest_cost",  "openrouter", ["gemini"],                  83, "Routes to cheapest capable model for keyword tasks"),
  rec("meo_analysis",     "lowest_cost",  "gemini",     ["openrouter"],              82, "gemini-flash: cost-effective with Google-native context"),
  rec("aeo_analysis",     "lowest_cost",  "openrouter", ["gemini"],                  81, "Low-cost routing for structured snippet analysis"),
  rec("llmo_analysis",    "lowest_cost",  "openrouter", ["gemini"],                  80, "Cost-sensitive routing for analytical tasks"),
  rec("aio_analysis",     "lowest_cost",  "gemini",     ["openrouter"],              85, "gemini-flash: cheapest option with native Google context"),
  rec("analytics",        "lowest_cost",  "gemini",     ["openrouter"],              82, "gemini-1.5-pro: competitive long-context cost"),
  rec("reporting",        "lowest_cost",  "gemini",     ["openrouter"],              80, "gemini-1.5-pro: best cost/quality for structured reports"),
  rec("social_post",      "lowest_cost",  "openrouter", ["gemini"],                  88, "Aggregator routing minimizes social content generation cost"),

  // ── fastest ─────────────────────────────────────────────────────────────────
  rec("chat_completion",  "fastest",      "openai",     ["gemini", "openrouter"],    88, "gpt-4o-mini: lowest P50 latency for conversational tasks"),
  rec("text_generation",  "fastest",      "openai",     ["gemini"],                  88, "gpt-4o-mini: fastest first-token for bulk generation"),
  rec("ocr",              "fastest",      "openai",     ["gemini"],                  85, "gpt-4o: best throughput for single-page document OCR"),
  rec("vision",           "fastest",      "openai",     ["gemini"],                  86, "gpt-4o-mini: fastest vision inference"),
  rec("image_generation", "fastest",      "openai",     [],                          82, "DALL-E 3: consistent generation time (~15–20s)"),
  rec("video_generation", "fastest",      "pika",       ["kling", "luma"],           80, "Pika: fastest short-clip generation for social media"),
  rec("voice_synthesis",  "fastest",      "elevenlabs", [],                          92, "Sub-second synthesis latency for short text"),
  rec("voice_cloning",    "fastest",      "elevenlabs", [],                          90, "Fastest voice cloning pipeline available"),
  rec("translation",      "fastest",      "openai",     ["gemini"],                  87, "gpt-4o: lowest translation latency for real-time use"),
  rec("seo_analysis",     "fastest",      "openai",     ["gemini"],                  85, "gpt-4o-mini: fastest keyword extraction output"),
  rec("meo_analysis",     "fastest",      "openai",     ["gemini"],                  84, "Fastest structured MEO output"),
  rec("aeo_analysis",     "fastest",      "openai",     ["gemini"],                  83, "Fastest for snippet optimization tasks"),
  rec("llmo_analysis",    "fastest",      "openai",     [],                          82, "gpt-4o: fastest analytical output for LLMO tasks"),
  rec("aio_analysis",     "fastest",      "openai",     ["gemini"],                  82, "gpt-4o: fastest AIO output despite lacking Google-native context"),
  rec("analytics",        "fastest",      "openai",     ["gemini"],                  84, "gpt-4o: fastest structured analytics output"),
  rec("reporting",        "fastest",      "openai",     ["gemini"],                  85, "function_calling + gpt-4o: fastest structured report generation"),
  rec("social_post",      "fastest",      "openai",     ["openrouter"],              88, "gpt-4o-mini: fastest social content with strong quality"),

  // ── balanced ────────────────────────────────────────────────────────────────
  rec("chat_completion",  "balanced",     "openai",     ["anthropic", "gemini"],     88, "gpt-4o balances quality, speed, and cost for most chat tasks"),
  rec("text_generation",  "balanced",     "openai",     ["gemini", "anthropic"],     87, "gpt-4o-mini: strong balanced default for text generation"),
  rec("ocr",              "balanced",     "gemini",     ["openai", "anthropic"],     86, "gemini-1.5-pro: best quality/cost for document OCR"),
  rec("vision",           "balanced",     "openai",     ["gemini", "anthropic"],     85, "gpt-4o: reliable balanced vision across use cases"),
  rec("image_generation", "balanced",     "openai",     ["gemini"],                  84, "DALL-E 3: best balance of quality and predictable pricing"),
  rec("video_generation", "balanced",     "runway",     ["kling", "luma"],           82, "Runway: best balance of quality and sustainable credit model"),
  rec("voice_synthesis",  "balanced",     "elevenlabs", [],                          93, "No meaningful alternative; ElevenLabs is the balanced choice"),
  rec("voice_cloning",    "balanced",     "elevenlabs", [],                          92, "Single strong option; ElevenLabs is the balanced choice"),
  rec("translation",      "balanced",     "gemini",     ["openai"],                  87, "gemini-1.5-pro: quality/cost balance with Google-native context"),
  rec("seo_analysis",     "balanced",     "gemini",     ["openai", "anthropic"],     85, "gemini-1.5-pro: quality + cost + Google search context"),
  rec("meo_analysis",     "balanced",     "gemini",     ["openai"],                  86, "Google-native context is the decisive advantage for MEO"),
  rec("aeo_analysis",     "balanced",     "openai",     ["anthropic", "gemini"],     84, "gpt-4o: reliable balanced structured snippet output"),
  rec("llmo_analysis",    "balanced",     "anthropic",  ["openai"],                  83, "Analytical depth balances cost for infrequent LLMO runs"),
  rec("aio_analysis",     "balanced",     "gemini",     ["openai"],                  90, "Google-native context is dominant factor; cost/speed acceptable"),
  rec("analytics",        "balanced",     "anthropic",  ["gemini"],                  88, "Long context + analytical quality; runs less frequently"),
  rec("reporting",        "balanced",     "anthropic",  ["openai", "gemini"],        88, "Best structured output quality for periodic reports"),
  rec("social_post",      "balanced",     "openai",     ["gemini", "openrouter"],    86, "gpt-4o-mini: strong quality/cost for daily social posting"),
];

// ─── Scoring helpers ──────────────────────────────────────────────────────────

export function getBenchmark(
  provider_id: AIMarketplaceProviderId,
  capability:  AIMarketplaceCapability,
): AIProviderBenchmark | undefined {
  return PROVIDER_BENCHMARKS.find(
    (b) => b.provider_id === provider_id && b.capability === capability,
  );
}

export function getRecommendation(
  capability: AIMarketplaceCapability,
  mode:       AIRecommendationMode,
): AIProviderRecommendation | undefined {
  if (mode === "dealer_selected") return undefined;
  return PROVIDER_RECOMMENDATIONS.find(
    (r) => r.capability === capability && r.recommendation_mode === mode,
  );
}

export function getRecommendationsForCapability(
  capability: AIMarketplaceCapability,
): AIProviderRecommendation[] {
  return PROVIDER_RECOMMENDATIONS.filter((r) => r.capability === capability);
}

export function computeBalancedScore(benchmark: AIProviderBenchmark): number {
  return (
    benchmark.quality_score  * 0.50 +
    benchmark.cost_score     * 0.25 +
    benchmark.speed_score    * 0.25
  );
}

export function rankProvidersByMode(
  capability: AIMarketplaceCapability,
  mode:       Exclude<AIRecommendationMode, "dealer_selected">,
): AIMarketplaceProviderId[] {
  const benchmarks = PROVIDER_BENCHMARKS.filter((b) => b.capability === capability);
  if (benchmarks.length === 0) return [];

  const scored = benchmarks.map((b) => {
    let score: number;
    switch (mode) {
      case "best_quality": score = b.quality_score; break;
      case "lowest_cost":  score = b.cost_score;    break;
      case "fastest":      score = b.speed_score;   break;
      case "balanced":     score = computeBalancedScore(b); break;
    }
    return { provider_id: b.provider_id, score };
  });

  return scored
    .sort((a, b) => b.score - a.score)
    .map((s) => s.provider_id);
}
