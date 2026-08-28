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

**Status:** GOVERNANCE CANDIDATE READY / UNCOMMITTED. Authorization remains limited to exactly four governance-document changes; source repair, tests, database/Supabase work, Git delivery, PR mutation, and Claude invocation remain separately gated.

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

**Governance write allowlist — exactly four paths:**

1. `docs/master_specification/GYEON_DA_COMPLETION_PLAN.md`
2. `docs/master_specification/GYEON_DA_PHASE_RESULTS.md`
3. `docs/integrations/gyeon-order/v3-c5c-disposable-db-verification-plan.md`
4. `docs/master_specification/CLAUDE_DIRECTIVE_GYEON_ORDER_V3_C5_B_R2_INVENTORY_EVIDENCE_AND_PAYMENT_CONTRACT_SNAPSHOT_REPAIR.md` (new)

**Future source-repair allowlist — exactly three existing paths:**

1. `supabase/migrations/DRAFT_DO_NOT_APPLY/gyeon_order_v3_contract.sql`
2. `src/lib/product-orders/gyeon-order-v3-migration-contract.test.ts`
3. `src/lib/product-orders/gyeon-order-v3-rpc-contract.test.ts`

**Current boundary:** This gate authors and validates the four governance documents only. Do not stage, commit, push, post to PR #36, invoke Claude, run tests, start Docker/Colima/Supabase, connect to a database, derive/apply SQL, or modify any source file. A later repair remains source-only under the exact three-file allowlist and retains the single terminal `ROLLBACK`.

**Exit:** MacBook Codex verifies the exact four-document candidate and `git diff --check`, then requests separate authorization for exact stage and local commit. Push, external transmission/Claude execution, source review, tests, and C5-C resumption remain later gates.

### GYEON-ORDER-V3-C5-C — Disposable-database acceptance design and execution gates

**Status:** RETURNED TO C5-B R2 GOVERNANCE / NOT EXECUTED. Harness implementation, disposable execution, Git delivery, and PR mutation remain unauthorized.

**Objective:** Prove the pushed C5-B database source candidate on one fresh loopback-only PostgreSQL 17 disposable Supabase runtime, including real signed Auth/PostgREST requests, exact RLS/grant behavior, prepare/finalize evidence consumption, server-owned qualification, durable compensation, warehouse-task release timing, and genuine separate-connection races.

**Predecessor:**

- Branch: `agent/gyeon-order-v3-c5-external-authority-design`
- Commit: `37573c3f9cc476b8d7911221a8696ee61109b9bf`
- Tree: `c94ca1944e1c2d54b5728943501fbc07edc9668a`
- Source verification: focused contract tests `68/68` PASS and `git diff --check` PASS
- Known environment limitation: full-project typecheck is not an acceptance signal in the isolated worktree because repository dependencies and archived UI type roots are unresolved

**Superseded C5-C R2 governance write allowlist (historical):**

- `docs/master_specification/GYEON_DA_COMPLETION_PLAN.md`
- `docs/master_specification/GYEON_DA_PHASE_RESULTS.md`
- `docs/integrations/gyeon-order/v3-c5c-disposable-db-verification-plan.md`
- `docs/master_specification/CLAUDE_DIRECTIVE_GYEON_ORDER_V3_C5_C_A3_READ_ONLY_DIAGNOSIS_V2.md` (new)

**Current return boundary:**

- Preserve `CLAUDE_DIRECTIVE_GYEON_ORDER_V3_C5_C_READ_ONLY_DIAGNOSIS.md` byte-for-byte as historical V1 evidence. V2 supersedes it only for a future A3-bound diagnosis.
- C5-C does not resume from the A3 source. C5-B R2 must first repair exact inventory-reservation validation/consumption and add the explicit payment-contract snapshot accepted by the owner.
- When C5-C later resumes, it must treat classification-version integrity, immutable qualification replay, card-authority binding, payment-contract snapshot persistence, non-retroactive credit activation, exact credit-version revalidation, and inventory-evidence one-time consumption as mandatory executable assertions.
- The prior post-finalize credit-activation question is resolved: the already-confirmed order keeps its frozen standard-payment contract, remains eligible for release when its original payment authority is valid, and does not create an automatic card-void intent merely because credit terms activate later.
- The A3 result-recording commit/push and PR result comment do not authorize a new Claude invocation, harness change, or disposable run.
- Do not stage, commit, push, post to PR #36, invoke Claude, create or edit the C5-C harness, start Colima/Docker/Supabase, connect to any database, derive/apply SQL, create fixtures, run pgTAP/Auth/concurrency checks, or otherwise mutate Git in this gate.

**Required later evidence:**

- Exact committed-migration replay plus one hash-bound runtime derivative of the C5-B guarded SQL with only its terminal `ROLLBACK` changed to `COMMIT`.
- PostgreSQL 17 and current pinned Supabase CLI identity.
- pgTAP schema/RLS/grant/function tests with no plan mismatch, skip, todo, or `NOTESTS`.
- Real local GoTrue tokens and PostgREST requests; SQL-only claim strings or service-role success are not authorization proof.
- Two simultaneous independent database connections plus a third observer proving distinct backend PIDs for every required race.
- Exact fixture cleanup, runtime teardown, raw evidence manifest, secret-redaction proof, and unchanged repository/protected-path metadata.

**Mandatory fail/burn rule:** Any replay, pgTAP, real-Auth, business-contract, concurrency, evidence, or cleanup failure burns the suffix and evidence set. The failed runtime is never repaired or rerun into acceptance. A source defect returns to a separately authorized C5-B repair gate; an environment defect requires a new owner-approved C5-C attempt with a fresh suffix.

**Protected paths:** All section 3.1 paths remain protected. `ScreensPreview.tsx` stays pathname/mode/blob/Git-state only. The LINE migration remains excluded from disposable replay unless a separate LINE phase authorizes it; no hosted/linked project may be contacted.

**Responsibility:** MacBook Claude performs bounded read-only diagnosis and later separately authorized harness/verification work. MacBook Codex independently accepts scope and raw evidence. Mac Studio remains the sole Office AZ inventory implementation owner.

**Acceptance target:** E2 local verification strengthened by disposable-database evidence. C5-C is not E3 because no authorized shared/staging environment is contacted. It does not authorize formal migration promotion, Dev-Next or production application, provider connection, Ready conversion, merge, or deployment.

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
