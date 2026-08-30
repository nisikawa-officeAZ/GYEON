# GDA Estimate Managed-Service Offering R1 Production — R1-C3 Operational-Use Acceptance

Marker:
`GDA_ESTIMATE_MANAGED_SERVICE_OFFERING_R1_PRODUCTION_R1_C3_OPERATIONAL_USE_ACCEPTANCE_V1`

Status:
`OWNER_ACCEPTED_OPERATIONAL_USE_RECORD_CANDIDATE_UNCOMMITTED_GIT_DELIVERY_REQUIRED`

Owner acceptance recorded at: `2026-08-30T22:52:22Z`

## 1. Verified activation delivery

The owner accepted operational use of the exact R1-C3 instrument after the
following Git delivery conditions were independently verified:

| Field | Verified exact value |
|---|---|
| Repository | `nisikawa-officeAZ/GYEON` |
| Pull request | `#47` |
| Pull request URL | `https://github.com/nisikawa-officeAZ/GYEON/pull/47` |
| Pull request state | `OPEN/Draft` |
| Base | `main` |
| Branch | `plan/estimate-managed-service-production-forward-bridge-r1` |
| Remote HEAD | `02fca03c18441d7ae1a91a98d92e08410e27bc50` |
| Remote HEAD tree | `1b8a0754af326dd080a3483ae1fd276433ec5cc1` |
| Local/upstream divergence after push | `0/0` |
| Worktree and index after push | `clean` |
| Changed files in PR after push | `15` |

The activation-delivery commit was a normal non-force push from
`3418a377c6bdacf3d00ee38867248de9ec40219b` to
`02fca03c18441d7ae1a91a98d92e08410e27bc50`.

## 2. Exact accepted instrument and activation record

| Artifact | Git blob | SHA-256 |
|---|---|---|
| `GDA_ESTIMATE_MANAGED_SERVICE_OFFERING_R1_PRODUCTION_R1_C3_CONDITIONAL_ROLLBACK_PREAUTHORIZATION.md` | `4f8afaecce49d9162be9c274761a7f4c15e4de46` | `9e23067a7b6c9a3b8b7b8c0eab489ffb9db710b23fca402c53ee944829459237` |
| `GDA_ESTIMATE_MANAGED_SERVICE_OFFERING_R1_PRODUCTION_R1_C3_ACTIVATION_RECORD.md` | `283eed686e646ace2b643de97083302156cba6aa` | `69b5dd9f2c5ab287de32446b9fe7e52e7c893a6d424af63a74ea61be323973dd` |

Operational use is accepted only for:

| Field | Exact value |
|---|---|
| Environment | `Staging` only |
| Project | `DealerOS-Dev-Next` |
| Project ref | `vhiuiwolnlvlwvoaingd` |
| Region | `ap-northeast-1` |

This acceptance is invalid for Production ref `dmvyaykhibmphrmekjbb`, any other
project, any modified instrument, or any later instrument version.

## 3. Accountable roles

| Role | Exact assignment |
|---|---|
| Operator | `MacBook Claude Code` |
| Verifier | `MacBook Codex` |
| Stop Authority | `西川 篤志 / Owner` |
| Rollback Authority | `倉庫担当者 小尾野` |

Role substitution is not permitted. Silence, timeout, absence, ambiguity, or
target/hash drift is `DENY_AND_REMAIN_STOPPED`.

## 4. Operational-use boundary

After this acceptance record, the remediation-plan update, and the append-only
result entry are committed together, normally pushed to PR `#47`, and verified
at the remote HEAD, the exact instrument may be used only to govern one
300-second conditional rollback decision procedure following a future,
separately authorized Staging apply and an eligible trigger.

Operational-use acceptance does not authorize:

- provider or database access;
- R2 Staging preflight;
- the future Staging apply or runtime verification;
- decryption or plaintext creation;
- rollback execution;
- a retry or second apply;
- migration-history repair;
- transient-source deletion;
- Production access or action;
- Ready, merge, or deployment.

Even if the decision procedure ends in `APPROVE_EXACT_HASH`, the Operator must
remain stopped until the owner grants a separate exact rollback-execution gate.

## 5. Delivery condition for this acceptance record

The owner acceptance decision is recorded, but this new acceptance record is
not operationally effective until all of the following pass:

1. this file, the remediation-plan update, and the append-only result entry are
   committed in one exact-three-path commit;
2. the commit is normally pushed to PR `#47` without force;
3. PR `#47` remains OPEN/Draft against `main` and its remote HEAD contains this
   exact acceptance record;
4. the worktree and index are clean; and
5. all protected blobs and the exact instrument and activation-record hashes
   remain unchanged.

Until then, the effective state is
`OWNER_ACCEPTED_OPERATIONAL_USE_BUT_ACCEPTANCE_RECORD_GIT_DELIVERY_PENDING`.

## 6. Current authorization boundary

The owner authorized authoring this operational-use acceptance record and the
corresponding remediation-plan and append-only result-ledger updates only.
Stage, local commit, normal push, PR mutation, R2, provider/database access,
rollback execution, shared write, history repair, Ready, merge, deployment,
and every Production action remain separate and unauthorized.
