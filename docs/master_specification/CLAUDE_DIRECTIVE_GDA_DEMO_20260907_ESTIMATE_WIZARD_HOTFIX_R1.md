# GDA DEMO 2026-09-07 — Estimate Wizard Hotfix R1

## 1. Phase identity

- Phase: `GDA_DEMO_20260907_ESTIMATE_WIZARD_HOTFIX_R1`
- Fixed branch: `agent/gda-estimate-ocr-postal-clean-replacement-r1`
- Fixed HEAD: `8ec828736856ed0ba2f9bbb5117d00e680af31c4`
- Fixed tree: `2c3108d9d8405574dddca9e89f82ad3d480aea07`
- Preview deployment: `dpl_BkBJw1KWqoPLj7BGJQ2NcQUGLxD5`
- Preview alias: `dealeros-git-agent-gda-estimate-0307f5-nisikawa-5024s-projects.vercel.app`

This is a demo-blocking correction phase. Diagnosis, source repair, tests, Git commit,
push, database activation, and deployment remain separate gates.

## 2. Owner decisions

1. OCR-applied customer addresses must populate a blank postal-code field through the
   internal Japan Post postal master.
2. `Q² CANCOAT PRO EVO` is a Certified-only coating product. It must not be rendered as
   a selectable first, second, or later coating layer when the authoritative shop rank
   is `shop`, `detailer`, or `ppf_installer`.
3. The operator-facing text of both `保存` and `保存してPDFを開く` must be white in their
   enabled ready state.

## 3. Codex read-only findings

### 3.1 Postal code

The application wiring already injects `lookupJpPostalMasterReverseAction` and the OCR
apply handler already requests reverse lookup after applying a nonblank OCR address to a
blank postal target. The UI-side path is therefore present.

Read-only metadata checks found neither `private.jp_postal_master` nor
`public.jp_postal_master_lookup_reverse(text)` in either non-production candidate:

- `DealerOS-Dev-Next` / `vhiuiwolnlvlwvoaingd`
- `DealerOS-Dev-Clean-R5` / `nqvnjqcxgngqsqkbpdfi`

The Server Action consequently returns `MASTER_UNAVAILABLE` and cannot populate the
postal field. Do not fabricate a client-side fallback, hard-code a demo address, or call
an unrelated external postal API.

The exact Supabase project bound to the fixed Preview must be established before any
environment write. Applying a migration or importing data is NOT authorized by this
source-repair directive.

### 3.2 Certified-only coating leak

`firstLayerOptions(rank)` is rank-aware, but `secondLayerOptions(firstLayerId)` is not.
`Step4Estimate.tsx` and `EstimateWizardContainer.tsx` call the latter without the
authoritative `shopRank`, so `cancoat-pro-evo` is rendered for `detailer`. The pricing
path already fails closed for that invalid combination. Presentation and pricing are
therefore inconsistent.

### 3.3 Save-action contrast

`WizardSavePanel.tsx` gives both enabled ready-state buttons colored borders/backgrounds
but no explicit text color. In the current Preview this renders dark text with
insufficient contrast.

## 4. Protected path

`src/components/estimates/wizard/screens/ScreensPreview.tsx` is protected. Do not open,
read, diff, copy, stage, or modify it. Its pre-phase metadata is:

- mode: `-rw-r--r--`
- size: `31076`
- SHA-256: `d0901dd4b1aeabb5ca648d356bbeb37e435ffd0114ee3fdbdbd5d32fc3ca515e`

Verify the same metadata after work without reading its contents.

## 5. Read-only diagnosis allowlist

Claude may receive and read exactly these private files for one tool-disabled,
read-only diagnosis after separate owner authorization:

1. `AGENTS.md`
2. `docs/master_specification/CLAUDE_DIRECTIVE_GDA_DEMO_20260907_ESTIMATE_WIZARD_HOTFIX_R1.md`
3. `src/components/estimates/wizard/screens/coating-matrix.ts`
4. `src/components/estimates/wizard/screens/coating-window-reconciliation.test.ts`
5. `src/components/estimates/wizard/screens/CoatingSelector.tsx`
6. `src/components/estimates/wizard/steps/Step4Estimate.tsx`
7. `src/components/estimates/wizard/steps/Step4Estimate.binding.test.tsx`
8. `src/components/estimates/wizard/production/EstimateWizardContainer.tsx`
9. `src/components/estimates/wizard/production/ProductionEstimateWizard.test.tsx`
10. `src/components/estimates/wizard/save/WizardSavePanel.tsx`
11. `src/components/estimates/wizard/save/WizardSavePanel.test.tsx`
12. `src/components/estimates/wizard/steps/Step1Customer.tsx`
13. `src/components/estimates/wizard/steps/estimate-wizard-ocr-apply.test.tsx`
14. `src/components/estimates/wizard/steps/postal-master-apply.ts`
15. `src/components/estimates/wizard/steps/postal-master-apply.test.ts`
16. `src/lib/geo/jp-postal-master-actions.ts`
17. `src/lib/geo/jp-postal-master-actions.test.ts`
18. `src/lib/geo/jp-postal-master-contract.ts`
19. `supabase/migrations/20260901001246_jp_postal_master.sql`

No file outside this list may be opened or transmitted during diagnosis. In particular,
the protected path in section 4 remains content-prohibited.

## 6. Required diagnosis output

Return exactly one result headed:

`GDA_DEMO_20260907_ESTIMATE_WIZARD_HOTFIX_R1_READ_ONLY_DIAGNOSIS_RESULT_V1`

It must state:

- `PASS_TO_IMPLEMENT` or `CHANGES_REQUIRED`;
- exact proposed source edit allowlist;
- exact tests to add or modify;
- proof that non-Certified ranks cannot receive `cancoat-pro-evo` in any rendered layer;
- proof that Certified behavior remains unchanged;
- proof that pricing/save authorization is not weakened;
- proof that both enabled save actions render explicit white text;
- confirmation that postal source repair is not proposed when the missing DB objects are
  the observed blocker;
- exact non-production environment activation prerequisites, kept separate from source
  implementation;
- protected-path metadata equality; and
- unchanged Git index/worktree except the already-present untracked governance files.

## 7. Implementation boundary

No edits are authorized by the diagnosis gate. After Codex accepts the diagnosis, a
separate implementation authorization will name the exact editable paths. No stage,
commit, push, Supabase write, migration apply, import, Vercel setting change, or deploy is
authorized here.

## 8. Acceptance contract

The eventual implementation must demonstrate all of the following:

1. For authoritative rank `detailer`, `Q² CANCOAT PRO EVO` is absent from every coating
   layer candidate list.
2. The same absence holds for `shop` and `ppf_installer`.
3. For `certified`, all previously approved CANCOAT PRO combinations remain selectable.
4. Invalid stale non-Certified CANCOAT PRO selections remain fail-closed and cannot be
   saved or priced as valid.
5. Both ready-state save buttons contain an explicit white-text class, with no change to
   their click destination, idempotency, or disabled/retry behavior.
6. Postal code remains fail-closed until the exact Preview-bound non-production project
   has the reviewed migration, a promoted active official-data batch, and an authenticated
   request-scope runtime proof.
7. `git diff --check`, focused tests, whole relevant tests, and `npm run typecheck` pass in
   an environment with installed dependencies.

## 9. Accepted read-only diagnosis

The Owner explicitly authorized transmission of the exact nineteen-file payload in
section 5 to Anthropic Claude Code. MacBook Codex invoked Claude once with all tools
disabled, `dontAsk` permission mode, slash commands disabled, Chrome integration
disabled, and session persistence disabled. The invocation exited successfully and
returned:

- result marker:
  `GDA_DEMO_20260907_ESTIMATE_WIZARD_HOTFIX_R1_READ_ONLY_DIAGNOSIS_RESULT_V1`;
- verdict: `PASS_TO_IMPLEMENT`;
- postal adjudication: no source repair; the observed blocker is the missing
  non-production postal-master table, RPCs, and promoted official-data batch;
- coating adjudication: make second-layer selection rank-aware and fail closed when the
  rank is absent or is not `certified`;
- save-action adjudication: add explicit white text to exactly the two enabled ready-state
  actions; and
- Git/protected-path adjudication: no tracked or staged change, and protected metadata
  remained mode `-rw-r--r--`, size `31076`, SHA-256
  `d0901dd4b1aeabb5ca648d356bbeb37e435ffd0114ee3fdbdbd5d32fc3ca515e`.

MacBook Codex independently confirmed the relevant call sites and class strings and
accepted the diagnosis. This acceptance does not itself authorize implementation.

## 10. Exact future implementation allowlist

After a separate explicit Owner implementation authorization, Claude may edit exactly
these seven paths and no others:

1. `src/components/estimates/wizard/screens/coating-matrix.ts`
2. `src/components/estimates/wizard/screens/coating-window-reconciliation.test.ts`
3. `src/components/estimates/wizard/steps/Step4Estimate.tsx`
4. `src/components/estimates/wizard/steps/Step4Estimate.binding.test.tsx`
5. `src/components/estimates/wizard/production/EstimateWizardContainer.tsx`
6. `src/components/estimates/wizard/save/WizardSavePanel.tsx`
7. `src/components/estimates/wizard/save/WizardSavePanel.test.tsx`

Required repair contract:

1. `secondLayerOptions` receives an optional `ShopRank`. It includes
   `cancoat-pro-evo` only when the rank is exactly `certified`; an omitted rank fails
   closed and excludes it.
2. Both authorized production call sites pass the authoritative `shopRank`.
3. First- and third-layer behavior remains unchanged except for regression assertions
   proving that no non-Certified rank can render `cancoat-pro-evo`.
4. The two ready-state save buttons receive only the explicit `text-white` class needed
   for their text. Click targets, guards, session/idempotency behavior, retry handling,
   and all other states remain unchanged.
5. No postal source file is edited. Postal activation remains a separate environment and
   database phase.

## 11. Exact future verification gate

Claude may run the following only after the same separate implementation authorization:

```text
node --import tsx --test src/components/estimates/wizard/screens/coating-window-reconciliation.test.ts
node --import tsx --test src/components/estimates/wizard/steps/Step4Estimate.binding.test.tsx
node --import tsx --test src/components/estimates/wizard/save/WizardSavePanel.test.tsx
node --import tsx --test src/components/estimates/wizard/production/ProductionEstimateWizard.test.tsx
npm run typecheck
git diff --check -- <the exact seven paths in section 10>
```

Dependency installation, package or lockfile modification, broad test execution, and any
database, provider, or deployment access are prohibited. If the existing environment
cannot resolve `tsx` or another already-declared dependency, return
`BLOCKED_ENVIRONMENT` without installing or changing anything.

The implementation result must begin with:

`GDA_DEMO_20260907_ESTIMATE_WIZARD_HOTFIX_R1_IMPLEMENTATION_RESULT_V1`

Use exactly one verdict: `CANDIDATE_READY`, `CHANGES_REQUIRED`, or
`BLOCKED_ENVIRONMENT`. Report the seven-path diff, per-file hashes, exact command exit
codes and test counts, protected metadata, HEAD/tree/index/status, and a zero-action
attestation for Git delivery, Supabase/database, provider, Vercel, and deployment.

## 12. Current governance and stop boundary

The Owner authorized only this three-document governance registration and one public-safe
instruction comment on PR #67. The existing CR6-R3K work is preserved but temporarily
held while this demo-blocking phase is active. It may resume only after a separate Owner
decision.

This directive does not yet authorize the seven-file implementation, test execution,
private-source retransmission, stage, commit, push, PR state change, Supabase/database
access, migration application, official postal-data import, Vercel mutation, deployment,
Ready conversion, or merge. Claude must not start implementation from the PR comment
alone.
