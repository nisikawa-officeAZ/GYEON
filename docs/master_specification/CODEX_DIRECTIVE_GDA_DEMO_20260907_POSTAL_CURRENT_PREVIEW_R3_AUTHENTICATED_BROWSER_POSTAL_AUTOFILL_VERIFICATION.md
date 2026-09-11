# CODEX DIRECTIVE — GDA DEMO 2026-09-07 POSTAL CURRENT PREVIEW R3

## Authenticated browser postal autofill verification

### 0. Status and authority

- Phase: `GDA_DEMO_20260907_POSTAL_CURRENT_PREVIEW_R3_AUTHENTICATED_BROWSER_POSTAL_AUTOFILL_VERIFICATION`
- Governance status: `EXACT_THREE_DOCUMENT_GOVERNANCE_CANDIDATE_UNSTAGED_UNCOMMITTED`
- Execution owner: MacBook Codex using the Owner's already-authenticated in-app browser, with the Owner present.
- Result marker: `GDA_DEMO_20260907_POSTAL_CURRENT_PREVIEW_AUTHENTICATED_BROWSER_POSTAL_AUTOFILL_RESULT_V3`
- This document is a runbook candidate only. It does not authorize browser execution, Claude execution, file transmission, stage, commit, push, PR mutation, provider mutation, Supabase/database access, migration, import, deployment, Ready, merge, or Production contact.

R2D must not be rerun. Its single execution supplied useful evidence that the
fixed Preview provider hostname returned a redirect-class response to one GET,
with no redirect follow, provider mutation, Supabase/database contact, or Git
mutation. Its claimed PASS is not accepted because the execution also ran a
prohibited `curl --version` process, reported `curl_process_count: 1` despite
two curl processes, emitted the exact HTTP status when only the status class
was permitted, and omitted the required leading result marker. The independent
R2D verdict is therefore:

`CHANGES_REQUIRED_EXECUTION_SCOPE_AND_RESULT_FORMAT`

The retained R2D evidence proves Preview-provider reachability only. It proves
nothing about login, OCR mapping, postal lookup, Supabase binding, or the
application's postal autofill behavior.

### 1. Fixed identity

- Repository: `nisikawa-officeAZ/GYEON`
- Branch: `agent/gda-estimate-ocr-postal-clean-replacement-r1`
- Pull request: `https://github.com/nisikawa-officeAZ/GYEON/pull/67`
- Pull-request state at authoring: OPEN / Draft / base `main`
- Fixed pre-R3 HEAD: `4ae384037dd724b1a6cf797226343f087cddc564`
- Fixed pre-R3 tree: `6a07395a8e219a13e00d88f59142322a76a5db05`
- Fixed pre-R3 parent: `d2b57727fae5e7094b252070ed71c3c6816ad95d`
- Fixed Preview alias: `dealeros-git-agent-gda-estimate-0307f5-nisikawa-5024s-projects.vercel.app`
- Target route: authenticated Estimate Wizard new-estimate screen for the Owner-approved workspace.
- Checks at authoring: Vercel PASS; Preview Comments PASS.

Future R3 execution requires a separately authorized governance commit that is
a direct child of the fixed pre-R3 HEAD and changes exactly this directive,
`GYEON_DA_COMPLETION_PLAN.md`, and `GYEON_DA_PHASE_RESULTS.md`. It also requires
normal push, successful PR checks, formal PR delivery, and a separate Owner
authorization for the authenticated browser run.

### 2. Privacy and execution boundary

R3 uses only the existing authenticated browser session. Codex must not read,
extract, copy, export, print, store, or transmit cookies, session values,
authorization headers, access tokens, refresh tokens, workspace secrets, or
browser storage. Login is proven by the visible authenticated application UI,
not by inspecting authentication material.

The Owner selects and submits the already-approved vehicle-registration test
document manually. Codex must not upload, copy, open outside the application,
or transmit that personal document without a new explicit authorization. No
test result may reproduce customer name, full address, vehicle identifiers, or
other personal information. Screenshots are optional and require separate
Owner approval; if permitted, they must be tightly cropped or redacted so that
no personal information is visible.

R3 permits visual and semantic UI inspection only. Browser developer tools,
network-body capture, console dumps, HAR export, source inspection, migration
inspection, direct Supabase/database access, Vercel/API commands, and provider
configuration changes are prohibited. Do not save the estimate, create a
customer, submit a form, or cause a database write. Reversible field entry in
an unsaved form is allowed only during the separately authorized R3 execution.

### 3. Preconditions

Before either test, Codex must confirm without exposing personal information:

1. The visible hostname exactly matches the fixed Preview alias.
2. The Estimate Wizard is visibly authenticated and usable.
3. The workspace query parameter is present, but its value is not copied into
   the result.
4. No save, PDF generation, customer creation, estimate creation, or other
   persistent submission will be performed.
5. No prior values remain that could make a newly observed autofill result
   ambiguous.

If these conditions cannot be met, stop without testing and return the matching
blocked verdict.

### 4. Test A — OCR address to postal code reverse autofill

Purpose: determine whether one Owner-initiated vehicle-registration OCR action
reflects the customer fields and derives the postal code from the OCR address.

1. The Owner manually selects the approved test document and initiates OCR.
2. Codex observes only whether these field classes are populated after OCR:
   customer name, customer address, postal code, vehicle manufacturer, vehicle
   model name, vehicle model code, and chassis number.
3. Record only `POPULATED`, `EMPTY`, `NOT_PRESENT`, or `UNDETERMINED` for each
   field class. Never record its value.
4. Record one visible postal behavior classification:
   `AUTOFILLED`, `LOOKUP_UNAVAILABLE`, `NO_TRIGGER_VISIBLE`, `EMPTY_RESULT`,
   `UNEXPECTED_FIELD_RESET`, `OTHER_REDACTED_ERROR`, or `UNDETERMINED`.
5. Do not manually fill the postal field during Test A. Do not save.

The historical screenshot showing populated customer name/address, an empty
postal code, and a visible postal-lookup-unavailable message is prior symptom
evidence only. It is not current R3 runtime proof.

### 5. Test B — postal code to address forward autofill

Purpose: independently determine whether manual postal entry triggers address
autofill. Test B must use a clean new/manual customer form, not the state left
by Test A.

1. Return to or open a clean unsaved new-estimate form without saving Test A.
2. Choose manual customer entry.
3. Enter one Owner-approved, public, non-personal Japanese postal code selected
   at execution time. Do not use customer data from the OCR document.
4. Trigger the UI's normal lookup behavior exactly once.
5. Observe whether the address field populates with the expected public address.
6. Record only `MATCH`, `EMPTY`, `MISMATCH_REDACTED`, `LOOKUP_UNAVAILABLE`,
   `NO_TRIGGER_VISIBLE`, `UNEXPECTED_FIELD_RESET`, or `UNDETERMINED`.
7. Do not record the entered postal code or returned address in the result. Do
   not save or submit.

Tests A and B are independent. A result from one direction must never be used
as proof for the other.

### 6. Verdict matrix

- `PASS_BOTH_DIRECTIONS`: Test A postal code is `AUTOFILLED` and Test B is `MATCH`.
- `CHANGES_REQUIRED_OCR_REVERSE_ONLY`: Test A fails or is unavailable while Test B is `MATCH`.
- `CHANGES_REQUIRED_FORWARD_LOOKUP_ONLY`: Test A is `AUTOFILLED` while Test B fails or is unavailable.
- `CHANGES_REQUIRED_BOTH_DIRECTIONS`: both directions fail or are unavailable.
- `BLOCKED_AUTH_SESSION`: the authenticated Estimate Wizard cannot be reached.
- `BLOCKED_OWNER_DOCUMENT_SELECTION`: the Owner does not select the test document.
- `BLOCKED_UI_OR_PREVIEW`: the fixed Preview or required UI cannot be used.
- `BLOCKED_PRIVACY_BOUNDARY`: the test cannot continue without exposing or transferring prohibited personal/authentication data.

An `UNDETERMINED` result cannot produce PASS. When one test is completed and
the second becomes blocked, retain the completed result and report the
appropriate blocked verdict; do not repeat the completed test.

### 7. Required result format

The first line must be exactly:

`GDA_DEMO_20260907_POSTAL_CURRENT_PREVIEW_AUTHENTICATED_BROWSER_POSTAL_AUTOFILL_RESULT_V3`

Then emit one concise YAML block containing only:

```yaml
verdict: PASS_BOTH_DIRECTIONS | CHANGES_REQUIRED_OCR_REVERSE_ONLY | CHANGES_REQUIRED_FORWARD_LOOKUP_ONLY | CHANGES_REQUIRED_BOTH_DIRECTIONS | BLOCKED_AUTH_SESSION | BLOCKED_OWNER_DOCUMENT_SELECTION | BLOCKED_UI_OR_PREVIEW | BLOCKED_PRIVACY_BOUNDARY
preview_alias_match: true | false
authenticated_ui_visible: true | false
owner_present: true | false
owner_selected_document: true | false
test_a:
  executed: true | false
  customer_name: POPULATED | EMPTY | NOT_PRESENT | UNDETERMINED
  customer_address: POPULATED | EMPTY | NOT_PRESENT | UNDETERMINED
  postal_code: POPULATED | EMPTY | NOT_PRESENT | UNDETERMINED
  vehicle_manufacturer: POPULATED | EMPTY | NOT_PRESENT | UNDETERMINED
  vehicle_model_name: POPULATED | EMPTY | NOT_PRESENT | UNDETERMINED
  vehicle_model_code: POPULATED | EMPTY | NOT_PRESENT | UNDETERMINED
  chassis_number: POPULATED | EMPTY | NOT_PRESENT | UNDETERMINED
  postal_behavior: AUTOFILLED | LOOKUP_UNAVAILABLE | NO_TRIGGER_VISIBLE | EMPTY_RESULT | UNEXPECTED_FIELD_RESET | OTHER_REDACTED_ERROR | UNDETERMINED
test_b:
  executed: true | false
  result: MATCH | EMPTY | MISMATCH_REDACTED | LOOKUP_UNAVAILABLE | NO_TRIGGER_VISIBLE | UNEXPECTED_FIELD_RESET | UNDETERMINED
privacy:
  pii_value_emitted: false
  auth_material_accessed_or_emitted: false
  screenshot_created: false
mutation:
  estimate_saved_or_submitted: false
  customer_created: false
  database_or_supabase_directly_contacted: false
  provider_or_vercel_mutated: false
  git_or_files_mutated: false
claude_invoked: false
next: STOP_FOR_CODEX_AND_OWNER_DECISION
```

No free-form value that may contain personal information, authentication
material, raw application output, or full error text may be appended.

### 8. Decision after R3

- PASS in both directions: close the postal runtime issue without repair.
- Forward lookup PASS and OCR reverse failure: authorize a later Claude
  read-only diagnosis limited to the OCR-to-postal mapping/action boundary.
- Both directions fail or show lookup unavailable: authorize a later
  read-only environment/data-binding diagnosis before any source repair.
- OCR reverse PASS and forward failure: authorize a later read-only diagnosis
  limited to the manual postal lookup trigger/binding boundary.
- Authentication blocked: the Owner restores login, then resume only the
  uncompleted test under the same R3 contract.

Diagnosis, repair, executable verification, commit, push, and deployment remain
separate future gates.
