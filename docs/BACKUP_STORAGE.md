# Storage Backup — DealerOS / GYEON Detailer Agent

## Overview

Supabase Storage holds all generated PDF documents (estimates, work orders,
completion reports, invoices). This document explains how to back up and
restore the `documents` bucket.

---

## 1. Storage Architecture

| Item | Detail |
|---|---|
| Bucket | `documents` (private) |
| Path pattern | `{dealer_id}/{document_type}/{document_number}.pdf` |
| Access | Signed URLs only (server-side via service_role) |
| Metadata | Tracked in `document_files` table (DB) |

Document types: `estimate`, `work_order`, `completion_report`, `invoice`,
`payment`, `maintenance_reminder`, `product_order`

---

## 2. Download All Files (Supabase CLI)

```bash
# Install Supabase CLI if needed
npm install -g supabase

# Login
supabase login

# Link to your project
supabase link --project-ref $PROJECT_REF

# Download entire documents bucket
mkdir -p storage_backup_$(date +%Y%m%d)
supabase storage cp \
  --recursive \
  ss://documents/ \
  ./storage_backup_$(date +%Y%m%d)/
```

---

## 3. Manual Download via API

```bash
export SUPABASE_URL="https://[PROJECT_REF].supabase.co"
export SERVICE_ROLE_KEY="[SUPABASE_SERVICE_ROLE_KEY]"

# List all objects in bucket
curl "$SUPABASE_URL/storage/v1/object/list/documents" \
  -H "Authorization: Bearer $SERVICE_ROLE_KEY" \
  -H "Content-Type: application/json" \
  -d '{"prefix":"","limit":1000}' \
  | jq '.[].name'
```

For large buckets (>1000 files), paginate using the `offset` parameter.

---

## 4. Verify Backup Completeness

Cross-reference downloaded files with `document_files` table:

```sql
-- Count active PDFs per document type
SELECT document_type, COUNT(*) AS count
FROM document_files
WHERE status = 'active'
GROUP BY document_type
ORDER BY document_type;
```

Compare these counts against files in the downloaded backup directory:

```bash
find storage_backup_YYYYMMDD/ -name "*.pdf" | wc -l
```

---

## 5. Restore to New Bucket

```bash
# Upload all backed-up files to new Supabase project
supabase storage cp \
  --recursive \
  ./storage_backup_YYYYMMDD/ \
  ss://documents/
```

After upload, verify signed URL generation works:

```bash
curl -X POST "$SUPABASE_URL/storage/v1/object/sign/documents/[DEALER_ID]/[TYPE]/[FILE].pdf" \
  -H "Authorization: Bearer $SERVICE_ROLE_KEY" \
  -H "Content-Type: application/json" \
  -d '{"expiresIn": 60}'
```

---

## 6. Bucket Policy (Re-apply on Restore)

If restoring to a fresh Supabase project, recreate the bucket policy:

```sql
-- Run in Supabase SQL Editor
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'documents',
  'documents',
  false,                  -- private bucket
  52428800,               -- 50 MB limit
  ARRAY['application/pdf']
)
ON CONFLICT (id) DO NOTHING;

-- RLS: only service_role can access (enforced in code)
```

---

## 7. Archival Strategy

Old PDF versions are automatically archived by `generateAndUploadPdf()`:
- Previous `active` record is set to `status = 'archived'`
- New record is inserted as `status = 'active'`
- Both files remain in Storage for audit purposes

When backing up, include **all** files (active + archived) for complete audit trail.

---

## See Also

- `docs/BACKUP_DATABASE.md` — database backup procedures
- `docs/DISASTER_RECOVERY.md` — full recovery runbook
- `docs/DOCUMENT_STORAGE_SETUP.md` — initial bucket setup guide
