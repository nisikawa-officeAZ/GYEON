-- PHASE67: Vehicle Registration AI OCR
-- DO NOT AUTO-APPLY — paste into Supabase SQL Editor manually.
-- File: supabase/migrations/067_vehicle_registration_ocr.sql

-- ─── Table ────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS vehicle_registration_files (
  id                 uuid              PRIMARY KEY DEFAULT gen_random_uuid(),
  dealer_id          uuid              NOT NULL,
  customer_id        uuid              REFERENCES customers(id)  ON DELETE SET NULL,
  vehicle_id         uuid              REFERENCES vehicles(id)   ON DELETE SET NULL,
  estimate_id        uuid              REFERENCES estimates(id)  ON DELETE SET NULL,

  -- Storage
  storage_bucket     text              NOT NULL DEFAULT 'vehicle-registration-documents',
  storage_path       text              NOT NULL,
  file_name          text              NOT NULL,
  file_size          bigint,
  mime_type          text,

  -- OCR
  ocr_provider       text,
  ocr_model          text,
  ocr_status         text              NOT NULL DEFAULT 'pending'
                     CHECK (ocr_status IN ('pending','processing','completed','failed','confirmed','archived')),
  ocr_result         jsonb             DEFAULT '{}',
  ocr_confidence     numeric(4,3),

  -- Confirmation
  confirmed          boolean           DEFAULT false,
  confirmed_by       uuid,
  confirmed_at       timestamptz,

  -- Uploader
  uploaded_by        uuid,

  -- Archive
  archived_at        timestamptz,

  created_at         timestamptz       DEFAULT now(),
  updated_at         timestamptz       DEFAULT now()
);

-- ─── Indexes ──────────────────────────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS vehicle_registration_files_dealer_id_idx
  ON vehicle_registration_files(dealer_id);

CREATE INDEX IF NOT EXISTS vehicle_registration_files_customer_id_idx
  ON vehicle_registration_files(customer_id);

CREATE INDEX IF NOT EXISTS vehicle_registration_files_vehicle_id_idx
  ON vehicle_registration_files(vehicle_id);

CREATE INDEX IF NOT EXISTS vehicle_registration_files_estimate_id_idx
  ON vehicle_registration_files(estimate_id);

CREATE INDEX IF NOT EXISTS vehicle_registration_files_ocr_status_idx
  ON vehicle_registration_files(ocr_status);

CREATE INDEX IF NOT EXISTS vehicle_registration_files_created_at_idx
  ON vehicle_registration_files(created_at DESC);

-- ─── updated_at trigger ───────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION update_vehicle_registration_files_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS set_vehicle_registration_files_updated_at
  ON vehicle_registration_files;

CREATE TRIGGER set_vehicle_registration_files_updated_at
  BEFORE UPDATE ON vehicle_registration_files
  FOR EACH ROW EXECUTE FUNCTION update_vehicle_registration_files_updated_at();

-- ─── RLS ──────────────────────────────────────────────────────────────────────

ALTER TABLE vehicle_registration_files ENABLE ROW LEVEL SECURITY;

-- SELECT: dealer can see own rows only
CREATE POLICY "vehicle_registration_files_select"
  ON vehicle_registration_files FOR SELECT
  USING (
    dealer_id IN (
      SELECT dealer_id FROM dealer_members
      WHERE user_id = auth.uid() AND status = 'active'
    )
  );

-- INSERT: dealer can insert own rows only
CREATE POLICY "vehicle_registration_files_insert"
  ON vehicle_registration_files FOR INSERT
  WITH CHECK (
    dealer_id IN (
      SELECT dealer_id FROM dealer_members
      WHERE user_id = auth.uid() AND status = 'active'
    )
  );

-- UPDATE: dealer can update own rows only
CREATE POLICY "vehicle_registration_files_update"
  ON vehicle_registration_files FOR UPDATE
  USING (
    dealer_id IN (
      SELECT dealer_id FROM dealer_members
      WHERE user_id = auth.uid() AND status = 'active'
    )
  );

-- DELETE: prohibited (archive instead)
-- No DELETE policy is intentionally omitted.

-- ─── Storage bucket note ──────────────────────────────────────────────────────
-- Bucket: vehicle-registration-documents
-- Must be created manually in Supabase Dashboard > Storage.
-- Settings: Private (no public access). Signed URLs only.
-- See docs/VEHICLE_REGISTRATION_STORAGE_SETUP.md for instructions.
