-- PHASE51: Branding / Plans / App Identity
-- Add subscription plan columns to dealers table (all additive).

ALTER TABLE public.dealers
  ADD COLUMN IF NOT EXISTS plan                text        NOT NULL DEFAULT 'basic',
  ADD COLUMN IF NOT EXISTS subscription_status text        NOT NULL DEFAULT 'active',
  ADD COLUMN IF NOT EXISTS started_at          timestamptz,
  ADD COLUMN IF NOT EXISTS expired_at          timestamptz;

-- Drop existing constraints if any (safe — IF EXISTS)
ALTER TABLE public.dealers
  DROP CONSTRAINT IF EXISTS dealers_plan_check;
ALTER TABLE public.dealers
  DROP CONSTRAINT IF EXISTS dealers_subscription_status_check;

ALTER TABLE public.dealers
  ADD CONSTRAINT dealers_plan_check
    CHECK (plan IN ('basic', 'pro', 'pro_plus'));

ALTER TABLE public.dealers
  ADD CONSTRAINT dealers_subscription_status_check
    CHECK (subscription_status IN ('active', 'trial', 'expired', 'cancelled'));
