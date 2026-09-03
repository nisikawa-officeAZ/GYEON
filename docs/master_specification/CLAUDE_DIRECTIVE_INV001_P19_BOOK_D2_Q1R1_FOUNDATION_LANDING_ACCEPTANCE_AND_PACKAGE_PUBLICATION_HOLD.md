# Claude Directive — INV001-P19 Book D2 Q1R1 Foundation Landing Acceptance and Package Publication Hold

## 1. Identity

- Directive: `INV001_P19_BOOK_D2_Q1R1_FOUNDATION_LANDING_ACCEPTANCE_AND_PACKAGE_PUBLICATION_HOLD_V1`
- Result marker: `INV001_P19_BOOK_D2_Q1R1_FOUNDATION_LANDING_ACCEPTANCE_AND_PACKAGE_PUBLICATION_HOLD_RESULT_V1`
- Book repository: `nisikawa-officeAZ/GYEON`
- Book base branch: `main`
- Fixed Book base commit/tree: `e69917e97df695b1ede9487969afb73381c22bd4` / `153bccf1babc279d323c38060c1678e645a7e5c9`
- Foundation repository: `nisikawa-officeAZ/detaileros-inventory-foundation`
- Accepted Foundation main commit/tree: `a5764f7821b02769ef2d4fba40d432abdc76fa56` / `958d3517cec45432131d41b4962d0676cd56aced`
- Foundation PR: `https://github.com/nisikawa-officeAZ/detaileros-inventory-foundation/pull/79`
- Reviewed Foundation source commit: `9982d70aa358ebe2c1900d183a42eab7c8a0d65f`
- Q1R1 acceptance: `https://github.com/nisikawa-officeAZ/detaileros-inventory-foundation/issues/39#issuecomment-5521647803`
- Existing D2 directive: `docs/master_specification/CLAUDE_DIRECTIVE_INV001_P19_BOOK_D2_PRIVATE_PACKAGE_CONSUMER.md`
- Existing D2 governance merge: Book PR `#57`, merge `2e1df23f1aa64b7c9ca2a608f36f2dccd107cf7b`
- Proposed branch: `agent/inv001-p19-book-d2-q1r1-foundation-landing-hold`
- Current verdict: `BLOCKED_FOUNDATION_PACKAGE_UNPUBLISHED`

This directive accepts the Foundation Q1R1 landing identity while keeping Book D2 fail-closed. It does not replace the existing D2 contract, authorize a package publication, grant registry access, or start D2 Gate A, B1, or B2.

## 2. Accepted Landing Evidence

MacBook Codex independently verified all of the following:

1. Foundation PR #79 merged normally to `main` as `a5764f7821b02769ef2d4fba40d432abdc76fa56`.
2. The merge tree is `958d3517cec45432131d41b4962d0676cd56aced` and matches the reviewed source tree.
3. The merge parents are the prior Foundation main `c0cc42de8ef1e95482b31a981a7d2d6e2571fa8e` and reviewed source `9982d70aa358ebe2c1900d183a42eab7c8a0d65f`.
4. PR #79 changed exactly its accepted seven paths.
5. The P18 source base remains `dc712cf1ee22dce47b97b220fc2bfe777e5a7d5d` / `54913f658aee6e39fb3b86e6de021b403900a2b3`.
6. The P19 PR #78 landing remains independently recorded as merge `c0cc42de8ef1e95482b31a981a7d2d6e2571fa8e`, tree `c2e925295e1e0384010e6744a5c7ec15cb7668a1`, reviewed head `18eaeb0afc380544e99e1aebe991a98e51b8c7f6`.
7. Artifact hashes and combined hash `6c0e8015bf023f702fe2c81de08d5938f619e921100b975bf41261340526bbd5` matched.
8. Focused tests passed `5/5`, `5/5`, and `16/16`; the whole suite passed `73 files / 1030 tests`; typecheck, GitHub CI, and `git diff --check` passed.

These facts accept the Q1R1 documentation/hashing correction only. They are not package-publication evidence.

## 3. Current Package Blocker

At accepted Foundation main `a5764f7821b02769ef2d4fba40d432abdc76fa56`, `package.json` still proves:

- package name: `detaileros-inventory-foundation`;
- version: `0.1.0`;
- `private: true`;
- no `main`;
- no `exports`;
- no `types`;
- no `files` allowlist;
- no build or publish script;
- only test and typecheck scripts.

Therefore the accepted Foundation source is not yet a proven consumable immutable package. Book must not install, copy, vendor, wrap, or emulate it.

## 4. Registry Evidence Boundary

The authenticated GitHub API could not list user-owned npm packages because the current credential lacks `read:packages`; the API returned HTTP 403. This means registry publication state is `NOT_VERIFIED_CREDENTIAL_SCOPE`, not proof that a package is absent.

No token may be pasted into chat, committed, logged, printed, read from an environment file, or copied from a keychain. Package metadata inspection and package publication are separate external gates.

## 5. Required Foundation-Owned Publication Prerequisite

Before Book D2 Gate A can run, a separately owner-authorized Foundation phase must produce and independently accept all of the following:

1. exact private scoped identity `@nisikawa-officeaz/detaileros-inventory-foundation`;
2. one immutable exact semantic version bound to one Foundation source commit and tree;
3. `main`, `exports`, `types`, `files`, and server-compatible ESM entry points;
4. compiled runtime and declaration output from a reproducible clean build;
5. exact export catalogue for the 18 sealed commands, audit read, snapshot V3 export, V1/V2/V3 import, and recovery-evidence evaluation;
6. package tarball filename, size, SHA-512/integrity, complete file catalogue, and proof no unintended file is shipped;
7. provenance/SBOM reference and dependency/lock evidence;
8. private visibility and credential-safe consumer installation evidence;
9. rollback/unpublish/deprecation boundary that does not mutate an already accepted version;
10. confirmation that draft SQL, migrations, secrets, environment files, test-only fixtures, local evidence, and unrelated source are excluded.

The Foundation repository owns this publication work. Book must not repair or publish Foundation from the GYEON repository.

## 6. Required Handoff Back to Book

The Foundation result must supply non-secret evidence containing:

- repository, publication PR, merged commit, and tree;
- exact package name and version;
- registry host and private visibility;
- published timestamp and immutable version identifier;
- tarball integrity and complete file/declaration/export catalogues;
- source commit/tree binding;
- provenance/SBOM reference;
- clean-build, package-content, consumer-install, test, typecheck, and rollback results;
- explicit zero-secret statement;
- explicit confirmation that no DB, migration, Supabase, Android, provider, deployment, staging, or production action occurred.

Missing, partial, ambiguous, mutable, floating, credential-bearing, or unverifiable evidence keeps D2 blocked.

## 7. D2 Reopening Rule

Book D2 Gate A may be proposed only after MacBook Codex independently accepts the complete Foundation publication handoff. Gate A still requires separate Owner authorization for the exact private Book and Foundation files transmitted to Claude.

Gate A, Gate B1 dependency pin, Gate B2 wrapper implementation, stage/commit, push/Draft PR, review, Ready, merge, D3A, D3B, D4, D5, D6, D7, Android, DB, provider, staging, deployment, and production remain separate gates.

## 8. Exact Governance Change Allowlist

This Q1R1 hold package may change only:

1. `docs/master_specification/CLAUDE_DIRECTIVE_INV001_P19_BOOK_D2_Q1R1_FOUNDATION_LANDING_ACCEPTANCE_AND_PACKAGE_PUBLICATION_HOLD.md`
2. `docs/master_specification/GYEON_DA_COMPLETION_PLAN.md`
3. `docs/master_specification/GYEON_DA_PHASE_RESULTS.md`

No application, package, lockfile, source, test, route, UI, migration, or configuration path is authorized.

## 9. Protected Paths

Do not open, read, diff, copy, transmit, stage, or modify the contents of:

- `src/components/estimates/wizard/screens/ScreensPreview.tsx`
- `src/components/ScreensPreview.tsx`
- `supabase/migrations/20260801110110_line_link_tokens.sql`
- `supabase/migrations/20260807135006_monthly_invoice_pdf_artifact.sql`
- `src/lib/monthly-statements/monthly-invoice-artifact-boundary.test.ts`

Only pathname, mode, blob identity, and clean/dirty state may be verified.

## 10. Absolute Prohibitions

- No Claude private-source transmission or invocation from this governance creation.
- No Foundation edit, package build, publication, registry login, dependency install, or credential request.
- No `.npmrc`, `package.json`, `package-lock.json`, wrapper, D1 source, persistence, mapping, route, UI, or test change.
- No source copy, Git dependency, submodule, floating version, HTTP invention, legacy fallback, in-memory production fallback, rule duplication, dual read/write, retry, automatic command chain, or guessed success.
- No DB, Supabase, migration, Auth, Storage, provider, Android, deployment, staging, or production action.
- No stage, commit, push, PR mutation, Ready, merge, tag, release, or branch deletion without a separate Owner gate.

## 11. Required Local Verification

Verify only:

1. Book fixed base commit/tree;
2. exact three-document change allowlist;
3. Foundation PR #79 merge identity and tree;
4. Foundation accepted `package.json` blocker facts;
5. HTTP 403 registry evidence classified as `NOT_VERIFIED_CREDENTIAL_SCOPE`;
6. no claim that publication exists or is absent without evidence;
7. D2 Gate A/B1/B2 remain blocked and separate;
8. protected-path metadata unchanged;
9. `git diff --check` for the three documents;
10. final unstaged/uncommitted state until a separate delivery approval.

No executable application test, typecheck, build, install, package request, or registry retry is required or authorized by this governance-only candidate.

## 12. Exit Gate

This phase exits only after the exact three-document candidate is independently accepted and delivered through separately authorized stage/commit, push/Draft PR, review, Ready, and merge gates.

Its completion records the Foundation landing and the correct D2 hold. It does not authorize Foundation publication or Book D2 execution. The next unblocker is a separately owner-authorized Foundation-owned immutable private package publication phase.
