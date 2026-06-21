-- PHASE59: Dealer Onboarding / Initial Setup Wizard
-- DO NOT AUTO-APPLY — paste into Supabase SQL Editor manually.
-- Apply AFTER migration 058 (subscription_license_management).

-- ─── Add onboarding + document settings columns to dealer_settings ────────────

ALTER TABLE dealer_settings
  ADD COLUMN IF NOT EXISTS onboarding_completed    boolean     NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS onboarding_completed_at timestamptz,
  ADD COLUMN IF NOT EXISTS onboarding_step         integer     NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS stamp_url               text,
  ADD COLUMN IF NOT EXISTS pdf_footer              text,
  ADD COLUMN IF NOT EXISTS invoice_note            text,
  ADD COLUMN IF NOT EXISTS completion_note         text,
  ADD COLUMN IF NOT EXISTS tax_rate                numeric     NOT NULL DEFAULT 10,
  ADD COLUMN IF NOT EXISTS business_website        text,
  ADD COLUMN IF NOT EXISTS terms_and_conditions    text;

-- Mark ALL EXISTING dealers as having already completed onboarding.
-- They are already using the system — skip the wizard for them.
UPDATE dealer_settings
SET
  onboarding_completed    = true,
  onboarding_completed_at = now(),
  onboarding_step         = 7
WHERE onboarding_completed = false;

-- ─── Extend audit_logs action CHECK constraint ────────────────────────────────

ALTER TABLE audit_logs DROP CONSTRAINT IF EXISTS audit_logs_action_check;
ALTER TABLE audit_logs ADD CONSTRAINT audit_logs_action_check
  CHECK (action IN (
    'create','update','delete','archive','restore',
    'export','login','logout','change_role',
    'generate_pdf','download_pdf','send_line',
    'create_staff','delete_staff',
    'feature_access_denied',
    -- PHASE59
    'onboarding_started',
    'onboarding_step_updated',
    'onboarding_completed',
    'onboarding_reset'
  ));

-- ─── Extend audit_logs resource_type CHECK constraint ────────────────────────

ALTER TABLE audit_logs DROP CONSTRAINT IF EXISTS audit_logs_resource_type_check;
ALTER TABLE audit_logs ADD CONSTRAINT audit_logs_resource_type_check
  CHECK (resource_type IN (
    'customer','vehicle','estimate','work_order',
    'completion_report','invoice','payment',
    'product_order','reservation','staff','role',
    'dealer_setting','document','super_admin',
    -- PHASE59
    'onboarding'
  ));
