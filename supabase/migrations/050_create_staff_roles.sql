-- dealer_staff: richer staff table with invite flow, role, status tracking
CREATE TABLE IF NOT EXISTS dealer_staff (
  id             uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  dealer_id      uuid        NOT NULL REFERENCES dealers(id) ON DELETE CASCADE,
  user_id        uuid        REFERENCES auth.users(id) ON DELETE SET NULL,
  email          text,
  name           text,
  role           text        NOT NULL DEFAULT 'staff'
                             CHECK (role IN ('owner','manager','staff','readonly')),
  status         text        NOT NULL DEFAULT 'active'
                             CHECK (status IN ('invited','active','disabled')),
  invited_at     timestamptz,
  joined_at      timestamptz,
  last_login_at  timestamptz,
  created_at     timestamptz NOT NULL DEFAULT now(),
  updated_at     timestamptz NOT NULL DEFAULT now(),
  UNIQUE (dealer_id, user_id)
);

-- Add owner_user_id to dealers (for bootstrap before dealer_staff is populated)
ALTER TABLE dealers
  ADD COLUMN IF NOT EXISTS owner_user_id uuid REFERENCES auth.users(id);

-- ── RLS ─────────────────────────────────────────────────────────────────────

ALTER TABLE dealer_staff ENABLE ROW LEVEL SECURITY;

-- SELECT: members of same dealer
CREATE POLICY "dealer_staff_select" ON dealer_staff
  FOR SELECT USING (
    dealer_id IN (
      SELECT dealer_id FROM dealer_members
       WHERE user_id = auth.uid() AND status = 'active'
    )
    OR dealer_id IN (
      SELECT id FROM dealers WHERE owner_user_id = auth.uid()
    )
  );

-- INSERT: owner or manager only
CREATE POLICY "dealer_staff_insert" ON dealer_staff
  FOR INSERT WITH CHECK (
    dealer_id IN (
      SELECT dealer_id FROM dealer_members
       WHERE user_id = auth.uid() AND status = 'active'
         AND role IN ('owner','manager')
    )
    OR dealer_id IN (
      SELECT id FROM dealers WHERE owner_user_id = auth.uid()
    )
  );

-- UPDATE: owner or manager only
CREATE POLICY "dealer_staff_update" ON dealer_staff
  FOR UPDATE USING (
    dealer_id IN (
      SELECT dealer_id FROM dealer_members
       WHERE user_id = auth.uid() AND status = 'active'
         AND role IN ('owner','manager')
    )
    OR dealer_id IN (
      SELECT id FROM dealers WHERE owner_user_id = auth.uid()
    )
  );

-- No DELETE policy — use status = 'disabled' instead
