# GDA Estimate Wizard Postal Master R5 CR1-R1 — Codex-normalized result

## Provenance

- Source: the single Owner-authorized, tool-disabled CR1-R1 Claude response.
- Source verdict: `READY_FOR_CR1_MANIFEST_RATIFICATION`.
- Codex audit: the required marker, verdict, field set, order, manifest choice,
  hashes, prerequisite decision, and next gate were preserved.
- Claude transcription defect: one occurrence of the protected LINE migration
  Git blob was returned as
  `accd22345054f3a17cc85e313b62d5bb6a4fda3f`.
- Owner-authorized correction: that one occurrence only was replaced with the
  Git-attested value `accd22345054cc44f89156fd78eaba6dfe4242a4`.
- No other substantive value or conclusion was changed.

## Corrected CR1-R1 report

GDA_ESTIMATE_WIZARD_POSTAL_MASTER_R5_CR1_R1_RESULT_FORMAT_CORRECTION_RESULT_V1
verdict: READY_FOR_CR1_MANIFEST_RATIFICATION
execution_identity:
- execution_head: `216d8cf9aa0dd9135f224aabe90dd5e800fc800e`
- execution_tree: `0b9f494a1714dd4d6f002ae3c284ee623d6592a9`
- index_and_worktree: CLEAN; upstream_ahead_behind: `0 0`
scope_and_protected_path_evidence:
- PR #67 on `nisikawa-officeAZ/GYEON`: OPEN / Draft, base `main`, head ref `agent/gda-estimate-ocr-postal-clean-replacement-r1`, `pr_remote_head` equal to `execution_head`, `pr_mergeable: MERGEABLE`
- CI: `vercel_check: PASS`, `vercel_preview_comments_check: PASS`
- Protected-path metadata (mode/blob/state only; content not opened):
  - `src/components/estimates/wizard/screens/ScreensPreview.tsx` — `100644` / `c1eb0dc88954f3a17cc85e313b62d5bb6a4fda3f` / CLEAN
  - `supabase/migrations/20260801110110_line_link_tokens.sql` — `100644` / `accd22345054cc44f89156fd78eaba6dfe4242a4` / CLEAN
  - `supabase/migrations/20260807135006_monthly_invoice_pdf_artifact.sql` — `100644` / `32fda49583ae1217bc13711784ad8fa31744726c` / CLEAN
  - `src/lib/monthly-statements/monthly-invoice-artifact-boundary.test.ts` — `100644` / `fe3c80f22fd80dcbfab076082473216dda582c14` / CLEAN
113_path_attestation:
- `formal_top_level_migration_count: 113`, cross-counted against the byte-sorted metadata table; manual enumeration confirmed 113 rows with no drift.
- Exactly two rows carry `PROTECTED_METADATA_ONLY_CLEAN` in place of a SHA-256:
  1. `supabase/migrations/20260801110110_line_link_tokens.sql` — `100644` / `accd22345054cc44f89156fd78eaba6dfe4242a4`
  2. `supabase/migrations/20260807135006_monthly_invoice_pdf_artifact.sql` — `100644` / `32fda49583ae1217bc13711784ad8fa31744726c`
- Both blobs match the `protected_path_metadata_only` block and `AGENTS.md`'s protected-path list; no discrepancy found.
r5_vs_b_r3_reconciliation:
- R5-equivalent / `selected_manifest_candidate`: 112 files included; sole exclusion `supabase/migrations/20260801110110_line_link_tokens.sql`; attested aggregate SHA-256 `0d5414ac1257a287938e141d5c398f3607c3bf2650d38255f520956f15ddb5bb`.
- Legacy B-R3 policy carried forward: 110 files included; exclusions `20260731115631_gyeon_dealer_provisioning.sql`, `20260801000649_gyeon_provisioning_pin_function_search_path.sql`, `20260801110110_line_link_tokens.sql`; attested aggregate SHA-256 `6421db3345c185a72fb14cc255a32d47f0e62e5b92c888a352d0a4a1da18249b`.
- Arithmetic check: `113 − 1 = 112` and `113 − 3 = 110`, both internally consistent with the attested count.
- `r5_retained_manifest_staged_count: 112` / `r5_retained_manifest_excluded_count: 1` (from the already-executed disposable run's manifest, hash `722b59ffe2b2252e826783b125df2ac1b4d2468d46743c01da0e726fe2543326`) matches the R5-equivalent candidate's file set exactly; the differing hash values reflect differing manifest-serialization formats, not a differing file set.
- Distinguishing "content-protected" (AGENTS.md) from "replay-excluded" (R5 manifest): `20260807135006_monthly_invoice_pdf_artifact.sql` is content-protected but not replay-excluded (already-accepted, closed schema migration); `20260801110110_line_link_tokens.sql` is both content-frozen and replay-excluded, pending a separately authorized phase for external LINE secret/token contact.
provisioning_pair_disposition:
- Decision: include both `20260731115631_gyeon_dealer_provisioning.sql` and `20260801000649_gyeon_provisioning_pin_function_search_path.sql` as disabled infrastructure — `INCLUDE_SCHEMA_KEEP_FEATURE_DISABLED`, ratifying the 112-file/one-exclusion manifest.
- Supporting basis: fail-closed by construction (RLS enabled with zero policies, all privileges revoked from `public`/`anon`/`authenticated`, CRUD/EXECUTE granted only to `service_role`; functions are `SECURITY INVOKER`, schema-qualified, with the second migration only pinning an empty `search_path`); gated additionally at the application layer by the server-only flag `GYEON_PARTNER_ONBOARDING_ENABLED === "true"`, unset in the supplied evidence; already proven inert at the DB layer under the accepted `GDA_POSTAL_R5_DISPOSABLE_DB_PASS` run (aggregate evidence SHA-256 `92af4ed809cd42476810a00786b0c6d7d86888186f23fc761fde2c9f5c2cff31`); and classified `intentionally_deferred` (not `prohibited/frozen`) in the historical `ENVIRONMENT_REMEDIATION_PLAN.md` Section 5.1, unrevised in supplied evidence.
product_policy_and_storage_prerequisite:
- `supabase/migrations/20260812091313_gyeon_products_storage_authority.sql` (SHA-256 `fc71129b5e74bcf9cd1a0751ef58d34f85e6e50459b563bdee610b95e55620a2`) already fails closed on any `completion-reports` or unratified bucket, upserts the canonical five-bucket catalog (`documents`, `work-order-files`, `vehicle-registration-documents`, `dealer-branding`, `gyeon-resources`), replaces the role-only `gyeon_products` SELECT policy with `gyeon_products_active_member_select` (requires `auth.uid() is not null` and an active `dealer_members` row), leaves only `authenticated → SELECT` / `service_role → full CRUD`, and installs the operation-specific Storage policy matrix.
- Codified by focused pgTAP `supabase/tests/gyeon_products_storage_authority.test.sql` (SHA-256 `4f489765328c6980bbc4dcd6894ad6a935d6afb3513368b75b85ee962ec90f39`) in 78 assertions, consistent with prior R4/R4B disposable-run acceptance.
- Status: closed; present unchanged in the current 113-file manifest; included identically in both the 112-file and 110-file candidate manifests; not to be re-flagged as pending without new contrary evidence.
recommended_manifest:
- 112 migrations (all 113 current top-level formal migrations minus exactly one exclusion).
- Sole exclusion: `supabase/migrations/20260801110110_line_link_tokens.sql`.
- Recommended aggregate manifest SHA-256: `0d5414ac1257a287938e141d5c398f3607c3bf2650d38255f520956f15ddb5bb`.
- Postal target: `supabase/migrations/20260901001246_jp_postal_master.sql`, SHA-256 `76748b5cae4fc1ba34c4257cb64bc9732da0e316d4c5727bab2ef170141a1f2d`.
remaining_blockers:
- None identified. No remaining source prerequisite blocks CR3.
- `CR2_NOT_REQUIRED`.
next_gate:
- The minimum next gate is CR3 fresh disposable governance — not project creation, hosted replay, migration apply, or provider execution.
prohibited_action_attestation:
- No tools, network, Git, filesystem, Supabase, PostgreSQL, Docker, Auth, Storage, provider, or Vercel access was used in producing this correction.
- No repository file other than the supplied directive and the supplied exact prior report was opened or requested.
- No source file, migration content, test content, 113-path metadata table, secret, environment file, database row, or provider response was received or re-derived a second time.
- No hash, file count, exclusion, source finding, evidence level, or provisioning disposition was recalculated, reinterpreted, or changed from the frozen findings.
- No write, edit, create, delete, stage, commit, push, PR mutation, merge, migration apply, project creation, cutover, retirement, or deployment occurred.
- No authorization of CR3 execution or clean-replacement project creation is issued by this report.
