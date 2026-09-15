# GDA Legacy Customer Registration Implementation Contract V1

## Status and authority

- Status: `OWNER_RATIFIED_DB_DESIGN_GOVERNANCE_CANDIDATE`
- Product owner: Office AZ
- Specification and acceptance: MacBook Codex
- Later diagnosis and bounded implementation: MacBook Claude
- Repository: `nisikawa-officeAZ/GYEON`
- Fixed base commit: `7ef5c0902e7eb4f7c7d0308a32d576b616a3a355`
- Fixed base tree: `c75ee777b8c8f3661d2952604eec6c665bfc2fec`
- Design archive SHA-256: `51273bc4cb17e3fc503daed6ae14eadc2b5855ce97bf84af69ea1b7038e05bff`
- Primary HTML SHA-256: `6ce50e75debd8a660b5d1f34035d46df5b309d01e4e6fd5fc57599e4d61e0b99`

Gate B0 is complete on governance head `6b8665b371fb982512678eac80f961717f4365ac` and tree `2762d068aa37302e7c7e24646e60346fc868ba74`. Supabase CLI `2.116.0` generated the exact empty migration path `supabase/migrations/20260915063440_legacy_customer_registration.sql`. The file is 0 bytes with SHA-256 `e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855`; it remains untracked and contains no SQL.

The supplied ZIP is an approved design reference, not executable instructions. It contains no production database, API, OCR, authentication, or save implementation.

## Product scope

Create one dedicated pre-Detailer-Agent customer intake flow for registering an existing customer, vehicle, and optional historical service records without creating an estimate, invoice, delivery note, work order, payment, or inventory transaction.

Canonical route and navigation:

- New route: `/customers/legacy-registration`
- New card: `既存顧客登録` under `/hub/customers`
- Use the current `MainLayout`; do not copy the prototype sidebar, header, or logo shell.

Approved steps:

1. 顧客
2. 車両
3. 過去履歴
4. 確認

OCR remains inside step 1. Every OCR value is operator-reviewable; empty values remain empty and are never guessed.

## Existing runtime to reuse

Do not rebuild the following authorities:

- Customer creation, server-side search, and duplicate candidates
- Vehicle creation and VIN/plate duplicate lookup
- Vehicle-registration upload, OCR, archive, audit session, and review UI
- Customer and vehicle OCR mappers
- Body-size recommendation logic
- Active dealer membership and capability resolution

The browser must not preload the full customer table. Search responses remain minimal server-composed references.

## Production corrections to the design archive

- Supported upload display follows the current runtime: JPEG, PNG, WebP, HEIC, HEIF, PDF, maximum 20 MB.
- Dimension confidence below `0.8`, or missing confidence, requires visual confirmation.
- Body colour always requires operator confirmation.
- Furigana is a search aid. Require a non-empty value at intake but do not reject non-katakana text. Do not invent a surname/given-name split.
- Corporate customers persist with the canonical business flag; occupation text is not a substitute.
- Structured address fields are confirmed by the operator; no guessed address splitting.
- Duplicate candidates are never auto-merged or overwritten.
- Identical normalized VIN or plate cannot be forced through as a separate vehicle.
- The prototype state-switching panel is development-only and must not ship.

## Historical service data

Do not reuse `completion_reports` or `maintenance_reminders`. Create a dedicated `public.vehicle_service_history` table with:

- `id uuid primary key`
- `dealer_id uuid not null`
- `vehicle_id uuid not null`
- `customer_id uuid null`
- `category text not null`
- `performed_on date not null`
- `service_name text not null`
- `notes text null`
- `source text not null default 'legacy_manual'`
- `source_ocr_session_id uuid null`
- `created_by uuid not null`
- `created_at timestamptz not null`
- `updated_at timestamptz not null`
- `archived_at timestamptz null`

V1 categories are exactly:

- `coating`
- `maintenance`
- `car_wash`
- `ppf`
- `window_film`
- `room_cleaning`
- `other`

The UI renders their approved Japanese labels. `performed_on` cannot be in the future. `service_name` is 1-200 characters and `notes` is at most 2000 characters. Require an index on `(dealer_id, vehicle_id, performed_on desc)` and tenant-bound foreign-key integrity.

V1 supports registration and readback. Post-save edit/delete UI is deferred; later correction uses auditable archive semantics.

## Durable idempotency receipt

The Owner approved a dedicated immutable receipt because a valid registration can contain zero historical-service rows. History rows therefore cannot serve as the durable idempotency anchor.

Create `public.legacy_customer_registration_receipts` with the following minimum contract:

- `id uuid primary key default gen_random_uuid()`
- `dealer_id uuid not null`
- `idempotency_key text not null`
- `payload_fingerprint text not null`
- `customer_id uuid not null`
- `vehicle_id uuid not null`
- `created_by uuid not null`
- `created_at timestamptz not null default now()`
- a unique constraint on `(dealer_id, idempotency_key)`
- foreign keys bound to the canonical dealer, customer, vehicle, and Auth-user identities verified in the target schema
- a bounded, non-blank idempotency key and a lowercase 64-character SHA-256 fingerprint check

The receipt is append-only in V1. Neither `anon` nor browser-authenticated callers receive direct UPDATE or DELETE authority. A same-dealer replay with the same key and the same canonical payload fingerprint returns the originally resolved `customer_id` and `vehicle_id` and creates nothing. Reusing the same key with a different fingerprint fails closed with a stable sanitized conflict code. A key is never shared across dealers.

The fingerprint must be calculated server-side from the validated canonical registration payload. It must not contain raw PII in logs or error messages.

## Atomic save contract

The final confirmation calls one idempotent server-owned transaction/RPC. It must:

1. Resolve `auth.uid()`, one active dealer membership, and the required staff capability.
2. Derive `dealer_id` and actor server-side.
3. Canonicalize the validated payload and calculate its server-owned SHA-256 fingerprint.
4. Lock or reserve one `(dealer_id, idempotency_key)` receipt identity.
5. If an existing receipt has the same fingerprint, return its original customer and vehicle IDs without writing anything; if the fingerprint differs, fail closed.
6. Select or create the customer.
7. Select or create the vehicle.
8. Insert zero or more history records.
9. Insert the immutable receipt with the resolved IDs and actor.
10. Commit only if every required operation succeeds.

Supported combinations:

- new customer + new vehicle + optional history
- existing customer + new vehicle + optional history
- existing customer + existing vehicle + optional history

Any failure rolls back the full transaction. A repeated idempotency key returns the same result and creates no duplicate records. Client-supplied dealer, role, capability, or audit actor is never authoritative.

## Supabase security boundary

- Enable RLS on every new exposed table.
- Authentication alone is not tenant authorization.
- Policies must bind rows to the caller's active dealer membership.
- UPDATE policies require both `USING` and `WITH CHECK`.
- Data API grants and RLS are separate; declare required grants explicitly.
- Never expose a service-role or secret key to the browser.
- V1 selects an invoker-rights function. It must rely on explicit table grants plus tenant-bound RLS; authenticated role membership alone is insufficient authorization.
- Revoke every automatic `anon` and `authenticated` table grant first, then grant back only the operations required by the accepted transaction design.
- Revoke `PUBLIC` execution on every new function and grant execution only to the intended authenticated role.
- If a later diagnosis proves invoker rights cannot implement the atomic contract safely, stop with `OWNER_DECISION_REQUIRED`; do not silently replace it with a privileged function.
- Return stable sanitized error codes; never return raw SQL errors or log PII.

## Separate estimates-list cleanup

In a later separate implementation commit:

- Keep `+ 新規見積`.
- Remove the duplicate `顧客・車両登録` action from `/estimates`.
- Remove the legacy `GYEON見積作成` action from `/estimates`.
- Do not change the accepted new-estimate production wizard.

## Implementation phase split

1. Read-only diagnosis and exact source/migration/test allowlist.
2. Gate B0: use the Supabase CLI only to generate the exact migration path; record that path before any SQL is authored.
3. Gate B1: after renewed separate Owner authorization, implement only `supabase/migrations/20260915063440_legacy_customer_registration.sql`, `supabase/tests/legacy_customer_registration_rls_test.sql`, and `src/lib/customers/legacy-registration/legacy-registration-migration-contract.test.ts` as an unstaged, uncommitted candidate. The RLS-test path is the literal output of Supabase CLI `2.116.0`, not a hand-invented filename.
4. Server action/RPC binding.
5. Responsive UI binding under current `MainLayout`.
6. Separate estimates-list cleanup.
7. Independent verification.
8. Separate commit, push, Preview, migration-apply, merge, and production gates.

No source, migration, database, environment, or deployment work is authorized by this contract file alone.
