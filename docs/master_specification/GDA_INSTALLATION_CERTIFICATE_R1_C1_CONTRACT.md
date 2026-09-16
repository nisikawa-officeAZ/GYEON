# GDA Installation Certificate R1-C1 — Canonical Private PDF Contract

| Field | Value |
|---|---|
| Phase | `GDA_INSTALLATION_CERTIFICATE_R1_C1` |
| Marker | `GDA_INSTALLATION_CERTIFICATE_R1_C1_CONTRACT_V1` |
| Status | **OWNER_AUTHORIZED_LOCAL_GOVERNANCE_CANDIDATE — SOURCE IMPLEMENTATION WAITS FOR GOVERNANCE DELIVERY** |
| Date | 2026-09-16 |
| Owner | Office AZ / Product Owner |
| Responsible agent | MacBook Codex |
| Repository | `nisikawa-officeAZ/GYEON` |
| Fixed base commit | `5571d11d088f2e70cdbeff15aa2bdc7ee47be3e9` |
| Fixed base tree | `0731cc66057c291b4039e9d5fc8702cbf039f935` |
| Parent contract | `GDA_INSTALLATION_CERTIFICATE_R1_B2_CONTRACT_V1` |

## 0. Authority boundary

The Owner authorized moving from the completed R1-B2 production database phase into R1-C1. This
document fixes the smallest safe R1-C1 implementation sequence and literal future write allowlists.
It is currently a local governance candidate only.

Application source, tests, generated migration/test files, Supabase, Storage, certificate issuance,
PDF upload, commit, push, PR mutation, Ready conversion, merge, deployment, and production access
remain unauthorized until the applicable gate below is separately delivered and approved.

The nine pre-existing modified PNG files under
`docs/estimate-wizard/archive/ver2.1/genspark-ui/package/**` are unrelated environment/LFS state.
They must not be edited, restored, staged, or included in any R1-C1 diff.

## 1. Outcome

R1-C1 creates exactly one immutable, private, non-warranty PDF for an already-issued
`installation-certificate-r1` snapshot.

```text
authenticated editing staff
  -> read one same-dealer immutable certificate_issuances snapshot
  -> resolve the issuance-time logo mode without accepting a client logo
  -> render one monetary-free, non-warranty A4 PDF
  -> SHA-256 the exact bytes
  -> upload once to the private documents bucket with upsert:false
  -> finalize certificate_documents revision 1 plus document_stored audit atomically
  -> later authenticated reads return the exact stored bytes only
```

R1-C1 does not add the operator UI. Preview, explicit issuance confirmation, history, and reprint
controls belong to R1-D1. R1-C1 may expose only the server action and authenticated stored-document
route that R1-D1 will call.

## 2. Canonical input and snapshot boundary

The render path accepts one server-read `certificate_issuances` row. The client may identify only
the issuance UUID. It cannot supply or override dealer, certificate number, dates, customer,
vehicle, technician, items, issuer, logo, MIME type, byte size, hash, template version, Storage
bucket, Storage path, document id, generated actor, or audit data.

The snapshot must pass the exact R1 schema-version-1 validator before rendering. Unknown keys,
missing required values, malformed dates, an unsupported document class, an empty item list, or any
monetary, memo, warranty, purchase-credit, QR, public-link, or persistence field fail closed.

Source/customer/dealer changes after issuance never alter the snapshot or an existing PDF.

## 3. Neutral PDF presentation contract

The R1 PDF is a common installation-fact certificate, not a product warranty certificate.

Required visible content:

- title `施工証明書` and English subtitle `INSTALLATION CERTIFICATE`;
- server-issued number and issue date;
- customer name and the snapshot honorific;
- vehicle name and only the optional vehicle fields present in the snapshot;
- installation date and technician;
- confirmed performed-work items in snapshot order;
- issuer text frozen in the snapshot;
- one short neutral sentence confirming that the listed work was performed.

Prohibited visible or hidden content:

- price, quantity, tax, discount, total, cost, margin, payment, invoice, or estimate lines;
- internal memo, customer message, service summary, or operational notes;
- warranty name, warranty period, coverage, exclusions, terms, promise, or eligibility;
- Infinity Warranty, PPF manufacturer warranty, CanCoat warranty, purchase grant, issuance credit;
- QR code, public verification token, public URL, or remote runtime asset.

CanCoat and CanCoat EVO PRO remain ordinary performed-work rows in the same common R1 document.
The existing coating/PPF/CanCoat warranty-bearing templates and sample fixtures are read-only
references and must not be imported by the R1 renderer.

## 4. Branding and offline rendering

The issuance snapshot's `issuer.logoMode` is authoritative:

- `dealer`: resolve the same dealer's configured private branding bytes at generation time;
- `da-default`: use the vendored DETAILER AGENT fallback asset;
- if `dealer` was frozen but the expected private dealer logo cannot be resolved, fail closed;
- never fetch an `http:` or `https:` logo while rendering;
- never accept a logo URL, data URI, or image bytes from the client.

The generated PDF stores the selected logo bytes permanently inside the document. A later branding
change must not regenerate or replace the canonical artifact.

The renderer must use the existing local CJK font registration and produce A4 portrait output.
R1-C1 creates a new narrow document component whose props cannot represent warranty or money. It
must not widen `CertificateDocumentData` or repurpose the three existing warranty templates.

## 5. Private Storage and object identity

- Bucket: existing private `documents` bucket only.
- MIME: exactly `application/pdf`.
- Upload: service-side, `upsert:false`; overwrite is prohibited.
- Object key:
  `<dealer_uuid>/certificates/installation-r1/<issuance_uuid>/<document_uuid>.pdf`.
- `dealer_uuid`, `issuance_uuid`, and `document_uuid` must be canonical lowercase UUIDs.
- The document UUID and object key are generated server-side.
- Byte size must be greater than zero and within a fixed implementation constant.
- SHA-256 is computed from the exact uploaded buffer and stored as lowercase hexadecimal.
- No public bucket, public URL, permanent signed URL, or client-selected path is permitted.

Existing authenticated `documents` bucket policies are not the write authority for canonical
certificate generation. The server-side finalization path must independently prove dealer, actor,
issuance, object identity, MIME, size, and revision.

## 6. Finalization RPC

R1-C1 adds one server-only finalization RPC, callable only by `service_role` after request-scope
authentication and authorization have succeeded:

```text
public.finalize_installation_certificate_r1_document_v1(
  p_dealer_id uuid,
  p_issuance_id uuid,
  p_document_id uuid,
  p_storage_bucket text,
  p_storage_path text,
  p_mime_type text,
  p_byte_size bigint,
  p_sha256 text,
  p_template_version text,
  p_actor_user_id uuid
)
```

The RPC must:

1. use `SECURITY DEFINER`, `SET search_path = ''`, fully qualified references, and no dynamic SQL;
2. revoke execution from `PUBLIC`, `anon`, and `authenticated`, granting only `service_role`;
3. lock the issuance and existing-document arbiter in a deterministic order;
4. require the exact dealer, document class, revision 1, canonical object key, bucket, MIME, size,
   hash, and template version;
5. revalidate that the supplied actor is an active, unambiguous same-dealer owner, manager, or
   staff member;
6. verify the matching private Storage object row exists with the expected bucket, path, MIME, and
   size before database finalization;
7. insert exactly one immutable `certificate_documents` row and one minimal `document_stored`
   audit event in one transaction;
8. return the already-stored identical document on exact replay without another insert/event;
9. return a stable conflict for a different document, hash, path, or metadata;
10. activate the existing immutable-table trigger authority only inside the function and clear it
    before every return.

### 6.1 Immutable-table authority separation

The G1 migration must not extend the existing single boolean authority check so that both RPC
authority tokens can insert into every immutable R1 table. It must replace the guard with a
table-aware and row-aware decision that enforces this exact matrix:

| transaction-local authority token | permitted immutable insert |
| --- | --- |
| `issue_installation_certificate_r1_v1` | `certificate_issuances`; `certificate_issuance_requests`; `certificate_audit_events` only when `event_type = 'issued'` |
| `finalize_installation_certificate_r1_document_v1` | `certificate_documents`; `certificate_audit_events` only when `event_type = 'document_stored'` |

All other table, operation, authority-token, and audit-event combinations must fail closed.
`UPDATE` and `DELETE` remain prohibited for every authority. The finalization RPC must set exactly
`finalize_installation_certificate_r1_document_v1` with transaction-local scope only after all
checks and locks succeed, and must clear it before every return. The issuance RPC must retain its
existing token and must not gain document-finalization authority. Direct SQL, authenticated,
anonymous, and other service-role paths must not be able to activate either authority through a
callable helper.

The database cannot recompute the PDF SHA-256 from Storage bytes. The server action must hash the
buffer before upload and byte-verify every later read against the immutable metadata.

## 7. Ensure/store action and failure rules

The action requires genuine request-scope authentication and `edit` capability before creating an
admin client. Every admin read is additionally constrained by the resolved dealer id.

Required order:

1. validate the issuance id;
2. read the same-dealer issuance and any existing document;
3. if a document exists, download once, validate canonical metadata, size, PDF signature and
   SHA-256, then return ready without rendering or uploading;
4. otherwise validate the immutable snapshot and resolve the issuance-time logo mode;
5. render once, validate bytes, compute SHA-256, and upload a UUID-keyed object with `upsert:false`;
6. call the server-only finalization RPC;
7. on a race/conflict, remove only this attempt's unreferenced object, then resolve the winner once;
8. on a non-finalized failure, remove only this attempt's object;
9. if cleanup fails, return `cleanup_failed`; never report success while an orphan is known;
10. after database finalization, signing/download failure never causes regeneration or metadata
    rollback.

No recursion, unbounded retry, overwrite, deletion of a winner, or silent regeneration is allowed.
A stored-byte size/hash mismatch is `artifact_integrity_error` and requires operator attention.

## 8. Authenticated stored-document route

The route accepts only `issuanceId` and optional `download=1`. It must:

- require a genuine request session and same-dealer RLS-visible issuance/document pair;
- return 401 unauthenticated, 400 invalid input, 404 for missing/foreign, 409 for not-yet-stored,
  and a generic 500/503 for read or integrity failure;
- download the one metadata-bound private object server-side;
- verify bucket, canonical path, MIME, byte size, PDF signature, and SHA-256 before responding;
- stream the exact stored bytes with `Cache-Control: private, no-store`;
- never render, upload, finalize, issue, regenerate, mutate, or expose a Storage URL.

## 9. Required verification

Focused source tests must prove:

- snapshot validation and exact presentation mapping;
- no money, memo, warranty, grant, QR, or public-link field is representable;
- CanCoat is an ordinary item and invokes no special template;
- dealer/default logo-mode behavior and offline-only assets;
- canonical path, MIME, size, PDF signature, SHA-256, and template-version validation;
- pointed artifact read returns exact bytes with zero render/upload/finalize calls;
- missing artifact renders/uploads/finalizes once;
- same-attempt replay and race convergence create one metadata row and event;
- mismatch, missing bytes, unknown probe, malformed snapshot, finalize failure, and cleanup failure
  all fail closed;
- unauthenticated, readonly, missing/foreign, wrong dealer, and direct authenticated RPC paths deny;
- the GET route is read-only and never imports a renderer or admin mutation path.

Later R1-V1 disposable verification must prove RLS/grants, separate-connection races, rollback,
Storage object/metadata agreement, and A4 visual output for one and multiple item cases. Mocks do not
substitute for those gates.

## 10. Phases and literal future write allowlists

### 10.1 R1-C1-G0 — generated database paths only

After separate authorization, run only:

```text
supabase migration new installation_certificate_r1_document_finalize
supabase test new installation_certificate_r1_document_finalize
```

G0 may create only the two empty CLI-generated files and must stop after reporting their exact
paths. It may not edit, apply, stage, commit, or push them.

### 10.2 R1-C1-G1 — finalization database authority

After the generated paths are approved, the writable allowlist is exactly:

```text
<G0-generated migration path>
<G0-generated database test path>
src/lib/certificates/installation-certificate-r1-document-contract.ts
src/lib/certificates/installation-certificate-r1-document-contract.test.ts
```

### 10.3 R1-C1-G2 — renderer and artifact lifecycle

After G1 source acceptance, the writable allowlist is exactly:

```text
src/components/documents/templates/certificates/InstallationCertificateR1Document.tsx
src/lib/pdf/render-installation-certificate-r1-document.tsx
src/lib/certificates/installation-certificate-r1-artifact-core.ts
src/lib/certificates/installation-certificate-r1-artifact-core.test.ts
src/lib/certificates/ensure-installation-certificate-r1-document.ts
src/lib/certificates/ensure-installation-certificate-r1-document.test.ts
src/app/pdf/installation-certificate/route.ts
src/app/pdf/installation-certificate/route.test.ts
```

No existing certificate template, fixture, branding provider, shared renderer, package, lockfile,
generated type, UI, or unrelated source file is writable in G1/G2.

## 11. Protected paths

These remain metadata-only and must not be opened, read, diffed, copied, staged, or modified:

```text
src/components/estimates/wizard/screens/ScreensPreview.tsx
supabase/migrations/20260801110110_line_link_tokens.sql
supabase/migrations/20260807135006_monthly_invoice_pdf_artifact.sql
src/lib/monthly-statements/monthly-invoice-artifact-boundary.test.ts
```

Expected base metadata:

```text
100644 c1eb0dc88954f3a17cc85e313b62d5bb6a4fda3f src/components/estimates/wizard/screens/ScreensPreview.tsx
100644 accd22345054cc44f89156fd78eaba6dfe4242a4 supabase/migrations/20260801110110_line_link_tokens.sql
100644 32fda49583ae1217bc13711784ad8fa31744726c supabase/migrations/20260807135006_monthly_invoice_pdf_artifact.sql
100644 fe3c80f22fd80dcbfab076082473216dda582c14 src/lib/monthly-statements/monthly-invoice-artifact-boundary.test.ts
```

## 12. Gate state and next action

```yaml
active_phase: GDA_INSTALLATION_CERTIFICATE_R1_C1_GOVERNANCE
responsible_machine_and_agent: MacBook Codex
authorized_now:
  - local_read_only_source_inspection
  - this_two_document_local_governance_candidate
not_authorized_now:
  - source_test_or_generated_migration_implementation
  - pdf_artifact_creation_or_storage_upload
  - database_supabase_storage_environment_or_production_mutation
  - stage_commit_push_pr_mutation_ready_merge_or_deploy
next:
  - verify_exact_two_document_diff_and_protected_metadata
  - obtain_separate_owner_authorization_for_literal_two_path_commit
  - obtain_separate_owner_authorization_for_push_and_draft_pr
  - publish_the_claude_targeted_read_only_diagnosis_instruction_on_the_active_draft_pr
  - accept_or_correct_the_diagnosis_before_any_G0_or_source_implementation
```
