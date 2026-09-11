# Claude Directive — GDA Estimate Wizard Postal Master R5 CR1-R1 Result Format Correction

## 1. Directive identity

| Field | Value |
|---|---|
| Phase | `GDA_ESTIMATE_WIZARD_POSTAL_MASTER_R5_CR1_R1_RESULT_FORMAT_CORRECTION` |
| Directive | `GDA_POSTAL_R5_CR1_R1_RESULT_FORMAT_CORRECTION_DIRECTIVE_V1` |
| Required result marker | `GDA_ESTIMATE_WIZARD_POSTAL_MASTER_R5_CR1_R1_RESULT_FORMAT_CORRECTION_RESULT_V1` |
| Mode | One tool-disabled, format-only normalization after separate Owner authorization |
| Repository | `nisikawa-officeAZ/GYEON` |
| Coordination PR | [PR #67](https://github.com/nisikawa-officeAZ/GYEON/pull/67) |
| Source-evidence HEAD / tree | `216d8cf9aa0dd9135f224aabe90dd5e800fc800e` / `0b9f494a1714dd4d6f002ae3c284ee623d6592a9` |

This directive authorizes no Claude invocation by itself. A later invocation
requires separate Owner authorization for the exact format-correction payload.

## 2. Reason for correction

The one authorized CR1 diagnosis completed successfully and returned the
required CR1 marker plus a detailed evidence review. Its substantive finding
was one internally consistent 112-migration recommendation. The report is not
formally acceptable because it omitted the mandatory literal `verdict:` line
and did not use the exact top-level field structure required by CR1 section 7.

MacBook Codex therefore classifies the delivered artifact as
`CHANGES_REQUIRED_GOVERNANCE`. This classification concerns report format only;
it does not reject, reopen, or alter the substantive findings.

## 3. Exact correction input boundary

A future CR1-R1 invocation may receive only:

1. this directive file in full; and
2. the exact Markdown text returned by the already completed CR1 invocation.

No repository source file, migration content, test content, 113-path metadata
table, secret, environment file, database row, provider response, or new
evidence may be sent or requested. The prior report already contains the facts
needed for this mechanical normalization.

If the exact prior report is unavailable or materially altered, return
`BLOCKED_INPUT` and stop. Do not reconstruct it from other files.

## 4. Frozen substantive findings

CR1-R1 must preserve these findings exactly and must not re-diagnose them:

- execution HEAD/tree:
  `216d8cf9aa0dd9135f224aabe90dd5e800fc800e` /
  `0b9f494a1714dd4d6f002ae3c284ee623d6592a9`;
- PR #67 was OPEN/Draft, base `main`, remote HEAD matched, and both Vercel
  checks passed;
- there were exactly 113 unique, byte-sorted, top-level formal migrations;
- the recommended executable manifest contains 112 migrations;
- the only exclusion is
  `supabase/migrations/20260801110110_line_link_tokens.sql`;
- recommended aggregate manifest SHA-256 is
  `0d5414ac1257a287938e141d5c398f3607c3bf2650d38255f520956f15ddb5bb`;
- provisioning disposition is
  `INCLUDE_SCHEMA_KEEP_FEATURE_DISABLED` for both provisioning migrations;
- the postal target remains
  `supabase/migrations/20260901001246_jp_postal_master.sql` with SHA-256
  `76748b5cae4fc1ba34c4257cb64bc9732da0e316d4c5727bab2ef170141a1f2d`;
- active-member product read, authenticated write denial, service-role CRUD,
  exact five-bucket configuration, `completion-reports` fail-closed absence,
  and operation-specific Storage policies are already closed by the accepted
  forward repair and focused test evidence;
- no remaining source prerequisite blocks CR3;
- `CR2_NOT_REQUIRED`; and
- the minimum next gate is CR3 fresh disposable governance, not project
  creation, hosted replay, migration apply, or provider execution.

Any change to these findings is prohibited in CR1-R1 and must be reported as
`CHANGES_REQUIRED_GOVERNANCE` rather than silently rewritten.

## 5. Required output

Return exactly one Markdown report with no preface, epilogue, extra numbered
sections, tables outside the named fields, implementation advice, or commands.
Use this exact top-level structure and spelling:

```text
GDA_ESTIMATE_WIZARD_POSTAL_MASTER_R5_CR1_R1_RESULT_FORMAT_CORRECTION_RESULT_V1
verdict: READY_FOR_CR1_MANIFEST_RATIFICATION
execution_identity:
scope_and_protected_path_evidence:
113_path_attestation:
r5_vs_b_r3_reconciliation:
provisioning_pair_disposition:
product_policy_and_storage_prerequisite:
recommended_manifest:
remaining_blockers:
next_gate:
prohibited_action_attestation:
```

Each field may contain concise nested Markdown bullets, but the eleven field
labels above must each appear exactly once and in that order.

The only valid successful verdict is
`READY_FOR_CR1_MANIFEST_RATIFICATION`. If the exact prior report is unavailable,
return the same structure with `verdict: BLOCKED_INPUT` and identify only that
missing input under `remaining_blockers:`.

`PASS`, `READY_FOR_PROJECT_CREATION`, source-change verdicts, and hosted-apply
verdicts are invalid.

## 6. Prohibited actions

Claude must not:

- use tools, network, web search, GitHub, filesystem, Git, shell, browser,
  Supabase, PostgreSQL, Docker, Colima, Auth, Storage, provider, or Vercel;
- open or request any repository file other than the already supplied text of
  this directive;
- receive the twelve private CR1 source files or the 113-path metadata table a
  second time;
- inspect, recalculate, reinterpret, or change hashes, file counts, exclusions,
  source findings, evidence levels, or the provisioning disposition;
- write, edit, create, delete, stage, commit, push, mutate PR #67, mark Ready,
  merge, apply a migration, create a project, cut over, retire, or deploy; or
- authorize CR3 execution or clean-replacement project creation.

## 7. Exit and responsibility

MacBook Claude owns only the mechanical report normalization. MacBook Codex
must compare the returned structure and every frozen finding literally against
this directive. The Owner alone may ratify the manifest. CR3 authoring,
disposable execution, project creation, hosted replay, retained-data transfer,
configuration, real Japan Post CSV import, cutover, and retirement remain
separate future gates.
