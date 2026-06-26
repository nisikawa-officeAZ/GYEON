# Media Asset Center — Specification

**Sprint:** 12E  
**Status:** Foundation declared — storage and upload integration deferred to Sprint 13  
**Module path:** `src/lib/media/`  
**Prior foundation:** Sprints 10I, 10J, 10L (photo/video types, lifecycle state machine, consent)

---

## Overview

The Media Asset Center is the shared media platform for all GYEON Business Hub applications. Every module that creates, stores, or displays media — including the Dealer Agent, Communication Center, Automation Center, AI Marketplace, and GYEON Distribution — routes media through this layer.

Sprint 12E extends the existing media module (Sprints 10I–10L) from a 2-type photo/video model to a full 9-type asset catalog with formal lifecycle policies, usage context registry, AI compatibility modes, and platform integration architecture.

---

## Prior Foundation (Sprints 10I–10L)

These components already exist and are not modified in Sprint 12E:

| Component | File | Sprint |
|---|---|---|
| `DealerMedia` (DB record type) | `media-types.ts` | 10I |
| `MediaType` (`"photo" \| "video"`) | `media-types.ts` | 10I |
| `MediaVisibility` (3 levels) | `media-types.ts` | 10I |
| `MediaConsentStatus` (4 statuses) | `media-types.ts` | 10I |
| `MediaAsset` (enriched domain object) | `media-asset.ts` | 10L |
| `MediaCategory` (9 categories) | `media-asset.ts` | 10L |
| `MediaLifecycleStage` (11 stages) | `media-lifecycle.ts` | 10L |
| `MediaAssociationTarget` (11 targets) | `media-association.ts` | 10L |
| `MediaAICapabilityType` (2 types) | `media-ai.ts` | 10J |
| `MediaCapabilityId` (8 capabilities) | `media-capability.ts` | 10J |
| `MediaLifecycleTransition` (state machine) | `media-lifecycle.ts` | 10L |
| Consent, validation, permission, service layers | various | 10J, 10L |

---

## Sprint 12E Extensions

### Phase A + B — Extended Asset Type Registry

**File:** `src/lib/media/media-asset-type-registry.ts`

**`MediaAssetTypeId`** — 9 types (superset of existing `MediaType`):

| Type ID | Status | Default Owner | AI Processable |
|---|---|---|---|
| `image` | Available (10I) | dealer | Yes |
| `video` | Available (10I) | dealer | Yes |
| `ai_generated_image` | Sprint 13 | system | No |
| `ai_generated_video` | Sprint 14 | system | No |
| `pdf` | Sprint 13 | dealer | Yes (OCR) |
| `ocr_source_image` | Sprint 13 | dealer | Yes |
| `attachment` | Sprint 13 | dealer | No |
| `voice` | Sprint 14 | customer | No |
| `3d_asset` | Sprint 15+ | dealer | No |

**`MediaOwnerType`**: `"dealer" | "customer" | "system"`

**`MEDIA_ASSET_TYPE_REGISTRY`**: 9 descriptors with MIME types, size limits, preview/thumbnail support, AI compatibility, marketing eligibility.

---

### Phase C — Lifecycle Policy Registry

**File:** `src/lib/media/media-policy.ts`

**`MediaLifecyclePolicyId`** — 6 policies:

| Policy ID | Retention | Trigger | Auto Delete | Override |
|---|---|---|---|---|
| `permanent` | Indefinite | Never | No | Yes |
| `retention_30d` | 30 days | Time elapsed | Yes | Yes |
| `delete_after_download` | Event-based | Download confirmed | Yes | Yes |
| `delete_after_ai_processing` | Immediate | AI processed | Yes | No |
| `dealer_defined` | Dealer-configured | Time elapsed | Yes | Yes |
| `legal_hold` | Indefinite | Never | No | No (CTO approval) |

Default policy per asset type:
- `image` → `permanent`
- `pdf` → `permanent`
- `video` → `retention_30d`
- `ai_generated_image` → `retention_30d`
- `ai_generated_video` → `delete_after_download`
- `ocr_source_image` → `delete_after_ai_processing`
- `voice` → `retention_30d`
- `attachment` → `retention_30d`

No deletion logic in Sprint 12E. Policy declarations only.

---

### Phase D — Usage Context Registry

**File:** `src/lib/media/media-usage-registry.ts`

**`MediaUsageContextId`** — 10 business entity contexts:

| Context ID | Customer Accessible | Marketing Eligible | Available |
|---|---|---|---|
| `customer` | Yes | No | Yes (10L) |
| `vehicle` | Yes | Yes | Yes (10L) |
| `estimate` | Yes | No | Yes (10L) |
| `work_order` | Yes | Yes | Yes (10I) |
| `completion_report` | Yes | Yes | Yes (10J) |
| `invoice` | Yes | No | Sprint 13 |
| `communication` | Yes | No | Sprint 13 |
| `ai_generation` | No | No | Sprint 13 |
| `marketing_campaign` | No | Yes | Sprint 13 |
| `distribution_order` | No | No | Sprint 15+ |

---

### Phase E — AI Compatibility Registry

**File:** `src/lib/media/media-ai-compat.ts`

**`MediaAICompatibilityModeId`** — 6 AI workflow modes:

| Mode ID | Handling Agents | Source Types | Requires Consent |
|---|---|---|---|
| `ai_image_generation` | `marketing_agent` | `image` | Yes |
| `ai_video_generation` | `marketing_agent` | `image` | Yes |
| `ai_caption_generation` | `marketing_agent`, `line_agent` | `image`, `video` | No |
| `ocr_processing` | `ocr_agent` | `ocr_source_image`, `pdf`, `image` | No |
| `review_image` | `reputation_agent`, `review_agent` | `image` | No |
| `marketing_asset` | `marketing_agent`, `seo_agent` | `image`, `video` | Yes |

All 6 modes: `execution_deferred: true` — no AI execution in Sprint 12E.

The existing `media-ai.ts` (Sprint 10J, `MediaAICapabilityType = "ai_analysis" | "ai_marketing"`) is not modified. Sprint 12E extends at the registry level only.

---

### Phase F — Platform Integration Bridge

**File:** `src/lib/media/media-platform-bridge.ts`

**`MediaPlatformIntegrationId`** — 5 platform modules:

| Integration | Access Levels | Available |
|---|---|---|
| `communication_center` | read, write, link, approve | Sprint 13 |
| `automation_center` | read, link | Sprint 13 |
| `ai_marketplace` | read, generate | Sprint 13 |
| `dealer_agent` | read, write, link, approve, delete | Yes (10I) |
| `gyeon_distribution` | read, link | Sprint 15+ |

**`MEDIA_ASSET_CENTER_MANIFEST`**: Module metadata with version `0.2.0`, listing all implemented sprints and registry counts.

---

## Dependency Direction

```
src/lib/media/
    → src/lib/work-order-files/   (DealerMedia bridge adapter)
    → src/lib/ai/agents/types     (AIAgentId — media-ai.ts)
    → src/lib/plans/              (AppFeature — media-capability.ts)
```

The modules listed above must NOT import from `src/lib/media/`. Dependency is one-way.

New Sprint 12E dependencies: none — all cross-module references use string union type aliases to avoid circular imports.

---

## What Is NOT in Sprint 12E

- No storage implementation (Supabase Storage — Phase 10K+ for video)
- No file upload implementation
- No video generation
- No image generation
- No AI execution of any kind
- No OCR calls
- No database migrations or schema changes
- No external API calls
- No provider SDK imports

---

## Files Changed in Sprint 12E

| File | Action |
|---|---|
| `src/lib/media/media-asset-type-registry.ts` | Created |
| `src/lib/media/media-policy.ts` | Created |
| `src/lib/media/media-usage-registry.ts` | Created |
| `src/lib/media/media-ai-compat.ts` | Created |
| `src/lib/media/media-platform-bridge.ts` | Created |
| `src/lib/media/index.ts` | Updated — added 5 Sprint 12E sections |
| `docs/master_specification/MEDIA_ASSET_CENTER_SPEC.md` | Created |

---

## Sprint 13 Wiring Plan

Sprint 13 will:
1. Add `MediaAssetTypeId` to the `work_order_files` schema (requires CTO approval)
2. Wire Communication Center to store inbound media as `MediaAsset` records
3. Wire Automation Center triggers to fire on `MediaAsset` events
4. Activate `ocr_processing` for maintenance record scanning
5. Wire `ai_image_generation` and `ai_caption_generation` through the AI Gateway Bridge

---

## Related Specifications

- `AUTOMATION_CENTER_SPEC.md` — Automation Center (Sprint 12C)
- `AUTOMATION_AI_GATEWAY_BRIDGE_SPEC.md` — AI Gateway Bridge (Sprint 12D)
- `AI_AGENT_FRAMEWORK.md` — AI agent system
- `AI_CONTENT_AUTOMATION_SPEC.md` — Content automation
- `src/lib/media/media-types.ts` — Existing DealerMedia model
- `src/lib/media/media-ai.ts` — Existing AI gate functions
- `src/lib/media/media-association.ts` — Existing association model
- `docs/master_specification/MEDIA_ASSETS_SCHEMA_PROPOSAL.md` — DB schema proposal
