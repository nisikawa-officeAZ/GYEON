# Claude Directive — GDA Installation Certificate R1 Read-only Diagnosis

## Authority

Perform a read-only diagnosis against exact `main` commit:

```text
bf15b1ff571b7ea91f6b8ab63b6789ace667f0e0
```

Repository:

```text
nisikawa-officeAZ/GYEON
```

Do not edit, create, delete, format, stage, commit, push, mutate a PR, access Supabase, access production, render against live customer data, or install dependencies.

## Protected paths

Treat these as hash-only. Do not open, read, diff, copy, stage, or modify them:

```text
src/components/estimates/wizard/screens/ScreensPreview.tsx
supabase/migrations/20260801110110_line_link_tokens.sql
supabase/migrations/20260807135006_monthly_invoice_pdf_artifact.sql
src/lib/monthly-statements/monthly-invoice-artifact-boundary.test.ts
```

Expected metadata at the audited commit:

```text
100644 c1eb0dc88954f3a17cc85e313b62d5bb6a4fda3f src/components/estimates/wizard/screens/ScreensPreview.tsx
100644 accd22345054cc44f89156fd78eaba6dfe4242a4 supabase/migrations/20260801110110_line_link_tokens.sql
100644 32fda49583ae1217bc13711784ad8fa31744726c supabase/migrations/20260807135006_monthly_invoice_pdf_artifact.sql
100644 fe3c80f22fd80dcbfab076082473216dda582c14 src/lib/monthly-statements/monthly-invoice-artifact-boundary.test.ts
```

## Files and areas to inspect — low-budget bounded retry

Read only the following files. Do not read a full migration or unrelated design component:

```text
docs/master_specification/GDA_INSTALLATION_CERTIFICATE_R1_DIAGNOSIS_AND_REQUIREMENTS.md
docs/master_specification/GYEON_CERTIFICATE_ISSUANCE_CONTROL_SPEC.md
src/components/documents/templates/certificates/certificate-data.ts
src/components/documents/templates/certificates/CertificateDocument.tsx
src/components/documents/templates/certificates/CancoatCertificateTemplate.tsx
src/components/documents/templates/certificates/__fixtures__/sample-certificates.ts
src/lib/pdf/get-work-report-pdf-data.ts
src/lib/completion-reports/get-completion-report.ts
```

Use one bounded reference search outside these paths only to prove whether `CertificateDocument`, `CertificateDocumentData`, or the certificate document types have a runtime caller outside `src/components/documents/templates/certificates/**`. Do not inspect a protected path while searching.

## Questions to answer

1. Are the certificate files presentation templates only, or is there a complete authenticated issuance path?
2. Is there any production source adapter from a completed work order/report into `CertificateDocumentData`?
3. From the bounded reference search, is there any runtime certificate route, adapter, issuance UI, or persistence caller?
4. Can the canonical completion source supply customer, vehicle, completion date, assigned staff, and confirmed performed-work rows without priced estimate items? List missing certificate fields only.
5. Confirm the CanCoat contradiction and whether warranty-bearing coating/PPF content must be excluded from the Owner-approved non-warranty R1.

## Required output

Return one compact report of at most 700 words with:

```text
MARKER=INV001_GDA_INSTALLATION_CERTIFICATE_R1_A1_READ_ONLY_DIAGNOSIS_RESULT_V1
HEAD=<commit>
TREE=<tree>
WORKTREE_STATUS=<clean or exact pre-existing paths>
PROTECTED_METADATA=<four mode_hash_path entries>
CURRENT_IMPLEMENTATION=<template-only or complete, with evidence paths>
REUSABLE_FOUNDATION=<evidence paths>
MISSING_RUNTIME_LAYERS=<bounded exact list>
CONTRADICTIONS=<exact list>
R1_R2_SPLIT_VERDICT=<PASS or CHANGES_REQUIRED>
REQUIREMENTS_GAPS=<critical list or NONE>
SOURCE_OR_RUNTIME_MUTATION=NONE
FINAL_VERDICT=<PASS_READ_ONLY_DIAGNOSIS or FAIL>
```

Do not propose implementation diffs and do not perform tests that write caches or artifacts. Stop after the report.
