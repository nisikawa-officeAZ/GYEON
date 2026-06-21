-- ─── document_sequences ────────────────────────────────────────────────────
-- Stores per-dealer auto-numbering sequences for each document type.
-- fiscal_year: 0 = "never reset", YYYY = yearly, YYYYMM = monthly
-- UNIQUE (dealer_id, sequence_type, fiscal_year) handles all reset policies
-- without NULL uniqueness issues.

CREATE TABLE IF NOT EXISTS document_sequences (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  dealer_id       uuid NOT NULL REFERENCES dealers(id) ON DELETE CASCADE,
  sequence_type   text NOT NULL CHECK (sequence_type IN (
                    'estimate', 'work_order', 'completion_report',
                    'invoice', 'payment', 'maintenance_reminder'
                  )),
  prefix          text NOT NULL DEFAULT '',
  padding         integer NOT NULL DEFAULT 5 CHECK (padding BETWEEN 1 AND 10),
  reset_policy    text NOT NULL DEFAULT 'never' CHECK (reset_policy IN ('never', 'yearly', 'monthly')),
  fiscal_year     integer NOT NULL DEFAULT 0,   -- 0=never, YYYY=yearly, YYYYMM=monthly
  current_number  integer NOT NULL DEFAULT 0 CHECK (current_number >= 0),
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),

  UNIQUE (dealer_id, sequence_type, fiscal_year)
);

-- Index for fast lookup on the hot path (getNextDocumentNumber)
CREATE INDEX IF NOT EXISTS idx_document_sequences_lookup
  ON document_sequences (dealer_id, sequence_type, fiscal_year);

-- updated_at trigger
CREATE TRIGGER trg_document_sequences_updated_at
  BEFORE UPDATE ON document_sequences
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ─── RLS ─────────────────────────────────────────────────────────────────────
ALTER TABLE document_sequences ENABLE ROW LEVEL SECURITY;

CREATE POLICY "dealer members can manage document_sequences"
  ON document_sequences
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM dealer_members
      WHERE dealer_members.dealer_id = document_sequences.dealer_id
        AND dealer_members.user_id = auth.uid()
    )
  );

-- ─── Atomic increment RPC ────────────────────────────────────────────────────
-- Call this from the server-side to get the next number atomically.
-- Usage: SELECT next_number FROM get_next_document_number($dealer_id, $type, $fiscal_year)
CREATE OR REPLACE FUNCTION get_next_document_number(
  p_dealer_id     uuid,
  p_sequence_type text,
  p_fiscal_year   integer,
  p_prefix        text DEFAULT '',
  p_padding       integer DEFAULT 5,
  p_reset_policy  text DEFAULT 'never'
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_next integer;
BEGIN
  INSERT INTO document_sequences
    (dealer_id, sequence_type, fiscal_year, prefix, padding, reset_policy, current_number)
  VALUES
    (p_dealer_id, p_sequence_type, p_fiscal_year, p_prefix, p_padding, p_reset_policy, 1)
  ON CONFLICT (dealer_id, sequence_type, fiscal_year) DO UPDATE
    SET current_number = document_sequences.current_number + 1,
        updated_at     = now()
  RETURNING current_number INTO v_next;

  RETURN v_next;
END;
$$;
