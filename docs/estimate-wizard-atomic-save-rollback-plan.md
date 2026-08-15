# Estimate Wizard Atomic Save — Migration 102 Rollback Plan (Phase 11G-C)

Status: **plan only**. No rollback migration is created or executed. Migration 102 itself is NOT applied
in this phase (apply blocked — see §Staging preflight in the phase report). This documents how to safely
reverse `supabase/migrations/102_estimate_wizard_atomic_save.sql` if it is ever applied to a
Development/Staging environment.

## 1. Migration 102 changes (summary)

Strictly additive: new `estimate_items` columns + constraints, new `estimates` columns + partial-unique
index, one new RPC function, one EXECUTE grant, comments. No existing column/table/constraint/data is
altered destructively. No RLS change. `customers`/`vehicles` unchanged.

## 2. Objects created

- Function `public.save_estimate_from_wizard(uuid, uuid, text, jsonb)` (SECURITY INVOKER).
- Unique index `estimates_dealer_idempotency_key_uidx`.
- Constraints `estimate_items_pricing_source_check`, `estimate_items_hybrid_identity_check` (both NOT
  VALID, NULL-tolerant).
- EXECUTE grant on the function to `authenticated`.
- Column comments.

## 3. Columns added

`estimate_items`: `pricing_source`, `pricing_reference_id`, `manual_pricing_identity`, `pricing_policy`,
`manual_price_policy`, `wizard_category`, `selected_option_reference_ids` (jsonb), `pricing_metadata`
(jsonb), `operational_metadata` (jsonb).
`estimates`: `pricing_completeness`, `pricing_warnings` (jsonb), `pricing_errors` (jsonb),
`discount_intent` (jsonb), `coupon_intent` (jsonb), `non_priceable_selections` (jsonb),
`idempotency_key`, `source`, `wizard_schema_version`.

## 4. Constraints added

`estimate_items_pricing_source_check` (pricing_source NULL or in catalog|manual) and
`estimate_items_hybrid_identity_check` (exactly one identity per source). Both `NOT VALID` — enforced on
new/updated rows only; existing rows are grandfathered and never re-validated.

## 5. Indexes added

`estimates_dealer_idempotency_key_uidx` — partial unique on `(dealer_id, idempotency_key)` WHERE
`idempotency_key IS NOT NULL`. Existing rows (null key) are unaffected.

## 6. Function created

`save_estimate_from_wizard(...)` — atomic customer/vehicle/estimate/items save. Inert until a future
phase wires the gateway; dropping it has no runtime effect while the gateway placeholder is active.

## 7. Safe rollback order

Reverse of creation, dependencies last-created-first:

1. `REVOKE EXECUTE ON FUNCTION public.save_estimate_from_wizard(uuid, uuid, text, jsonb) FROM authenticated;`
2. `DROP FUNCTION IF EXISTS public.save_estimate_from_wizard(uuid, uuid, text, jsonb);`
3. `DROP INDEX IF EXISTS public.estimates_dealer_idempotency_key_uidx;`
4. `ALTER TABLE public.estimate_items DROP CONSTRAINT IF EXISTS estimate_items_hybrid_identity_check, DROP CONSTRAINT IF EXISTS estimate_items_pricing_source_check;`
5. Drop the added `estimate_items` columns (only if no wizard rows depend on them — see §8).
6. Drop the added `estimates` columns (only if no wizard rows depend on them — see §8).

The commented rollback block at the end of migration 102 mirrors this order.

## 8. Data-preservation warnings

- If any Estimate was saved via the Wizard RPC before rollback, the added columns hold the ONLY copy of
  hybrid pricing identity, pricing snapshot, discount/coupon intent, non-priceable selections, and the
  idempotency key. **Dropping those columns permanently deletes that data.** Before dropping columns,
  export/verify no wizard-created estimates exist (or accept the data loss knowingly).
- Dropping the function/index/constraints alone is non-destructive to row data. Prefer dropping ONLY the
  function + index + constraints and RETAINING the columns unless the columns must be removed.
- `estimate_items`/`estimates` data written by EstimateEditor is unaffected by any of these objects
  (those rows have null wizard columns).

## 9. Conditions where rollback is unsafe

- Wizard-created estimates exist and their hybrid-pricing/snapshot columns are still needed (column drop
  would lose data).
- Downstream code (a future phase) already reads the new columns (PDF/invoice/reporting) — dropping them
  would break those readers. Verify no consumer before column drop.
- Concurrent writes in progress — perform rollback during a quiet window.

## 10. Staging recovery procedure

1. Confirm the target is Development/Staging (never Production).
2. Take a fresh snapshot/backup first.
3. Apply §7 steps 1–4 (function, index, constraints) — always safe.
4. Only if required, apply §7 steps 5–6 (column drops) after confirming no wizard data must be kept.
5. Verify: RPC gone, index gone, constraints gone, existing EstimateEditor create/read still works,
   existing rows unchanged.

## 11. Production rollback deferred

No Production apply and no Production rollback are authorized in this phase. A Production rollback plan
(with maintenance window, backup, consumer audit) is a separate future deliverable requiring Architect
approval.

## 12. Backup requirements before future Production apply

- Full logical backup (or PITR snapshot) of `estimates`, `estimate_items`, `customers`, `vehicles`
  immediately before apply.
- Verified restore path.
- Confirmed rollback runbook (this document, extended for Production).
- Confirmation that only migration 102 (not other pending migrations, and NOT
  `004_enable_saas_rls.sql`) is applied.

## Non-goals

No rollback migration is created or executed. Migration 102 is not applied. Runtime persistence stays
disabled.
