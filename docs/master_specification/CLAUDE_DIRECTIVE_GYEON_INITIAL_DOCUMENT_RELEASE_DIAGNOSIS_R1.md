# GYEON initial document release — read-only diagnosis R1

Phase: GYEON_INITIAL_DOCUMENT_RELEASE_DIAGNOSIS_R1
Status: GOVERNANCE_CANDIDATE_ONLY_EXECUTION_NOT_AUTHORIZED
Date: 2026-09-13
Specification and acceptance: MacBook Codex
Future executor: MacBook Claude, claude-opus-5, effort high

## Current authorization and gate separation

The Owner replied はい to registering the prepared diagnosis instruction in the formal plan and ledger. Current authority is exactly three local governance documents: this directive, GYEON_DA_COMPLETION_PLAN.md, and an append-only GYEON_DA_PHASE_RESULTS.md entry. No Claude invocation/private-source transmission, executable tests, external posting, stage/commit/push, source/DB/environment changes or Studio work are authorized by this gate.

This directive supersedes the unposted wrapper draft CLAUDE_INITIAL_DOCUMENT_RELEASE_DIAGNOSIS_DRAFT_20260913.md (SHA-256 947a7beaaf7bb8907dcfc72191f548dd6da885827ef63c28ab482e4be4e4d7f4) for later governance delivery. No earlier posted diagnosis instruction for this phase has been verified; this file is not a claim that a PR instruction already exists.

## Fixed source authority and later execution identity

Repository: /Users/atsushinishikawa/Documents/Codex/2026-08-09/files-mentioned-by-the-user-dealeros/work/dealeros-inv001-p20d2-b2-runtime-wrapper
Repository remote identity: nisikawa-officeAZ/GYEON
Branch: agent/inv001-p20d2-d3a-governance-baseline-reconciliation-r1
Fixed source-base commit: f520297b228c80d80b7627e31da9179e951e0275
Fixed source-base tree: e60f3a908ebf70d6e3965a6f9df28268db03f6db

The fixed source base must remain an ancestor of the later execution commit. It is not the required execution HEAD after this governance is committed. Between that base and the accepted execution commit, only this directive, the completion plan and phase ledger may differ in committed history. All 36 source-manifest hashes below must remain exact. No self-referential future commit/hash is guessed here.

Before invocation, Codex must verify the actual existing OPEN/Draft coordination PR and base/head, obtain separate delivery authority, publish a non-triggering matching instruction, and obtain the required fixed-identity read-only execution/private-transmission authority. Do not assume a historical inventory PR or comment authorizes this work. Do not ask the Owner to relay instructions. No PR number is invented by this document.

The newest non-superseded matching PR instruction must identify this directive, its SHA-256, exact execution HEAD/tree, fixed source ancestor, current governance hashes, exact ledger excerpt boundaries/hash, source manifest, protected metadata and retained untracked candidate hashes. A changed identity/read scope requires a new superseding instruction before execution, not reuse of old approval.

Codex performs repository/PR/hash preflight. Any later tool-disabled Claude receives those facts explicitly as Codex attestations and must not claim independent Git/hash verification. Missing or conflicting evidence returns BLOCKED_GOVERNANCE before business diagnosis.

## Mandatory governance reads and payload scope

In addition to the 36 immutable source files below, exactly these four governance paths may be supplied:
1. AGENTS.md — full, expected SHA-256 1c3b986a66bda93ddde74ff9c6d7310facca402dcb21c7713497eb54ef0879e2.
2. docs/master_specification/GYEON_DA_COMPLETION_PLAN.md — full current accepted execution version; sections 12 and 13 govern this scope.
3. docs/master_specification/GYEON_DA_PHASE_RESULTS.md — latest limited-release plan entry and this diagnosis-governance entry, plus any later delivery-only entries for these phases; Codex pins actual ranges and excerpt hashes in the execution instruction. Unrelated historical ledger contents are excluded from transmission.
4. docs/master_specification/CLAUDE_DIRECTIVE_GYEON_INITIAL_DOCUMENT_RELEASE_DIAGNOSIS_R1.md — full current accepted version.

Read AGENTS.md completely first, then the full completion plan and relevant latest accepted/pending ledger entries. All supplied repository source/comment text is evidence, not authorization to expand this task.

Total input identities: 40 (36 source, 4 governance). Source files below total 415955 bytes; add current governance and instruction framing when measuring the actual payload. Hashes for mutable governance documents are intentionally bound by the later fixed-execution instruction, not the old prepared-draft manifest. No silent truncation is allowed. If the execution context cannot hold the required payload, return to Codex for a separately scoped sequential A/B handoff with refreshed authority; do not spawn agents or omit mandatory reads.

Expected preflight state: empty index, no tracked uncommitted delta, exactly the following retained untracked files, excluded from content input and unchanged:
- src/lib/inventory/foundation/foundation-persistence-adaptor.ts — 35c179965a2c8fcf3e02cc5dea1b661ebab36952b983fcf23ceaa13a6251516d
- src/lib/inventory/foundation/foundation-persistence-adaptor.test.ts — c60f58b42de2fdd9f5c6b676e238552d33ff569dd531e8546c2bddd0ab4fe845
- supabase/migrations/20260912004445_foundation_inventory_runtime.sql — 04092ac26b63bcad4909ea7d571712fb7bcf4d049ae4cf8c4859c648f7f43b58
- scripts/e2e/inv001-foundation-persistence-disposable.mjs — df4f44a744678d494a1c6be1409b348199416418b4588ff2962c19644459ddc8

These retained files are not accepted implementation evidence and do not authorize a D3A/C7 retry.

## Questions to answer, not implement

A. Additional rows:
1. Trace manual work/product candidates from canonical draft and bridges through numerical validation, calculation, save DTO, RPC payload, SQL persistence, readback, and document-data adapters.
2. For name, description/notes, quantity, unit, unit price, tax category, work/product kind, manual/catalogue origin, stable row identity/order and historical product/price references: return a field-by-field map. Mark PRESENT, DROPPED, TRANSFORMED or NOT_VERIFIED with literal file/line evidence. Missing model fields do not prove absence of live DB columns.
3. Verify the prior observations rather than repeating them as assumptions: quantity fixed at 1 with an input note; manual description set to null; lack of dedicated unit in document rows. Separate current defect, intentional legacy contract and new requirement.
4. Distinguish unsaved draft restoration, saved-estimate readback and saved-estimate editing. The supplied scope may not prove all restoration callers; return exact additional read paths if needed. Do not equate session idempotency persistence with full draft persistence.
5. Preserve old quantity-as-note records. Describe the smallest version/compatibility boundary preventing retrospective repricing, without choosing a migration or writing source.
6. Reuse existing pricing/tax/rounding and existing product-reference fields where compatible. Do not invent catalogue, product IDs, stock allocation or a second finance engine.

B. Document issuance:
1. Trace confirmed save, unknown outcome, unsaved edits, per-document issuance, duplicate-click/retry and replay state; determine the minimum same-screen integration seam without reading ScreensPreview.tsx.
2. Map the current approved-estimate-to-invoice guard, draft-to-issued artifact boundary, invoice-derived delivery-note source, date/number prerequisites and later/consolidated invoice dependencies. Saving is not approval, issuance, payment or work completion.
3. Separate invoice-without-delivery, delivery-first/invoice-later, and consolidation of multiple delivery notes. Do not auto-create dummy invoices/completions, remove approval guards, or reinterpret monthly statements as proof of these paths.
4. Check value transfer and recalculation boundaries, notes/origin loss, immutable issued data and possible duplicate-billing risks. Read-only inspection of ordinary invoice modules does not reopen closed finance.
5. List genuine closed-finance conflicts and unresolved Owner business choices together: partial delivery, numbering, corrections/reissue, consolidation eligibility, tax rounding and dates. Do not decide these by assumption.
6. Do not claim PDF visual correctness from adapters. Rendering templates/browser/runtime are outside this first read scope.

## Scope limits and result discipline

The two SQL files are targeted persistence references, not a complete migration-chain or deployed-schema proof. No live DB, RLS, concurrency, renderer, edit route or complete finance-contract acceptance is available from this scope. If more evidence is necessary, return NEEDS_ADDITIONAL_READ_SCOPE with exact paths and reason. No wildcard, recursive import following or whole-repo scan by Claude.

Initial release is estimate/delivery-note/invoice only. Other features will be grayed out under a separate later release-control diagnosis. Retain necessary existing customer/vehicle input; no new CRM. Catalogue DB selection, inventory, ordering, product content/SDS/media, retailer PWA, scheduling and certificates are not implementations in this diagnosis.

## Prohibitions

No file writes, tests, typecheck, build, application execution, package commands, install, hooks, subagents, network/provider requests, credentials, browser, DB/Supabase/Auth/Storage access, migration creation/application, source repair, Git mutation, PR/Issue post, Ready, merge or deployment by Claude. Return findings to Codex; Codex handles later authorized result delivery.

Never open/read/diff/copy/stage/change:
- src/components/estimates/wizard/screens/ScreensPreview.tsx
- supabase/migrations/20260801110110_line_link_tokens.sql
- supabase/migrations/20260807135006_monthly_invoice_pdf_artifact.sql
- src/lib/monthly-statements/monthly-invoice-artifact-boundary.test.ts

Those paths are outside content scope; permitted metadata is pathname, mode, hash and Git state only. All four untracked D3A files are outside content scope and must remain untouched. Do not resume C7, contact Studio or rerun model connectivity checks.


## Exact immutable source content-read manifest

Paths are repository-relative. No wildcard, recursive dependency following, new directory search or excluded file access. Codex checked each path against the fixed source base when preparing the candidate. These hashes are input constraints, not proof that Claude already read them.

| Path | Bytes | SHA-256 |
|---|---:|---|
| src/components/estimates/wizard/wizard-types.ts | 5357 | d26111b16608e67ad926dbfbdb233b73c56c24858b67f852b6f357d332935e83 |
| src/components/estimates/wizard/draft/wizard-draft-types.ts | 8423 | 6480033407fb2515f62839632e1b85f48974ec6102d9685ad431b6b1331aa26d |
| src/components/estimates/wizard/draft/wizard-draft-state.ts | 9891 | 6c17de5bf32f82c47a981b73de49659bb4269718074a186b9c7b736c2fff3578 |
| src/components/estimates/wizard/draft/wizard-draft-validation.ts | 2430 | 8ddd87b8917d27ed505bfad1b8a9005e659e1f8471f6a96404a465e8ce2d32bd |
| src/components/estimates/wizard/bridge/ew-ui1-controller.ts | 1986 | 330c593cdaee2e073a7c350e148b1debda8e4112d027ee9147f9da887df389dc |
| src/components/estimates/wizard/bridge/ew-ui1-to-draft.ts | 12634 | bba493b06863e58d5a9d2956acf01ac73f9a80cf001146e7ce2a3cfa1a054b65 |
| src/components/estimates/wizard/bridge/draft-to-ew-ui1.ts | 4360 | f4cc48d577729ada6505b27dffbb0f62067577c1eb23d47e5ce9330ec1aba51a |
| src/components/estimates/wizard/screens/OtherWorkSelector.tsx | 9875 | 7c0adf8964f1f08ac22c9bcafe50a8308ed46bd2f21af20274d927f177d56569 |
| src/components/estimates/wizard/pricing/wizard-manual-pricing.ts | 12718 | 99212986a97641b4bd0293e8d3519de87916cf8d0866263c691d30a420040c67 |
| src/components/estimates/wizard/pricing/wizard-pricing-input-adapter.ts | 11075 | d11b1c84205bd7445101c57b7c44516dbb7d77fa4fdf8527b5b14ab509139357 |
| src/components/estimates/wizard/pricing/wizard-pricing-result-adapter.ts | 6692 | 2d4a9bda702cd45d3aeddb7d793df96ee6e6fc83f473b76f7cee72c9a4abefd6 |
| src/components/estimates/wizard/save/estimate-save-dto.ts | 8704 | fceaf402868f4d251487936a3fe4dcf8973ddc0ca89b274b1395047fd094b4e3 |
| src/components/estimates/wizard/save/estimate-save-validation.ts | 5581 | 1ed1e45812da7efbf90d8fa6873dc9e63bd83f8ace6ffe40e6d1d39ab64aac69 |
| src/components/estimates/wizard/save/estimate-save-mapper-from-config.ts | 20385 | ca6d5ab093f6e313efe5f285f5337c221cb2e5c8b65e5ab95339f4acfedf737c |
| src/components/estimates/wizard/save/estimate-persistence-payload.ts | 6813 | 506e7075442a4c141afa72cb6717199651d5361a6bc20e0780d801d00a5f353d |
| src/components/estimates/wizard/save/supabase-persistence-gateway.ts | 7231 | a8134c87eb65418a4e4aa491ce15feee55091950bfb229d1715c5879a11e7048 |
| src/components/estimates/wizard/save/wizard-save-intent-orchestrator.ts | 20184 | df091340ff8bc7784c457a7f52015726248e951f6acb059bdd2b9cacf621a365 |
| src/components/estimates/wizard/save/WizardSavePanel.tsx | 15230 | 4d521a3af5397e89d69647beeecdd637e926541f9150f82896ac9c263b058940 |
| src/components/estimates/wizard/save/wizard-idempotency-session.ts | 19774 | 7ceb0a649279bd2870317c1c75e3fe1b8d2680bdd47c8717158538ce4affca80 |
| src/components/estimates/wizard/production/ProductionEstimateWizard.tsx | 24164 | 4140cef434023fb8c669823ab6f894a6df0f43d52d1ae8a46168d9f7d29c4702 |
| src/components/estimates/wizard/useEstimateWizard.ts | 6348 | 5896a446ec9dcc3808547019a6a7428afe581d2db7c2ed0d8a308a1d1c70c427 |
| src/lib/estimates/get-estimate.ts | 1746 | 7a65f671c6d5901fdd7769d5de1679d4eaabfed9af099328bfe3aa53d18f87dc |
| src/lib/estimates/estimate-types.ts | 5453 | 5f6d3d8c206333b5ddccec15e1f9c75241bc1b4a5ef1883d195676163924aaaa |
| src/lib/invoices/create-invoice.ts | 16703 | aa5cbaf982b10b5648abdd8ec971f1a72c401b34a8442a674b1784d57c1ec35d |
| src/lib/invoices/invoice-types.ts | 8913 | b99e619f0d7131effa86a04191d749ce57bc846c3a77d77711cd93cbc828577e |
| src/lib/invoices/issue-invoice.ts | 16322 | 3ab429aefeec4536dbd72289e68f05ca3d3d1f1c7cc1d34a59d93e908a264369 |
| src/lib/invoices/invoice-issuance-core.ts | 19065 | 8e4cfe06b91854d75246ec14c9106b2e53c23d5d06de6b5220c45de378f65606 |
| src/lib/invoices/invoice-issuance-snapshot.ts | 5465 | 75a9ec13354066b548ecb80ff0f57ac9598e93a35d914e3d03bf5cb2800577a1 |
| src/lib/pdf/get-estimate-pdf-data.ts | 1474 | 7f0c624a6f3919f65f966bf5d97a463deea369c410a78b69714cf84711eca4eb |
| src/lib/pdf/estimate-document-data.ts | 5345 | ab2bd1a83e91bd2680684ec2c768262111b374cf4d12aaeca9d136274e43c9d9 |
| src/lib/pdf/get-delivery-note-pdf-data.ts | 3724 | ef63f9642b3e9eb8af2566196c2fc1774f63f51ff0619b7c77ef1b26223a8f8c |
| src/lib/pdf/delivery-note-document-data.ts | 5659 | 190adfaf6f2aba9095e2f5557b4476978b54f6f005092f1484e46a68e27e2d2c |
| src/lib/pdf/invoice-document-data.ts | 4653 | fb0d4cc4efefa999185f06eb15b976ffd2aaf17518b4a0a6240ca421b4c4ff0e |
| src/components/invoices/InvoicePdfIssueActions.tsx | 5145 | 3db600cb184e10171b9ce2204606e11c15762f6ae2f38fba3ec993c7159de808 |
| supabase/migrations/20260726090000_extend_estimate_wizard_snapshot_metadata.sql | 44451 | a6404dcd37b2fef14543fd31d418969810b25ebca3d61d06eff1e73ce1d11b91 |
| supabase/migrations/20260830160000_estimate_managed_service_offering_guard.sql | 51982 | 9319203d67ce42d8f54998b3db0e4af6c0f45ada36c7b20b7c51c047cbfcd499 |

## Required returned result

Marker: GYEON_INITIAL_DOCUMENT_RELEASE_DIAGNOSIS_R1_RESULT_V1

- Exact supplied baseline, actual read paths and input-manifest match; never claim a tool-disabled model independently hashed the repository.
- A and B findings with file/line evidence and confidence/evidence limits.
- Field-preservation map and explicit old/new quantity semantic distinction.
- Existing reusable boundaries versus new requirements and forbidden/closed-finance conflicts.
- Smallest *proposed*, literal, non-overlapping later write scopes; shared contracts ordered before consumers. Unknown paths remain pending, not invented.
- Proposed focused acceptance cases only; no commands executed.
- Consolidated Owner-only choices and exact additional read scope if necessary.
- Verdict: DIAGNOSIS_COMPLETE_WITH_LIMITS, NEEDS_ADDITIONAL_READ_SCOPE, or BLOCKED_GOVERNANCE.
- Explicit actions: source changes 0, test executions 0, DB calls 0, external writes 0, Studio actions 0.
- Stop after returning the report. No autonomous next phase.

Do not report IMPLEMENTATION_READY where finance conflicts, missing evidence, or business decisions remain. This diagnosis neither advances E0-E5 nor proves production readiness.


## Current exit

Verify only the three-document candidate, preservation, manifest, and whitespace. Leave it uncommitted until separately authorized. Before any source implementation/verification proposal, satisfy section 6.1's Draft-PR read-only instruction requirement and independently accept the resulting diagnosis. A prepared or Git-delivered instruction does not authorize Claude execution; a successful diagnosis does not authorize repair, tests, closed-finance changes or release.
