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
| Development | `DealerOS-Dev` | `fbieiotihlmpfzybowbt` | `ap-northeast-2` | Development only. Migration ledger is currently unreliable; no migration apply until a separately approved reconciliation closes the drift. |
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

## 6. Next gated work

The next permitted planning phase is a no-write environment-ledger remediation
design. It must specify how to reconcile Development drift, how to close the
Staging missing-version gap, and how to define the intentional Production
subset without applying or rewriting any migration.

The exact next-session start sequence and stop conditions are recorded in
`NEXT_SESSION_TODO_2026_08_13.md`.
