# GYEON Detailer Agent — Media Architecture
## Sprint 10I: Media-First Design Specification

| Field | Value |
|-------|-------|
| **Document** | Customer Media Architecture |
| **Status** | Sprint 10I — Types and architecture defined; full implementation in Phase 10J+ |
| **Created** | 2026-06-26 |
| **Security** | `dealer_id` always from `getCurrentDealer()`. Private media never publicly exposed by default. |

---

## 1. Architecture Principle: Media-First

Customer media is not image-only. The system supports **both photos and videos** from the beginning.

All new code must use:
- `MediaType = "photo" | "video"` — not "image"
- `isPhoto()` / `isVideo()` / `isMedia()` — not `isImage()`
- `MediaSection` — not `PhotoSection`
- `src/lib/media/media-types.ts` — canonical media model

The term "media" encompasses all visual content (photos and videos). Use it consistently across types, components, and database columns.

---

## 2. Canonical Media Model

**Location:** `src/lib/media/media-types.ts`

### MediaType

```typescript
export type MediaType = "photo" | "video";
```

### MediaUsage

```typescript
export type MediaUsage =
  | "before"              // Captured before work began
  | "after"               // Captured after work completed
  | "work_in_progress"    // Mid-job documentation
  | "completion"          // Formal completion record
  | "customer_visible"    // Cleared for customer-facing completion report
  | "internal_only"       // Staff/dealer only
  | "marketing_candidate" // Flagged for potential marketing use
  | "ai_training_excluded"; // Must not be used for AI model training
```

### MediaConsentStatus

```typescript
export type MediaConsentStatus =
  | "not_required"  // Internal-only: no consent needed
  | "pending"       // Awaiting customer response
  | "approved"      // Customer has explicitly consented
  | "denied";       // Customer declined — must not be shared externally
```

### MediaVisibility

```typescript
export type MediaVisibility =
  | "internal_only"       // Default for all uploads
  | "customer_visible"    // Completion report sharing
  | "marketing_approved"; // SNS / website / marketing (requires consent = "approved")
```

Visibility is a **ratchet**:
- Only increases with explicit consent at each level
- Can decrease at any time (consent revocation)
- Default for every new upload: `internal_only`

### DealerMedia Interface

Full interface with all future fields — see `src/lib/media/media-types.ts`.

Fields marked `[FUTURE]` are not in the current `work_order_files` schema.
Added via Phase 10J migration after CTO approval.

---

## 3. Current Storage Architecture

### Bucket: `work-order-files`

| Field | Current | Notes |
|-------|---------|-------|
| Table | `work_order_files` | Schema stable since PHASE 40 |
| Max file size | **20 MB** | Enforced in `upload-work-order-file.ts` |
| Accepted MIME | `image/*`, `application/pdf`, `video/mp4`, `video/quicktime` | Already accepts video |
| Path convention | `{dealer_id}/{work_order_id}/{phase}/{uuid}_{filename}` | Dealer-scoped ✅ |
| `file_type` column | `'photo' | 'document' | 'video' | 'other'` | Already supports video ✅ |
| `is_public` flag | boolean | Privacy gate (Phase 10J: upgrade to MediaVisibility) |

### Bucket: `vehicle-registration-documents`

Private bucket. Signed URLs only. OCR use only. Not part of customer media architecture.

### Bucket: `document-files`

PDF-only (estimates, completion reports, invoices). Not customer media.

---

## 4. Video Support Status

### What works today (Sprint 10I)

| Feature | Status |
|---------|--------|
| `file_type = 'video'` in database | ✅ Already supported |
| Video file upload (MP4, QuickTime) | ✅ Upload UI accepts video |
| Video display in work order file list | ✅ Shows 🎥 link to open video |
| `isVideo()` helper | ✅ Added in Sprint 10I |
| `isPhoto()` helper | ✅ Added in Sprint 10I |
| `isMedia()` helper | ✅ Added in Sprint 10I |

### What is blocked until Phase 10J

| Feature | Blocker |
|---------|---------|
| Real video uploads | 20 MB limit — too small for video |
| Video thumbnail in completion report | No thumbnail generation service |
| Video in PDF completion reports | PDFs cannot embed video |
| Duration / resolution metadata | `duration_seconds`, `width`, `height` columns missing |
| Thumbnail storage path | `thumbnail_path` column missing |
| Per-asset consent tracking | `consent_status` column missing |
| Marketing approval flag | `is_marketing_approved` column missing |
| AI training exclusion flag | `is_ai_training_excluded` column missing |

### Infrastructure requirements before increasing video upload limit

1. **Supabase Storage plan**: verify capacity and egress pricing for video files
2. **Vercel function body size**: Pro plan supports up to 4.5 GB body — verify current plan
3. **CDN streaming strategy**: decide between HLS segmentation and progressive download
4. **Thumbnail generation**: video first-frame extraction service
5. **Mobile UX**: upload progress indication and retry on failure
6. **Target limit**: 500 MB per file (`VIDEO_TARGET_MAX_UPLOAD_BYTES` in `media-types.ts`)

---

## 5. Customer Consent Architecture

### Principle

Private customer media **must never be publicly exposed by default**.

Every upload defaults to `visibility = "internal_only"` and `consent_status = "not_required"`.

### Consent escalation

```
new upload
  → visibility: "internal_only"      (default, no consent needed)
  → customer views completion report  → visibility: "customer_visible"   (dealer decision)
  → dealer requests marketing consent → consent_status: "pending"
  → customer approves                 → consent_status: "approved"
  → dealer marks for marketing        → visibility: "marketing_approved", is_marketing_approved: true
```

### AI Training exclusion

- Default: `is_ai_training_excluded = false`
- Once set to `true`, this flag is **immutable** — requires CTO approval to unset
- Media flagged as `is_ai_training_excluded = true` must never be passed to external AI providers

### Phase 10J migration requirement

Add to `work_order_files`:
```sql
consent_status          text NOT NULL DEFAULT 'not_required',
visibility              text NOT NULL DEFAULT 'internal_only',
is_marketing_approved   boolean NOT NULL DEFAULT false,
is_ai_training_excluded boolean NOT NULL DEFAULT false,
```

---

## 6. Storage Path Convention (Current and Future)

### Current: work-order-files

```
{dealer_id}/{work_order_id}/{phase}/{uuid8}_{sanitized_filename}
```

Example:
```
d7f3a91e.../wo_4ba2.../before/a3f9e2b1_IMG_4512.jpg
d7f3a91e.../wo_4ba2.../after/c1d8f0e2_VID_2024.mp4
```

### Future: thumbnail storage (Phase 10J+)

```
{dealer_id}/thumbnails/{media_id}.jpg
```

Generated server-side by the thumbnail service after upload.

---

## 7. AI Marketing Agent Integration

**Location:** `src/lib/media/media-types.ts` → `MediaForMarketing`

The AI Marketing Agent must use `getMarketingApprovedMedia()` to filter media before passing to external AI providers.

This function enforces all three gates:
1. `visibility === "marketing_approved"`
2. `consent_status === "approved"`
3. `is_marketing_approved === true`

### Planned AI Marketing media workflows (Phase 71–72)

| Workflow | MediaType | Usage |
|----------|-----------|-------|
| Before/After post selection | photo | `before` + `after` |
| Work-in-progress documentation | photo / video | `work_in_progress` |
| Water beading showcase | video | `after` |
| Completion report visual | photo | `completion` |
| AI Reels / Shorts / TikTok generation | photo + video | `after`, `completion` |
| Dealer branding overlay | photo + video | any |
| License plate blur (server-side) | photo + video | any |
| Face blur (server-side) | photo + video | any |

**Privacy rule:** License plate blur and face blur run server-side before any media asset is stored or transmitted to any external AI service. No unblurred media with identifiable information may be stored or transmitted.

---

## 8. Phase 10J Migration Proposal

All of the following require CTO approval before applying.

### Extend `work_order_files`

```sql
-- Phase 10J: extend work_order_files with full media metadata
ALTER TABLE work_order_files
  ADD COLUMN thumbnail_path        text,
  ADD COLUMN duration_seconds      float,
  ADD COLUMN width                 integer,
  ADD COLUMN height                integer,
  ADD COLUMN captured_at           timestamptz,
  ADD COLUMN uploaded_by           uuid REFERENCES auth.users(id),
  ADD COLUMN completion_report_id  uuid REFERENCES completion_reports(id),
  ADD COLUMN consent_status        text NOT NULL DEFAULT 'not_required',
  ADD COLUMN visibility            text NOT NULL DEFAULT 'internal_only',
  ADD COLUMN is_marketing_approved   boolean NOT NULL DEFAULT false,
  ADD COLUMN is_ai_training_excluded boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN work_order_files.thumbnail_path IS
  'Storage path to pre-generated thumbnail. Null until thumbnail service is active.';

COMMENT ON COLUMN work_order_files.is_ai_training_excluded IS
  'Immutable once set to true. Requires CTO approval to unset.';
```

### Increase upload size limit

Update `src/lib/work-order-files/upload-work-order-file.ts`:
```typescript
// Phase 10J: after infrastructure review
const PHOTO_MAX_FILE_SIZE = 20  * 1024 * 1024;  // 20 MB
const VIDEO_MAX_FILE_SIZE = 500 * 1024 * 1024;  // 500 MB
```

---

## 9. Media Runtime (Sprint 10J)

**Location:** `src/lib/media/`

### Module structure

| Module | Purpose |
|--------|---------|
| `media-types.ts` | Canonical DealerMedia model, consent/visibility types, AI marketing filter |
| `media-context.ts` | `MediaContext` factory — dealer_id always from `getCurrentDealer()` |
| `media-validation.ts` | MIME type validation, file size policy, `validateMediaFile()` |
| `media-permission.ts` | Permission model — `checkMediaPermission()`, `resolvePermissionScope()` |
| `media-capability.ts` | `MEDIA_CAPABILITY_REGISTRY` — 8 capabilities with availability status |
| `media-video.ts` | Future video architecture — upload config, processing pipeline, HLS, infra requirements |
| `media-ai.ts` | AI agent compatibility — `checkMediaAICapability()`, agent-specific interfaces |
| `media-runtime.ts` | `MediaRuntime` — unified orchestrator for all of the above |
| `index.ts` | Public re-exports — import from `@/lib/media` |

### Upload policies

| Policy | Allow video | Max size | Status |
|--------|-------------|----------|--------|
| `CURRENT_UPLOAD_POLICY` | No | 20 MB | Active |
| `CURRENT_PHOTO_UPLOAD_POLICY` | No | 20 MB | Active (alias) |
| `FUTURE_VIDEO_UPLOAD_POLICY` | Yes | 500 MB | NOT ACTIVE — Phase 10K |

### Permission scope levels

```
internal_only → customer_visible → marketing_candidate → marketing_approved
```

- **internal_only** (default): no external sharing
- **customer_visible**: completion report sharing allowed
- **marketing_candidate**: flagged for marketing, consent pending
- **marketing_approved**: all three gates passed — visibility + is_marketing_approved + consent = approved

`is_ai_training_excluded` is an orthogonal flag — it restricts AI training at any scope level.

### Capability registry

| Capability | Supported types | Available now | Phase |
|------------|-----------------|---------------|-------|
| preview | photo, video | Yes | Sprint 10I |
| download | photo, video | Yes | Sprint 10I |
| completion_report | photo, video | Yes | Sprint 10I |
| thumbnail | photo, video | No | Phase 10J |
| streaming | video | No | Phase 10K |
| ai_analysis | photo, video | No | Phase 71–72 |
| ai_marketing | photo, video | No | Phase 71–76 |
| customer_gallery | photo, video | No | Future |

### AI agent media interfaces

| Agent | Interface | Source |
|-------|-----------|--------|
| `marketing_agent` | `MediaForMarketingAgent` (= `MediaForMarketing`) | `getMediaForMarketingAgent()` |
| `reputation_agent` | `MediaForReputationAgent` | `getMediaForReputationAgent()` |
| `growth_agent` | `MediaForGrowthAgent` (aggregate counts only) | `buildMediaForGrowthAgent()` |

All AI access is gated by `checkMediaAICapability()` which enforces dealer isolation, consent status, and capability-specific rules.

### Usage pattern

```typescript
// Server-side route/action:
const ctx     = await createMediaContext();
if (!ctx) return { error: "Not authenticated" };

const runtime = MediaRuntime.withContext(ctx);

// Validate before upload:
const result = runtime.validate({ name: file.name, size: file.size, type: file.type });
if (!result.valid) return { error: result.errors[0].message };

// Check permission before sharing:
const gate = runtime.checkPermission(media);
if (!gate.can_include_in_completion_report) {
  return { error: gate.denial_reasons[0] };
}

// Check AI eligibility:
const aiGate = runtime.checkAICapability({
  capability: "ai_marketing",
  media,
  agent_id:  "marketing_agent",
  dealer_id: ctx.dealer_id,
});
```

---

## 10. Files Changed in Sprint 10I

| File | Change |
|------|--------|
| `src/lib/media/media-types.ts` | NEW — canonical media model, consent types, AI marketing interface |
| `src/lib/work-order-files/work-order-file-types.ts` | ADD — `isPhoto()`, `isVideo()`, `isMedia()` helpers |
| `src/components/completion-reports/CompletionReportPreview.tsx` | RENAME `PhotoSection` → `MediaSection`; add video thumbnail card |
| `src/components/work-orders/WorkOrderFiles.tsx` | USE `isPhoto()`/`isVideo()` from types; proper video card rendering |

---

## 11. Files Changed in Sprint 10J

| File | Change |
|------|--------|
| `src/lib/media/media-types.ts` | ADD — `MediaFileInput`, `MediaMetadata` types |
| `src/lib/media/media-context.ts` | NEW — `MediaContext` interface, `createMediaContext()` factory |
| `src/lib/media/media-validation.ts` | NEW — `MediaUploadPolicy`, `validateMediaFile()`, MIME helpers, policy constants |
| `src/lib/media/media-permission.ts` | NEW — `MediaPermissionScope`, `MediaPermissionGate`, `checkMediaPermission()`, `resolvePermissionScope()` |
| `src/lib/media/media-capability.ts` | NEW — `MediaCapabilityId`, `MEDIA_CAPABILITY_REGISTRY`, lookup helpers |
| `src/lib/media/media-video.ts` | NEW — future video upload/processing/streaming architecture, `VIDEO_INFRA_REQUIREMENTS` |
| `src/lib/media/media-ai.ts` | NEW — `MediaForAI`, AI gate types, `checkMediaAICapability()`, agent-specific builders |
| `src/lib/media/media-runtime.ts` | NEW — `MediaRuntime` class (validates, checks permissions, queries capabilities, gates AI) |
| `src/lib/media/index.ts` | NEW — public re-exports for `@/lib/media` |
| `docs/master_specification/MEDIA_ARCHITECTURE.md` | ADD — runtime section (§9), sprint 10J file list |
| `docs/master_specification/AI_MARKETING_AGENT_ROADMAP.md` | UPDATE — media-first interfaces referenced |

---

*GYEON Detailer Agent | Media Architecture | Office AZ | 2026-06-26*
