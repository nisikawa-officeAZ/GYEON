# GDA Estimate Managed-Service Offering R1 Production — R1-C3 Conditional Rollback Pre-Authorization

Marker:
`GDA_ESTIMATE_MANAGED_SERVICE_OFFERING_R1_PRODUCTION_R1_C3_CONDITIONAL_ROLLBACK_PREAUTHORIZATION_V1`

Status:
`DRAFT_NOT_ACTIVE_OWNER_ROLE_ASSIGNMENT_AND_SEPARATE_ACTIVATION_REQUIRED`

Date: 2026-08-31

## 1. Purpose

This instrument defines the exact conditions under which the owner may permit
a five-minute review of a rollback request after a future separately approved
Staging forward-bridge apply. It does not authorize a database query, migration
apply, rollback command, history repair, provider action, Production action,
Ready, merge, or deployment.

The default decision is always stop. Silence, timeout, ambiguity, stale
evidence, role overlap, target drift, hash drift, or missing communication
readiness means `DENY_AND_REMAIN_STOPPED`.

## 2. Exact scope binding

| Field | Exact value |
|---|---|
| Repository | `nisikawa-officeAZ/GYEON` |
| Pull request | `#47` |
| Branch | `plan/estimate-managed-service-production-forward-bridge-r1` |
| Accepted bridge implementation commit | `7f5860600fbdd8ce1b9b4bed7f070873d1a66159` |
| Accepted bridge implementation tree | `381f7987af498fd8bf0fe88cb97647f413932ed2` |
| Accepted bridge migration | `supabase/migrations/20260830121816_estimate_managed_service_production_forward_bridge.sql` |
| Accepted bridge migration SHA-256 | `7406c5f11f1feb352ceb737db7844af8904f33e7a82f9679dfed40319a528cf8` |
| Target environment | `Staging` only |
| Target project | `DealerOS-Dev-Next` |
| Exact target ref | `vhiuiwolnlvlwvoaingd` |
| Region | `ap-northeast-1` |
| Exact function | `public.save_estimate_from_wizard(uuid,uuid,jsonb)` |
| Accepted pre-apply body SHA-256 | `818e91850d669158a18908108e134117389948e56a42e0032dbfda7c6d882136` |
| Accepted pre-apply definition SHA-256 | `b745a920543a1bba59333cbe80f139a8f8c03a3fad2bac78e6614b74d580603a` |
| Accepted target body SHA-256 | `df49de1e6b8cf9767f32730cabdce5134b865678c63ab2d2a5c011400a2db7a6` |
| Rollback ciphertext SHA-256 | `7222922b30d80139967750c2a9fbb91e8aff22ae1dc2bb6e253bc75be642cb4c` |
| Decrypted capture SHA-256 | `33096a6f5fc295071b8bb06d6ebcf293febd187f25aa04bb8adc9ba19e15edda` |
| Ciphertext custody manifest SHA-256 | `388c48ad91e6093f1a7dfcbe880d7733a6dbd1a407bf811f0d3c6c1cbc762d39` |

This instrument is invalid for Production ref `dmvyaykhibmphrmekjbb`, another
Supabase project, another function signature, another migration or commit, a
re-encrypted artifact with a different hash, or any later implementation drift.

## 3. Exact custody references

- Ciphertext root:
  `/Users/atsushinishikawa/Documents/Codex/runtime/gda-estimate-offering-r1-rollback-custody/ciphertext.20260830T152354Z-I7kjNs`
- Ciphertext file: mode-600 `function-capture.json.enc`.
- Secret root:
  `/Users/atsushinishikawa/Documents/Codex/secure/gda-estimate-offering-r1-rollback-secrets/secret.20260830T152354Z-I7kjNs`
- Secret file: mode `600`, separate from the ciphertext root.
- No secret value or secret hash may enter Git, a PR, terminal output, logs, or
  the decision record.

The original `/private/tmp` copies are non-authoritative transient duplicates.
Their presence never substitutes for the durable custody roots above.

## 4. Required role assignment before activation

All four roles are currently unassigned. This document remains inactive until
the owner records one accountable identity for each role. Stop Authority and
Rollback Authority must be different identities. Operator and Verifier must
also be different identities.

| Role | Assignment | Authority |
|---|---|---|
| Operator | `OWNER_ASSIGNMENT_REQUIRED` | Freeze activity, collect only authorized evidence, and execute nothing during the decision window. |
| Verifier | `OWNER_ASSIGNMENT_REQUIRED` | Independently compare exact target, source, artifact, metadata, and evidence. |
| Stop Authority | `OWNER_ASSIGNMENT_REQUIRED` | Choose only `CONTINUE_STOPPED` or `ESCALATE_ROLLBACK_REVIEW`. |
| Rollback Authority | `OWNER_ASSIGNMENT_REQUIRED` | Choose only `APPROVE_EXACT_HASH` or `DENY`; cannot execute rollback. |

No role may self-verify its own action. A named exception to role separation
requires a separate written owner decision and creates a new document version;
it cannot be inferred from urgency.

## 5. Eligible rollback-review triggers

A rollback review may be escalated only after a separately authorized Staging
apply and only when at least one of these exact conditions is supported by
already-authorized evidence:

1. the apply boundary returned success or ambiguous completion, but the live
   function body equals neither the accepted target hash nor the accepted
   pre-apply hash;
2. the accepted target body is present but owner, `SECURITY INVOKER`, language,
   volatility, parallel mode, `search_path`, or explicit EXECUTE ACL differs
   from the accepted manifest;
3. separately authorized Staging verification proves an estimate-save
   regression directly caused by the bridge, including partial persistence,
   incorrect managed-service enforcement, or unauthorized RPC execution; or
4. the apply succeeded but exact verification cannot complete safely before
   the approved change window closes, and the Stop Authority explicitly
   escalates review based on complete pre-apply evidence.

Provider outage, unrelated UI failure, stale evidence, missing evidence,
unknown drift, credential failure, network failure before server contact, or
an unproven causal link are not rollback triggers. They require
`CONTINUE_STOPPED` and a new diagnosis gate.

## 6. Mandatory preconditions

Before the 300-second clock starts, all of the following must be true:

1. this document has been committed and normally pushed, and the owner has
   separately activated the exact version after completing section 4;
2. the future Staging apply itself was separately and explicitly authorized;
3. target project/ref and region match section 2 exactly;
4. the bridge migration, body, ciphertext, decrypted capture, and custody
   manifest hashes all match section 2 exactly;
5. the ciphertext and secret remain readable only from their separate
   protected roots with exact modes `700/600`;
6. no plaintext rollback file is retained before the execution gate;
7. the latest authorized preflight and backup evidence are current for the
   apply window;
8. the four assigned identities and the communication channel are available;
9. no migration-history repair, second apply attempt, Production action, or
   unrelated write has occurred; and
10. a separate rollback-execution gate can still be requested and recorded.

Any false or unknown condition is `DENY_AND_REMAIN_STOPPED`.

## 7. Exact five-minute decision procedure

| Deadline | Accountable role | Required action |
|---|---|---|
| `T+00:00` | Operator | Freeze the Staging action; record exact target ref, observed failure, implementation commit/tree, applied artifact hash, and last successful boundary. Run nothing further. |
| `T+00:30` | Verifier | Independently compare target ref, source commit/tree, migration hash, ciphertext/decrypted hashes, protected metadata, and accepted preflight evidence. |
| `T+01:30` | Operator | Provide only already-authorized bounded read-only outputs. Do not gather new data or mutate any system. |
| `T+02:30` | Verifier | Return exactly `PASS_EXACT_MANIFEST` or `FAIL_STOP`. Any uncertainty is `FAIL_STOP`. |
| `T+03:00` | Stop Authority | Return exactly `CONTINUE_STOPPED` or `ESCALATE_ROLLBACK_REVIEW`. Silence means `CONTINUE_STOPPED`. |
| `T+03:30` | Rollback Authority | Verify this exact active pre-authorization, role separation, exact hashes, target, trigger, and communication readiness. Any missing item is `DENY`. |
| `T+04:30` | Rollback Authority | Return a recorded `APPROVE_EXACT_HASH` bound to the exact Staging ref and ciphertext hash, or `DENY`. |
| `T+05:00` | Operator | Stop and wait. Even with `APPROVE_EXACT_HASH`, request a separate rollback-execution gate. Do not decrypt or execute rollback in this window. |

The clock is exactly 300 seconds. Timeout never extends authority and never
turns silence into approval.

## 8. Future rollback-execution boundary

R1-C3 does not authorize rollback execution. A later execution request must
bind one exact target ref, one exact ciphertext hash, one fresh execution
suffix, one attempt, a bounded command manifest, statement and lock timeouts,
post-rollback body/definition/metadata verification, evidence retention,
plaintext cleanup, and zero-residue proof.

The future execution gate may restore only the captured
`public.save_estimate_from_wizard(uuid,uuid,jsonb)` definition. It may not run a
migration directory, edit source, repair migration history, modify unrelated
objects, retry after failure, touch Production, mark Ready, merge, or deploy.

## 9. Activation decision

Current decision:
`NOT_ACTIVE_OWNER_ROLE_ASSIGNMENT_AND_SEPARATE_EXPLICIT_ACTIVATION_REQUIRED`.

Creating, reviewing, committing, pushing, or publishing this document does not
activate it. Activation requires the owner to provide all four accountable
assignments and explicitly approve this exact version for Staging ref
`vhiuiwolnlvlwvoaingd`. Rollback execution remains a later separate gate even
after activation.

## 10. Current authorization boundary

The owner authorized only authoring this pre-authorization instrument and the
corresponding two-document governance update candidate. Stage, local commit,
normal push, PR publication, role assignment, activation, transient-source
deletion, database/provider access, rollback execution, R2, schema/history
write, Ready, merge, deployment, and every Production action remain separate
and unauthorized.
