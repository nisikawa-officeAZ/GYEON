-- PHASE58: Subscription & License Management
-- DO NOT AUTO-APPLY — paste into Supabase SQL Editor manually.
-- Apply AFTER migration 055 (audit_logs).

-- ─── subscription_plans ───────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS subscription_plans (
  id            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  code          text        NOT NULL UNIQUE,
  name          text        NOT NULL,
  description   text,
  monthly_price integer     NOT NULL DEFAULT 0,
  yearly_price  integer     NOT NULL DEFAULT 0,
  currency      text        NOT NULL DEFAULT 'JPY',
  is_active     boolean     NOT NULL DEFAULT true,
  features      jsonb       NOT NULL DEFAULT '{}',
  limits        jsonb       NOT NULL DEFAULT '{}',
  sort_order    integer     NOT NULL DEFAULT 0,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);

-- ─── dealer_subscriptions ─────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS dealer_subscriptions (
  id                         uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  dealer_id                  uuid        NOT NULL REFERENCES dealers(id) ON DELETE CASCADE,
  plan_code                  text        NOT NULL REFERENCES subscription_plans(code),
  status                     text        NOT NULL CHECK (status IN ('trial','active','past_due','suspended','cancelled')),
  trial_started_at           timestamptz,
  trial_ends_at              timestamptz,
  current_period_started_at  timestamptz,
  current_period_ends_at     timestamptz,
  cancelled_at               timestamptz,
  suspended_at               timestamptz,
  notes                      text,
  created_at                 timestamptz NOT NULL DEFAULT now(),
  updated_at                 timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS dealer_subscriptions_dealer_id_idx       ON dealer_subscriptions(dealer_id);
CREATE INDEX IF NOT EXISTS dealer_subscriptions_plan_code_idx       ON dealer_subscriptions(plan_code);
CREATE INDEX IF NOT EXISTS dealer_subscriptions_status_idx          ON dealer_subscriptions(status);
CREATE INDEX IF NOT EXISTS dealer_subscriptions_period_ends_idx     ON dealer_subscriptions(current_period_ends_at);

-- ─── RLS ──────────────────────────────────────────────────────────────────────

ALTER TABLE subscription_plans    ENABLE ROW LEVEL SECURITY;
ALTER TABLE dealer_subscriptions  ENABLE ROW LEVEL SECURITY;

-- subscription_plans: any authenticated user can read active plans
CREATE POLICY "plans_select_authenticated" ON subscription_plans
  FOR SELECT TO authenticated
  USING (is_active = true);

-- dealer_subscriptions: dealer members can read their own subscription
CREATE POLICY "dealer_subscriptions_select_own" ON dealer_subscriptions
  FOR SELECT TO authenticated
  USING (
    dealer_id IN (
      SELECT dealer_id FROM dealer_members
      WHERE user_id = auth.uid() AND status = 'active'
    )
  );

-- INSERT / UPDATE / DELETE: service_role only (no dealer-side mutation policies)

-- ─── Extend audit_logs action CHECK constraint ────────────────────────────────

-- Add feature_access_denied to the allowed action values.
ALTER TABLE audit_logs DROP CONSTRAINT IF EXISTS audit_logs_action_check;
ALTER TABLE audit_logs ADD CONSTRAINT audit_logs_action_check
  CHECK (action IN (
    'create','update','delete','archive','restore',
    'export','login','logout','change_role',
    'generate_pdf','download_pdf','send_line',
    'create_staff','delete_staff',
    'feature_access_denied'
  ));

-- ─── Seed: subscription_plans ─────────────────────────────────────────────────

INSERT INTO subscription_plans
  (code, name, description, monthly_price, yearly_price, currency, sort_order, features, limits)
VALUES
  (
    'basic',
    'Basic',
    'GYEON Detailer Agent スタンダードプラン',
    0, 0, 'JPY', 1,
    '{
      "customers": true,
      "vehicles": true,
      "estimates": true,
      "pdf_preview": true,
      "product_orders": true
    }'::jsonb,
    '{
      "staff": 1,
      "monthly_pdf_generations": 30,
      "monthly_line_messages": 0,
      "reservations": false,
      "work_orders": false,
      "invoices": false,
      "maintenance_reminders": false,
      "line_integration": false
    }'::jsonb
  ),
  (
    'pro',
    'Pro',
    'GYEON Detailer Agent プロプラン',
    0, 12000, 'JPY', 2,
    '{
      "customers": true,
      "vehicles": true,
      "estimates": true,
      "pdf_preview": true,
      "product_orders": true,
      "work_orders": true,
      "completion_reports": true,
      "invoices": true,
      "payments": true,
      "reservations": true,
      "maintenance_reminders": true
    }'::jsonb,
    '{
      "staff": 3,
      "monthly_pdf_generations": 300,
      "monthly_line_messages": 0,
      "reservations": true,
      "work_orders": true,
      "invoices": true,
      "maintenance_reminders": true,
      "line_integration": false
    }'::jsonb
  ),
  (
    'pro_plus',
    'Pro Plus',
    'GYEON Detailer Agent プロプラスプラン',
    0, 0, 'JPY', 3,
    '{
      "customers": true,
      "vehicles": true,
      "estimates": true,
      "pdf_preview": true,
      "product_orders": true,
      "work_orders": true,
      "completion_reports": true,
      "invoices": true,
      "payments": true,
      "reservations": true,
      "maintenance_reminders": true,
      "line_integration": true,
      "line_messages": true,
      "automatic_reminders": true,
      "advanced_notifications": true
    }'::jsonb,
    '{
      "staff": 10,
      "monthly_pdf_generations": 1000,
      "monthly_line_messages": 1000,
      "reservations": true,
      "work_orders": true,
      "invoices": true,
      "maintenance_reminders": true,
      "line_integration": true
    }'::jsonb
  )
ON CONFLICT (code) DO NOTHING;
