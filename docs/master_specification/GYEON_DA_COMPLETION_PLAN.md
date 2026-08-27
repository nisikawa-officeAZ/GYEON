# GYEON Detailer Agent Completion Plan

| Field | Value |
|---|---|
| Document status | ACTIVE — direction ratified and Git-governed |
| Execution authority | Canonical for GYEON DA completion after ratification |
| Owner | Office AZ / Product Owner |
| Technical authority | MacBook Codex |
| Implementation | Claude/Codex within an explicitly authorized phase |
| Baseline commit | `5b1cd6ae8d3277d3d46cfc4f15f247fc168e0223` |
| Baseline tree | `56c86cdcc52b7957becbb8315f04872dcf3fdda6` |
| Planning branch | `plan/gyeon-da-completion-v1` |
| Created | 2026-08-10 |
| Result ledger | `GYEON_DA_PHASE_RESULTS.md` |

## 0. Authority and document precedence

This plan is the single current execution authority for completing GYEON Detailer Agent. It supplements the frozen architecture and supersedes older schedules, status pages, roadmaps, chat handoffs, and agent memory when they conflict about priority, ownership, phase, or completion state.

Precedence:

1. Explicit current user authorization.
2. Root `AGENTS.md` session bootstrap and this plan.
3. Latest accepted entry in `GYEON_DA_PHASE_RESULTS.md`.
4. Frozen v2.0 architecture, security, business-rule, and data contracts where they do not conflict with items 1-3.
5. Older phase status, roadmap, release notes, `CURRENT_TASK.md`, chat history, and historical handoffs as reference evidence only.

No agent may silently reconcile a conflict. It must identify the conflicting documents and stop before implementation.

Every new Codex, Claude, Cursor, or Studio session must read `AGENTS.md`, this plan, and the latest ledger entries before acting. The session must first state the active phase, authorization boundary, literal allowlist, protected paths, and responsible owner.

## 1. Purpose

GYEON Detailer Agent exists to reduce the administrative work that prevents GYEON detailers from concentrating on detailing work.

The product priority is therefore:

1. Complete the GYEON detailer daily workflow.
2. Prove that it reduces real administrative work in field use.
3. Stabilize operations, security, support, and AI/server cost controls.
4. Consider SaaS commercialization only after GYEON DA completion.

Monetization is a means of paying AI and server costs. It is not the primary product purpose and must not displace the GYEON DA completion critical path.

## 2. Fixed decisions

The following decisions remain binding until this file is changed, reviewed, explicitly approved by the user, and recorded in the result ledger.

1. **GYEON DA completion is the MacBook priority.**
2. **SaaS commercialization is deferred until after GYEON DA field completion.**
3. **GYEON order Draft PR #7 is generally frozen, with one exact bounded exception.** On 2026-08-16 the product owner approved `GDA-ORDER-1A`, a two-path Draft-only compatibility repair because the accepted secure order action cannot be used safely by the current UI without a stable idempotency key, while the UI still exposes an unsupported submitted/card path. The exception is limited to `ProductOrderForm.tsx` and one focused source-contract test. It does not authorize broader ordering, offer/shipping authority, card authorization, database or migration work, external API access, Ready conversion, merge, or deployment.
4. **Office AZ inventory is not MacBook implementation scope.** Mac Studio owns the complete Office AZ inventory foundation. MacBook may define integration contracts and perform independent review only.
5. **The closed finance track stays closed.** Accepted invoice, payment, monthly-statement, and PDF-artifact contracts are not redesigned unless a verified regression blocks GYEON DA.
6. **AI assists; humans decide.** AI may draft, summarize, classify, or recommend. It must not issue invoices, send customer messages, overwrite customer/vehicle records, apply migrations, or perform destructive actions without the required human approval.
7. **One active implementation phase at a time.** Work outside the active phase's literal allowlist is prohibited.
8. **Chat does not silently change the plan.** A changed decision is valid only after this document and the result ledger are updated and the user explicitly ratifies the change.
9. **Claude is the bounded implementation agent.** Claude diagnoses, repairs, and runs executable tests only inside an authorized GYEON DA phase; Claude must confirm the Git plan before acting.
10. **Studio owns the complete Office AZ inventory system.** Studio continues autonomously within its approved inventory specification and does not wait for routine MacBook review. It escalates only product-authority changes, security boundaries, scope conflicts, destructive operations, shared-integration contracts, and final DetailerOS integration.
11. **GYEON HP store discovery is the first ratified post-completion growth track, with one accepted bounded exception.** The full store-directory, media, cross-domain API, website, SEO/MEO, GBP and nightly-publication sequence remains deferred until GDA-7. On 2026-08-16 the product owner explicitly activated only `GHP-2A`, the pure two-path public-profile projection seed in Draft PR #12; its privacy and authority contract is now independently accepted at head `9b8bc1eb2cb59e879f5ebeb5b91e85ba4f522662`. PR #12 remains Draft and unmerged, and the acceptance does not authorize persistence or external connection work.
12. **The dealer-order business contract is formally ratified as documentation-only V3.** On 2026-08-27 the product owner authorized `GDA-ORDER-SPEC-1` to record the dealer-order decisions and to issue an exact GenSpark UI production request plus a Studio change notice. This exception authorizes only the five DA documentation paths and two Studio documentation paths listed in that phase. It does not activate order implementation, change the current GDA implementation phase, authorize schema/API/payment/bank/warehouse integrations, or authorize stage, commit, push, Ready, merge, migration, deployment, or production application.

## 3. Protected and excluded scope

### 3.1 Protected paths

The following paths are excluded from content inspection and modification unless a later phase explicitly replaces this rule:

- `src/components/estimates/wizard/screens/ScreensPreview.tsx`
  - Access: pathname, mode, hash, and Git state only.
- `supabase/migrations/20260801110110_line_link_tokens.sql`
  - No production application without a separate authorized phase.
- `supabase/migrations/20260807135006_monthly_invoice_pdf_artifact.sql`
  - Closed finance artifact; do not reopen speculatively.
- `src/lib/monthly-statements/monthly-invoice-artifact-boundary.test.ts`
  - Closed finance boundary; do not modify outside an authorized regression phase.

### 3.2 Excluded delivery tracks

- SaaS catalogue, commercial billing expansion, white label, and generic SaaS rollout.
- GYEON product-order runtime expansion while Draft PR #7 is frozen, except the exact two-path `GDA-ORDER-1A` UI/idempotency compatibility repair. The documentation-only `GDA-ORDER-SPEC-1` V3 contract is permitted, but it does not authorize runtime work.
- Office AZ inventory implementation, migrations, tests, deployment, and operations.
- EC integration and inventory-to-EC availability.
- Marketing automation that does not directly remove current detailer administrative work.

## 4. Completion standard

A route, component, specification, or source file is not enough to claim completion. Every capability is classified using the evidence levels below.

| Level | Name | Required evidence |
|---|---|---|
| E0 | Not implemented | No executable user path, or the path is explicitly deferred/dry-run. |
| E1 | Source present | Executable source path exists and the ownership/security boundary is identifiable. |
| E2 | Locally verified | Focused tests and required type/build gates pass on the accepted candidate. |
| E3 | Environment verified | Required migration/configuration is present and authenticated staging verification passes. |
| E4 | Field verified | A GYEON detailer completes the real workflow and the expected administrative work is measurably reduced. |
| E5 | Production closed | Accepted commit/tree is deployed, smoke-tested, recorded, and has a rollback/recovery boundary. |

`Completed` means the phase-specific target evidence level has been reached. No lower evidence level may be described as production complete.

## 5. Current-state audit snapshot

This is a source and historical-evidence snapshot at baseline `5b1cd6a`. GDA-1 must refresh the executable evidence before implementation begins.

| Workflow | Current classification | Evidence and gap | Next owner |
|---|---|---|---|
| Authentication, onboarding, dealer/staff boundary | Implemented; current live proof required | Routes and authorization foundations exist. Current authenticated production state was not re-proved in this planning phase. | GDA-1 |
| Customer and vehicle management | Source-complete with historical verification | Lists, details, edits, duplicate detection, and dealer-scoped ownership exist. | GDA-1 current verification |
| Vehicle-registration OCR | Source-complete with historical verification | Review, confidence/missing-field handling, session/audit, and explicit confirmation exist. Current DB/application state must be refreshed. | GDA-1 |
| Reservations and calendar | Source present; acceptance incomplete | User routes and domain code exist, but no fresh focused acceptance was established in this planning phase. | GDA-1, then GDA-2 only if blocked |
| Estimate Wizard create/save | Strong source and test foundation; current environment proof required | Production route mounts the authoritative save action and real atomic RPC gateway. Existing comments/spec status are partly stale. | GDA-1 |
| Estimate PDF and sharing | Strong source/test foundation | Authenticated PDF route and LINE estimate modules exist. External LINE operation remains environment-dependent. | GDA-1 / GDA-4 |
| Work orders and work files | Source present; end-to-end acceptance incomplete | Detail view connects files, completion report, invoice, maintenance, and review preparation. The complete detailer journey is not proven as one flow. | GDA-1 / GDA-2 |
| Completion report and work-report PDF | Partial | Real report creation and authenticated work-report PDF exist, but the top-level page still says PDF is preparing. Completion is a set of manual, disconnected actions. | GDA-3 |
| Invoice, payments, monthly statements | Production-closed finance foundation | Accepted finance/PDF-artifact track is preserved. Payment side effects are intentionally deferred until an idempotent outbox/created-vs-replayed contract exists. | Regression-only |
| Maintenance reminders | Source present; field outcome unverified | Reminder creation and dashboard data exist. End-to-end customer follow-up is not field-proven. | GDA-4 |
| LINE customer linking and queue | Partial / environment-gated | Secure linking, queue, cron, transport, and estimate-send source exist. External setup and frozen migration/deployment boundaries prevent a production-complete claim. | GDA-4 |
| Review request | Dry-run only | UI explicitly states that LINE send and persistence are not implemented. | GDA-4 |
| AI insights | Deterministic only | Dashboard insights are rule-based and make no AI provider call. This is useful operational guidance but not a live AI agent. | Preserve; GDA-5 extends |
| AI agents/orchestrator | Not live | Agent execution and orchestration are dry-run/not-implemented. | GDA-5 |
| SaaS, generic catalogue, inventory, EC | Deferred/out of scope | Not part of the GYEON DA completion critical path. Inventory is a separate Mac Studio track. | After GDA-7 |

## 5.1 Residual-work register

This register prevents a future session from treating every placeholder as a completion blocker or overlooking a real operational gap.

### Completion blockers

- Refresh executable and authenticated evidence for the entire GYEON detailer journey; source presence and historical tests are insufficient.
- Resolve the completion-report route/UI contradiction and prove the work-report PDF from the real work-order journey.
- Replace review-request dry-run behavior with approval-gated persistence and delivery, or remove misleading production UI.
- Complete the separately authorized LINE environment path: frozen migration decision, external configuration, secure links, consent, queue/retry, observability, and real controlled sending.
- Prove real-device mobile/PWA installation and the critical workflow without developer assistance.
- Prove role/tenant boundaries, duplicate submission handling, failure recovery, backup/restore or rollback procedure, and authenticated production smoke.
- Reconcile stale roadmap/status documents by marking this plan as the current execution authority rather than rewriting historical evidence.

### Field-audit decisions

- Data export/CSV and operator-managed account deletion procedure.
- Media thumbnail generation when inline preview causes measurable completion-report friction.
- Settings currently marked `準備中` only when the setting removes a real GYEON detailer task.
- QR placeholders only if GDA-1 proves they reach a production customer-facing renderer; fixture-only placeholders are not blockers.

### Deferred after GDA-7

- HLS video delivery, customer media gallery, marketing/SEO/growth AI, generic SaaS, white label, ordering runtime expansion beyond the exact `GDA-ORDER-1A` compatibility repair, Office AZ inventory implementation on MacBook, and EC expansion. The owner-ratified `GDA-ORDER-SPEC-1` V3 documents define future order behavior only and do not remove this runtime freeze.
- The full GYEON HP store-discovery track is governed by `GYEON_HP_STORE_DISCOVERY_INTEGRATION_SPEC.md` and remains deferred until GDA-7. The only accepted exception is `GHP-2A`: a pure two-path projection source/test seed with no schema, Storage, API, website, SEO/MEO, GBP or deployment authority.

## 6. Strict phase protocol

Every phase uses the following states:

`NOT_STARTED -> AUTHORIZED -> IN_PROGRESS -> CANDIDATE_READY -> REVIEWED -> ACCEPTED -> COMMITTED -> PUSHED -> ENVIRONMENT_VERIFIED -> CLOSED`

Rules:

1. Only one phase may be `IN_PROGRESS`.
2. Audit, implementation, verification, commit, push, environment apply, and production release are separate authorization boundaries.
3. Each implementation phase begins with an exact base commit/tree, branch/worktree, literal path allowlist, protected paths, and approved test commands.
4. Discovering a real defect outside the allowlist stops the phase. It does not silently broaden scope.
5. A failed disposable database suffix/evidence set is burned and never repaired into acceptance.
6. Commit is prohibited until candidate review and required verification pass.
7. Push is prohibited until the exact commit/tree is accepted.
8. Migration application, Ready conversion, merge, deployment, and destructive operations always require explicit user approval.
9. Completion is recorded in `GYEON_DA_PHASE_RESULTS.md` before the next phase is authorized.
10. A phase may close as `PASS_WITH_NO_CODE` when current evidence proves the capability already meets its acceptance criteria.

### 6.1 Claude read-only diagnosis instruction maintenance

MacBook Codex owns the Claude diagnosis handoff. At each new diagnosis or implementation-candidate boundary, and before any implementation or verification instruction, Codex must proactively publish a Claude-targeted read-only diagnosis instruction on the active coordination Draft PR. The user is not a transport layer and must not be asked to copy the instruction between agents.

The instruction must state the exact phase, base branch/commit/tree, required first reads, read scope, protected metadata-only paths, required diagnosis, prohibitions, result schema, and return target. It authorizes inspection only unless a later, separate gate explicitly authorizes another action.

Codex must automatically correct the instruction when the phase, base, scope, allowlist, protected boundary, candidate commands, prohibitions, or expected result changes. Material corrections are appended as a new superseding comment that identifies the prior comment URL or ID and lists the corrected fields. Historical evidence is not silently rewritten. Claude follows only the newest non-superseded instruction matching both the active phase and repository base.

This is event-driven phase governance. It does not reinstate a background polling or five-minute monitoring automation. Missing, stale, ambiguous, or conflicting instructions are a blocker for Claude, not a reason to guess or broaden scope.

## 7. Delivery phases

### GDA-0 — Baseline audit and plan ratification

**Objective:** Establish the authoritative GYEON DA mission, current-state classification, phase protocol, protected scope, and result ledger in Git.

**Allowed changes:**

- `AGENTS.md`
- `CLAUDE.md`
- `docs/master_specification/GYEON_DA_COMPLETION_PLAN.md`
- `docs/master_specification/GYEON_DA_PHASE_RESULTS.md`
- `docs/master_specification/INDEX.md`

**Acceptance:**

- The user ratifies the fixed decisions and phase order.
- Documentation/bootstrap diff is limited to the five paths.
- Root `AGENTS.md` and `CLAUDE.md` require every new agent session to confirm the governing plan and current phase before acting.
- `git diff --check` passes.
- Baseline commit/tree, branch, worktree, and changed paths are recorded.
- No source, test, dependency, DB, migration, external service, or deployment action occurs.

### GDA-1 — Executable current-state acceptance audit

**Objective:** Replace assumptions and stale documents with current evidence for the actual GYEON detailer journey.

**Journey under test:**

`login/onboarding -> customer/vehicle/OCR -> reservation -> estimate -> PDF/LINE preview -> work order -> completion report -> invoice/payment boundary -> maintenance`

**Required work:**

- Create a clean audit worktree from the accepted plan base.
- Confirm current route/call-chain reachability and exact DB/config prerequisites.
- Run approved focused tests first; run broader type/build gates only from a clean worktree whose protected-scope rules permit them.
- Perform authenticated staging/browser checks only in a separately authorized environment-verification subphase.
- Verify real-device PWA installability, completion-report/PDF reachability, review persistence/delivery status, and the operator recovery/export boundary.
- Identify stale roadmap/status conflicts and record which document governs without rewriting historical evidence during the audit.
- Record every workflow as `PASS`, `PARTIAL`, `BLOCKED`, or `NOT_IMPLEMENTED`, with evidence level E0-E5.
- Produce an exact GDA-2 allowlist based only on verified blockers.

**Prohibited:** source repair, migration apply, production access, commit, push, or scope expansion during diagnosis.

**Exit:** one evidence-backed blocker list and one literal GDA-2 implementation candidate. No code is required if the core path already passes.

### GDA-2 — Core daily-workflow closure

**Objective:** Close only the blocking gaps from intake through a saved estimate and executable work order.

**Priority:** customer/vehicle selection, OCR-confirmed registration, reservation handoff, authoritative pricing, atomic estimate save, PDF, and work-order creation/reachability.

**Acceptance target:** E3 for the authorized staging environment and no regression in the accepted estimate/pricing/security contracts.

**Constraint:** GDA-1 defines the literal allowlist. No speculative redesign is allowed.

### GDA-3 — Completion Desk

**Objective:** Reduce the post-service administrative sequence to one review surface.

**Required outcome:**

- Detect the work-order completion transition accurately.
- Present the service summary, completion-report draft, work-report PDF readiness, invoice-draft readiness, customer-message draft, and maintenance schedule together.
- Create only missing artifacts and prevent duplicate report/invoice/reminder creation.
- Require human confirmation before customer communication or financial issuance.
- Never auto-record payment or auto-issue an invoice.
- Preserve tenant isolation, role capability, idempotency, short transactions, and recovery from partial failure.

**Acceptance target:** E3 plus a measured reduction in screens/steps compared with the baseline.

### GDA-3A — Completed-work-order review surface

**Authorization:** On 2026-08-16 the product owner explicitly approved starting the next smallest Book-side implementation phase after GDA-4A-I1 and its governance synchronization were committed and normally pushed. The bounded read-only diagnosis was accepted by MacBook Codex, and the owner then explicitly approved the exact two-path uncommitted implementation. The first implementation attempt correctly stopped before source edits because this Git authority entry was missing. After this exact two-document authority correction is independently accepted, committed, and normally pushed, the already-approved GDA-3A-I1 implementation may resume without another owner reply; commit and push of the later source candidate remain separate gates.

**Objective:** Turn the existing completed-work-order follow-up controls into one truthful completion-desk review flow without changing any child capability, persistence rule, financial authority, or communication authority.

**Literal implementation allowlist:**

1. MODIFY `src/components/work-orders/WorkOrderDetail.tsx`
2. ADD `src/components/work-orders/work-order-completion-desk.test.ts`

**Required behavior:** Extract the existing completion-report, invoice, maintenance, and conditional review-request JSX into one local `completionDeskSections` element without duplicating those implementations. When `wo.status === "completed"`, render that element once inside a clearly labeled `完了後の対応` container with the explicit sequence `1. 完了報告書 → 2. 請求書 → 3. メンテナンス通知 → 4. レビュー依頼`. When the work order is not completed, render the same element without the new wrapper so current availability and behavior remain unchanged. Preserve all existing show/hide state, toggles, child imports, child props, status guards, and human-confirmation boundaries. Do not default-open any section.

**Required verification:** The focused `node:test` source-contract test must prove the completed-only wrapper, exact sequence, shared single `completionDeskSections` element, single invocation of every child, unchanged four show/hide states, and absence of new server actions or automatic issue/send/approval behavior. Run the smallest strict TypeScript check through a temporary config outside Git limited to the exact component and test paths, then run `git diff --check` and exact changed-path/index checks.

**Frozen/no-modify child paths:** `CompletionReportSection.tsx`, `InvoiceSection.tsx`, `MaintenanceSection.tsx`, `ReviewRequestApprovalSection.tsx`, and `review-request-actions.ts`.

**Prohibited:** Any third repository path; automatic artifact creation, invoice issue, payment recording, approval, LINE send, maintenance creation, or review delivery; server-action, persistence, schema, RLS, migration, dependency, or config change; DB, Supabase, Auth, Storage, LINE, EC, or other external-service access; stage, commit, push, Ready conversion, merge, deployment, cleanup, or destructive action without its later separate gate.

**Current stopping point:** GDA-3A-I1 is independently accepted, committed at `4d01861c33131c8c891109f27d2c5ffda5bbc02d`, normally pushed to Draft PR #15, and recorded by the append-only ledger synchronization commit `4df3501f021f0b85cd15c69b5a02e9f662c914fd`. PR #15 remains OPEN/Draft/unmerged. GDA-3A is source-closed at E1; environment, field, Ready, merge, and deployment acceptance remain unauthorized. The active next bounded phase is GDA-3B below.

### GDA-3B — Invoice-from-work-order replay guard

**Authorization:** After GDA-3A-I1 and its append-only completion record were independently accepted, committed, and normally pushed, the product owner approved proceeding to the next Book implementation phase. Claude completed one bounded read-only GDA-3 gap diagnosis at exact HEAD `4df3501f021f0b85cd15c69b5a02e9f662c914fd`, and MacBook Codex accepted the source finding with the correction that an application-level existence lookup is a common-path replay guard, not full concurrency-safe idempotency. This entry authorizes only the two-document Git authority candidate. Source/test implementation, commit, push, migration, and release actions remain later separate gates.

**Objective:** Prevent ordinary retries, stale UI submissions, and second-tab calls to `createInvoiceFromWorkOrder` from creating another generated draft invoice when a dealer-scoped invoice for the same work order already exists. Preserve all manual invoice creation, issuance, payment, UI, numbering, and financial authority behavior.

**Literal future implementation allowlist:**

1. MODIFY `src/lib/invoices/create-invoice.ts`
2. ADD `src/lib/invoices/create-invoice-from-work-order-idempotency.test.ts`

**Required behavior:** After the existing finance-capability authorization and canonical dealer resolution, query `invoices` by both `dealer_id` and `work_order_id`. Fail closed on lookup error. If an existing invoice is found, return its id with an explicit replay marker and execute no work-order fetch, document-number allocation, invoice insert, item insert, cleanup delete, or activity side effect. If none exists, preserve the current server-authoritative creation flow and return a non-replay marker. The existing caller must remain compatible without a UI change.

**Required verification:** Use a real `node:test` behavior test with `mock.module` fakes registered before importing the action. Prove dealer/work-order scoping, lookup-error fail-closed behavior, existing-row replay with zero downstream writes/side effects, first-call creation with exactly one invoice insert, and unchanged authorization-before-data-access ordering. Run the existing invoice-issuance boundary regression, the smallest strict TypeScript check through a temporary config outside Git limited to the exact action/test paths and direct imports, `git diff --check`, and exact changed-path/index checks.

**Frozen/no-modify paths:** `src/components/invoices/InvoiceSection.tsx`, `src/lib/invoices/issue-invoice.ts`, `src/components/work-orders/WorkOrderDetail.tsx`, every completion-report, maintenance, and review-request path, and every migration/schema path.

**Known limitation and later owner decision:** This source-only guard does not eliminate two truly simultaneous inserts that both observe no existing row. Full concurrency closure requires a separately authorized database contract such as a unique key or transactional lock. The current UI also permits manually creating additional invoices for one work order, so a one-invoice-per-work-order database rule is a product/accounting decision and is not inferred or authorized here. GDA-3B must remain PARTIAL evidence for full duplicate prevention.

**Prohibited:** Any third repository path; UI, manual invoice creation, issuance, payments, invoice status, numbering, schema, RLS, migration, dependency, or config change; DB, Supabase, Auth, Storage, LINE, EC, or other external-service access; stage, commit, push, Ready conversion, merge, deployment, cleanup, or destructive action without its later separate gate.

**Current stopping point:** Return this exact two-document Git authority candidate for independent acceptance. Do not implement GDA-3B source/test changes until the document candidate is separately accepted, committed, and normally pushed, and the owner then explicitly approves the exact two-path uncommitted implementation.

### GDA-4 — Customer communication and follow-up

**Objective:** Make estimate, completion, review, and maintenance communication usable without manual re-entry.

**Required outcome:**

- Secure LINE link state and consent are verified.
- Outbound messages are previewed and explicitly approved.
- Queue/cron retries are idempotent and observable without leaking customer data.
- Completion and maintenance messages include only authoritative data and valid secure links.
- Payment confirmation is implemented only after an idempotent outbox or created-vs-replayed contract is accepted.
- Review-request dry-run is replaced by real, approval-gated execution or explicitly deferred with no misleading UI. Until persistence and delivery are separately authorized, `GDA-4A` makes the existing surface preview/copy-only and removes fake approval, rejection, and skip actions.

**Acceptance target:** E4 in a controlled GYEON pilot. Migration/external setup/deployment remain separate authorization phases.

### GDA-4A — Review-request preview-only safety repair

**Authorization:** On 2026-08-16 the product owner approved selecting and immediately preparing the smallest Book-side GYEON DA implementation phase after GDA-ORDER-1A was normally pushed, then explicitly ratified the recorded GDA-4A two-document plan after independent candidate review. This authorizes the bounded read-only diagnosis; source/test implementation, commit, push, and every environment or release action remain later separate gates.

**Objective:** Remove fake approval-state interactions from the unfinished review-request feature while preserving the useful, truthful preview and copy tools. The UI must not imply that approval, rejection, deferral, persistence, AI generation, or LINE delivery occurred when none of those actions are implemented.

**Literal implementation allowlist:**

1. MODIFY `src/components/reputation/ReviewRequestApprovalSection.tsx`
2. ADD `src/components/reputation/review-request-preview-only.test.ts`

**Required behavior:** Keep authenticated readiness loading, customer/vehicle/service summary, deterministic message preview, copy action, link readiness, missing settings, and compliance information. Change approval-oriented labels to preview/readiness language; remove imports, state, handlers, result UI, and buttons for dry-run approve/reject/skip; retain the disabled AI-edit boundary; and show clear Japanese notice that the current screen does not save an approval or send LINE.

**Required verification:** The new focused source-contract test, the smallest strict TypeScript check for the two candidate paths and direct imports, and `git diff --check` must pass. Before implementation, Claude must perform one bounded read-only diagnosis at the pinned source base, and MacBook Codex must independently confirm the two-path scope.

**Prohibited:** Modification of `review-request-actions.ts` or any third source/test path; persistence, review-request table/schema/RLS/migration work; LINE sending; AI-provider execution; dependency/config changes; database, Supabase, Auth, Storage, LINE, EC, or other external-service access; stage, commit, push, Ready conversion, merge, deployment, or destructive action without its later separate gate.

**Current stopping point:** GDA-4A-I1 is accepted, committed at `0de9eedf46aa23d505299280097d937c85d22a11`, normally pushed to Draft PR #15, and recorded by the append-only ledger synchronization commit `73460aa0d4cf6c0da94c222f99ce7762584dffd0`. GDA-3A-I1 is also accepted, committed, normally pushed, and ledger-recorded. PR #15 remains OPEN/Draft/unmerged. Persistence, approval execution, LINE delivery, Ready conversion, merge, and deployment remain unauthorized. The active next bounded phase is GDA-3B above.

### GDA-5 — Operational AI assistance

**Objective:** Add AI only where it removes current clerical work and the result can be reviewed safely.

**First allowed uses:**

- Draft service summaries from structured work-order data.
- Draft customer-facing completion and maintenance messages.
- Summarize missing information and next actions.
- Suggest, but never finalize, review-request wording.

**Not allowed:** autonomous pricing, invoice issuance, payment decisions, customer/vehicle overwrite, unrestricted tool execution, or AI learning from dealer/customer data.

**Required controls:** provider readiness, tenant-safe keys, redaction, usage/cost logging, hard limits, human approval, retry/failure policy, and deterministic fallbacks.

**Acceptance target:** E4 with measured time saved and an accepted error/correction rate.

### GDA-PERF-1B — Request-scoped auth memoization Git authority sync

**Authorization:** The product owner separately approved diagnosis, the exact five-path implementation, focused verification, the exact two-document Git authority sync, the two isolated commits, their normal non-force pushes, the delivery-evidence synchronization commit, and its normal non-force push.

**Objective:** Reduce repeated request-scope authentication/dealer/admin/staff lookups by stable module-scope React `cache` memoization while preserving authorization and fail-closed behavior.

**Accepted source/test delivery allowlist:**

1. MODIFY `src/lib/auth/get-current-user.ts`
2. MODIFY `src/lib/auth/get-current-dealer.ts`
3. MODIFY `src/lib/admin/get-current-admin.ts`
4. MODIFY `src/lib/staff/get-current-staff.ts`
5. ADD `src/lib/auth/get-current-user-memoization.test.ts`

**Required preserved behavior:** Exported async wrappers remain. Auth query, dealer active filter, admin active filter, staff query outcome handling, `resolveStaffAuthorization`, and null-on-failure remain unchanged. No page call-order, middleware, client-construction, dependency, config, schema, or DB change.

**Accepted delivered evidence:** 4/4 focused Node tests PASS. Exact five-path/direct-import strict TypeScript PASS with zero diagnostics. `git diff --check` PASS. Exact hashes match. The document authority was committed at `fae126a17cb7313e7f1cba6c7edcfba6a44df1fd` and normally pushed. The exact five-path source/test implementation was committed at `1c7b3e93aa6ffd9c43e66d3d448fbaba24619573`, tree `d535a11202649400c43488ebd155fc06eb1119af`, and normally pushed. PR #15 remains OPEN/Draft/unmerged at that remote head; local/upstream is 0/0 and the index/worktree is clean before this synchronization candidate.

**Full-project typecheck qualification:** Not green and not claimed. One bounded attempt ended with exactly eight candidate-unrelated TS7016 diagnostics (seven `react-dom/server` declarations in existing tests, one `heic-convert` declaration in vehicle-registration); candidate-path diagnostics were zero.

**Evidence level:** E1 source/focused executable candidate evidence only. Do not claim actual latency improvement, environment proof, field proof, or production proof.

**Environment qualification:** One owner-approved Preview retry for exact commit `1c7b3e9` reached READY as deployment `dpl_Cat8xGBhQ9AK6c5TMNLADKevQCbN`; build, compile, type validation, static generation 42/42, and output deployment passed. The Preview remains protected by Vercel Authentication. No authenticated Chrome performance remeasurement or anonymous email-confirmation acceptance was completed, and production continues to serve older code. Actual latency improvement is therefore not accepted.

**Prohibited:** Any third repository path; DB, Supabase, Auth, Storage, LINE, EC, or other external-service access; migration, dependency, or config change; stage, commit, push, Ready conversion, merge, deployment, or destructive action without its later separate gate.

**Current stopping point:** The document authority and exact source implementation are remotely preserved in OPEN/Draft/unmerged PR #15. The delivery-evidence synchronization was independently accepted, committed at `a2d778e312cdde2160bdda261477296a5d3f5cba`, tree `b7aa4183d9130f74ec2567ac78c929d007892112`, and normally pushed; local/upstream is 0/0 and the index/worktree was clean after push. PERF-1B remains E1 plus READY protected-Preview delivery evidence only: authenticated latency improvement and anonymous public Auth acceptance are not proven. The active separate phase is GDA-AUTH-DEVNEXT-1A below.

### GDA-AUTH-DEVNEXT-1A — Isolated public Auth verification governance

**Authorization:** After PERF-1B delivery synchronization was independently accepted, committed, and normally pushed, the product owner approved preparing this separate four-document governance candidate. This candidate authorizes no external action, source/test edit, stage, commit, or push.

**Objective:** Establish one public, isolated Dev-Next host for real signup confirmation, login, and password-reset verification without weakening Preview protection and without touching the existing `dealeros` project, `app.detailer-ag.com`, or Production Supabase.

**Exact governance candidate allowlist:**

1. MODIFY `OPERATIONS_RULES.md`
2. MODIFY `docs/master_specification/GYEON_DA_COMPLETION_PLAN.md`
3. MODIFY `docs/master_specification/GYEON_DA_PHASE_RESULTS.md`
4. MODIFY `docs/master_specification/ENVIRONMENT_LEDGER.md`

**Frozen deployment identity:** The future isolated project is
`dealeros-dev-next`, the only public hostname is
`dev-next.detailer-ag.com`, the business role is Staging / Dev-Next, and the
only source commit/tree is
`1c7b3e93aa6ffd9c43e66d3d448fbaba24619573` /
`d535a11202649400c43488ebd155fc06eb1119af`. Vercel target
`production` is permitted only as platform semantics for this isolated
non-production project after all later gates. The existing `dealeros` project,
`app.detailer-ag.com`, and every business-Production identity remain frozen.

**Exact initial environment allowlist:** Staging-only
`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, and
`SUPABASE_SERVICE_ROLE_KEY` bound to ref `vhiuiwolnlvlwvoaingd` and transferred
without disclosure; `NEXT_PUBLIC_APP_URL=https://dev-next.detailer-ag.com`;
and build-only `NEXT_PUBLIC_GIT_COMMIT` equal to the exact source commit above.
The service-role key is required by the actual signup server actions for coarse
account-state lookup and verified pending-dealer creation. No other variable
may be copied. `CRON_SECRET`, partner provisioning, LINE, AI, Storage, OCR,
PDF, NEWS-provider, and Production values remain unset.

**Mandatory pre-deploy public-authority proof:** Before project
creation/deployment, a separately authorized four-test candidate must prove the
current cron-method reality and the complete public authority inventory. With
`CRON_SECRET` absent, scheduled `GET` to POST-only `downgrade-trials` must be a
framework `405`, its exported `POST` must return `401`, and both exported
methods on each other cron route must return `401`; every case must make zero
downstream mutation/external-send calls. The fourth test must inventory the
exact nine middleware public prefixes, nine current `/api/**/route.ts` paths,
`/auth/confirm`, `/signup` server actions, gated `/no-dealer`, and R92B `/s/e`
page/file route, rejecting any unclassified path. It must prove Auth
token/session, LIFF token/audience, LINE HMAC, coarse read-only signup-state,
partner-gate-off, R92B share-token, read-only status, and no-provider
observability boundaries before privileged mutation or external calls. Exact
future test paths, frozen existing regression hashes, and assertions are in
`OPERATIONS_RULES.md` §4.1. No handler, page, action, middleware, or
`vercel.json` source change is authorized by this governance phase.

**Later gated order:** independent Sol acceptance of this four-document
candidate -> separate document commit -> normal push -> separate four-test
candidate and executable public-authority acceptance -> separate Vercel
project/environment creation -> exact deployment/domain proof -> separate Staging Supabase Auth
Site URL/redirect/template update -> real anonymous email/signup/reset proof.
Each step fails closed on identity, scope, secret, billing, or evidence drift.

**Rollback boundary:** Detach only `dev-next.detailer-ag.com`, freeze the
isolated project, and restore separately captured Staging Auth configuration.
Project deletion is a destructive later gate. Existing Production or `dealeros`
resources are never rollback targets.

**Current stopping point:** Exact four-document uncommitted governance
candidate only. Independent Sol acceptance is next. No Vercel project, DNS,
environment, Supabase Auth, SMTP, DB, migration, deployment, stage, commit,
push, Ready conversion, or merge action is authorized or claimed.

### GDA-6 — Field acceptance and operational hardening

**Objective:** Prove that a GYEON detailer can complete the daily journey without developer assistance.

**Required evidence:**

- Real-device/mobile/PWA workflow.
- Permission matrix and disabled/suspended dealer behavior.
- Error recovery, duplicate submission, offline/retry, PDF download, LINE failure, and audit evidence.
- No customer, finance, or cross-dealer data leakage.
- Support runbook, rollback boundary, and known-limitations list.
- Measured administrative steps/time before and after.

**Acceptance target:** E4 for all critical journeys and zero unresolved severity-1 blockers.

### GDA-7 — GYEON DA production completion

**Objective:** Release the accepted GYEON DA candidate and formally close the completion track.

**Required work:** accepted commit/tree, reviewed PR, authorized merge, authorized migrations/configuration, authorized deployment, authenticated production smoke, rollback/recovery evidence, and result-ledger closure.

**Exit:** E5 for the critical journey. Only after GDA-7 closes may the full GYEON HP sequence or SaaS commercialization planning become the primary roadmap. The bounded GHP-2A seed below does not change this exit condition.

### GDA-ORDER-1A — Draft-only order form idempotency compatibility repair

**Authorization:** The product owner explicitly approved this bounded Book-side phase on 2026-08-16 while D2-S2 waits for the official product-input package. This is a tactical safety and usability exception, not a change to the GYEON DA completion priority and not evidence that ordering is production-ready.

**Objective:** Make the existing order form compatible with Draft PR #7's secure server action by supplying one stable idempotency key across duplicate clicks and retries, and by removing UI controls for server behavior that is intentionally unavailable before card authorization.

**Direct dependency and present defect:** Draft PR #7 requires a nonempty `idempotency_key`, rejects `submitted` before card authorization, and does not accept the UI's `order_date`. The current `ProductOrderForm.tsx` supplies no idempotency key, exposes a submitted/confirmation checkbox, and exposes a misleading order-date control. Without this bounded repair the order surface is internally inconsistent and remains vulnerable to duplicate intent at the UI boundary.

**Literal implementation allowlist:**

1. MODIFY `src/components/product-orders/ProductOrderForm.tsx`
2. ADD `src/components/product-orders/product-order-form-idempotency.test.ts`

**Required behavior:** Generate one client idempotency key per form instance, reuse it for repeated submission attempts and retry of the same intent, submit Draft status only, remove the unsupported submit/card-confirmation option, remove the unused order-date input, and explain the Draft-only limitation in clear Japanese.

**Required verification:** The new focused source-contract test, the existing `src/lib/product-orders/gyeon-order-rpc-binding.test.ts`, a focused strict TypeScript check covering the two candidate paths and their direct imports, and `git diff --check` must pass. Before implementation, Codex must publish a Claude-targeted read-only diagnosis instruction on Draft PR #7 and independently confirm its pinned head/tree and exact scope.

**Prohibited:** Every third source/test path; dependency or configuration changes; product-price or official-product-data decisions; order authority, offer/shipping authority, card authorization or payment capture; source-derived claims of runtime proof; database, Supabase, Auth, Storage, LINE, EC or other external-service access; schema/RLS/migration creation or application; stage, commit, push, Ready conversion, merge, deployment, or destructive action without its later separate gate.

**Current stopping point:** This plan and ledger update is a two-document uncommitted governance candidate. Source/test implementation remains inactive until this candidate is independently accepted, committed, normally pushed, and explicitly ratified by the product owner after the recorded change.

### GDA-ORDER-SPEC-1 — Dealer-order formal decision and GenSpark UI contract

**Authorization:** On 2026-08-27 the product owner explicitly requested a formal GenSpark production request, a Studio change notice/formal decision, and preservation of the decision specification in the DA master specification. This is a documentation-only exception to the frozen order track.

**Objective:** Establish one reviewable business contract for dealer ordering across DA, Studio, GenSpark, warehouse, payment, inventory, notification, and document-download UI without guessing unresolved implementation details.

**DA literal documentation allowlist:**

1. ADD `docs/master_specification/SPEC_GYEON_ORDER_001_DEALER_ORDER_FORMAL_DECISION_V3.md`
2. ADD `docs/master_specification/SPEC_GYEON_ORDER_001_GENSPARK_UI_PRODUCTION_REQUEST_V3.md`
3. MODIFY `docs/master_specification/GYEON_DA_COMPLETION_PLAN.md`
4. MODIFY `docs/master_specification/GYEON_DA_PHASE_RESULTS.md`
5. MODIFY `docs/master_specification/INDEX.md`

**Studio literal documentation allowlist:**

1. ADD `docs/bound/SPEC-GYEON-ORDER-001_V3_STUDIO_CHANGE_NOTICE.md`
2. MODIFY `docs/bound/README.md`

**Binding decisions recorded:** tax-exclusive list-price total of JPY 30,000 for free shipping; staff drafts with owner-only final order; card, PayPay Bank prepayment, cash on delivery, and super-admin-authorized monthly credit sale; split-first or combined backorder shipment; no GYEON-headquarters inbound split; strict separation of formal, inbound-confirmed, reserved, and orderable stock; durable warehouse work queue plus notifications; downloadable issued delivery-note/invoice PDFs; and a super-admin warehouse calendar whose operating-day and daily cutoff settings control shipment estimates.

**Conflict handling:** The V3 formal-decision document supersedes only the explicitly named conflicting dealer-order clauses in older Studio shipping/ADR documents. The six-state order lifecycle remains unchanged. GYEON-headquarters inbound remains non-splittable; the new split/combined choice applies only to outbound dealer orders containing backordered lines.

**Prohibited:** Source, test, schema, RLS, migration, API, payment-provider, PayPay Bank, warehouse, email, notification, PDF-generation, inventory, or deployment implementation; secret access; external service mutation; design invention outside the contract; stage, commit, push, PR mutation, Ready conversion, merge, migration application, deployment, or destructive action.

**Current stopping point:** The five DA documentation paths were locally committed as `37eb6d4073824684dbcc5839d2717008ab57dd81`; the two Studio documentation paths were locally committed as `07f0694a0e03f74e8e162663d9312ba51340df45`. This plan/result/index delivery-evidence synchronization remains local-only. No push, PR mutation, Ready conversion, merge, implementation, external integration, or deployment is authorized, and the currently active DA implementation phase is not displaced.

### GHP-2A — Public-profile projection seed (accepted pre-GDA-7 exception)

**Authorization:** Explicit product-owner approval on 2026-08-16 to update the Git plan and proceed with the bounded GHP-2 seed before GDA-7.

**Objective:** Repair and independently accept the pure public/private projection boundary in Draft PR #12 before any database, media, API or website implementation begins.

**Responsible agents:** MacBook Claude/Codex may implement the exact repair; MacBook Codex performs independent acceptance. Office AZ remains product authority.

**Accepted status:** The exact two-path source/test seed passed final independent review at PR #12 head `9b8bc1eb2cb59e879f5ebeb5b91e85ba4f522662`, tree `19fb3cf2f08778abaa87313c8908d4e32cb815c4`; focused tests 32/32 PASS, focused strict typecheck PASS, and `git diff --check` PASS. Evidence: [PR #12 comment 5304962007](https://github.com/nisikawa-officeAZ/GYEON/pull/12#issuecomment-5304962007). PR #12 remains Draft/unmerged; this is E2 source/test evidence only.

**Literal implementation allowlist:**

1. `src/lib/dealer-public-profile/dealer-public-profile-projection.ts`
2. `src/lib/dealer-public-profile/dealer-public-profile-projection.test.ts`

**Required repair:** enforce published lifecycle plus owner/operator authorization, fail closed on conflicting qualification rows, prevent raw internal dealer IDs from crossing the public-ID boundary, require explicit-zone ISO/RFC3339 timestamps, and emit qualifications in canonical order.

**Acceptance:** exact two-path scope; focused tests pass; `git diff --check` passes; PR #12 stays OPEN/Draft/unmerged; MacBook Codex posts PASS for the reviewed head.

**Prohibited:** every third path, dependency/config changes, schema/RLS/migration/DB/Supabase/Storage access, store-settings UI, media, external API, website, AI, SEO/MEO, GBP, Ready conversion, merge and deployment.

**Exit:** achieved for the bounded source/test seed; return to the GYEON DA completion critical path. GHP-2B and GHP-3 through GHP-7 remain inactive until GDA-7 or a later explicit Git-governed owner decision. PR #12 Ready conversion and merge remain separate owner-controlled gates.

### GDA-POST-1 — GYEON HP store discovery and SEO/MEO connection

**Activation condition:** GDA-7 is formally closed. The architecture is ratified now, but only the bounded GHP-2A source/test seed above is accepted before that condition.

**Governing contract:** `GYEON_HP_STORE_DISCOVERY_INTEGRATION_SPEC.md`.

**Phase sequence:** GHP-0 contract -> GHP-1 diagnosis -> GHP-2 store profile -> GHP-3 media -> GHP-4 API/nightly sync -> GHP-5 website/structured data -> GHP-6 AI/GBP -> GHP-7 pilot/production.

**Constraint:** This future phase does not authorize schema, Storage, Google, AI, website, migration, deployment or production publication before its separate gates.

## 8. Phase result requirements

Every phase result must record:

- Phase ID and final status.
- Objective and explicit authorization.
- Repository root, base branch/commit/tree, worktree, candidate branch/commit/tree.
- Literal allowlist and actual changed paths.
- Protected-path evidence without prohibited content access.
- Per-path and combined hashes when a bounded candidate is reviewed.
- Exact test commands, counts, exit codes, and evidence paths.
- Typecheck/build/lint applicability and results.
- DB, Supabase, Storage, LINE, deployment, and destructive-action flags.
- Commit/push/PR/Ready/merge/deployment status.
- Known limitations, rollback/recovery boundary, and next phase.

No phase is complete until its result is appended to `GYEON_DA_PHASE_RESULTS.md` and accepted.

## 9. Success measures

The GYEON DA is complete when the critical journey is E5 and field use demonstrates:

- Fewer duplicate customer/vehicle entries.
- Fewer manual transfers between reservation, estimate, work order, report, invoice, and maintenance.
- Fewer screens and clicks after service completion.
- Less customer-message retyping.
- No weakening of pricing, finance, tenant, authorization, or human-approval boundaries.
- AI/server cost stays inside an explicitly configured limit.

## 10. Change control

Any proposed change to mission, fixed decisions, phase order, completion standard, or excluded scope must:

1. Be written as a plan diff.
2. Explain why the current plan no longer achieves the mission.
3. Identify time, risk, security, and field-work impact.
4. Receive explicit user approval.
5. Be committed and recorded in the result ledger before implementation follows the new decision.
