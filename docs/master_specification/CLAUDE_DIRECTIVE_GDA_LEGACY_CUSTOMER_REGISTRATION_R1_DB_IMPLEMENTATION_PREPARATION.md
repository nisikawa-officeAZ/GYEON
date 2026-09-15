# Claude Directive — GDA Legacy Customer Registration R1 DB Implementation Preparation

## Status

`GATE_B0_COMPLETE_GATE_B1_LITERAL_SCOPE_CANDIDATE`

This document records the completed Gate B0 and the proposed literal Gate B1 boundary. It does not authorize Claude execution, further Supabase CLI use, SQL authoring, tests, staging, commit, push, PR mutation, database access, migration application, or deployment.

## Accepted input

- Repository: `nisikawa-officeAZ/GYEON`
- Coordination PR: `https://github.com/nisikawa-officeAZ/GYEON/pull/79`
- Current accepted governance head: `6b8665b371fb982512678eac80f961717f4365ac`
- Current accepted governance tree: `2762d068aa37302e7c7e24646e60346fc868ba74`
- R2 result marker: `GDA_LEGACY_CUSTOMER_REGISTRATION_R1_READ_ONLY_DIAGNOSIS_COMPLETION_R2_RESULT_V1`
- R2 report SHA-256: `81b03c8e09aedc396eff3e6d12fe447d96d70a49afa1cf8ba17b5aeed58eff2a`
- Owner decision: create `public.legacy_customer_registration_receipts` as the durable zero-history idempotency anchor.
- Function posture: invoker rights with explicit grants and tenant-bound RLS.

## Fixed database contract

The future migration must create and secure both:

1. `public.vehicle_service_history`
2. `public.legacy_customer_registration_receipts`

The receipt is immutable and unique by `(dealer_id, idempotency_key)`. It stores a server-calculated canonical SHA-256 payload fingerprint plus the resolved customer and vehicle IDs. Equal-key/equal-fingerprint replay returns the stored IDs without writes. Equal-key/different-fingerprint reuse fails closed with a stable sanitized conflict code.

The final registration operation is one atomic, idempotent, invoker-rights database transaction. It derives actor and dealer authority server-side, supports zero history rows, and rolls back every customer, vehicle, history, and receipt write on any failure.

## Security invariants

- Enable RLS on every new table in `public`.
- Revoke automatic `anon` and `authenticated` grants before granting back the minimum accepted operations.
- Every authenticated policy binds to active dealer membership; `TO authenticated` is not sufficient by itself.
- No authenticated UPDATE or DELETE grant exists on the receipt table.
- Declare SELECT and INSERT grants and policies separately where required by the invoker transaction.
- Revoke `PUBLIC` execution on every new function; grant execution only to the intended authenticated role.
- Never use JWT `user_metadata`, browser-supplied dealer IDs, or a service-role key as authorization.
- Return stable sanitized errors and do not log PII or raw SQL failures.
- If invoker rights cannot satisfy the atomic contract, stop with `OWNER_DECISION_REQUIRED`; do not introduce `SECURITY DEFINER` without a new owner-ratified design.

## Mandatory gate split

### Gate B0 — migration-path generation complete

The Owner separately authorized Gate B0. It completed with:

- CLI version: `2.116.0`
- command discovered through `--help`: `supabase migration new legacy_customer_registration`
- exact generated path: `supabase/migrations/20260915063440_legacy_customer_registration.sql`
- generated size: `0` bytes
- generated SHA-256: `e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855`
- migration inventory: `115` before and `116` after
- only new path: the exact migration path above
- prior unrelated state preserved: nine known LFS-materialized design images
- protected metadata: unchanged
- SQL, test, database, Auth, Storage, environment, Git index, commit, push, and PR mutation: not performed

Gate B0 stopped at the required boundary. The empty migration remains untracked.

### Gate B1 — bounded uncommitted DB candidate

Gate B1 requires a second, separate Owner authorization. Its literal write allowlist is limited to exactly:

1. `supabase/migrations/20260915063440_legacy_customer_registration.sql`;
2. `supabase/tests/legacy_customer_registration_rls.test.sql`;
3. `src/lib/customers/legacy-registration/legacy-registration-migration-contract.test.ts`.

At the start of Gate B1, discover `supabase test new` through `--help` and use it to create the RLS test file. The generated path must equal `supabase/tests/legacy_customer_registration_rls.test.sql`; otherwise stop with `CHANGES_REQUIRED_GOVERNANCE` before writing any SQL or test content.

Gate B1 must produce an unstaged, uncommitted candidate only. It must verify schema shape, constraints, explicit grants, RLS allow/deny behavior, cross-tenant denial, immutable receipt behavior, same-key replay, conflicting-payload denial, zero-history success, rollback, and source-contract expectations. A later fresh disposable-database gate must prove real concurrent separate-connection behavior before acceptance.

## Protected and excluded scope

Never open, read, diff, copy, stage, or modify protected paths identified in the accepted governance record. Preserve and exclude the nine known LFS-materialized design-image paths. Do not touch estimate, invoice, delivery-note, work-order, payment, inventory, TOP, sidebar, PDF, pricing, dependency, package, lockfile, auth-provider, Storage, environment, Preview, or production scope.

## Stop rule

Before either gate, if the checked identity, protected metadata, worktree state, schema target, CLI behavior, or required literal allowlist differs from this contract, stop and report `CHANGES_REQUIRED_GOVERNANCE`. Do not widen scope or repair anything implicitly.
