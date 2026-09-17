# GDA Installation Certificate R1-B2 — Issuance Authority Contract

| Field | Value |
|---|---|
| Phase | `GDA_INSTALLATION_CERTIFICATE_R1_B2` |
| Marker | `GDA_INSTALLATION_CERTIFICATE_R1_B2_CONTRACT_V1` |
| Status | **OWNER_APPROVED — IMPLEMENTATION_REQUIRES_SEPARATE_AUTHORIZATION** |
| Date | 2026-09-16 |
| Owner | Office AZ / Product Owner |
| Responsible agent | MacBook Codex |
| Repository | `nisikawa-officeAZ/GYEON` |
| Parent contract | `GDA_INSTALLATION_CERTIFICATE_R1_B1_CONTRACT_V1` |

## 0. Authority boundary

This document fixes the proposed R1-B2 database and issuance contract only. Creating or approving this document does not by itself authorize a migration, application source edit, database apply, Storage mutation, certificate issuance, commit, push, PR mutation, Ready conversion, merge, deployment, or production access.

R1-B2 is limited to:

- authenticated issuance authority;
- immutable issuance snapshot;
- per-dealer certificate numbering;
- idempotency and duplicate prevention;
- RLS, grants, and raw-write denial;
- private PDF artifact metadata schema for the later R1-C1 phase;
- append-only issuance audit evidence.

R1-B2 must not render or upload a PDF, create UI, add a public route, issue a warranty, consume a product-purchase credit, create a QR verification token, or expose a public certificate lookup.

## 1. Outcome

R1-B2 creates one atomic, fail-closed issuance operation for the common, non-warranty R1 installation certificate.

```text
authenticated editing staff
  -> issueInstallationCertificateR1(completionReportId, idempotencyKey)
  -> public.issue_installation_certificate_r1_v1(...)
  -> database re-proves tenant, actor, completion, canonical report and items
  -> database rebuilds the R1 projection and issuer text snapshot
  -> database allocates one certificate number
  -> immutable issuance + idempotency request + audit event commit together
  -> R1-C1 later renders and stores the one canonical private PDF
```

The R1-B1 TypeScript loader remains the preview and early-validation path. It is not the final mutation authority. A direct RPC caller must not be able to bypass the same canonical checks.

## 2. Scope boundary

### 2.1 Included

- exactly one initial R1 installation certificate per canonical completion report;
- individual and business customers;
- confirmed CanCoat work as an ordinary common R1 installation item;
- owner, manager, or staff issuance when the relationship is active and unambiguous;
- same-key replay with the same result and no additional writes;
- different-key duplicate detection for an already-issued completion report;
- immutable R1 source and issuer text snapshot;
- a private-document metadata table that R1-C1 may populate once;
- exact audit evidence for issuance and later document events.

### 2.2 Excluded

- warranty period, warranty coverage, exclusions, warranty terms, or warranty promises;
- CanCoat-specific warranty certificates;
- purchase grants, issuance credits, inventory, or SKU inference;
- void, cancellation, correction, supersession, or revision workflow;
- QR or public verification;
- PDF rendering, upload, preview, download route, or UI;
- email, LINE, notification, analytics, invoice, payment, or accounting side effects;
- service-role application clients.

Corrections, voids, and warranty issuance remain separate R2 or later gates. R1-B2 must not pre-authorize them through unused status flags or generic mutation endpoints.

## 3. Accepted client input

The client-facing Server Action accepts exactly:

```text
completionReportId: UUID
idempotencyKey: string
```

The database RPC signature is exactly:

```text
public.issue_installation_certificate_r1_v1(
  p_completion_report_id uuid,
  p_idempotency_key text
)
```

The client must not supply or override:

```text
dealer_id
work_order_id
customer or vehicle data
performed-work items
technician
installation date
issuer/store data
document class
certificate number
issue date or issued_at
source or request fingerprint
snapshot JSON
logo URL or Storage path
PDF path or hash
warranty, grant, QR, status, revision, or audit data
```

The Server Action uses the genuine request-scoped authenticated client and performs an early `requireStaffCapability("edit")` gate. The database independently derives `auth.uid()` and revalidates the exact dealer relationship and canonical source. The action gate never substitutes for database authorization.

## 4. Database authority

### 4.1 Canonical facts

The RPC reconstructs the R1 source only from:

- canonical `completion_reports`;
- its same-dealer completed `work_orders` row;
- its confirmed `completion_report_items`, ordered by `sort_order` and stable row order;
- the customer and vehicle bound to that work order;
- the authenticated actor's active same-dealer relationship;
- same-dealer `dealer_settings` for issuer text and the presence or absence of a configured logo.

Estimate rows, client projection JSON, sample certificate fixtures, and warranty-bearing certificate templates are never authoritative inputs.

### 4.2 Eligibility revalidation

The RPC must fail before any write unless all of these are true:

1. `auth.uid()` is non-null.
2. The idempotency key is trimmed, 16-128 printable ASCII characters, and contains no whitespace or control characters.
3. The completion report exists, is canonical, belongs to exactly one dealer, and is not deleted.
4. The joined work order belongs to the same dealer and has `status = 'completed'`.
5. The work order has a valid `actual_end_at` and a non-blank canonical technician.
6. The report has `performed_work_confirmed_at` and a confirming actor.
7. At least one confirmed item exists; every item has a valid category, name, description, and deterministic order.
8. The bound customer has a non-blank canonical display name.
9. The bound vehicle has a non-blank maker or model.
10. The authenticated actor is an active, unambiguous owner, manager, or staff member of that exact dealer.

Foreign, missing, deleted, or relationship-free sources return the same coarse `not_found` result. Read-only, invited, disabled, unknown, duplicate, or ambiguous staff state returns `permission_denied` without falling back to a weaker relation.

### 4.3 Lock and transaction order

The RPC uses one database transaction and this deterministic lock order:

1. resolve `auth.uid()`;
2. locate the candidate source without leaking tenant ownership;
3. lock the canonical work-order row;
4. lock the canonical completion-report row;
5. validate actor, source, report items, customer, vehicle, and issuer fields;
6. inspect the `(dealer_id, idempotency_key)` request arbiter;
7. inspect the `(dealer_id, completion_report_id, document_class)` issuance arbiter;
8. allocate the sequence row through the existing private atomic allocator;
9. insert issuance, request, and audit rows;
10. commit all writes together.

A unique-violation handler may resolve a concurrent same-source or same-key race only inside a subtransaction that rolls back the failed allocation and all partial writes first. No error path may leave a consumed sequence number, orphan request, or partial issuance row.

## 5. Numbering contract

The proposed R1 number format is:

```text
CRT/IN/YYYY/NNNNN
example: CRT/IN/2026/00001
```

Rules:

- sequence type: `installation_certificate_r1`;
- prefix: `CRT/IN`;
- padding: `5`;
- calendar/reset: yearly, using the `Asia/Tokyo` issue date;
- scope: per dealer and year;
- allocation: existing `private.allocate_next_document_number_v1` only;
- formatting: a certificate-specific deterministic formatter because the current generic formatter produces hyphen-separated document numbers;
- the client cannot configure or submit the prefix, year, or next number;
- a committed number is never reused;
- a rolled-back transaction does not consume a number;
- reprint returns the original number and performs no allocation.

This format is intentionally distinct from future warranty-specific `CRT/CO`, `CRT/PPF`, and `CRT/CC` families.

## 6. Immutable issuance snapshot

### 6.1 Snapshot shape

`certificate_issuances.snapshot` contains exactly this versioned structure:

```text
{
  schemaVersion: 1,
  documentClass: "installation-certificate-r1",
  certificateNumber: "CRT/IN/2026/00001",
  issueDate: "2026-09-16",
  customer: {
    name: string,
    honorific: "様" | "御中"
  },
  vehicle: {
    name: string,
    maker?: string,
    model?: string,
    year?: string,
    grade?: string,
    vin?: string,
    plate?: string,
    color?: string
  },
  installation: {
    appliedDate: "YYYY-MM-DD",
    technician: string
  },
  items: [{
    category: string,
    name: string,
    description?: string
  }],
  issuer: {
    displayName: string,
    companyName?: string,
    postalCode?: string,
    address?: string,
    tel?: string,
    email?: string,
    website?: string,
    invoiceRegistrationNumber?: string,
    detailerRank?: string,
    logoMode: "dealer" | "da-default"
  }
}
```

### 6.2 Issuer rule

- `displayName` is the trimmed `business_name`, falling back to trimmed `company_name`.
- `companyName` is retained only when configured and distinct from `displayName`.
- remaining issuer text comes from the same dealer's settings and blank values are omitted.
- `logoMode = 'dealer'` only when the server-authoritative dealer settings contain a configured dealer logo; otherwise it is `da-default`.
- R1-B2 stores no client logo URL, public URL, data URI, image bytes, or external asset URL.
- R1-C1 resolves the selected logo once while generating the canonical PDF, stores the PDF privately, records its SHA-256, and never silently regenerates a missing or mismatched canonical artifact from newer branding.

This division keeps the issuance snapshot small while ensuring that an already stored PDF never changes after dealer settings change.

### 6.3 Prohibited snapshot data

The snapshot must structurally exclude:

```text
quantity, unit price, subtotal, tax, discount, total
cost, margin, payment, invoice, estimate lines
internal memo, customer message, service summary, notes
warranty wording, period, coverage, terms, exclusions
purchase grant, issuance credit, SKU inference
QR, public token, public URL
raw dealer_id, user UUID, Storage path, database error
```

## 7. Fingerprints and idempotency

### 7.1 Request fingerprint

The request fingerprint is SHA-256 of one exact UTF-8 canonical string:

```text
{"contractVersion":1,"documentClass":"installation-certificate-r1","completionReportId":"<uuid>"}
```

The idempotency key is not part of this fingerprint. Reusing one key with the same canonical request is a replay; reusing it with a different request is a conflict.

### 7.2 Source fingerprint

The source fingerprint is SHA-256 of the exact canonical JSON for the B1 projection plus the issuer object, excluding `certificateNumber` and `issueDate`. It proves the business facts fixed at issuance without treating server allocation metadata as a source fact.

The PostgreSQL and TypeScript canonical builders must have byte-identical escaping, explicit key order, explicit optional-field rules, and shared test vectors. Neither side may hash `jsonb::text` or an implementation-dependent object serialization.

### 7.3 Outcomes

| Situation | Outcome | Writes |
|---|---|---|
| first valid request | `created` | one issuance, one request, one audit event, one sequence allocation |
| same key + same request | `replayed` | zero |
| same key + different request | `idempotency_conflict` | zero |
| different key + source already issued | `already_issued` | zero; return the existing issuance identity |
| concurrent same source | one `created`; others `already_issued` or matching replay | loser writes roll back |
| validation/auth failure | sanitized failure | zero |

An already-issued source never creates a second R1 certificate merely because its customer, vehicle, technician, item, or store master later changes.

## 8. Logical schema

### 8.1 `public.certificate_issuances`

Required columns:

```text
id uuid primary key
dealer_id uuid not null
completion_report_id uuid not null
work_order_id uuid not null
document_class text not null check = 'installation-certificate-r1'
certificate_number text not null
source_contract_version smallint not null check = 1
source_fingerprint text not null check = 64 lowercase hex
snapshot jsonb not null
issued_on date not null
issued_at timestamptz not null
issued_by uuid not null
created_at timestamptz not null
```

Required uniqueness:

```text
unique (dealer_id, certificate_number)
unique (dealer_id, completion_report_id, document_class)
```

No update or delete path exists in R1. A trigger rejects raw insert, update, and delete unless the transaction-local R1 issuance authority marker is present.

### 8.2 `public.certificate_issuance_requests`

Required columns:

```text
id uuid primary key
dealer_id uuid not null
idempotency_key text not null
request_fingerprint text not null check = 64 lowercase hex
completion_report_id uuid not null
issuance_id uuid not null
actor_user_id uuid not null
outcome text not null check = 'created'
created_at timestamptz not null
```

Required uniqueness:

```text
unique (dealer_id, idempotency_key)
```

This is the immutable request arbiter. It is not an application-editable business table.

### 8.3 `public.certificate_documents`

R1-B2 creates the metadata boundary only. R1-C1 is separately authorized to populate it after a successful private Storage upload.

Required columns:

```text
id uuid primary key
dealer_id uuid not null
issuance_id uuid not null
revision integer not null check = 1
storage_bucket text not null
storage_path text not null
mime_type text not null check = 'application/pdf'
byte_size bigint not null check > 0
sha256 text not null check = 64 lowercase hex
template_version text not null
generated_at timestamptz not null
generated_by uuid not null
created_at timestamptz not null
```

Required uniqueness:

```text
unique (issuance_id, revision)
unique (storage_bucket, storage_path)
```

The canonical R1 document is revision `1`. Reprint reads the stored object and metadata; it does not create another document row or overwrite the object. Missing bytes or a hash mismatch is an integrity failure, never an instruction to regenerate silently from live data.

### 8.4 `public.certificate_audit_events`

Required columns:

```text
id uuid primary key
dealer_id uuid not null
issuance_id uuid not null
event_type text not null
actor_user_id uuid not null
event_data jsonb not null default '{}'
occurred_at timestamptz not null
```

R1 event types are initially limited to:

```text
issued
document_stored
reprinted
```

R1-B2 writes only `issued`. R1-C1 and R1-D1 may use the other values only after separate approval. Audit rows are append-only and must contain no customer data, raw errors, signed URLs, or PDF bytes.

## 9. RLS, grants, and function security

### 9.1 Table policy

All four tables enable and force RLS.

- active same-dealer owner, manager, staff, and readonly users may select `certificate_issuances` and `certificate_documents` only for their dealer;
- `certificate_issuance_requests` has no application table grant;
- `certificate_audit_events` is selectable only by active same-dealer owner or manager in R1;
- no runtime role receives table `INSERT`, `UPDATE`, or `DELETE` on any of the four tables;
- service-role application use is prohibited; migrations/tests may not loosen this contract.

RLS and table grants are both explicit. RLS is not treated as a substitute for grants, and grants are not treated as a substitute for RLS.

### 9.2 Function policy

- pure private validators, canonical builders, fingerprint helpers, and the existing private sequence allocator are `SECURITY INVOKER` and unreachable by runtime roles;
- the public issuance RPC is `SECURITY DEFINER` only because it performs authorized writes to otherwise non-writable tables;
- every function uses `SET search_path = ''` and fully schema-qualified references;
- no dynamic SQL;
- `PUBLIC`, `anon`, and `service_role` execute are revoked;
- only `authenticated` receives execute on the one public issuance RPC;
- all helper and trigger functions explicitly revoke execute from runtime roles;
- identity is always `auth.uid()`, never a caller argument.

### 9.3 Storage boundary

R1-B2 creates no bucket and uploads no object. R1-C1 must use a private bucket, server-generated dealer/issuance path, no overwrite, exact MIME and byte limits, same-dealer access, and short-lived authenticated download responses. A public bucket or permanent public URL is prohibited.

## 10. Result and error contract

The Server Action returns a discriminated union with only sanitized values:

```text
unauthenticated
invalid_request
not_found
permission_denied
not_eligible { reasons[] }
idempotency_conflict
already_issued { issuanceId, certificateNumber, issuedOn }
ok {
  issuanceId,
  certificateNumber,
  issuedOn,
  sourceFingerprint,
  created,
  replayed
}
unavailable
```

The action maps known database codes to these outcomes. It must not return exception text, SQLSTATE, table names, UUIDs from foreign rows, raw Supabase errors, stack traces, or tenant-existence hints.

## 11. Raw-write and immutability rules

1. Only the R1 issuance RPC may create an issuance, request, or `issued` audit event.
2. Only the later approved R1-C1 document-finalization operation may create revision-1 document metadata and its `document_stored` event.
3. No application operation updates or deletes issuance, request, document, or audit rows in R1.
4. No Storage object is overwritten.
5. Reprint reads the exact stored bytes, verifies metadata/hash as defined in R1-C1, and records only a minimal audit event.
6. Customer, vehicle, work, item, user, or dealer-setting changes never rewrite an existing snapshot.
7. Source drift after issuance is informational only; R1 does not issue a replacement automatically.
8. A correction or replacement needs a new, separately approved revision/supersession contract.

## 12. Required implementation tests

### 12.1 Static and pure tests

1. exact RPC signature and authenticated-only execute grant;
2. exact table columns, checks, foreign keys, uniqueness, RLS, and grants;
3. raw insert/update/delete blocked for authenticated users;
4. helper execute privileges revoked;
5. client input cannot represent dealer, snapshot, serial, dates, issuer, warranty, QR, or document metadata;
6. TS and PostgreSQL request/source canonical strings and SHA-256 match exact shared vectors;
7. issuer normalization and `logoMode` rules are exact;
8. no monetary, memo, warranty, credit, QR, service-role, PDF, Storage, email, or notification operation exists;
9. all returned errors are sanitized.

### 12.2 Disposable PostgreSQL verification

The later R1-V1 gate must use a fresh disposable PostgreSQL/Supabase runtime and prove:

1. unauthenticated denial;
2. cross-dealer non-disclosure and denial;
3. readonly/inactive/invited/ambiguous denial;
4. active owner/manager/staff success;
5. incomplete, unconfirmed, empty, deleted, or incoherent source rejection;
6. CanCoat source success as a common non-warranty certificate;
7. exact Japan-local issue date and yearly per-dealer numbering;
8. same-key sequential replay with zero writes;
9. same-key different-request conflict with zero writes;
10. different-key same-source `already_issued` with zero writes;
11. two genuinely separate database connections racing the same key;
12. two genuinely separate database connections racing different keys on the same source;
13. exactly one committed issuance, request, audit event, and sequence advancement;
14. forced failure after allocation rolls the sequence and all rows back;
15. direct table DML and helper RPC calls fail;
16. source/master changes do not mutate the existing snapshot;
17. no certificate document row exists before the R1-C1 finalization path runs.

Source-only mocks are not acceptance evidence for concurrency, RLS, grants, rollback, or sequence behavior.

## 13. Future implementation gates and allowlists

### 13.1 R1-B2-G0 — CLI path generation only

Before SQL or DB tests are authored, a separately approved G0 phase must run the Supabase CLI generators and report the exact generated paths:

```text
supabase migration new installation_certificate_r1_issuance
supabase test new installation_certificate_r1_issuance
```

G0 may create only those two generated empty files. It may not edit them, apply them, or create any other file. The generated timestamp/path must not be invented in this contract.

### 13.2 R1-B2-G1 — implementation

After Owner approval of the G0 paths, the literal G1 writable allowlist is:

```text
<G0-generated migration path>
<G0-generated database test path>
src/lib/certificates/installation-certificate-r1-issuance-contract.ts
src/lib/certificates/installation-certificate-r1-issuance-contract.test.ts
src/lib/certificates/issue-installation-certificate-r1.ts
src/lib/certificates/issue-installation-certificate-r1.test.ts
```

No existing migration, generated type, PDF template, route, UI, Storage module, configuration, package, fixture, or lockfile is in the R1-B2-G1 allowlist.

R1-B2-G1 stops after source verification and a clean diff report. Commit, push, PR, Ready, merge, DB apply, and deployment remain separate approvals.

## 14. Protected paths

These remain hash-only and must not be opened, diffed, copied, staged, or modified:

```text
100644 c1eb0dc88954f3a17cc85e313b62d5bb6a4fda3f src/components/estimates/wizard/screens/ScreensPreview.tsx
100644 accd22345054cc44f89156fd78eaba6dfe4242a4 supabase/migrations/20260801110110_line_link_tokens.sql
100644 32fda49583ae1217bc13711784ad8fa31744726c supabase/migrations/20260807135006_monthly_invoice_pdf_artifact.sql
100644 fe3c80f22fd80dcbfab076082473216dda582c14 src/lib/monthly-statements/monthly-invoice-artifact-boundary.test.ts
```

## 15. Owner decisions

On 2026-09-16, the Owner explicitly approved this R1-B2 contract and all three decisions:

1. common non-warranty R1 number format is `CRT/IN/YYYY/NNNNN`;
2. one canonical completion report may have exactly one initial R1 installation certificate;
3. issuer text and `logoMode` are fixed at issuance, while exact PDF/logo bytes become immutable only when R1-C1 stores the canonical private PDF and SHA-256.

## 16. Next gate

The next independent gate is R1-B2-G0, limited to generating and reporting the exact empty Supabase migration and database-test paths. Contract approval does not authorize G0, SQL implementation, database apply, commit, push, PR mutation, Ready conversion, merge, or deployment.
