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
3. **GYEON order Draft PR #7 remains historical and frozen.** The separately accepted V3 C4 foundation on `main` may be hardened only through an explicitly recorded GYEON-order phase. The current exception is limited to C5 external-authority contract hardening because dealer product procurement is an operational dependency for delivering GYEON services. This exception does not authorize UI expansion, provider connection, Office AZ inventory implementation on MacBook, migration application, deployment, or production release.
4. **Office AZ inventory is not MacBook implementation scope.** Mac Studio owns the complete Office AZ inventory foundation. MacBook may define integration contracts and perform independent review only.
5. **The closed finance track stays closed.** Accepted invoice, payment, monthly-statement, and PDF-artifact contracts are not redesigned unless a verified regression blocks GYEON DA.
6. **AI assists; humans decide.** AI may draft, summarize, classify, or recommend. It must not issue invoices, send customer messages, overwrite customer/vehicle records, apply migrations, or perform destructive actions without the required human approval.
7. **One active implementation phase at a time.** Work outside the active phase's literal allowlist is prohibited.
8. **Chat does not silently change the plan.** A changed decision is valid only after this document and the result ledger are updated and the user explicitly ratifies the change.
9. **Claude is the bounded implementation agent.** Claude diagnoses, repairs, and runs executable tests only inside an authorized GYEON DA phase; Claude must confirm the Git plan before acting.
10. **Studio owns the complete Office AZ inventory system.** Studio continues autonomously within its approved inventory specification and does not wait for routine MacBook review. It escalates only product-authority changes, security boundaries, scope conflicts, destructive operations, shared-integration contracts, and final DetailerOS integration.

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
- GYEON product-order expansion outside an explicitly recorded V3 C5 contract-hardening phase.
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

- HLS video delivery, customer media gallery, marketing/SEO/growth AI, generic SaaS, white label, ordering expansion, Office AZ inventory implementation on MacBook, and EC expansion.

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

### GYEON-ORDER-V3-C5-B — External-authority DB source-only candidate

**Objective:** Convert the accepted C5-A pure contracts into a fail-closed database source candidate for qualification authority, external evidence consumption, prepare/finalize operations, and warehouse-task release timing. This phase protects the ordering path from browser-controlled qualification, reused payment evidence, long external calls inside database locks, and premature warehouse release.

**Direct GYEON DA dependency:** A detailer cannot deliver a GYEON service without procuring the approved products. C5-B is therefore allowed only as an operational-supply safety dependency. GYEON DA completion remains the primary MacBook mission, and this exception must not expand into generic commerce, EC, or MacBook-owned Office AZ inventory.

**Base candidate:**

- Branch: `agent/gyeon-order-v3-c5-external-authority-design`
- C5-A commit: `a3da60d662bc8da7ad09f17740fc7975dd917f35`
- Governance commit: `4f60c23dab963d151e56ec11dfa076ea0472c2c1`
- C5-B source commit: `1ae0f7e91f3889ea08c894bcb589bb35a15303ec`
- C5-B source tree: `a6f7fde6b4b9b8c15689ccd5124f17632c6e9f92`
- Coordination PR: `https://github.com/nisikawa-officeAZ/GYEON/pull/36` — OPEN/Draft

**Literal source allowlist:**

- `supabase/migrations/DRAFT_DO_NOT_APPLY/gyeon_order_v3_contract.sql`
- `src/lib/product-orders/gyeon-order-v3-migration-contract.test.ts`
- `src/lib/product-orders/gyeon-order-v3-rpc-contract.test.ts`

**Required behavior:**

- Replace client-controllable `qualification_verified` text with a server-owned, versioned qualification authority and bound evaluation snapshot.
- Strengthen external evidence with purpose, provider event identity, dealer/order/version/fingerprint/amount/currency binding, expiry, server verification, and one-time consumption.
- Separate prepare and finalize transactions so no PSP, bank, inventory, or email call occurs while an order row lock is held.
- Preserve the original order and original authorization on provider failure, unknown response, stale preparation, or version conflict; record only a compensation intent for a newly succeeded but unusable authorization.
- Create exactly one `unaccepted` warehouse task when payment, supply, reservation/backorder, and calendar authorities are ready. Warehouse acceptance must consume that existing task and must not create the task for the first time.
- Keep card PSP, PayPay Bank, Office AZ reservation, and email providers as fail-closed stubs. Provider-specific authentication, signatures, webhooks, secrets, and network calls are outside C5-B.
- Keep the SQL file visibly `DRAFT_DO_NOT_APPLY` and transactionally self-rolling-back if executed accidentally.

**Verification candidate:**

- Focused TypeScript source-contract tests covering the three literal source paths.
- Strict targeted TypeScript check for the modified contract tests.
- `git diff --check` limited to the allowlist.
- No Supabase project connection, local database execution, migration generation, migration history mutation, or external provider request in C5-B.

**Protected paths:** All paths in section 3.1 remain metadata-only or closed. `ScreensPreview.tsx` must never be opened, read, diffed, copied, staged, or modified.

**Responsibility:** Office AZ is product authority; MacBook Codex owns specification and independent acceptance; MacBook Claude performs bounded diagnosis/implementation/tests after the mandatory Draft-PR instruction exists; Mac Studio remains the sole Office AZ inventory implementation owner.

**State boundary:** C5-B reached the pushed E2 source-candidate boundary at commit `1ae0f7e91f3889ea08c894bcb589bb35a15303ec`. The SQL remains under `DRAFT_DO_NOT_APPLY`, PR #36 remains Draft, and no local/hosted database, provider, migration apply, Ready conversion, merge, or deployment is authorized by C5-B.

**Acceptance target:** E2 source candidate only. C5-C disposable-database acceptance is required before any schema candidate can advance, and production release remains blocked by unresolved external authorities.

### GYEON-ORDER-V3-C5-B-R1 — Source-integrity repair gate

**Status:** AUTHORIZED FOR ONE BOUNDED THREE-FILE REPAIR AND FOCUSED SOURCE-CONTRACT TEST ONLY. Commit, push, database execution, C5-C harness work, and release remain separately gated.

**Reason for return:** The authorized C5-C read-only diagnosis returned `CHANGES_REQUIRED_SOURCE`. C5-C's mandatory fail/burn rule requires a source defect to return to a separately authorized C5-B repair gate before any harness authoring or disposable runtime is started.

**Diagnosis authority:**

- Result: `GYEON_ORDER_V3_C5_C_READ_ONLY_DIAGNOSIS_RESULT_V1`
- Diagnosed execution HEAD: `33aac8f1a4e035141c2c0dc12856b7528494e09c`
- Diagnosed execution tree: `c5dbf56af3ccfce99391ac81fc3ac0bbd6c76666`
- Coordination PR: `https://github.com/nisikawa-officeAZ/GYEON/pull/36` — must remain OPEN/Draft

**Literal implementation allowlist — exactly three existing paths:**

1. `supabase/migrations/DRAFT_DO_NOT_APPLY/gyeon_order_v3_contract.sql`
2. `src/lib/product-orders/gyeon-order-v3-migration-contract.test.ts`
3. `src/lib/product-orders/gyeon-order-v3-rpc-contract.test.ts`

No file may be created, deleted, renamed, formatted, staged, or modified outside this list during the repair candidate.

**Required repairs:**

1. **Classification-version integrity.** Qualification evaluation must accept only one identical non-null current server-owned `classification_version` across every order line. Mixed or missing versions fail closed; the last iterated line must never silently become the snapshot authority.
2. **Immutable qualification replay.** An existing `(order_id, order_version)` snapshot is immutable. Exact canonical replay may return the existing snapshot unchanged. Any changed dealer, mode, rule version, classification version, input fingerprint, decision, lifecycle, or other canonical field fails closed; no conflict path updates historical authority or `evaluated_at`.
3. **Payment-method-specific warehouse release.** Release must use explicit allow rules rather than a status blocklist. Card authority, bank-match evidence, cash-on-delivery restrictions, and effective credit-account terms are independently revalidated. Bank evidence is fully bound and consumed exactly once in the release transaction. Card split-capture unresolved state, `voided`, unknown, missing, expired, mismatched, reused, or stopped authority fails closed. Existing reservation/backorder and one-unaccepted-task behavior remains unchanged.

**Focused verification:**

- Run exactly the two existing C5-B source-contract test files together with the accepted `tsx` loader command.
- Add deterministic regression assertions for all three repairs, including hostile mismatch/replay cases and valid method-specific release paths.
- Run `git diff --check` only on the three allowlisted paths.
- Record focused test count, exit code, exact changed paths, per-path SHA-256, HEAD/tree, and clean protected-path metadata.

**Boundaries:**

- SQL remains visibly `DRAFT_DO_NOT_APPLY` and retains one terminal `ROLLBACK`.
- No SQL execution, migration derivation/application, Supabase, database, Docker, Colima, Auth, HTTP, provider, Vercel, deployment, Ready conversion, or merge.
- No provider payload, signature, webhook, secret, or network implementation.
- No Office AZ inventory implementation on MacBook.
- All section 3.1 protected paths remain metadata-only; `ScreensPreview.tsx` content is never opened, read, diffed, copied, staged, or modified.
- The repair candidate is performed by terminal Claude only. Do not invoke GitHub Claude or add `@claude`.

**Exit:** Claude returns `GYEON_ORDER_V3_C5_B_R1_SOURCE_REPAIR_RESULT_V1`; MacBook Codex independently reviews the exact three-path diff and verification evidence. Source commit/push, C5-C resumption, and any database work remain later separate gates.

### GYEON-ORDER-V3-C5-B-R1-A2 — Payment-authority correction gate

**Status:** GOVERNANCE DOCUMENT AUTHORING, EXACT GOVERNANCE-ONLY COMMIT, AND NORMAL PUSH ARE AUTHORIZED. Terminal Claude execution, implementation commit/push, database work, PR instruction/comment, and release remain separately gated.

**Reason for correction:** The R1 terminal-Claude candidate returned `READY_FOR_CODEX_READ_ONLY_REVIEW`, and its focused source-contract tests passed 58/58. Independent MacBook Codex review nevertheless returned `CHANGES_REQUIRED_SOURCE` because the tests did not cover three required hostile payment paths and the SQL still permitted them.

**Required dirty-source baseline before any A2 execution:**

- Governance HEAD before this documentation commit: `e6d78156c79ecd4a5d68ad88869f09db1b654192`
- Governance tree before this documentation commit: `5438e4c33e7445d4eaa537cb53de5e9c2e31bacd`
- `supabase/migrations/DRAFT_DO_NOT_APPLY/gyeon_order_v3_contract.sql` — modified, SHA-256 `8313b9d5216049672850f2ff7c5d68d73f228c82b442e6f4df48bb94fd9127a8`
- `src/lib/product-orders/gyeon-order-v3-rpc-contract.test.ts` — modified, SHA-256 `d4fb000235680fbc8d9921d9c02d75dc9f2af8673c5275b44df6aa0c9acc7eba`
- `src/lib/product-orders/gyeon-order-v3-migration-contract.test.ts` — unchanged, SHA-256 `c071ba016e10419f4412bdc93c4c34c43130dffbe25d228d51533646672ab5c5`

The dirty R1 source candidate is intentionally retained and must not be staged, committed, reverted, cleaned, stashed, or overwritten by the governance-only commit.

**Literal future implementation allowlist — exactly three existing paths:**

1. `supabase/migrations/DRAFT_DO_NOT_APPLY/gyeon_order_v3_contract.sql`
2. `src/lib/product-orders/gyeon-order-v3-migration-contract.test.ts`
3. `src/lib/product-orders/gyeon-order-v3-rpc-contract.test.ts`

**Required A2 corrections:**

1. **Bound card authority.** Card owner-submit finalize must fail closed unless the exact prepared operation and exact accepted evidence are supplied and consumed. Persist a server-owned link from the submitted order to the immutable accepted evidence that is the current card authority. Release must verify that link and its dealer/order/fingerprint/amount/currency/state/consumption binding; `payment_status = 'authorized'` alone is never authority. A successful amount-changing edit must atomically replace the current link with the accepted reauthorization evidence, while an amount-preserving edit must not erase it.
2. **Forced credit-account terms.** If active and currently effective credit-account terms exist for the dealer, prepare, finalize, and release must reject card, bank transfer, and cash on delivery. If `credit_account` is selected without active/effective terms, it must fail closed. A stopped, expired, missing, or mismatched credit authority never releases an order.
3. **Exact status allow rules.** Card requires `authorized` plus bound evidence; bank transfer requires the exact pre-release pending state plus one exact bank-match evidence and atomically advances to `paid`; cash on delivery and credit account require their exact accepted non-provider state. `voided`, `failed`, pending-in-the-wrong-method, selection-required, unknown, null, or otherwise mismatched status always denies before warehouse-task creation.
4. **Hostile regression coverage.** Add deterministic assertions that fail on: null card prepared/evidence IDs; a forged `authorized` string without bound evidence; stale or mismatched card evidence; active credit terms paired with any non-credit method; stopped/expired credit terms; bank or credit with `voided`/`failed`/wrong status; and any warehouse-task insert before these checks. Preserve and re-run the accepted R1-01/R1-02 coverage.

**Boundaries:**

- SQL remains visibly `DRAFT_DO_NOT_APPLY` and ends in the single terminal `ROLLBACK`.
- No provider payload/signature/webhook/secret/network implementation, no PayPay Bank adapter, and no caller-authoritative success flag.
- No SQL execution, database, Supabase, Docker, Colima, Auth, HTTP, provider, Git delivery, GitHub comment, Ready conversion, merge, or deployment.
- All protected paths remain metadata-only. `ScreensPreview.tsx` content is never opened, read, diffed, copied, staged, or modified.
- A2 terminal-Claude execution requires a later explicit owner authorization plus an exact non-triggering PR instruction. This governance commit does not authorize that execution.

**Exit:** A later authorized terminal-Claude session returns `GYEON_ORDER_V3_C5_B_R1_A2_SOURCE_CORRECTION_RESULT_V1`; MacBook Codex independently verifies the hostile paths and exact three-file scope before any implementation commit is considered.

### GYEON-ORDER-V3-C5-B-R1-A3 — Codex direct payment-authority closure

**Status:** SOURCE CANDIDATE ACCEPTED, COMMITTED, AND PUSHED. C5-C disposable-database execution remains separately gated.

**Owner-authorized exception:** After the A2 terminal-Claude candidate passed its focused tests but MacBook Codex found three residual payment-authority defects, the owner explicitly authorized MacBook Codex to perform one direct, two-file A3 correction to avoid another high-credit Claude loop. This is a narrow exception for A3 only; it does not silently replace the normal phase protocol.

**Accepted source:**

- Branch: `agent/gyeon-order-v3-c5-external-authority-design`
- Commit: `37573c3f9cc476b8d7911221a8696ee61109b9bf`
- Tree: `c94ca1944e1c2d54b5728943501fbc07edc9668a`
- `supabase/migrations/DRAFT_DO_NOT_APPLY/gyeon_order_v3_contract.sql` — SHA-256 `7b72c49baa7a42e56e23959bfc69919c181ba7f51b4aa186aa69edfa575015f4`
- `src/lib/product-orders/gyeon-order-v3-rpc-contract.test.ts` — SHA-256 `990a94cdd7417de89348e5a357a33a6766ee9f6b07289cc0f89be3494852b0ba`
- `src/lib/product-orders/gyeon-order-v3-migration-contract.test.ts` — unchanged, SHA-256 `c071ba016e10419f4412bdc93c4c34c43130dffbe25d228d51533646672ab5c5`

**Accepted A3 closure:**

1. The order persistently binds the accepted card-evidence ID and its exact server-owned request fingerprint; authorized status without the complete binding fails closed.
2. Warehouse release rejects missing, expired, voided, mismatched, wrongly consumed, or purpose/consumption-inconsistent card authority before task creation.
3. If credit-account terms become active after a new external card authorization succeeds but before finalize, the denial transaction inserts one idempotent `void_new_card_authorization` compensation intent before returning.
4. Amount-changing card edit replaces both authority link fields; amount-preserving edit preserves both.

**Verification:** Exact focused command passed `68/68`, `git diff --check` passed, the worktree was clean after commit, and PR #36 plus the remote branch resolved to the exact accepted commit. No database, Supabase project, provider, Ready conversion, merge, or deployment action occurred.

**Exit:** Refresh C5-C's hash-bound predecessor to this commit, then obtain a separate authorization before any harness change or disposable runtime execution.

### GYEON-ORDER-V3-C5-B-R2 — Inventory evidence and payment-contract snapshot repair

**Status:** SOURCE REPAIR ACCEPTED, COMMITTED, AND PUSHED. C5-C R2-bound diagnosis, harness implementation, disposable execution, and database application remain separately gated.

**Reason for return:** The A3-bound C5-C read-only diagnosis returned `CHANGES_REQUIRED_SOURCE`. Independent MacBook Codex review confirmed that warehouse release currently checks only whether an `inventory_reservation` evidence row exists; it does not prove an exact unique dealer/order/version/fingerprint/amount/currency binding, lock that row, or consume it atomically. The same diagnosis exposed a business-contract gap: mutable dealer credit terms could retroactively alter the payment path of an already owner-confirmed order.

**Predecessor:**

- Branch: `agent/gyeon-order-v3-c5-external-authority-design`
- Accepted source commit: `37573c3f9cc476b8d7911221a8696ee61109b9bf`
- Accepted source tree: `c94ca1944e1c2d54b5728943501fbc07edc9668a`
- Current governance/execution HEAD: `5b8624c5a30fa961268e9a4535b935a6d00e7407`
- Current governance/execution tree: `9615cd5a754a11bd14c49dce23e7ee6ee1f36b27`
- SQL SHA-256: `7b72c49baa7a42e56e23959bfc69919c181ba7f51b4aa186aa69edfa575015f4`
- RPC-contract test SHA-256: `990a94cdd7417de89348e5a357a33a6766ee9f6b07289cc0f89be3494852b0ba`
- Migration-contract test SHA-256: `c071ba016e10419f4412bdc93c4c34c43130dffbe25d228d51533646672ab5c5`
- Diagnosis result: `GYEON_ORDER_V3_C5_C_A3_READ_ONLY_DIAGNOSIS_RESULT_V2` — `CHANGES_REQUIRED_SOURCE`

**Owner-ratified payment contract:**

1. The first successful owner-confirmation/finalize freezes one explicit server-owned payment-contract snapshot on the order. The snapshot distinguishes standard payment from credit account and records the exact credit-terms version when credit account governs the order.
2. Credit terms activated after that first successful finalize do not retroactively change an already-confirmed standard-payment order and do not automatically void its existing card authorization.
3. If active and effective credit terms govern the dealer at the first successful finalize, the order must use `credit_account`; card, bank transfer, and cash on delivery fail closed.
4. Amount-changing and amount-preserving pre-warehouse edits preserve the frozen payment-contract snapshot. Cancelling and creating a new order evaluates the then-current terms as a new contract.
5. A credit-account order must revalidate its exact bound terms version at warehouse release. Missing, stopped, expired, mismatched, or otherwise invalid bound terms fail closed.
6. A submitted order with no explicit payment-contract snapshot fails closed. No mutable-current-row inference, automatic backfill, or guessed default is allowed.

**Required inventory-reservation repair:**

- Non-backorder warehouse release requires exactly one unconsumed, server-verified, successful, unexpired `inventory_reservation` evidence row bound to the exact dealer, order, current order version, server-owned request fingerprint, amount, and currency.
- Release locks that exact evidence row and consumes it atomically before inserting the warehouse task. Zero candidates, multiple candidates, mismatch, expiry, reuse, or a wrong purpose/consumption pairing fails closed before task creation.
- The separately approved backorder authority remains independent. A backorder path must not consume unrelated reservation evidence or treat arbitrary reservation evidence as authority.

**Accepted R2 source:**

- Branch: `agent/gyeon-order-v3-c5-external-authority-design`
- Commit: `3403918d0166c30c44abb95bad1c8a7335877cab`
- Tree: `1d1617a49bc1dd1e4b21515fec4940c3fdc4f827`
- SQL SHA-256: `d04517f479a956ba50f7d1b7ce636f8fc57b7e02d81f47b0adf457e1e12e2e73`
- RPC-contract test SHA-256: `dbc7be4c08195c944eb00a0c28dc839736340b7c0df3e31ad617bdfa957a4159`
- Migration-contract test SHA-256: `c071ba016e10419f4412bdc93c4c34c43130dffbe25d228d51533646672ab5c5` — unchanged
- Verification: exact focused command `77/77` PASS, exit `0`; `git diff --check` PASS
- Delivery: normal push to PR #36; PR remains OPEN/Draft

**Historical R2 governance write allowlist — exactly four paths:**

1. `docs/master_specification/GYEON_DA_COMPLETION_PLAN.md`
2. `docs/master_specification/GYEON_DA_PHASE_RESULTS.md`
3. `docs/integrations/gyeon-order/v3-c5c-disposable-db-verification-plan.md`
4. `docs/master_specification/CLAUDE_DIRECTIVE_GYEON_ORDER_V3_C5_B_R2_INVENTORY_EVIDENCE_AND_PAYMENT_CONTRACT_SNAPSHOT_REPAIR.md` (new)

**Future source-repair allowlist — exactly three existing paths:**

1. `supabase/migrations/DRAFT_DO_NOT_APPLY/gyeon_order_v3_contract.sql`
2. `src/lib/product-orders/gyeon-order-v3-migration-contract.test.ts`
3. `src/lib/product-orders/gyeon-order-v3-rpc-contract.test.ts`

**Current boundary:** R2 source delivery is complete. The guarded SQL remains under `DRAFT_DO_NOT_APPLY` with its terminal `ROLLBACK`; no local, shared, staging, or production database was contacted. The next gate is one R2-bound read-only harness diagnosis. It does not authorize harness writes, tests, Docker/Colima/Supabase, database access, SQL derivation/application, or provider work.

**Exit:** Refresh C5-C to the exact R2 commit/tree/hashes and obtain separate authorization for one read-only harness diagnosis. Harness authoring begins only after a `READY_FOR_HARNESS_IMPLEMENTATION` diagnosis is independently accepted.

### GYEON-ORDER-V3-C5-C — Disposable-database acceptance design and execution gates

**Status:** `C5C_DISPOSABLE_DB_PASS` / RESULT COMMITTED AND PUSHED / PR #36 SQUASH-MERGED TO MAIN. C5-C E2 local disposable acceptance is complete. Formal migration promotion, shared or production application, provider connection, and manual deployment remain separately unauthorized.

**Objective:** Prove the pushed C5-B database source candidate on one fresh loopback-only PostgreSQL 17 disposable Supabase runtime, including real signed Auth/PostgREST requests, exact RLS/grant behavior, prepare/finalize evidence consumption, server-owned qualification, durable compensation, warehouse-task release timing, and genuine separate-connection races.

**Predecessor:**

- Branch: `agent/gyeon-order-v3-c5-external-authority-design`
- Commit: `3403918d0166c30c44abb95bad1c8a7335877cab`
- Tree: `1d1617a49bc1dd1e4b21515fec4940c3fdc4f827`
- SQL SHA-256: `d04517f479a956ba50f7d1b7ce636f8fc57b7e02d81f47b0adf457e1e12e2e73`
- RPC-contract test SHA-256: `dbc7be4c08195c944eb00a0c28dc839736340b7c0df3e31ad617bdfa957a4159`
- Migration-contract test SHA-256: `c071ba016e10419f4412bdc93c4c34c43130dffbe25d228d51533646672ab5c5`
- Source verification: focused contract tests `77/77` PASS and `git diff --check` PASS
- Known environment limitation: full-project typecheck is not an acceptance signal in the isolated worktree because repository dependencies and archived UI type roots are unresolved

**Accepted C5-C execution and result delivery:**

- Accepted disposable execution HEAD/tree: `a8bea097cee6060c0eca52d7c11a560da5f60c6f` / `5adb744aee61fb59487879bcc524590ee2c2c8aa`.
- Accepted fresh suffix: `20260829T071034Z-z6m3r8`; the exact runtime was removed after retained-evidence verification.
- Result: `GYEON_ORDER_V3_C5_C_DISPOSABLE_DB_VERIFICATION_RESULT_V1` — `C5C_DISPOSABLE_DB_PASS`.
- Raw proof: migration replay 110 applied plus one protected exclusion; pgTAP `186/186`; real Auth/PostgREST `35/35`; genuine separate-connection assertions `11/11`; warning-only DB lint; four query-plan captures; `SECRET_SCAN_CLEAN`; all named fixture families zero.
- Evidence integrity: 19 canonical non-hidden files, 18 manifest artifact hashes, zero mismatch, and successful retained copy, hash verification, project stop, and exact runtime removal.
- Result record commit/tree: `8144e0baf9c715ddc72ee835797646d2bbfe0a2d` / `3aba01289f52ecc7808174fb647b28becf61edf9`.
- PR #36 was squash-merged to `main` as commit `96a66c3fb5969718418da1ef4c75fe62407b48aa` with tree `d8d6d3bdd5d809714896fe006d73910e175f130d`. Its Vercel automatic deployment completed successfully; this merge/deployment did not apply a database migration or connect a provider.
- Evidence class remains `E2_LOCAL_DISPOSABLE_DB`; no shared, staging, production, hosted-provider, or E3 authority is inferred.

**Historical C5-C R4 governance write allowlist — exactly four paths:**

- `docs/master_specification/GYEON_DA_COMPLETION_PLAN.md`
- `docs/master_specification/GYEON_DA_PHASE_RESULTS.md`
- `docs/integrations/gyeon-order/v3-c5c-disposable-db-verification-plan.md`
- `docs/master_specification/CLAUDE_DIRECTIVE_GYEON_ORDER_V3_C5_C_HARNESS_IMPLEMENTATION.md` (new)

**Accepted R2-bound diagnosis:**

- Directive: `GYEON_ORDER_V3_C5_C_R2_READ_ONLY_HARNESS_DIAGNOSIS_V1`.
- Accepted result: `GYEON_ORDER_V3_C5_C_R2_READ_ONLY_HARNESS_DIAGNOSIS_RESULT_V1` — `READY_FOR_HARNESS_IMPLEMENTATION`.
- Execution HEAD/tree: `960835a58a01ff249dcc0e99c72b5542b003042e` / `2b09af16fafa1e2b5ba0c6da30f507dced0fb0b1`.
- The first terminal-Claude invocation is not acceptance evidence because it did not return the complete result and disclosed one prohibited `gh pr view` call. The corrected invocation returned the complete result with zero write, test, database, network, Git, or PR action.
- MacBook Codex independently confirmed the exact R2 source hashes, clean worktree/index, protected blobs, payment-contract snapshot structure, inventory-reservation lock/consume-before-task ordering, and stale C4 RPC references.
- Claude's phrase “17-file manifest” was a counting error. The canonical plan lists exactly 19 required evidence artifacts; the implementation directive fixes the count without changing the evidence contract.
- The diagnosis found no required C5-B source repair, owner decision, plan expansion, or write-allowlist change before harness authoring.

**Accepted harness implementation allowlist — exactly nine paths:**

1. `scripts/e2e/gyeon-order-v3-c5c/config.toml`
2. `scripts/e2e/gyeon-order-v3-c5c/setup.sh`
3. `scripts/e2e/gyeon-order-v3-c5c/schema-rls.test.sql`
4. `scripts/e2e/gyeon-order-v3-c5c/qualification-evidence.test.sql`
5. `scripts/e2e/gyeon-order-v3-c5c/prepare-finalize-warehouse.test.sql`
6. `scripts/e2e/gyeon-order-v3-c5c/real-auth.mjs`
7. `scripts/e2e/gyeon-order-v3-c5c/concurrency.mjs`
8. `scripts/e2e/gyeon-order-v3-c5c/capture-evidence.sh`
9. `scripts/e2e/gyeon-order-v3-c5c/cleanup.sh`

The result document was excluded from harness implementation and was created later in the separately approved result-recording gate.

**Historical harness implementation boundary — completed under separate approvals:**

- The committed implementation directive is `GYEON_ORDER_V3_C5_C_HARNESS_IMPLEMENTATION_V1`.
- The owner separately authorized the exact accepted execution HEAD/tree, external transmission, nine-path harness candidate, static verification, harness Git delivery, fresh disposable execution, result recording, result Git delivery, result comment, and Ready conversion.
- Harness implementation used only `bash -n`, `node --check`, the directive's untracked-aware `git diff --no-index --check /dev/null` loop, and the exact stale-identifier search before its separately approved runtime execution.
- Hosted Supabase, shared or production PostgreSQL, and external providers were not contacted. The accepted runtime was loopback-only and disposable.
- Formal migration promotion, environment application, provider integration, merge, and deployment remain later separate gates.

**Required execution evidence — satisfied by the accepted run:**

- Exact committed-migration replay plus one hash-bound runtime derivative of the C5-B guarded SQL with only its terminal `ROLLBACK` changed to `COMMIT`.
- PostgreSQL 17 and current pinned Supabase CLI identity.
- pgTAP schema/RLS/grant/function tests with no plan mismatch, skip, todo, or `NOTESTS`.
- Real local GoTrue tokens and PostgREST requests; SQL-only claim strings or service-role success are not authorization proof.
- Two simultaneous independent database connections plus a third observer proving distinct backend PIDs for every required race.
- Exact fixture cleanup, runtime teardown, raw evidence manifest, secret-redaction proof, and unchanged repository/protected-path metadata.

**Mandatory fail/burn rule:** Any replay, pgTAP, real-Auth, business-contract, concurrency, evidence, or cleanup failure burns the suffix and evidence set. The failed runtime is never repaired or rerun into acceptance. A source defect returns to a separately authorized C5-B repair gate; an environment defect requires a new owner-approved C5-C attempt with a fresh suffix.

**Protected paths:** All section 3.1 paths remain protected. `ScreensPreview.tsx` stays pathname/mode/blob/Git-state only. The LINE migration remains excluded from disposable replay unless a separate LINE phase authorizes it; no hosted/linked project may be contacted.

**Responsibility:** MacBook Claude performed the bounded diagnosis and harness candidate work under its exact directives. MacBook Codex independently accepted scope, executed the separately approved disposable run, and reviewed the raw evidence. Mac Studio remains the sole Office AZ inventory implementation owner.

**Acceptance result:** `C5C_DISPOSABLE_DB_PASS`. This is E2 local verification strengthened by disposable-database evidence. C5-C is not E3 because no authorized shared or staging environment was contacted. PR #36 merge and its Vercel automatic deployment are complete, but formal migration promotion, Dev-Next or production database application, and provider connection remain separately unauthorized.

### GYEON-ORDER-V3-C5-D — Formal migration promotion

**Status:** PR #37 BRANCH PUSHED THROUGH `d06cd8a45d404c3e66c086341b80b0a5436b260b` / FORMAL MIGRATION SOURCE STATIC TESTS 78/78 PASS / R4 DISPOSABLE HARNESS GOVERNANCE CANDIDATE UNCOMMITTED / HARNESS NOT IMPLEMENTED / DATABASE NOT CONTACTED.

**Objective:** Promote the C5-C-accepted guarded SQL into one new timestamped formal migration without changing executable semantics, then prove the exact formal file through a separate fresh disposable replay, populated legacy-data upgrade, and Supabase CLI-native migration path before any shared-environment application.

**Base authority:**

- `main` commit: `96a66c3fb5969718418da1ef4c75fe62407b48aa`
- `main` tree: `d8d6d3bdd5d809714896fe006d73910e175f130d`
- DRAFT SQL SHA-256: `d04517f479a956ba50f7d1b7ce636f8fc57b7e02d81f47b0adf457e1e12e2e73`
- C5-C runtime derivative SHA-256: `93d69dbdcf20910ab81ea9a809dacd250156fd0a5ef728f48db4a793f539cf67`
- C5-C guard transformation: exactly one terminal `rollback;` to `commit;`

**Governance documents:**

- `docs/integrations/gyeon-order/v3-c5d-formal-migration-promotion-plan.md`
- `docs/master_specification/CLAUDE_DIRECTIVE_GYEON_ORDER_V3_C5_D_FORMAL_MIGRATION_PROMOTION.md`

**Governance-only authorization:** The owner authorized the four-document C5-D governance candidate only. This authorization does not permit formal SQL creation, Supabase CLI execution, tests, DB/Supabase/Docker/Colima/Auth/PostgREST access, provider connection, Git delivery, PR mutation, environment application, Ready, merge, or deployment.

**Source-candidate write allowlist — later authorized under R2 and committed under R3:**

1. `supabase/migrations/<SUPABASE_CLI_GENERATED_TIMESTAMP>_gyeon_order_v3_contract.sql` (new)
2. `supabase/migrations/DRAFT_DO_NOT_APPLY/README.md`
3. `src/lib/product-orders/gyeon-order-v3-migration-contract.test.ts`
4. `src/lib/product-orders/gyeon-order-v3-rpc-contract.test.ts`

**Mandatory promotion contract:** Use `supabase migration new gyeon_order_v3_contract`; keep the DRAFT SQL immutable and terminal-ROLLBACK; permit only formal-state full-line comment replacements plus one terminal `ROLLBACK` to `COMMIT`; prove the formal executable SQL is byte-equivalent to the accepted derivative and that no second formal candidate exists.

**Mandatory post-source verification:** A later fresh C5-D runtime must apply the formal migration itself, never a DRAFT-derived runtime file. It must cover (A) full fresh replay, (B) baseline plus representative populated legacy orders/items before the C5-D migration, and (C) the Supabase CLI-native migration-runner path intended for later environment use. The full pgTAP, real Auth/PostgREST, separate-connection concurrency, advisor, query-plan, secret, cleanup, and evidence-integrity gates are rerun with a fresh suffix.

**Rollback boundary:** Before environment application, discard/revert only the candidate. After any formal application, never rewrite migration history; recover only through a new forward-only compensating migration under a separate owner-approved gate.

**Current exit boundary:** Verify the exact four-document R4 harness-governance candidate, then request separate stage/local-commit and push authorization. Harness implementation, harness Git delivery, fresh disposable execution, result delivery, and every shared/staging/production application or provider connection remain later separate gates.

**R1 correction:** The original directive incorrectly required the checked-out implementation HEAD to equal the main base commit. That would reject the delivered governance commit containing the directive. R1 replaces this self-defeating condition with two independent checks: Codex supplies the exact accepted execution HEAD/tree at invocation, and the fixed main base commit/tree must remain its ancestor/base boundary. The committed delta from main to execution HEAD must remain exactly the four C5-D governance paths. R1 changes only this directive, this completion plan, and the append-only phase ledger; no SQL, source, test, runtime, database, provider, or Claude execution is included.

**R2 owner-authorized Codex-direct exception:** The owner explicitly authorized MacBook Codex to create the one C5-D uncommitted source candidate directly after repeated external-Claude permission failures. This is a narrow exception for C5-D source-candidate authoring only, chosen to prevent further Claude credit and operator-time waste. It does not alter the four-path source allowlist, the required `supabase --help` / `supabase migration --help` / `supabase migration new gyeon_order_v3_contract` sequence, the exact parity contract, the static focused-test gate, or any protected-path rule. It does not authorize stage, commit, push, PR mutation, database/Supabase runtime access, provider connection, shared/staging/production application, Ready, merge, deployment, or the later fresh disposable verification. The external-Claude run that reached the directive stopped because its Bash permission mode denied the required Supabase CLI commands; it changed no files. Later launcher attempts were rejected before Claude execution or returned no network grant. No further Claude invocation is permitted for this source-candidate gate.

**R3 source-candidate result:** After separate owner approvals for direct source authoring and then exact four-path stage/local commit, MacBook Codex created `supabase/migrations/20260829101726_gyeon_order_v3_contract.sql` through the discovered Supabase CLI migration command, kept the accepted DRAFT immutable at SHA-256 `d04517f479a956ba50f7d1b7ce636f8fc57b7e02d81f47b0adf457e1e12e2e73`, and produced formal SHA-256 `bd1a7742725c3f2a7bb42a3dbe5889b6e86bf6d213a0a550e6dd48f460d6d91b`. Deterministic expected-formal and executable-byte parity checks passed, exactly one formal candidate exists, the focused migration/RPC source-contract suite passed 78/78, and `git diff --check` passed. The exact four-path source commit is `c7806331dcbb035448704e09c625cd4870681142` with tree `0fc735bd9f04d6bc54664e5874faa08e82cbdb60`. This is static source-candidate acceptance only: no disposable database replay, populated legacy upgrade, CLI-native migration-runner proof, provider connection, push, PR mutation, shared/staging/production application, Ready, merge, or deployment is authorized or completed.

**R4 disposable-harness governance candidate:** The source and result commits were normally pushed through HEAD `d06cd8a45d404c3e66c086341b80b0a5436b260b`. The next candidate adds `docs/integrations/gyeon-order/v3-c5d-disposable-db-verification-plan.md` and `docs/master_specification/CLAUDE_DIRECTIVE_GYEON_ORDER_V3_C5_D_DISPOSABLE_DB_HARNESS_IMPLEMENTATION.md`, updates this completion plan, and appends the phase ledger. It requires three isolated loopback-only runtime lanes: A fresh full-chain replay, B populated legacy upgrade from version `20260826143000`, and C CLI-native pending migration proof. The existing C5-C harness remains immutable read-only reference; the future C5-D harness is restricted to ten new paths under `scripts/e2e/gyeon-order-v3-c5d/`. This governance candidate performs no harness implementation, external transmission, Git delivery, Colima/Docker/DB/Supabase runtime, Auth/PostgREST, provider, environment, Ready, merge, or deployment action.

**Owner pause — 2026-08-29:** The owner explicitly paused C5-D-R4 before harness implementation so the blocking Estimate Wizard Preview pricing failure can be recovered first. The existing C5-D source, governance candidate, hashes, and evidence remain preserved. No C5-D harness path, database, provider, environment, PR, Ready, merge, or deployment action is authorized while the pause is active.

### GYEON-ORDER-V3-C5-E0 — Stripe provider selection governance

**Status:** OWNER RATIFIED / STRIPE RESPONSE RECEIVED / UPFRONT FULL-PAYMENT DECISION COMMIT PUSHED / PR #49 OPEN / PROVIDER NOT CONNECTED.

**Decision:** Stripe is the canonical card PSP for GYEON dealer ordering. The intended product surface is Stripe Payments with the PaymentIntents API. The owner already has a Stripe account, but no account identifier, API key, Webhook secret, or other secret may be written into specifications or source control. The owner subsequently ratified one upfront full-payment contract for all card brands, including JCB.

**Business contract for card payment and back-order shipment:** At owner final submit, charge and capture the entire immutable tax-inclusive payable JPY order total once, including back-ordered items. `ship_available_first` and `ship_when_complete` are logistics choices only and never change card amount or capture count. No multicapture, shipment-by-shipment PaymentIntent, SetupIntent-based later charge, authorization extension, or automatic post-payment increase is used. A confirmed cancellation, non-fulfillable item, or final shortage is resolved only by an exact server-calculated partial or full refund. Additional items require a separate order.

**Mandatory fail-closed boundary:** Provider selection and the business decision are not provider readiness. Exact API version, actual account card-brand availability, immediate capture, cancellation, partial/full refund, idempotency, retry/finality, and Webhook signature/reconciliation remain `NOT_CONFIGURED`. IC+ eligibility, multicapture enablement, JCB multicapture support, and authorization-extension windows are no longer dependencies of the selected flow. Card payment remains unavailable until the exact full-payment/refund contract passes a separately authorized provider sandbox gate. No automatic payment-method change, post-payment amount edit, additional saved-card charge, or shipping-policy substitution may be invented.

**Existing source incompatibility:** The accepted C5-B/C5-D database artifacts bind card authorization and reauthorization evidence. They do not implement this newly ratified full-payment and refund contract. C5-D remains paused, and those artifacts must not be applied to any shared, staging, or production environment until one forward-only correction phase and fresh disposable verification replace the stale card-authority behavior without weakening the accepted qualification, inventory, payment-method, or warehouse-task boundaries.

**Documentation-only allowlist:**

1. `docs/master_specification/SPEC_GYEON_ORDER_001_DEALER_ORDER_FORMAL_DECISION_V3.md`
2. `docs/integrations/gyeon-order/v3-c5-external-authority-design-and-impact.md`
3. `docs/master_specification/GYEON_DA_COMPLETION_PLAN.md`
4. `docs/master_specification/GYEON_DA_PHASE_RESULTS.md`

**Delivery result:** The exact four-document decision was committed as `b6c7d4a27cd2d307ab56e81dd73a0d810934cb94` with tree `8fc1d7c1f967f18934d21ca15e0fe02b7475e899`, normally pushed to `docs/gyeon-order-stripe-provider-decision`, and opened as PR #49. The PR remains open and unmerged. No provider, database, migration, Supabase, sandbox, staging, production, or deployment action was performed.

**Next gate:** Correct PR #49 metadata and append the delivery result without rewriting the historical E0/E0-R1 records, then independently re-audit the exact documentation delta. Ready/merge remain separate. Provider-specific diagnosis must later map the smallest forward-only correction from authorization evidence to full-payment/refund evidence and pin the exact Stripe API/Webhook/sandbox contract. No provider connection, source correction, database work, migration application, merge, or deployment is authorized by this documentation gate, and it does not interrupt the currently active Estimate Wizard phase.

### GYEON-ORDER-V3-D16-P2B0 — Book full-payment/refund contract alignment

**Status:** GOVERNANCE DELIVERY AUTHORIZED / BOOK SOURCE IMPLEMENTATION SEPARATELY AUTHORIZED AFTER DEDICATED DRAFT PR INSTRUCTION / SOURCE NOT YET CHANGED.

**Objective:** Replace the Book pure-source card branch that still models authorization, reauthorization, and split-capture blocking with the owner-ratified one-upfront-full-payment contract already accepted by Studio D16-P2A. This is a pure contract and focused-test alignment phase only. It intentionally precedes Stripe runtime, Webhook, database, migration, and deployment work.

**Fixed source authority:** `main` commit `b79296305f60374849e983163109b5ec297379d1`, tree `102146dfe671e8fe33b60983bcbbf6fff7907688`. Dedicated branch: `agent/gyeon-order-d16-p2b0-book-contract-alignment`. Studio reference authority: Foundation PR #73, merged as `55a2df26a3bf7ac023c4844b26f95b22ee56683c`. Book remains canonical for its own runtime contract; Studio artifacts are reference evidence and are never edited by this phase.

**Accepted diagnosis:** The current Book pure source releases card orders from `card_authorized`, accepts a caller-owned `cardAuthorized` condition, contains `card_split_capture_unresolved`, prepares edit reauthorization, and compensates by voiding a new card authorization. Its focused tests pass, but they prove the superseded business contract. Passing stale tests is therefore not acceptance evidence for D16-P2B0.

**Owner contract:** At owner final submit, charge and capture the entire immutable tax-inclusive JPY payable total once, including back-orders. Shipping policy never changes card amount or capture count. JCB uses the same flow. Card warehouse release requires exact server-verified succeeded-payment evidence. Post-payment amount edits are rejected with `post_payment_amount_edit_forbidden`; additions require a separate order. Confirmed cancellation or non-fulfillment uses only an exact server-calculated partial or full refund, with a cumulative cap at the succeeded amount and duplicate-operation rejection. A failure after succeeded payment requires full-refund compensation, not authorization voiding.

**Governance delivery allowlist:**

1. `docs/master_specification/GYEON_DA_COMPLETION_PLAN.md`
2. `docs/master_specification/GYEON_DA_PHASE_RESULTS.md`
3. `docs/master_specification/CLAUDE_DIRECTIVE_GYEON_ORDER_V3_D16_P2B0_BOOK_PAYMENT_CONTRACT_ALIGNMENT.md`

The owner authorized one local governance commit, one normal non-force push, and one new Draft PR containing exactly these three paths. The PR number is recorded in PR metadata and its instruction after creation; it is not guessed in this plan.

**Future exact source allowlist after the governance PR and newest Claude-targeted instruction exist:**

1. `src/lib/product-orders/gyeon-order-v3-contract-core.ts`
2. `src/lib/product-orders/gyeon-order-v3-contract-core.test.ts`
3. `src/lib/product-orders/gyeon-order-v3-external-authority-core.ts`
4. `src/lib/product-orders/gyeon-order-v3-external-authority-core.test.ts`

Claude may edit and test only those four paths, using `CLAUDE_DIRECTIVE_GYEON_ORDER_V3_D16_P2B0_BOOK_PAYMENT_CONTRACT_ALIGNMENT.md`, after verifying the dedicated open Draft PR, exact execution identity, clean index/worktree, and newest non-superseded instruction. The source candidate must not be staged, committed, or pushed by Claude.

**Verification:** Run the exact two focused Node test files once and exact four-path `git diff --check` once. Prove owner-only final submit, full amount including back-orders, one capture under both shipment policies, identical JCB behavior, succeeded-evidence release, fail-closed evidence rejection, unreachable historical split/multicapture/authorization paths, forbidden post-payment amount edits, exact bounded refund behavior, and preservation of non-card gates.

**Boundaries:** No Stripe SDK/API/Webhook or account contact; no DB, SQL, migration, Supabase, package, lockfile, UI, route, environment, secret, Studio-source, shared/staging/production, Ready, merge, or deployment action. Existing stale C5-B/C5-D database artifacts remain blocked and require a later separately authorized forward-only correction and disposable verification. Protected paths remain metadata-only.

**Exit gate:** Deliver the exact three-document governance commit and Draft PR, publish the exact execution identity and four-file instruction on that PR, then rerun Claude once for the bounded source candidate. MacBook Codex must independently audit the four-file result before any source stage, commit, push, provider, database, or release request.

### GYEON-ORDER-V3-D16-P2B1 — Stripe pre-connection read-only diagnosis

**Status:** CLOSED — R1 CORRECTED DIAGNOSIS ACCEPTED / GOVERNANCE RECORD DELIVERED / PR #51 MERGED TO `main` AS `f75242a1e79bb0dc6c18926cf8a004874d4ec278` / NO STRIPE IMPLEMENTATION AUTHORIZED.

**Objective:** Map the smallest safe Book-side forward correction from the stale C5-B/C5-D card-authorization database model to the merged D16-P2B0 one-upfront-full-payment and refund contract before any Stripe SDK, API, Webhook, database, migration, sandbox, or deployment implementation.

**Fixed source authority:** `main` commit `35fa921b786572d5a780dd34d45cdbab9d938260`, tree `baa4017ee17185645ac46fcea72f6fa3da13d7fe`. Dedicated branch: `agent/gyeon-order-d16-p2b1-stripe-read-only-diagnosis`. D16-P2B0 is merged through PR #50 and is the Book pure-contract authority.

**Local preflight findings:** No Stripe SDK dependency, Stripe route, Stripe environment placeholder, immutable Stripe Webhook inbox, durable succeeded-payment record, or refund ledger is present. The formal GYEON V3 migration still encodes `initial_authorization`, `edit_reauthorization`, `payment_status = 'authorized'`, card reauthorization on amount-changing edit, and `void_new_card_authorization` compensation. Direct generic product-order CRUD also exists and must be assessed as a possible bypass. The closed generic finance payment tables are not the GYEON ordering Stripe ledger and remain protected from reuse.

**Governance delivery allowlist — exactly three paths:**

1. `docs/master_specification/GYEON_DA_COMPLETION_PLAN.md`
2. `docs/master_specification/GYEON_DA_PHASE_RESULTS.md`
3. `docs/master_specification/CLAUDE_DIRECTIVE_GYEON_ORDER_V3_D16_P2B1_STRIPE_PRECONNECTION_READ_ONLY_DIAGNOSIS.md`

**Private diagnosis read allowlist:** The directive contains exactly 25 private paths. `.env.example`, package lockfiles, secret-bearing environment files, UI source, unrelated finance source, Studio source, and other migrations are outside the read scope.

**Required diagnosis:** Claude must map every stale authorization/reauthorization/void branch, direct-CRUD bypass, provider adapter boundary, raw-body signature and immutable Webhook inbox boundary, succeeded-payment and append-only refund persistence, exact atomic DB boundaries, RLS/grants, legacy finance separation, smallest forward-only migration, later sandbox cases, and separated literal implementation allowlists. Unknown provider/account/version/live-schema facts remain `NOT_CONFIGURED`.

**Official constraints:** Stripe Webhook verification uses the unmodified raw body and endpoint signing secret. Duplicate and unordered events are normal inputs and must be idempotently persisted and reconciled. Provider POST operations require stable server-owned idempotency identities. Supabase exposed tables require explicit grants plus RLS, and service-role credentials remain server-only.

**Boundaries:** Diagnosis is private-file read-only. No edits, tests, typecheck, build, dependency install, lockfile read, Stripe/Supabase/DB/provider/network contact, environment-secret access, Git mutation, PR mutation, Ready, merge, migration application, sandbox, staging, production, or deployment is permitted to Claude. MacBook Codex may create and deliver only the exact three governance paths and publish the newest instruction on the dedicated Draft PR under the owner's explicit authorization.

**Original diagnosis disposition:** The one-time 25-file read-only Claude diagnosis returned the required P2B1 marker and identified the central stale authorization/reauthorization/void contract, direct generic CRUD bypass, missing Stripe/Webhook persistence, and required provider/DB separation. MacBook Codex rejected its claimed `PASS_DIAGNOSIS_COMPLETE` because it omitted the required 25-file SHA-256 block, omitted `prepare_gyeon_order_v3_edit_rpc` from the proposed forward correction, omitted explicit provider retrieval and Webhook worker files, omitted `package-lock.json`, and did not supply literal later allowlists.

**R1 result correction:** Under the owner's separate approval, Claude received no original private source files. It received only the R1 directive, the prior result transcript, MacBook Codex correction facts, and the MacBook Codex 25-file hash attestations. The tool-disabled, read-only correction returned `GYEON_ORDER_V3_D16_P2B1_R1_STRIPE_PRECONNECTION_DIAGNOSIS_RESULT_V1 / PASS_CORRECTION_COMPLETE`. MacBook Codex independently accepted the correction: all five stale RPCs are in scope; PaymentIntent and Refund create/retrieve operations are explicit; raw-body Webhook acceptance and asynchronous reconciliation are separate; direct-CRUD cutover, forward-only DB work, Stripe adapter/Webhook/dependency work, and disposable sandbox work are four distinct future gates; D16-P2B0 pure source remains accepted and is not reopened.

**R1 governance record allowlist — exactly three paths:**

1. `docs/master_specification/GYEON_DA_COMPLETION_PLAN.md`
2. `docs/master_specification/GYEON_DA_PHASE_RESULTS.md`
3. `docs/master_specification/CLAUDE_DIRECTIVE_GYEON_ORDER_V3_D16_P2B1_R1_DIAGNOSIS_RESULT_CORRECTION.md`

**Delivery and acceptance:** The exact three-path R1 governance record was committed as `241eb33347a4b3af3090f0536c340a1026359c31`, tree `91b64d2ad62d692c39b2a23ffe7f2df65ea03599`, parent `f77f32d8ec908e4da76dd9a7f1406e4026cc1465`, and normally non-force pushed to the existing PR #51 branch. The two-document delivery reconciliation followed as `5cda3753f5af1aa425f9a111d4948647aef2fac2`. Both Vercel checks passed, the owner separately authorized Ready and merge, and PR #51 was merged normally to `main` as `f75242a1e79bb0dc6c18926cf8a004874d4ec278`, tree `82981feb3e26d2bc70db2c11cf708063e56d6ccd`. No manual deployment, application source, database, provider, or Stripe implementation was part of the merge.

**Current exit gate:** The D16-P2B1 diagnosis-governance phase is closed at the merged main identity above. Its result does not authorize application source, DB migration, Stripe adapter, Webhook, dependency, sandbox, provider configuration, environment mutation, or deployment. Book inventory C1 is governed independently by the phase below.

### INV001-P19-BOOK-C1 — Foundation V2 consumer-binding read-only diagnosis

**Status:** READ-ONLY DIAGNOSIS COMPLETE / CODEX SUBSTANTIVE ACCEPTANCE WITH MANDATORY GOVERNANCE CORRECTIONS / PR #53 REMAINS OPEN DRAFT / NO IMPLEMENTATION AUTHORIZED.

**Objective:** Diagnose the smallest safe Book-owned server consumer/adaptor boundary for the accepted Foundation V2 inventory runtime without copying Foundation business rules, treating Book-local dealer inventory as Office AZ authority, implementing Android, or contacting a database/provider/environment.

**Fixed authorities:**

- Book repository: `nisikawa-officeAZ/GYEON`.
- Book fixed `main`: commit `f75242a1e79bb0dc6c18926cf8a004874d4ec278`, tree `82981feb3e26d2bc70db2c11cf708063e56d6ccd`.
- Foundation repository: `nisikawa-officeAZ/detaileros-inventory-foundation`.
- Foundation fixed `main`: commit `c0cc42de8ef1e95482b31a981a7d2d6e2571fa8e`, tree `c2e925295e1e0384010e6744a5c7ec15cb7668a1`.
- Foundation status: `FOUNDATION_HANDOFF_READY_NOT_PRODUCTION_READY`.
- Foundation P20: not required and not authorized by source completion through P19.

**Governing directive:**

- Path: `docs/master_specification/CLAUDE_DIRECTIVE_INV001_P19_BOOK_C1_FOUNDATION_V2_CONSUMER_BINDING_DIAGNOSIS.md`.
- Required result marker: `INV001_P19_BOOK_C1_FOUNDATION_V2_CONSUMER_BINDING_DIAGNOSIS_RESULT_V1`.
- Current local directive SHA-256: `9b74b76ca3e5fea4b88c0a37b2d4c2f4652b8fdc5fb74451e98d541bcc4e9150`.
- Proposed dedicated branch: `agent/inv001-p19-book-c1-foundation-v2-consumer-binding-diagnosis`.
- Exact private read scope: 31 Book paths and 10 Foundation paths, all listed literally in the directive.

**Accepted diagnosis boundary:**

1. Office AZ is the sole inventory owner and Foundation is the canonical inventory contract/runtime authority.
2. Existing Book `dealer_stock_levels`, receiving, movements, stocktaking, and logistics actions are dealer-local or compatibility surfaces until a later authorized cutover proves otherwise.
3. Book must not create a second product master, shadow catalogue, competing Office AZ ledger, fallback-to-local authority, or silent dual write.
4. Foundation hosts no live HTTP service. Runtime delivery into Book is `NOT_CONFIGURED` and must not be guessed as package copy, source copy, submodule, HTTP, or database coupling.
5. The 18 accepted Foundation commands, `INV001-P18_RUNTIME_SNAPSHOT_V3`, separate CSV surfaces, and Mobile golden contracts retain their exact meanings. `confirm_shipment` is not automatically coupled to `ship_fulfillment`.
6. Android transport, authentication, local persistence/offline queue, camera/operator UX, signing, distribution, and M1-M6 remain `NOT_CONFIGURED` and outside C1.

**Required read-only result:** Classify the allowed Book inventory/logistics modules; map authority conflicts and current direct CRUD; prove whether any existing Foundation bridge exists; identify the delivery-mechanism and auth/tenancy gaps; propose the smallest server-only adaptor; preserve fail-closed error/recovery behavior; separate current UI compatibility from later cutover; and return literal non-overlapping allowlists for later pure adaptor, transport/package, authenticated route, compatibility UI, disposable verification, and Android phases. Unknown facts remain `NOT_CONFIGURED`.

**Studio autonomy boundary:** Studio's bounded autonomy is recorded in Foundation Issue #39 comments `5517985580` and `5517994562`. It permits Foundation-only work through a verified Ready PR but never Book/Android edits or merge. Studio must not invent P20. If the accepted Book C1 result exposes a Foundation-owned compatibility defect that does not change the accepted contract meaning, Studio may use that authority; contract or product-authority changes return to the owner and MacBook Codex.

**Delivery and diagnosis:** The three-path C1 governance candidate was committed as `dd2bb58a68ddffbc6c87efe5c1dd4265eb0785ae`, tree `5f71abe6345d2ec6abe86b62089e11d7152d1869`, parent `f75242a1e79bb0dc6c18926cf8a004874d4ec278`, normally non-force pushed, and opened as Book Draft PR #53. The owner then separately authorized exactly 31 Book and 10 Foundation private files for one tool-disabled, read-only Claude invocation. All 41 MacBook Codex preflight hashes matched. Claude returned the required result marker with `PASS_DIAGNOSIS_COMPLETE`; MacBook Codex accepted the substantive diagnosis subject to mandatory corrections in PR #53 comment `5518147879`.

**Accepted result boundary:** No Book-to-Foundation bridge is proven; runtime delivery and product identity remain `NOT_CONFIGURED`; existing Book inventory remains dealer-local/compatibility state; and location-count, reservation, adjustment-taxonomy, stocktake-model, and product-identity conflicts require explicit disposition. C1 authorizes no source implementation, dependency, lockfile, DB/migration, provider, Android, deployment, or production action.

**Exit gate:** C1 diagnosis is closed only with the Codex corrections. PR #53 remains Draft and merge remains an owner gate. The next governance-only phase is C2 below.

### INV001-P19-BOOK-C2 — Foundation runtime delivery and product identity decision

**Status:** READ-ONLY DECISION PACKAGE COMPLETE / OWNER DECISIONS RATIFIED IN PR #54 / PR REMAINS OPEN DRAFT / NO IMPLEMENTATION AUTHORIZED.

**Objective:** Produce an owner-ready decision package for exactly two unresolved C1 boundaries: the mechanism that delivers the sealed Foundation runtime to Book and the identity contract that binds Book catalogue references to Foundation inventory products.

**Governing directive:**

- Path: `docs/master_specification/CLAUDE_DIRECTIVE_INV001_P19_BOOK_C2_FOUNDATION_RUNTIME_DELIVERY_AND_PRODUCT_IDENTITY_DECISION.md`.
- Required result marker: `INV001_P19_BOOK_C2_FOUNDATION_RUNTIME_DELIVERY_AND_PRODUCT_IDENTITY_DECISION_RESULT_V1`.
- Current local directive SHA-256: `595c643697d6735e537d93902abeb262acad120f4345d42c9d0481beb05b2c99`.
- Proposed branch: `agent/inv001-p19-book-c2-runtime-delivery-product-identity-decision`.
- Proposed private read scope: exactly 16 Book files and 4 Foundation files, all listed literally in the directive.

**Decision A candidates:** private immutable package artifact; new live Foundation service; Git dependency/submodule; vendored/copied source; or database-mediated coupling. Claude may compare and recommend but the selected mechanism remains `OWNER_DECISION_REQUIRED`.

**Decision B candidates:** canonical Foundation product ID plus explicit Book mapping; a proven already-shared immutable ID; JAN as canonical identity; or Book `gyeon_products.id` as Foundation identity. Claude may compare and recommend but the selected identity remains `OWNER_DECISION_REQUIRED`.

**Hard boundary:** No implementation, package install/publication, registry, dependency or lockfile change, route/RPC, product remap, table/migration/backfill, dual-write, source copy, Android, provider, deployment, or production work. Any later allowlist must be literal and contain no wildcard.

**Delivery and result:** The exact three-path C2 governance candidate was committed as `81e03a381b29ce8357182317bb5890d0a76055ee`, tree `8ace929836ac3847bb2566dbf41f2f2cbb7d8b69`, parent `dd2bb58a68ddffbc6c87efe5c1dd4265eb0785ae`, normally non-force pushed, and opened as Draft PR #54. After separate authorization, one tool-disabled read-only Claude invocation received exactly 16 Book and 4 Foundation files. Claude returned `PASS_DECISION_PACKAGE_READY`. MacBook Codex accepted the substantive result, corrected two abbreviated manifest paths, and recorded the Owner decisions in PR #54 comment `5518304280`.

**Ratified decisions:** Use a private immutable GitHub Packages artifact; execute the Foundation runtime server-side only; persist through new Foundation-specific tables in the existing DealerOS Supabase environment; keep Foundation's immutable product ID canonical and bind it one-to-one to the Book catalogue ID; and supersede the existing Book pure Office AZ inventory cores only after verified cutover. No implementation is authorized by these decisions.

**Exit gate:** C2 is closed as a decision package. PR #54 remains Draft and Ready/merge remain separate Owner gates. The documentation-only C3 ratification candidate follows.

### INV001-P19-BOOK-C3 — Owner decision ratification

**Status:** CLOSED / PR #55 MERGED NORMALLY TO `main` / NO IMPLEMENTATION AUTHORIZED BY C3.

**Objective:** Convert the accepted C2 Owner decisions into Book governance and publish literal, non-overlapping proposed allowlists for later Book phases without starting implementation.

**Governing directive:**

- Path: `docs/master_specification/CLAUDE_DIRECTIVE_INV001_P19_BOOK_C3_OWNER_DECISION_RATIFICATION.md`.
- Result marker: `INV001_P19_BOOK_C3_OWNER_DECISION_RATIFICATION_RESULT_V1`.
- Current local directive SHA-256: `fdc1253d7ac60cdfe3713f6b6fe8e49aef0d127af890018effacbaa6a6603f22`.
- Proposed branch: `agent/inv001-p19-book-c3-owner-decision-ratification`.
- C3 exact change scope: the new directive, this completion plan, and the phase-results ledger only.

**Ratified architecture:**

1. Foundation runtime delivery: private immutable GitHub Packages artifact, proposed package identity `@nisikawa-officeaz/detaileros-inventory-foundation`, exact version/commit/tree/integrity pin.
2. Execution: Book server-only boundary; no browser/client/Android direct runtime import.
3. Persistence: new Foundation-specific tables in the existing DealerOS Supabase environment; existing local inventory tables remain non-authoritative.
4. Product identity: Foundation immutable product ID is canonical; Book owns a one-to-one integration mapping to `gyeon_products.id`; JAN/SKU are evidence only.
5. Legacy cores: non-authoritative until verified cutover, then separately retired or reduced.

**Future phase separation:** D1 pure adaptor; D2 package consumer; D3A persistence; D3B product mapping; D4 authenticated server boundary; D5 compatibility UI; D6 disposable/authenticated verification; D7 legacy retirement. Android remains a separate unresolved project gate. Every proposed Book path is literal and non-overlapping in the C3 directive.

**Delivery and closure:** The exact three-path C3 candidate was committed as `ecab1afd58e1df4c0e2b022f3b7268cebd772dfb`, tree `e341a26719354cbdc193d6414e0175771b67d05f`, normally pushed, and opened as PR #55. MacBook Codex independently verified the literal three-path delta and passing checks. After separate Owner approvals, PR #55 was marked Ready and merged normally to `main` as `8516506fe700348b4e8436fbc6d53ce44747ca2e`, tree `e341a26719354cbdc193d6414e0175771b67d05f`.

**Exit gate:** C3 is closed. Its merge authorizes no implementation, package, DB, UI, Android, staging, or production action. D1 begins only through the separate governance candidate below.

### INV001-P19-BOOK-D1 — Pure adaptor contract

**Status:** CLOSED / PR #56 MERGED NORMALLY TO `main` / D1 PURE CONTRACT ACCEPTED / NO D2, PACKAGE, DB, ROUTE, UI, ANDROID, STAGING, OR PRODUCTION AUTHORIZED BY D1.

**Objective:** Define and then, through separately approved gates, implement the smallest pure TypeScript Book adaptor contract that forwards the sealed Foundation V2 commands and snapshot boundary without copying Foundation rules or contacting a package, database, route, provider, UI, Android, or deployment environment.

**Original fixed authority:** Book `main` commit `8516506fe700348b4e8436fbc6d53ce44747ca2e`, tree `e341a26719354cbdc193d6414e0175771b67d05f`; Foundation commit `c0cc42de8ef1e95482b31a981a7d2d6e2571fa8e`, tree `c2e925295e1e0384010e6744a5c7ec15cb7668a1`.

**Governing directive:** `docs/master_specification/CLAUDE_DIRECTIVE_INV001_P19_BOOK_D1_PURE_ADAPTOR_CONTRACT.md`. Proposed branch: `agent/inv001-p19-book-d1-pure-adaptor-contract`.

**Gate separation:** Gate A is one separately authorized tool-disabled read-only diagnosis over exactly 13 Book and 4 Foundation files. Gate B may start only after Codex accepts Gate A and the Owner separately authorizes editing and focused verification. Gate B is restricted to three new paths:

1. `src/lib/inventory/foundation/foundation-adaptor-types.ts`
2. `src/lib/inventory/foundation/foundation-adaptor-core.ts`
3. `src/lib/inventory/foundation/foundation-adaptor-core.test.ts`

**Required boundary:** Preserve all 18 Foundation command names and `INV001-P18_RUNTIME_SNAPSHOT_V3`; keep actor/operator and canonical identities explicit; inject a pure runtime port; forward once with no retry or automatic command chaining; return typed fail-closed results; and import neither package, persistence, legacy Book core, route, UI, nor Foundation source.

**Delivery and closure:** The governance candidate was delivered through PR #56. After separately authorized Gate A and Gate A-R1 diagnosis, MacBook Codex accepted the corrected five-surface contract. Gate B created exactly the three allowed files. An independent review rejected the first candidate because it discarded `bookContext`, threw raw `TypeError` for malformed runtime callers, and shortened the accepted recovery export name. Claude corrected those defects within the same three-file scope. Final verification passed 71/71 focused tests, `npx tsc --noEmit`, malformed-input runtime probes, and diff checks. Source commit `cb4c5e92d480cb1211d8614efaa13d8c9e2e03b8` was normally pushed. PR #56 passed both checks, was separately marked Ready, and was normally merged to `main` as `79632bd0f6af769a9145e6f1c1de2b4558b23189`, tree `4e81f89e6bbe2b7f4e7fe839c80c20ae6deb5bb8`.

**Exit gate:** D1 is closed. It supplies a pure injected boundary only and does not prove that a consumable Foundation package exists. D2 begins only through the separately governed package-readiness phase below.

### INV001-P19-BOOK-D2 — Private package consumer

**Status:** LOCAL GOVERNANCE CANDIDATE / UNSTAGED / UNCOMMITTED / CURRENTLY BLOCKED BY MISSING IMMUTABLE PUBLISHED FOUNDATION PACKAGE EVIDENCE.

**Objective:** Bind D1's accepted Book-owned pure adaptor to one exact private immutable Foundation GitHub Packages artifact, server-side only, without copying Foundation source, duplicating rules, guessing persistence, or exposing package access to browser, UI, or Android code.

**Fixed authority:** Book `main` commit `79632bd0f6af769a9145e6f1c1de2b4558b23189`, tree `4e81f89e6bbe2b7f4e7fe839c80c20ae6deb5bb8`; current Foundation commit `c0cc42de8ef1e95482b31a981a7d2d6e2571fa8e`, tree `c2e925295e1e0384010e6744a5c7ec15cb7668a1`.

**Governing directive:** `docs/master_specification/CLAUDE_DIRECTIVE_INV001_P19_BOOK_D2_PRIVATE_PACKAGE_CONSUMER.md`. Current local SHA-256: `d13dcb64f9780bc5ed361b9a040d2be7b419726956a218ae05d5ceb7bfc88f84`. Proposed branch: `agent/inv001-p19-book-d2-private-package-consumer`.

**Current blocker:** The fixed Foundation `package.json` is named `detaileros-inventory-foundation`, is version `0.1.0`, has `private: true`, and declares no `main`, `exports`, `types`, `files`, or build/publish script. No accepted P19 evidence proves a published tarball, immutable integrity, declarations, scoped package identity, or commit/tree binding. Book must not install or wrap a guessed artifact.

**Required Foundation prerequisite:** A separate Foundation-owned publication phase must prove the private scoped package identity `@nisikawa-officeaz/detaileros-inventory-foundation`, exact version, source commit/tree, tarball integrity, provenance/SBOM, file/declaration/export catalogue, consumer compatibility, credential-safe installation, and rollback. Book does not publish or repair Foundation in D2.

**Gate separation:**

1. Gate A: separately authorized tool-disabled read-only compatibility diagnosis after publication evidence exists.
2. Gate B1: separately authorized `.npmrc` registry declaration plus exact `package.json` and `package-lock.json` pin; registry access is an external gate and no token may be committed or printed.
3. Gate B2: separately authorized server-only package wrapper and focused test.
4. Stage/commit, push/Draft PR, independent acceptance, Ready, merge, D3A persistence, D3B mapping, route, UI, disposable runtime, Android, staging, and production remain separate gates.

**D2 exact implementation allowlist:**

- Gate B1: `.npmrc`, `package.json`, `package-lock.json`.
- Gate B2: `src/lib/inventory/foundation/foundation-runtime-package.ts`, `src/lib/inventory/foundation/foundation-runtime-package.test.ts`.
- The three merged D1 files are read-only throughout D2.

**Current authorization:** Create and verify exactly the D2 directive plus this completion-plan update and the phase-results ledger entry. No private-source transmission, Claude invocation, Foundation edit/publication, package/registry access, install, source implementation, executable test, stage, commit, push, PR mutation, DB, provider, UI, Android, deployment, staging, or production action is included.

**Exit gate:** Verify the exact three-path governance candidate, directive hash, current package blocker, literal read/change scopes, and protected metadata; then request a separate Owner gate for stage and local commit. Gate A remains blocked until Foundation publication evidence is independently accepted.

### INV001-P19-BOOK-D2-Q1R1 — Foundation landing acceptance and package-publication hold

**Status:** LOCAL GOVERNANCE CANDIDATE / UNSTAGED / UNCOMMITTED / FOUNDATION Q1R1 LANDING ACCEPTED / D2 REMAINS BLOCKED BY UNPROVEN IMMUTABLE PACKAGE PUBLICATION.

**Objective:** Bind the independently accepted Foundation PR #79 landing to Book governance without falsely treating a documentation/hash correction as a published package or beginning D2 package work.

**Fixed authorities:** Book `main` commit `e69917e97df695b1ede9487969afb73381c22bd4`, tree `153bccf1babc279d323c38060c1678e645a7e5c9`; Foundation `main` commit `a5764f7821b02769ef2d4fba40d432abdc76fa56`, tree `958d3517cec45432131d41b4962d0676cd56aced`; reviewed Foundation source `9982d70aa358ebe2c1900d183a42eab7c8a0d65f`.

**Accepted landing:** Foundation PR #79 merged normally and preserved the P18 base separately from the PR #78 P19 landing identity. The exact seven-path delta, artifact hashes, combined hash, 26 focused assertions, 1,030 whole-suite tests, typecheck, CI, and diff check passed independent MacBook Codex review. Acceptance evidence is Foundation Issue #39 comment `5521647803`.

**Blocking finding:** The accepted Foundation `package.json` remains `detaileros-inventory-foundation@0.1.0`, `private: true`, with no `main`, `exports`, `types`, `files`, build, or publish declaration. Current GitHub credentials lack `read:packages`; HTTP 403 is classified as `NOT_VERIFIED_CREDENTIAL_SCOPE`, not proof of package absence. No immutable scoped artifact, integrity, catalogue, provenance, or consumer-install evidence is accepted.

**Governing directive:** `docs/master_specification/CLAUDE_DIRECTIVE_INV001_P19_BOOK_D2_Q1R1_FOUNDATION_LANDING_ACCEPTANCE_AND_PACKAGE_PUBLICATION_HOLD.md`. Current local SHA-256: `333e013e99a6f72ffabf348a3766b7d0f3e6aadb01f29d0bec8e3aa8335048b5`. Proposed branch: `agent/inv001-p19-book-d2-q1r1-foundation-landing-hold`.

**Decision:** Keep D2 Gate A, B1, and B2 blocked. Book must not install, copy, vendor, emulate, wrap, or publish Foundation. The next unblocker is a separately Owner-authorized Foundation-owned immutable private package publication phase that proves exact scoped identity, semantic version, source binding, exports/types/files, clean build, tarball integrity/catalogue, provenance/SBOM, private visibility, credential-safe install, rollback, and forbidden-file exclusion.

**Current boundary:** Exactly the new directive, this completion-plan entry, and one append-only phase-results entry. No private-source transmission, Claude invocation, package/registry action, credential request, dependency/lockfile/source/test edit, executable test, stage, commit, push, PR mutation, Ready, merge, DB, Supabase, migration, Auth, provider, Android, deployment, staging, or production action is authorized.

**Exit gate:** Independently verify the exact three-document diff, directive hash, Foundation landing identity, package blocker, registry-evidence classification, D2 hold, Foundation ownership, protected metadata, and `git diff --check`; then request a separate Owner gate for stage and local commit.

### INV001-P19-BOOK-D3A — Foundation persistence governance preparation

**Status:** LOCAL GOVERNANCE CANDIDATE / UNSTAGED / UNCOMMITTED / IMPLEMENTATION BLOCKED UNTIL D2 FULL CLOSURE.

**Objective:** Predefine the Book-side durable persistence, least-privilege RLS/grant, transaction, idempotency, optimistic-concurrency, append-only audit, snapshot, recovery, and disposable-verification gates required by the sealed Foundation V2 runtime without creating or applying a migration.

**Fixed Book authority:** `main` commit `2e1df23f1aa64b7c9ca2a608f36f2dccd107cf7b`, tree `1116b7e768a1a1ca1cfd5bff99263f235cf6bcb8`. D2 governance is merged through PR #57, but D2 package publication, dependency pin, and runtime wrapper remain incomplete.

**Governing directive:** `docs/master_specification/CLAUDE_DIRECTIVE_INV001_P19_BOOK_D3A_FOUNDATION_PERSISTENCE.md`. Proposed branch: `agent/inv001-p19-book-d3a-persistence-governance`.

**Current boundary:** Governance preparation only. No private-source transmission, Claude invocation, package/registry access, migration creation, database connection, implementation, executable test, stage, commit, push, PR mutation, provider, Android, deployment, staging, or production action is authorized.

**Gate separation:**

1. Gate A: after D2 closure, separately authorized tool-disabled read-only persistence diagnosis.
2. Gate B0: separately authorized local Supabase CLI migration-path creation and literal allowlist reconciliation; the historical C3 filename remains a proposal, not a hand-created migration.
3. Gate B1: separately authorized four-path uncommitted migration/adaptor/test/harness candidate.
4. Gate C: separately authorized fresh disposable PostgreSQL/Supabase verification with genuine request claims and separate-connection concurrency.
5. Stage/commit, push/Draft PR, independent review, Ready, merge, and any shared/staging/production apply remain separate gates.

**Proposed implementation scope:** one CLI-created Foundation migration, `foundation-persistence-adaptor.ts`, its focused test, and `inv001-foundation-persistence-disposable.mjs`. Exact migration path must be reconciled before implementation. Existing migrations and local inventory cores stay unchanged.

**Security posture:** Office AZ is the only currently authorized live inventory owner; SQL is persistence, not business-rule authority; exposed tables require RLS; authentication alone is not authorization; browser raw writes, service-role exposure, user-metadata authorization, public privileged functions, dual-write, retries, rule duplication, and production in-memory fallback are prohibited.

**Exit gate:** Verify the exact three-path governance-only diff and directive hash, then request a separate Owner gate for stage/local commit. D3A Gate A remains blocked until D2 is fully closed and its merged package wrapper identity is fixed.

### INV001-P19-BOOK-D3B — Product identity mapping governance preparation

**Status:** LOCAL GOVERNANCE CANDIDATE / UNSTAGED / UNCOMMITTED / IMPLEMENTATION BLOCKED UNTIL D2 AND D3A FULL CLOSURE.

**Objective:** Predefine the one-to-one mapping between Foundation immutable product identity and `gyeon_products.id` without creating another product master, modifying `gyeon_products`, or treating JAN/SKU/name matching as authority.

**Fixed Book authority:** `main` commit `00f2df7dc5574d0a06a219cb51b4629f1f337f9b`, tree `b770a987a5573beb4249bfef68dea2926e751f82`. D3A governance is merged through PR #58, but D2 package consumption and D3A persistence implementation remain incomplete.

**Governing directive:** `docs/master_specification/CLAUDE_DIRECTIVE_INV001_P19_BOOK_D3B_PRODUCT_IDENTITY_MAPPING.md`. Proposed branch: `agent/inv001-p19-book-d3b-product-mapping-governance`.

**Ratified behavior:** Foundation product ID is canonical for Foundation inventory; `gyeon_products.id` remains the Book catalogue reference; a Book-owned one-to-one mapping relates them. JAN, SKU, and names are review evidence only. Missing, duplicate, ambiguous, stale, retired, changed-evidence, inactive, malformed, and cross-owner mappings fail closed. Missing accepted mapping returns `NOT_CONFIGURED` and authorizes no inventory or EC quantity action.

**Gate separation:** D2 and D3A closure; Gate A read-only diagnosis; Gate B0 Supabase CLI migration-path generation; Gate B1 four-path uncommitted candidate; Gate C fresh disposable RLS/uniqueness/race verification; separately authorized delivery and environment gates.

**Proposed implementation scope:** one CLI-created mapping migration, `foundation-product-mapping.ts`, its focused test, and `inv001-foundation-product-mapping-disposable.mjs`. The historical C3 filename is a reservation only until the CLI-generated exact path is reconciled.

**Current boundary:** Governance preparation only. No private-source transmission, Claude invocation, migration/DB/package access, implementation, executable test, stage, commit, push, PR mutation, Ready, merge, Android, provider, staging, or production action is authorized.

**Exit gate:** Verify the three-path governance-only diff, directive hash, dependency blockers, one-to-one/fail-closed contract, migration gate, and protected metadata; then request a separate Owner stage/local-commit gate.

### INV001-P19-BOOK-D4 — Authenticated server boundary governance preparation

**Status:** LOCAL GOVERNANCE CANDIDATE / UNSTAGED / UNCOMMITTED / IMPLEMENTATION BLOCKED UNTIL D2, D3A, AND D3B FULL CLOSURE AND OFFICE AZ OPERATOR AUTHORITY RESOLUTION.

**Objective:** Predefine the only authenticated Book server command/query boundary allowed to call the accepted Foundation runtime, persistence, and product-mapping layers. Every request must bind verified identity, actor, operator, Office AZ owner, dealer/tenant, capability, location, product mapping, request/idempotency/version identities, and server-owned authorization evidence.

**Fixed Book authority:** `main` commit `f27ff9b85bb5dd1e821ba21da7b41d2bea9e0f71`, tree `8c37779327c803ac710bdc06d8e37b9fd27f7107`. D3B governance is merged through PR #59. D2 package consumption, D3A persistence, D3B mapping, and the Office AZ inventory-operator authority source remain incomplete.

**Governing directive:** `docs/master_specification/CLAUDE_DIRECTIVE_INV001_P19_BOOK_D4_AUTHENTICATED_SERVER_BOUNDARY.md`. Proposed branch: `agent/inv001-p19-book-d4-authenticated-server-boundary-governance`.

**Current blockers:** Existing `getCurrentDealer()` may choose an arbitrary tenant when multiple active memberships exist. Existing dealer roles and `requireStaffCapability()` do not prove Office AZ inventory-operator authority. `getEstimateSaveActorContext()` is a reusable coherent-context pattern only, not inventory capability authority. Missing operator/capability/location authority remains `NOT_CONFIGURED` and denies every affected command.

**Ratified security boundary:** Login, `authenticated`, UI visibility, client role/dealer/operator fields, or dealer `owner`/`manager`/`staff` alone never authorize Office AZ inventory. Both Server Actions and Route Handlers are public entry points and must independently authenticate, authorize, validate, bind server-owned context, return sanitized no-store DTOs, and fail before any downstream call. No route/action may import an admin/service-role client or become a generic Foundation proxy.

**Gate separation:** D2/D3A/D3B closure and operator-authority resolution; Gate A tool-disabled read-only diagnosis; Gate B exact four-path uncommitted source/test candidate; Gate C independent source acceptance and separately authorized delivery; D6 later real SSR-cookie/request-scope/RLS/CSRF/disposable verification.

**Proposed implementation scope:** `foundation-server-actions.ts`, its focused test, the Foundation inventory Route Handler, and its focused test. Gate A must return a literal scope correction rather than inventing extra files if a separate pure authority core, DTO, audit, or rate-limit boundary is required.

**Current boundary:** Governance preparation only. No private-source transmission, Claude invocation, package/registry action, migration/DB/Supabase connection, auth session, browser, implementation, executable test, stage, commit, push, PR mutation, Ready, merge, Android, provider, staging, or production action is authorized.

**Exit gate:** Verify the exact three-path governance-only diff, directive hash, dependency and operator-authority blockers, request/auth/HTTP fail-closed contracts, D6 separation, and protected metadata; then request a separate Owner stage/local-commit gate.

### INV001-P19-BOOK-D4A — Office AZ inventory-operator authority governance

**Status:** GOVERNANCE MERGED THROUGH PR #61 / OWNER AUTHORITY POLICY RATIFIED / D4A-R1 FORMAL-SPEC CORRECTION MERGED THROUGH PR #62 AS `f85a35266dfdea6e1986982bfea0e451186fbd13` / AUTHORITY IMPLEMENTATION BLOCKED.

**Objective:** Resolve the Office AZ human/service operator, capability, location, suspension/revocation, and high-risk approval model that D4 requires, without reusing dealer roles, UI state, `authenticated`, user metadata, admin-client access, or service-role possession as authorization.

**Fixed Book authority:** D4A governance is merged through PR #61 at commit `6fc4fe5bfcd681f04945c7ae7844dac61273cd3d`, tree `b948ea068b171bbd8d52117b6313c7682f403457`. D4 governance is merged through PR #60. D2 package publication/consumer, D3A persistence, and D3B mapping implementations remain incomplete.

**Governing directive:** `docs/master_specification/CLAUDE_DIRECTIVE_INV001_P19_BOOK_D4A_OFFICE_AZ_OPERATOR_AUTHORITY.md`. Proposed branch: `agent/inv001-p19-book-d4a-office-az-operator-authority-governance`.

**Ratified boundary:** `OFFICE_AZ` is the only current live owner; three locations are location scopes under one Office AZ total; dealer roles never grant Office AZ inventory authority; actor and operator remain distinct; unresolved authority denies before every Foundation call.

**Formal reconciliation:** On 2026-09-03 the Owner approved warehouse operator, warehouse manager, and super admin inbound confirmation within their location scopes and ratified the closed 18-command/five-surface matrix. The V3 formal-decision role table and authority section are corrected by D4A-R1. This closes the policy contradiction but does not create a live grant.

**Ratified model:** Separate normalized warehouse-operator, warehouse-manager, inventory-super-admin, and narrow service identities; explicit closed capabilities; explicit location grants; active-only status; validity and authority version; no self-grant; append-only assignment/revocation/denial audit. Super admin covers exactly the three current locations and the closed matrix. Future locations are never automatic. 小尾野氏 is designated as warehouse operator at the policy level only.

**Gate separation:** D4A-R1 exact four-document formal-spec correction; separate stage/local-commit delivery gates; D2/D3A/D3B closure; a fresh exact-scope tool-disabled Gate A diagnosis against the ratified policy; separately approved pure authority/resolver/schema/RLS implementation; independent source acceptance; D6 real SSR-cookie/RLS/revocation/concurrency verification.

**Current boundary:** Exact four governance/specification documents only. No private-source transmission, Claude invocation, role grant, auth session, DB/Supabase, migration, package, implementation, executable test, stage, commit, push, PR mutation, Ready, merge, Android, provider, staging, deployment, or production action is authorized.

**Exit gate:** Verify the exact four-document governance/specification diff, directive hash, formal-role reconciliation, all 18 commands and five surfaces, future-location denial, named initial operator role, implementation-deny boundary, D4/D6 separation, and protected metadata; then request a separate Owner stage/local-commit gate.

### INV001-P19-BOOK-D4A-R1 — Owner authority decision and formal-spec reconciliation

**Decision marker:** `INV001_P19_BOOK_D4A_OFFICE_AZ_OPERATOR_AUTHORITY_OWNER_DECISION_V1`.

**Owner-ratified policy:** Warehouse operator may read assigned-location inventory, confirm inbound, pick, pack, ship, dispatch/receive transfers, and enter stocktake quantities. Warehouse manager adds returns/restock, reasoned adjustment, transfer request, stocktake open/complete, and scoped audit read. Super admin adds the same functions across the three current locations, all-location audit, operator management, snapshot export, and guarded snapshot import/recovery. Reservation and orchestration commands remain service-identity only. Dealer roles receive no Office AZ inventory authority.

**Safety boundary:** Snapshot import/recovery requires re-authentication, reason, pre-backup, explicit confirmation, and append-only audit. Future locations require a new Owner decision and explicit server-side activation. Unknown capabilities, ambiguous assignments, inactive/suspended/revoked operators, stale authority, and missing location grants deny before any Foundation call.

**Implementation status:** `NOT_CONFIGURED`. Policy approval and the initial warehouse-operator designation for 小尾野氏 do not create an account, Auth claim, database row, RLS policy, GRANT, migration, or live permission.

**Delivery:** D4A-R1 was committed as `3dd0bef132eff4995b0b6621fbbc0df28f17d888`, independently verified as an exact four-document change with passing checks and unchanged protected metadata, then normally merged through PR #62 as `f85a35266dfdea6e1986982bfea0e451186fbd13`, tree `a6c9537a242124cf6d48d81488cda217ffa592dc`.

### INV001-P19-BOOK-D5A — Compatibility/cutover UI governance

**Status:** GOVERNANCE MERGED THROUGH PR #63 / GATE A DIAGNOSIS ACCEPTED WITH D5A-R2 CORRECTION / ROUTE AUDIENCE OWNER-RATIFIED / D5 IMPLEMENTATION BLOCKED UNTIL D2-D4 AND D4A AUTHORITY IMPLEMENTATION ARE ACCEPTED.

**Objective:** Define the fail-closed UI cutover from legacy Book dealer-stock surfaces to Foundation-derived Office AZ state without relabeling dealer-local rows, exposing the private Foundation package to browser code, duplicating calculations, falling back to old tables, or dual-writing.

**Original governance authority:** `main` commit `f85a35266dfdea6e1986982bfea0e451186fbd13`, tree `a6c9537a242124cf6d48d81488cda217ffa592dc`. The D5A governance source was merged through PR #63 as `e69917e97df695b1ede9487969afb73381c22bd4`. The current route-decision authority is Book `main` commit `3d7ff378ba189c1e45e273bc9e023d95ca75ffd5`, tree `6ad7815cc73c4c8a63c9e6b51706eac492dc4c56`. D1 is closed. D2 remains blocked by unproven immutable package-consumer evidence; registry state is `NOT_VERIFIED_CREDENTIAL_SCOPE`, not proof of package absence. D3A, D3B, D4, and the D4A live authority implementation remain incomplete.

**Governing directive:** `docs/master_specification/CLAUDE_DIRECTIVE_INV001_P19_BOOK_D5A_COMPATIBILITY_CUTOVER_UI.md`. Proposed branch: `agent/inv001-p19-book-d5a-compatibility-ui-governance`.

**Current conflict:** `src/app/inventory/InventoryClient.tsx` reads and mutates dealer-local inventory through `inventory-actions.ts` and `receiving-actions.ts`. `src/app/admin/logistics/inventory/LogisticsInventoryClient.tsx` receives rows calculated from dealer stock and order tables through an admin-client loader. Neither surface is the accepted Office AZ owner/location/status model, and neither may be relabeled as Foundation inventory.

**C3 scope warning:** C3 reserved only the two Client Components and one new focused test for D5. Their Server Component loaders and legacy DTO/action dependencies are outside that list. Gate A must prove the three paths sufficient or return the minimum literal scope correction. No implementation may hide the mismatch in client props or a generic endpoint.

**Required boundary:** Explicit `NOT_CONFIGURED`, `FORBIDDEN`, `LOADING`, `READY`, `STALE`, `ERROR`, `COMMAND_PENDING`, `COMMAND_ACCEPTED`, and `COMMAND_REJECTED` states; proven zero distinct from unknown; sanitized D4 DTOs only; exact capability/location control; no optimistic authoritative quantity; no automatic retry; no package/persistence/admin client in browser code; no legacy fallback or dual write.

**Route decision:** The Owner has ratified that `/inventory` remains the dealer-local inventory surface and stays outside the Office AZ Foundation D5 cutover. `/admin/logistics/inventory` is the sole current Book UI candidate for the future Office AZ Foundation view, but it must use D4/D4A authority rather than broad admin-client access. The two routes may not share Foundation quantities, authority, DTOs, commands, fallback, or reconciliation truth.

**Accepted diagnosis:** One owner-authorized tool-disabled read-only pass and its bounded corrections produced `INV001_P19_BOOK_D5A_COMPATIBILITY_CUTOVER_UI_DIAGNOSIS_RESULT_V1`. MacBook Codex accepted R1 together with `D5A-R2_CORRECTION_ADDENDUM`: all 24 approved hashes and the fixed main identity matched; the primary verdict is `BLOCKED_D1_D4_PRECONDITION`; the C3 three-path reservation is insufficient; D4 failures, actor/operator separation, product-mapping denial, server-returned command state, and exact proposed tests are corrected. No implementation or repository/environment mutation occurred.

**Current boundary:** The D5A-R1 route-decision candidate changes exactly the new decision directive, this completion plan, and the phase-results ledger. No UI/route/action/DTO/test edit, package, Auth, DB, Supabase, migration, implementation, executable test, stage, commit, push, PR mutation, Ready, merge, Android, provider, staging, deployment, or production action is authorized.

**Exit gate:** Verify the exact D5A-R1 three-document diff, directive hash, route separation, C3 reservation correction, D2-D4/D4A dependency wall, no-fallback/no-dual-write contract, protected metadata, and `git diff --check`; then request a separate Owner stage/local-commit gate.

### INV001-P19-BOOK-D5A-R1 — Route audience decision

**Decision marker:** `INV001_P19_BOOK_D5A_R1_ROUTE_AUDIENCE_DECISION_V1`.

**Owner-ratified separation:** `/inventory` remains dealer-local and outside Foundation D5. It may not display or mutate Office AZ Foundation state, contribute to the Office AZ total, or act as fallback/reconciliation authority. `/admin/logistics/inventory` is the sole current Book UI candidate for the future Office AZ Foundation view and must later consume only sanitized D4/D4A server-owned DTOs.

**Scope consequence:** `src/app/inventory/InventoryClient.tsx` is removed from the Office AZ D5 planning set. The future logistics cutover must re-evaluate the minimum literal scope after D4 closure, including its Server Component loader, client view, D4 DTO-consumption boundary, focused UI contract test, and exact loader test. These are proposals only; no implementation path is authorized.

**Current candidate:** Branch `agent/inv001-p19-book-d5a-r1-route-audience-decision`, fixed base `3d7ff378ba189c1e45e273bc9e023d95ca75ffd5` / `6ad7815cc73c4c8a63c9e6b51706eac492dc4c56`, exact three-document local governance allowlist, unstaged and uncommitted. Stage, commit, push, PR mutation, implementation, tests, package/registry, DB, provider, and deployment remain separate gates.

### GDA-UI-S8A — Estimate/pricing settings top-navigation correction

**Objective:** Correct the owner-rejected estimate/pricing settings navigation before deeper settings-page redesign. The `見積・価格 / ESTIMATES & PRICING` group must expose exactly four real cards in the approved order, remove misleading state badges from those four navigation cards, and replace unrelated generic imagery with dedicated semantic line icons while preserving the accepted TOP visual language and existing business behavior.

**Exact four-card order:**

1. `見積ウィザード設定 / ESTIMATE WIZARD`
2. `コーティング設定 / COATING`
3. `PPF / PAINT PROTECTION FILM`
4. `ウインドフィルム / WINDOW FILM`

**Implementation allowlist:**

- `src/components/settings/SettingsCenterHub.tsx`
- `src/lib/navigation/gda-category-shell.test.ts`

**Required behavior:**

- Preserve the existing Estimate Wizard route and existing settings-panel reachability; create no new route or data flow in S8A.
- Render no state badge or placeholder badge container on the four estimate/pricing cards. Preserve the state contract and badges for other settings groups.
- Use dedicated inline SVG line icons: connected workflow steps for Estimate Wizard, layered vehicle-surface protection for coating, applied/peeled transparent film for PPF, and a layered automotive side window for window film.
- Do not invent internal settings categories. Estimate Wizard and PPF child-page information architecture remains a later separately authorized phase based on real implemented settings.

**Verification:** focused `gda-category-shell` source-contract test, `npx tsc --noEmit`, and `git diff --check`, each once. Full test suite and build are not required for this visual/navigation slice.

**Boundaries:** no DB, Supabase, Auth, Storage, LINE, migration, dependency, config, permission, pricing, or business-logic change. Commit, push, Ready, merge, and deployment remain separate gates. Protected paths in §3.1 remain metadata-only.

**Acceptance target:** E2 local candidate after independent MacBook Codex review. S8A does not authorize production delivery or the later Estimate Wizard/PPF child-page redesign.

### GDA-UI-S8B — Approved R2 estimate/pricing settings visual binding

**Objective:** Bind the owner-approved GenSpark R2 package to the delivered S8A settings navigation without changing pricing, permissions, data, routes, or Estimate Wizard behavior. S8B supersedes only S8A's four-card badge-visibility rule and adds the four real Estimate Wizard access cards; every other S8A boundary remains in force.

**Approved design authority:**

- Delivery: `gda_pricing_settings_ui_approved_v1.zip`
- Delivery SHA-256: `37696d8eb9900803886e7f93587b86b72b9637ff71dd289769407cb2f23a106d`
- Canonical package sources, in precedence order: `README.md`, the final R2 correction in `BEFORE_AFTER_MAPPING.md`, `settings-pricing-top.html`, `settings-estimate-wizard.html`, `previews/mock_top_desktop.png`, `previews/mock_wizard_desktop.png`, and the eight SVG files actually present under `icons/`.
- Stale package content is explicitly non-authoritative: the old six-child-card text and previews, missing twelve-icon manifest entries, and the invented cards `表示順設定`, `必須入力項目`, `見積レビュー確認`, and `非表示メニュー管理`.

**Exact parent cards and approved visual states:**

1. `見積ウィザード設定 / ESTIMATE WIZARD` — `有効`, solid GYEON-blue gradient badge.
2. `コーティング設定 / COATING` — `有効`, solid GYEON-blue gradient badge.
3. `PPF設定 / PPF SETTINGS` — `未設定`, gray badge.
4. `ウインドフィルム設定 / WINDOW FILM SETTINGS` — `未設定`, gray badge.

**Exact Estimate Wizard access cards:**

1. `施工メニュー提供設定 / SERVICE AVAILABILITY` — `有効`.
2. `サービスメニュー / SERVICE MENUS` — `未設定`.
3. `その他作業プリセット / WORK PRESETS` — `未設定`.
4. `店舗オプション / SHOP OPTIONS` — `未設定`.

**Implementation allowlist:**

- `src/components/settings/SettingsCenterHub.tsx`
- `src/app/settings/estimate-wizard/page.tsx`
- `src/app/settings/estimate-wizard/EstimateWizardSettingsClient.tsx`
- `src/lib/navigation/gda-category-shell.test.ts`
- `src/lib/navigation/gda-pricing-settings-ui.test.ts` (add only if focused source-contract coverage cannot remain clear in the existing test)

**Required behavior:**

- Preserve the existing page shell, fixed sidebar, header, responsive breakpoints, TOP v18 tokens, and all current route/anchor reachability.
- The four Estimate Wizard child cards are a visual access layer for the four real existing settings categories. They must navigate or scroll to the existing functional sections; they must not replace, delete, rename, or reimplement those forms.
- Keep the currently implemented functional content below the access cards. Coupon relocation, PPF child-page construction, coating internals, and window-film internals are separate later business/navigation phases and are not silently performed in S8B.
- Use the exact eight delivered semantic SVG designs, either as inline `currentColor` SVGs or repo-local components. Emoji and unrelated generic imagery are prohibited.
- The approved status labels in this phase describe the currently approved navigation/setup presentation. They are not permission to add DB fields, queries, mutations, or new configuration semantics.

**Verification:** focused navigation/UI source-contract tests once, `npx tsc --noEmit` once, and `git diff --check` once. Full suite and build are not required unless the focused evidence fails for a reason that cannot be isolated.

**Boundaries:** no DB, Supabase, Auth, Storage, LINE, migration, dependency, config, permission, pricing, action, or backend change. No content access to protected paths. Implementation commit, push, Ready, merge, Preview, and deployment remain later separate gates.

**Acceptance target:** E2 uncommitted local candidate after MacBook Codex scope and visual-source review.

### GDA-COATING-V3.3-C1 — Seven-size contract normalization

**Status:** CLOSED — source delivered, verified, squash-merged in PR #28 at `0bfd69f4d6f4085163ba19599151fa689646a088`, and Dev-Next automatic Vercel build succeeded.

**Objective:** Normalize every allowlisted new-operation vehicle-size contract to exactly `SS / S / M / ML / L / LL / XL`, abolish `XXL`, and make `XL` the terminal result of the existing 3M classifier without changing any numeric threshold.

**Canonical authorities at C1 execution:**

- `docs/master_specification/GDA_COATING_SETTINGS_FORMAL_SPEC_CHANGE_V3.md` V3.3.
- `docs/master_specification/CLAUDE_DIRECTIVE_GDA_COATING_V3_3_C1_SEVEN_SIZE_CONTRACT.md`.

**Owner decisions:**

- `XXL` is not a valid new-operation size.
- Do not merge, alias, map, automatically convert, or use `XXL` as an `XL` price fallback.
- Existing finalized historical records are not rewritten or recalculated.
- Existing persisted `XXL` values are not read or modified in C1. Their inventory and manual-remediation flow require a later separately authorized gate.
- C1 preserves the current 3M thresholds, OCR/form behavior, operator correction, retained labels, retained multipliers, and retained PPF prices.
- Direct seven-size coating prices, upper-layer pricing, coating UI, production OCR wiring, DB changes, migrations, and historical remediation are later phases.

**Literal implementation allowlist:**

1. `src/lib/dealer-settings/dealer-settings-types.ts`
2. `src/lib/dealer-settings/dealer-settings-defaults.ts`
3. `src/lib/pricing/pricing-data.ts`
4. `src/lib/pricing/pricing-engine.ts` — comment/type-description correction only
5. `src/lib/vehicles/body-size-estimate.ts`
6. `src/components/onboarding/CustomerVehicleOnboardingWizard.tsx` — remove only the `XXL` option
7. `src/lib/vehicles/body-size-estimate.test.ts` — add
8. `src/lib/pricing/body-size-contract.test.ts` — add

**Required behavior:**

- The canonical size type, defaults, shared pricing data, PPF plan-price keys, classifier output, and onboarding choices contain exactly seven values in the approved order.
- The classifier keeps the current boundaries and returns `XL` for every remaining finite value after the `LL` boundary.
- No compatibility alias or automatic legacy coercion is introduced.
- The old coating `base_price_m` and `size_multipliers` architecture remains temporarily in C1, with exactly seven keys. The direct-price architecture belongs to C2.

**Verification:** run the two focused contract tests together once, `npx tsc --noEmit` once, and `git diff --check` once. Do not run the full suite or build unless MacBook Codex separately authorizes it after a focused failure that cannot be isolated.

**Boundaries:** protected paths in section 3.1 remain metadata-only. No DB, Supabase, Auth, Storage, LINE, migration, external-service, dependency, config, route, permission, unrelated UI, stage, commit, push, Ready, merge, Preview, or deployment action is included in the C1 implementation candidate.

**Acceptance result:** E2 source acceptance completed; commit/push/Ready/merge and post-merge Dev-Next build gates completed separately. C1 does not authorize C2 implementation.

### GDA-COATING-V3.4-C2 — Direct-price architecture read-only impact diagnosis

**Status:** AUTHORIZED — one bounded read-only Claude diagnosis; implementation is not authorized.

**Objective:** Map the current coating settings, persistence, authoritative pricing catalog, rank/matrix enforcement, Estimate Wizard, and tests to an exact migration-safe architecture for seven-size direct prices with fully independent layer-1, layer-2, and layer-3 product-price contracts.

**Canonical authorities:**

- `docs/master_specification/GDA_COATING_SETTINGS_FORMAL_SPEC_CHANGE_V3.md` V3.4.
- `docs/master_specification/CLAUDE_DIRECTIVE_GDA_COATING_V3_4_C2_DIRECT_PRICE_ARCHITECTURE_DIAGNOSIS.md`.
- Accepted visual delivery `gda_coating_settings_ui_v3_3_r2_r1.zip`, SHA-256 `59e5307c2391dfb94210dd28d5f434b0edfacca7ed92d5c8a9e01b621c4f3686`.

**Frozen owner decisions:**

- Valid sizes remain exactly `SS / S / M / ML / L / LL / XL`; `XXL` stays abolished with no alias, conversion, merge, or fallback.
- Layer 1, layer 2, and layer 3 use separate product selections and separate seven-size price maps.
- Layer 2 and layer 3 may use different liquids. A price in one layer must never be copied, substituted, or used as fallback for the other layer.
- Prices are tax-exclusive integers entered directly; unset and explicitly confirmed free remain distinct.
- Existing rank/matrix rules and historical finalized records remain unchanged and fail closed.
- The accepted R2-R1 UI is the visual authority; implementation-level corrections do not justify another GenSpark round trip.

**Read boundary:** Current `origin/main` at commit `0bfd69f4d6f4085163ba19599151fa689646a088`, tree `8ccbdf10323b710e97bb091aa7d20d022fe59973`, using only the source seeds and direct dependency/caller paths in the C2 directive. Protected paths in section 3.1 remain metadata-only.

**Required result:** One `GDA_COATING_V3_4_C2_DIRECT_PRICE_ARCHITECTURE_DIAGNOSIS_V1` report containing the current contract ledger, complete legacy-field identities, recommended target contract, migration and mixed-version strategy, fail-closed behavior, accepted-UI binding map, and exact literal-path phases for later implementation.

**Prohibited:** Any source/test/migration/config/document edit by Claude; test/typecheck/build/runtime execution; DB/Supabase/Auth/Storage/LINE/Vercel/external-service access; branch/worktree/stage/commit/push/Ready/merge/deploy; live legacy-data query; accepted-UI redesign.

**Exit:** MacBook Codex independently verifies the one C2 report and either records `CHANGES_REQUIRED` with one exact correction or accepts an exact first implementation phase. No code is required or permitted in C2.

### GDA-ESTIMATE-PRICING-RECOVERY-R1 — Preview authoritative-pricing recovery

**Status:** COMPLETE — `GDA_ESTIMATE_PRICING_RECOVERY_R1_PRODUCTION_ACCEPTED`. The bounded reader repair was accepted in Preview, PR #41 was squash-merged to `main` as `81fd36bf5c73cb84b872deaf4ab3211a634fbe1f` with tree `0fc2f7877ab846ac7d9700986ee0f68d4e88f4b0`, the automatic Vercel production deployment succeeded, and MacBook Codex independently verified the authenticated production Estimate Wizard route.

**Objective:** Restore the Estimate Wizard Preview route by making the strict reader safely accept the natural coating-only sparse object produced by independent settings persistence, without weakening fail-closed validation of any value that is actually present.

**Owner decision:** C5-D-R4 is temporarily paused. This recovery phase runs first because the Estimate Wizard cannot start in the current Dev-Next Preview. After recovery acceptance, the separately queued PPF offering-control phase runs next.

**Observed read-only evidence:**

- Preview authentication, the active dealer membership, active staff row, dealer rank, service-offering read, lifecycle state, revision equality, and required global catalog counts all resolve successfully.
- `dealer_service_offerings.ppf` is `true` in the affected Preview tenant.
- The affected `dealer_settings.service_price_settings` object contains only the top-level `coating` member.
- `authoritative-pricing-catalog-core.ts` requires the complete non-null service settings structure, including `ppf`, `window_film`, `maintenance`, `carwash`, and `room_cleaning`; the sparse row therefore fails closed before the wizard renders.
- No application crash or HTTP 500 was observed. The route intentionally rendered the generic unavailable state.

**Accepted diagnosis:** `GDA_ESTIMATE_PRICING_RECOVERY_R1_READ_ONLY_DIAGNOSIS_RESULT_V1` returned `READY_FOR_IMPLEMENTATION_GOVERNANCE`. MacBook Codex independently confirmed the write/read call chain, clean state, protected metadata, and two-file repair boundary, but rejected one overbroad sentence in the report: the proposed repair does not make a `window_film_v1`-only object valid because coating remains mandatory. The implementation contract therefore fixes the observed coating-only row only and must not claim to close the separately queued PPF/coating-offering behavior.

**Implementation-governance write allowlist — exactly three paths:**

1. `docs/master_specification/GYEON_DA_COMPLETION_PLAN.md`
2. `docs/master_specification/GYEON_DA_PHASE_RESULTS.md`
3. `docs/master_specification/CLAUDE_DIRECTIVE_GDA_ESTIMATE_PRICING_RECOVERY_R1_IMPLEMENTATION.md` (new)

**Accepted root cause:** `save_coating_v34_settings` applies `jsonb_set(coalesce(service_price_settings, '{}'), '{coating}', ...)`, so a null row naturally becomes a coating-only object. The strict reader then unconditionally requires `ppf`, `window_film`, `maintenance`, `carwash`, and `room_cleaning` before it resolves the valid V3.4 coating payload. The first absent member therefore becomes `malformed`, collapses to `pricing-catalog-failed`, and the route renders the generic unavailable state.

**Accepted implementation architecture:**

- Change only the pure strict reader so absence or explicit null of the five legacy service sections means no override for that section; canonical defaults fill the omitted family exactly as they already do when the whole column is null.
- If any of those five keys is present and non-null, preserve its existing complete validation unchanged; malformed present data still fails closed.
- Keep V3.4 coating mandatory for every non-null `service_price_settings` object in this narrow recovery phase.
- Keep `ppf_price_tables`, `window_film_v1`, tenant/RLS behavior, unset-versus-zero semantics, seven sizes, independent coating layers, and historical finalized estimates unchanged.
- Do not add a migration or update the existing Preview row. The existing coating-only row is remediated by the compatible read path; rollback is a plain Git revert of the two-file source commit.

**Implemented source write allowlist — exactly two paths:**

1. `src/lib/pricing/authoritative-pricing-catalog-core.ts`
2. `src/lib/pricing/authoritative-pricing-catalog-core.test.ts`

**Required focused regression coverage:**

- A V3.4 coating-only object resolves successfully and all five absent families retain canonical defaults.
- Absent and explicit-null forms of each of the five optional legacy sections resolve as no override.
- Every present-but-malformed optional section still returns `malformed`.
- A complete six-key legacy-compatible object preserves existing output parity.
- A fully null service column preserves canonical-default behavior.
- A `window_film_v1`-only object without valid V3.4 coating remains `malformed`; this explicitly prevents the implementation from claiming the contradiction found in the diagnosis narrative.

**Accepted implementation and verification:**

- Governance commit `f5a38194c383a83aea97a5c65fb75fcfc301c9c8` and source commit `9f9b1e61d5b9960a3a35f9c6d1c5e1f1dad5ef3b` were separately approved, locally committed, and normally pushed to `agent/preview-pricing-recovery-r1`; no force push occurred.
- Claude changed exactly the two source-allowlist paths. MacBook Codex independently inspected the diff and reran the focused suite: 31/31 tests passed and `git diff --check` passed.
- Full-project `tsc --noEmit --incremental false` still exits 2 because the isolated worktree has pre-existing archived-UI/dependency/type-root failures. For the two target paths, only the pre-existing unresolved `node:test`, `node:assert/strict`, and `node:fs` imports at unchanged test lines 10-12 remain; no changed implementation line adds a type error. This phase must not be described as full-project typecheck green.
- The four protected blobs remained unchanged: `c1eb0dc88954f3a17cc85e313b62d5bb6a4fda3f`, `accd22345054cc44f89156fd78eaba6dfe4242a4`, `32fda49583ae1217bc13711784ad8fa31744726c`, and `fe3c80f22fd80dcbfab076082473216dda582c14`.
- PR #41 Vercel checks passed. In the authenticated Preview route `/estimates/new`, the seven-step `新規見積` wizard and customer-registration form rendered, `見積を開始できません` matched zero elements, and captured browser warnings/errors were zero.

**Production acceptance:** After the separately approved Ready and squash-merge gates, `main` reached `81fd36bf5c73cb84b872deaf4ab3211a634fbe1f`. The automatic Vercel production deployment succeeded. In the authenticated production route `/estimates/new`, the seven-step `新規見積` wizard and customer-registration form rendered, `見積を開始できません` matched zero elements, and captured browser warnings/errors were zero.

**Accepted boundary:** This phase proves the observed coating-only row can open the Estimate Wizard in production without weakening present-value validation. It does not make a `window_film_v1`-only object valid and does not implement PPF offering control. No migration, data backfill, production-row mutation, database application, or manual deployment occurred; the production deployment was the normal automatic deployment caused by the authorized merge.

**Closeout write allowlist — exactly two paths:**

1. `docs/master_specification/GYEON_DA_COMPLETION_PLAN.md`
2. `docs/master_specification/GYEON_DA_PHASE_RESULTS.md`

**Exit:** `GDA_ESTIMATE_PRICING_RECOVERY_R1_PRODUCTION_ACCEPTED`. Begin `GDA-ESTIMATE-PPF-OFFERING-R1` as the next independent phase and PR; do not reopen or mix it into PR #41.

### GDA-ESTIMATE-PPF-OFFERING-R1 — PPF availability and partial-PPF control

**Status:** PHASE A SOURCE ACCEPTED, COMMITTED, AND PUSHED / PHASE B SERVER-SAVE GOVERNANCE CANDIDATE AUTHORING AUTHORIZED — Phase A is locally verified at E2 and delivered on the dedicated branch. Phase B is limited to one five-file server-save enforcement candidate. Phase C RPC/SQL enforcement, database access, Preview/production changes, Ready, merge, and deployment remain separately unauthorized.

**Objective:** Make the Estimate Wizard obey the server-owned PPF offering setting consistently in UI, navigation, pricing, draft restoration, and save authorization.

**Frozen behavior:**

- When PPF is offered, the main PPF control is selectable. Partial PPF remains available as an attached option even when the operator selects coating only; the operator must not be forced to select the main PPF category merely to add partial PPF.
- When PPF is not offered, the PPF control remains visible but disabled and gray, with a plain-language reason that the store setting disables PPF.
- When PPF is not offered, independent PPF, partial PPF, PPF pricing, stale draft values, manipulated client payloads, and saved-estimate PPF lines are rejected or removed under one server-owned contract.
- Hiding the control completely is not the approved default because it makes a configured restriction indistinguishable from a missing function or rendering defect.

**Governance base:**

- Branch: `agent/estimate-ppf-offering-r1`
- Fixed source-base commit: `81fd36bf5c73cb84b872deaf4ab3211a634fbe1f`
- Fixed source-base tree: `0fc2f7877ab846ac7d9700986ee0f68d4e88f4b0`
- Worktree: `work/dealeros-estimate-ppf-offering-r1`
- Responsible diagnosis agent after a later gate: MacBook Claude
- Independent acceptance authority: MacBook Codex
- Product authority: Office AZ

**Governance write allowlist — exactly three paths:**

1. `docs/master_specification/GYEON_DA_COMPLETION_PLAN.md`
2. `docs/master_specification/GYEON_DA_PHASE_RESULTS.md`
3. `docs/master_specification/CLAUDE_DIRECTIVE_GDA_ESTIMATE_PPF_OFFERING_R1_READ_ONLY_DIAGNOSIS.md` (new)

**Current source observations to be independently diagnosed:**

- Step 3 currently renders a static PPF control without receiving the authoritative offering map.
- Step 4 currently filters an opted-out PPF family out of the visible sections instead of showing the approved disabled-gray state.
- Existing Step-4 contract tests explicitly preserve the old hide-when-off behavior and therefore require deliberate replacement rather than accidental drift.
- The server save orchestrator resolves the current dealer-bound runtime, including service offerings, but does not yet prove that selected or priced PPF content is allowed before mapping and persistence.
- The current PPF pricing path is selected from draft state; the latest atomic-save SQL accepts the `ppf` category but does not itself read the dealer offering row.

**Required read-only diagnosis:** Map the exact end-to-end PPF authority from offering persistence through runtime configuration, Step-3 presentation, Step-4 full/partial selection, pricing, draft restoration, hostile save intent, DTO/RPC persistence, and saved-estimate behavior. Return the smallest literal later write phases and focused verification commands that enforce one server-owned rule without redesigning the approved UI.

**Read-only diagnosis result:**

- Result identifier: `GDA_ESTIMATE_PPF_OFFERING_R1_READ_ONLY_DIAGNOSIS_RESULT_V1`
- Verdict: `CHANGES_REQUIRED_GOVERNANCE`
- Execution HEAD/tree: `d1a4cd29ac611e4cf42002a7c51a49239423808d` / `95ed2d42ca1a9b8c1260c3a083b21fa826537e71`
- The committed governance delta contained exactly the required three paths, the worktree remained clean, and all four protected blobs matched.
- Confirmed conflicts: Step 3 does not receive the PPF offering switch; Step 4 removes opted-out PPF instead of presenting the approved disabled state; coating-only selection has no attached partial-PPF entry; server save and the current atomic RPC do not independently deny PPF while the dealer offering is off.
- MacBook Codex correction: missing implementation is expected and is not itself a governance defect. The `CHANGES_REQUIRED_GOVERNANCE` consequence is retained because the returned server phase referenced one file that had not been read, the earliest client normalization point was not fixed, and the SQL verification path was not literal. Those gaps must be resolved in separate later governance; they do not block the bounded Phase A UI/state work.

**Phase A — UI/state behavior only:**

- Step 3 receives the authoritative `screenConfig.serviceOfferings.ppf` value from the existing server-resolved runtime.
- PPF offered: the Step-3 PPF control remains enabled and selectable.
- PPF not offered: the same control remains visible, disabled, gray, and displays exactly `店舗設定でPPFが「提供しない」に設定されています。` It must emit no canonical-state patch.
- PPF offered and coating selected without main PPF: Step 4 shows a compact attached-action entry `部分PPFを追加`. Activating it applies one canonical patch that adds the existing `ppf` category and sets the existing PPF `installationMethod` to `partial`, then opens the existing PPF section. It creates no second PPF model, category, line identity, or price path.
- The attached action is absent when PPF is not offered, absent when PPF is already selected, and visibly disabled with the existing administrator setup reason when PPF is offered but its global prerequisites are incomplete.
- Phase A does not claim server authorization. Stale or hostile PPF draft rejection remains mandatory Phase B/C work and Phase A cannot be merged to production independently of those gates.

**Phase A literal implementation write allowlist — exactly five paths:**

1. `src/components/estimates/wizard/EstimateWizard.tsx`
2. `src/components/estimates/wizard/steps/Step3Category.tsx`
3. `src/components/estimates/wizard/steps/Step3Category.test.tsx` (new)
4. `src/components/estimates/wizard/steps/Step4Estimate.tsx`
5. `src/components/estimates/wizard/steps/Step4Estimate.binding.test.tsx`

**Phase A governance write allowlist — exactly three paths:**

1. `docs/master_specification/GYEON_DA_COMPLETION_PLAN.md`
2. `docs/master_specification/GYEON_DA_PHASE_RESULTS.md`
3. `docs/master_specification/CLAUDE_DIRECTIVE_GDA_ESTIMATE_PPF_OFFERING_R1_A_UI_STATE_IMPLEMENTATION.md` (new)

**Accepted Phase A source:**

- Commit: `58d5b044117a33233eb4899550fb9e75a91b8c40`
- Tree: `66b369a49efdd1536a3800e30b0394f84b51f370`
- Delivery: normal push to `origin/agent/estimate-ppf-offering-r1`; no force push.
- Scope: exactly the five Phase-A implementation paths.
- Verification: PPF-focused Step-3 and Step-4 cases `14/14` PASS, `npm run typecheck` PASS, and `git diff --check` PASS. The full two-file command retained five pre-existing window-film failures that were reproduced unchanged at the fixed source base; they are not a Phase-A regression.
- The four protected blobs remained unchanged. The worktree was clean after commit and the remote branch HEAD matched the exact commit.
- Phase A remains non-mergeable by itself because server-save and direct-RPC enforcement are still required.

**Phase B — authoritative server-save enforcement:**

- After the current runtime is loaded, tenant identity is proved, and the expected configuration revision matches, the pure save orchestrator must reject a PPF-bearing validated draft when `runtime.screenConfig.serviceOfferings.ppf` is false.
- A required structurally present but canonical-default PPF configuration is not PPF intent. Selected `ppf` or any non-default PPF configuration is PPF intent and fails closed before pricing, mapping, DTO validation, or persistence.
- The stable public failure is `service-not-offered`; it produces exactly one sanitized pre-persist event at stage `service-offering`, code `VALIDATION_ERROR`, severity `info`.
- Phase B does not silently rewrite a stale/hostile draft and does not change Server Action wiring, pricing, mapping, DTOs, persistence, RPC, SQL, or migrations.

**Phase B literal implementation write allowlist — exactly five existing paths:**

1. `src/components/estimates/wizard/save/wizard-save-intent-orchestrator.ts`
2. `src/components/estimates/wizard/save/wizard-save-intent-orchestrator.test.ts`
3. `src/components/estimates/wizard/save/wizard-save-intent-types.ts`
4. `src/components/estimates/wizard/save/wizard-save-observability.ts`
5. `src/components/estimates/wizard/save/wizard-save-observability.test.ts`

**Phase B governance write allowlist — exactly three paths:**

1. `docs/master_specification/GYEON_DA_COMPLETION_PLAN.md`
2. `docs/master_specification/GYEON_DA_PHASE_RESULTS.md`
3. `docs/master_specification/CLAUDE_DIRECTIVE_GDA_ESTIMATE_PPF_OFFERING_R1_B_SERVER_SAVE_ENFORCEMENT.md` (new)

**Boundary:** This governance candidate changes exactly the three Phase-B governance paths. It changes no source, test, migration, SQL, RPC, UI implementation, dependency, config, generated artifact, or protected path. It runs no implementation test, typecheck, build, runtime, database, Supabase, Auth, browser, Vercel, provider, or external-service command. It does not transmit private files to Claude and does not stage, commit, push, create or mutate a PR, mark Ready, merge, or deploy.

**Exit:** MacBook Codex verifies the exact Phase-B three-document governance candidate and `git diff --check`, then requests separate stage/local-commit authorization. Push and transmission of the Phase-B directive/private source to Claude require later explicit gates. Phase C RPC/SQL enforcement remains unimplemented and separately governed.

### GDA-ESTIMATE-MANAGED-SERVICE-OFFERING-R1 — all managed-service save enforcement

**Status:** PHASE A ACCEPTED AND PUSHED / PHASE B-R2 SQL AND HARNESS ACCEPTED, COMMITTED, AND PUSHED / `DISPOSABLE_DB_PASS` AT E2 LOCAL / PR #44 OPEN/DRAFT — Phase A enforces all five managed families in the authoritative server-save orchestrator at commit `1bb530f3105055707b7387f6492ede3078402f36`. Phase B-R2 adds the direct-RPC SQL guard, canonical pgTAP coverage, and dedicated PostgreSQL 17 disposable harness. The accepted final execution HEAD is `8fd745ebdd1bb02aab2820f4fb45cce707dca1b3`; the fresh suffix `20260830T091640Z-333258` passed migration replay, pgTAP, real Auth/PostgREST, separate-connection concurrency, cleanup, zero-row, stop, secret-scan, and evidence-integrity gates. Shared/staging/production migration application, Preview verification, Ready conversion, merge, and deployment remain separately unauthorized.

**Objective:** Make the current dealer-owned offering switches one enforceable contract for every managed Estimate Wizard service family, not merely a client-side display rule.

**Current main authority:**

- Base commit: `7aca4e7dfcebb4bd71cb8d1d2db0dbda71644110`
- Base tree: `bde678a017a875b46df56bfe0c054670c61128ec`
- PR #42 predecessor: `4fdb58a9678e36c8198f83ee3bbb4cb0b5949293`
- Dedicated governance branch: `plan/estimate-managed-service-offering-enforcement-r1`
- Dedicated worktree: `work/dealeros-estimate-managed-service-enforcement-r1`

**Frozen business contract:**

- The five managed families are `window_film`, `ppf`, `maintenance`, `room_cleaning`, and `car_wash`.
- Their canonical Wizard categories are respectively `window`, `ppf`, `maintenance`, `roomclean`, and `carwash`. The mapping in `src/lib/estimates/service-categories.ts` is the only mapping authority and must not be re-spelled in another module.
- `coating` and `other` are not governed by this offering-switch contract and remain unchanged.
- Step 3 keeps the PR #43 behavior: all seven controls have the same fixed height; an unavailable managed service remains visible, gray, disabled, unselected, and accompanied by its store-setting reason.
- The current dealer-bound runtime `screenConfig.serviceOfferings` is the only server save authority. Client flags, UI disabled state, shop rank, catalog presence, and stale draft display are not authority.
- After actor/tenant validation and exact configuration-revision validation, but before pricing, mapping, DTO validation, or persistence, any intent for an unavailable managed family returns the existing stable failure `service-not-offered`.
- A category selection is service intent. Any non-default value in that family's structurally required configuration section is also service intent, even when the category was removed or the client was manipulated.
- A structurally present configuration section that exactly matches the canonical initial draft is not service intent.
- The server must not silently clear, rewrite, normalize away, or partially save unavailable service intent.
- Rejection continues to emit one sanitized `service-offering` / `VALIDATION_ERROR` / `info` observability event with the resolved dealer id and no customer, vehicle, pricing, draft, or raw configuration detail.
- PPF full/partial behavior, pricing, OCR, seven-size body classification, rank rules, coupons, DTOs, idempotency, and all accepted unrelated flows remain unchanged.

**Confirmed gap at this base:**

- `wizard-save-intent-orchestrator.ts` has an authoritative predicate and guard for PPF only.
- The same orchestrator has no equivalent guard for `window_film`, `maintenance`, `room_cleaning`, or `car_wash`.
- Therefore Step 3 correctly blocks normal interaction, but stale or manipulated drafts for those four families can still reach server pricing and persistence.
- Direct RPC/SQL enforcement is not proved by the PR #42/#43 source delta and remains a separate bypass-resistance phase.

**Required read-only diagnosis:**

- Verify the exact canonical-default and non-default intent signals for all five managed families.
- Verify guard ordering, stable failure ownership, and existing observability exhaustiveness.
- Trace direct callers beyond the orchestrator and identify the smallest separate RPC/SQL enforcement phase and literal disposable-database test path.
- Return exact later implementation allowlists and commands. Do not implement, test, contact a database, or change Git during diagnosis.

**Governance write allowlist — exactly three paths:**

1. `docs/master_specification/GYEON_DA_COMPLETION_PLAN.md`
2. `docs/master_specification/GYEON_DA_PHASE_RESULTS.md`
3. `docs/master_specification/CLAUDE_DIRECTIVE_GDA_ESTIMATE_MANAGED_SERVICE_OFFERING_R1_READ_ONLY_DIAGNOSIS.md` (new)

**Protected paths:** The four repository protected paths remain metadata-only and must retain blobs `c1eb0dc88954f3a17cc85e313b62d5bb6a4fda3f`, `accd22345054cc44f89156fd78eaba6dfe4242a4`, `32fda49583ae1217bc13711784ad8fa31744726c`, and `fe3c80f22fd80dcbfab076082473216dda582c14`.

**Boundary:** This phase authors governance only. Claude transmission/execution, source/test changes, package changes, stage, commit, push, PR mutation, migrations, SQL/RPC changes, database/Supabase/Auth/browser/Vercel/provider access, Ready, merge, and deployment are separate and unauthorized.

**Exit:** MacBook Codex verifies the exact three-document diff and `git diff --check`, then requests separate authorization for exact-path staging and local commit. Private transmission to Claude and the one-time read-only diagnosis require later explicit authorization.

**Accepted read-only diagnosis:**

- Result: `GDA_ESTIMATE_MANAGED_SERVICE_OFFERING_R1_READ_ONLY_DIAGNOSIS_RESULT_V1`
- Verdict: `CHANGES_REQUIRED_SERVER_AND_SQL`
- Governance HEAD/tree: `387d8993d542a001ff2c9f2e54ff275789591f9d` / `035cf5f2b2884635e3834e6026720558e71f48db`
- Claude execution: one non-persistent Sonnet diagnosis, high effort, no permission denials, no subagent, no mutation, `2.7157178 USD` total cost under the `3 USD` cap.
- MacBook Codex independently confirmed the PPF-only guard, all four missing family guards, canonical defaults, unchanged protected blobs, clean worktree, and absence of `dealer_service_offerings` checks in the current atomic-save migration chain.
- Existing pgTAP coverage exists at `supabase/tests/estimate_wizard_atomic_save.test.sql` and `supabase/tests/estimate_wizard_dml_integrity.test.sql`; no dedicated disposable execution harness was found. Harness creation belongs only to separately governed Phase B.

**Phase A — authoritative server-save generalization:**

- Replace the PPF-only decision at the existing post-revision/pre-pricing guard with one pure five-family decision using the existing `SERVICE_FAMILIES` and `SERVICE_FAMILY_CATEGORY` authority.
- Preserve `isPpfBearingDraft` behavior exactly. Extend the same canonical-default-versus-intent rule to `windowFilm`, `bodyMaintenance`, `carWash`, and `roomCleaning`.
- Window-film intent signals are selected `window`, non-empty `selectedAreaIds`, non-null `filmTypeId`, non-empty `unitPriceInput`, non-null `selectedPackageCode`, non-empty `selectedOptionIds`, or any `optionQuantities` key.
- Maintenance intent signals are selected `maintenance`, non-null `menuId`, or non-empty `unitPriceInput`.
- Car-wash intent signals are selected `carwash`, non-null `menuId`, or non-empty `unitPriceInput`.
- Room-cleaning intent signals are selected `roomclean`, non-empty `selectedMenuIds`, or any `unitPricesByMenu` key.
- If any disabled family carries intent, return the existing `service-not-offered` result after actor/tenant/revision checks and before pricing, mapping, DTO validation, or persistence.
- Do not expose the family, raw draft, customer, vehicle, pricing, or configuration detail. Reuse the existing sanitized observability contract without changing its types or mapping.
- Preserve PR #43 UI, PPF full/partial behavior, coating/other behavior, pricing, OCR, seven-size classification, rank, coupon, DTO, idempotency, and tenant contracts.

**Phase A implementation write allowlist — exactly two paths:**

1. `src/components/estimates/wizard/save/wizard-save-intent-orchestrator.ts`
2. `src/components/estimates/wizard/save/wizard-save-intent-orchestrator.test.ts`

**Phase A governance write allowlist — exactly three paths:**

1. `docs/master_specification/GYEON_DA_COMPLETION_PLAN.md`
2. `docs/master_specification/GYEON_DA_PHASE_RESULTS.md`
3. `docs/master_specification/CLAUDE_DIRECTIVE_GDA_ESTIMATE_MANAGED_SERVICE_OFFERING_R1_A_SERVER_SAVE_IMPLEMENTATION.md` (new)

**Phase A required verification:**

- Focused orchestrator and observability tests must pass without deleting or weakening existing assertions.
- `npm run typecheck` must pass or report a clearly reproduced environment-only blocker without changing dependencies.
- `git diff --check` must pass and the final unstaged diff must contain only the two implementation paths actually changed.
- No database, Supabase, browser, Vercel, provider, Preview, or production execution belongs to Phase A.

**Phase A exit:** MacBook Codex verifies the exact three-document governance candidate and requests separate stage/local-commit authorization. Governance push, private Claude transmission, source implementation, tests, source commit/push, PR comments, Ready, merge, deployment, and Phase-B SQL work remain separate gates.

**Accepted Phase A source result:**

- Accepted commit: `1bb530f3105055707b7387f6492ede3078402f36`
- Accepted tree: `daddebc2e89919b22cdb534d1cb91c07b3474787`
- Pull request: `#44`, still `OPEN/Draft` at acceptance.
- Exact source delta: `wizard-save-intent-orchestrator.ts` and `wizard-save-intent-orchestrator.test.ts` only.
- The first independent focused run exposed a compatibility gap for structurally missing optional managed-family sections: `68/94` passed and `26/94` failed before acceptance. The candidate was repaired within the same two-path allowlist so missing sections carry no configuration intent unless their category is selected.
- Final focused verification: `94/94 PASS`; `npm run typecheck PASS`; `git diff --check PASS`.
- Protected blobs remained `c1eb0dc88954f3a17cc85e313b62d5bb6a4fda3f`, `accd22345054cc44f89156fd78eaba6dfe4242a4`, `32fda49583ae1217bc13711784ad8fa31744726c`, and `fe3c80f22fd80dcbfab076082473216dda582c14`.
- Phase A was locally committed and normally pushed to the PR #44 branch. It did not change SQL/RPC/migrations, access a database or provider, mark Ready, merge, or deploy.

**Phase B — direct RPC/SQL enforcement, read-only diagnosis governance candidate:**

- Current gate: author one bounded read-only diagnosis directive that determines the active RPC contract and the smallest later forward-only migration, pgTAP, and fresh disposable direct-RPC proof. No implementation is authorized.
- Any later repair must add one new forward-only migration and must never edit historical migrations in place.
- `public.save_estimate_from_wizard` must independently deny disabled managed-family intent using authenticated dealer ownership and `dealer_service_offerings`; missing and false both mean OFF.
- Existing pgTAP coverage must be extended later, and a dedicated fresh loopback-only PostgreSQL 17 disposable harness with real tenant claims and direct RPC calls remains mandatory because no dedicated harness exists today.
- Static inspection, pgTAP, and fresh disposable execution are separate later acceptance layers; none can be substituted by UI or server-action evidence.

**Phase B governance write allowlist — exactly three paths:**

1. `docs/master_specification/GYEON_DA_COMPLETION_PLAN.md`
2. `docs/master_specification/GYEON_DA_PHASE_RESULTS.md`
3. `docs/master_specification/CLAUDE_DIRECTIVE_GDA_ESTIMATE_MANAGED_SERVICE_OFFERING_R1_B_DIRECT_RPC_SQL_READ_ONLY_DIAGNOSIS.md` (new)

**Phase B boundary:** This authoring candidate changes only the three governance paths above. It does not transmit private files to Claude; inspect or change SQL/RPC/migrations/tests/harnesses; run tests, typecheck, build, databases, Supabase, Docker, browser, network, or provider commands; or stage, commit, push, mutate PR #44, mark Ready, merge, or deploy.

**Phase B governance exit:** MacBook Codex verifies the exact three-document candidate and `git diff --check`, then requests separate exact-path stage/local-commit authorization. Governance push and the one-time private read-only Claude diagnosis require later explicit gates. SQL/test/harness implementation remains unauthorized until the diagnosis is independently accepted.

**Accepted Phase B read-only diagnosis:**

- Result: `GDA_ESTIMATE_MANAGED_SERVICE_OFFERING_R1_B_DIRECT_RPC_SQL_READ_ONLY_DIAGNOSIS_RESULT_V1`
- Acceptance: `ACCEPTED_WITH_FOLLOW_UP_REQUIRED`
- Verdict: `CHANGES_REQUIRED_SQL_AND_TESTS`
- Governance execution HEAD/tree: `70f13f465b7cc05462a34b61bc6a5d3b61080da1` / `355edb957d59aa91c1e81274e72b4370285e6acb`
- Claude execution: one non-persistent Sonnet diagnosis, high effort, `2.5704507 USD` under the `3 USD` cap, no web search/fetch, no subagent, and no mutation. One protected-metadata loop command was denied; the four blobs were later verified through permitted individual metadata reads and independently matched by Codex.
- The active RPC is `public.save_estimate_from_wizard(uuid, uuid, jsonb)`, `SECURITY INVOKER`, with server-only `service_role` EXECUTE.
- MacBook Codex independently confirmed that its active SQL body never reads `dealer_service_offerings`; therefore all five managed families lack direct-RPC fail-closed protection even though the accepted Phase-A application path is guarded.
- The smallest later source direction is one new forward-only replacement migration plus focused additions to `supabase/tests/estimate_wizard_atomic_save.test.sql`; historical migrations remain immutable.
- The existing B7-4 harness is PostgreSQL 15 and browser/Playwright-oriented, so it cannot prove the required PostgreSQL 17 direct-RPC contract.
- A nine-file accepted C5-C PostgreSQL 17/direct-RPC/concurrency harness exists, but its contents were outside the Phase-B read allowlist and were not inspected by Claude.
- The prior report did not fully resolve whether the guard belongs after C.7 or after C.9, whether the existing advisory lock can serialize offering changes, or how the missing-row OFF race is defined. These are mandatory Phase B-R1 follow-up questions, not implementation discretion.

**Phase B-R1 objective:** Read only the nine existing C5-C harness references plus the minimum four SQL/race references. Return the exact reusable harness contract, proposed new harness path allowlist, PostgreSQL 17 fresh-runtime sequence, real-claim/direct-RPC cases, and one unambiguous concurrency decision. Do not implement or execute anything.

**Phase B-R1 governance write allowlist — exactly three paths:**

1. `docs/master_specification/GYEON_DA_COMPLETION_PLAN.md`
2. `docs/master_specification/GYEON_DA_PHASE_RESULTS.md`
3. `docs/master_specification/CLAUDE_DIRECTIVE_GDA_ESTIMATE_MANAGED_SERVICE_OFFERING_R1_B_R1_HARNESS_REFERENCE_READ_ONLY_DIAGNOSIS.md` (new)

**Phase B-R1 boundary:** This candidate changes only those three governance paths. It does not read or transmit the nine C5-C file contents to an external service; change source, migration, test, or harness files; execute tests or runtime; access a database/provider; or stage, commit, push, mutate PR #44, mark Ready, merge, or deploy.

**Phase B-R1 exit:** MacBook Codex verifies the exact three-document candidate and `git diff --check`, then requests separate stage/local-commit authorization. Push and private external transmission of the follow-up allowlist require later explicit gates. SQL and harness implementation remain unauthorized until the follow-up result is independently accepted.

**Accepted Phase B-R1 follow-up diagnosis with Codex corrections:**

- Result: `GDA_ESTIMATE_MANAGED_SERVICE_OFFERING_R1_B_R1_HARNESS_REFERENCE_READ_ONLY_DIAGNOSIS_RESULT_V1`
- Claude verdict: `READY_FOR_SQL_AND_HARNESS_IMPLEMENTATION_GOVERNANCE`
- Codex acceptance: `ACCEPTED_WITH_CODEX_CORRECTIONS_REQUIRED`
- Governance execution HEAD/tree: `7a6d622b5e08072b954012d969e8e79ddc38129b` / `553f4d2f794a555bfbba32339aea86e22c6fbaca`
- Claude execution: one non-persistent Sonnet diagnosis, high effort, `2.1492711 USD` under the `3 USD` cap, no web search/fetch, no subagent, no permission denial, and no mutation.
- Accepted harness finding: reuse the C5-C structure for PostgreSQL 17, fresh unique runtime naming outside the worktree and `/private/tmp`, loopback-only Auth/PostgREST/PostgreSQL, exact source identity gates, real local tokens, separate OS-process database connections, bounded timeouts, raw evidence, SHA-256 manifest, cleanup, and burn-on-failure. Do not reuse GYEON-order fixtures, tables, RPC names, assertions, principals, or evidence vocabulary.
- Accepted harness path set: exactly seven new files under `scripts/e2e/gda-estimate-managed-service-offering-r1-b/`: `config.toml`, `setup.sh`, `offering-guard.test.sql`, `real-auth.mjs`, `concurrency.mjs`, `capture-evidence.sh`, and `cleanup.sh`.
- Corrected SQL ordering: C.7 validates every service line; C.8 builds the canonical fingerprint; C.9 acquires the existing same-`(dealer,key)` advisory lock and returns exact replay or raises `DUPLICATE_SUBMISSION`; the new offering guard runs once after that C.9 decision and before the first C.10 write.
- Exact replay therefore keeps its existing zero-write success even if the offering is later disabled. Same key plus a materially different payload keeps `DUPLICATE_SUBMISSION` precedence. Only a genuinely new save evaluates current offering state.
- The guard must derive the distinct managed families from the already validated service categories and perform one set-based anti-authorization query. Per-line or per-family successive queries are prohibited because PostgreSQL `READ COMMITTED` can use a different snapshot for each command.
- The one guard statement's start snapshot is authoritative. Missing row or `enabled IS NOT TRUE` means OFF at that instant. A concurrent enable committed after the snapshot does not authorize that save; a concurrent disable committed after the snapshot does not retroactively invalidate it. The existing idempotency advisory lock does not serialize offering-setting writes and must not be described as doing so.
- Concurrency proof must use two controlled interleavings, not one nondeterministic test accepting either outcome: disable committed before the guard snapshot must reject with zero writes; guard snapshot acquired while enabled before a later disable commits may complete successfully under that snapshot, with no partial or torn persistence.
- Phase A remains frozen. Its pre-RPC application guard can reject a later retry after an offering change, whereas direct RPC exact replay returns the original success. That cross-layer behavior is recorded for a later separate alignment gate; it must not weaken the RPC idempotency contract or broaden Phase B-R2.

**Phase B-R2 — forward-only SQL and dedicated harness implementation governance:**

- Objective: produce one uncommitted source candidate that adds direct-RPC fail-closed offering enforcement and the dedicated PostgreSQL 17 verification harness without executing a database.
- New migration path: `supabase/migrations/20260830160000_estimate_managed_service_offering_guard.sql`.
- The migration must replace the active `public.save_estimate_from_wizard(uuid, uuid, jsonb)` definition forward-only, preserve its signature, `SECURITY INVOKER`, search path, service-role-only execution boundary, all validation, fingerprinting, idempotency, numbering, atomicity, result shape, and unrelated behavior, and add only the corrected C.9a offering guard.
- Category-to-family mapping is exactly `window -> window_film`, `ppf -> ppf`, `maintenance -> maintenance`, `roomclean -> room_cleaning`, and `carwash -> car_wash`. `coating`, `other`, and every existing unmanaged category remain unaffected.
- Disabled-family failure is the stable sanitized `VALIDATION_ERROR: service-not-offered`. It must occur before C.10 and leave zero customer, vehicle, estimate, estimate-item, document-number, revision, idempotency, or related mutation.
- pgTAP must pin all five mappings; absent, false, and true states; mixed managed families; unmanaged-family non-regression; cross-tenant non-authorization; exact replay and conflicting replay precedence; and zero-write rejection.
- The harness must prove real loopback Auth/PostgREST service-role RPC access, dealer/actor validation, five-family absent/false/true and mixed cases, cross-tenant denial, exact replay/conflict, deterministic two-interleaving concurrency, evidence hashing, cleanup, and burned-attempt behavior.

**Phase B-R2 future implementation write allowlist — exactly nine paths:**

1. `supabase/migrations/20260830160000_estimate_managed_service_offering_guard.sql` (new)
2. `supabase/tests/estimate_wizard_atomic_save.test.sql`
3. `scripts/e2e/gda-estimate-managed-service-offering-r1-b/config.toml` (new)
4. `scripts/e2e/gda-estimate-managed-service-offering-r1-b/setup.sh` (new)
5. `scripts/e2e/gda-estimate-managed-service-offering-r1-b/offering-guard.test.sql` (new)
6. `scripts/e2e/gda-estimate-managed-service-offering-r1-b/real-auth.mjs` (new)
7. `scripts/e2e/gda-estimate-managed-service-offering-r1-b/concurrency.mjs` (new)
8. `scripts/e2e/gda-estimate-managed-service-offering-r1-b/capture-evidence.sh` (new)
9. `scripts/e2e/gda-estimate-managed-service-offering-r1-b/cleanup.sh` (new)

**Phase B-R2 implementation verification boundary:** A later explicitly authorized Claude invocation may edit only the nine paths and run only `bash -n` on the three shell files, `node --check` on the two MJS files, the directive's bounded static searches, and `git diff --check`. It must not start PostgreSQL, Supabase, Docker, or Colima; run pgTAP, Auth, PostgREST, RPC, or concurrency; stage, commit, push, or contact any shared/provider environment. Fresh disposable execution is a later separate gate after Codex accepts the uncommitted candidate.

**Phase B-R2 governance write allowlist — exactly three paths:**

1. `docs/master_specification/GYEON_DA_COMPLETION_PLAN.md`
2. `docs/master_specification/GYEON_DA_PHASE_RESULTS.md`
3. `docs/master_specification/CLAUDE_DIRECTIVE_GDA_ESTIMATE_MANAGED_SERVICE_OFFERING_R1_B_R2_SQL_HARNESS_IMPLEMENTATION.md` (new)

**Phase B-R2 current authoring boundary:** This gate changes only the three governance paths. It does not transmit private files to Claude; change migration, pgTAP, harness, application, dependency, configuration, generated artifact, or protected content; execute tests or runtime; access database/Supabase/Docker/Colima/browser/network/provider; or stage, commit, push, mutate PR #44, mark Ready, merge, or deploy.

**Phase B-R2 governance exit:** MacBook Codex verifies the exact three-document diff, directive consistency, protected metadata, clean pre-edit base, and `git diff --check`, then requests separate exact-path stage/local-commit authorization. Governance push, private Claude transmission, nine-path implementation, static verification, disposable execution, source delivery, Ready, merge, database application, and deployment remain separate gates.

**Phase B-R2 implementation candidate and independent decision:**

- Governance execution HEAD/tree: `c4c3b9825c5596e0c7d2b0728c25881d9b550952` / `b7d78864048a874c231fb02ea186a242fa088a5a`.
- Claude returned `GDA_ESTIMATE_MANAGED_SERVICE_OFFERING_R1_B_R2_SQL_HARNESS_IMPLEMENTATION_RESULT_V1` with `CANDIDATE_READY_FOR_CODEX_REVIEW`; the candidate remains uncommitted and dirty in exactly the authorized nine paths.
- MacBook Codex provisionally accepted the new migration's single set-based C.9a guard, exact five mappings, missing/false denial, stable sanitized error, C.9 replay/conflict precedence, C.10 pre-write placement, and static syntax.
- MacBook Codex returned the overall candidate as `CHANGES_REQUIRED_HARNESS_ONLY`. No disposable runtime, SQL, pgTAP, Auth, PostgREST, RPC, concurrency, provider, Preview, production, stage, commit, push, PR mutation, Ready, merge, migration application, or deployment occurred.

**Phase B-R2-A1 — retained-candidate harness correction:**

- A1 keeps all nine B-R2 candidate paths present but permits edits to exactly five existing paths: the canonical atomic-save pgTAP file, `setup.sh`, the dedicated offering-guard pgTAP file, `concurrency.mjs`, and `capture-evidence.sh`.
- The new migration, `config.toml`, `real-auth.mjs`, and `cleanup.sh` are frozen byte-for-byte. Every other repository path remains frozen.
- `setup.sh` must hard-fail unless upstream ahead/behind is exactly `0 0`, every protected path has exact `100644` mode/blob/clean status, and the committed source hashes match. Record-only checks are not acceptance gates.
- The future runtime must copy and execute both the dedicated offering-guard pgTAP and the extended canonical atomic-save pgTAP, each with its own strict non-zero plan/count/pass evidence. Hashing the canonical test without executing it is prohibited.
- Both pgTAP files must add lifecycle-revision zero-mutation proof and pin all active unmanaged categories, including `coating`, `other`, `interior`, and `glass`, while retaining every existing managed-family, replay, conflict, cross-tenant, and zero-write assertion.
- Disable-before-snapshot concurrency must query and inject the exact post-disable configuration revision, then prove the rejected save itself changes no lifecycle revision or business row.
- Snapshot-before-disable concurrency must replace fixed sleeps and the unreliable non-granted relation-lock predicate with bounded polling that proves distinct holder/save/observer PIDs, `wait_event_type = 'Lock'`, `pg_blocking_pids(save_pid)` containing the holder, relation-lock evidence on `document_sequences`, and non-completion before the disable commits.
- Secret scanning must fail closed: grep `0` means a detected match, `1` alone means clean, and any other status is a scan failure.

**Phase B-R2-A1 correction write allowlist — exactly five paths:**

1. `supabase/tests/estimate_wizard_atomic_save.test.sql`
2. `scripts/e2e/gda-estimate-managed-service-offering-r1-b/setup.sh`
3. `scripts/e2e/gda-estimate-managed-service-offering-r1-b/offering-guard.test.sql`
4. `scripts/e2e/gda-estimate-managed-service-offering-r1-b/concurrency.mjs`
5. `scripts/e2e/gda-estimate-managed-service-offering-r1-b/capture-evidence.sh`

**Phase B-R2-A1 governance write allowlist — exactly three paths:**

1. `docs/master_specification/GYEON_DA_COMPLETION_PLAN.md`
2. `docs/master_specification/GYEON_DA_PHASE_RESULTS.md`
3. `docs/master_specification/CLAUDE_DIRECTIVE_GDA_ESTIMATE_MANAGED_SERVICE_OFFERING_R1_B_R2_A1_HARNESS_CORRECTION.md` (new)

**Phase B-R2-A1 current boundary:** This gate authors the exact three governance paths only while preserving the existing dirty nine-path candidate. It does not transmit private files, run Claude, alter candidate source/test/harness files, execute tests or runtime, access database/Supabase/Docker/Colima/Auth/PostgREST/browser/network/provider, or stage, commit, push, mutate PR #44, mark Ready, merge, apply a migration, or deploy.

**Phase B-R2-A1 governance exit:** MacBook Codex verifies the three governance-document edits, exact retained nine-path candidate hashes, frozen four candidate files, protected metadata, clean index, and `git diff --check`. Stage/local commit and normal push of the three governance documents require separate explicit owner authorization. Private transmission and the five-path correction require another explicit authorization after governance delivery.

**Accepted Phase B-R2 implementation and disposable verification:**

- Source and harness delivery reached commit `6ca71ac`, followed by bounded harness-only corrections at `8b87760`, `bb32d7f`, `dbbfb53`, and `8fd745e`. The final commit/tree is `8fd745ebdd1bb02aab2820f4fb45cce707dca1b3` / `fce6c6da6806662df67087b1631d7f18a5e53847`, normally pushed to PR #44 with upstream ahead/behind `0 0`.
- Accepted fresh suffix: `20260830T091640Z-333258`. The exact runtime was removed after successful evidence copy and retained-hash verification.
- pgTAP passed `256/256`: canonical atomic-save `217/217` and dedicated offering guard `39/39`.
- Real local Auth/PostgREST assertions passed `6/6`; genuine separate-connection concurrency assertions passed `13/13` with zero failures.
- Database lint completed with warning-only findings and no error-level issue. Three query-plan captures completed. Secret scanning returned `SECRET_SCAN_CLEAN`.
- Cleanup deleted all fixtures and proved zero rows for dealers, users, dealer members, dealer service offerings, dealer wizard catalog lifecycle, document sequences, customers, vehicles, estimates, and estimate items. Supabase stop, retained evidence copy, retained hash verification, and exact runtime removal all returned zero.
- Evidence integrity: 16 final artifacts, 15 manifest-listed pre-manifest hashes, and zero hash mismatch. The retained evidence root is `/Users/atsushinishikawa/Documents/Codex/runtime/gda-estimate-offering-r1b-evidence/gda-estimate-offering-r1b.20260830T091640Z-333258`.
- Two prior suffixes are burned and excluded from acceptance: `20260830T091046Z-42f7e6` stopped before test execution because the disposable-confirmation precondition was omitted; `20260830T091248Z-aab146` passed executable tests and database teardown but failed canonical artifact packaging. Neither suffix was repaired or reused into acceptance.
- Evidence class is `E2_LOCAL_DISPOSABLE_DB`. No hosted Supabase project, shared/staging/production database, external provider, Preview, or production environment was contacted. No migration was applied outside the fresh local disposable runtime.
- PR #44 remains `OPEN/Draft`. Ready conversion, merge, migration promotion/application, deployment, and E3 environment verification remain separate owner-approval gates.

### GDA-ESTIMATE-WIZARD-POSTAL-MASTER-R5-CR0 — Clean replacement Development pre-execution plan

**Status:** CR0 PLAN COMMITTED AND NORMALLY PUSHED / CHECKS PASS / CR1
READ-ONLY DIRECTIVE GOVERNANCE CANDIDATE AUTHORIZED / DIAGNOSIS NOT RUN /
PROJECT NOT CREATED.

**Objective:** Convert the accepted R5 local disposable result and the blocked
Development schema/ledger preflight into a safe serial clean-replacement plan
without applying the postal migration to the drifted Development project.

**Authority:**
`GDA_ESTIMATE_WIZARD_POSTAL_MASTER_R5_CLEAN_REPLACEMENT_DEVELOPMENT_PRE_EXECUTION_PLAN.md`.
Planning HEAD/tree is
`297ad4b23731a273c134c1ef0f00aff832aedc57` /
`35d572270f84134f8254e1377ccbd198fc67841d`; PR #67 remains OPEN/Draft.

**Blocking reconciliation:** Current Git contains 113 top-level formal
migration SQL files. The accepted R5 runtime staged 112 and excluded only the
protected LINE migration, while the older B-R3 manifest had 101 files, 98
executable paths, and excluded the provisioning pair plus LINE. A new literal
manifest decision is mandatory before any replacement-project creation or
hosted replay. The Owner ratified `ap-northeast-1` on 2026-09-03 as the clean
replacement region because Staging and Production already use that Japan
region, whereas current Development uses `ap-northeast-2`. Any later request
with another region must stop as a plan change.

**Serial boundary:** Plan acceptance; current literal-manifest reconciliation;
conditional prerequisite repair; fresh disposable full-chain acceptance;
cost/organization/name/region/shutdown confirmation; empty project creation;
exact hosted replay; read-only old-Development export manifest; separately
approved retained data/Auth/Storage import; separately approved configuration
and real Japan Post CSV import; old/new acceptance; Development cutover; and a
later independent old-project retirement decision. Every item is a separate
owner gate.

**Current four-document allowlist:**

1. `docs/master_specification/GDA_ESTIMATE_WIZARD_POSTAL_MASTER_R5_CLEAN_REPLACEMENT_DEVELOPMENT_PRE_EXECUTION_PLAN.md` (new)
2. `docs/master_specification/GYEON_DA_COMPLETION_PLAN.md`
3. `docs/master_specification/GYEON_DA_PHASE_RESULTS.md`
4. `docs/master_specification/INDEX.md`

**Current boundary:** Documentation candidate only. No Supabase project, cost
confirmation, migration replay/apply, database write, data export/import,
Storage/Auth/provider/Vercel mutation, secret rotation, postal CSV import,
cutover, retirement, stage, commit, push, PR mutation, Ready, merge, or
deployment is authorized.

**Exit:** Independently verify the exact four-document diff. Stage/local commit
and normal push require later separate explicit approvals. The next executable
phase is not project creation; it is a committed Claude-targeted read-only CR1
manifest-reconciliation gate.

**CR0 delivery:** Commit `4e3aa471ed776ccd360cd6405ccdc850fced5aaa`,
tree `e7cadd5903ab29143e55a03ccb4a71cffe8bdfe1`, was normally pushed to
PR #67. The remote branch matched `0 0`; PR #67 remained OPEN/Draft and
MERGEABLE; Vercel and Vercel Preview Comments passed.

**CR1 governance candidate:** The exact current directive is
`CLAUDE_DIRECTIVE_GDA_ESTIMATE_WIZARD_POSTAL_MASTER_R5_CR1_CURRENT_MIGRATION_MANIFEST_RECONCILIATION.md`.
It limits the future one-time diagnosis to twelve private paths and a
Codex-supplied 113-path metadata attestation. It requires one exact decision
between including both provisioning migrations as disabled infrastructure or
excluding both, and it rechecks whether the accepted R4 product-policy/five-
bucket forward repair already closes the historical prerequisite. It prohibits
project/DB/provider/network execution and cannot return a project-creation
verdict.

**CR1 governance write allowlist — exactly four paths:**

1. `docs/master_specification/CLAUDE_DIRECTIVE_GDA_ESTIMATE_WIZARD_POSTAL_MASTER_R5_CR1_CURRENT_MIGRATION_MANIFEST_RECONCILIATION.md` (new)
2. `docs/master_specification/GDA_ESTIMATE_WIZARD_POSTAL_MASTER_R5_CLEAN_REPLACEMENT_DEVELOPMENT_PRE_EXECUTION_PLAN.md`
3. `docs/master_specification/GYEON_DA_COMPLETION_PLAN.md`
4. `docs/master_specification/GYEON_DA_PHASE_RESULTS.md`

**CR1 current boundary:** Documentation only. Private-file transmission,
Claude execution, tests, runtime, Supabase/DB/project/provider/network access,
source repair, stage, commit, push, PR mutation, Ready, merge, and deployment
remain separately unauthorized.

**CR1 execution result:** One Owner-authorized, tool-disabled, read-only CR1
diagnosis completed against source-evidence HEAD/tree
`216d8cf9aa0dd9135f224aabe90dd5e800fc800e` /
`0b9f494a1714dd4d6f002ae3c284ee623d6592a9`. Claude recommended the current
112-migration manifest, excluding only the protected LINE migration, retaining
both provisioning migrations as disabled infrastructure, treating the accepted
product-policy/five-bucket forward repair as closed, and moving next to CR3
fresh disposable governance with `CR2_NOT_REQUIRED`. The report omitted the
mandatory literal `verdict:` line and exact top-level schema, so MacBook Codex
classifies the artifact as `CHANGES_REQUIRED_GOVERNANCE`; the substantive
recommendation is not yet Owner-ratified.

**CR1-R1 format-correction governance candidate:** The exact directive is
`CLAUDE_DIRECTIVE_GDA_ESTIMATE_WIZARD_POSTAL_MASTER_R5_CR1_R1_RESULT_FORMAT_CORRECTION.md`.
It permits a future Claude invocation to receive only that directive and the
exact prior Claude report. It prohibits retransmission of the twelve private
CR1 files and 113-path metadata table, prohibits new diagnosis or changed
findings, and requires a mechanical rewrite into the literal result schema.

**CR1-R1 governance write allowlist — exactly three paths:**

1. `docs/master_specification/CLAUDE_DIRECTIVE_GDA_ESTIMATE_WIZARD_POSTAL_MASTER_R5_CR1_R1_RESULT_FORMAT_CORRECTION.md` (new)
2. `docs/master_specification/GYEON_DA_COMPLETION_PLAN.md`
3. `docs/master_specification/GYEON_DA_PHASE_RESULTS.md`

**CR1-R1 current boundary:** Documentation authoring only. A second Claude
invocation, prior-report transmission, tests, runtime, Supabase/DB/project/
provider/network access, source changes, stage, commit, push, PR mutation,
Ready, merge, migration apply, cutover, retirement, and deployment remain
separately unauthorized.

**CR1-R1 execution and Codex normalization:** One separately Owner-authorized,
tool-disabled format-only invocation returned the required marker, literal
`verdict: READY_FOR_CR1_MANIFEST_RATIFICATION`, and all eleven required fields
in order. It preserved the 112-migration/LINE-only-exclusion recommendation,
but one duplicated protected LINE Git blob was mistranscribed. Git metadata
proved the canonical blob is `accd22345054cc44f89156fd78eaba6dfe4242a4`.
The Owner authorized MacBook Codex to replace that one string only without a
third Claude invocation. The transparent normalized artifact is
`GDA_ESTIMATE_WIZARD_POSTAL_MASTER_R5_CR1_R1_CODEX_NORMALIZED_RESULT.md`.
No other finding changed.

**CR1 pre-ratification acceptance candidate (historical):** At that checkpoint,
the normalized result was ready for the Owner's manifest ratification. It
recommended exactly 112 executable migrations,
excludes only `20260801110110_line_link_tokens.sql`, keeps both provisioning
migrations as disabled infrastructure, closes the product-policy/five-bucket
prerequisite, records `CR2_NOT_REQUIRED`, and identifies CR3 fresh disposable
governance as the minimum next gate. That candidate was not authorization to
author or execute CR3, create a Supabase project, replay/apply migrations,
contact a provider, cut over, retire, merge, or deploy.

**CR1 normalized-result write allowlist — exactly three paths:**

1. `docs/master_specification/GDA_ESTIMATE_WIZARD_POSTAL_MASTER_R5_CR1_R1_CODEX_NORMALIZED_RESULT.md` (new)
2. `docs/master_specification/GYEON_DA_COMPLETION_PLAN.md`
3. `docs/master_specification/GYEON_DA_PHASE_RESULTS.md`

**Boundary at that checkpoint (historical):** Documentation candidate only.
Stage, commit, push, PR
mutation, CR3 authoring/execution, tests, runtime, Supabase/DB/project/provider
access, migration apply, cutover, retirement, Ready, merge, and deployment
remained separately unauthorized.

**CR1 Owner ratification:** On 2026-09-03 the Owner formally ratified exactly
112 executable migrations from 113 unique top-level formal migration SQL
files. The sole exclusion is
`supabase/migrations/20260801110110_line_link_tokens.sql`. Both provisioning
migrations are included as inert schema under
`INCLUDE_SCHEMA_KEEP_FEATURE_DISABLED`; GYEON partner onboarding remains
disabled. The accepted product-policy/canonical five-bucket forward repair is
closed, the aggregate manifest SHA-256 is
`0d5414ac1257a287938e141d5c398f3607c3bf2650d38255f520956f15ddb5bb`, and
the phase decision is `CR2_NOT_REQUIRED`.

**CR3 fresh-disposable preflight governance candidate (superseded):** The
original directive was
`CLAUDE_DIRECTIVE_GDA_ESTIMATE_WIZARD_POSTAL_MASTER_R5_CR3_FRESH_DISPOSABLE_PREFLIGHT.md`.
It intended to govern a later separately authorized, one-time, tool-disabled,
read-only static review. Its wording limited the future review to thirteen
private supporting files but did not separately count the directive control
input. It must return either
`REUSE_EXISTING_R5_HARNESS_UNCHANGED` or the smallest exact repair need before
any new disposable runtime is considered.

**CR3 governance write allowlist — exactly four paths:**

1. `docs/master_specification/CLAUDE_DIRECTIVE_GDA_ESTIMATE_WIZARD_POSTAL_MASTER_R5_CR3_FRESH_DISPOSABLE_PREFLIGHT.md` (new)
2. `docs/master_specification/GDA_ESTIMATE_WIZARD_POSTAL_MASTER_R5_CLEAN_REPLACEMENT_DEVELOPMENT_PRE_EXECUTION_PLAN.md`
3. `docs/master_specification/GYEON_DA_COMPLETION_PLAN.md`
4. `docs/master_specification/GYEON_DA_PHASE_RESULTS.md`

**Current CR3 boundary:** Directive authoring only. Private-file transmission,
Claude execution, tests, runtime, Supabase/DB/project/provider access,
migration replay/application, project creation, data transfer, real Japan Post
CSV import, configuration, cutover, retirement, stage, commit, push, PR
mutation, Ready, merge, and deployment remain separately unauthorized.

**CR3-R1 invocation-boundary correction:** The corrected directive marker is
`GDA_POSTAL_R5_CR3_R1_FRESH_DISPOSABLE_PREFLIGHT_DIRECTIVE_V1`. A future
invocation may receive exactly one committed directive as its governing control
input plus exactly thirteen private supporting files, for an exact total of
fourteen repository files. Zero other repository files may be transmitted or
opened. The required Claude result marker and all CR1 manifest, region, source,
harness, protected-path, and runtime decisions remain unchanged.

**Current CR3-R1 boundary:** Documentation correction only. Stage, commit,
push, private-file transmission, Claude execution, tests, runtime, Supabase/DB/
project/provider access, migration replay/application, project creation, data
transfer, real Japan Post CSV import, configuration, cutover, retirement, PR
mutation, Ready, merge, and deployment remain separately unauthorized.

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

### GDA-4 — Customer communication and follow-up

**Objective:** Make estimate, completion, review, and maintenance communication usable without manual re-entry.

**Required outcome:**

- Secure LINE link state and consent are verified.
- Outbound messages are previewed and explicitly approved.
- Queue/cron retries are idempotent and observable without leaking customer data.
- Completion and maintenance messages include only authoritative data and valid secure links.
- Payment confirmation is implemented only after an idempotent outbox or created-vs-replayed contract is accepted.
- Review-request dry-run is replaced by real, approval-gated execution or explicitly deferred with no misleading UI.

**Acceptance target:** E4 in a controlled GYEON pilot. Migration/external setup/deployment remain separate authorization phases.

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

**Exit:** E5 for the critical journey. Only after GDA-7 closes may SaaS commercialization planning become the primary roadmap.

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
