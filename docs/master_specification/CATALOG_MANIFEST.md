# DealerOS Catalog Manifest Contract

## 1. Authority and status

| Field | Value |
|---|---|
| Phase | `R4Q-R12C_CATALOG_MANIFEST_DOCUMENT_AND_PGTAP_CANDIDATE` |
| Status | `STATIC_UNCOMMITTED_CANDIDATE_NOT_RUNTIME_PROOF` |
| Repository / PR | `nisikawa-officeAZ/GYEON` / PR #2 |
| Pinned base | `2f0b56cdc3d66cbe4ce050cfa335678934fb1cb2` |
| Pinned head | `4a5c896b32ef0b5708f89f6a63c29d07e92d34ac` |
| Pinned tree | `f24f5c173cdbb532314343cbefa01e0811fcb93a` |
| R12B acceptance | [PR #2 comment 5283279059](https://github.com/nisikawa-officeAZ/GYEON/pull/2#issuecomment-5283279059) |
| Runtime test path | `supabase/tests/catalog_manifest.test.sql` |
| pgTAP plan | `plan(76)` |

This contract is source-derived from the pinned PR #2 head. It defines the
expected final catalog after the ordered executable migration set, but it does
not claim that any current Development, Staging, Production, preview, or local
database already matches that catalog. No database connection, migration
replay/apply, pgTAP execution, typecheck, build, commit, push, Ready, merge, or
deployment occurred in R12C.

## 2. Exact migration boundary

The executable input is exactly 99 ordered migration paths. The SHA-256 of the
exact LF-terminated, Git-tree-ordered lines
`<mode> <type> <blob>\t<path>\n` is:

`06701e35b85d94dd5b4ce2d51a3726493cb983fca821da94e463fc637ad21a4e`

The following migrations are excluded and content-protected. Only their Git
metadata was used:

| Path | Mode | Blob |
|---|---:|---|
| `supabase/migrations/20260731115631_gyeon_dealer_provisioning.sql` | `100644` | `4c7feafa37d40dc2a4a48e5f153e4ddf2d439430` |
| `supabase/migrations/20260801000649_gyeon_provisioning_pin_function_search_path.sql` | `100644` | `0c51088ab8a8e39777b943ea487d0108f442bfe6` |
| `supabase/migrations/20260801110110_line_link_tokens.sql` | `100644` | `accd22345054cc44f89156fd78eaba6dfe4242a4` |

`src/components/estimates/wizard/screens/ScreensPreview.tsx` is also
content-protected; metadata is mode `100644`, blob
`c1eb0dc88954f3a17cc85e313b62d5bb6a4fda3f`.

## 3. Canonical coverage

| Category | Source ledger rows | Runtime expected rows |
|---|---:|---:|
| Relations | 82 | 82 |
| Columns | 1,154 | 1,154 |
| Primary keys | 82 | 82 |
| Unique constraints | 16 | 16 |
| Check constraints | 190 | 190 |
| Foreign keys | 146 | 146 |
| Explicit indexes | 206 | 206 |
| RLS relation flags | 82 | 82 |
| Policies | 190 | 190 |
| Relation ACL atomic grants | 463 | 463 |
| Function EXECUTE ACL grants | 30 | 30 |
| Storage buckets | 5 | 5 |
| Functions | 70 | 70 |
| Triggers | 59 | 59 |
| Extension capability classifications | 38 | 0 expected-present rows |
| Schema classifications | 6 | 1 application-owned row |
| **Total** | **2,819** | **2,776** |

Function and Function EXECUTE ACL grant counts include the 6 rows added by the
GDA-2A-OCR-POSTAL-MASTER-R2-A1 correction described in section 7 (64→70
functions, 24→30 EXECUTE ACL grants; both `expected_function` and
`expected_function_execute_acl` in `supabase/tests/catalog_manifest.test.sql`
now carry these rows).

The 43-row difference is deliberate: 38 extension-capability classifications
and five non-application schema classifications remain design traceability,
not fabricated live expected-present rows. Installed extension names/versions
remain runtime-unknown until a later authorized disposable execution gate.

The canonical ledger contains 45 artifact entries. The bytewise path-sorted
`<path>\t<sha256>\n` combined digest accepted in R12B is:

`84deba630d63466debddae965a998fecde4cb486cfb2d73680b82b875a689f15`

## 4. Fixed pgTAP plan

The single SQL file contains 76 plan-counting assertions:

| IDs | Coverage |
|---|---|
| 01–09 | relations and columns |
| 10–34 | keys, constraints, foreign keys, and explicit indexes |
| 35–60 | RLS, policies, relation/function grants, and buckets |
| 61–71 | functions and triggers |
| 72–75 | extension capability and application schema boundaries |
| 76 | relation owner source contract |

Each set category has fixed count, missing, unexpected, duplicate, and
security/integrity no-weaker checks as applicable. Policy expectations are
created from the 190 accepted source expressions on structure-only shadow
tables and read back through `pg_policies`, so expected and actual predicates
are parsed/deparsed symmetrically without weakening USING/WITH CHECK coverage.
The expected policy set is public 173 plus storage 17.

Relation owner assertion 76 and function owner assertion 66 implement the
source contract `owner=postgres` derived from migration 104. In this document
that is `SOURCE_CONTRACT_NOT_RUNTIME_PROOF`; it becomes runtime evidence only
if a later authorized execution actually runs and passes those assertions.

## 5. Bounded normalization rulings

Catalog deparsers do not preserve every source-format choice. To prevent
deterministic false failures without altering quoted identifiers or literals:

- explicit-index `definition` is traceability-only; identity, uniqueness,
  method, ordered key/include items, predicate, validity, and readiness remain
  exact;
- function `normalized_definition` is traceability-only because the accepted
  ledger intentionally stores the non-body header while
  `pg_get_functiondef` returns the body and canonicalizes SET syntax; the
  other 11 function fields remain exact;
- trigger `normalized_definition` is traceability-only because accepted source
  text preserves mixed qualification/case while `pg_get_triggerdef`
  canonicalizes them; the other 14 trigger fields remain exact;
- policy expressions are not discarded or text-normalized: PostgreSQL parses
  the accepted expected expressions on shadow tables and both full policy rows
  are compared in canonical catalog form.

These exclusions do not prove function bodies or textual DDL identity. Body
hash/behavior, real request-scope authorization, and concurrency remain later
verification work.

## 6. Stop and next gate

R12C ends at an uncommitted four-path candidate. `GRANT_RLS_ROLE_MATRIX`,
`DATA_API_MATRIX`, runtime behavior, migration replay/apply, and later-suite
mixing are excluded. The next gate must first independently review this static
candidate. Disposable migration replay and pgTAP execution require a separate
explicit owner approval and a fresh isolated local environment. Commit, push,
Ready, merge, and deployment are later independent gates.

## 7. GDA-2A-OCR-POSTAL-MASTER-R2 addendum (2026-09-01)

`supabase/migrations/20260901001246_jp_postal_master.sql` adds a new `private`
schema and six new `public` schema RPCs. This addendum is, like the rest of
this document, `STATIC_UNCOMMITTED_CANDIDATE_NOT_RUNTIME_PROOF`: no migration
replay, pgTAP execution, or database connection occurred while authoring it.

Catalog impact, scoped to what the R12C-era suites actually check:

- `docs/master_specification/CLAUDE_DIRECTIVE_GDA_ESTIMATE_WIZARD_POSTAL_MASTER_R2_IMPLEMENTATION.md`
  is the governing directive; `supabase/tests/jp_postal_master_rpc.test.sql`
  (new, `plan(40)`) is the dedicated pgTAP candidate for the new schema/RPCs.
- `supabase/tests/grant_rls_role_matrix.test.sql`'s `expected_function_execute_acl`
  grows from 24 to 30 rows (6 new `public` RPC grants: 2 to `authenticated`,
  4 to `service_role`). The three new `private` schema tables carry zero
  anon/authenticated grants and zero RLS policies, so — because sections 01-15
  of that file are scoped to `n.nspname = 'public'` and sections 16+ to
  `n.nspname in ('public', 'storage')` — they are correctly out of scope for
  every existing relation/policy assertion in that file and require no
  `public`-relation-count (82) or policy-count (190) change.
- `supabase/tests/data_api_matrix.test.sql`'s embedded literal inventory grows
  from 98 to 100 rows (2 new `.rpc(...)` literals — the two `authenticated`-only
  lookup RPCs called from `src/lib/geo/jp-postal-master-actions.ts`). The four
  `service_role`-only import RPCs are not literals in `src` (they are called
  from `scripts/postal-master/import-japan-post.ts`, outside `src`, via a
  non-literal function-name variable) and are therefore correctly absent from
  that inventory.
- This document's section 2/3 canonical `public`-schema relation/column/etc.
  counts (82 relations, 1,154 columns, and so on) are unaffected: every new
  table in this migration lives in the new `private` schema, which this
  document's existing scope does not enumerate. A full reconciliation of the
  `private` schema's own relation/column/index/trigger counts, and of this
  document's "Schema classifications" row, is deferred to the later disposable
  migration-replay/pgTAP gate referenced in section 6, consistent with that
  gate already being the sole authority for runtime-verified catalog claims.
- GDA-2A-OCR-POSTAL-MASTER-R2-A1 (2026-09-01) corrected the gap this section
  previously admitted: `supabase/tests/catalog_manifest.test.sql`'s
  `expected_function` and `expected_function_execute_acl` fixtures now carry
  the 6 new `public` functions (64→70) and their 6 EXECUTE ACL grant rows
  (24→30; 2 to `authenticated` for the lookup RPCs, 4 to `service_role` for
  the import RPCs), and assertions 51, 55, and 61 were updated to the
  corrected 30/70 counts. Both `actual_function` and `actual_trigger` in that
  file are scoped to `n.nspname = 'public'`, so the migration's new `private`
  schema function (the `jp_postal_import_batches` identity-immutability
  trigger function) and its trigger are correctly out of scope for this
  file and require no fixture row — consistent with section 2/3 already
  excluding the `private` schema's own relations/columns from this
  document's enumeration. `volatility`/`security type`/argument-identity
  values for the 6 new rows are derived directly from the migration's own
  `CREATE FUNCTION` statements (a source-available fact, not a live-catalog
  guess); only the excluded, traceability-only `normalized_definition` field
  (per section 5) was not attempted byte-exact. This file is still
  `STATIC_UNCOMMITTED_CANDIDATE_NOT_RUNTIME_PROOF`: no migration replay,
  pgTAP execution, or database connection has occurred, so the corrected
  assertions remain unverified against a live catalog until the later
  disposable-DB gate in section 6 actually runs them.
