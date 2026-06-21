# Storage Verification Checklist — DealerOS / GYEON Detailer Agent

## Purpose

Verify Supabase Storage is correctly configured for PDF document storage before production deployment.

---

## 1. Bucket Setup

```
□ "documents" bucket exists in Supabase Storage
□ Bucket visibility is PRIVATE (not public)
□ Bucket name matches STORAGE_BUCKET env var (default: "documents")
```

**Steps:**
1. Go to Supabase Dashboard → Storage
2. Confirm "documents" bucket exists
3. Click on the bucket → Settings
4. Confirm "Public bucket" is DISABLED

---

## 2. Storage Policies

```sql
-- Verify storage policies exist
SELECT name, definition FROM storage.policies
WHERE bucket_id = 'documents';
```

```
□ Upload (INSERT) requires service_role or authenticated user with dealer_id path match
□ Read (SELECT) requires service_role for signed URL generation
□ No public read policy exists
□ Cross-dealer path access is denied
```

---

## 3. Path Pattern Enforcement

All PDF files must be stored at: `{dealer_id}/{type}/{filename}.pdf`

Where `type` is one of:
- `estimates`
- `work-orders`
- `completion-reports`
- `invoices`
- `product-orders`

```
□ Path pattern {dealer_id}/{type}/{filename}.pdf is enforced
□ Files cannot be uploaded outside of dealer_id prefix
□ Files cannot be read across dealer boundaries
```

---

## 4. PDF Upload Test

Test each document type:

```
□ Estimate PDF: generates and uploads successfully
□ Work Order PDF: generates and uploads successfully
□ Completion Report PDF: generates and uploads successfully
□ Invoice PDF: generates and uploads successfully
□ Product Order PDF: generates and uploads successfully
```

For each: verify the file appears in Supabase Storage → documents → {dealer_id}/ folder.

---

## 5. Signed URL Expiry

Signed URLs must expire (not be permanent):

```typescript
// In src/lib/pdf/pdf-storage.ts, confirm:
const { data } = await supabase.storage
  .from("documents")
  .createSignedUrl(path, 3600); // 1 hour expiry
```

```
□ Signed URLs have expiry (default: 1 hour)
□ Expired URLs return 403 (not cached/accessible)
□ Signed URL is returned to the client, not the file itself
```

---

## 6. document_files Table Sync

Every PDF upload must update the `document_files` table:

```sql
-- After generating a PDF, verify the record exists:
SELECT id, document_type, file_path, is_active, created_at
FROM document_files
WHERE document_id = '<your_document_id>'
ORDER BY created_at DESC;
```

```
□ document_files record created on each PDF generation
□ Previous active record archived (is_active = false) before new insert
□ file_path matches the actual Storage path
□ document_type matches the correct type
```

---

## 7. Cross-Dealer Access Denial

```
□ Dealer A's signed URL cannot be used by Dealer B's session
□ Direct file path access without signed URL returns 403
□ Dealer A cannot generate signed URL for Dealer B's file path
```

---

## 8. Storage Backup

```
□ Storage backup procedure documented (see docs/BACKUP_STORAGE.md)
□ Files in "documents" bucket inventoried
□ Backup download procedure tested
```

---

## See Also

- `docs/BACKUP_STORAGE.md`
- `docs/PRODUCTION_READINESS_CHECKLIST.md`
- `src/lib/pdf/pdf-storage.ts`
- `supabase/migrations/053_create_document_files.sql`
