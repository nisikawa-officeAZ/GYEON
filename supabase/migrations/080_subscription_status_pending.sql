-- Migration 080 — Expand subscription_status to include 'pending'
-- Applied as part of RC-20 dealer self-registration flow.
-- Dealers created by the self-registration form start with subscription_status = 'pending'
-- until a Super Admin or GYEON Admin approves them (which sets it to 'trial').

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.dealers'::regclass
      AND conname  = 'dealers_subscription_status_check'
  ) THEN
    ALTER TABLE public.dealers DROP CONSTRAINT dealers_subscription_status_check;
  END IF;
END;
$$;

ALTER TABLE public.dealers
  ADD CONSTRAINT dealers_subscription_status_check
  CHECK (subscription_status IN ('pending', 'active', 'trial', 'expired', 'cancelled'));
