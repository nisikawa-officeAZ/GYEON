# Media Platform Specification
## Sprint 10L: Media as a First-Class Business Domain

| Field | Value |
|-------|-------|
| **Document** | Media Platform Architecture |
| **Status** | Active — Sprint 10L baseline |
| **Replaces** | MEDIA_ARCHITECTURE.md §1–§11 (those remain for history) |
| **Created** | 2026-06-26 |

> **Design principle:** Media must no longer be treated as files.
> Media is a business domain — it has a lifecycle, associations, permissions,
> consent requirements, and retention obligations.
> Every module that produces or consumes media must go through this domain layer.

---

## 1. Domain Objects

### 1.1 MediaAsset

The primary business-domain object. Extends `DealerMedia` (the DB-layer type) with:

| Field | Type | Purpose |
|-------|------|---------|
| `category` | `MediaCategory` | What business purpose this asset serves |
| `status` | `MediaAssetStatus` | Is the file accessible right now? |
| `lifecycle` | `MediaLifecycleStage` | Where in the full lifecycle is this asset? |
| `associations` | `MediaAssociation[]` | Which business entities reference this media? |
| `retention` | `MediaRetention` | When will this asset expire? |
| `consent` | `MediaConsentDetail` | Domain-level consent record |

**Construction:** always use `toMediaAsset(dbRecord, associations?, consent?)`.
Never construct `MediaAsset` directly — the domain fields are derived, not stored.

### 1.2 DealerMedia (DB layer)

The database-layer type. Fields match the proposed `media_assets` schema exactly.
Used directly when no domain enrichment is needed (e.g., raw queries, adapters).

Fields added in Sprint 10L:
- `ai_generated: boolean` — true if created by an AI agent
- `ai_source_media_id: string | null` — FK to source asset used as AI input
- `deleted_at: string | null` — soft-delete timestamp (file physically gone)

### 1.3 MediaReference

Lightweight pointer for list views, file pickers, and join results.
Contains only: `id`, `dealer_id`, `media_type`, `file_url`, `thumbnail_path`,
`mime_type`, `visibility`, `consent_status`, `category`, `status`.

Use `toMediaReference(dbRecord)` to construct.

### 1.4 MediaRetention

Computed retention state for a single asset:

```typescript
interface MediaRetention {
  policy:             VideoRetentionPeriod;
  expires_at:         string | null;
  is_expired:         boolean;
  is_dealer_retained: boolean;
  deletion_record?:   MediaDeletionRecord;
}
```

---

## 2. Media Lifecycle

### 2.1 Lifecycle Stages (Phase B)

```
Capture → Upload → Validation → Association → Usage →
AI Consumption → Marketing → Retention → Deletion → Audit
```

| Stage | Meaning |
|-------|---------|
| `captured` | File exists on device; not yet uploaded to storage |
| `uploaded` | File in Supabase Storage; not yet validated |
| `validated` | Passed MIME/size/type checks |
| `associated` | Linked to a work order, customer, or vehicle |
| `in_use` | Actively used in customer-facing documents |
| `ai_consumption` | Being processed by an AI agent |
| `marketing` | Cleared for marketing and SNS distribution |
| `retention_active` | Active use ended; inside retention window |
| `retention_expired` | Retention window elapsed; file awaits deletion |
| `deleted` | File physically deleted; record retained for audit |
| `audited` | Full MediaDeletionRecord finalized (terminal state) |

### 2.2 Stage Derivation

`deriveLifecycleStage(media: DealerMedia): MediaLifecycleStage` derives the
current stage from available DB fields. Priority order:

1. `deleted_at` set → `"deleted"`
2. `file_path` empty → `"captured"`
3. `isRetentionExpired()` → `"retention_expired"`
4. All three marketing gates met → `"marketing"`
5. `visibility = customer_visible` or `completion_report_id` set → `"in_use"`
6. Any FK set → `"associated"`
7. `file_size_bytes` and `mime_type` set → `"validated"`
8. Default → `"uploaded"`

### 2.3 Allowed Transitions

```
captured          → uploaded
uploaded          → validated, deleted
validated         → associated, deleted
associated        → in_use, ai_consumption, retention_active, deleted
in_use            → marketing, ai_consumption, retention_active, deleted
ai_consumption    → marketing, in_use, retention_active, deleted
marketing         → in_use, retention_active, deleted
retention_active  → retention_expired, deleted
retention_expired → deleted
deleted           → audited
audited           → (terminal)
```

---

## 3. Association Model (Phase C)

One media asset may be associated with multiple business entities.
This decouples "where media was captured" from "where it is used."

### 3.1 Association Targets

```typescript
type MediaAssociationTarget =
  | "customer"          | "vehicle"          | "estimate"
  | "work_order"        | "completion_report" | "invoice"
  | "line_message"      | "review"            | "marketing_campaign"
  | "sns_post"          | "ai_generated_asset";
```

### 3.2 Association Roles

```typescript
type MediaAssociationRole =
  | "primary"      // Main representative media
  | "supporting"   // Additional media for the same entity
  | "evidence"     // Proves a state (before/after result)
  | "source_input" // Used as AI input
  | "output"       // AI-generated output
  | "marketing_use"
  | "review_use";
```

### 3.3 Example

A before/after photo captured in a work order context:

| target_type | target_id | role |
|-------------|-----------|------|
| `work_order` | `wo_abc123` | `source_input` |
| `vehicle` | `veh_xyz789` | `supporting` |
| `completion_report` | `cr_456` | `evidence` |
| `marketing_campaign` | `mc_789` | `marketing_use` |

All from the same `media_id` — the file is stored once, associated many times.

### 3.4 Current State

`MediaAssociation` records are derived from nullable FK fields in `DealerMedia`
via `deriveAssociationsFromMedia()` until the `media_assets` table migration is applied.
Full association management (add/remove per campaign, per message, etc.) requires
the `MediaAssociationService` DB implementation.

---

## 4. Privacy and Consent Model (Phase F)

### 4.1 MediaConsentScope

```typescript
type MediaConsentScope =
  | "completion_report"  // Include in PDF completion report
  | "customer_gallery"   // Show in customer portal gallery
  | "marketing_use"      // Use in SNS / marketing campaigns
  | "ai_analysis"        // Pass to AI agents for visual analysis
  | "ai_training";       // AI model training (always opt-in, never default)
```

Each scope is independent — customers can consent to `completion_report` without
consenting to `marketing_use`.

### 4.2 Visibility Ratchet

Media visibility follows a ratchet: it can only increase with explicit consent.

```
internal_only → customer_visible → marketing_approved
```

- Decreasing visibility is always allowed (e.g., consent revocation).
- `consent_status = "denied"` immediately locks visibility to `internal_only`.

### 4.3 MediaPermissionScope (updated Sprint 10L)

The `retention_expired` scope was added in Sprint 10L:

```typescript
type MediaPermissionScope =
  | "retention_expired"    // NEW: file deleted or window elapsed — blocks all ops
  | "internal_only"
  | "customer_visible"
  | "marketing_candidate"
  | "marketing_approved";
```

`retention_expired` is evaluated first — a deleted or expired asset has no
permission to perform any operation regardless of other flags.

### 4.4 Privacy Invariants

| Rule | Enforcement |
|------|-------------|
| Default visibility = `internal_only` | Set in `workOrderFileToDealerMedia()` |
| `consent = denied` → `internal_only` | Enforced in `resolvePermissionScope()` |
| `retention_expired` blocks all ops | Short-circuits in `checkMediaPermission()` |
| AI training always opt-in | `is_ai_training_excluded` defaults to `false`; training requires `marketing_approved` |
| Marketing requires all three gates | `visibility + is_marketing_approved + consent = approved` |
| `ai_training_excluded` is immutable | Never changed once set — requires CTO approval |

---

## 5. Service Layer (Phase D)

### 5.1 Implemented Services (pure logic — no DB required)

| Service | Implementation | Purpose |
|---------|---------------|---------|
| `MediaValidationService` | `MediaValidationServiceImpl` | File validation |
| `MediaPermissionService` | `MediaPermissionServiceImpl` | Permission gates |
| `MediaRetentionService` | `MediaRetentionServiceImpl` | Retention checks |
| `MediaLifecycleService` | `MediaLifecycleServiceImpl` | Lifecycle state machine |
| `MediaCapabilityService` | `MediaCapabilityServiceImpl` | Capability registry queries |
| `MediaAuditService` | `MediaAuditServiceImpl` | Deletion record construction |

### 5.2 Interface-Only Services (require media_assets migration)

| Service | Requires | Purpose |
|---------|---------|---------|
| `MediaAssociationService` | `media_assets` table | Association CRUD and queries |

### 5.3 Usage Pattern

```typescript
// Direct function calls (stateless — preferred for single operations)
import { checkMediaPermission, deriveLifecycleStage } from "@/lib/media";

// Service instances (preferred when multiple operations are batched)
import { MediaPermissionServiceImpl } from "@/lib/media";
const svc = new MediaPermissionServiceImpl();
const gates = svc.checkBatchPermissions(assetList);
```

---

## 6. AI Integration (Phase E)

All AI agents consume `MediaAsset` or the specific agent-typed interfaces.
Raw `DealerMedia` objects must not be passed to AI agents directly.

| Agent | Interface | Gate |
|-------|-----------|------|
| `marketing_agent` | `MediaForMarketingAgent` | `visibility = marketing_approved + consent = approved` |
| `reputation_agent` | `MediaForReputationAgent` | `visibility >= customer_visible, consent != denied` |
| `growth_agent` | `MediaForGrowthAgent` | Aggregate counts only — no file URLs |

Use `checkMediaAICapability({ capability, media, agent_id, dealer_id })` to
validate before passing any media to an AI agent.

`MediaAsset` compatibility: all agent interfaces extend from `DealerMedia`, and
`MediaAsset extends DealerMedia`, so any function accepting `DealerMedia` accepts
a `MediaAsset`.

---

## 7. Retention and Deletion

### 7.1 Default Retention

| Media Type | Default Retention | Rationale |
|------------|------------------|-----------|
| Photo | 3650 days (~10 years) | Long-term job documentation |
| Video | 30 days | Storage cost and privacy minimization |

### 7.2 Soft Delete Pattern

Files are never hard-deleted without a `MediaDeletionRecord`:

1. Construct `MediaDeletionRecord` via `createDeletionRecord(asset, reason)`.
2. Persist the record to the audit store.
3. Delete the physical file from Supabase Storage.
4. Set `deleted_at` on the DB record.

The DB row is NEVER hard-deleted — it forms the permanent audit trail.

### 7.3 Deletion Eligibility

`isDeletionEligible(asset)` returns true for video assets whose 30-day retention
window has elapsed and that have not yet been soft-deleted.
Photos are never eligible under the default policy.

### 7.4 Current Status

No deletion runtime is implemented. `isDeletionEligible()` and `createDeletionRecord()`
are utilities for a future retention enforcement service (Phase 10M+).

---

## 8. Files Changed (Sprint 10L)

| File | Action | Purpose |
|------|--------|---------|
| `src/lib/media/media-types.ts` | Modified | Added `ai_generated`, `ai_source_media_id`, `deleted_at` to `DealerMedia`; added `isRetentionExpired()` |
| `src/lib/media/media-lifecycle.ts` | Created | Phase B: lifecycle stage type, state machine, derivation logic |
| `src/lib/media/media-association.ts` | Created | Phase C: association model (one media → many entities) |
| `src/lib/media/media-consent.ts` | Created | Phase A + F: domain-level consent model, scopes, channel |
| `src/lib/media/media-asset.ts` | Created | Phase A: `MediaAsset`, `MediaReference`, `MediaCategory`, `MediaRetention`, factory functions |
| `src/lib/media/media-audit.ts` | Created | Phase D: deletion record construction and eligibility checks |
| `src/lib/media/media-service.ts` | Created | Phase D: all 7 service interfaces + 6 pure-logic implementations |
| `src/lib/media/media-permission.ts` | Modified | Phase F: added `retention_expired` scope, updated resolver and gate |
| `src/lib/media/index.ts` | Modified | Phase G: all new types and functions exported |
| `docs/master_specification/MEDIA_PLATFORM_SPEC.md` | Created | Phase G: this document |
| `docs/master_specification/MEDIA_ARCHITECTURE.md` | Modified | Phase G: §13 added |
| `docs/master_specification/00_MASTER_SPECIFICATION_INDEX.md` | Modified | Phase G: v2.7 |

---

## 9. What Is NOT Implemented (by design)

| Feature | Reason |
|---------|--------|
| `media_assets` DB migration | Requires CTO approval — see MEDIA_ASSETS_SCHEMA_PROPOSAL.md |
| `MediaAssociationService` implementation | Requires `media_assets` table |
| Deletion runtime | Phase 10M+ — safety: no accidental file deletion |
| Retention enforcement scheduler | Phase 10M+ — requires CTO approval + infra |
| Video upload | VIDEO_INFRA_REQUIREMENTS still pending |
| AI agent execution | Phase 10E baseline — no live calls |
| Dealer retention configuration UI | Phase 10M+ |

---

*GYEON Detailer Agent | Media Platform Specification | Office AZ | 2026-06-26*
