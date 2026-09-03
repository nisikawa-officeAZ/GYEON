# Claude Directive — INV001-P19-BOOK-D2-Q2 P20C Private Package Handoff Alignment

```text
MARKER: INV001_P19_BOOK_D2_Q2_P20C_PRIVATE_PACKAGE_HANDOFF_ALIGNMENT_V1
PHASE: INV001_P19_BOOK_D2_Q2_P20C_PRIVATE_PACKAGE_HANDOFF_ALIGNMENT
REPOSITORY: nisikawa-officeAZ/GYEON
MODE: GOVERNANCE_CANDIDATE_ONLY
STATUS: LOCAL_UNSTAGED_UNCOMMITTED_GATE2_PUBLICATION_BLOCKED
```

## 1. Purpose

Align Book D2 with the accepted Foundation P20C package candidate and the Owner's final evidence decision without starting package publication, registry access, Claude diagnosis, dependency installation, or Book implementation.

This directive supersedes only the stale package identity, publication-evidence, SBOM, and Claude read-scope portions of:

- `CLAUDE_DIRECTIVE_INV001_P19_BOOK_D2_PRIVATE_PACKAGE_CONSUMER.md`
- `CLAUDE_DIRECTIVE_INV001_P19_BOOK_D2_Q1R1_FOUNDATION_LANDING_ACCEPTANCE_AND_PACKAGE_PUBLICATION_HOLD.md`

All accepted D1 pure-adaptor behavior, D2 Gate A/B1/B2 separation, literal implementation allowlists, server-only boundary, no-rule-copying rule, protected paths, and later D3-D7 gates remain unchanged.

## 2. Fixed Book governance identity

| Field | Value |
|---|---|
| Repository | `nisikawa-officeAZ/GYEON` |
| Base branch | `main` |
| Base commit | `42617a4142814f17188ef8b537da0b48ae11e4d2` |
| Base tree | `704660393c4c1f3b7a8df831d7c3d085331b9670` |
| Candidate branch | `agent/inv001-p19-book-d2-q2-package-handoff-alignment` |

This governance candidate may change exactly these three paths:

1. `docs/master_specification/CLAUDE_DIRECTIVE_INV001_P19_BOOK_D2_Q2_P20C_PRIVATE_PACKAGE_HANDOFF_ALIGNMENT.md`
2. `docs/master_specification/GYEON_DA_COMPLETION_PLAN.md`
3. `docs/master_specification/GYEON_DA_PHASE_RESULTS.md`

## 3. Accepted Foundation Gate 1 identity

Foundation PR #80 has completed Gate 1 and was independently accepted:

| Field | Value |
|---|---|
| Repository | `nisikawa-officeAZ/detaileros-inventory-foundation` |
| PR | `#80` |
| Source head | `ea1044f0e0acdf475200622e2bd5ec96ce8eee34` |
| Merge commit | `2e2ff839652361e879463138f11329d8176cdebe` |
| Merge tree | `c991400af0adafd346eb7c47f45f13d0b39d4a7e` |
| Merge parents | `a5764f7821b02769ef2d4fba40d432abdc76fa56`, `ea1044f0e0acdf475200622e2bd5ec96ce8eee34` |
| Main CI | `Test and typecheck: SUCCESS` |
| Gate 1 result | `PASS_MERGED_TREE_PIN_HELD` |
| Gate 1 reconciliation | `PASS_GATE1_ACCEPTED` |

Evidence:

- Gate 1 result: `https://github.com/nisikawa-officeAZ/detaileros-inventory-foundation/issues/39#issuecomment-5525721369`
- MacBook Codex reconciliation: `https://github.com/nisikawa-officeAZ/detaileros-inventory-foundation/issues/39#issuecomment-5525778832`
- GitHub Actions run: `https://github.com/nisikawa-officeAZ/detaileros-inventory-foundation/actions/runs/33755090766`

Gate 1 proves that the package candidate landed. It does **not** prove that package version `0.1.0` has been published or can be installed.

## 4. Accepted future package identity

The future private package handoff is limited to:

```text
package: @nisikawa-officeaz/detaileros-inventory-foundation
first candidate version: 0.1.0
registry candidate: GitHub Packages
visibility: private
runtime format: server-only Node ESM with TypeScript declarations
source binding: Foundation merge commit/tree above
version overwrite: prohibited
```

The landed candidate declares:

- `main`: `./dist/package/inventoryRuntime.js`
- `types`: `./dist/package/inventoryRuntime.d.ts`
- root `exports` with `types`, `import`, and `default`
- package `files`: `dist/**`, the Foundation Integration Contract V2 JSON, and the Release Manifest V1 JSON
- narrow implementation entry: `src/package/inventoryRuntime.ts`

These values remain candidate metadata until Gate 2 produces immutable publication evidence. The current `private: true` fail-closed state must not be reinterpreted as successful publication.

## 5. Owner-ratified mandatory handoff evidence

Book D2 Gate A may open only after MacBook Codex independently accepts one self-contained Gate 2 publication receipt containing all of the following:

1. GitHub Actions publication provenance, including the immutable workflow run URL and the exact source ref used by the publication job.
2. Final Foundation merge commit and tree: `2e2ff839652361e879463138f11329d8176cdebe` / `c991400af0adafd346eb7c47f45f13d0b39d4a7e`.
3. Exact package name, version, registry, and private visibility.
4. Published tarball SHA-512/integrity value obtained from the registry publication, not from an earlier local dry run.
5. Complete tarball file catalogue with mode, byte size, and per-file digest or an equivalently immutable catalogue.
6. Export and declaration catalogue sufficient to prove the five D1 surfaces and all 18 sealed commands are reachable without source guessing.
7. Published timestamp and a statement that the same semantic version will never be overwritten or reused for another tree.
8. Explicit proof that secrets, `.npmrc` credentials, migrations, Draft SQL, tests, fixtures, and unrelated source/docs are excluded.

### SBOM decision

SBOM is `OPTIONAL_LATER`. It is not a Book D2 Gate A blocker and must not be reported as mandatory evidence. Existing D2/Q1R1 wording that couples `provenance/SBOM` as one mandatory requirement is superseded by this section. GitHub Actions publication provenance remains mandatory.

### No circular install prerequisite

An actual Book consumer installation cannot be a prerequisite for Gate A because Gate B1 is the first authorized Book installation step. Gate A requires publication metadata, artifact integrity, catalogues, declarations, and handoff evidence. Gate B1 later performs the authenticated install and lockfile pin under a separate Owner gate.

## 6. Future Claude Gate A transmission boundary

No Claude invocation or external transmission is authorized by this governance candidate.

After Gate 2 is accepted and the Owner separately authorizes Gate A, Claude may receive only:

1. the exact Book-side D2 governance and D1 adaptor files listed by the then-current Gate A instruction;
2. the published package artifact or an exact extracted copy of its published contents;
3. the registry's non-secret package metadata and integrity record;
4. the complete tarball, export, and declaration catalogues;
5. the Foundation integration-contract and release-manifest JSON files actually shipped in that package; and
6. the accepted Gate 1 and Gate 2 handoff receipts.

Claude must not receive Foundation repository private source files, tests, migrations, Draft SQL, workflow source, or unrelated documentation. In particular, `src/package/inventoryRuntime.ts` is Foundation implementation source and is not a Book Gate A transmission input. Claude must diagnose from the published compiled JavaScript, declarations, exported contract JSON, and immutable handoff evidence.

The artifact itself is private package content. Its future transmission still requires a separate explicit Owner authorization naming the exact artifact/evidence set.

## 7. Preserved D2 execution gates

### Gate A — read-only compatibility diagnosis

- Starts only after accepted Gate 2 publication evidence and separate Owner authorization.
- Tool-disabled, one pass, exact read/transmission allowlist.
- Verifies five D1 surfaces, 18 commands, actor/operator and canonical identities, fail-closed behavior, no implicit chaining/retry, server-only compatibility, and absence of production in-memory default.
- Makes no repository, package, registry, DB, provider, deployment, or Git mutation.

### Gate B1 — registry declaration and exact dependency pin

Separate Owner authorization is required. Exact change allowlist remains:

- `.npmrc`
- `package.json`
- `package-lock.json`

The token value must never be committed, printed, pasted into GitHub, or sent to Claude. GitHub Packages authentication and `read:packages` access are external prerequisites, not permission to broaden the code scope.

### Gate B2 — server-only wrapper and focused test

Separate Owner authorization is required. Exact change allowlist remains:

- `src/lib/inventory/foundation/foundation-runtime-package.ts`
- `src/lib/inventory/foundation/foundation-runtime-package.test.ts`

The three merged D1 files remain read-only. D3A persistence, D3B mapping, D4 server authority, D5 UI, D6 runtime verification, D7 legacy retirement, Android, staging, and production remain later separate gates.

## 8. Current hard stop

As of this candidate:

```text
Foundation Gate 1 PR landing: PASS / CLOSED
Foundation Gate 2 immutable package publication: NOT EXECUTED
Book D2 Gate A: BLOCKED
Book D2 Gate B1: BLOCKED
Book D2 Gate B2: BLOCKED
```

This phase authorizes no Foundation or Studio work and no Book implementation. Do not publish, download, install, authenticate to a registry, request credentials, invoke Claude, edit source/config/lockfiles, run executable application tests, stage, commit, push, mutate a PR, Ready, merge, access DB/Supabase/Auth/provider, deploy, or touch Android/staging/production.

## 9. Candidate verification and stop condition

Verify only:

1. fixed Book commit/tree and candidate branch;
2. exact three changed paths;
3. accepted Foundation Gate 1 identity and evidence URLs;
4. Gate 2 remains unpublished/unaccepted;
5. mandatory evidence versus optional SBOM decision;
6. absence of Foundation private-source transmission authority;
7. preserved Gate A/B1/B2 separation and literal allowlists;
8. protected-path metadata unchanged; and
9. `git diff --check` passes.

Then stop with the three files unstaged and uncommitted. Stage, local commit, and push each require a separate explicit Owner authorization.
