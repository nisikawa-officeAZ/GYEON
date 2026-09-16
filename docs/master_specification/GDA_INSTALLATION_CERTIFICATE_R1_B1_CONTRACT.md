# GDA Installation Certificate R1-B1 — Source Projection and Adapter Contract

| Field | Value |
|---|---|
| Phase | `GDA_INSTALLATION_CERTIFICATE_R1_B1` |
| Marker | `GDA_INSTALLATION_CERTIFICATE_R1_B1_CONTRACT_V1` |
| Status | **OWNER_APPROVED — IMPLEMENTATION_REQUIRES_SEPARATE_AUTHORIZATION** |
| Date | 2026-09-16 |
| Owner | Office AZ / Product Owner |
| Responsible agent | MacBook Codex |
| Repository | `nisikawa-officeAZ/GYEON` |
| Parent decision | `GDA_INSTALLATION_CERTIFICATE_R1_A2_OWNER_SCOPE_FINAL_V1` |

## 0. Authority boundary

This document fixes the R1-B1 data contract and a literal future implementation allowlist. Creating this document does not authorize application source edits, tests that create artifacts, migrations, Supabase or Storage mutation, certificate issuance, commit, push, PR mutation, Ready conversion, merge, or deployment.

R1-B1 is a source-and-test phase only. It must not implement serial allocation, issuance persistence, immutable snapshots, PDF Storage, rendering routes, UI, reprints, revisions, QR verification, warranty rules, or purchase-linked issuance credits.

## 1. Outcome

R1-B1 creates one fail-closed path from an authenticated, canonical completed work report to a monetary-free, non-warranty installation-certificate projection.

```text
genuine request actor
  -> getWorkReportSource(reportId)
  -> same-tenant non-monetary display enrichment
  -> pure R1 eligibility and projection
  -> InstallationCertificateR1Projection
```

The projection is not yet an issued certificate and is not yet `CertificateDocumentData`. R1-B2 will add the immutable issuance snapshot and server serial. R1-C1 will map the accepted snapshot into the neutral R1 PDF presentation contract.

## 2. Only accepted request input

The client may supply exactly one value:

```text
completionReportId
```

The client must not supply or override `dealer_id`, customer, vehicle, applied date, technician, performed-work rows, document class, certificate number, issue date, logo, warranty text, or storage path.

The server re-resolves the authenticated user and active dealer from the genuine cookie-backed request scope. A report ID grants no authority.

## 3. Canonical source contract

### 3.1 Required authority

`getWorkReportSource(reportId)` remains the single upstream authority. R1-B1 must call it once and must not copy or fork its tenant, canonical-report, completion, or confirmed-snapshot eligibility logic.

The following facts come only from its ready arm:

| R1 fact | Canonical source |
|---|---|
| report identity | canonical `completion_reports` row |
| work identity | same-tenant completed `work_orders` row |
| applied date | `work_orders.actual_end_at` |
| technician candidate | `work_orders.assigned_staff` |
| performed work | confirmed `completion_report_items` rows ordered by `sort_order` |
| customer binding | customer joined to the completed work order |
| vehicle binding | vehicle joined to the completed work order |

Estimate presence is optional. `estimate_items` are proposal data and are never a source or fallback for certificate contents.

### 3.2 Same-tenant display enrichment

After the shared ready result, the R1 loader may read only these non-monetary display columns through the request-scoped Supabase client and the already-proven `dealer_id` and work-order ID:

```text
customers:
  last_name, first_name, is_business

vehicles:
  maker, model, year, grade, vin, plate_number, color
```

No service-role client is permitted. Enrichment must remain dealer-scoped. A failed or incoherent enrichment result fails closed; it must not silently substitute estimate or client data.

### 3.3 Technician rule

R1-B1 uses the trimmed `work_orders.assigned_staff` value. If it is absent, the projection is not ready with `missing-technician`.

R1-B1 does not add a free-text technician override. A later UI may return the operator to the formal work-order correction flow or to a separately approved same-dealer staff-selection flow. The certificate screen itself must not invent or persist an unvalidated technician.

## 4. Pure input and output shapes

The pure contract must define a minimal `InstallationCertificateR1Source` with only:

```text
customer:
  lastName, firstName, isBusiness

vehicle:
  maker, model, year, grade, vin, plate, color

appliedAt
technicianName
items[]:
  category, itemName, description, sortOrder
```

The successful `InstallationCertificateR1Projection` must contain only:

```text
documentClass = "installation-certificate-r1"
customer:
  name, honorific
vehicle:
  name, maker?, model?, year?, grade?, vin?, plate?, color?
installation:
  appliedDate, technician
items[]:
  category, name, description?
```

The B1 projection deliberately contains no `serial`, `issueDate`, `dealerId`, logo URL, Storage path, database row ID, callout, terms, warranty section, QR data, or mutation command.

## 5. Deterministic mapping rules

1. Trim every string; blank optional values become absent, never fabricated placeholders.
2. Customer name is `[lastName, firstName]` joined with one space. A legacy whole name stored in `lastName` remains valid.
3. Customer honorific is `御中` only when `isBusiness === true`; otherwise it is `様`.
4. Vehicle name is `[maker, model]` joined with one space. At least one must be non-blank.
5. Applied date is derived from `actual_end_at` and formatted as a Japan-local calendar date. Client dates are prohibited.
6. Technician is the trimmed canonical technician value. No default such as `担当者` is allowed.
7. Performed-work rows preserve confirmed `sort_order`; equal order values preserve source order.
8. Every output row requires non-blank category and item name. R1-B1 rejects an invalid row rather than dropping or repairing it.
9. Item description may be carried only as customer-facing performed-work detail. It must never be replaced by estimate description, customer message, internal memo, or system-authored warranty prose.
10. CanCoat is not special-cased, rejected, or routed to the existing CanCoat template. A confirmed CanCoat work row is projected exactly like any other performed-work row into the common non-warranty R1 certificate.
11. No fuzzy SKU, category, or warranty inference is allowed in R1-B1.

## 6. Fail-closed result contract

The server loader result is a discriminated union:

```text
unauthenticated
invalid_request
not_found
not_eligible { reasons[] }
ok { projection }
```

Foreign and missing records both map to `not_found`; no ownership hint or row content may leak.

The loader preserves the shared work-report reason codes. The pure R1 projection adds these certificate-specific reasons in this fixed order:

```text
missing-customer-name
missing-vehicle-name
missing-applied-date
missing-technician
invalid-snapshot-item
```

All applicable R1 reasons are returned in deterministic order. No exception text, SQL error, UUID, foreign-tenant fact, or raw Supabase error is returned to the caller.

## 7. Structurally prohibited data

None of these fields may exist in the R1-B1 source or projection types:

```text
quantity
unit_price / unitPrice
subtotal
tax
discount
total
purchase_cost / cost
margin / gross_profit
payment
invoice
estimate_items / estimateItems
internal_memo / internalMemo
customer_message / customerMessage
service_summary / notes
callout
terms
filmWarranty
warranty period, coverage, exclusion, or promise
purchase grant or issuance credit
QR or public verification data
service_role key or privileged client
```

R1-B1 must not import the warranty-bearing sample fixtures or populate the current `CertificateDocumentData` callout, terms, or film-warranty fields.

## 8. CanCoat acceptance boundary

The required CanCoat case is:

```text
confirmed item:
  category = "coating"
  itemName = "Q² CanCoat EVO"

result:
  eligible common R1 projection
  documentClass = "installation-certificate-r1"
  item is retained in confirmed order
  no CanCoat-specific template selection
  no warranty wording, period, terms, callout, grant, or QR data
```

The same rule applies to CanCoat EVO PRO. CanCoat-specific warranty issuance remains R2.

## 9. Required tests

### 9.1 Pure contract tests

The pure test suite must prove:

1. valid completed-work source produces the exact projection;
2. individual and business honorifics are deterministic;
3. legacy full name in `lastName` remains valid;
4. vehicle requires maker or model;
5. Japan-local applied date is derived from the canonical instant;
6. technician is required and no placeholder is invented;
7. rows are stable-sorted by `sortOrder`;
8. any invalid row fails closed rather than being dropped;
9. CanCoat and CanCoat EVO PRO remain eligible common R1 items;
10. the serialized projection has no monetary, memo, warranty, grant, QR, dealer, or persistence field;
11. no estimate input can be represented by the type;
12. reason sets and reason order are exact.

### 9.2 Loader boundary tests

The loader tests must prove:

1. unauthenticated request stops before data projection;
2. blank report ID is `invalid_request`;
3. `getWorkReportSource` is called exactly once;
4. foreign and missing records are indistinguishable `not_found`;
5. shared not-ready reasons pass through without reinterpretation;
6. enrichment remains dealer- and work-order-scoped;
7. no `estimate_items`, priced columns, service-role client, Storage, mutation, or warranty source is read;
8. pure projection runs only after the shared source and enrichment are both valid;
9. raw errors are sanitized;
10. the loader performs no insert, update, upsert, delete, RPC, upload, or logging of row payloads.

Tests use `node:test` and `node:assert/strict`. Module-boundary mocks may use Node's experimental module-mock flag, matching the existing authenticated work-report route tests.

## 10. Literal future implementation allowlist

When the Owner separately authorizes R1-B1 implementation, the writable source/test allowlist is exactly:

```text
src/lib/certificates/installation-certificate-r1-contract.ts
src/lib/certificates/installation-certificate-r1-contract.test.ts
src/lib/certificates/get-installation-certificate-r1-source.ts
src/lib/certificates/get-installation-certificate-r1-source.test.ts
```

No existing source, template, UI, route, migration, generated type, lockfile, configuration, fixture, or package file is in the R1-B1 implementation allowlist.

The existing `getWorkReportSource` and Brand Profile modules are dependencies only and must not be modified in R1-B1.

## 11. Protected paths

These remain hash-only and must not be opened, diffed, copied, staged, or modified:

```text
100644 c1eb0dc88954f3a17cc85e313b62d5bb6a4fda3f src/components/estimates/wizard/screens/ScreensPreview.tsx
100644 accd22345054cc44f89156fd78eaba6dfe4242a4 supabase/migrations/20260801110110_line_link_tokens.sql
100644 32fda49583ae1217bc13711784ad8fa31744726c supabase/migrations/20260807135006_monthly_invoice_pdf_artifact.sql
100644 fe3c80f22fd80dcbfab076082473216dda582c14 src/lib/monthly-statements/monthly-invoice-artifact-boundary.test.ts
```

## 12. Verification gate for the later implementation

The R1-B1 implementation result is acceptable only when all of the following pass:

```text
node --import tsx --test \
  src/lib/certificates/installation-certificate-r1-contract.test.ts \
  src/lib/certificates/get-installation-certificate-r1-source.test.ts

npx tsc --noEmit
git diff --check
```

Verification must additionally report the exact branch, HEAD, base commit, tree, status, changed paths, staged paths, file modes, and protected metadata. Commit, push, PR creation, Ready conversion, merge, Supabase apply, Storage change, and deployment remain separate approvals.

## 13. Next gate

Owner approval of this R1-B1 contract authorizes only a later, separately requested implementation inside the four-path allowlist. It does not authorize R1-B2 persistence or R1-C1 PDF work.
