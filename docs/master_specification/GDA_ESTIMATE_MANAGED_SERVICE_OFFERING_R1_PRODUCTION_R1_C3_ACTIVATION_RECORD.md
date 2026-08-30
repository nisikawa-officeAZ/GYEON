# GDA Estimate Managed-Service Offering R1 Production — R1-C3 Activation Record

Marker:
`GDA_ESTIMATE_MANAGED_SERVICE_OFFERING_R1_PRODUCTION_R1_C3_ACTIVATION_RECORD_V1`

Status:
`OWNER_ACTIVATED_RECORD_CANDIDATE_UNCOMMITTED_OPERATIONAL_USE_PENDING_GIT_DELIVERY`

Owner decision recorded at: `2026-08-30T22:48:56Z`

## 1. Exact activated instrument

The owner explicitly approved activation of the following exact immutable
instrument for the following exact Staging target only:

| Field | Exact value |
|---|---|
| Repository | `nisikawa-officeAZ/GYEON` |
| Pull request | `#47` |
| Branch | `plan/estimate-managed-service-production-forward-bridge-r1` |
| Instrument path | `docs/master_specification/GDA_ESTIMATE_MANAGED_SERVICE_OFFERING_R1_PRODUCTION_R1_C3_CONDITIONAL_ROLLBACK_PREAUTHORIZATION.md` |
| Instrument commit | `3418a377c6bdacf3d00ee38867248de9ec40219b` |
| Instrument tree | `439a0b01f9b86e29c16f06fe69207886bf23d636` |
| Instrument Git blob | `4f8afaecce49d9162be9c274761a7f4c15e4de46` |
| Instrument SHA-256 | `9e23067a7b6c9a3b8b7b8c0eab489ffb9db710b23fca402c53ee944829459237` |
| Environment | `Staging` only |
| Project | `DealerOS-Dev-Next` |
| Exact project ref | `vhiuiwolnlvlwvoaingd` |
| Region | `ap-northeast-1` |

The approval is invalid if any field above differs. It is invalid for
Production ref `dmvyaykhibmphrmekjbb`, any other project, any later instrument
version, or any modified instrument content.

## 2. Activated accountable roles

| Role | Exact assignment |
|---|---|
| Operator | `MacBook Claude Code` |
| Verifier | `MacBook Codex` |
| Stop Authority | `西川 篤志 / Owner` |
| Rollback Authority | `倉庫担当者 小尾野` |

Operator cannot accept its own evidence. Verifier cannot execute rollback.
Stop Authority cannot issue `APPROVE_EXACT_HASH`. Rollback Authority cannot
execute rollback. Silence, timeout, absence, ambiguity, or role substitution is
`DENY_AND_REMAIN_STOPPED`.

## 3. Exact authority activated

After this activation record is committed and normally pushed to the bound PR
branch, the exact instrument may govern one 300-second conditional rollback
review following a future separately authorized Staging apply and an eligible
trigger defined in the instrument.

Activation permits only the recorded decision sequence ending in
`APPROVE_EXACT_HASH` or `DENY`. It does not authorize:

- provider or database access;
- the future Staging apply or verification;
- decryption or plaintext creation;
- rollback execution;
- a second apply or retry;
- migration-history repair;
- transient-source deletion;
- Production access or action;
- Ready, merge, or deployment.

Even after `APPROVE_EXACT_HASH`, the Operator must remain stopped and request a
separate exact rollback-execution gate.

## 4. Operational delivery condition

The owner activation decision is recorded, but operational use remains blocked
until all of the following are independently verified:

1. this activation record, the remediation-plan update, and the append-only
   result entry are committed together in one exact-three-path commit;
2. that commit is normally pushed to PR `#47` without force;
3. the PR remains OPEN/Draft against `main` and its HEAD contains the exact
   instrument commit/blob/SHA-256 bound in section 1;
4. the worktree and index are clean; and
5. protected blobs remain exact.

Before those checks pass, the effective state is
`OWNER_ACTIVATED_BUT_OPERATIONAL_USE_BLOCKED`.

## 5. Current authorization boundary

The owner authorized activation of the exact instrument SHA-256 and exact
Staging ref in section 1, plus authoring this activation record and the
corresponding two-document governance update candidate. Stage, local commit,
normal push, PR mutation, operational-use acceptance, provider/database access,
rollback execution, R2, shared write, history repair, Ready, merge, deployment,
and every Production action remain separate and unauthorized.
