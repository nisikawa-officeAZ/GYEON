# Claude Directive — GDA Legacy Customer Registration R1 DB Implementation Preparation

## Status

`OWNER_RATIFIED_GOVERNANCE_ONLY_NOT_EXECUTION_AUTHORITY`

This document records the next database gates. It does not authorize Claude execution, Supabase CLI use, SQL authoring, tests, staging, commit, push, PR mutation, database access, migration application, or deployment.

## Accepted input

- Repository: `nisikawa-officeAZ/GYEON`
- Coordination PR: `https://github.com/nisikawa-officeAZ/GYEON/pull/79`
- Current accepted governance head: `9938cc36b6eb3f83791846b284e2d9a9937159e8`
- Current accepted governance tree: `ae694ee1a7ebfe997b45f74d7a82573aa24ccc80`
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

### Gate B0 — migration-path generation only

After separate Owner authorization:

1. Reconfirm repository, branch, HEAD, tree, index, worktree, protected metadata, and unrelated LFS paths.
2. Run `supabase --version`.
3. Run the repository's discovered Supabase CLI command to generate a migration named `legacy_customer_registration`.
4. Report the exact generated migration path and prove that no other path changed.
5. Stop. Do not add SQL, create tests, run a database, or access any Supabase environment.

Gate B0's write allowlist is the one exact CLI-generated migration path only. Because that path does not exist yet, no timestamped filename is pre-authorized here.

### Gate B1 — bounded uncommitted DB candidate

Gate B1 requires a second, separate Owner authorization after Gate B0 records the exact migration path. Its future literal write allowlist is limited to:

1. the exact migration path generated and recorded by Gate B0;
2. one exact CLI-generated pgTAP/RLS test path recorded before implementation;
3. `src/lib/customers/legacy-registration/legacy-registration-migration-contract.test.ts`.

Gate B1 must produce an unstaged, uncommitted candidate only. It must verify schema shape, constraints, explicit grants, RLS allow/deny behavior, cross-tenant denial, immutable receipt behavior, same-key replay, conflicting-payload denial, zero-history success, rollback, and source-contract expectations. A later fresh disposable-database gate must prove real concurrent separate-connection behavior before acceptance.

## Protected and excluded scope

Never open, read, diff, copy, stage, or modify protected paths identified in the accepted governance record. Preserve and exclude the nine known LFS-materialized design-image paths. Do not touch estimate, invoice, delivery-note, work-order, payment, inventory, TOP, sidebar, PDF, pricing, dependency, package, lockfile, auth-provider, Storage, environment, Preview, or production scope.

## Stop rule

Before either gate, if the checked identity, protected metadata, worktree state, schema target, CLI behavior, or required literal allowlist differs from this contract, stop and report `CHANGES_REQUIRED_GOVERNANCE`. Do not widen scope or repair anything implicitly.
