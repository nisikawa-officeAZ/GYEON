# AI Gateway Architecture
## GYEON Detailer Agent — Provider-Agnostic AI Infrastructure

| Field | Value |
|-------|-------|
| **Document** | AI Gateway Architecture Specification |
| **Status** | Approved Architecture Decision — Deferred |
| **Created** | 2026-06-26 |
| **Priority** | Prerequisite to all AI Agent features (PHASE 71–81) |
| **Implementation** | Do not implement now. Specification only. |

---

## Decision Summary

The GYEON Detailer Agent platform must become AI-provider agnostic. No single AI vendor is hardcoded into the product. Dealers register their own API keys. Office AZ does not pay AI inference costs.

---

## 1. Core Principles

| Principle | Description |
|-----------|-------------|
| **Provider-agnostic** | The system must support multiple AI providers with a unified gateway interface. Swapping providers requires no code change by dealers. |
| **Dealer-owned keys** | Each dealer registers their own AI provider API key. Keys belong to the dealer's account and are never shared across dealers. |
| **Office AZ bears no inference costs** | All AI inference calls route through dealer-owned API keys. Office AZ does not pay any AI inference costs for dealer-side AI agent features. |
| **Server-side only** | All API keys are stored encrypted server-side. Keys are never returned to the client, never logged, never exposed in error messages. |
| **Graceful degradation** | If a dealer has not configured an API key for a required provider, the feature is disabled with a clear setup prompt — never fails silently. |

---

## 2. Supported Providers (Future)

| Provider | Models (examples) | Notes |
|----------|--------------------|-------|
| **OpenAI** | `gpt-4o`, `gpt-4o-mini` | Most widely used; OCR already uses this via platform key (scope note: see §6) |
| **Claude (Anthropic)** | `claude-sonnet-4-6`, `claude-opus-4-8` | Content writing, long-form generation |
| **Gemini (Google)** | `gemini-1.5-pro`, `gemini-flash` | Multimodal, fast |
| **Azure OpenAI** | Same as OpenAI, hosted on Azure | Enterprise dealers may prefer Azure for compliance |
| **Future providers** | (additional providers TBD) | Gateway adapter pattern enables addition without breaking changes |

> **Note:** The provider list is extensible. Adding a new provider requires adding a new gateway adapter — it does not require changes to business logic or feature code.

---

## 3. Gateway Architecture (Conceptual)

```
Dealer Feature (AI Marketing / AI Reputation / AI Growth)
         │
         ▼
   AI Gateway Service
   ┌───────────────────────────────────────────────┐
   │  resolveProvider(dealer_id, task_type)        │
   │    → reads dealer_ai_settings                 │
   │    → selects appropriate provider + model     │
   │    → injects API key (server-side)            │
   │    → returns adapter                          │
   └───────────────────────────────────────────────┘
         │
         ▼ (adapter)
   ┌────────────┐  ┌────────────┐  ┌────────────┐  ┌──────────────┐
   │  OpenAI    │  │  Claude    │  │  Gemini    │  │  Azure OAI   │
   │  Adapter   │  │  Adapter   │  │  Adapter   │  │  Adapter     │
   └────────────┘  └────────────┘  └────────────┘  └──────────────┘
```

### Task types (examples)

| Task type | Default provider recommendation |
|-----------|--------------------------------|
| `content_writing` | Claude (long-form, Japanese quality) |
| `image_analysis` | OpenAI (Vision) or Gemini |
| `video_generation` | Runway / Sora (when API available) |
| `review_request_generation` | Claude or OpenAI |
| `keyword_extraction` | Any supported text provider |

> Default recommendations are advisory only. Dealers choose their own provider per task type.

---

## 4. Schema Design (Future Migration — Do Not Apply)

New table required when Gateway is implemented:

```sql
-- Migration: dealer_ai_settings
CREATE TABLE public.dealer_ai_settings (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  dealer_id             uuid NOT NULL REFERENCES dealers(id) ON DELETE CASCADE,

  -- Provider keys (encrypted at rest, server-side only)
  openai_api_key        text,                          -- NEVER return to client
  claude_api_key        text,                          -- NEVER return to client
  gemini_api_key        text,                          -- NEVER return to client
  azure_openai_api_key  text,                          -- NEVER return to client
  azure_openai_endpoint text,                          -- Azure-specific endpoint

  -- Task routing configuration
  task_routing          jsonb NOT NULL DEFAULT '{}',
  -- Structure: { "content_writing": "claude", "image_analysis": "openai", ... }

  -- Validation state
  openai_validated_at   timestamptz,
  claude_validated_at   timestamptz,
  gemini_validated_at   timestamptz,
  azure_validated_at    timestamptz,

  created_at            timestamptz NOT NULL DEFAULT now(),
  updated_at            timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT dealer_ai_settings_dealer_unique UNIQUE (dealer_id)
);

-- RLS: dealer may only read/write their own row
ALTER TABLE public.dealer_ai_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "dealer own ai settings"
  ON public.dealer_ai_settings
  FOR ALL
  USING (
    dealer_id IN (
      SELECT dm.dealer_id FROM dealer_members dm
      WHERE dm.user_id = auth.uid() AND dm.status = 'active'
    )
  );
```

**⚠️ Do not apply this migration.** Requires CTO approval and staging verification before execution.

### Security rules for `dealer_ai_settings`:
- All `*_api_key` columns are `SELECT`-blocked by application-level code — never included in any query that returns data to the client
- The gateway service reads keys via `createAdminClient()` (service role) — this bypasses RLS at the service layer, with dealer_id checked explicitly
- Key validation is done server-side by the gateway — invalid keys are flagged but not exposed

---

## 5. AppFeature Additions (Future)

When the AI Gateway and AI agents are implemented, the following features must be added to `AppFeature` and `PLAN_FEATURES.pro_plus`:

| AppFeature | Plan Tier | Feature Group |
|------------|-----------|---------------|
| `"ai_marketing"` | Pro+ | AI Marketing Agent (PHASE 71–75) |
| `"ai_growth"` | Pro+ | AI Growth Agent (PHASE 76) |
| `"ai_reputation"` | Pro+ | AI Reputation Agent (PHASE 77–81) |

**Do not add these to `plan-types.ts` until implementation begins.** Defining unused feature keys creates maintenance overhead.

---

## 6. Scope: OCR and Existing OpenAI Usage

**Current state:** OCR (vehicle registration card reading) uses `OPENAI_API_KEY` from the server environment — this is a platform-level key paid by Office AZ.

**Scope clarification:** The "Office AZ bears no inference costs" rule applies specifically to **AI Gateway-routed AI agent features** (AI Marketing, AI Reputation, AI Growth — PHASE 71–81). OCR is a core platform utility, not an AI agent feature.

**Future decision required (not now):** At Gateway implementation time, decide whether:
- OCR remains as a platform-included service (cost absorbed in SaaS pricing)
- OCR transitions to dealer API key (dealer's OpenAI key used for OCR)
- A separate OCR microservice is used (not OpenAI)

This decision is tracked as a future Operator Decision. No change to OCR code is required now.

---

## 7. Implementation Gate

**Do not implement the AI Gateway until:**

1. Core business platform at stable production
2. Sprint 10 (dealer approval flow) complete
3. At least one AI Agent feature (PHASE 71+) ready to implement
4. Legal review of data processing implications (API keys, PII in AI requests)
5. Separate SDD specification pass for each gateway adapter
6. CTO approval of `dealer_ai_settings` migration

---

## 8. Compatibility Notes

### Existing code compatibility
- `src/lib/line/send-line-message.ts` — no change (LINE API, not AI gateway)
- `src/app/api/line/webhook/route.ts` — no change
- `src/lib/ocr/` — no change (OCR uses platform key per §6 scope clarification)
- All existing dealer_settings columns — no change

### Future integration points
- AI agents (PHASE 71–81) will import from a `src/lib/ai/gateway.ts` module (not yet created)
- The gateway module is server-only — never imported in client components
- AI-generated content is never stored with the raw API response — only the extracted useful output

---

*GYEON Detailer Agent | AI Gateway Architecture Specification | Office AZ | 2026-06-26*
