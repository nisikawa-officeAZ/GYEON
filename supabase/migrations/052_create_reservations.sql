-- ── Reservations table ───────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS reservations (
  id                  uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  dealer_id           uuid        NOT NULL REFERENCES dealers(id) ON DELETE CASCADE,
  reservation_number  text,
  customer_id         uuid        REFERENCES customers(id) ON DELETE SET NULL,
  vehicle_id          uuid        REFERENCES vehicles(id) ON DELETE SET NULL,
  work_order_id       uuid        REFERENCES work_orders(id) ON DELETE SET NULL,
  reservation_date    date        NOT NULL,
  start_time          time,
  end_time            time,
  service_type        text        NOT NULL DEFAULT 'other'
                                  CHECK (service_type IN ('coating','maintenance','ppf','window','wheel','interior','other')),
  assigned_staff_id   uuid        REFERENCES dealer_staff(id) ON DELETE SET NULL,
  status              text        NOT NULL DEFAULT 'pending'
                                  CHECK (status IN ('pending','confirmed','completed','cancelled','no_show')),
  notes               text,
  -- Future calendar provider sync
  calendar_provider   text,
  external_event_id   text,
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now()
);

-- ── RLS ─────────────────────────────────────────────────────────────────────

ALTER TABLE reservations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "reservations_dealer_select" ON reservations
  FOR SELECT USING (
    dealer_id IN (
      SELECT dealer_id FROM dealer_members WHERE user_id = auth.uid() AND status = 'active'
    )
  );

CREATE POLICY "reservations_dealer_insert" ON reservations
  FOR INSERT WITH CHECK (
    dealer_id IN (
      SELECT dealer_id FROM dealer_members WHERE user_id = auth.uid() AND status = 'active'
    )
  );

CREATE POLICY "reservations_dealer_update" ON reservations
  FOR UPDATE USING (
    dealer_id IN (
      SELECT dealer_id FROM dealer_members WHERE user_id = auth.uid() AND status = 'active'
    )
  );

-- ── Extend document_sequences CHECK constraint ───────────────────────────────
-- Drop old constraint and recreate with 'reservation' added

ALTER TABLE document_sequences
  DROP CONSTRAINT IF EXISTS document_sequences_sequence_type_check;

ALTER TABLE document_sequences
  ADD CONSTRAINT document_sequences_sequence_type_check
  CHECK (sequence_type IN (
    'estimate','work_order','completion_report','invoice','payment',
    'maintenance_reminder','product_order','reservation'
  ));

-- ── Add next_maintenance_date to completion_reports ──────────────────────────

ALTER TABLE completion_reports
  ADD COLUMN IF NOT EXISTS next_maintenance_date date;
