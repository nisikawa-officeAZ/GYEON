# GYEON Order V3 C4 Disposable-DB Verification Result

- Result ID: `GYEON-ORDER-V3-C4-R1-DISPOSABLE-VERIFICATION-RESULT`
- Current status: `C4_CHANGES_REQUIRED_SOURCE`
- Evidence class: local disposable runtime evidence
- Database contacted: yes, loopback-only disposable PostgreSQL
- Migration applied: yes, disposable runtime only
- Hosted/linked project contacted: no
- Runtime removed after evidence retention: yes

## 1. Acceptance boundary

Attempt 2 replayed the complete formal migration chain and the C4 runtime
derivative on PostgreSQL 17.6. Its first and only pgTAP run failed. The stop
condition therefore prevented real Auth, PostgREST, concurrency, lint, and
query-plan gates from running. No unexecuted gate is treated as passing.

## 2. Candidate identity

| Field | Evidence |
| --- | --- |
| Candidate branch | `agent/gyeon-order-v3-c4-r1-verification-assets` |
| Candidate commit | `3d071773df9d2f23bdd99d87dbe3aff8aac98adc` |
| C3 guarded SQL SHA-256 | `1d8200c3ecb06bbf7dd4151e86b81001bc46dcab90a51a395484eb865360eb4b` |
| Runtime derivative SHA-256 | `72f82d5f10a618bd015e2c15bcbbf8f5977c568b8ddbff98c35c0ccacb4dfd84` |
| Guard-only diff | PASS; one terminal `ROLLBACK` changed to `COMMIT` |
| Fresh runtime suffix | `20260827T110731Z-e9f76f` |
| Disposable project ID | `gyeonorderv3c420260827T110731Ze9f76f` |
| PostgreSQL version | `17.6` |
| Supabase CLI version | `2.108.0` |

## 3. Proof ledger

| Gate | Required evidence | Result |
| --- | --- | --- |
| Formal migration replay | clean PostgreSQL 17 replay; no `DRAFT_DO_NOT_APPLY` copy | `PASS` |
| Schema and constraints | pgTAP TAP output | `FAIL`; assertion 18 stopped on missing explicit text cast |
| RLS and grants | pgTAP plus live catalog summary | `FAIL`; authenticated policy dependency lacked membership-table access |
| SQL business contract | pgTAP fixture transaction | `FAIL`; stopped after 3/16 due membership permission denial |
| Real Auth boundary | local GoTrue tokens and PostgREST NDJSON | `NOT_RUN` |
| Cross-tenant isolation | real foreign token returns no Dealer A data | `NOT_RUN` |
| Separate-connection races | two simultaneous psql backends plus third observer | `NOT_RUN` |
| Idempotency races | same-key/same-payload and same-key/different-request | `NOT_RUN` |
| Optimistic version race | different keys, same aggregate version | `NOT_RUN` |
| Database lint | Supabase DB lint output | `NOT_RUN` |
| Query plans | bounded membership and idempotency EXPLAIN | `NOT_RUN` |
| Cleanup | exact disposable project stopped and exact runtime removed | `PASS` |

## 4. Expected external-authority blockers

These are expected fail-closed results in the current C3 source. They must not
be relabeled as passing release behavior.

- `QUALIFICATION_AUTHORITY_NOT_CONFIGURED`
- `SERVER_REPRICE_EDIT_ADAPTER_NOT_CONFIGURED`

If every foundation gate passes and only these two intentional blockers remain,
the maximum permitted classification is:

`C4_RELEASE_BLOCKED_EXTERNAL_AUTHORITY`

## 5. Final classification

Choose exactly one only after reviewing raw evidence:

- `C4_FOUNDATION_PASS`
- `C4_RELEASE_BLOCKED_EXTERNAL_AUTHORITY`
- `C4_CHANGES_REQUIRED_SOURCE`
- `C4_BLOCKED_ENVIRONMENT`

Current classification: `C4_CHANGES_REQUIRED_SOURCE`

## 6. Detected source defects and repair disposition

Repair status: `PREPARED_NOT_RETESTED`

| Repair field | Evidence |
| --- | --- |
| Repair branch | `agent/gyeon-order-v3-c4-r1-source-repair` |
| Repair commit | `NOT_CREATED` |
| Existing source-contract tests | `PASS 46/46` |
| Fresh disposable DB rerun | `NOT_RUN` |

1. `schema-rls.test.sql` now explicitly casts the
   `information_schema.columns.column_default` comparison to `text`.
2. `product_orders` RLS now delegates active-membership evaluation to one
   caller-bound boolean `SECURITY DEFINER` helper. The helper derives identity
   from `auth.uid()`, pins an empty `search_path`, and returns no membership
   rows. `authenticated` receives only the schema usage and function execution
   required by that policy; the server-owned membership table remains unreadable.
3. The helper-count, `SECURITY DEFINER`, privilege, caller-identity, and
   `auth.role()` pgTAP expectations now include the new helper explicitly.
4. The classification remains `C4_CHANGES_REQUIRED_SOURCE` until this repaired
   candidate is committed and all C4 gates are rerun with a fresh suffix. This
   attempt and both prior suffixes must never be reused.

## 7. Attempt history

- Attempt 1: `20260827T110538Z-f3c6db` — environment-only PATH failure before
  Supabase start; no database or migration execution; runtime removed.
- Attempt 2: `20260827T110731Z-e9f76f` — migration replay PASS; pgTAP FAIL;
  downstream gates NOT_RUN; runtime removed.

## 8. Evidence manifest

| File | SHA-256 | Review note |
| --- | --- | --- |
| `source-draft.sha256` | `d43ef32d9f3393c40037f6ffbb14abe5ec1f464ea48b734494a189d2c992b62d` | guarded C3 source identity file |
| `runtime-migration.sha256` | `ec3fa2e0702098729ba0f131a02f1a951a7c69f9b493ddeb7913b5f49f07b88b` | runtime derivative identity file |
| `pgtap.tap` | `58e446b3aedb0a5bcddc85f304f0648af53e9321cca16c4b60fc41b7a51ea7ae` | failing pgTAP evidence retained |
| `real-auth.ndjson` | `NOT_CREATED` | stopped after pgTAP failure |
| `concurrency.ndjson` | `NOT_CREATED` | stopped after pgTAP failure |
| `db-lint.txt` | `NOT_CREATED` | stopped after pgTAP failure |
| `catalog-summary.txt` | `NOT_CREATED` | stopped after pgTAP failure |
| `query-plans.txt` | `NOT_CREATED` | stopped after pgTAP failure |
| `SHA256SUMS.txt` | verified `7/7 OK` | retained evidence integrity |

## 9. Prohibited inference

- Source parsing is not database execution.
- SQL-set JWT claims are not real Auth tokens.
- One connection is not concurrency proof.
- `service_role` success is not dealer authorization proof.
- A local pass is not production deployment approval.
- This phase grants no stage, commit, push, merge, migration promotion, or
  production apply authority.
