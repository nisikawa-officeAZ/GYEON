# Claude Directive — GDA Installation Certificate R1-C1 Read-only Diagnosis

## Authority

Perform one bounded read-only diagnosis against exact commit and tree:

```text
commit: 5571d11d088f2e70cdbeff15aa2bdc7ee47be3e9
tree:   0731cc66057c291b4039e9d5fc8702cbf039f935
repository: nisikawa-officeAZ/GYEON
```

Do not edit, create, delete, format, test, render, install, stage, commit, push, mutate a PR, access
Supabase/Storage/Vercel, use production data, or create a PDF.

## Protected paths

Treat these as metadata-only. Do not open, read, diff, copy, stage, or modify them:

```text
src/components/estimates/wizard/screens/ScreensPreview.tsx
supabase/migrations/20260801110110_line_link_tokens.sql
supabase/migrations/20260807135006_monthly_invoice_pdf_artifact.sql
src/lib/monthly-statements/monthly-invoice-artifact-boundary.test.ts
```

Expected metadata:

```text
100644 c1eb0dc88954f3a17cc85e313b62d5bb6a4fda3f src/components/estimates/wizard/screens/ScreensPreview.tsx
100644 accd22345054cc44f89156fd78eaba6dfe4242a4 supabase/migrations/20260801110110_line_link_tokens.sql
100644 32fda49583ae1217bc13711784ad8fa31744726c supabase/migrations/20260807135006_monthly_invoice_pdf_artifact.sql
100644 fe3c80f22fd80dcbfab076082473216dda582c14 src/lib/monthly-statements/monthly-invoice-artifact-boundary.test.ts
```

## Read allowlist

Read only:

```text
docs/master_specification/GDA_INSTALLATION_CERTIFICATE_R1_B1_CONTRACT.md
docs/master_specification/GDA_INSTALLATION_CERTIFICATE_R1_B2_CONTRACT.md
docs/master_specification/GDA_INSTALLATION_CERTIFICATE_R1_C1_CONTRACT.md
src/lib/certificates/installation-certificate-r1-issuance-contract.ts
src/lib/certificates/issue-installation-certificate-r1.ts
supabase/migrations/20260916014443_installation_certificate_r1_issuance.sql
src/components/documents/templates/certificates/certificate-data.ts
src/components/documents/templates/certificates/CertificateDocument.tsx
src/lib/pdf/register-fonts.ts
src/lib/pdf/brand-profile.ts
src/lib/pdf/dealer-branding.ts
src/lib/pdf/chromium-document/store-logo.ts
src/lib/monthly-statements/ensure-monthly-invoice-pdf.ts
src/app/pdf/work-report/route.ts
supabase/migrations/20260725101130_documents_storage_setup.sql
supabase/migrations/20260802030025_documents_storage_fail_closed_authorization.sql
```

Use one bounded reference search only for direct callers/importers of these allowed files. Exclude
all protected paths from the search and do not open any additional match.

## Questions

1. Can the B2 snapshot be validated and rendered without re-reading mutable customer, vehicle,
   estimate, work, completion, or dealer text data?
2. Does the proposed neutral R1 component structurally exclude every monetary and warranty field?
3. Is a service-role-only finalization RPC necessary to create immutable document metadata under
   the current trigger/grant contract?
4. Does the proposed upload/finalize/cleanup/race sequence preserve one canonical object without
   overwrite or silent regeneration?
5. Is the existing private `documents` bucket usable without a new bucket or policy change?
6. Can the read route byte-verify and stream the stored PDF without exposing a Storage URL or
   importing a mutation path?
7. Are the G0/G1/G2 literal allowlists complete and minimal? List an exact missing path or an exact
   removable path if not.

## Required result

Return one report of at most 900 words:

```text
MARKER=GDA_INSTALLATION_CERTIFICATE_R1_C1_READ_ONLY_DIAGNOSIS_RESULT_V1
HEAD=<exact commit>
TREE=<exact tree>
WORKTREE_STATUS=<clean or exact pre-existing paths>
PROTECTED_METADATA=<four mode_hash_path entries>
SNAPSHOT_TO_PDF_BOUNDARY=<PASS or exact defect>
NON_WARRANTY_AND_NON_MONETARY_BOUNDARY=<PASS or exact defect>
STORAGE_AND_FINALIZATION_BOUNDARY=<PASS or exact defect>
RACE_AND_CLEANUP_BOUNDARY=<PASS or exact defect>
AUTHENTICATED_READ_ROUTE_BOUNDARY=<PASS or exact defect>
ALLOWLIST_REVIEW=<PASS or exact additions/removals>
SOURCE_OR_RUNTIME_MUTATION=NONE
FINAL_VERDICT=<READY_FOR_G0_GOVERNANCE or CHANGES_REQUIRED_GOVERNANCE>
```

Stop after the report. Do not propose a patch and do not perform implementation or verification.
