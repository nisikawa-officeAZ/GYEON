-- =============================================================================
-- PHASE75: Admin Role Expansion
-- File: 075_admin_roles_expansion.sql
-- =============================================================================
-- MANUAL APPLY ONLY. Paste into Supabase SQL Editor.
-- Apply AFTER migration 074.
--
-- Expands admin_users.role CHECK constraint from only 'super_admin' to include:
--   super_admin     — GYEON Super Admin (full access)
--   gyeon_admin     — GYEON Admin (all modules except Users and Audit Logs)
--   logistics_admin — Logistics Admin (warehouse and logistics modules only)
--
-- Does NOT drop or recreate the admin_users table.
-- Does NOT touch existing 'super_admin' rows — they remain valid.
-- Safe to re-run: all statements are idempotent.
-- =============================================================================

-- Section 1: Drop all existing CHECK constraints on the role column (idempotent)
DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN
    SELECT c.conname
    FROM pg_constraint c
    JOIN pg_class t ON t.oid = c.conrelid
    JOIN pg_namespace n ON n.oid = t.relnamespace
    JOIN pg_attribute a ON a.attrelid = t.oid AND a.attnum = ANY(c.conkey)
    WHERE n.nspname = 'public'
      AND t.relname = 'admin_users'
      AND c.contype = 'c'
      AND a.attname = 'role'
  LOOP
    EXECUTE 'ALTER TABLE public.admin_users DROP CONSTRAINT ' || quote_ident(r.conname);
    RAISE NOTICE 'Dropped constraint: %', r.conname;
  END LOOP;
END;
$$;

-- Section 2: Add expanded role constraint
ALTER TABLE public.admin_users
  ADD CONSTRAINT admin_users_role_check
  CHECK (role IN ('super_admin', 'gyeon_admin', 'logistics_admin'));

-- Section 3: Verify existing rows are still valid
-- All existing 'super_admin' rows are covered by the new constraint.
-- SELECT role, COUNT(*) FROM public.admin_users GROUP BY role;

-- =============================================================================
-- Dealer-side roles are stored in dealer_members.role (separate table).
-- They are NOT in admin_users and do NOT need a constraint change here.
-- Dealer roles: owner | manager | staff | read_only
-- dealer_members.role already has its own CHECK constraint.
-- =============================================================================

-- Verification queries (run after applying):
-- SELECT conname, pg_get_constraintdef(oid)
--   FROM pg_constraint
--   WHERE conrelid = 'public.admin_users'::regclass AND contype = 'c';
-- SELECT role, COUNT(*) FROM public.admin_users GROUP BY role;
