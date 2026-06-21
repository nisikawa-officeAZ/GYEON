-- Admin users (GYEON Japan / Office Az staff only)
CREATE TABLE IF NOT EXISTS admin_users (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  email       text,
  name        text,
  role        text NOT NULL DEFAULT 'super_admin'
              CHECK (role IN ('super_admin')),
  status      text NOT NULL DEFAULT 'active'
              CHECK (status IN ('active','disabled')),
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id)
);

-- Audit log for all admin actions
CREATE TABLE IF NOT EXISTS admin_audit_logs (
  id               uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_user_id    uuid        REFERENCES admin_users(id),
  target_user_id   uuid,
  target_dealer_id uuid,
  action           text        NOT NULL,
  details          jsonb       DEFAULT '{}',
  created_at       timestamptz NOT NULL DEFAULT now()
);

-- RLS for admin_users: only the user can read their own record
ALTER TABLE admin_users ENABLE ROW LEVEL SECURITY;
CREATE POLICY "admin_users_self_select" ON admin_users
  FOR SELECT USING (user_id = auth.uid());

-- RLS for admin_audit_logs: admin users can read logs
ALTER TABLE admin_audit_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "audit_logs_admin_select" ON admin_audit_logs
  FOR SELECT USING (
    admin_user_id IN (SELECT id FROM admin_users WHERE user_id = auth.uid())
  );
-- INSERT via service_role only (no user-facing INSERT policy)
