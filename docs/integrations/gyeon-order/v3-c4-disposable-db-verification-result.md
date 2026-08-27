# GYEON Order V3 C4 Disposable-DB Verification Result

- Result ID: `GYEON-ORDER-V3-C4-R1-DISPOSABLE-VERIFICATION-RESULT`
- Current status: `C4_RELEASE_BLOCKED_EXTERNAL_AUTHORITY`
- Evidence class: local disposable runtime evidence
- Database contacted: yes, loopback-only disposable PostgreSQL
- Migration applied: yes, disposable runtime only
- Hosted/linked project contacted: no
- Runtime removed after evidence retention: yes

## 1. Acceptance boundary

Attempt 5 replayed the complete formal migration chain and the repaired C4
runtime derivative on PostgreSQL 17.6. pgTAP passed 48/48, real
Auth/PostgREST passed 9/9, and all four implemented core separate-session
assertions passed.
Supabase DB lint completed with no error-level issue, and the reviewed query
plans used the membership index and the idempotency primary-key index. The
database foundation therefore passes. Qualification authority and the server
repricing adapter remain intentionally fail-closed, so this is not release or
production-apply approval.

## 2. Candidate identity

| Field | Evidence |
| --- | --- |
| Candidate branch | `agent/gyeon-order-v3-c4-r2-auth-harness-repair` |
| Candidate base commit | `614465e25cfcafed1b28679c05dd3ab66301fac5` |
| Candidate state | approved three-file uncommitted worktree; index empty |
| C3 guarded SQL SHA-256 | `0cd7db14a7ac1f6eb2f6f2e8e00c89183a2a0e4c2449dadf7c0d70c50ea33e03` |
| Runtime derivative SHA-256 | `b6ee689461009321a101ea1475dc38a293af9e82ad75f22eaa364f64aa0b4947` |
| Guard-only diff | PASS; one terminal `ROLLBACK` changed to `COMMIT` |
| Fresh runtime suffix | `20260827T115712Z-08xpwk` |
| Disposable project ID | `gyeonorderv3c420260827T115712Z08xpwk` |
| PostgreSQL version | `17.6` |
| Supabase CLI version | `2.108.0` |

## 3. Proof ledger

| Gate | Required evidence | Result |
| --- | --- | --- |
| Formal migration replay | clean PostgreSQL 17 replay; no `DRAFT_DO_NOT_APPLY` copy | `PASS` |
| Schema and constraints | pgTAP TAP output | `PASS`; schema/RLS file 32/32 |
| RLS and grants | pgTAP plus real-token requests | `PASS`; least-privilege helper and direct-write denial verified |
| SQL business contract | pgTAP fixture transaction | `PASS`; 16/16 |
| Real Auth boundary | local GoTrue tokens and PostgREST NDJSON | `PASS`; 9/9 with no secrets logged |
| Cross-tenant isolation | real foreign token returns no Dealer A data | `PASS`; HTTP 200 with zero rows |
| Separate-connection races | two simultaneous psql backends plus third observer | `PASS`; observer saw two active backends |
| Idempotency races | same-key/same-payload and same-key/different-request | `PASS`; canonical replay and one-winner rejection both verified |
| Optimistic version race | different keys, same aggregate version | `PASS`; exactly one winner |
| External-dependent races | double submit, cancel versus warehouse accept, double warehouse accept, card reauthorization | `NOT_RUN`; qualification and repricing authorities are not connected; not counted as passing |
| Database lint | Supabase DB lint output | `PASS` at error threshold; warnings retained for review |
| Query plans | bounded membership and idempotency EXPLAIN | `PASS`; index scan and primary-key index-only scan |
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

Foundation result: `C4_FOUNDATION_PASS`

Current classification: `C4_RELEASE_BLOCKED_EXTERNAL_AUTHORITY`

## 6. Detected source defects and repair disposition

Repair status: `C4_R3_DISPOSABLE_DB_PASS`

| Repair field | Evidence |
| --- | --- |
| Repair branch | `agent/gyeon-order-v3-c4-r2-auth-harness-repair` |
| Repair base commit | `614465e25cfcafed1b28679c05dd3ab66301fac5` |
| Repair commit | `UNCOMMITTED_WORKTREE`; staging and commit are not authorized |
| Repaired SQL SHA-256 | `0cd7db14a7ac1f6eb2f6f2e8e00c89183a2a0e4c2449dadf7c0d70c50ea33e03` |
| Existing source-contract tests | `PASS 46/46` |
| C4-R1 fresh disposable DB rerun | `FAIL at Real Auth 8/9`; pgTAP `PASS 48/48` |
| C4-R2 Real Auth harness syntax | `PASS` |
| C4-R2 existing source-contract tests | `PASS 46/46` |
| C4-R2 fresh disposable DB rerun | `FAIL at concurrency 3/4`; pgTAP `48/48`, real Auth `9/9` |
| C4-R3 atomic idempotency claim | `IMPLEMENTED`; conflict loser waits for and reads the canonical ledger row |
| C4-R3 source-contract tests | `PASS 46/46` |
| C4-R3 fresh disposable DB rerun | foundation `PASS`; pgTAP 48/48, real Auth 9/9, core concurrency 4/4, lint and plans completed; external-dependent races `NOT_RUN` |
| C4 evidence checksum repair | `PASS`; completion marker is created before hashing, secrets and the checksum manifest itself are excluded |

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
6. The repaired idempotency contract passed the fresh disposable-DB gates.
   The database foundation is accepted, while release remains blocked by the
   two explicit external-authority dependencies.
7. The previous `private.gyeon_order_v3_claim_idempotency` implementation
   performed `SELECT ... FOR UPDATE` before inserting. When the key was absent,
   two transactions could both observe no row and race to insert the same
   primary key. C4-R3 now establishes the row with
   `INSERT ... ON CONFLICT DO NOTHING`; a conflicting caller then locks the
   existing row and returns its completed canonical response for an identical
   replay.
8. All five attempted suffixes are burned and must never be reused.
9. The raw Attempt 5 capture generated a self-referential checksum manifest and
   created its completion marker after hashing. The retained evidence excludes
   secrets and is independently checksummed 19/19. The source capture asset was
   subsequently repaired without rerunning or rewriting Attempt 5 evidence;
   `bash -n` and an isolated checksum fixture both pass.

## 7. Attempt history

- Attempt 1: `20260827T110538Z-f3c6db` — environment-only PATH failure before
  Supabase start; no database or migration execution; runtime removed.
- Attempt 2: `20260827T110731Z-e9f76f` — migration replay PASS; pgTAP FAIL;
  downstream gates NOT_RUN; runtime removed.
- Attempt 3: `20260827T113106Z-ebca9d` — migration replay PASS; pgTAP 48/48
  PASS; real Auth/PostgREST 8/9; stopped on verification-asset HTTP expectation;
  concurrency, lint, and query plans NOT_RUN; runtime removed.
- Attempt 4: `20260827T114227Z-d2324b` — migration replay PASS; pgTAP 48/48
  PASS; real Auth/PostgREST 9/9 PASS; concurrency 3/4 with genuine separate
  sessions; lint and query plans NOT_RUN; runtime removed.
- Attempt 5: `20260827T115712Z-08xpwk` — migration replay PASS; pgTAP 48/48
  PASS; real Auth/PostgREST 9/9 PASS; core separate-session concurrency 4/4
  PASS; external-dependent race families NOT_RUN; DB lint completed with no
  error-level issue; query plans used bounded indexes; retained evidence 19/19
  PASS; runtime and matching containers removed.

## 8. Evidence manifest

| File | SHA-256 | Review note |
| --- | --- | --- |
| `source-draft.sha256` | `43e1aabfba058c55794030bda6c8ac63d0f316b5cb3de56b764e543cdc6c21a0` | guarded source identity file; SQL hash `0cd7db...33e03` |
| `runtime-migration.sha256` | `3af8b9328c679fa771debb03fdce6e88ce8baa73940c77d5194ee4d4cdc89326` | runtime derivative identity file; SQL hash `b6ee68...b4947` |
| `pgtap.tap` | `d05be1db43c3606dface00a56df3514cdbe141592c964a3a4b3aa0aa6a718379` | pgTAP 48/48 PASS evidence |
| `real-auth.ndjson` | `0a6b48258ad0fe0b12f0f501787a381dd734477f02446a4821eb3db5baf6d70e` | real Auth 9/9 evidence; no secrets logged |
| `concurrency.ndjson` | `1ae9ca13a1b6ebb97b0db17c714232097d2527e476c7fe03a32ca6402e339174` | separate-session concurrency 4/4 PASS evidence |
| `db-lint.txt` | `1de3fe00926423fa195627847b0f60c2b474dade30edc8e0879d704c5896356f` | no error-level issue; warnings retained |
| `catalog-summary.txt` | `632acfc2c4f28b4afc56f1f625252d010a8f15d64389dc6bb0cfb7544444f4dc` | PostgreSQL 17.6, RLS and grants summary |
| `query-plans.txt` | `640dccf77b7623de670dd82ceb42aa736979e2e1f22f9427ce12546b22803338` | indexed membership and idempotency plans |
| `cleanup.txt` | `9bf5207ab4518322095daa98393721113bdd43a1874313491fa2b8c40c30682a` | exact project stop and runtime removal |
| `summary.md` | `d2afbfde129df86dbf308d71bb69a734e1515a9c1dcb703ad74d79bb536e1f25` | retained acceptance summary |
| `SHA256SUMS.txt` | verified `19/19 OK` | retained evidence integrity; no self-reference or secrets |

## 9. Prohibited inference

- Source parsing is not database execution.
- SQL-set JWT claims are not real Auth tokens.
- One connection is not concurrency proof.
- `service_role` success is not dealer authorization proof.
- A local pass is not production deployment approval.
- This phase grants no stage, commit, push, merge, migration promotion, or
  production apply authority.
