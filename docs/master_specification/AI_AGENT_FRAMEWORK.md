# AI Agent Framework
## GYEON Detailer Agent — Common AI Module Architecture

| Field | Value |
|-------|-------|
| **Document** | AI Agent Framework Specification |
| **Status** | Sprint 10D — Framework implemented; agent inference deferred to Phase G |
| **Created** | 2026-06-26 |
| **Prerequisite** | AI Gateway Spec (`AI_GATEWAY_SPEC.md`) — `ai_settings` column migration required |

---

## 1. Purpose

Every AI module in GYEON Detailer Agent (Marketing, Reputation, Growth, OCR, Review, LINE, SEO) must use the common AI Agent Framework. This document defines the framework architecture, lifecycle, capability model, and registry.

**Key guarantee:** No AI feature can execute without passing through the full execution policy gate — feature check → gateway check → auth check → usage policy check.

---

## 2. Directory Structure

```
src/lib/ai/
├── types.ts                    — AIProviderId, AITaskType, AIProviderAdapter
├── capabilities.ts             — AICapability (provider), AIAgentCapability (agent)
├── provider-registry.ts        — AI_PROVIDER_REGISTRY (5 providers)
├── ai-settings-types.ts        — AiSettingsView, AIGatewayStatus, AIGatewayReadiness
├── crypto.ts                   — AES-256-GCM encrypt/decrypt (server only)
├── validate-api-key.ts         — Key format validation (offline)
├── get-ai-settings.ts          — Server action: read dealer AI settings
├── save-ai-settings.ts         — Server action: save dealer AI settings
├── test-ai-connection.ts       — Server action: connection test
├── check-ai-gateway.ts         — Server action: gateway readiness check
├── usage-policy.ts             — AIUsagePolicy, AIUsageEvent, AIUsageSummary
│
└── agents/
    ├── types.ts                — AIAgent interface, context, request/response, errors
    ├── registry.ts             — AI_AGENT_REGISTRY (7 agents)
    ├── execution-policy.ts     — checkExecutionPolicy(), createAgentContext()
    ├── lifecycle.ts            — runAgentLifecycle() orchestrator
    └── index.ts                — Public API re-exports
```

---

## 3. Core Interfaces

### AIAgent<TInput, TOutput>

```typescript
interface AIAgent<TInput extends AIAgentRequest, TOutput extends AIAgentResponse> {
  readonly id:               AIAgentId;
  readonly nameJa:           string;
  readonly descJa:           string;
  readonly capabilities:     AIAgentCapability[];
  readonly requiredFeature:  AppFeature;
  readonly requiredTaskTypes: AITaskType[];

  initialize(ctx: AIAgentContext):              Promise<void>;
  validate(ctx, input: TInput):                Promise<AIAgentValidationResult>;
  execute(ctx, input: TInput):                 Promise<TOutput>;
  postProcess(ctx, output: TOutput):           Promise<TOutput>;
}
```

### AIAgentContext

```typescript
interface AIAgentContext {
  dealer_id: string;     // Always from getCurrentDealer() — never from client
  plan:      DealerPlan;
  gateway:   AIGatewayReadiness;
  policy:    AIUsagePolicy;
  trace_id:  string;     // UUID per request — observability and log correlation
}
```

Context is created by `createAgentContext(agent_id)` in `execution-policy.ts`.
Never constructed manually from client data.

---

## 4. Lifecycle

```
createAgentContext(agent_id)
        │
        ▼
checkExecutionPolicy(agent_id)
  ├─ feature gate (Pro+ check)
  ├─ AI Gateway readiness (provider, key, enabled)
  ├─ authentication (getCurrentDealer)
  └─ usage policy (monthly limit)
        │
        ▼ (allowed: true)
runAgentLifecycle(agent, context, input)
  │
  ├─ [idle] → initialize(ctx)
  │
  ├─ [initializing] → validate(ctx, input)
  │
  ├─ [validating] → execute(ctx, input)           ← throws NotImplementedError (Sprint 10D)
  │
  ├─ [executing] → postProcess(ctx, output)
  │
  ├─ [post_processing] → logAgentUsage(ctx, output)  ← no-op (Phase G)
  │
  └─ [complete] → AIAgentLifecycleResult<TOutput>
```

At every stage, errors produce a `{ state: "failed", error: "Japanese message" }` result.
`runAgentLifecycle` never throws — always returns a structured result.

---

## 5. Capability Model

### Provider capabilities (`AICapability`)
What an AI provider model natively supports:

| Capability | Description | Provider Support |
|-----------|-------------|-----------------|
| `text_generation` | Generate natural language text | All |
| `chat_completion` | Multi-turn conversation | All |
| `function_calling` | Structured JSON output | All |
| `embeddings` | Vector embedding generation | OpenAI, Gemini |
| `vision` | Image understanding | OpenAI, Anthropic, Gemini, Azure |
| `ocr` | Optical character recognition | OpenAI, Gemini |
| `image_generation` | Create images | OpenRouter |
| `video_generation` | Create video | Future |
| `seo_analysis` | SEO keyword analysis | Anthropic, Gemini, OpenRouter |
| `meo_analysis` | Map Engine Optimization | Gemini |
| `aeo_analysis` | Answer Engine Optimization | Future |
| `llmo_analysis` | LLM Optimization | Future |
| `aio_analysis` | AI Overview Optimization | Gemini |
| `social_post` | Social media content | Future |
| `analytics` | Data analysis | Future |
| `reporting` | Report generation | Future |

### Agent capabilities (`AIAgentCapability`)
Higher-level responsibilities each GYEON agent handles:

| Capability | Description | Agents |
|-----------|-------------|--------|
| `content_creation` | Blog, SNS, service descriptions | marketing_agent, line_agent |
| `image_understanding` | Photo analysis, quality scoring | ocr_agent |
| `document_reading` | Vehicle reg, PDFs, forms | ocr_agent |
| `search_optimization` | SEO/MEO/AEO/LLMO/AIO | seo_agent, marketing_agent, reputation_agent |
| `review_management` | LINE review requests, GBP drafts | reputation_agent, review_agent |
| `social_media` | Scheduling, publishing | marketing_agent |
| `analytics_reporting` | Reputation analytics, trends | reputation_agent, growth_agent |
| `line_integration` | LINE message generation | line_agent, review_agent |

---

## 6. Agent Registry

| Agent ID | Plan Gate | Status | Phase |
|---------|-----------|--------|-------|
| `marketing_agent` | `ai_marketing` (Pro+) | Planned | PHASE 71–75 |
| `reputation_agent` | `ai_reputation` (Pro+) | Planned | PHASE 77–81 |
| `growth_agent` | `ai_growth` (Pro+) | Planned | PHASE 76 |
| `ocr_agent` | `ai_gateway` (Pro+) | Planned | Phase G拡張 |
| `review_agent` | `ai_reputation` (Pro+) | Planned | PHASE 77–78 |
| `line_agent` | `ai_marketing` (Pro+) | Planned | PHASE 69–70 LINE拡張 |
| `seo_agent` | `ai_marketing` (Pro+) | Planned | PHASE 71–72 |

All 7 agents are "planned" in Sprint 10D. Status changes to "active" when the first concrete implementation is shipped.

---

## 7. Error Types

| Error Class | When thrown |
|------------|-------------|
| `AIAgentError` | Base class — all agent errors |
| `AIAgentNotImplementedError` | execute() before Phase G adapter exists |
| `AIAgentGatewayError` | Gateway not ready when agent requires it |
| `AIAgentValidationFailedError` | validate() returns errors |

All error messages are in Japanese and safe for user display (no stack traces, no internal details).

---

## 8. Usage Logging

Usage logging (`logAgentUsage`) is a **no-op in Sprint 10D**. It will INSERT into `dealer_ai_usage_log` once:

1. The `dealer_ai_usage_log` table migration is applied (separate from `ai_settings` migration)
2. Phase G adapters return real token/cost data in `AIAgentResponse.usage_estimate`

Planned table schema:
```sql
-- NOT YET CREATED — Phase G migration, requires CTO approval
CREATE TABLE public.dealer_ai_usage_log (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  dealer_id           uuid NOT NULL,
  agent_id            text NOT NULL,
  task_type           text NOT NULL,
  provider            text NOT NULL,
  model               text NOT NULL,
  prompt_tokens       int NOT NULL DEFAULT 0,
  completion_tokens   int NOT NULL DEFAULT 0,
  estimated_cost_usd  numeric(10,6) NOT NULL DEFAULT 0,
  trace_id            uuid NOT NULL,
  created_at          timestamptz NOT NULL DEFAULT now()
);
```

---

## 9. Implementation Pattern for Sprint 10E+

When implementing a concrete agent (e.g., `ReviewAgent`):

```typescript
// src/lib/ai/agents/review/review-agent.ts
import type { AIAgent, AIAgentContext, AIAgentValidationResult } from "@/lib/ai/agents";
import { AIAgentNotImplementedError } from "@/lib/ai/agents";
import type { ReviewAgentRequest, ReviewAgentResponse } from "./types";

export class ReviewAgent implements AIAgent<ReviewAgentRequest, ReviewAgentResponse> {
  readonly id              = "review_agent" as const;
  readonly nameJa          = "AIレビューエージェント";
  readonly descJa          = "...";
  readonly capabilities    = ["review_management", "line_integration"] as const;
  readonly requiredFeature = "ai_reputation" as const;
  readonly requiredTaskTypes = ["review_request_generation", "review_response_drafting"] as const;

  async initialize(ctx: AIAgentContext): Promise<void> { /* load config */ }

  async validate(ctx: AIAgentContext, input: ReviewAgentRequest): Promise<AIAgentValidationResult> {
    // Return { valid: false, errors: [...] } if validation fails
    return { valid: true };
  }

  async execute(ctx: AIAgentContext, input: ReviewAgentRequest): Promise<ReviewAgentResponse> {
    // Phase 10D: throw below
    // Phase G+: call provider adapter via AI Gateway
    throw new AIAgentNotImplementedError(this.id);
  }

  async postProcess(ctx: AIAgentContext, output: ReviewAgentResponse): Promise<ReviewAgentResponse> {
    return output;
  }
}
```

Then in a server action:
```typescript
const policy = await checkExecutionPolicy("review_agent");
if (!policy.allowed) return { success: false, error: policy.reason };

const context = await createAgentContext("review_agent");
if (!context) return { success: false, error: "認証エラー" };

const result = await runAgentLifecycle(new ReviewAgent(), context, input);
```

---

## 10. Security Rules

1. `dealer_id` is ONLY set in `AIAgentContext` via `createAgentContext()` → `getCurrentDealer()`
2. No agent may accept `dealer_id` as a parameter from the client
3. All agent errors must be in Japanese and safe to show to the dealer
4. API keys are accessed only by `check-ai-gateway.ts` and `crypto.ts` — not by agents directly
5. `logAgentUsage` must use `context.dealer_id` exclusively — never from response data

---

*GYEON Detailer Agent | Sprint 10D | Office AZ | 2026-06-26*
