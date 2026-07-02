-- Migration 092 — Work Bay Assignment (Batch B6b)
--
-- Adds the work_bays table (dealer-scoped bay definitions) and
-- reservations.work_bay_id (nullable FK). Backfills bays from the existing
-- dealer_settings.business_days.scheduling.capacity.work_bays jsonb (B3).
--
-- Safe/additive. Application code keeps all reads/writes gated behind
-- WORK_BAYS_SCHEMA_READY until an operator applies this migration and flips the
-- flag, so nothing breaks if this has not run yet.
--
-- dealer_id is always dealer-scoped; RLS mirrors dealer_staff (owner/manager writes).

-- ── work_bays table ───────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS work_bays (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  dealer_id   uuid        NOT NULL REFERENCES dealers(id) ON DELETE CASCADE,
  name        text        NOT NULL,
  active      boolean     NOT NULL DEFAULT true,
  capacity    integer     NOT NULL DEFAULT 1 CHECK (capacity >= 1 AND capacity <= 50),
  sort_order  integer     NOT NULL DEFAULT 0,
  legacy_ref  text,       -- original B3 jsonb bay id — for backfill reconciliation/idempotency
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS work_bays_dealer_idx ON work_bays(dealer_id);
CREATE UNIQUE INDEX IF NOT EXISTS work_bays_dealer_legacy_uk
  ON work_bays(dealer_id, legacy_ref) WHERE legacy_ref IS NOT NULL;

-- ── RLS (mirror dealer_staff) ─────────────────────────────────────────────────

ALTER TABLE work_bays ENABLE ROW LEVEL SECURITY;

CREATE POLICY "work_bays_select" ON work_bays
  FOR SELECT USING (
    dealer_id IN (
      SELECT dealer_id FROM dealer_members WHERE user_id = auth.uid() AND status = 'active'
    )
    OR dealer_id IN (
      SELECT id FROM dealers WHERE owner_user_id = auth.uid()
    )
  );

CREATE POLICY "work_bays_insert" ON work_bays
  FOR INSERT WITH CHECK (
    dealer_id IN (
      SELECT dealer_id FROM dealer_members
       WHERE user_id = auth.uid() AND status = 'active' AND role IN ('owner','manager')
    )
    OR dealer_id IN (
      SELECT id FROM dealers WHERE owner_user_id = auth.uid()
    )
  );

CREATE POLICY "work_bays_update" ON work_bays
  FOR UPDATE USING (
    dealer_id IN (
      SELECT dealer_id FROM dealer_members
       WHERE user_id = auth.uid() AND status = 'active' AND role IN ('owner','manager')
    )
    OR dealer_id IN (
      SELECT id FROM dealers WHERE owner_user_id = auth.uid()
    )
  );

CREATE POLICY "work_bays_delete" ON work_bays
  FOR DELETE USING (
    dealer_id IN (
      SELECT dealer_id FROM dealer_members
       WHERE user_id = auth.uid() AND status = 'active' AND role IN ('owner','manager')
    )
    OR dealer_id IN (
      SELECT id FROM dealers WHERE owner_user_id = auth.uid()
    )
  );

-- ── reservations.work_bay_id ──────────────────────────────────────────────────

ALTER TABLE reservations
  ADD COLUMN IF NOT EXISTS work_bay_id uuid REFERENCES work_bays(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS reservations_work_bay_idx ON reservations(work_bay_id);

-- ── Backfill from B3 jsonb bay definitions (idempotent) ───────────────────────

INSERT INTO work_bays (dealer_id, name, active, capacity, legacy_ref)
SELECT ds.dealer_id,
       btrim(bay->>'name'),
       COALESCE((bay->>'active')::boolean, true),
       GREATEST(1, LEAST(50, COALESCE((bay->>'capacity')::int, 1))),
       bay->>'id'
FROM dealer_settings ds,
     LATERAL jsonb_array_elements(
       COALESCE(ds.business_days->'scheduling'->'capacity'->'work_bays', '[]'::jsonb)
     ) AS bay
WHERE btrim(COALESCE(bay->>'name','')) <> ''
  AND NOT EXISTS (
    SELECT 1 FROM work_bays wb
    WHERE wb.dealer_id = ds.dealer_id AND wb.legacy_ref = bay->>'id'
  );

-- ── ROLLBACK (for reference — run manually if reverting) ───────────────────────
-- DROP INDEX IF EXISTS reservations_work_bay_idx;
-- ALTER TABLE reservations DROP COLUMN IF EXISTS work_bay_id;  -- destroys assignments
-- DROP TABLE IF EXISTS work_bays;                              -- destroys bay definitions
