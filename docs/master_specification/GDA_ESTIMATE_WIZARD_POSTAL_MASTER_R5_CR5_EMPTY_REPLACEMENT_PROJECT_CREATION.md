# GDA Estimate Wizard Postal Master R5 — CR5 empty replacement-project creation

`GDA_ESTIMATE_WIZARD_POSTAL_MASTER_R5_CR5_EMPTY_REPLACEMENT_PROJECT_CREATION_V1`

## 1. Result

| Field | Value |
|---|---|
| Status | `PASS_CANDIDATE_UNCOMMITTED` |
| Date | 2026-09-03 |
| Repository | `nisikawa-officeAZ/GYEON` |
| Branch | `agent/gda-estimate-ocr-postal-clean-replacement-r1` |
| Pull request | [PR #67](https://github.com/nisikawa-officeAZ/GYEON/pull/67) |
| Execution HEAD | `ec9e30d2a7865efad0739165724530e9e829befa` |
| Execution tree | `f75ec6ce2eca8d22f5152523409ad9f046ebe087` |
| Decision | `CR5_EMPTY_REPLACEMENT_PROJECT_CREATED_STOP_BEFORE_HOSTED_REPLAY` |

CR5 created exactly one empty clean-replacement Development project using the
Owner-ratified CR4 identity. The new project reached `ACTIVE_HEALTHY`. No
database connection, schema replay, migration application, restore, retained
data transfer, Storage copy, secret/configuration change, application binding,
or deployment followed.

## 2. Authorization

After CR4 was recorded and normally pushed, the Owner explicitly authorized
creation of exactly one empty Supabase project with these fixed values:

- organization: `officeAZ` (`ivlpkysdjbrkcozrvzwg`);
- project name: `DealerOS-Dev-Clean-R5`;
- region: `ap-northeast-1`;
- default Micro compute;
- no paid add-ons; and
- the CR4 provider cost confirmation for USD 10 monthly before tax.

The authorization did not include database access, SQL execution, migration
replay/application, restore from the old Development project, data export or
import, real Japan Post data, Storage, Auth, secrets, provider configuration,
Vercel variables, application cutover, old-project retirement, Git changes,
PR mutation, Ready conversion, merge, or deployment.

## 3. Created project identity

| Field | Provider result |
|---|---|
| Organization name | `officeAZ` |
| Organization ID | `ivlpkysdjbrkcozrvzwg` |
| Project name | `DealerOS-Dev-Clean-R5` |
| Project ref | `nqvnjqcxgngqsqkbpdfi` |
| Region | `ap-northeast-1` |
| Status | `ACTIVE_HEALTHY` |
| PostgreSQL engine | `17` |
| PostgreSQL version | `17.6.1.166` |
| Release channel | `ga` |
| Provider `created_at` | `2026-09-03T11:52:15.655049Z` |
| Provider `created_at`, JST | `2026-09-03 20:52:15.655049 JST` |
| Project count before creation | 3 |
| Project count after creation | 4 |

The create-project interface does not expose an explicit compute-size field in
its creation or project-detail result. Micro is the official default compute
for a new project in a paid organization, and the CR4 cost interface returned
the corresponding USD 10 monthly amount. No compute upgrade or billing add-on
operation was requested or executed. This is the bounded basis for recording
the project as default Micro; no stronger provider-response claim is made.

## 4. Clock discrepancy and conservative lifetime correction

The provider reported `created_at` as `2026-09-03 20:52:15.655049 JST`, while
the local CR5 invocation and verification were observed between
`2026-09-03 21:03:03 JST` and `2026-09-03 21:03:59 JST`. The provider timestamp
therefore precedes the observed local action by approximately eleven minutes.
The cause is not inferred, and neither timestamp is rewritten.

To preserve the maximum 31-day contract, the earlier provider timestamp is the
authoritative safety clock for lifecycle control. The Owner approved this
conservative correction:

| Lifecycle event | Corrected value |
|---|---|
| Creation clock used for deadline | `2026-09-03 20:52:15.655049 JST` |
| Automatic review | `2026-09-27 20:52:15 JST` |
| Mandatory pause/retirement decision deadline | `2026-10-04 20:52:15 JST` |

These values supersede the CR4 planning values of 21:30 JST. They shorten the
permitted lifetime and do not authorize a pause, deletion, or retirement
action. Those external mutations require their own explicit gate.

## 5. Post-creation verification

The project was retrieved by its returned ref and then observed in the
organization project inventory. Both read-only responses agreed on its name,
organization, region, status, PostgreSQL engine/version, release channel, and
provider timestamp. The inventory contained exactly the three pre-existing
projects plus the new clean replacement project.

Verification did not connect to the project's database or retrieve an API URL,
key, password, secret, Auth row, Storage object, table, migration ledger, log,
or customer/business payload.

## 6. CR6 entry contract

CR6 is `Exact hosted migration replay`. It remains unauthorized. Before any
hosted replay, a separately approved directive must bind:

- project ref `nqvnjqcxgngqsqkbpdfi` only;
- the immutable CR1 migration manifest in its proved order;
- the exact protected LINE-migration exclusion;
- no unconstrained bulk `db push`;
- no old-Development restore;
- no retained business data, Storage objects, secrets, or real Japan Post CSV;
- fail-closed checks for ledger/path parity, object definitions, RLS/policies,
  grants, triggers, functions, Data API exposure, extension versions, and
  unexpected external-capable jobs or hooks; and
- stop after schema-only hosted acceptance.

CR6 execution must receive fresh explicit Owner authorization after its bounded
preflight is independently accepted.

## 7. Boundary statement

- Exactly one hosted project created: `true`
- Existing hosted project mutated: `false`
- New project status queried through provider metadata: `true`
- New project database connected or queried: `false`
- SQL executed: `false`
- Migration replayed or applied: `false`
- Old Development restored or cloned: `false`
- Data exported, imported, copied, or restored: `false`
- Auth or Storage payload read: `false`
- Secret or API key read: `false`
- Provider configuration or add-on changed after creation: `false`
- Application or Vercel binding changed: `false`
- Real Japan Post data used: `false`
- Source, migration, test, harness, dependency, or protected path changed:
  `false`
- Documentation candidate paths changed: exactly three
- Git staged, committed, or pushed by this recording phase: `false`
- PR mutated, marked Ready, merged, or deployed: `false`

## 8. Next gate

Independently review this exact three-document candidate, the created project
identity, the provider-versus-local time evidence, the conservative deadline,
and all negative execution boundaries. Stage/local commit and normal push each
require separate Owner authorization. CR6 hosted migration replay remains a
separate, currently unauthorized external-mutation phase.
