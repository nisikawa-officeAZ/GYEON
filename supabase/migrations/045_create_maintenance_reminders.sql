-- DealerOS — PHASE48: Maintenance Reminders
-- PASTE AND RUN MANUALLY in Supabase SQL Editor.
-- DO NOT auto-apply.

CREATE TABLE IF NOT EXISTS maintenance_reminders (
  id                 uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  dealer_id          uuid        NOT NULL REFERENCES dealers(id)       ON DELETE CASCADE,
  customer_id        uuid        NOT NULL REFERENCES customers(id)     ON DELETE CASCADE,
  vehicle_id         uuid                 REFERENCES vehicles(id)      ON DELETE SET NULL,
  work_order_id      uuid                 REFERENCES work_orders(id)   ON DELETE SET NULL,
  reminder_number    text,
  title              text,
  reminder_type      text        NOT NULL DEFAULT 'maintenance'
                                 CHECK (reminder_type IN ('maintenance','coating_check','ppf_check','inspection','custom')),
  status             text        NOT NULL DEFAULT 'scheduled'
                                 CHECK (status IN ('scheduled','queued','sent','completed','cancelled','failed')),
  due_date           date,
  scheduled_send_at  timestamptz,
  sent_at            timestamptz,
  line_queue_id      uuid        REFERENCES line_notification_queue(id) ON DELETE SET NULL,
  message_title      text,
  message_body       text,
  notes              text,
  internal_memo      text,
  created_at         timestamptz NOT NULL DEFAULT now(),
  updated_at         timestamptz NOT NULL DEFAULT now()
);

-- ─── Indexes ──────────────────────────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_maintenance_reminders_dealer_id       ON maintenance_reminders(dealer_id);
CREATE INDEX IF NOT EXISTS idx_maintenance_reminders_customer_id     ON maintenance_reminders(customer_id);
CREATE INDEX IF NOT EXISTS idx_maintenance_reminders_vehicle_id      ON maintenance_reminders(vehicle_id);
CREATE INDEX IF NOT EXISTS idx_maintenance_reminders_work_order_id   ON maintenance_reminders(work_order_id);
CREATE INDEX IF NOT EXISTS idx_maintenance_reminders_status          ON maintenance_reminders(status);
CREATE INDEX IF NOT EXISTS idx_maintenance_reminders_due_date        ON maintenance_reminders(due_date);
CREATE INDEX IF NOT EXISTS idx_maintenance_reminders_scheduled_send  ON maintenance_reminders(scheduled_send_at);

-- ─── RLS ──────────────────────────────────────────────────────────────────────

ALTER TABLE maintenance_reminders ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Dealer members can manage their maintenance_reminders"
  ON maintenance_reminders
  FOR ALL
  USING (
    dealer_id IN (
      SELECT dealer_id FROM dealer_members WHERE user_id = auth.uid()
    )
  )
  WITH CHECK (
    dealer_id IN (
      SELECT dealer_id FROM dealer_members WHERE user_id = auth.uid()
    )
  );
