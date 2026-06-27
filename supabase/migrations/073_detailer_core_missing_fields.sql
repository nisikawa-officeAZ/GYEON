-- RC-08: Detailer Core Missing Fields
-- Sprint: RC-08 Vehicle & Business Customer Field Persistence
--
-- PURPOSE: Add persistence for fields previously missing from the vehicles
--          and customers tables that are required for the detailer workflow.
--
-- SAFETY RULES:
--   - All statements use ALTER TABLE ... ADD COLUMN IF NOT EXISTS
--   - No DROP, no TRUNCATE, no destructive operations
--   - All new columns have safe defaults
--   - Existing RLS policies are NOT modified
--
-- MANUAL APPLY ONLY — never auto-applied by the app.
-- Apply via: Supabase Dashboard → SQL Editor → Run

-- ── Vehicles ─────────────────────────────────────────────────────────────────

ALTER TABLE vehicles
  ADD COLUMN IF NOT EXISTS displacement    text,
  ADD COLUMN IF NOT EXISTS fuel_type       text,
  ADD COLUMN IF NOT EXISTS registration_date date;

COMMENT ON COLUMN vehicles.displacement     IS 'Engine displacement e.g. 1998cc or 2.0L (from OCR or manual entry)';
COMMENT ON COLUMN vehicles.fuel_type        IS 'Fuel type e.g. ガソリン, ディーゼル, ハイブリッド, 電気 (from OCR)';
COMMENT ON COLUMN vehicles.registration_date IS 'First registration date — 初年度登録 (from OCR first_registration_date field)';

-- ── Customers ────────────────────────────────────────────────────────────────

ALTER TABLE customers
  ADD COLUMN IF NOT EXISTS is_business        boolean     NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS trade_discount_pct numeric(5,2) NOT NULL DEFAULT 0
    CONSTRAINT trade_discount_pct_range CHECK (trade_discount_pct >= 0 AND trade_discount_pct <= 100),
  ADD COLUMN IF NOT EXISTS credit_terms       text;

COMMENT ON COLUMN customers.is_business        IS 'True when customer is a business / dealer trade account';
COMMENT ON COLUMN customers.trade_discount_pct IS 'Trade / dealer discount percentage 0-100. Only meaningful when is_business=true.';
COMMENT ON COLUMN customers.credit_terms       IS 'Payment terms for business customers e.g. 月末締め翌月末払い';

-- ── Verification ─────────────────────────────────────────────────────────────
-- After running this migration, verify with:
--
--   SELECT column_name, data_type, is_nullable, column_default
--   FROM information_schema.columns
--   WHERE table_name = 'vehicles'
--     AND column_name IN ('displacement', 'fuel_type', 'registration_date')
--   ORDER BY column_name;
--
--   SELECT column_name, data_type, is_nullable, column_default
--   FROM information_schema.columns
--   WHERE table_name = 'customers'
--     AND column_name IN ('is_business', 'trade_discount_pct', 'credit_terms')
--   ORDER BY column_name;
