# AI Gateway Architecture
## GYEON Detailer Agent — Provider-Agnostic AI Infrastructure

| Field | Value |
|-------|-------|
| **Document** | AI Gateway Architecture Specification |
| **Status** | Sprint 10C — Settings layer implemented; adapters deferred to Phase G |
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
| **OpenAI** | `gpt-4o`, `gpt-4o-mini` | Most widely used; OCR already uses this via platform key (scope note: see §7) |
| **Claude (Anthropic)** | `claude-sonnet-4-6`, `claude-opus-4-8` | Content writing, long-form generation |
| **Gemini (Google)** | `gemini-1.5-pro`, `gemini-flash` | Multimodal, fast |
| **Azure OpenAI** | Same as OpenAI, hosted on Azure | Enterprise dealers may prefer Azure for compliance |
| **OpenRouter** | Any model via unified API | Access to 100+ models from multiple providers via single key; useful for dealers who want model flexibility without managing multiple provider accounts |
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

## 4. Schema Design (Sprint 10C — Migration Required)

Sprint 10C uses a single new jsonb column on the existing `dealer_settings` table rather than a separate table. This avoids an additional migration for the settings layer.

```sql
-- Sprint 10C: Add ai_settings column to dealer_settings
-- ⚠️ Requires CTO approval before execution in staging/production.

ALTER TABLE public.dealer_settings
  ADD COLUMN IF NOT EXISTS ai_settings jsonb NOT NULL DEFAULT '{}';

-- Column contents: encrypted API keys + provider configuration.
-- This column MUST NEVER be returned to the client.
-- See src/lib/ai/get-ai-settings.ts for the safe read-only view.
```

### `ai_settings` jsonb structure

```json
{
  "enabled":              true,
  "primary_provider":     "openai",
  "monthly_limit_usd":    50,
  "hard_limit":           false,
  "openai_api_key":       "v1:{iv}:{tag}:{ciphertext}",
  "anthropic_api_key":    "v1:{iv}:{tag}:{ciphertext}",
  "gemini_api_key":       "v1:{iv}:{tag}:{ciphertext}",
  "azure_openai_api_key": "v1:{iv}:{tag}:{ciphertext}",
  "azure_openai_endpoint":"https://...",
  "openrouter_api_key":   "v1:{iv}:{tag}:{ciphertext}",
  "openai_validated_at":  "2026-06-26T00:00:00Z",
  "anthropic_validated_at":"2026-06-26T00:00:00Z"
}
```

### Encryption specification

- **Algorithm:** AES-256-GCM
- **Key source:** `DEALER_AI_KEY_SECRET` env var (64 hex chars = 32 bytes)
- **IV:** 12 random bytes per key, stored with ciphertext
- **Ciphertext format:** `"v1:{iv_hex}:{auth_tag_hex}:{ciphertext_hex}"`
- **Decryption location:** Server actions only (`src/lib/ai/crypto.ts`)
- **Client visibility:** Never — `AiSettingsView` contains `has_key: boolean`, not the key

### Security rules for `ai_settings`:
- `ai_settings` column MUST NEVER appear in SELECT queries that return data to the client
- `getAiSettings()` returns `AiSettingsView` — which contains `has_key: boolean` only, not raw keys
- `decryptApiKey()` is called only in server actions (`test-ai-connection.ts`)
- `dealer_id` always from `getCurrentDealer()` — never from client input

### Required environment variable
```
DEALER_AI_KEY_SECRET=<64-char hex string>
# Generate with: openssl rand -hex 32
```

### Previous design (superseded)
The original spec proposed a separate `dealer_ai_settings` table with RLS. Sprint 10C adopts the simpler jsonb column approach on `dealer_settings` to reduce migration scope. The separate-table approach may be revisited at Phase G if the jsonb column grows too large or if per-provider RLS becomes a requirement.

---

## 5. AI Provider Settings — Sprint 10C Implementation

### Implemented (Sprint 10C)

| Setting | Status | File |
|---------|--------|------|
| AI provider selection (5 providers) | ✅ Implemented | `AIGatewaySettings.tsx` |
| API key registration (encrypted AES-256-GCM) | ✅ Implemented | `save-ai-settings.ts` + `crypto.ts` |
| Connection test (format validation) | ✅ Implemented | `test-ai-connection.ts` |
| Monthly usage limit (USD) | ✅ Implemented | `save-ai-settings.ts` |
| Hard limit toggle (block vs. warn) | ✅ Implemented | `save-ai-settings.ts` |
| Enable / Disable AI Gateway | ✅ Implemented | `save-ai-settings.ts` |
| Gateway readiness check | ✅ Implemented | `check-ai-gateway.ts` |
| Pro+ feature gate | ✅ Implemented | `checkFeatureAccess("ai_gateway")` |
| Provider capability metadata | ✅ Implemented | `provider-registry.ts` |
| Migration-required graceful handling | ✅ Implemented | `get-ai-settings.ts` |

### Deferred to Phase G

| Setting | Status |
|---------|--------|
| Network-level connection test (real API call) | ⏳ Phase G — requires adapter implementation |
| Per-feature provider/model assignment UI | ⏳ Phase G |
| Usage tracking dashboard | ⏳ Phase G — requires `dealer_ai_usage_log` table |
| Cost estimation | ⏳ Phase G |
| AI inference (actual API calls) | ⏳ Phase G |

### Connection test note

Sprint 10C's "接続テスト" is **format validation only** — it checks that the stored key matches the expected prefix/length for the selected provider. It does NOT make a network call to the provider API. The UI honestly discloses this via `test_type: "format_validation"`. A full network-level test is deferred to Phase G when adapters are implemented.

### Storage

- API keys stored as AES-256-GCM ciphertext in `dealer_settings.ai_settings` jsonb
- `getAiSettings()` returns `AiSettingsView` — `has_key: boolean` only, never the raw key
- Keys validated at save time (format) and at test time (format from stored encrypted key)
- Validation timestamps stored per provider in `{provider_id}_validated_at` fields

### UI placement

Settings appear under **AI設定（Pro+）** in the dealer settings screen. This category is visible to all dealers but shows a "Pro+ required" lock screen for non-Pro+ accounts.

### Azure OpenAI extra field

Azure OpenAI requires an `azure_openai_endpoint` URL in addition to the API key. This is stored in `ai_settings.azure_openai_endpoint` (not encrypted — it's a URL, not a secret).

---

## 6. AppFeature Status (Sprint 10A/10C)

All AI features are now registered in `plan-types.ts` and `feature-registry.ts`:

| AppFeature | Plan Tier | Status | Gate |
|------------|-----------|--------|------|
| `"ai_gateway"` | Pro+ | **Active gate** — Sprint 10C settings layer | `checkFeatureAccess("ai_gateway")` |
| `"ai_marketing"` | Pro+ | **Active gate** — No implementation yet | `checkFeatureAccess("ai_marketing")` |
| `"ai_reputation"` | Pro+ | **Active gate** — No implementation yet | `checkFeatureAccess("ai_reputation")` |
| `"ai_growth"` | Pro+ | **Active gate** — No implementation yet | `checkFeatureAccess("ai_growth")` |
| `"ai_video_generation"` | Pro+ | Type-only (not in PLAN_FEATURES) | — |
| `"ai_review_assistant"` | Pro+ | Type-only (not in PLAN_FEATURES) | — |
| `"ai_social_scheduler"` | Pro+ | Type-only (not in PLAN_FEATURES) | — |
| `"ai_marketing_analytics"` | Pro+ | Type-only (not in PLAN_FEATURES) | — |

**Implementation order:** All future AI features (`ai_marketing`, `ai_reputation`, `ai_growth`) MUST call `checkAiGatewayReady()` from `src/lib/ai/check-ai-gateway.ts` and verify `status === "ready"` before executing any AI inference.

---

## 7. Scope: OCR and Existing OpenAI Usage

**Current state:** OCR (vehicle registration card reading) uses `OPENAI_API_KEY` from the server environment — this is a platform-level key paid by Office AZ.

**Scope clarification:** The "Office AZ bears no inference costs" rule applies specifically to **AI Gateway-routed AI agent features** (AI Marketing, AI Reputation, AI Growth — PHASE 71–81). OCR is a core platform utility, not an AI agent feature.

**Future decision required (not now):** At Gateway implementation time, decide whether:
- OCR remains as a platform-included service (cost absorbed in SaaS pricing)
- OCR transitions to dealer API key (dealer's OpenAI key used for OCR)
- A separate OCR microservice is used (not OpenAI)

This decision is tracked as a future Operator Decision. No change to OCR code is required now.

---

## 8. Implementation Status & Gate

### Sprint 10C — Completed

| Layer | Status |
|-------|--------|
| AI Gateway types (`src/lib/ai/types.ts`) | ✅ Done |
| Provider registry (`src/lib/ai/provider-registry.ts`) | ✅ Done (5 providers, capabilities) |
| AI settings types (`src/lib/ai/ai-settings-types.ts`) | ✅ Done |
| Encryption module (`src/lib/ai/crypto.ts`) | ✅ Done (AES-256-GCM) |
| Key format validation (`src/lib/ai/validate-api-key.ts`) | ✅ Done |
| Read settings server action (`src/lib/ai/get-ai-settings.ts`) | ✅ Done |
| Save settings server action (`src/lib/ai/save-ai-settings.ts`) | ✅ Done |
| Connection test server action (`src/lib/ai/test-ai-connection.ts`) | ✅ Done |
| Gateway readiness check (`src/lib/ai/check-ai-gateway.ts`) | ✅ Done |
| Usage policy types (`src/lib/ai/usage-policy.ts`) | ✅ Done |
| Settings UI (`src/components/settings/AIGatewaySettings.tsx`) | ✅ Done |
| Settings navigation (`SettingsCategoryNav.tsx`) | ✅ Done (AI設定 category) |
| Settings page data fetch (`src/app/settings/page.tsx`) | ✅ Done |

### Phase G — Deferred (awaiting CTO approval of migration)

**Do not implement Phase G until:**

1. `DEALER_AI_KEY_SECRET` env var configured in staging
2. `ai_settings` column migration applied (`ALTER TABLE ... ADD COLUMN ai_settings jsonb`)
3. At least one AI Agent feature (PHASE 71+) ready to implement
4. Legal review of data processing implications (API keys, PII in AI requests)
5. Separate SDD specification pass for each gateway adapter
6. CTO approval

---

## 10. AI Agent Framework (Sprint 10D)

The AI Agent Framework is the common architecture layer between the Gateway and individual AI agents. See `AI_AGENT_FRAMEWORK.md` for the full specification.

**Key integration points:**

| Framework component | Gateway role |
|--------------------|-------------|
| `checkExecutionPolicy()` | Calls `checkFeatureAccess()` + `checkAiGatewayReady()` |
| `createAgentContext()` | Calls `checkAiGatewayReady()` + `getAiSettings()` |
| `AIAgentContext.gateway` | Contains `AIGatewayReadiness` from `checkAiGatewayReady()` |
| `AIAgentContext.policy` | Populated from `AiSettingsView.monthly_limit_usd` + `hard_limit` |

**Dependency chain:**
```
AI Agent (Sprint 10E+)
        ↓
AI Agent Framework (Sprint 10D)   ← src/lib/ai/agents/
        ↓
AI Gateway Settings (Sprint 10C)  ← src/lib/ai/get-ai-settings.ts, check-ai-gateway.ts
        ↓
AI Gateway Spec (This document)   ← provider-registry.ts, crypto.ts
```

---

## 9. Compatibility Notes

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
