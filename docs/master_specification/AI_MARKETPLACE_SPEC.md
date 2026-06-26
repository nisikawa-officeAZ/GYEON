# AI Capability Marketplace Specification

**Module**: `src/lib/ai-marketplace/`  
**Sprint**: Sprint 11S  
**Version**: 1.0.0  
**Status**: Foundation complete — marketplace UI planned for Sprint 11T+

---

## Overview

The AI Capability Marketplace allows dealers to select the best AI provider for each business capability rather than choosing a single global provider. Each capability (OCR, video generation, voice synthesis, etc.) can be independently routed to the provider with the best quality, cost, or speed profile for that specific task.

This document covers the foundation layer implemented in Sprint 11S. The marketplace UI, dealer routing persistence, and gateway extension integrations are planned for Sprint 11T+.

---

## Architecture

### Scope

The marketplace is a **superset** of the existing AI Gateway and AI Settings layers:

```
AICapability (16)   ⊂  AIMarketplaceCapability (19)
AIProviderId (5)    ⊂  AIMarketplaceProviderId  (11)
```

The marketplace introduces:
- 3 new capability extensions: `translation`, `voice_synthesis`, `voice_cloning`
- 6 new provider extensions: `google_veo`, `runway`, `kling`, `pika`, `luma`, `elevenlabs`

The existing gateway layer (`src/lib/ai/`) and AI Settings Platform (`src/lib/ai-settings/`) are unchanged.

### Module structure

```
src/lib/ai-marketplace/
├── marketplace-types.ts       — core domain types
├── capability-catalog.ts      — 19 capabilities with metadata
├── provider-profiles.ts       — 11 provider profiles
├── recommendation-engine.ts   — benchmark scores and recommendation metadata
├── settings-integration.ts    — bridge to AI Settings Platform
├── marketplace-descriptor.ts  — AI_CAPABILITY_MARKETPLACE descriptor
└── index.ts                   — package barrel
```

### Strict architecture rules

- No SDK imports — profiles are metadata only; adapters live in `src/lib/ai-orchestrator/`
- No external API calls — all data is static TypeScript declarations
- No persistence — no database writes; settings persistence uses existing AI Settings layer
- No `use server` — pure TypeScript module
- `dealer_id` always from `getCurrentDealer()` in server action callers

---

## Phase B: Capability Categories

14 canonical capability categories:

| Category | Display Name | Capabilities |
|---|---|---|
| `chat` | Chat | text_generation, chat_completion, function_calling, embeddings |
| `ocr` | OCR | vision, ocr |
| `translation` | Translation | translation *(new)* |
| `image_generation` | Image Generation | image_generation |
| `video_generation` | Video Generation | video_generation |
| `voice` | Voice | voice_synthesis *(new)*, voice_cloning *(new)* |
| `seo` | SEO | seo_analysis |
| `meo` | MEO | meo_analysis |
| `aeo` | AEO | aeo_analysis |
| `llmo` | LLMO | llmo_analysis |
| `aio` | AIO | aio_analysis |
| `analytics` | Analytics | analytics |
| `marketing` | Marketing | social_post |
| `reporting` | Reporting | reporting |

### Plan requirements

| Plan | Unlocked capabilities |
|---|---|
| basic | text_generation, chat_completion |
| pro | + function_calling, embeddings, vision, ocr, translation, seo_analysis, meo_analysis, aeo_analysis, analytics, social_post, reporting |
| pro_plus | + image_generation, video_generation, voice_synthesis, voice_cloning, llmo_analysis, aio_analysis |

---

## Phase C: Provider Profiles

11 provider profiles in `AI_MARKETPLACE_PROVIDER_PROFILES`:

### Gateway providers (in `AIProviderId`)

| Provider | Status | Specialties | Cost Tier |
|---|---|---|---|
| `openai` | gateway_planned | chat_completion, function_calling, image_generation | standard |
| `anthropic` | gateway_planned | chat_completion, analytics, reporting | premium |
| `gemini` | gateway_planned | aio_analysis, ocr, embeddings, translation | budget |
| `azure_openai` | gateway_planned | chat_completion, function_calling (enterprise) | enterprise |
| `openrouter` | gateway_planned | text_generation, social_post (cost routing) | budget |

### Extension providers (marketplace-only, not yet in `AIProviderId`)

| Provider | Status | Specialties | Adapter Sprint |
|---|---|---|---|
| `google_veo` | marketplace_only | video_generation (Veo 2) | Sprint 12+ |
| `runway` | marketplace_only | video_generation (Gen-3 Alpha) | Sprint 12+ |
| `kling` | marketplace_only | video_generation | Sprint 12+ |
| `pika` | marketplace_only | video_generation (short social clips) | Sprint 12+ |
| `luma` | marketplace_only | video_generation (Dream Machine) | Sprint 12+ |
| `elevenlabs` | marketplace_only | voice_synthesis, voice_cloning | Sprint 12+ |

---

## Phase D: Recommendation Engine

### Recommendation modes

| Mode | Score weight | Description |
|---|---|---|
| `best_quality` | quality × 1.0 | Best output quality regardless of cost |
| `lowest_cost` | cost × 1.0 | Minimum cost per operation |
| `fastest` | speed × 1.0 | Minimum response latency |
| `balanced` | quality × 0.5 + cost × 0.25 + speed × 0.25 | Weighted balance |
| `dealer_selected` | — | Dealer overrides system recommendation |

Recommendations are pre-computed in `PROVIDER_RECOMMENDATIONS` — no runtime scoring, no network calls.

### Benchmark scores

Each provider/capability pair has an `AIProviderBenchmark` with:
- `quality_score` (0–100): output quality relative to peers
- `cost_score` (0–100): cost-effectiveness (higher = cheaper)
- `speed_score` (0–100): response latency (higher = faster)
- `reliability_score` (0–100): uptime and consistency
- `benchmark_version`: `"1.0.0"`
- `last_updated`: `"2026-06"`

75 benchmark entries cover all meaningful provider/capability pairings.

### Key recommendations (balanced mode)

| Capability | Recommended | Reasoning |
|---|---|---|
| chat_completion | openai | Best quality/cost/speed balance |
| analytics, reporting | anthropic | Long context + analytical depth |
| aio_analysis | gemini | Google-native AIO context |
| video_generation | runway | Cinema-quality balanced with credit model |
| voice_synthesis | elevenlabs | No close competitor |
| translation | gemini | Google-native language context |

---

## Phase E: AI Settings Integration

### Routing flow (Sprint 11T+)

```
AICapabilityMarketplace
  ↓ dealer selects preferred provider per capability
AIMarketplaceCapabilityRouting
  ↓ if gateway_eligible → toGatewayAssignment()
AICapabilityAssignmentMap (AI Settings)
  ↓ provider resolution (4-level)
resolved AIProviderId for execution
```

### `AIMarketplaceCapabilityRouting`

```typescript
interface AIMarketplaceCapabilityRouting {
  capability:          AIMarketplaceCapability;
  preferred_provider:  AIMarketplaceProviderId | null;
  fallback_provider:   AIMarketplaceProviderId | null;
  execution_policy:    "auto" | "preferred" | "strict" | "disabled";
  recommendation_mode: AIRecommendationMode;
  gateway_eligible:    boolean;  // preferred_provider in AIProviderId
  base_capability:     AICapability | null;
}
```

### Gateway eligibility

| Condition | Result |
|---|---|
| `preferred_provider` is in `AIProviderId` | gateway_eligible: true → persists in AICapabilityAssignmentMap |
| `preferred_provider` is marketplace-only | gateway_eligible: false → cannot persist until provider added to gateway |
| capability is `translation`, `voice_synthesis`, or `voice_cloning` | base_capability: null → no AICapabilityAssignment equivalent |

### `toGatewayAssignment(routing)`

Converts `AIMarketplaceCapabilityRouting` to `AICapabilityAssignment`.  
Returns `null` when the capability is an extension or the preferred provider is marketplace-only.

---

## Marketplace descriptor

```typescript
const AI_CAPABILITY_MARKETPLACE: AICapabilityMarketplace = {
  version:                    "1.0.0",
  sprint:                     "Sprint 11S",
  capability_count:           19,
  provider_count:             11,
  gateway_provider_count:     5,
  extension_provider_count:   6,
  category_count:             14,
  marketplace_ui_available:   false,   // locked
  settings_integration_ready: true,
  target_sprint:              "Sprint 11T+",
};
```

---

## Pending before Sprint 11T

1. Marketplace UI — capability card grid, provider selection per capability, recommendation display
2. `AIMarketplaceRoutingMap` persistence — extend `dealer_ai_settings` schema (CTO approval required for migration 072 variant)
3. `validateMarketplaceRouting()` integration into `saveAISettingsProfile()` action
4. Gateway extension — add `google_veo`, `runway`, `kling`, `pika`, `luma`, `elevenlabs` to `AIProviderId` and `AI_PROVIDER_REGISTRY`
5. Extension capability integration — add `translation`, `voice_synthesis`, `voice_cloning` to `AICapability` and orchestrator capability maps
6. Sprint 12+ adapter implementations for all 6 extension providers
