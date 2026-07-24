BEGIN;

CREATE TABLE IF NOT EXISTS public.estimate_shares (
  id               uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  dealer_id        uuid        NOT NULL REFERENCES public.dealers(id) ON DELETE CASCADE,
  estimate_id      uuid        NOT NULL REFERENCES public.estimates(id) ON DELETE CASCADE,
  document_file_id uuid        NOT NULL REFERENCES public.document_files(id) ON DELETE RESTRICT,
  token_hash       text        NOT NULL,
  expires_at       timestamptz NOT NULL,
  revoked_at       timestamptz,
  revoked_by       uuid,
  created_by       uuid,
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT estimate_shares_token_hash_unique UNIQUE (token_hash)
);

CREATE INDEX IF NOT EXISTS idx_estimate_shares_dealer
  ON public.estimate_shares(dealer_id);

CREATE INDEX IF NOT EXISTS idx_estimate_shares_estimate
  ON public.estimate_shares(estimate_id);

ALTER TABLE public.estimate_shares ENABLE ROW LEVEL SECURITY;

REVOKE ALL PRIVILEGES ON TABLE public.estimate_shares
  FROM PUBLIC, anon, authenticated, service_role;

GRANT SELECT, INSERT, UPDATE ON TABLE public.estimate_shares
  TO service_role;

CREATE POLICY estimate_shares_dealer_select
  ON public.estimate_shares
  FOR SELECT
  TO authenticated
  USING (
    dealer_id IN (
      SELECT dm.dealer_id
      FROM public.dealer_members AS dm
      WHERE dm.user_id = (SELECT auth.uid())
        AND dm.status = 'active'
    )
  );

CREATE POLICY estimate_shares_dealer_insert
  ON public.estimate_shares
  FOR INSERT
  TO authenticated
  WITH CHECK (
    dealer_id IN (
      SELECT dm.dealer_id
      FROM public.dealer_members AS dm
      WHERE dm.user_id = (SELECT auth.uid())
        AND dm.status = 'active'
    )
  );

CREATE POLICY estimate_shares_dealer_update
  ON public.estimate_shares
  FOR UPDATE
  TO authenticated
  USING (
    dealer_id IN (
      SELECT dm.dealer_id
      FROM public.dealer_members AS dm
      WHERE dm.user_id = (SELECT auth.uid())
        AND dm.status = 'active'
    )
  )
  WITH CHECK (
    dealer_id IN (
      SELECT dm.dealer_id
      FROM public.dealer_members AS dm
      WHERE dm.user_id = (SELECT auth.uid())
        AND dm.status = 'active'
    )
  );

COMMIT;
