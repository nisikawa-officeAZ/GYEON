# Document Storage Setup

This document describes how to manually set up the `documents` Storage bucket in Supabase.

**IMPORTANT:** Do NOT apply these steps automatically. Manual setup required.

---

## Step 1: Create the `documents` bucket

1. Go to your Supabase Dashboard → Storage
2. Click "New bucket"
3. Set:
   - **Name:** `documents`
   - **Public:** OFF (private)
   - **File size limit:** 50 MB
   - **Allowed MIME types:** `application/pdf`
4. Click "Create bucket"

---

## Step 2: Storage path convention

All PDF files are stored using this path pattern:

```
{dealer_id}/{document_type}/{document_number}.pdf
```

Examples:
- `abc123.../estimate/EST-2024001.pdf`
- `abc123.../invoice/INV-2024001.pdf`
- `abc123.../completion_report/RPT-2024001.pdf`
- `abc123.../product_order/PO-2024001.pdf`

---

## Step 3: Apply RLS policies (Storage)

In the Supabase SQL Editor, run the following to add RLS policies to the storage objects table:

```sql
-- Allow authenticated users to read files in their dealer folder
CREATE POLICY "documents_read_own_dealer"
ON storage.objects FOR SELECT
USING (
  bucket_id = 'documents'
  AND (storage.foldername(name))[1] IN (
    SELECT dealer_id::text FROM dealer_members
    WHERE user_id = auth.uid() AND status = 'active'
  )
);

-- Allow authenticated users to upload files to their dealer folder
CREATE POLICY "documents_insert_own_dealer"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'documents'
  AND (storage.foldername(name))[1] IN (
    SELECT dealer_id::text FROM dealer_members
    WHERE user_id = auth.uid() AND status = 'active'
  )
);

-- Allow authenticated users to update files in their dealer folder
CREATE POLICY "documents_update_own_dealer"
ON storage.objects FOR UPDATE
USING (
  bucket_id = 'documents'
  AND (storage.foldername(name))[1] IN (
    SELECT dealer_id::text FROM dealer_members
    WHERE user_id = auth.uid() AND status = 'active'
  )
);
```

Note: The application uses the service role key (admin client) for uploads, so storage RLS is a secondary defense layer.

---

## Step 4: Test signed URL generation

After setup, test with:

```sql
-- From Supabase SQL Editor, verify bucket exists
SELECT * FROM storage.buckets WHERE id = 'documents';
```

Then test from the app by generating any PDF. If the bucket is not found, you will see:

> Storage bucket 'documents' が作成されていません。DOCUMENT_STORAGE_SETUP.md を参照してください。

---

## Step 5: Apply database migration

Run the migration file to create the `document_files` tracking table:

```
supabase/migrations/053_create_document_files.sql
```

This can be applied via the Supabase CLI:

```bash
supabase db push
```

Or manually via the SQL Editor.
