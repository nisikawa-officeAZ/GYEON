-- document_files: tracks all generated PDF files per document
CREATE TABLE IF NOT EXISTS document_files (
  id                    uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  dealer_id             uuid        NOT NULL REFERENCES dealers(id) ON DELETE CASCADE,
  document_type         text        NOT NULL
                                    CHECK (document_type IN (
                                      'estimate','completion_report','invoice','product_order'
                                    )),
  document_id           uuid        NOT NULL,
  file_name             text        NOT NULL,
  file_path             text        NOT NULL,
  public_url            text,
  signed_url_expires_at timestamptz,
  file_size             bigint,
  mime_type             text        NOT NULL DEFAULT 'application/pdf',
  status                text        NOT NULL DEFAULT 'active'
                                    CHECK (status IN ('active','archived','deleted')),
  created_at            timestamptz NOT NULL DEFAULT now(),
  updated_at            timestamptz NOT NULL DEFAULT now()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_document_files_dealer_id
  ON document_files(dealer_id);
CREATE INDEX IF NOT EXISTS idx_document_files_document
  ON document_files(document_type, document_id);
CREATE INDEX IF NOT EXISTS idx_document_files_status
  ON document_files(status);

-- RLS
ALTER TABLE document_files ENABLE ROW LEVEL SECURITY;

CREATE POLICY "document_files_dealer_select" ON document_files
  FOR SELECT USING (
    dealer_id IN (
      SELECT dealer_id FROM dealer_members WHERE user_id = auth.uid() AND status = 'active'
    )
  );

CREATE POLICY "document_files_dealer_insert" ON document_files
  FOR INSERT WITH CHECK (
    dealer_id IN (
      SELECT dealer_id FROM dealer_members WHERE user_id = auth.uid() AND status = 'active'
    )
  );

CREATE POLICY "document_files_dealer_update" ON document_files
  FOR UPDATE USING (
    dealer_id IN (
      SELECT dealer_id FROM dealer_members WHERE user_id = auth.uid() AND status = 'active'
    )
  );

-- No DELETE policy — use status='deleted' instead

-- ── Storage bucket setup (do NOT execute automatically) ─────────────────────
-- See docs/DOCUMENT_STORAGE_SETUP.md for manual setup instructions
-- Bucket: documents (private, 50MB max file size)
