# GDA Estimate Wizard Postal Master R5 — CR3 Fresh Disposable Acceptance

GDA_ESTIMATE_WIZARD_POSTAL_MASTER_R5_CR3_FRESH_DISPOSABLE_ACCEPTANCE_V1

## 1. Decision

`PASS`

The Owner-authorized CR3 fresh disposable execution completed successfully on
2026-09-03. MacBook Codex independently accepted the retained raw evidence as
`GDA_POSTAL_R5_DISPOSABLE_DB_PASS`.

This acceptance proves one fresh, loopback-only PostgreSQL 17 / Supabase replay
of the ratified migration manifest and the postal/import runtime contract. It
does not authorize or prove a hosted replacement project, Development,
Staging, Production, provider, Vercel, real Japan Post CSV, cutover, merge, or
deployment.

## 2. Execution identity

- Repository: `nisikawa-officeAZ/GYEON`
- Branch: `agent/gda-estimate-ocr-postal-clean-replacement-r1`
- Pull request: `https://github.com/nisikawa-officeAZ/GYEON/pull/67`
- Execution HEAD: `5dba6d17529b58d1c3d54eef8fb10e57fed3b87b`
- Execution tree: `ba16a604222430d1b76ffa7688d6a4117a8b0219`
- Base: `main`
- PR state at preflight: `OPEN/Draft`
- Remote HEAD matched: `true`
- Mergeability at preflight: `MERGEABLE`
- Vercel: `PASS`
- Vercel Preview Comments: `PASS`
- Worktree before and after execution: `clean`
- Upstream ahead/behind before and after execution: `0 0`

## 3. Static preflight accepted before execution

- Result marker:
  `GDA_ESTIMATE_WIZARD_POSTAL_MASTER_R5_CR3_FRESH_DISPOSABLE_PREFLIGHT_RESULT_V1`
- Claude verdict:
  `READY_FOR_CR3_FRESH_DISPOSABLE_EXECUTION_AUTHORIZATION`
- Codex independent static acceptance: `PASS`
- Harness decision: `REUSE_EXISTING_R5_HARNESS_UNCHANGED`
- Blocked inputs: `NONE`
- Repository payload: one directive control input plus exactly thirteen
  supporting files, fourteen repository files total, zero additional files
- Claude tools, filesystem, shell, Git, browser, network, MCP, and session
  persistence: disabled

Two non-accepted preparation attempts are preserved transparently:

1. One incomplete Claude input stopped before the fourteen file bodies because
   the caller used an obsolete R4 path. It returned no required result marker
   and made no repository, runtime, database, or Supabase change.
2. One later shell invocation stopped before Claude process creation because
   the caller used obsolete protected-path metadata. It transmitted nothing
   and made no repository, runtime, database, or Supabase change.

The accepted static preflight used the exact R4 and protected paths from the
committed directive, not either obsolete caller-side summary.

## 4. Fresh disposable execution

- Fresh suffix: `20260903T114441Z-6698d3`
- Historical suffix reused: `false`
- Runtime parent:
  `/Users/atsushinishikawa/Documents/Codex/runtime`
- Retained evidence directory:
  `/Users/atsushinishikawa/Documents/Codex/runtime/gda-postal-r5-evidence/gda-postal-r5.20260903T114441Z-6698d3`
- Aggregate manifest:
  `/Users/atsushinishikawa/Documents/Codex/runtime/gda-postal-r5-evidence/gda-postal-r5.20260903T114441Z-6698d3/manifest.json`
- Aggregate manifest SHA-256:
  `f9a3b2f52e9d948293cf016eb0127c94068414ad708d7b076fec44d79a902e60`
- Lanes: `fresh`, `import`
- `fresh` setup exit: `0`
- `fresh` capture exit: `0`
- `import` setup exit: `0`
- `import` capture exit: `0`
- cleanup exit: `0`
- runtime removal exit: `0`
- retained aggregate `was_burned`: `false`
- residual suffix-matching Docker containers, volumes, or networks: `0`

## 5. Ratified migration replay

- Unique top-level formal migration SQL files: `113`
- Executable migrations staged in each lane: `112`
- Exact protected exclusion:
  `supabase/migrations/20260801110110_line_link_tokens.sql`
- Other exclusions: `0`
- Retained manifest SHA-256 in both lanes:
  `722b59ffe2b2252e826783b125df2ac1b4d2468d46743c01da0e726fe2543326`
- Postal migration version: `20260901001246`
- `supabase migration list --local` state in both lanes: `BOTH`
- Independent migration-ledger row count in both lanes: `1`
- Target migration SHA-256:
  `76748b5cae4fc1ba34c4257cb64bc9732da0e316d4c5727bab2ef170141a1f2d`
- Target migration hash match: `true`
- Provisioning pair disposition remained:
  `INCLUDE_SCHEMA_KEEP_FEATURE_DISABLED`
- GYEON partner onboarding remained disabled.

## 6. Executable assertions

### Fresh lane

- Postal master pgTAP: `75/75 PASS`
- Runtime contract pgTAP: `20/20 PASS`
- Real Auth/PostgREST request-scope assertions: `9/9 PASS`
- Real-auth stderr bytes: `0`
- Database lint command exit: `0`

### Import lane

- Import interruption phase 1: `3/3 PASS`
- Import resume phase 2: `25/25 PASS`
- Distinct phase process IDs: `true`
- Phase 1 and phase 2 stderr bytes: `0`
- Production importer validate-only proof: `PASS`, zero client construction
- Loopback URL fail-closed proof: `NON_CANONICAL_SUPABASE_URL`, zero client
  construction

### Evidence integrity

- Retained artifacts verified against aggregate manifest: `38/38`
- `fresh` secret scan: `SECRET_SCAN_CLEAN`
- `import` secret scan: `SECRET_SCAN_CLEAN`
- Source-contract revalidation mismatches in each lane: `0`
- Protected paths: pathname/mode/blob/Git-state metadata only
- Protected contents opened, read, diffed, copied, or hashed: `false`

## 7. Non-blocking observations

The current Supabase CLI emitted the configuration deprecation warning that
`[inbucket]` should move to `[local_smtp]`. The runtime remained successful.
This is maintenance work only and is not a CR3 failure.

`supabase db lint --schema public --level warning --fail-on error` exited `0`
and reported four pre-existing warnings outside the postal contract. No lint
error was reported. These warnings are not repaired in CR3 and must not be
silently treated as newly authorized scope.

## 8. Prohibited-action attestation

- Hosted Supabase project created: `false`
- Development, Staging, or Production contacted: `false`
- External Supabase/provider contacted: `false`
- Hosted migration applied: `false`
- Real Japan Post CSV imported: `false`
- Real customer/address data used: `false`
- Git file staged, committed, or pushed by the execution: `false`
- PR mutated, marked Ready, merged, or deployed: `false`
- Source, migration, test, harness, dependency, or protected path changed:
  `false`

## 9. Minimum next gate

CR3 is accepted. The next phase is `CR4 — Hosted project cost and creation
preflight` only.

CR4 must first obtain the Owner's exact Supabase organization selection and
current cost evidence. It must stop before project creation. A later explicit
cost confirmation is required, with Micro compute only, maximum life 31 days,
no paid add-ons, and a USD 12 before-tax ceiling. CR3 does not authorize CR4,
project creation, hosted replay, data transfer, real postal import, cutover,
retirement, Ready conversion, merge, or deployment.
