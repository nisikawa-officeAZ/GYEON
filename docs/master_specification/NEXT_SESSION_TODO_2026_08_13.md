# DealerOS Next Session TODO — 2026-08-13

> **Status:** `SUPERSEDED_HISTORICAL_HANDOFF_DO_NOT_EXECUTE`
>
> This file preserves the handoff state recorded at its creation commit as
> historical evidence. Sections 3–7, including the embedded Claude instruction,
> have been superseded and must not be executed. Gate B-R2/R3/R4 and the
> self-reference-safe metadata repair were completed after this snapshot.
>
> Current authority is the live authority block in
> [GYEON PR #2](https://github.com/nisikawa-officeAZ/GYEON/pull/2),
> `ENVIRONMENT_LEDGER.md` §13,
> `ENVIRONMENT_REMEDIATION_PLAN.md` §§15.6–16, and the
> [R4Q-R6 result](https://github.com/nisikawa-officeAZ/GYEON/pull/2#issuecomment-5266829109).
> Do not infer a current commit SHA, PR scope, approval state, or next phase from
> this historical file.

## 1. Session state

| Field | Value |
|---|---|
| Closed at | 2026-08-12, Asia/Tokyo |
| Repository | `nisikawa-officeAZ/GYEON` |
| Pull request | PR #2 |
| Branch | `fix/approval-center-delete-access-cut` |
| PR state at close | OPEN / Ready / not merged |
| Accepted parent head | `7e2fac3a9f69efbf9b59ff526079de5aabf0bfc8` |
| Accepted parent tree | `166dbddee4b1bd49955497814038239a2cd2f891` |
| Canonical environment ledger | `docs/master_specification/ENVIRONMENT_LEDGER.md` |
| Gate B evidence | PR #2 comment `5255127667` |
| Gate B-R1 evidence | PR #2 comment `5255292181` |
| Current ruling | `CHANGES_REQUIRED_LEDGER_FIXED_REMEDIATION_PLAN_REQUIRED` |

The commit containing this handoff will be newer than the accepted parent head.
At restart, use the latest PR #2 handoff comment to verify the exact remote head
and require it to be a descendant of the accepted parent.

## 2. Decisions that must not drift

1. `DealerOS-Dev` / `fbieiotihlmpfzybowbt` is Development.
2. `DealerOS-Dev-Next` / `vhiuiwolnlvlwvoaingd` is formal Staging from
   2026-08-12. Its legacy name does not change its role.
3. `DealerOS-Prod` / `dmvyaykhibmphrmekjbb` is Production.
4. A Supabase preview branch is not Staging.
5. Development is ledger-drifted and not currently reproducible.
6. The unapplied `20260801110110_line_link_tokens` migration remains frozen.
   Its absence is not authorization to apply it.
7. Audit, design, source repair, runtime verification, commit, push, Staging
   apply, Production apply, Ready, merge, and deployment remain separate gates.

## 3. Tomorrow's first phase

### Gate B-R2 — no-database-write environment remediation design

**Start state:** `OWNER_APPROVAL_REQUIRED`

**Proposed documentation allowlist after explicit approval:**

1. `docs/master_specification/ENVIRONMENT_REMEDIATION_PLAN.md` — new
2. `docs/master_specification/ENVIRONMENT_LEDGER.md` — result/cross-reference
   only if required

No application source, migration, test, configuration, secret, or deployment
file belongs to Gate B-R2.

## 4. Ordered TODO

### B-R2.0 — restart preflight

- Read PR #2 latest comments and exact remote head.
- Confirm PR #2 is still open, unmerged, and on
  `fix/approval-center-delete-access-cut`.
- Confirm the restart head descends from
  `7e2fac3a9f69efbf9b59ff526079de5aabf0bfc8`.
- Confirm the local index and worktree are understood before any document edit.
- Stop if the head, tree, PR state, or candidate paths do not match the handoff.

### B-R2.1 — Development remediation design

- Explain the mismatch between two recorded migrations and the observed live
  schema markers.
- Define a read-only manifest needed to map each live object to Git provenance.
- Separate exact-match objects, out-of-band objects, and unresolved objects.
- Define a future repair gate without inserting migration history rows,
  applying SQL, or changing live schema.

### B-R2.2 — Staging remediation design

- Preserve the 100-row recorded baseline and the 58/59 PR #2 version result.
- Record `20260801110110_line_link_tokens` as a deliberate frozen exception,
  not an automatic defect repair.
- Define prerequisites for any future LINE-specific release gate without
  enabling LINE, applying the migration, or creating data.
- Do not use Staging evidence as Production acceptance evidence.

### B-R2.3 — Production subset design

- Classify the 13 PR #2 versions absent from Production as one of:
  `required_before_release`, `intentionally_deferred`, or
  `prohibited/frozen`.
- Record dependencies and rollback evidence required for each future candidate.
- Do not connect to, link, modify, or test against Production in this phase.

### B-R2.4 — plan acceptance package

- Produce exact future path allowlists for any later repair.
- State required preflight, validation, rollback, cleanup, and stop conditions.
- Separate Development repair, Staging apply, Production apply, and deployment
  into independent owner approvals.
- Run `git diff --check` only for the approved documentation candidates.
- Return the design candidate to Codex for independent review before commit.

## 5. Claude read-only diagnosis instruction

Use the following only after the owner explicitly approves Gate B-R2:

```text
PHASE: DEALEROS_PR2_GATE_B_R2_ENVIRONMENT_REMEDIATION_DESIGN_DIAGNOSIS
TARGET: MACBOOK_CODEX

Work from GYEON PR #2 and the latest non-superseded Gate B / Gate B-R1
evidence. Read ENVIRONMENT_LEDGER.md and NEXT_SESSION_TODO_2026_08_13.md first.

This is Git-evidence and design analysis only. Do not connect or link to any
Supabase project. Do not execute SQL, inspect user rows, apply or repair
migrations, create test data, edit source or migration files, run DB tests,
stage, commit, push, mark Ready, merge, or deploy.

Verify the exact PR head, base, tree, ancestry, status, and the proposed
two-document allowlist. Produce a bounded remediation design for:
1) Development ledger drift,
2) Staging's frozen line_link_tokens exception, and
3) Production's intentional 13-version subset.

Return findings, exact future gates, exact path allowlists, rollback evidence
requirements, unresolved decisions, and a PASS or CHANGES_REQUIRED diagnosis.
Do not make files changes during diagnosis.
```

## 6. Absolute stop conditions

Stop and return to the owner if any of the following occurs:

- The PR head is not a descendant of the recorded parent.
- A new migration, source path, secret, or protected path enters scope.
- Live Supabase access is required to answer a design question.
- A proposed action would link, write, apply, repair history, reset, seed,
  deploy, merge, or change Production.
- The frozen LINE decision must change.
- The Production subset requires a product or security decision.

## 7. Definition of success for tomorrow's first phase

Gate B-R2 is successful only when a documentation-only candidate explains how
to remediate each environment without performing the remediation, contains
literal future gates and allowlists, passes independent Codex review, and
leaves all databases and application source unchanged.
