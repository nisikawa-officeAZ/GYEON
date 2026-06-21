-- dealer-scoped audit log for business operations
-- IMMUTABLE: INSERT + SELECT only (no UPDATE, no DELETE)
CREATE TABLE IF NOT EXISTS audit_logs (
  id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  dealer_id       uuid        NOT NULL REFERENCES dealers(id) ON DELETE CASCADE,
  actor_user_id   uuid        REFERENCES auth.users(id) ON DELETE SET NULL,
  actor_email     text,
  actor_role      text,
  action          text        NOT NULL
                              CHECK (action IN (
                                'create','update','delete','archive','restore',
                                'export','login','logout','change_role',
                                'generate_pdf','download_pdf','send_line',
                                'create_staff','delete_staff'
                              )),
  resource_type   text        NOT NULL
                              CHECK (resource_type IN (
                                'customer','vehicle','estimate','work_order',
                                'completion_report','invoice','payment',
                                'product_order','reservation','staff','role',
                                'dealer_setting','document','super_admin'
                              )),
  resource_id     uuid,
  old_value       jsonb,
  new_value       jsonb,
  ip_address      text,
  user_agent      text,
  created_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_audit_logs_dealer_id
  ON audit_logs(dealer_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_resource_type
  ON audit_logs(resource_type);
CREATE INDEX IF NOT EXISTS idx_audit_logs_actor_user_id
  ON audit_logs(actor_user_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at
  ON audit_logs(created_at DESC);

ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;

-- SELECT: dealer members only see their own dealer's logs
CREATE POLICY "audit_logs_dealer_select" ON audit_logs
  FOR SELECT USING (
    dealer_id IN (
      SELECT dealer_id FROM dealer_members
       WHERE user_id = auth.uid() AND status = 'active'
    )
  );

-- INSERT: dealer members only (service_role bypasses RLS for admin operations)
CREATE POLICY "audit_logs_dealer_insert" ON audit_logs
  FOR INSERT WITH CHECK (
    dealer_id IN (
      SELECT dealer_id FROM dealer_members
       WHERE user_id = auth.uid() AND status = 'active'
    )
  );

-- NO UPDATE policy — immutable
-- NO DELETE policy — immutable
