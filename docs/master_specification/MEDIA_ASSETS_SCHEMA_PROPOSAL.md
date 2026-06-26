# media_assets — Schema Proposal
## Sprint 10K: Architecture Review

| Field | Value |
|-------|-------|
| **Document** | Migration Proposal — DRAFT |
| **Status** | Pending CTO approval — DO NOT APPLY |
| **Target table** | `public.media_assets` |
| **Replaces** | Extending `work_order_files` (Option 1 — rejected) |
| **Created** | 2026-06-26 |

> **DRAFT — DO NOT APPLY**
> This document contains a proposed SQL migration.
> Do not paste this into Supabase SQL Editor or run it programmatically.
> CTO approval is required before this migration is applied.
> All code in this file is for planning purposes only.

---

## 1. Architecture Decision

### Why Not Extend work_order_files (Option 1 Rejected)

`work_order_files` is structurally unsuitable for the full media model:

| Constraint | Problem |
|-----------|---------|
| `work_order_id NOT NULL` | AI-generated videos have no work order — they cannot be stored here |
| Table name implies source files | Thumbnails, AI outputs, and marketing assets are not "work order files" |
| No retention fields | Adding `expires_at`, `deleted_at`, `retention_reason` to a files table is semantically wrong |
| No consent columns | Adding `consent_status`, `visibility`, `is_marketing_approved` to a PHASE40 table risks RLS surface expansion |
| Download / publish tracking | `download_status`, `publish_status`, `downloaded_at`, `published_at` are completely foreign to the original table purpose |
| Phase 10J would add 16+ columns | 17 existing + 16 new = 33 columns. Clear sign of table scope creep. |

### Why media_assets (Option 2 Recommended)

| Requirement | work_order_files | media_assets |
|-------------|-----------------|--------------|
| Source photos from jobs | Supported | Supported (work_order_id nullable FK) |
| Source videos from jobs | Supported | Supported |
| AI-generated videos (no work order) | **Cannot store** | Supported (`ai_generated = true`, `work_order_id = null`) |
| Thumbnails as separate records | Not possible | Supported (`ai_source_media_id` self-FK) |
| Consent tracking | **Not supported** | `consent_status` column |
| Visibility control | Only `is_public` boolean | Full `visibility` enum |
| Marketing approval | **Not supported** | `marketing_approved` boolean |
| AI training exclusion | **Not supported** | `ai_training_excluded` boolean |
| Retention policy | **Not supported** | `retention_policy`, `expires_at`, `deleted_at` |
| Download tracking | **Not supported** | `download_status`, `downloaded_at` |
| SNS publish tracking | **Not supported** | `publish_status`, `published_at` |
| Polymorphic source | Only work_orders | `source_table` + `source_id` |
| Customer gallery | Cannot filter without join | Direct `customer_id` FK |
| CDN / streaming | No infrastructure fields | Extensible via metadata columns |

---

## 2. Proposed SQL Migration

```sql
-- ============================================================================
-- DRAFT: media_assets — canonical media storage table
-- File: docs/master_specification/MEDIA_ASSETS_SCHEMA_PROPOSAL.md
--
-- DO NOT APPLY WITHOUT CTO APPROVAL.
-- This is a planning document. Run only after all prerequisites in
-- VIDEO_INFRA_REQUIREMENTS (media-video.ts) are approved.
-- ============================================================================

-- ─── Table ───────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.media_assets (

  -- Core identity
  id                   uuid         PRIMARY KEY DEFAULT gen_random_uuid(),
  -- dealer_id MUST be injected server-side from getCurrentDealer() — never from client input
  dealer_id            uuid         NOT NULL,

  -- Source linkage — all FKs nullable (media may be dealer-level, not tied to a single entity)
  customer_id          uuid         REFERENCES public.customers(id)          ON DELETE SET NULL,
  vehicle_id           uuid         REFERENCES public.vehicles(id)           ON DELETE SET NULL,
  work_order_id        uuid         REFERENCES public.work_orders(id)        ON DELETE SET NULL,
  completion_report_id uuid         REFERENCES public.completion_reports(id) ON DELETE SET NULL,
  -- Polymorphic source — identifies what generated or owns this asset
  -- Values: 'work_orders' | 'completion_reports' | 'ai_outputs' | 'dealer_uploads' | null
  source_table         text,
  source_id            uuid,

  -- Media classification
  media_type           text         NOT NULL
                                    CHECK (media_type IN ('photo', 'video')),
  media_usage          text         NOT NULL DEFAULT 'internal_only'
                                    CHECK (media_usage IN (
                                      'before',
                                      'after',
                                      'work_in_progress',
                                      'completion',
                                      'customer_visible',
                                      'internal_only',
                                      'marketing_candidate',
                                      'ai_training_excluded'
                                    )),

  -- Privacy and consent
  visibility           text         NOT NULL DEFAULT 'internal_only'
                                    CHECK (visibility IN (
                                      'internal_only',
                                      'customer_visible',
                                      'marketing_approved'
                                    )),
  consent_status       text         NOT NULL DEFAULT 'not_required'
                                    CHECK (consent_status IN (
                                      'not_required',
                                      'pending',
                                      'approved',
                                      'denied'
                                    )),

  -- File storage
  file_path            text         NOT NULL,
  -- thumbnail_path: pre-generated JPEG (photos: 480px resize; videos: first-frame)
  -- Null until thumbnail generation service is implemented (Phase 10K+)
  thumbnail_path       text,
  mime_type            text,
  file_size_bytes      bigint,

  -- Media dimension metadata (null until Phase 10K extraction service)
  width                integer,
  height               integer,
  -- duration_seconds: video only — null for photos
  duration_seconds     float,

  -- AI generation tracking
  ai_generated         boolean      NOT NULL DEFAULT false,
  -- ai_source_media_id: for AI outputs, points to the source media used as input
  ai_source_media_id   uuid         REFERENCES public.media_assets(id) ON DELETE SET NULL,

  -- Marketing and AI flags
  marketing_candidate  boolean      NOT NULL DEFAULT false,
  -- marketing_approved requires: consent_status = 'approved' AND visibility = 'marketing_approved'
  marketing_approved   boolean      NOT NULL DEFAULT false,
  -- ai_training_excluded: immutable once set to true — requires CTO approval to unset
  ai_training_excluded boolean      NOT NULL DEFAULT false,

  -- Retention policy
  -- Values match VideoRetentionPeriod in media-video.ts:
  --   'after_ai_processing' | 'after_download' | '7_days' | '30_days' | '90_days' | 'long_term'
  retention_policy     text         NOT NULL DEFAULT '30_days'
                                    CHECK (retention_policy IN (
                                      'after_ai_processing',
                                      'after_download',
                                      '7_days',
                                      '30_days',
                                      '90_days',
                                      'long_term'
                                    )),
  -- expires_at: computed from retention_policy at INSERT time by application layer
  -- Null for 'long_term' retention
  expires_at           timestamptz,
  -- deleted_at: set when file is physically deleted from storage (soft delete signal)
  -- The record itself is retained for audit (MediaDeletionRecord semantics)
  deleted_at           timestamptz,
  -- retention_reason: values from MediaDeletionReason in media-types.ts
  retention_reason     text
                       CHECK (retention_reason IS NULL OR retention_reason IN (
                         'retention_period_expired',
                         'ai_processing_completed',
                         'download_confirmed',
                         'dealer_manual_delete',
                         'consent_revoked',
                         'policy_enforcement'
                       )),

  -- Download tracking (for AI-generated video lifecycle)
  download_status      text         NOT NULL DEFAULT 'not_downloaded'
                                    CHECK (download_status IN (
                                      'not_downloaded', 'downloaded', 'unknown'
                                    )),
  downloaded_at        timestamptz,

  -- SNS publish tracking
  publish_status       text         NOT NULL DEFAULT 'not_published'
                                    CHECK (publish_status IN (
                                      'not_published', 'published', 'unknown'
                                    )),
  published_at         timestamptz,

  -- Uploader
  -- created_by: UUID of the staff member who uploaded or triggered generation
  created_by           uuid         REFERENCES auth.users(id) ON DELETE SET NULL,

  -- Timestamps
  created_at           timestamptz  NOT NULL DEFAULT now(),
  updated_at           timestamptz  NOT NULL DEFAULT now()
);

-- ─── Comments ─────────────────────────────────────────────────────────────────

COMMENT ON TABLE public.media_assets IS
  'Canonical media storage for all customer photos and videos. '
  'Replaces work_order_files for media use cases after CTO-approved migration. '
  'dealer_id must always be injected server-side from getCurrentDealer().';

COMMENT ON COLUMN public.media_assets.dealer_id IS
  'Always injected server-side. Never from client form input or URL parameter.';

COMMENT ON COLUMN public.media_assets.ai_training_excluded IS
  'Immutable once set to true. Requires CTO approval to unset. '
  'Media with this flag must never be passed to external AI providers for training.';

COMMENT ON COLUMN public.media_assets.deleted_at IS
  'Set when file is physically deleted from Supabase Storage. '
  'The row is retained as a MediaDeletionRecord — do not hard-delete rows.';

COMMENT ON COLUMN public.media_assets.expires_at IS
  'Computed by the application layer from retention_policy at insert time. '
  'Null for long_term retention. Used by the scheduled retention enforcement job (Phase 10K+).';

-- ─── Row-Level Security ───────────────────────────────────────────────────────

ALTER TABLE public.media_assets ENABLE ROW LEVEL SECURITY;

-- Dealer members can read their own media assets
CREATE POLICY "media_assets_dealer_select" ON public.media_assets
  FOR SELECT USING (
    dealer_id IN (
      SELECT dealer_id FROM public.dealer_members
      WHERE user_id = auth.uid() AND status = 'active'
    )
  );

-- Dealer members can insert media (dealer_id enforced by WITH CHECK)
CREATE POLICY "media_assets_dealer_insert" ON public.media_assets
  FOR INSERT WITH CHECK (
    dealer_id IN (
      SELECT dealer_id FROM public.dealer_members
      WHERE user_id = auth.uid() AND status = 'active'
    )
  );

-- Dealer members can update their own media
CREATE POLICY "media_assets_dealer_update" ON public.media_assets
  FOR UPDATE USING (
    dealer_id IN (
      SELECT dealer_id FROM public.dealer_members
      WHERE user_id = auth.uid() AND status = 'active'
    )
  );

-- No DELETE policy — use deleted_at (soft delete) to preserve audit trail.
-- Hard deletes are only performed by the retention enforcement service
-- after confirmed soft deletion (Phase 10K+).

-- ─── Indexes ──────────────────────────────────────────────────────────────────

-- Primary lookup patterns
CREATE INDEX IF NOT EXISTS idx_media_assets_dealer_id
  ON public.media_assets (dealer_id);

CREATE INDEX IF NOT EXISTS idx_media_assets_work_order_id
  ON public.media_assets (work_order_id)
  WHERE work_order_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_media_assets_customer_id
  ON public.media_assets (customer_id)
  WHERE customer_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_media_assets_vehicle_id
  ON public.media_assets (vehicle_id)
  WHERE vehicle_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_media_assets_completion_report_id
  ON public.media_assets (completion_report_id)
  WHERE completion_report_id IS NOT NULL;

-- AI generation chain
CREATE INDEX IF NOT EXISTS idx_media_assets_ai_source
  ON public.media_assets (ai_source_media_id)
  WHERE ai_source_media_id IS NOT NULL;

-- Privacy / marketing queries
CREATE INDEX IF NOT EXISTS idx_media_assets_visibility_dealer
  ON public.media_assets (visibility, dealer_id);

CREATE INDEX IF NOT EXISTS idx_media_assets_marketing_approved
  ON public.media_assets (dealer_id, marketing_approved)
  WHERE marketing_approved = true;

-- Retention enforcement (scheduled job scans this index)
CREATE INDEX IF NOT EXISTS idx_media_assets_expires_at
  ON public.media_assets (expires_at)
  WHERE expires_at IS NOT NULL AND deleted_at IS NULL;

-- Soft-deleted records (for audit queries)
CREATE INDEX IF NOT EXISTS idx_media_assets_deleted_at
  ON public.media_assets (deleted_at)
  WHERE deleted_at IS NOT NULL;

-- Media type lookups
CREATE INDEX IF NOT EXISTS idx_media_assets_media_type_dealer
  ON public.media_assets (media_type, dealer_id);
```

---

## 3. Storage Path Convention

After migration to `media_assets`, the storage bucket `work-order-files` continues to be used.
New path convention differentiates media categories:

```
Bucket: work-order-files (private — no change)

Source media (photos / videos from jobs):
  {dealer_id}/media/{media_type}/{work_order_id}/{uuid}_{sanitized_filename}
  Example:
    d7f3a91e.../media/photo/wo_4ba2.../a3f9e2b1_front_bumper.jpg
    d7f3a91e.../media/video/wo_4ba2.../c1d8f0e2_before_wash.mp4

Thumbnails (generated server-side):
  {dealer_id}/thumbnails/{media_id}.jpg
  Example:
    d7f3a91e.../thumbnails/9f2e3d1c-a4b5-....jpg

AI-generated outputs:
  {dealer_id}/ai-generated/{ai_source_media_id}/{uuid}_output.{ext}
  Example:
    d7f3a91e.../ai-generated/9f2e3d1c-.../b2c3d4e5_reel.mp4

Dealer brand assets:
  {dealer_id}/brand/{uuid}_{filename}
  Example:
    d7f3a91e.../brand/logo_watermark.png
```

---

## 4. Migration Strategy

### Phase: Coexistence (Sprint 10K–10L)

1. Create `media_assets` table (this proposal).
2. New uploads go to `media_assets`.
3. `work_order_files` remains active and read-only for historical data.
4. `workOrderFileToDealerMedia()` adapter bridges the gap.
5. Completion reports and work order views query both tables with a UNION or application-layer merge.

### Phase: Full Migration (Post Sprint 10L — separate approval)

1. Backfill `work_order_files` rows into `media_assets` with `source_table = 'work_order_files'`.
2. Update all server actions to write to `media_assets` only.
3. Deprecate `workOrderFileToDealerMedia()` adapter.
4. Archive `work_order_files` (read-only, then drop).

---

## 5. TypeScript Impact

No TypeScript changes are required after migration.

`DealerMedia` in `src/lib/media/media-types.ts` was designed to match `media_assets` exactly:

| `media_assets` column | `DealerMedia` field | Status |
|-----------------------|---------------------|--------|
| `id` | `id` | Matches |
| `dealer_id` | `dealer_id` | Matches |
| `media_type` | `media_type` | Matches |
| `media_usage` | `usage` | Matches (field renamed in TS) |
| `visibility` | `visibility` | Matches |
| `consent_status` | `consent_status` | Matches |
| `file_path` | `file_path` | Matches |
| `thumbnail_path` | `thumbnail_path` | Matches |
| `mime_type` | `mime_type` | Matches |
| `file_size_bytes` | `file_size_bytes` | Matches |
| `width` | `width` | Matches |
| `height` | `height` | Matches |
| `duration_seconds` | `duration_seconds` | Matches |
| `ai_training_excluded` | `is_ai_training_excluded` | Matches (prefix convention) |
| `marketing_approved` | `is_marketing_approved` | Matches (prefix convention) |
| `customer_id` | `customer_id` | Matches |
| `vehicle_id` | `vehicle_id` | Matches |
| `work_order_id` | `work_order_id` | Matches |
| `completion_report_id` | `completion_report_id` | Matches |
| `created_at` | `created_at` | Matches |
| `updated_at` | `updated_at` | Matches |

Only `workOrderFileToDealerMedia()` needs to be deprecated — the adapter goes away, not the types.

---

## 6. Prerequisites Before Applying

All of the following must be resolved before this migration is applied:

| Prerequisite | Source | Status |
|-------------|--------|--------|
| CTO approval for migration | — | Pending |
| `work_order_files` historical backfill strategy | — | Design pending |
| Storage path migration plan | §3 above | Defined — execution pending |
| Retention enforcement runtime design | Phase 10K | Pending |
| Thumbnail generation service | `VIDEO_INFRA_REQUIREMENTS` | Pending |
| `completion_reports` foreign key update | `completion_report_id` FK | Pending |

---

*GYEON Detailer Agent | Media Assets Schema Proposal | Office AZ | 2026-06-26*
