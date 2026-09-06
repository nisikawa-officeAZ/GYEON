# Claude Directive — GDA Estimate Wizard Postal Master R5 CR3 Fresh Disposable Preflight

## 1. Directive identity

| Field | Value |
|---|---|
| Phase | `GDA_ESTIMATE_WIZARD_POSTAL_MASTER_R5_CR3_FRESH_DISPOSABLE_PREFLIGHT` |
| Directive | `GDA_POSTAL_R5_CR3_R1_FRESH_DISPOSABLE_PREFLIGHT_DIRECTIVE_V1` |
| Required result marker | `GDA_ESTIMATE_WIZARD_POSTAL_MASTER_R5_CR3_FRESH_DISPOSABLE_PREFLIGHT_RESULT_V1` |
| Mode | One tool-disabled, read-only preflight after separate Owner authorization |
| Repository | `nisikawa-officeAZ/GYEON` |
| Coordination PR | [PR #67](https://github.com/nisikawa-officeAZ/GYEON/pull/67) |
| Ratification source HEAD / tree | `9f319b222a4f8f671cd7ffaaad8ec95486b9d72e` / `99bf62b6ca68432820595cc3807777411df4e4fd` |
| R1 correction source HEAD / tree | `2ac6f9fa5f736eefbffdf28877fe793b8526eb65` / `c4e7a9f847a33bc97adba1ae4cbbec0720d4149f` |
| Supersedes | `GDA_POSTAL_R5_CR3_FRESH_DISPOSABLE_PREFLIGHT_DIRECTIVE_V1` |
| Ratified manifest | 112 executable migrations; protected LINE migration is the sole exclusion |
| Replacement region | Owner-ratified `ap-northeast-1` |

This directive authorizes no private-file transmission, Claude invocation,
test, runtime, Git mutation, Supabase/DB/provider action, project creation,
migration apply, cutover, retirement, Ready conversion, merge, or deployment
by itself. Every later action requires a separate Owner gate.

## 2. Owner-ratified CR1 decision

The Owner formally decided all of the following on 2026-09-03:

1. Current Git contains 113 unique top-level formal migration SQL files.
2. The executable manifest contains exactly 112 files.
3. The sole exclusion is
   `supabase/migrations/20260801110110_line_link_tokens.sql`.
4. Both provisioning migrations remain included as inert infrastructure under
   `INCLUDE_SCHEMA_KEEP_FEATURE_DISABLED`.
5. GYEON partner onboarding remains disabled; schema presence is not
   activation authority.
6. The accepted product-policy and canonical five-bucket forward repair is
   closed and does not block CR3.
7. `CR2_NOT_REQUIRED`.
8. The next permitted governance phase is CR3 fresh disposable acceptance
   preflight only.

Aggregate SHA-256 for the ratified 112-file current manifest is
`0d5414ac1257a287938e141d5c398f3607c3bf2650d38255f520956f15ddb5bb`.

CR3 must not reopen or choose a different manifest. Any contrary input is
`BLOCKED_INPUT` or `CHANGES_REQUIRED_GOVERNANCE`, not authority to infer a new
decision.

## 3. Objective

Determine whether the already accepted seven-file R5 disposable harness can be
reused unchanged at the later committed CR3 governance identity to execute one
new, fresh, loopback-only PostgreSQL 17/Supabase attempt proving the exact
ratified 112-file manifest.

The preflight must determine:

- whether documentation-only commits after the accepted R5 runtime leave the
  source, five R4 contract files, seven harness files, and ratified migration
  set byte-identical;
- whether the harness deterministically stages all and only the ratified 112
  migrations and records LINE exactly once as `excluded_protected` without
  opening or copying it;
- whether both provisioning migrations are included without enabling partner
  onboarding;
- whether the existing fresh/import lanes, fail-and-burn behavior, evidence
  capture, cleanup, exact runtime removal, and secret-redaction contract remain
  sufficient for CR3;
- whether any current harness, source, environment, or governance defect must
  be corrected before a separate runtime authorization; and
- the exact minimum next gate.

This is a static evidence review only. It must not execute any command, test,
runtime, or environment check.

## 4. Exact invocation input boundary

After separate Owner authorization, the Claude invocation may receive and read
exactly fourteen repository files in these two classes and no others:

- Governing control input (`1`): this committed directive file,
  `docs/master_specification/CLAUDE_DIRECTIVE_GDA_ESTIMATE_WIZARD_POSTAL_MASTER_R5_CR3_FRESH_DISPOSABLE_PREFLIGHT.md`.
- Private supporting inputs (`13`): the following exact files.

1. `AGENTS.md`
2. `docs/master_specification/GYEON_DA_COMPLETION_PLAN.md`
3. `docs/master_specification/GYEON_DA_PHASE_RESULTS.md`
4. `docs/master_specification/GDA_ESTIMATE_WIZARD_POSTAL_MASTER_R5_CLEAN_REPLACEMENT_DEVELOPMENT_PRE_EXECUTION_PLAN.md`
5. `docs/master_specification/GDA_ESTIMATE_WIZARD_POSTAL_MASTER_R5_CR1_R1_CODEX_NORMALIZED_RESULT.md`
6. `docs/master_specification/GDA_ESTIMATE_WIZARD_POSTAL_MASTER_R5_DISPOSABLE_DB_VERIFICATION_PLAN.md`
7. `scripts/e2e/gda-estimate-postal-master-r5/config.toml`
8. `scripts/e2e/gda-estimate-postal-master-r5/setup.sh`
9. `scripts/e2e/gda-estimate-postal-master-r5/capture-evidence.sh`
10. `scripts/e2e/gda-estimate-postal-master-r5/cleanup.sh`
11. `scripts/e2e/gda-estimate-postal-master-r5/real-auth.mjs`
12. `scripts/e2e/gda-estimate-postal-master-r5/import-resume.mjs`
13. `scripts/e2e/gda-estimate-postal-master-r5/runtime-contract.test.sql`

The directive is not one of the thirteen supporting files. Therefore the exact
repository-file payload count is `1 + 13 = 14`. A direct dependency outside
the one control input and thirteen-file supporting allowlist must be named by
exact path in the mandatory blocked-inputs result field. It must not be opened,
requested broadly, or inferred. Any scope expansion requires a new committed
directive and separate Owner approval.

## 5. Codex-supplied non-secret metadata attestation

MacBook Codex supplies with a later invocation:

- exact execution HEAD/tree, parent, branch, clean index/worktree, and upstream
  ahead/behind;
- PR #67 OPEN/Draft, base `main`, exact remote HEAD, mergeability, and current
  checks;
- SHA-256 plus mode/Git blob for the one committed directive control input;
- SHA-256 plus mode/Git blob for all thirteen supporting allowlisted files;
- exact repository-file payload count `14` and zero additional files;
- SHA-256 plus mode/Git blob for the exact seven harness files and exact five
  R4 source/test contract files;
- all 113 top-level formal migration pathnames in byte-sorted order;
- mode, Git blob, and SHA-256 for every non-protected migration;
- pathname, mode, Git blob, and clean state only for the protected LINE
  migration;
- the ratified 112-file aggregate manifest SHA-256;
- the accepted R5 retained manifest count/hash and aggregate evidence hash;
- protected-path pathname/mode/blob/Git-state metadata only; and
- evidence that no source, migration, test, harness, dependency, or protected
  path changed between the accepted R5 runtime source identity and the CR3
  governance identity.

Claude must not recalculate protected content hashes. Missing, duplicate,
unordered, or contradictory metadata is `BLOCKED_INPUT`.

## 6. Fixed source and harness metadata

The later Codex attestation must match these accepted values unless a new
governance phase explicitly supersedes this directive.

### Seven harness files

| Path | Mode | Git blob | SHA-256 |
|---|---|---|---|
| `scripts/e2e/gda-estimate-postal-master-r5/config.toml` | `100644` | `e72ab562cd35ec49ae0615a271467b5d2b75c929` | `b2cf83a1177d266952b7509889a514353f80873aedfb30383820c1e63918bba4` |
| `scripts/e2e/gda-estimate-postal-master-r5/setup.sh` | `100644` | `4c58c463653f386190bd90d1ada4b90c6a66a8ac` | `bf05fcd5dccd27dfc1bcfce0298d44fce64f5dcf0acbca14bd17832cffb5bdef` |
| `scripts/e2e/gda-estimate-postal-master-r5/capture-evidence.sh` | `100644` | `d613a20ab3d2663b105639d7d720231ebc844dbe` | `c170688b6f3c82ef365bc4da7f79917bd00eb0737c6e36f8615092f8f2b3e530` |
| `scripts/e2e/gda-estimate-postal-master-r5/cleanup.sh` | `100644` | `5a9bc305bccd36dce7d0829c4ac3569273e445c7` | `e93ae999bfe3bbc8aa0d9710c9ef720001d1c7979c405bc60e47a06bde7d8be3` |
| `scripts/e2e/gda-estimate-postal-master-r5/real-auth.mjs` | `100644` | `c85623e46a96f62c5a33ccde23a2af5e39f89297` | `78c200ca975f79d4c9490b463217aca4c18ee995be4b1eb2ba3ac58170c1373b` |
| `scripts/e2e/gda-estimate-postal-master-r5/import-resume.mjs` | `100644` | `2d9475c763c0b0e1b609b8d0027b395c02595f5b` | `ebc88871f42d1092e75d1dcc721d802de9c86e57fa1f9d3915b5460cd5c1b999` |
| `scripts/e2e/gda-estimate-postal-master-r5/runtime-contract.test.sql` | `100644` | `8c6b48a296784721b658e3c769852e88fffbacdf` | `6794c8164927aa1f2bad14713696b1e9d916fc687429b5cb5f6cda5d4a8d149f` |

### Five R4 source/test contract files

| Path | Mode | Git blob | SHA-256 |
|---|---|---|---|
| `supabase/migrations/20260901001246_jp_postal_master.sql` | `100644` | `65d2dd2096c29bceaf0060ffaf0f7b77117f0ede` | `76748b5cae4fc1ba34c4257cb64bc9732da0e316d4c5727bab2ef170141a1f2d` |
| `supabase/tests/jp_postal_master_rpc.test.sql` | `100644` | `81894d341dde80eb5bfda418629ae932aaa5cd93` | `c77fe474dd038b0de04d9e038c3191003a230f27884a6834ec85635fa1e153cd` |
| `src/lib/geo/jp-postal-master-migration-contract.test.ts` | `100644` | `2b653364d0938e55787395cdfd845c9bcfcb1f30` | `6685578850c2f0d4078e2a78aa9563d3e6b389908242c8184cde02bdad92ca60` |
| `scripts/postal-master/import-japan-post.ts` | `100644` | `49fea46a9e1b3f013d72c385f22107321b046cbd` | `46d0029e70fee826c6b06be5c182e85865805c0f4a2f67f11bc44be009af6ab6` |
| `scripts/postal-master/import-japan-post.test.ts` | `100644` | `71f9fa3e07e648205d916101b835367c7fbd10a6` | `1cc766e86b4d828e5c81fabb8808c373981d9e639ae9407290391515f42168cd` |

Accepted R5 evidence remains:

- staged count `112`, excluded count `1`;
- retained `migration-manifest.txt` SHA-256
  `722b59ffe2b2252e826783b125df2ac1b4d2468d46743c01da0e726fe2543326`;
- aggregate evidence SHA-256
  `92af4ed809cd42476810a00786b0c6d7d86888186f23fc761fde2c9f5c2cff31`;
- accepted marker `GDA_POSTAL_R5_DISPOSABLE_DB_PASS`; and
- old accepted suffix `20260903T090318Z-54ce39` is historical evidence and
  must never be reused for CR3.

## 7. Required diagnosis

### CR3-P-A — Identity and drift

Confirm whether the supplied execution identity is documentation-only relative
to the accepted harness/source identity and whether all fixed metadata matches.
Any source, migration, test, harness, dependency, or protected-path drift must
be reported exactly and must block runtime authorization.

### CR3-P-B — Ratified manifest enforcement

Confirm from the allowlisted harness and attestation that the future attempt:

- stages exactly 112 formal migrations in byte order;
- excludes exactly the protected LINE migration without reading/copying it;
- includes both provisioning migrations;
- does not include `DRAFT_DO_NOT_APPLY`, seeds, archived SQL, generated SQL,
  tests, or nested migration directories; and
- records the postal version exactly once in the local migration ledger.

### CR3-P-C — Reuse versus repair

Return exactly one of:

- `REUSE_EXISTING_R5_HARNESS_UNCHANGED`; or
- `REPAIR_REQUIRED` with the smallest literal path set and exact defect.

Do not redesign an already accepted harness because its historical status text
is stale. Do not declare reuse solely because files exist; require matching
metadata and contract coverage.

### CR3-P-D — Fresh-attempt envelope

Confirm all of the following are mandatory for a later separately authorized
CR3 execution:

- one unused suffix under
  `/Users/atsushinishikawa/Documents/Codex/runtime`, outside the repository and
  all general OS temporary roots;
- two isolated loopback-only lanes, `fresh` and `import`;
- PostgreSQL 17 and locally installed tools only;
- no hosted link, `.temp/project-ref`, canonical hosted URL, pooler, provider,
  Development, Staging, or Production contact;
- confirmation literal `I_UNDERSTAND_GDA_POSTAL_R5_IS_DISPOSABLE`;
- fail/burn on any failure, no suffix repair or reuse;
- retained hash-bound evidence outside the worktree and temporary roots;
- both lane stops, exact runtime removal, container removal, secret scan, and
  retained-hash verification; and
- no real Japan Post CSV or real customer/address data.

The historical accepted R5 suffix cannot substitute for CR3 because the
governing clean-replacement plan explicitly requires one fresh post-
ratification attempt.

### CR3-P-E — Minimum next gate

If the result is ready, return only a recommendation for a later separate
Owner authorization of one exact CR3 disposable execution. Do not authorize or
run it. If repair is required, return the smallest literal repair allowlist and
stop before implementation.

## 8. Mandatory result format

Return one Markdown report with exactly this top-level structure:

```text
GDA_ESTIMATE_WIZARD_POSTAL_MASTER_R5_CR3_FRESH_DISPOSABLE_PREFLIGHT_RESULT_V1
verdict: <one allowed verdict>
execution_identity:
scope_and_drift:
ratified_manifest_enforcement:
harness_reuse_or_repair:
fresh_attempt_envelope:
blocked_inputs:
minimum_next_gate:
prohibited_action_attestation:
```

Allowed verdicts:

- `READY_FOR_CR3_FRESH_DISPOSABLE_EXECUTION_AUTHORIZATION`
- `CHANGES_REQUIRED_GOVERNANCE`
- `CHANGES_REQUIRED_HARNESS`
- `CHANGES_REQUIRED_SOURCE`
- `BLOCKED_INPUT`

`PASS`, `RUNTIME_PASS`, `READY_FOR_PROJECT_CREATION`, and any hosted-apply
verdict are invalid.

## 9. Prohibited actions

Claude must not:

- use tools, network, web search, GitHub API, filesystem access, shell, Git,
  tests, typecheck, build, package installation, Supabase CLI, PostgreSQL,
  Docker, Colima, Auth, PostgREST, Storage, browser, Vercel, provider, or any
  external service;
- open or request a file outside the one directive control input and exact
  thirteen-file supporting allowlist;
- inspect `.env*`, secrets, keys, tokens, credentials, real user/customer/
  vehicle/address rows, Auth identities, or Storage objects;
- open, read, diff, copy, or hash the protected LINE migration or
  `ScreensPreview.tsx`;
- write, edit, create, delete, rename, format, stage, commit, push, mutate
  PR #67, mark Ready, merge, apply a migration, create a project, import data,
  cut over, retire a project, or deploy; or
- weaken the ratified manifest, GYEON onboarding disabled state, fail/burn
  rule, fresh suffix rule, loopback-only boundary, or separate Owner gates.

## 10. Exit and responsibility

MacBook Claude owns this one bounded static preflight only. MacBook Codex
independently checks the result against Git metadata, accepted R5 evidence, and
the Owner-ratified manifest. The Owner separately decides whether to authorize
one fresh CR3 runtime attempt. CR4 cost review, project creation, hosted replay,
retained-data transfer, configuration, real Japan Post CSV import, cutover,
retirement, Ready, merge, and deployment remain blocked.
