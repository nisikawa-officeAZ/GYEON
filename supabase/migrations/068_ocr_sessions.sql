-- RC-02: Vehicle Registration OCR Sessions
-- DO NOT AUTO-APPLY — paste into Supabase SQL Editor manually.
-- File: supabase/migrations/068_ocr_sessions.sql
--
-- Purpose:
--   Introduces the vehicle_registration_ocr_sessions table to group OCR attempts
--   into a review workflow. One session = one vehicle-registration scan workflow.
--   Multiple file uploads may belong to one session (re-upload attempts).
--   On session completion the reviewed_result holds the user-corrected OCR data.
--
-- Depends on: 067_vehicle_registration_ocr.sql (vehicle_registration_files table)

-- ─── OCR Sessions table ───────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS vehicle_registration_ocr_sessions (
  id                uuid         PRIMARY KEY DEFAULT gen_random_uuid(),
  dealer_id         uuid         NOT NULL,

  -- Lifecycle status
  status            text         NOT NULL DEFAULT 'draft'
                    CHECK (status IN ('draft', 'processing', 'reviewing', 'completed', 'abandoned')),

  -- Optional link to customer/vehicle — set when session is completed
  customer_id       uuid         REFERENCES customers(id)  ON DELETE SET NULL,
  vehicle_id        uuid         REFERENCES vehicles(id)   ON DELETE SET NULL,

  -- The file chosen as the primary OCR source for this session
  primary_file_id   uuid         REFERENCES vehicle_registration_files(id) ON DELETE SET NULL,

  -- User-reviewed and manually corrected copy of the best OCR result
  reviewed_result   jsonb        NOT NULL DEFAULT '{}',

  -- Audit
  started_by        uuid,        -- auth.uid() of the user who initiated the session
  completed_by      uuid,        -- auth.uid() of the user who completed review
  completed_at      timestamptz,

  created_at        timestamptz  DEFAULT now(),
  updated_at        timestamptz  DEFAULT now()
);

-- ─── Add session_id to vehicle_registration_files ─────────────────────────────
-- Links individual file uploads to a parent session.
-- Existing rows will have session_id = NULL (pre-session records).

ALTER TABLE vehicle_registration_files
  ADD COLUMN IF NOT EXISTS session_id uuid
  REFERENCES vehicle_registration_ocr_sessions(id) ON DELETE SET NULL;

-- ─── Indexes ──────────────────────────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS ocr_sessions_dealer_id_idx
  ON vehicle_registration_ocr_sessions(dealer_id);

CREATE INDEX IF NOT EXISTS ocr_sessions_dealer_status_idx
  ON vehicle_registration_ocr_sessions(dealer_id, status);

CREATE INDEX IF NOT EXISTS ocr_sessions_customer_id_idx
  ON vehicle_registration_ocr_sessions(customer_id);

CREATE INDEX IF NOT EXISTS ocr_sessions_vehicle_id_idx
  ON vehicle_registration_ocr_sessions(vehicle_id);

CREATE INDEX IF NOT EXISTS ocr_sessions_created_at_idx
  ON vehicle_registration_ocr_sessions(created_at DESC);

CREATE INDEX IF NOT EXISTS vehicle_registration_files_session_id_idx
  ON vehicle_registration_files(session_id);

-- ─── updated_at trigger ───────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION update_ocr_sessions_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS set_ocr_sessions_updated_at
  ON vehicle_registration_ocr_sessions;

CREATE TRIGGER set_ocr_sessions_updated_at
  BEFORE UPDATE ON vehicle_registration_ocr_sessions
  FOR EACH ROW EXECUTE FUNCTION update_ocr_sessions_updated_at();

-- ─── Row Level Security ───────────────────────────────────────────────────────

ALTER TABLE vehicle_registration_ocr_sessions ENABLE ROW LEVEL SECURITY;

-- SELECT: dealer sees own sessions only
CREATE POLICY "ocr_sessions_select"
  ON vehicle_registration_ocr_sessions FOR SELECT
  USING (
    dealer_id IN (
      SELECT dealer_id FROM dealer_members
      WHERE user_id = auth.uid() AND status = 'active'
    )
  );

-- INSERT: dealer can create sessions scoped to own dealer_id only
CREATE POLICY "ocr_sessions_insert"
  ON vehicle_registration_ocr_sessions FOR INSERT
  WITH CHECK (
    dealer_id IN (
      SELECT dealer_id FROM dealer_members
      WHERE user_id = auth.uid() AND status = 'active'
    )
  );

-- UPDATE: dealer can update own sessions only
CREATE POLICY "ocr_sessions_update"
  ON vehicle_registration_ocr_sessions FOR UPDATE
  USING (
    dealer_id IN (
      SELECT dealer_id FROM dealer_members
      WHERE user_id = auth.uid() AND status = 'active'
    )
  );

-- DELETE: prohibited — abandon instead (status = 'abandoned')
-- No DELETE policy is intentionally omitted.
