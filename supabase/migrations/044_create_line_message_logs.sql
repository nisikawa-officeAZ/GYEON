-- DealerOS — PHASE47: LINE Message Logs & Notification Queue
-- PASTE AND RUN MANUALLY in Supabase SQL Editor.
-- DO NOT auto-apply.

-- ─── line_message_logs ────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS line_message_logs (
  id               uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  dealer_id        uuid        NOT NULL REFERENCES dealers(id) ON DELETE CASCADE,
  customer_id      uuid        REFERENCES customers(id)        ON DELETE SET NULL,
  line_customer_id uuid        REFERENCES line_customers(id)   ON DELETE SET NULL,
  line_user_id     text,
  message_type     text,       -- text | image | template | flex
  purpose          text        NOT NULL DEFAULT 'manual',
  title            text,
  body             text,
  payload          jsonb,      -- full LINE message payload
  status           text        NOT NULL DEFAULT 'pending'
                               CHECK (status IN ('pending','sent','failed','cancelled')),
  sent_at          timestamptz,
  failed_at        timestamptz,
  error_message    text,
  retry_count      integer     NOT NULL DEFAULT 0,
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now()
);

COMMENT ON COLUMN line_message_logs.purpose IS
  'manual | completion_report | maintenance_reminder | reservation | campaign | system';

-- ─── line_notification_queue ──────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS line_notification_queue (
  id               uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  dealer_id        uuid        NOT NULL REFERENCES dealers(id) ON DELETE CASCADE,
  customer_id      uuid        REFERENCES customers(id)        ON DELETE SET NULL,
  line_customer_id uuid        REFERENCES line_customers(id)   ON DELETE SET NULL,
  scheduled_at     timestamptz NOT NULL,
  message_type     text        NOT NULL DEFAULT 'text',
  purpose          text        NOT NULL DEFAULT 'manual',
  title            text,
  body             text        NOT NULL,
  payload          jsonb,
  status           text        NOT NULL DEFAULT 'scheduled'
                               CHECK (status IN ('scheduled','processing','sent','failed','cancelled')),
  attempts         integer     NOT NULL DEFAULT 0,
  last_attempt_at  timestamptz,
  sent_log_id      uuid        REFERENCES line_message_logs(id) ON DELETE SET NULL,
  error_message    text,
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now()
);

-- ─── Indexes ──────────────────────────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_line_message_logs_dealer_id   ON line_message_logs(dealer_id);
CREATE INDEX IF NOT EXISTS idx_line_message_logs_customer_id ON line_message_logs(customer_id);
CREATE INDEX IF NOT EXISTS idx_line_message_logs_status      ON line_message_logs(status);
CREATE INDEX IF NOT EXISTS idx_line_message_logs_purpose     ON line_message_logs(purpose);
CREATE INDEX IF NOT EXISTS idx_line_message_logs_sent_at     ON line_message_logs(sent_at);

CREATE INDEX IF NOT EXISTS idx_line_notification_queue_dealer_id    ON line_notification_queue(dealer_id);
CREATE INDEX IF NOT EXISTS idx_line_notification_queue_status       ON line_notification_queue(status);
CREATE INDEX IF NOT EXISTS idx_line_notification_queue_scheduled_at ON line_notification_queue(scheduled_at);

-- ─── RLS ──────────────────────────────────────────────────────────────────────

ALTER TABLE line_message_logs       ENABLE ROW LEVEL SECURITY;
ALTER TABLE line_notification_queue ENABLE ROW LEVEL SECURITY;

-- line_message_logs: dealer members only
CREATE POLICY "Dealer members can manage their line_message_logs"
  ON line_message_logs
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

-- line_notification_queue: dealer members only
CREATE POLICY "Dealer members can manage their line_notification_queue"
  ON line_notification_queue
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
