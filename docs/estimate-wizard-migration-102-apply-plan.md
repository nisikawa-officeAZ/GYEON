# Migration 102 — Isolated Apply Plan (Phase 11G-D)

Status: **plan only**. No migration applied. Runtime persistence disabled. This resolves the two
Phase 11G-C blockers: (1) the linked Supabase project is proven to be Development, and (2) a safe method
to apply ONLY migration 102 (without 004 or any other pending migration) is defined.

## 1. Proven environment identity

Authoritative evidence from `supabase projects list` (the ONLY project in the linked organization):

| Field | Value |
| --- | --- |
| Project name | **DealerOS-Dev** |
| Project ref | `fbieiotihlmpfzybowbt` |
| Organization | `ivlpkysdjbrkcozrvzwg` |
| Region | ap-northeast-2 |
| DB host | db.fbieiotihlmpfzybowbt.supabase.co |
| Postgres | 17.6.1.127 |
| Status | ACTIVE_HEALTHY |
| Linked | true (the repo/app points to this project) |
| Created | 2026-06-20 |

**Environment classification: Development.** The project is explicitly named `DealerOS-Dev`, it is the
sole project in the organization, and the repo is linked to it. No separate Production project is listed.
This matches the CLAUDE.md rule "Development environment only — never use production." Production data is
not expected on a project named `-Dev`; this is the development database.

## 2. Applied migration list (remote — DealerOS-Dev)

Per `supabase migration list`, only the following are recorded as APPLIED in the remote migration
history (`schema_migrations`):

- `000`
- `001`

**Only 000 and 001 are tracked as applied.** Everything from `002` onward is untracked/pending in the
migration history (67 local migrations not recorded as applied).

Important nuance: the running app depends on columns from 035/037/073/093/100/101, which implies those
were applied to the DealerOS-Dev schema **out-of-band** (e.g., via SQL editor / dashboard), so the live
SCHEMA is ahead of the migration TRACKING table. This mismatch is exactly why `supabase db push` is
unsafe here (it would try to run all 67 "pending" migrations).

## 3. Pending migration list

67 local migrations are pending in the tracking table (002 … 102), including `004_enable_saas_rls.sql`
and `102_estimate_wizard_atomic_save.sql`. Applying them via the CLI push would attempt all 67.

## 4. Migration 004 status

`004_enable_saas_rls.sql` = **PENDING** (not applied on remote). It MUST NOT be applied by this plan.
The chosen method (SQL editor, 102 only) does not touch it.

## 5. Migration 102 status

`102_estimate_wizard_atomic_save.sql` = **PENDING** (not applied on remote). It is the only migration
this plan targets.

## 6. Selected isolated apply method

**Option B — Supabase SQL Editor, running ONLY the contents of `102_estimate_wizard_atomic_save.sql`
against the DealerOS-Dev project.**

Why B (and not the others):
- **A (CLI exact-version targeting):** rejected. `supabase db push` / `migration up` apply ALL pending
  migrations (all 67, including 004). There is no clean CLI flag to apply a single out-of-order file
  when 002–101 are also "pending." Cascade risk + forbidden 004 = unsafe.
- **B (SQL Editor, 102 only):** selected. Migration 102 is idempotent and self-contained: `ADD COLUMN
  IF NOT EXISTS`, `CREATE UNIQUE INDEX IF NOT EXISTS`, `CREATE OR REPLACE FUNCTION`, and `DROP
  CONSTRAINT IF EXISTS` before each `ADD CONSTRAINT ... NOT VALID`. It touches only `estimate_items`,
  `estimates`, one index, and one function. Running it standalone applies ONLY 102 — never 004, never
  other pending migrations.
- **C (psql -f):** rejected for now. Functionally equivalent to B but requires the DB password/direct
  connection and is explicitly not to be executed; SQL Editor is safer (role-scoped, audited).
- **D (temporary branch/database):** heavier; unnecessary since DealerOS-Dev is already the development
  environment and 102 is additive/reversible.

## 7. Exact future procedure (do NOT execute in this phase)

1. Confirm the Supabase dashboard is open on project **DealerOS-Dev** (`fbieiotihlmpfzybowbt`) — verify
   the ref in the URL. Never Production.
2. Pre-apply schema check (SQL editor, read-only): confirm `public.estimates` and
   `public.estimate_items` exist with their expected base columns (e.g. `estimates.internal_memo`,
   `estimate_items.item_type`) — because the RPC body references them at runtime. If missing, STOP
   (the live schema is behind expectations).
3. Open the SQL Editor → paste the ENTIRE contents of
   `supabase/migrations/102_estimate_wizard_atomic_save.sql` → run once.
4. (Optional, Architect decision) record 102 in the migration history to keep tracking consistent —
   only if the team wants the tracking table updated; not required for the schema change itself.
5. Run the Phase 11G-C post-apply verification + RPC smoke tests (read-only / test-data only).

No CLI `db push`, no `migration up`, no `db reset`, no `psql -f` is used.

## 8. Backup and rollback readiness

- **Backup availability:** Supabase provides automatic backups for the project; the exact recovery point
  / PITR availability is NOT visible from the CLI and MUST be verified in the dashboard (Project →
  Database → Backups) immediately before apply. **Mandatory pre-apply step.**
- **Rollback:** `docs/estimate-wizard-atomic-save-rollback-plan.md` defines the safe reversal (drop
  function → index → constraints → columns). Migration 102 is additive and reversible; dropping the
  function/index/constraints is non-destructive to row data. Only column drops risk wizard-written data
  (none exists until runtime save is enabled — which it is not).
- **Operationally reversible:** yes, given the rollback plan; column drops only matter after runtime
  save is enabled (a later phase).

## 9. Authentication requirements (future apply)

- **SQL Editor path (recommended):** authenticated Supabase dashboard access to the DealerOS-Dev project
  with a role permitted to run DDL (owner / admin / developer). No secrets in source, none printed.
- The Supabase CLI in this environment is already authenticated (read-only `projects list` /
  `migration list` succeeded), but the recommended apply path is the dashboard SQL Editor, not the CLI.
- Never store credentials in source files. Never paste secrets into the repo.

## 10. Pre-apply checklist

- [ ] Dashboard confirmed on `DealerOS-Dev` (`fbieiotihlmpfzybowbt`), NOT Production.
- [ ] Backup / PITR recovery point verified in the dashboard.
- [ ] Live schema check: `estimates` + `estimate_items` exist with expected base columns.
- [ ] Migration 102 SQL reviewed (matches repo file, unchanged).
- [ ] Only 102 will be run (no `db push`, no 004, no other pending migration).
- [ ] Runtime save remains disabled (gateway placeholder untouched).
- [ ] Git working tree documented; no unrelated changes staged.

## 11. Post-apply checklist

- [ ] New `estimate_items` columns exist (`pricing_source`, `pricing_reference_id`,
      `manual_pricing_identity`, `pricing_policy`, `manual_price_policy`, `wizard_category`, 3 jsonb).
- [ ] New `estimates` columns exist (snapshot + intents + `idempotency_key`).
- [ ] `estimates_dealer_idempotency_key_uidx` exists.
- [ ] `estimate_items_pricing_source_check` + `estimate_items_hybrid_identity_check` exist (NOT VALID).
- [ ] `save_estimate_from_wizard(uuid,uuid,text,jsonb)` exists; EXECUTE granted to `authenticated` only
      (no anon/public).
- [ ] RLS still enabled on `estimates` / `estimate_items`.
- [ ] Existing EstimateEditor create/load still works; existing rows unchanged.
- [ ] No other migration was applied (004 still pending).
- [ ] Runtime Wizard save still disabled (`RPC_NOT_IMPLEMENTED`).
- [ ] RPC smoke tests (Phase 11G-C §17) pass on test data only.

## 12. Remaining blockers

**None for environment identity or the isolated apply method** (both resolved). Remaining operational
gates for the FUTURE apply phase (not this phase): (a) verify a recoverable backup/PITR point in the
dashboard, (b) run the pre-apply live-schema check, (c) execute Option B in the dashboard, (d) run
post-apply verification + smoke tests. Applying 102 and running smoke tests belong to the next phase,
not this one.

## Non-goals

No migration applied, no runtime save, no SQL/RPC/RLS/app change, no commit/push. Plan only.
