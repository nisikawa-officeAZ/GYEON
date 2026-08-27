# GYEON Order V3 C4 Disposable-DB Verification Result

- Result ID: `GYEON-ORDER-V3-C4-R1-DISPOSABLE-VERIFICATION-RESULT`
- Current status: `C4_CHANGES_REQUIRED_SOURCE`
- Evidence class: local disposable runtime evidence
- Database contacted: yes, loopback-only disposable PostgreSQL
- Migration applied: yes, disposable runtime only
- Hosted/linked project contacted: no
- Runtime removed after evidence retention: yes

## 1. Acceptance boundary

Attempt 3 replayed the complete formal migration chain and the repaired C4
runtime derivative on PostgreSQL 17.6. pgTAP passed 48/48. Real Auth/PostgREST
passed 8/9, then stopped because the verification asset expected HTTP 501 for
SQLSTATE `0A000` while PostgREST correctly returned HTTP 400 with the required
code and message. The stop condition prevented concurrency, lint, and
query-plan gates from running. No unexecuted gate is treated as passing.

## 2. Candidate identity

| Field | Evidence |
| --- | --- |
| Candidate branch | `agent/gyeon-order-v3-c4-r1-source-repair` |
| Candidate commit | `3736b36672933cf16cdd7a470b77c02abf416c24` |
| C3 guarded SQL SHA-256 | `426af7c10111d0a43807710a778810259e3c35cca228f261ef34ce188dfd2e68` |
| Runtime derivative SHA-256 | `5c8f6d72077d25060bd9d46a9088673a7e2e6dfa626f9968e7be9a8abfd73e7b` |
| Guard-only diff | PASS; one terminal `ROLLBACK` changed to `COMMIT` |
| Fresh runtime suffix | `20260827T113106Z-ebca9d` |
| Disposable project ID | `gyeonorderv3c420260827T113106Zebca9d` |
| PostgreSQL version | `17.6` |
| Supabase CLI version | `2.108.0` |

## 3. Proof ledger

| Gate | Required evidence | Result |
| --- | --- | --- |
| Formal migration replay | clean PostgreSQL 17 replay; no `DRAFT_DO_NOT_APPLY` copy | `PASS` |
| Schema and constraints | pgTAP TAP output | `PASS`; schema/RLS file 32/32 |
| RLS and grants | pgTAP plus real-token requests | `PASS`; least-privilege helper and direct-write denial verified |
| SQL business contract | pgTAP fixture transaction | `PASS`; 16/16 |
| Real Auth boundary | local GoTrue tokens and PostgREST NDJSON | `FAIL`; 8/9 due incorrect expected HTTP status in test asset |
| Cross-tenant isolation | real foreign token returns no Dealer A data | `PASS`; HTTP 200 with zero rows |
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

Repair status: `C4_R2_STATIC_PASS_NOT_DB_RETESTED`

| Repair field | Evidence |
| --- | --- |
| Repair branch | `agent/gyeon-order-v3-c4-r1-source-repair` |
| Repair commit | `3736b36672933cf16cdd7a470b77c02abf416c24` |
| Existing source-contract tests | `PASS 46/46` |
| Fresh disposable DB rerun | `FAIL at Real Auth 8/9`; pgTAP `PASS 48/48` |
| C4-R2 Real Auth harness syntax | `PASS` |
| C4-R2 existing source-contract tests | `PASS 46/46` |
| C4-R2 fresh disposable DB rerun | `NOT_RUN` |

1. `schema-rls.test.sql` now explicitly casts the
   `information_schema.columns.column_default` comparison to `text`.
2. `product_orders` RLS now delegates active-membership evaluation to one
   caller-bound boolean `SECURITY DEFINER` helper. The helper derives identity
   from `auth.uid()`, pins an empty `search_path`, and returns no membership
   rows. `authenticated` receives only the schema usage and function execution
   required by that policy; the server-owned membership table remains unreadable.
3. The helper-count, `SECURITY DEFINER`, privilege, caller-identity, and
   `auth.role()` pgTAP expectations now include the new helper explicitly.
4. The repaired SQL and pgTAP defects passed the fresh database rerun.
5. `real-auth.mjs` now requires HTTP 400, code `0A000`, and message
   `QUALIFICATION_AUTHORITY_NOT_CONFIGURED` together. The repair matches the
   observed PostgREST response without weakening the fail-closed contract.
6. The classification remains `C4_CHANGES_REQUIRED_SOURCE` until the repaired
   test asset is committed and all C4 gates are rerun with another fresh suffix.
   All three attempted suffixes are burned and must never be reused.

## 7. Attempt history

- Attempt 1: `20260827T110538Z-f3c6db` — environment-only PATH failure before
  Supabase start; no database or migration execution; runtime removed.
- Attempt 2: `20260827T110731Z-e9f76f` — migration replay PASS; pgTAP FAIL;
  downstream gates NOT_RUN; runtime removed.
- Attempt 3: `20260827T113106Z-ebca9d` — migration replay PASS; pgTAP 48/48
  PASS; real Auth/PostgREST 8/9; stopped on verification-asset HTTP expectation;
  concurrency, lint, and query plans NOT_RUN; runtime removed.

## 8. Evidence manifest

| File | SHA-256 | Review note |
| --- | --- | --- |
| `source-draft.sha256` | `a820be69fd7cfd04f77ee3b363f2c86427d6223b1ae8e29e7887827bd3683dd3` | guarded C3 source identity file |
| `runtime-migration.sha256` | `151e5326ee8c818a5ff7c408f50ac4dcbf8fc71c60e55b398189bd524f006f1a` | runtime derivative identity file |
| `pgtap.tap` | `5901025748713d11a934d972159370eee1c578659eccf1243be08916b2c45d04` | pgTAP 48/48 PASS evidence |
| `real-auth.ndjson` | `579d5d5e25ef3ea66143d402ee1c7a5d29e14835e64a3e64c33e02430b795180` | real Auth 8/9 evidence; no secrets logged |
| `concurrency.ndjson` | `NOT_CREATED` | stopped after real Auth assertion failure |
| `db-lint.txt` | `NOT_CREATED` | stopped after real Auth assertion failure |
| `catalog-summary.txt` | `NOT_CREATED` | stopped after real Auth assertion failure |
| `query-plans.txt` | `NOT_CREATED` | stopped after real Auth assertion failure |
| `SHA256SUMS.txt` | verified `10/10 OK` | retained evidence integrity |

## 9. Prohibited inference

- Source parsing is not database execution.
- SQL-set JWT claims are not real Auth tokens.
- One connection is not concurrency proof.
- `service_role` success is not dealer authorization proof.
- A local pass is not production deployment approval.
- This phase grants no stage, commit, push, merge, migration promotion, or
  production apply authority.
