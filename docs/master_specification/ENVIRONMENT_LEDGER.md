# DealerOS Environment Ledger

## 1. Authority

| Field | Value |
|---|---|
| Status | Canonical and binding |
| Owner decision | 2026-08-12 |
| Evidence phase | PR #2 Gate B-R1 read-only reconciliation |
| Applies to | GYEON / DealerOS Supabase environments |

This document is the canonical environment identity ledger. When an older
runbook, checklist, comment, or manual uses a conflicting environment name or
project role, this ledger wins. Historical evidence is not rewritten; the
conflict must be recorded and resolved before an operation is authorized.

## 2. Canonical environment identities

| Role | Supabase project name | Project ref | Region | Operation policy |
|---|---|---|---|---|
| Development | `DealerOS-Dev` | `fbieiotihlmpfzybowbt` | `ap-northeast-2` | Development only. Gate B-R3 selects clean replacement as the remediation candidate. Keep this project read-only until an accepted cutover; no project creation, data copy, migration apply, or retirement without its separate explicit gate. |
| Staging | `DealerOS-Dev-Next` | `vhiuiwolnlvlwvoaingd` | `ap-northeast-1` | **Formal staging from 2026-08-12.** The legacy project name remains unchanged. Read or write access, linking, migration apply, test data creation, reset, and deployment each require the applicable explicit gate. |
| Production | `DealerOS-Prod` | `dmvyaykhibmphrmekjbb` | `ap-northeast-1` | Protected production. No link, write, migration apply, reset, or deployment without a production-specific owner gate and release evidence. |

Supabase preview branches, including PR-specific branches, are preview
environments. They are not staging and cannot satisfy a staging acceptance
gate.

## 3. Gate B-R1 read-only baseline

Observed on 2026-08-12 without schema or data changes:

| Check | Development | Staging | Production |
|---|---:|---:|---:|
| Recorded migrations | 2 | 100 | 88 |
| PR #2 executable migration versions recorded | 0 / 59 | 58 / 59 | 46 / 59 |
| Missing PR #2 version of special concern | 59 versions | `20260801110110_line_link_tokens` | 13 versions, including `20260801110110_line_link_tokens` |

Additional findings:

- Development contains schema markers that its two-row migration ledger does
  not explain. It must be treated as ledger-drifted, not reproducible.
- Staging and Production share 88 recorded migration versions. Their stored SQL
  statement fingerprints matched for all 88 common versions.
- The `line_link_tokens` marker was absent from all three inspected live
  environments.
- The dealer-facing policies from migration 064 use `owner_user_id` in all
  three environments.
- `public.pg_version()` was absent in Development. In Staging and Production it
  was `SECURITY DEFINER`, had a pinned `search_path`, and was not executable by
  PUBLIC at inspection time. This live state does not waive source-level Gate C
  hardening.

These values are an observed baseline, not authorization to synchronize the
environments.

## 4. Binding operating rules

1. Resolve a target by both role and exact project ref before any connection.
2. A project name, local link, preview branch, or Vercel environment is never
   sufficient proof of the target role.
3. Read-only audit does not authorize linking, writes, migration repair,
   migration apply, test fixtures, reset, branch merge, or deployment.
4. Migration audit, repair, runtime verification, commit, push, staging apply,
   production apply, and deployment remain separate gates.
5. Never repair a migration ledger by inserting history rows unless the exact
   schema and stored statements were independently reconciled and the owner
   explicitly approved that repair.
6. Never promote Staging evidence to Production evidence. Production requires
   its own preflight, apply approval, and post-apply verification.
7. Secrets, passwords, service-role keys, and connection strings must not be
   recorded in Git or PR comments.

## 5. Known conflicting historical documents

- `docs/STAGING_SETUP.md` is a setup template. Its create/link/apply examples do
  not override this ledger and do not authorize an operation.
- `docs/MANUAL_APPLY_082_083.md` historically labels
  `fbieiotihlmpfzybowbt` as Production. That label is incorrect under this
  ledger; the ref is Development.
- `OPERATIONS_RULES.md` defines the current CLI safety boundary and references
  this ledger for exact environment identities.

## 6. Gate B-R1A evidence completion

The expanded read-only reconciliation is recorded in PR #2 comments:

1. [Git and migration-source baseline](https://github.com/nisikawa-officeAZ/GYEON/pull/2#issuecomment-5260388451)
2. [Three-environment comparison](https://github.com/nisikawa-officeAZ/GYEON/pull/2#issuecomment-5260389298)
3. [Complete result and exact missing sets](https://github.com/nisikawa-officeAZ/GYEON/pull/2#issuecomment-5260390169)

The evidence refined, but did not change, the binding baseline:

- Development: all inspected root objects/functions remain unresolved as
  partial or out-of-band. No history repair is justified.
- Staging: all non-frozen PR #2 migration candidates are recorded. The only
  absent PR #2 executable version is the frozen LINE migration.
- Production: 13 PR #2 versions are absent. Ten are active-path release
  prerequisites, two are deferred behind the disabled GYEON onboarding feature
  gate, and one remains frozen.

## 7. Gate B-R2W remediation-design candidate

| Field | Value |
|---|---|
| Status | `ACCEPTED_AND_PUSHED` |
| Candidate date | 2026-08-12 |
| Candidate base HEAD | `b892efa30d65581bc5b6768e2b6f89d2bf11d28f` |
| Candidate base tree | `7999b4b39f5f5e4c4c7e0b3f4a63301e3ac52968` |
| Plan | `ENVIRONMENT_REMEDIATION_PLAN.md` |
| Database writes | None |
| Migration/history changes | None |

The candidate disposition is:

| Environment | Remediation disposition | Current stop |
|---|---|---|
| Development | B-R2W deferred selection between replacement Development and side-by-side reconciliation. Gate B-R3 evidence below supersedes that deferral by selecting clean replacement; in-place history relabel remains rejected. | Follow Section 8 after the B-R3A candidate is accepted and committed. |
| Staging | `PRESERVE_NO_APPLY`; run a future read-only focused acceptance only. The frozen LINE exception stays absent. | Separate Staging read-only gate required. |
| Production | Ten `required_before_release`, two `intentionally_deferred`, one `prohibited/frozen`. Bulk push is prohibited because it can include the frozen path. | Separate execution-mechanism decision, backup/PITR gate, Staging acceptance, and Production-specific owner approvals required. |

The exact classification, dependencies, source hashes, risk controls, restore
requirements, future gate order, and literal source allowlists were accepted
and pushed in commit `4e5f365ca8bd30ce1173ab7284e0ef2bff39d1a1`.
No environment operation is authorized by that documentation commit.

## 8. Gate B-R3 Development remediation selection

| Field | Value |
|---|---|
| Status | `DOCUMENT_CANDIDATE_UNCOMMITTED` |
| Candidate date | 2026-08-12 |
| Candidate base HEAD | `4e5f365ca8bd30ce1173ab7284e0ef2bff39d1a1` |
| Candidate base tree | `e50e518a17adff1e29883255ac326cb6bb1f25e5` |
| Read-only selection evidence | [PR #2 comment 5260655658](https://github.com/nisikawa-officeAZ/GYEON/pull/2#issuecomment-5260655658) |
| Database/project operations | None |
| Documentation allowlist | `ENVIRONMENT_REMEDIATION_PLAN.md`, `ENVIRONMENT_LEDGER.md` |

Binding candidate ruling:

- Select a clean replacement Development project built from a disposable-
  proved, non-frozen Git migration manifest.
- Keep current Development read-only until old/new acceptance and cutover are
  accepted. A later default-discard classification does not authorize deletion
  from this project.
- Import only an owner-approved retained-data and Storage subset. Regenerate
  schema, policies, grants, migration history, buckets/policies, keys, and
  configuration rather than copying the drifted baseline.
- Treat side-by-side forward reconciliation as fallback only when a retention
  audit proves non-recreatable identities or business data cannot be safely
  migrated.
- Keep in-place migration-history relabel rejected.
- Keep frozen LINE work and disabled GYEON partner onboarding outside the
  rebuild, data-copy, and activation scope.

The next gate after independent acceptance of this candidate is a documentation
commit gate for exactly the two allowlisted paths. Project creation, Supabase or
DB connection, data export/import, migration replay/apply, test, secret
rotation, push, cutover, and old-project retirement remain later separate
owner gates.
