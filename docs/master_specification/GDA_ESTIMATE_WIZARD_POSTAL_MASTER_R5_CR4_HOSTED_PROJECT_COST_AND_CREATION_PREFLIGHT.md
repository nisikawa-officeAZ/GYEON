# GDA Estimate Wizard Postal Master R5 — CR4 hosted project cost and creation preflight

`GDA_ESTIMATE_WIZARD_POSTAL_MASTER_R5_CR4_HOSTED_PROJECT_COST_AND_CREATION_PREFLIGHT_V1`

## 1. Result

| Field | Value |
|---|---|
| Status | `PASS_CANDIDATE_UNCOMMITTED` |
| Date | 2026-09-03 |
| Repository | `nisikawa-officeAZ/GYEON` |
| Branch | `agent/gda-estimate-ocr-postal-clean-replacement-r1` |
| Pull request | [PR #67](https://github.com/nisikawa-officeAZ/GYEON/pull/67) |
| Recording base HEAD | `ee17c602260857f15d2a54532a17cd3ffe6429c2` |
| Recording base tree | `ec84dca3bc422216b7050e6ce5e0e5d16d05a108` |
| Decision | `CR4_COST_AND_IDENTITY_CONFIRMED_STOP_BEFORE_PROJECT_CREATION` |

CR4 passed its cost and identity preflight. The Owner selected the exact
Supabase organization, accepted the provider-reported project cost, and
ratified the bounded project identity and lifetime below. This result stops
before project creation. CR5 remains a separate external-mutation gate.

## 2. Authorization chronology

The Owner separately authorized:

1. CR4 read-only cost and organization preflight;
2. selection of the only available organization, `officeAZ`;
3. acknowledgement of the provider-reported monthly project cost of USD 10;
4. issuance of the provider cost-confirmation identifier; and
5. creation of this three-document result candidate only.

The Owner did not authorize project creation, database access, migration
replay or application, data transfer, real Japan Post import, provider
configuration changes, secret access, Git stage/commit/push, PR mutation,
Ready conversion, merge, cutover, retirement, or deployment.

## 3. Official cost evidence

The Supabase cost interface returned the following result for a new project in
the selected organization:

| Field | Value |
|---|---|
| Cost type | `project` |
| Recurrence | `monthly` |
| Amount | `USD 10` before tax |
| Contract ceiling | `USD 12` before tax |
| Ceiling result | `PASS` |
| Compute limit | `Micro` only |
| Paid add-ons | None permitted |
| Maximum lifetime | 31 days |

The Owner acknowledged the USD 10 monthly amount before the Supabase cost
confirmation interface was invoked. The returned confirmation identifier is:

`BGoZHqqJd2JYMt+cWSDFH7qDeNkZZAwbTytJrHy7r+E=`

This identifier is evidence of cost acknowledgement. It is not permission to
create a project and must be consumed only in a separately authorized CR5
operation using the exact identity in this document.

Official platform references checked on 2026-09-03:

- [Manage Compute usage](https://supabase.com/docs/guides/platform/manage-your-usage/compute)
- [About billing on Supabase](https://supabase.com/docs/guides/platform/billing-on-supabase)
- [Supabase pricing](https://supabase.com/pricing)
- [Supabase changelog](https://supabase.com/changelog)

The official documentation states that Micro compute is billed hourly at
USD 0.01344 and is approximately USD 10 per month. Paid organizations receive
USD 10 in monthly compute credits shared at the organization level. Credits
may already be consumed by other projects, and applicable tax is outside the
before-tax ceiling comparison.

## 4. Owner-ratified creation identity

| Field | Ratified value |
|---|---|
| Organization name | `officeAZ` |
| Organization ID | `ivlpkysdjbrkcozrvzwg` |
| Organization plan | `pro` |
| Project name | `DealerOS-Dev-Clean-R5` |
| Region | `ap-northeast-1` |
| Compute | `Micro` |
| Paid add-ons | None |
| Planned creation time | `2026-09-03 21:30 JST` |
| Automatic review time | `2026-09-27 21:30 JST` |
| Mandatory pause/retirement decision deadline | `2026-10-04 21:30 JST` |

Any change to the organization, project name, region, compute size, add-ons,
creation time, or deadline invalidates this identity package and requires a
new CR4 owner decision before creation.

## 5. Read-only provider inventory proof

The Supabase organization and project inventory was read without accessing a
database, secret, customer payload, Auth row, Storage object, or billing
instrument. Exactly one accessible organization and three existing projects
were reported:

| Role/name | Project ref | Region | Status |
|---|---|---|---|
| `DealerOS-Dev` | `fbieiotihlmpfzybowbt` | `ap-northeast-2` | `ACTIVE_HEALTHY` |
| `DealerOS-Prod` | `dmvyaykhibmphrmekjbb` | `ap-northeast-1` | `ACTIVE_HEALTHY` |
| `DealerOS-Dev-Next` | `vhiuiwolnlvlwvoaingd` | `ap-northeast-1` | `ACTIVE_HEALTHY` |

The inventory was checked again after cost confirmation. It still contained
exactly those three projects. `DealerOS-Dev-Clean-R5` did not exist, proving
that CR4 stopped before project creation.

## 6. CR5 entry contract

CR5 may begin only after this candidate is independently reviewed and, if the
Owner elects to persist it, the exact documentation candidate is separately
authorized for stage/local commit and normal push. CR5 additionally requires a
fresh, explicit Owner authorization for the external project-creation action.

If authorized, CR5 may create exactly one empty project using only:

- organization ID `ivlpkysdjbrkcozrvzwg`;
- project name `DealerOS-Dev-Clean-R5`;
- region `ap-northeast-1`;
- Micro compute;
- no paid add-ons; and
- the cost-confirmation identifier recorded above, if still accepted by the
  provider.

CR5 must stop if the provider rejects or changes the confirmation, presents a
cost above USD 12 before tax, selects compute above Micro, adds an add-on, or
cannot preserve the ratified identity. It must not restore the old Development
project or apply application migrations as part of project creation.

## 7. Boundary statement

- Hosted project created: `false`
- Database connected or queried: `false`
- Migration replayed or applied: `false`
- Data exported, imported, copied, or restored: `false`
- Real Japan Post data used: `false`
- Secret or billing instrument read: `false`
- Existing project mutated: `false`
- Source, migration, test, harness, dependency, or protected path changed:
  `false`
- Documentation candidate paths changed: exactly three
- Git staged, committed, or pushed by this recording phase: `false`
- PR mutated, marked Ready, merged, or deployed: `false`

## 8. Next gate

Independently review this exact three-document candidate and verify that it
records the provider cost, Owner-ratified identity, 31-day lifetime, and stop
before creation without broadening CR5. Stage/local commit and normal push each
require separate Owner authorization. Project creation remains unauthorized.
