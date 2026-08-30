# Claude Directive — GDA Estimate Managed-Service Offering R1 Production R2 Staging Read-Only Preflight

## 1. Result identity

Return exactly one result headed:

`GDA_ESTIMATE_MANAGED_SERVICE_OFFERING_R1_PRODUCTION_R2_STAGING_READ_ONLY_PREFLIGHT_RESULT_V1`

Allowed verdicts:

- `READY_FOR_R3_STAGING_EXACT_STATEMENT_APPLY_GOVERNANCE`
- `CHANGES_REQUIRED_R2_PREFLIGHT`
- `BLOCKED_EVIDENCE`

This file is currently an uncommitted governance candidate. It authorizes no
Claude invocation, private-file transmission, provider or database access,
local evidence creation, Git mutation, Staging write, or Production action.
A later invocation requires separate owner approval after this directive is
committed, normally pushed, and independently verified at PR `#47`.

## 2. Active phase and accountable roles

- Phase:
  `GDA_ESTIMATE_MANAGED_SERVICE_OFFERING_R1_PRODUCTION_R2_STAGING_READ_ONLY_PREFLIGHT`
- Product and stop authority: `西川 篤志 / Owner`
- Operator: `MacBook Claude Code`
- Independent verifier: `MacBook Codex`
- Rollback authority: `倉庫担当者 小尾野`
- Target: Staging only, `DealerOS-Dev-Next`, ref
  `vhiuiwolnlvlwvoaingd`, region `ap-northeast-1`
- Production ref `dmvyaykhibmphrmekjbb` is identity-reference-only and must not
  be contacted.

The R1-C3 300-second decision instrument is operationally accepted for the
exact Staging ref, but R2 is read-only and must not invoke that procedure.
There is no failed apply or eligible rollback trigger in R2.

## 3. Repository identity and execution predecessor

- Repository: `nisikawa-officeAZ/GYEON`
- Pull request: `#47`, required `OPEN` / `Draft`, base `main`
- Branch: `plan/estimate-managed-service-production-forward-bridge-r1`
- R2 governance-authoring predecessor commit:
  `301dc99366f7a7634e80f7f260a099863ee86ef7`
- R2 governance-authoring predecessor tree:
  `b4eb50bc77bf693e2002c9215d4b0648cb212502`
- Required upstream ahead/behind at invocation: `0 0`
- Required worktree and index at invocation: clean

MacBook Codex must supply the exact committed execution HEAD and tree that
contain this directive. The predecessor above must be its ancestor, and the
committed delta from that predecessor to the execution HEAD must contain
exactly these three governance paths:

1. `docs/master_specification/GDA_ESTIMATE_MANAGED_SERVICE_OFFERING_R1_PRODUCTION_MIGRATION_REMEDIATION_PLAN.md`
2. `docs/master_specification/GYEON_DA_PHASE_RESULTS.md`
3. `docs/master_specification/CLAUDE_DIRECTIVE_GDA_ESTIMATE_MANAGED_SERVICE_OFFERING_R1_PRODUCTION_R2_STAGING_READ_ONLY_PREFLIGHT.md`

Stop with `BLOCKED_EVIDENCE` before provider or database access if identity,
ancestry, exact three-path delta, upstream state, clean state, or protected
metadata differs.

## 4. Required first reads and literal Git read allowlist

Read `AGENTS.md` and
`docs/master_specification/GYEON_DA_COMPLETION_PLAN.md` completely before any
other action. Then inspect only the following additional Git paths:

1. this directive;
2. `docs/master_specification/GYEON_DA_PHASE_RESULTS.md`, from
   `GDA-ESTIMATE-MANAGED-SERVICE-OFFERING-R1-PRODUCTION-R1-C1-A1` through the
   latest entry;
3. `docs/master_specification/GDA_ESTIMATE_MANAGED_SERVICE_OFFERING_R1_PRODUCTION_MIGRATION_REMEDIATION_PLAN.md`;
4. `docs/master_specification/ENVIRONMENT_LEDGER.md`, sections 1 through 6;
5. `docs/master_specification/GDA_ESTIMATE_MANAGED_SERVICE_OFFERING_R1_PRODUCTION_R1_C3_CONDITIONAL_ROLLBACK_PREAUTHORIZATION.md`;
6. `docs/master_specification/GDA_ESTIMATE_MANAGED_SERVICE_OFFERING_R1_PRODUCTION_R1_C3_ACTIVATION_RECORD.md`;
7. `docs/master_specification/GDA_ESTIMATE_MANAGED_SERVICE_OFFERING_R1_PRODUCTION_R1_C3_OPERATIONAL_USE_ACCEPTANCE.md`; and
8. `supabase/migrations/20260830121816_estimate_managed_service_production_forward_bridge.sql`.

Do not open, read, grep, diff, copy, hash filesystem content, or derive content
from any path outside this literal allowlist. Migration filenames and Git tree
metadata may be listed solely to calculate the local migration-version set.

## 5. Protected metadata-only paths

For these paths, pathname, mode, Git blob, and clean Git status are the only
permitted evidence:

1. `src/components/estimates/wizard/screens/ScreensPreview.tsx`
   - `100644 c1eb0dc88954f3a17cc85e313b62d5bb6a4fda3f`
2. `supabase/migrations/20260801110110_line_link_tokens.sql`
   - `100644 accd22345054cc44f89156fd78eaba6dfe4242a4`
3. `supabase/migrations/20260807135006_monthly_invoice_pdf_artifact.sql`
   - `100644 32fda49583ae1217bc13711784ad8fa31744726c`
4. `src/lib/monthly-statements/monthly-invoice-artifact-boundary.test.ts`
   - `100644 fe3c80f22fd80dcbfab076082473216dda582c14`

Never open, read, diff, copy, stage, or modify these paths. A mismatch is
`BLOCKED_EVIDENCE`.

## 6. Exact accepted source identities

| Evidence | Exact accepted value |
|---|---|
| Forward Bridge path | `supabase/migrations/20260830121816_estimate_managed_service_production_forward_bridge.sql` |
| Forward Bridge Git blob at predecessor | `9ac0cd9ed2cf8b9ff8aa8bb1598ca8fab3ad129e` |
| Forward Bridge file SHA-256 | `7406c5f11f1feb352ceb737db7844af8904f33e7a82f9679dfed40319a528cf8` |
| Accepted target function-body SHA-256 | `df49de1e6b8cf9767f32730cabdce5134b865678c63ab2d2a5c011400a2db7a6` |
| Accepted pre-apply function-body SHA-256 | `818e91850d669158a18908108e134117389948e56a42e0032dbfda7c6d882136` |
| Accepted pre-apply function-definition SHA-256 | `b745a920543a1bba59333cbe80f139a8f8c03a3fad2bac78e6614b74d580603a` |
| Rollback ciphertext SHA-256 | `7222922b30d80139967750c2a9fbb91e8aff22ae1dc2bb6e253bc75be642cb4c` |
| R1-C3 instrument SHA-256 | `9e23067a7b6c9a3b8b7b8c0eab489ffb9db710b23fca402c53ee944829459237` |
| R1-C3 activation-record SHA-256 | `69b5dd9f2c5ab287de32446b9fe7e52e7c893a6d424af63a74ea61be323973dd` |
| R1-C3 operational-use record SHA-256 | `680f9bb9532a8521a6ea584a582053565de89ed43b1fdac576407867238e0bff` |

Any mismatch stops R2. Do not repair, regenerate, normalize, or reinterpret an
identity inside the same run.

## 7. Exact migration-history correction

The executable Forward Bridge version is exactly `20260830121816`. Any later
history reconciliation must name that exact version because it is the exact
artifact whose statement may be executed.

Version `20260830160000` is the superseded former direct target. It remains
`EXCLUDED_SUPERSEDED_DIRECT_APPLY_PROHIBITED_NOT_RECORDED` and must never be
executed or marked applied by this release. R2 does not change migration
history for either version.

The expected exact local-versus-Staging unrecorded set at R2 is:

1. `20260731115631`
2. `20260801000649`
3. `20260801110110`
4. `20260825151059`
5. `20260826010000`
6. `20260826143000`
7. `20260829101726`
8. `20260830121816`
9. `20260830160000`

The live ledger must be compared with every committed local migration
filename. Any missing version outside this set, any version from this set
unexpectedly recorded, any duplicate version, or any unreadable ledger is
`CHANGES_REQUIRED_R2_PREFLIGHT`. The frozen LINE version
`20260801110110` must remain absent and unopened.

## 8. Future invocation command boundary

Only after a separate owner approval may one fresh nonpersistent terminal
Claude invocation use:

- read-only Git metadata commands for sections 3 through 6;
- `SUPABASE_TELEMETRY_DISABLED=1 supabase --version` and exact help discovery;
- one filtered read-only `supabase projects list --output-format json` call;
- one read-only
  `supabase backups list --project-ref vhiuiwolnlvlwvoaingd --output-format json`
  call; and
- one read-only database call:

```text
SUPABASE_TELEMETRY_DISABLED=1 supabase db query --linked --project-ref vhiuiwolnlvlwvoaingd --file <exact-mode-600-r2-read-only-sql> --output-format json
```

The CLI-required `--linked` flag is target-selection syntax only. It does not
authorize `supabase link`. `supabase/.temp/project-ref` must be absent before
and after the query. If it exists at either boundary, do not read or delete it;
stop with `BLOCKED_EVIDENCE`.

No Management API fallback is authorized in the first R2 attempt. A CLI
permission, response-shape, or transport failure stops the run. Do not request
broader access, switch tools, or retry.

## 9. Exact read-only SQL contract

The mode-600 SQL file must be created only inside the approved fresh
Git-external evidence root and must contain one `BEGIN TRANSACTION READ ONLY`,
bounded local statement/lock timeouts, catalog/statistics `SELECT` statements,
and one `COMMIT`. It must contain no DDL, DML, callable business RPC, helper
creation, fixture, advisory lock, credential, customer data, or function body
output.

It must return only a sanitized JSON object containing:

1. `current_database()` and `current_setting('server_version')`;
2. the complete sorted `supabase_migrations.schema_migrations.version` list
   and duplicate-version counts;
3. exactly one
   `public.save_estimate_from_wizard(uuid,uuid,jsonb)` candidate;
4. server-computed lowercase hexadecimal SHA-256 values for
   `pg_get_functiondef(oid)` and `prosrc`, using
   `encode(sha256(convert_to(..., 'UTF8')), 'hex')` so neither body is returned;
5. function owner, language, volatility, parallel mode, `prosecdef`,
   `proconfig`, `proacl`, strictness, leakproof state, result type, and identity
   arguments;
6. sorted relation existence and complete column name/type/nullability/default
   metadata for `customers`, `dealer_members`, `dealer_service_offerings`,
   `dealer_staff`, `document_sequences`, `estimate_items`, `estimates`, and
   `vehicles`;
7. sorted identity/signature metadata for
   `wiz_document_fiscal_year` and `wiz_format_document_number`;
8. aggregate-only client-backend activity counts, lock-wait counts, and
   transactions older than 30 seconds, without query text, user data, or
   application names;
9. count of ungranted locks on the eight named relations; and
10. count of prepared transactions in the current database.

Required SQL timeouts are `statement_timeout = '15000ms'` and
`lock_timeout = '3000ms'`. The controller wall-clock deadline is 30 seconds.
There is one database-query attempt only.

## 10. Fresh private evidence contract

The later owner-approved invocation may create one fresh mode-700 directory
under:

`/Users/atsushinishikawa/Documents/Codex/runtime/gda-estimate-offering-r2-preflight/`

Every file inside must be mode `600`. Use one fresh UTC-plus-random suffix; a
failed suffix is burned and never repaired or reused. Retain only:

- controller/Git attestation;
- filtered exact-project JSON;
- backup-list JSON;
- the read-only SQL file;
- sanitized database JSON containing hashes/metadata only;
- stderr/exit-code records;
- a secret-free manifest; and
- `SHA256SUMS.txt`.

Do not retain access tokens, environment values, credentials, connection
strings, function bodies, SQL result rows containing business data, customer
data, or query text. Do not print any private evidence into the terminal,
conversation, Git, or PR comment. The evidence root is retained for MacBook
Codex verification; cleanup requires a later exact-path decision.

## 11. Required R2 checks and fail-closed decision

All of the following must pass:

1. repository, PR, branch, HEAD/tree, ancestry, upstream, clean state, source
   identities, and protected metadata;
2. exact Staging project name/ref/region/status and PostgreSQL 17 identity;
3. a currently completed physical backup listing no older than the accepted
   R2 freshness boundary reported by the provider;
4. exact migration ledger and exact nine-version missing set in section 7;
5. live pre-apply function definition/body hashes equal the accepted R1-C1
   hashes, with unchanged signature, owner `postgres`, PL/pgSQL, volatile,
   parallel-unsafe, `SECURITY INVOKER`, pinned
   `search_path=pg_catalog, public, pg_temp`, and EXECUTE only for `postgres`
   and `service_role`;
6. every target dependency relation, column, helper function, type, and index
   reference required by the committed Forward Bridge is present and
   compatible;
7. no ungranted relevant lock, prepared transaction, lock-waiting client
   backend, or client transaction older than 30 seconds;
8. the R2 evidence set contains no write command or generated R3 execution
   artifact; and
9. no frozen, excluded, superseded, historical, or directory-derived migration
   appears in any executable input.

Any mismatch, missing evidence, parser ambiguity, permission denial, timeout,
unexpected output, or activity/lock conflict stops the gate. Do not repair,
retry, apply, link, decrypt, restore, or broaden scope in the same run.

## 12. Absolute prohibitions

- No repository file edit, creation, deletion, chmod, stage, commit, push,
  stash, reset, restore, branch mutation, PR comment, Ready, merge, or deploy.
- No `supabase link`, `db push`, migration apply, migration repair, migration
  history write, SQL DDL/DML, fixture, RPC call, Auth action, or Storage action.
- No Docker, Colima, local database, browser, Vercel, Production, or external
  provider other than the exact read-only Supabase CLI calls in section 8.
- No decryption, plaintext rollback artifact, restore, rollback decision, or
  rollback execution.
- No web search/fetch, MCP, Chrome, subagent, background task, reused session,
  or same-suffix retry.
- Do not open or derive content from protected paths.
- Do not generate the R3 apply artifact.

## 13. Required result schema

Return only the required result marker and:

1. one allowed verdict;
2. exact repository/PR/HEAD/tree/ancestry/upstream/clean-state evidence;
3. literal Git read paths and protected metadata-only results;
4. accepted source/hash reconciliation;
5. filtered Staging identity and backup freshness result;
6. remote migration count, latest recorded version, exact sorted missing set,
   duplicate count, and the section-7 history-correction confirmation;
7. live function hashes and complete metadata comparison;
8. dependency object/column/helper/index comparison;
9. aggregate activity, relevant lock, and prepared-transaction result;
10. evidence-root path, modes, exact file allowlist, byte counts, per-file
    SHA-256 values, manifest verification count, process exit codes, and proof
    that no function body or secret was retained;
11. mutation matrix proving every prohibited action remained false;
12. every stop reason and unresolved item; and
13. one precise next owner-approval question.

If every R2 check passes, the next question may ask only for authoring R3
Staging exact-statement apply governance. It must not ask to execute the apply.
Stop after returning the result.
