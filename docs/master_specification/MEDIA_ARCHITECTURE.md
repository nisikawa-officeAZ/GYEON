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

## 9. Files Changed in Sprint 10I

| File | Change |
|------|--------|
| `src/lib/media/media-types.ts` | NEW — canonical media model, consent types, AI marketing interface |
| `src/lib/work-order-files/work-order-file-types.ts` | ADD — `isPhoto()`, `isVideo()`, `isMedia()` helpers |
| `src/components/completion-reports/CompletionReportPreview.tsx` | RENAME `PhotoSection` → `MediaSection`; add video thumbnail card |
| `src/components/work-orders/WorkOrderFiles.tsx` | USE `isPhoto()`/`isVideo()` from types; proper video card rendering |

---

*GYEON Detailer Agent | Media Architecture | Office AZ | 2026-06-26*
