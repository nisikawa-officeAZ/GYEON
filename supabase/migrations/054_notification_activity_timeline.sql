-- ── activity_logs ────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS activity_logs (
  id             uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  dealer_id      uuid        NOT NULL REFERENCES dealers(id) ON DELETE CASCADE,
  actor_user_id  uuid        REFERENCES auth.users(id) ON DELETE SET NULL,
  entity_type    text        NOT NULL
                             CHECK (entity_type IN (
                               'customer','vehicle','estimate','work_order',
                               'completion_report','invoice','payment',
                               'product_order','reservation','line_message','document_file'
                             )),
  entity_id      uuid        NOT NULL,
  customer_id    uuid        REFERENCES customers(id) ON DELETE SET NULL,
  action         text        NOT NULL
                             CHECK (action IN (
                               'created','updated','deleted','generated_pdf',
                               'archived_pdf','sent_line','scheduled',
                               'completed','paid','cancelled'
                             )),
  title          text        NOT NULL,
  description    text,
  metadata       jsonb       NOT NULL DEFAULT '{}',
  created_at     timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_activity_logs_dealer_id
  ON activity_logs(dealer_id);
CREATE INDEX IF NOT EXISTS idx_activity_logs_customer_id
  ON activity_logs(customer_id);
CREATE INDEX IF NOT EXISTS idx_activity_logs_entity
  ON activity_logs(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_activity_logs_created_at
  ON activity_logs(created_at DESC);

ALTER TABLE activity_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "activity_logs_dealer_select" ON activity_logs
  FOR SELECT USING (
    dealer_id IN (
      SELECT dealer_id FROM dealer_members
       WHERE user_id = auth.uid() AND status = 'active'
    )
  );

CREATE POLICY "activity_logs_dealer_insert" ON activity_logs
  FOR INSERT WITH CHECK (
    dealer_id IN (
      SELECT dealer_id FROM dealer_members
       WHERE user_id = auth.uid() AND status = 'active'
    )
  );

-- No DELETE / UPDATE policies — logs are immutable

-- ── notifications ────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS notifications (
  id           uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  dealer_id    uuid        NOT NULL REFERENCES dealers(id) ON DELETE CASCADE,
  user_id      uuid        REFERENCES auth.users(id) ON DELETE CASCADE,
  type         text        NOT NULL
               CHECK (type IN ('info','success','warning','error','reminder')),
  title        text        NOT NULL,
  message      text,
  entity_type  text,
  entity_id    uuid,
  customer_id  uuid        REFERENCES customers(id) ON DELETE SET NULL,
  is_read      boolean     NOT NULL DEFAULT false,
  read_at      timestamptz,
  created_at   timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_notifications_dealer_id
  ON notifications(dealer_id);
CREATE INDEX IF NOT EXISTS idx_notifications_user_id
  ON notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_is_read
  ON notifications(is_read);
CREATE INDEX IF NOT EXISTS idx_notifications_created_at
  ON notifications(created_at DESC);

ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

-- Users can only see their own notifications (or dealer-wide if user_id is null)
CREATE POLICY "notifications_select" ON notifications
  FOR SELECT USING (
    dealer_id IN (
      SELECT dealer_id FROM dealer_members
       WHERE user_id = auth.uid() AND status = 'active'
    )
    AND (user_id IS NULL OR user_id = auth.uid())
  );

CREATE POLICY "notifications_insert" ON notifications
  FOR INSERT WITH CHECK (
    dealer_id IN (
      SELECT dealer_id FROM dealer_members
       WHERE user_id = auth.uid() AND status = 'active'
    )
  );

CREATE POLICY "notifications_update" ON notifications
  FOR UPDATE USING (
    dealer_id IN (
      SELECT dealer_id FROM dealer_members
       WHERE user_id = auth.uid() AND status = 'active'
    )
    AND (user_id IS NULL OR user_id = auth.uid())
  );
