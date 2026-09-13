# Book D3A — real connection source scope R1

Status: REGISTERED_SCOPE_CANDIDATE_NOT_COMMITTED / CLAUDE_NOT_DISPATCHED. Registration is not source-authoring or test authority.

## 1. 今回確定した範囲

Owner approved preparing the implementation scope for three gaps: authentic actor/approval-source verification, claim-to-durable-record connection, and strict separation of diagnosis from runtime authority. Owner subsequently approved registering this instruction on the Book coordination PR. This registration permits these two formal documents, append-only plan/ledger records and one non-triggering PR comment. It does not authorize stage/commit/push, Claude invocation, code, tests or database changes.

Flow: register the matching governance/instruction → separately authorize Claude source authoring → independently review the candidate → separately run bounded connection tests → configure and verify real authentication/recording → separately authorize D3A runtime verification. Existing accepted evidence is not discarded and old C7 identities are not reused.

The source candidate defined below concerns the approval-control connection, NOT the business D4 authentication layer, Studio inventory, the estimate UI, CRM, or a new approval service. Its first deliverable is a verified claim and durable record receipt. It must not call the D3A runtime runner. This closes only the connection portion of the three gaps; live runtime adapters, safe resource cleanup and D3A persistence verification remain outstanding.

## 2. Identity and authority

- Book checkout: `/Users/atsushinishikawa/Documents/Codex/2026-08-09/files-mentioned-by-the-user-dealeros/work/dealeros-inv001-p20d2-b2-runtime-wrapper`.
- Branch: `agent/inv001-p20d2-d3a-governance-baseline-reconciliation-r1`.
- Source basis HEAD: `f86e87b8c1dbe8f0e5893518ea2ff20d65afd8fb`; tree: `227129f55e3c45b5c154f5ee97d8498cadab9808`.
- Wrapper root: `/Users/atsushinishikawa/Documents/Codex/2026-08-09/files-mentioned-by-the-user-dealeros`.
- Evidence root: wrapper `evidence/inv001-disposable-runner-r1-20260913/`.
- Only future central approval target: `ahipzehlfkdmjjpnbckd`, the dedicated approval-control project, NOT the application database.
- Existing fixed GitHub repository ID `1207602601`, Owner ID `275073377`, repository `nisikawa-officeAZ/GYEON`. Foundation Issue #39 is a different repository and must not be used as a Book grant source merely because it contains related work.
- Responsible author: MacBook Claude; independent acceptance: MacBook Codex. No Studio dispatch or second agent is requested.

Read the Book AGENTS.md, complete governing plan and latest ledger first. Plan section 18 registers this connection scope; it does not authorize source authoring or preflight execution. Before dispatch, publish/register a matching bounded instruction under section 6.1 and reconcile the source-authoring scope in the governing plan/ledger. Do not ask the Owner to manually relay it. Do not start from an old approval or from this local file alone. A required Claude read-only preflight must be limited to the new interfaces/scope, not a repeat of accepted synthetic suites or the entire D3A diagnosis.

## 3. Literal future source-authoring allowlist

Exactly twelve NEW files, relative to the evidence root:

1. `real-connection-r1/auth-source-reader.mjs`
2. `real-connection-r1/central-approval-transport.mjs`
3. `real-connection-r1/claim-record-contract.mjs`
4. `real-connection-r1/retained-record-protocol.mjs`
5. `real-connection-r1/retained-record-client.mjs`
6. `real-connection-r1/retained-record-worker.mjs`
7. `real-connection-r1/connection-coordinator.mjs`
8. `real-connection-r1/auth-source-reader.test.mjs`
9. `real-connection-r1/claim-record-connection.test.mjs`
10. `real-connection-r1/operation-separation.test.mjs`
11. `real-connection-r1/README.md`
12. `real-connection-r1/source-result.json`

The directory is absent at preparation. Stop if any proposed new path already exists at authoring time; do not overwrite it. No existing evidence/source/test is writable. No package/dependency/lockfile change, application path, migration, SQL function modification, role creation, credential file or launcher is included. New source may reuse existing pure validators/event semantics but must not relax fixture-only APIs or clone Foundation business rules. If this upper bound is insufficient, return the exact additional path and reason; do not silently expand it.

The sibling `BOOK_D3A_REAL_CONNECTION_SCOPE_R1.json` records exact read-reference hashes and protected candidates. The historical source/migration candidates remain hash-only in this task; they need not be transmitted for connection work.

## 4. Connection design to implement after authorization

### A. Authenticated actor and Owner source

Implement a Book-local trusted connector, not a new public HTTP service. All endpoints and operations are fixed in code. Network calls must occur only inside explicit async operations, never on import. No executable CLI entry, automatic login, token refresh, retry, credential discovery or background job.

- `auth-source-reader.mjs`: verify the supplied access token with the configured dedicated Supabase Auth service. Do not trust a locally decoded JWT, `getSession()` result, email/display name or user_metadata as authority. Bind the verified subject to a separately provisioned actor mapping; absent mapping means NOT_CONFIGURED. Revalidation of session_id/expiry and revocation remains in the existing private SQL LIVE path.
- Fetch the exact GitHub comment and repository metadata through authenticated read-only requests to the fixed API host. Verify numeric repository/author IDs, exact comment ID, repository/issue association, revision timestamp, and the raw body digest. A matching hash is not approval by itself. Only an exact previously Owner-approved instruction body/binding is admissible; do not use an LLM or keyword search to interpret free-text permission.
- Pin comment revision as a defined digest of repository ID, comment ID, author ID, updated_at and raw body digest. Document canonical bytes; do not claim this is already the old sourceRevision convention. Old grants with unspecified encodings are not upgraded. The exact admissible source ID/body and actor UUIDs are intentionally NOT_CONFIGURED until the later issuance gate; never select an old comment automatically.
- Re-read and compare the approval source immediately before issuance/claim. A changed/deleted/inaccessible source stops. GitHub reading and central SQL cannot be one transaction: the central revoke operation is the authoritative post-issuance cancellation mechanism. Do not claim that a later GitHub edit automatically revokes a central grant; require that policy to be presented explicitly before live activation.
- Separate GitHub and Supabase credentials; never send either credential to the other host. Reject redirects, wrong final origins, non-success responses, malformed/oversized bodies, timeout and abort. Redact raw responses, tokens and connection strings from errors and results.

### B. Existing private SQL and retained record connection

`central-approval-transport.mjs` targets the existing private SQL functions only, using a fixed bounded local psql child (no shell). It is NOT a guessed PostgREST RPC: the private schema is not exposed. Do not expose it or add a public wrapper.

- Permit only fixed issue_grant, claim_grant and inspect_grant operations. No caller-supplied SQL/function/module/command/host. Validate and safely encode all input before constructing fixed statements; feed secrets through a protected channel, never process arguments or logs. Use a narrowly privileged connection identity with verified TLS and bounded statement/connection/child deadlines. Never use postgres, a management connection or service_role as end-user authorization.
- Existing test psql paths/roles/CA files are historical, not runtime configuration. A separately accepted bootstrap must pin binary/version, server certificate source, least-privileged connection identity, secret channel and actor mapping. Missing bootstrap returns NOT_CONFIGURED before child creation. This phase authors the connector; it creates no bootstrap credentials or roles.
- Only the same genuinely verified JWT may supply transaction-local identity claims. Do not substitute test strings or accept a caller-created verified flag. Require existing SQL actor/session checks as a second layer. Constrain this initial connector to `LIVE` plus `BOOK_D3A_READ_ONLY_DIAGNOSIS` / `READ_ONLY_DIAGNOSIS`; source authoring does not enable LIVE.
- `claim-record-contract.mjs`: explicitly map grantId, claimId, epoch, runId, bindingDigest, source revision/digest, repository/owner, sourceHash/planHash, ledgerId/generationId/machineBinding. UUID wire values and 32-hex local values need explicit, tested conversions, not relabeling. PostgreSQL jsonb text hashing is not JSON.stringify hashing. Treat DB digest as an authenticated opaque receipt tied to the exact sent binding; retain a separately named local canonical digest.
- Validate complete response shape and exact binding before producing an in-process, nonserializable receipt. A pasted JSON object, historical receipt, exported constructor, caller callback or test adapter cannot create live authority. No production test-mode switch. Enforce one attempt per coordinator instance, including failure/UNKNOWN paths.
- A failed or uncertain claim response stops with zero record-driven actions; inspect later under a separate read-only call. Do not auto-retry claim, refund approval, choose another runId or claim the same source through a new grant. DB CLAIMED is not the same as permission to run the inventory harness.

`retained-record-protocol/client/worker.mjs` are an operational-record candidate, separate from the existing fixture/archive profiles. Reuse their established sequence rules and sync/ACK principles, not their synthetic approval registration.

- Designate the existing retained ledger candidate path from the prior connection design; do not create it during authoring. A later isolated test target must be separately fixed and must not overlap runtime cleanup targets. No path-wildcard relaxation to make fixture code operational.
- Create only a fresh explicitly authorized ledger with exclusive initialization; keep the writing handle/session open for that one run. Normal reopen and restored history are read-only. No write-reopen, automatic mkdir/schema migration/repair or creation during inspect. If the selected SQLite primitive cannot satisfy the required path/identity constraints, return BLOCKED_STORAGE_PRIMITIVE rather than weakening them or adding an unapproved dependency.
- Declare the supported threat model: private local directory, trusted host process and OS sandbox; do not claim immunity to a malicious same-UID/root actor or physical power loss from ordinary process tests.
- Atomically persist START, exact central claim reference and first INTENT in the local transaction, then sync and ACK before returning readiness. Central consumption and SQLite commit are not a distributed atomic transaction. Claim success followed by local failure leaves consumption intact and returns an unknown/failed recording state, never a second execution opportunity.
- Secrets never enter SQLite, metadata, events, worker arguments, logs or results. Bound IPC/body/event sizes and deadlines. ACK mismatch, worker exit, cancellation or unknown sync state stops; history may be inspected but cannot restore permission.

### C. Operation separation

`connection-coordinator.mjs` composes the above fixed modules in that order. Return only a connection/record receipt, not an executable workload callback. Do not import/call createSupervisor, runSupervisedExecution or runRecordedFixtureExecution to bypass this boundary.

The initial allowlist contains only READ_ONLY_DIAGNOSIS. Reject candidate apply, DB mutation, VM/container creation, runtime tests, resource deletion, background execution and resume before any claim or persistent write. No unknown/default operation, substring match or caller assertion may expand it. The central SQL response's canExecute=false remains unchanged. A future D3A runtime operation needs a separately approved operation contract and live-adapter scope; no SQL enum or flag change is authorized here.

## 5. Required tests to author, not execute in the source gate

Write tests only for the new boundaries; no rerun/rewrite of accepted 234/374/29 suites in this gate. Later test authorization must provide the exact Node identity, isolated path, command, fault set and output path. Do not use credentials or the hosted project in unit tests.

- Auth/source: wrong host, redirect, wrong repository/Owner/comment/revision/body, copied approval, deleted/changed source, unrelated Supabase user, expired/revoked identity, missing bootstrap, body overflow and cancellation all deny. Test fixtures are explicitly synthetic and cannot be connected to the production transport.
- Claim/record: field/type/UUID/hash-encoding mismatch; wrong epoch/run/ledger/machine; replay; copied receipt; failure before claim, unknown claim, consumed-before-local-failure, commit-before-lost-ACK, worker death, reopen/restore and secret-redaction cases. Assert zero extra operations at every failure point.
- Separation: all non-diagnosis operations denied BEFORE network/claim/write, both for direct module entrypoints and coordinator; importing any source has zero side effects. No fake-provider capability may escape a test-only graph.
- Real TLS/Auth, least-privilege roles, current private SQL parity, actual filesystem/disk guarantees and D3A workload success must remain NOT_RUN until their separate real verification gates.

## 6. Delivery result and stop rule

After separately authorized source authoring, return `BOOK_D3A_REAL_CONNECTION_SOURCE_R1_RESULT` in source-result.json with: exact base identities; files created and SHA-256; three-gap mapping; public entrypoints and trust boundaries; remaining bootstrap/storage constraints; tests AUTHORED_NOT_RUN; externalCalls=0; dbChanges=0; grantsIssued=0; grantsConsumed=0; liveRunnerStarted=false; runtimeReady=false. Do not prefill PASS or test counts.

If any requirement is impossible within the twelve paths, return BLOCKED with concrete evidence and an exact minimal correction. Do not implement an unsafe partial shortcut. Stop after the uncommitted source candidate. Codex review, focused execution, live setup, Git delivery and D3A runtime remain separate.

## 7. Preserved scope and current preparation verification

All existing evidence files, four D3A candidates, furigana scope/empty migration, CRM documents and application source remain unchanged. ScreensPreview.tsx is pathname/mode/blob/status only, never content. Closed finance and LINE scope remain protected. No commit/push, migration, deployment, Studio work, model change or Claude invocation in this registration. The one Owner-approved non-triggering PR instruction is the only external write.

This registered copy and its manifest reside in the Book checkout. The earlier wrapper drafts remain unchanged as preparation evidence. The checkout copies are uncommitted; the PR instruction must disclose that fact and cannot satisfy the committed-governance prerequisite by itself. Current local HEAD/index identity is recorded in the manifest. Before delivery, verify the active coordination PR rather than using its historical number as proof. Pin a new exact execution identity after governance delivery without requiring it to equal the predecessor commit containing no directive.

## 8. Documentation checked for this scope

- Supabase getUser performs server-side Auth retrieval: https://supabase.com/docs/reference/javascript/auth-getuser . This verifies the user, not the Book operation grant.
- Session revocation/expiry remain separate checks: https://supabase.com/docs/guides/auth/sessions .
- GitHub exact comment metadata/body endpoint: https://docs.github.com/en/rest/issues/comments#get-an-issue-comment .
- Supabase changelog read and relevant Data API change checked: https://supabase.com/changelog/45329-breaking-change-tables-not-exposed-to-data-and-graphql-api-automatically . Do not infer private-schema exposure from a function's existence.

The Supabase skill informed the authentic-session, least-privilege and no-secret-output requirements. This is not evidence that a live authentication request or database test succeeded.

## 9. Registered read-only preflight (not a dispatch)

Future preflight marker: BOOK_D3A_REAL_CONNECTION_PREFLIGHT_R1_RESULT. Claude write allowlist EMPTY. Read only the fourteen manifest references plus AGENTS.md, complete plan, latest ledger entries, this directive and the manifest. Confirm receipt and durable-write interface compatibility, the fixed private-SQL authentication trust boundary, bounded psql secret handling, and the storage primitive limit. Do not repeat accepted synthetic tests or produce code. Return SCOPE_READY_FOR_SEPARATE_SOURCE_AUTHORIZATION or NEEDS_EXACT_SCOPE_CORRECTION with file/line evidence and remaining real-verification limits. Tests, DB/Auth/network access, credentials, processes, Git writes and agent dispatch are prohibited. The posted instruction is non-triggering; execution needs a separate explicit Owner authorization and committed matching governance. After any governance delivery, Codex must pin the new execution HEAD/tree without treating the original source base as the new execution HEAD.
