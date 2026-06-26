# MASTER SPECIFICATION AUDIT REPORT
## GYEON Detailer Agent — PHASE74

**Audit date:** 2026-06-25  
**Scope:** All 11 master specification documents  
**Audited against:** `gyeon_flow.json`, `gyeon_settings_flow.json`, DealerOS implementation, Supabase migrations  
**Mode:** Read-only. No code, no migrations, no UI, no commits modified.

---

## LEGEND

| Symbol | Meaning |
|--------|---------|
| ✅ PASS | Consistent and complete |
| ⚠️ WARNING | Minor gap, stale reference, or ambiguity |
| ❌ MISSING | Required content absent from the document |
| 🔴 CRITICAL | Direct contradiction between spec and canonical source or implementation |
| 📋 RECOMMENDATION | Action the operator should take |

---

## CROSS-CUTTING FINDINGS (apply to multiple documents)

These issues are reported at the cross-cutting level and not repeated per document.

### CC-1 🔴 CRITICAL — Settings key count is wrong throughout

**Affected docs:** `04_SETTINGS_WORKFLOW.md` §7, `05_DATABASE_REQUIREMENTS.md` §1.3, `11_CANONICAL_RULES.md` (implicit)

`gyeon_settings_flow.json` `all_settings_keys` contains exactly **37 entries**. Every spec document states "39 canonical settings keys." The count 39 is wrong.

**Evidence:** Manual count of `all_settings_keys` array in JSON = 37 keys.  
**Action required:** Replace every occurrence of "39 keys" with "37 keys" across all spec documents.

---

### CC-2 🔴 CRITICAL — PPF plan prices: JSON vs implementation defaults diverge significantly

**Affected docs:** `03_BUSINESS_WORKFLOW.md` §4.5, `05_DATABASE_REQUIREMENTS.md` §4.3

`gyeon_flow.json` plan prices vs `dealer-settings-defaults.ts`:

| Plan | Size | JSON (canonical) | Defaults.ts (implementation) | Delta |
|------|------|-----------------|------------------------------|-------|
| front-half | ML | ¥180,000 | ¥195,000 | +¥15,000 |
| front-half | L  | ¥190,000 | ¥220,000 | +¥30,000 |
| front-half | LL | ¥220,000 | ¥260,000 | +¥40,000 |
| front-half | LL+/XL | ¥260,000 | ¥300,000 | +¥40,000 |
| full-body | SS | ¥250,000 | ¥280,000 | +¥30,000 |
| full-body | S  | ¥290,000 | ¥320,000 | +¥30,000 |
| full-body | M  | ¥330,000 | ¥360,000 | +¥30,000 |
| full-body | ML | ¥350,000 | ¥415,000 | +¥65,000 |
| full-body | L  | ¥370,000 | ¥470,000 | +¥100,000 |
| full-body | LL | ¥430,000 | ¥550,000 | +¥120,000 |
| full-body | LL+/XL | ¥520,000 | ¥650,000 | +¥130,000 |

The spec (`03_BUSINESS_WORKFLOW.md`) accurately reflects the JSON. The implementation defaults are **different**. Operator must decide which is canonical.

---

### CC-3 🔴 CRITICAL — PPF vehicle ranks: JSON has 4 tiers; implementation has 3 (different names)

**Affected docs:** `03_BUSINESS_WORKFLOW.md` §4.5, `05_DATABASE_REQUIREMENTS.md` §4.3

| Source | Ranks (coeff) |
|--------|--------------|
| `gyeon_flow.json` (canonical) | std(1.0), premium(1.3), upper(1.5), luxury(1.8) |
| `dealer-settings-defaults.ts` | std(1.0), premium(1.3), ultra(1.6) |

The canonical JSON has 4 ranks; the implementation has 3 ranks with different names. `upper` and `luxury` do not exist in defaults.ts; `ultra` does not exist in the canonical JSON.

The auto-detect mapping in the JSON (std/premium/upper/luxury) references `upper` and `luxury`, which don't exist in the implementation. **This is a broken feature.**

---

### CC-4 🔴 CRITICAL — PPF film types: different IDs and coefficients between JSON and implementation

**Affected docs:** `03_BUSINESS_WORKFLOW.md` §4.5, `05_DATABASE_REQUIREMENTS.md` §4.3

| Source | Film types (coeff) |
|--------|--------------------|
| `gyeon_flow.json` (canonical) | clear(1.0), matte(1.3), carbon(1.5), color(1.8) |
| `dealer-settings-defaults.ts` | clear(1.0), matte(1.3), color(1.2), self-heal(1.1) |

`carbon` exists in canonical JSON but not in defaults. `color` has coefficient 1.8 in JSON vs 1.2 in defaults. `self-heal` exists in defaults but not in canonical JSON.

The spec accurately reflects the JSON. The implementation defaults diverge.

---

### CC-5 🔴 CRITICAL — Window film grades: completely different categories between JSON and implementation

**Affected docs:** `03_BUSINESS_WORKFLOW.md` §4.6, `04_SETTINGS_WORKFLOW.md` §5.7

| Source | Grades (coeff) |
|--------|----------------|
| `gyeon_flow.json` (canonical) | standard(1.0), premium(1.3), high-heat(1.6), security(1.2) |
| `dealer-settings-defaults.ts` | standard(1.0), premium(1.3), uv-cut(1.1), ir-cut(1.2) |

`high-heat` and `security` are in the canonical JSON. `uv-cut` and `ir-cut` are in the implementation. These are completely different grade IDs with different coefficients.

---

### CC-6 🔴 CRITICAL — Window film part IDs and prices: JSON vs implementation diverge

**Affected docs:** `03_BUSINESS_WORKFLOW.md` §4.6, `04_SETTINGS_WORKFLOW.md` §5.7

| Part | JSON id / price | Defaults.ts id / price | Status |
|------|-----------------|------------------------|--------|
| フロントドアガラス | wf-front-side / ¥25,000 | wf-front-side / ¥25,000 | ✅ |
| リアドアガラス | wf-rear-side / ¥22,000 | wf-rear-side / ¥20,000 | ⚠️ price differs |
| リアガラス | wf-rear-glass / ¥20,000 | wf-rear / ¥18,000 | 🔴 ID and price differ |
| リアクォーターガラス | wf-rear-qtr / ¥15,000 | wf-quarter / ¥12,000 | 🔴 ID and price differ |
| サンルーフ | wf-sunroof / ¥18,000 | (not present) | ❌ MISSING from defaults |
| フロントガラス | wf-windshield / ¥30,000 | (not present) | ❌ MISSING from defaults |
| 全窓セット | wf-all / ¥90,000 | wf-all / ¥80,000 | ⚠️ price differs |

---

### CC-7 🔴 CRITICAL — Room cleaning parts: multiple ID and price mismatches

**Affected docs:** `03_BUSINESS_WORKFLOW.md` §4.9, `04_SETTINGS_WORKFLOW.md` §5.7

| Part | JSON id / price | Defaults.ts id / price | Status |
|------|-----------------|------------------------|--------|
| フロアマット | rc-floor / ¥12,000 | rc-floor / ¥12,000 | ✅ |
| シート | rc-seat / ¥20,000 | rc-seat / ¥15,000 | 🔴 price differs |
| 天井 | rc-ceiling / ¥15,000 | rc-ceiling / ¥8,000 | 🔴 price differs |
| ドアトリム | rc-door / ¥10,000 | (not present) | ❌ MISSING |
| ダッシュボード | rc-dash / ¥8,000 | rc-dash / ¥10,000 | 🔴 price differs |
| トランク | rc-trunk / ¥8,000 | (not present) | ❌ MISSING |
| 全室内セット | (not in JSON) | rc-full / ¥45,000 | ⚠️ extra in defaults, not in JSON |

---

### CC-8 🔴 CRITICAL — 6 category steps are PLACEHOLDER in EstimateWizard

**Affected docs:** `03_BUSINESS_WORKFLOW.md` §4.5–4.10, `08_UI_REQUIREMENTS.md` §3

`EstimateWizard.tsx` defines:
```typescript
const PLACEHOLDER_SCREENS: Screen[] = [
  "step-ppf", "step-window", "step-maintenance", "step-carwash", "step-roomclean", "step-other",
];
```

These 6 steps have **no detailed UI implementation**. They navigate through correctly but the detailed fields, price inputs, and sub-steps described in spec §4.5–4.10 are not yet rendered.

The spec correctly documents what SHOULD be there, but the implementation status in `08_UI_REQUIREMENTS.md` and `09_PHASE_STATUS.md` does not reflect this gap.

---

### CC-9 ⚠️ WARNING — Migration 070 "pending draft" vs file exists in repo

**Affected docs:** `05_DATABASE_REQUIREMENTS.md` §5, `09_PHASE_STATUS.md` §1

`supabase/migrations/070_dealer_settings_canonical.sql` exists in the repo and is a complete, well-formed SQL file. The spec treats it as a "pending draft" split into 5 separate migrations. These are inconsistent.

**Unknown:** Whether migration 070 has been applied to the database. This is the single most important operator decision point for database state.

---

## DOCUMENT-BY-DOCUMENT AUDIT

---

### 01_PROJECT_OVERVIEW.md

| Check | Result |
|-------|--------|
| Internal consistency | ✅ PASS |
| Consistent with canonical JSON | ✅ PASS |
| Consistent with implementation | ✅ PASS |
| Consistent with Supabase schema | ✅ PASS |

**Issues:**

⚠️ WARNING — §7 Master Specification Index does not acknowledge the old file set (02–08 old numbering) that still exists in the folder alongside the new set. A reader opening the folder will see both sets and may be confused about which is current.

⚠️ WARNING — §4 Technology Stack references the repo as `github.com/nisikawa-officeAZ/GYEON` — this is not verified as correct and should be confirmed.

📋 RECOMMENDATION — Add a note that old files (`02_BUSINESS_WORKFLOW.md` etc.) are superseded by the new numbered set and should be deleted.

---

### 02_SYSTEM_ARCHITECTURE.md

| Check | Result |
|-------|--------|
| Internal consistency | ✅ PASS |
| Consistent with canonical JSON | ✅ PASS |
| Consistent with implementation | ✅ PASS |
| Consistent with Supabase schema | ✅ PASS |
| Missing business rules | ✅ None missing |
| Missing security requirements | ⚠️ Minor gap |

**Issues:**

⚠️ WARNING — §7 Disaster Recovery states RTO < 4 hours and RPO < 24 hours. These values come from `OFFICIAL_RELEASE_NOTES.md` but are not validated against any SLA agreement. Mark as targets, not guarantees.

⚠️ WARNING — §10 API Routes lists only `/api/line/webhook` and `/api/line/liff/link`. The implementation has additional LIFF pages at `/liff/link` and `/liff/reservation` that are not REST API routes but serve LINE LIFF clients — the distinction matters.

❌ MISSING — §4.2 Migration numbering says "Apply strictly in order; gaps are intentional where noted" but does not list which gap numbers are intentional. The actual gaps (056, 057, 060, 061, 065, 068, 069) should be listed here.

❌ MISSING — No mention of the extra JSONB extension columns added in migration 070 (`store_profile`, `business_days`, `dealer_trade_defaults`, `ocr_policy`, `line_public_settings`, `line_message_templates`, `pdf_settings`, `document_settings`, `tax_settings`, `backup_settings`, `health_settings`, `reminder_templates`). These exist in the schema but are not in the architecture doc.

📋 RECOMMENDATION — Add an "Intentional migration gaps" list to §4.2.

---

### 03_BUSINESS_WORKFLOW.md

| Check | Result |
|-------|--------|
| Internal consistency | ✅ PASS |
| Consistent with `gyeon_flow.json` | ✅ PASS (spec is faithful to JSON) |
| Consistent with implementation | ❌ See CC-1 through CC-8 |
| Missing business rules | ⚠️ See below |

**Issues:**

🔴 CRITICAL (CC-2) — PPF plan prices: spec matches JSON but implementation defaults differ at all large-vehicle tiers.

🔴 CRITICAL (CC-3) — PPF vehicle ranks: spec/JSON has 4 ranks (std/premium/upper/luxury); implementation has 3 (std/premium/ultra).

🔴 CRITICAL (CC-4) — PPF film types: spec/JSON has carbon(1.5)/color(1.8); implementation has color(1.2)/self-heal(1.1).

🔴 CRITICAL (CC-5) — Window film grades: spec/JSON has high-heat/security; implementation has uv-cut/ir-cut.

🔴 CRITICAL (CC-6) — Window film parts: IDs and prices differ (see CC-6 table).

🔴 CRITICAL (CC-7) — Room cleaning parts: prices and IDs differ (see CC-7 table).

🔴 CRITICAL (CC-8) — Steps §4.5–4.10 (PPF, window, maintenance, carwash, roomclean, other) are PLACEHOLDER screens in the implementation. Spec is correct for what should be built but the current implementation does not render them.

⚠️ WARNING — §4.2 body sizes: spec accurately flags XL/XXL vs LL+ as an inconsistency. However, `dealer-settings-defaults.ts` resolves this by using XL as the 7th key (not LL+). The PPF `plan_prices` keys in defaults.ts use `_XL` suffix, consistent with the body size table. The canonical JSON uses `LL+`. This must be resolved canonically.

⚠️ WARNING — §4.5 PPF plan label: spec says フロントフル (matches JSON), but `dealer-settings-defaults.ts` says フロントハーフ. One is wrong.

⚠️ WARNING — §2 category labels: implementation uses different display labels than JSON. JSON has `コーティング（GYEON）`; wizard uses `ボディコーティング`. JSON has `洗車`; wizard uses `メンテナンス洗車`. JSON has `メンテナンス`; wizard uses `ボディ定期メンテナンス`. These are display-name differences, acceptable IF they map to the same canonical category IDs.

⚠️ WARNING — §4.1 STEP1: spec correctly documents `dealer_rate` default as 100, but `dealer-settings-defaults.ts` defines `DEFAULT_DEALER_RATE = 70`. These differ. Operator must confirm: is the default rate 100% (no discount) or 70%?

❌ MISSING — §3 Flow transitions: spec says `screen-home` is the start screen. In the implementation, the home page is a separate route (`src/app/page.tsx`); EstimateWizard starts directly at `category`. The home screen is not part of the wizard. This split is not documented.

❌ MISSING — No mention that steps §4.5–4.10 are PLACEHOLDER (UI not yet built). This creates a false impression that the spec describes a working implementation.

📋 RECOMMENDATION — Add an implementation status column or footer to each step in §4 noting which steps are fully implemented vs placeholder.

---

### 04_SETTINGS_WORKFLOW.md

| Check | Result |
|-------|--------|
| Internal consistency | ✅ PASS |
| Consistent with `gyeon_settings_flow.json` | ✅ PASS |
| Consistent with implementation | ⚠️ See below |
| Consistent with Supabase schema | ⚠️ See below |

**Issues:**

🔴 CRITICAL (CC-1) — §7 table heading says "All canonical settings keys (39)" — count of keys listed in the table is 37. The number 39 is wrong throughout. Should be 37.

⚠️ WARNING — §1 Auth flow: references the canonical JSON's custom `AuthToken`/`/api/auth/*` scheme extensively, with a note that implementation uses Supabase Auth instead. The warning is correct but its placement causes reader confusion. Consider leading with the implemented system and moving the canonical JSON reference to an appendix.

⚠️ WARNING — §5.4 Detailer rank: correctly states valid values are `detailer`/`certified`. References `11_CANONICAL_RULES.md §7.2` — this reference is correct and consistent.

⚠️ WARNING — §6 Drawer Save Mechanism: describes the legacy KV+IndexedDB save path in detail. The implemented path (Supabase `dealer_settings`) is mentioned as a discrepancy note but not fully documented. A reader may implement against the wrong path.

❌ MISSING — §7 settings keys table does not include the canonical Supabase column equivalents for each key. A mapping table (JSON key → `dealer_settings` column name) is needed to verify implementation completeness.

❌ MISSING — No documentation of the extra JSONB extension columns from migration 070 that do NOT correspond to canonical settings keys: `store_profile`, `business_days`, `dealer_trade_defaults`, `ocr_policy`, `line_public_settings`, `line_message_templates`, `pdf_settings`, `document_settings`, `tax_settings`, `backup_settings`, `health_settings`, `reminder_templates`. These exist in the schema but the settings workflow doc doesn't describe them.

📋 RECOMMENDATION — Add a mapping table: 37 canonical keys → corresponding `dealer_settings` column or JSONB path.

---

### 05_DATABASE_REQUIREMENTS.md

| Check | Result |
|-------|--------|
| Internal consistency | ⚠️ See below |
| Consistent with `gyeon_flow.json` | ✅ PASS |
| Consistent with `gyeon_settings_flow.json` | ⚠️ See CC-1 |
| Consistent with Supabase migrations | ❌ See below |

**Issues:**

🔴 CRITICAL — §4 dealer_settings column listing says "New columns count: 19." Migration 070 actually adds **32 new columns**. The count is significantly wrong.

The 13 extra columns in the migration not listed in the spec:
`store_profile`, `business_days`, `dealer_trade_defaults`, `ocr_policy`, `line_public_settings`, `line_message_templates`, `pdf_settings`, `document_settings`, `tax_settings`, `backup_settings`, `health_settings`, `reminder_templates`, and `business_website` (was it pre-existing?).

🔴 CRITICAL — §5 "Pending Migrations" presents 5 separate draft migrations that have not been created. In reality, **migration 070 exists** in `supabase/migrations/` and covers all 5. The spec is stale and contradicts the actual codebase state.

🔴 CRITICAL (CC-1) — §1.3 says "39 keys" — should be 37.

⚠️ WARNING — §4 column listing does not include `reminder_templates` (the alias column for `maintenance_reminder_templates` added in migration 070). Applications should read `maintenance_reminder_templates` first and fall back to `reminder_templates`. This dual-column logic is undocumented in the spec.

⚠️ WARNING — §4.3 `coupon_settings` JSONB and §4.4 `maintenance_reminder_templates` JSONB schemas are present and correct. However, the `CanonicalDealerSettings` TypeScript type in `dealer-settings-types.ts` shows these as non-nullable arrays (defaults applied in code) even though DB columns are nullable. This asymmetry should be documented.

⚠️ WARNING — §6 Persistence Architecture ratified resolution is present and correct. However, the open question "has migration 070 been applied?" is not listed as a known unknown.

❌ MISSING — The spec does not document the 12 extra jsonb extension blobs added by migration 070 (listed in CC-9). These columns are in the schema and in `dealer-settings-types.ts` (`OcrPolicySettings`, `PdfSettings`, `DocumentSettings`, `TaxSettings`, `DealerTradeDefaults`, etc.) but are absent from the spec.

❌ MISSING — `reminder_templates` dual-column fallback logic is not documented.

❌ MISSING — No documentation of `CanonicalDealerSettings` TypeScript type in `src/lib/dealer-settings/dealer-settings-types.ts`. This is the implemented read contract and should be referenced.

📋 RECOMMENDATION — Revise §4 to use migration 070 as the source of truth for the actual column set (32 new columns). Remove §5 and replace with a single entry referencing migration 070.

📋 RECOMMENDATION — Add §4.x documenting each extra JSONB extension blob and its intended use.

---

### 06_OCR_REQUIREMENTS.md

| Check | Result |
|-------|--------|
| Internal consistency | ✅ PASS |
| Consistent with `gyeon_flow.json` | ✅ (OCR not in canonical JSON — correctly noted) |
| Consistent with `gyeon_settings_flow.json` | ✅ (OCR not in canonical JSON — correctly noted) |
| Consistent with implementation | ✅ PASS |
| Consistent with Supabase schema (mig 067, 070) | ⚠️ See below |

**Issues:**

⚠️ WARNING — §5 lists `ocr_enabled` column. Migration 070 also adds `ocr_policy` JSONB column (`OcrPolicySettings` type with `human_confirmation_required`, `allowed_formats`, `max_file_size_mb`). This column is missing from the spec.

⚠️ WARNING — §3 status table shows `ocr_enabled` as NOT SET locally. If migration 070 has been applied, `ocr_enabled` defaults to `true` DB-side. The spec's "currently unset" description is about the environment variable `OPENAI_API_KEY`, not the DB column — this distinction should be clarified.

❌ MISSING — `ocr_policy` JSONB column and its schema are absent from this document.

❌ MISSING — The `vehicle_registration_ocr` table (migration 067) has no schema documented in this spec. Fields, RLS policy, and retention rules are not specified.

❌ MISSING — §6 lists field-mapping contract as a gap but does not provide even a draft mapping. The JSON extraction fields (owner name, address, plate, chassis number, inspection dates) should be enumerated even if their mapping to `currentEstimate.car` is marked as "to be confirmed."

📋 RECOMMENDATION — Add a vehicle_registration_ocr table schema section.  
📋 RECOMMENDATION — Draft a field mapping table even if preliminary.

---

### 07_LINE_REQUIREMENTS.md

| Check | Result |
|-------|--------|
| Internal consistency | ✅ PASS |
| Consistent with `gyeon_settings_flow.json` | ✅ PASS |
| Consistent with implementation | ✅ PASS |
| Consistent with Supabase schema (mig 070) | ⚠️ See below |
| Missing security requirements | ✅ None — security rules are comprehensive |

**Issues:**

⚠️ WARNING — §5 column table lists `friend_add_qr_url`, `line_message_header/footer`, `maintenance_message_header/footer`, `sns_urls` as `➕ ADD`. Migration 070 already includes all of these via `ADD COLUMN IF NOT EXISTS`. Pending/added status is ambiguous without knowing if migration 070 has been applied.

❌ MISSING — `line_public_settings` JSONB column (added in migration 070) is absent from §5. This column is intended for public-safe LINE display settings and must never contain secrets.

❌ MISSING — `line_message_templates` JSONB column (added in migration 070) is absent from §5. Schema: `{ "estimate_sent": {header, footer}, "maintenance_reminder": {header, footer} }`.

❌ MISSING — The distinction between `line_message_header/footer` (individual text columns) and `line_message_templates` (structured JSONB for the same purpose) creates a dual-path ambiguity. Which should the application write to? This is unresolved.

📋 RECOMMENDATION — Add `line_public_settings` and `line_message_templates` to §5.  
📋 RECOMMENDATION — Resolve the dual-path ambiguity (individual columns vs `line_message_templates` JSONB) as an operator decision.

---

### 08_UI_REQUIREMENTS.md

| Check | Result |
|-------|--------|
| Internal consistency | ✅ PASS |
| Consistent with `gyeon_flow.json` | ✅ PASS |
| Consistent with `gyeon_settings_flow.json` | ✅ PASS |
| Consistent with implementation | ⚠️ See below |

**Issues:**

⚠️ WARNING (CC-8) — §3 UI Status table shows "Estimate wizard ✅ Complete (mobile)." This is partially correct — category selection through STEP5 is implemented. However, 6 of 13 canonical steps (step-ppf, step-window, step-maintenance, step-carwash, step-roomclean, step-other) are defined as `PLACEHOLDER_SCREENS` in `EstimateWizard.tsx` and show no detailed category-specific UI. The table does not distinguish routing-complete from UI-complete, which is misleading.

⚠️ WARNING — §3 does not distinguish between category selection/STEP1/STEP2/STEP3/STEP4/STEP5 (implemented) and the 6 service-specific steps (placeholder). The table needs a more granular breakdown.

⚠️ WARNING — §2 Device strategy: the iframe approach for PC screens is documented, but the known risk (stale-cache, no live data, development complexity) is not discussed. This is a pending Phase D decision and should be flagged here.

❌ MISSING — No mention of `PLACEHOLDER_SCREENS` constant in EstimateWizard.tsx or its implication that 6 of 13 canonical screens are not yet built.

❌ MISSING — No screen-level implementation status breakdown (which of the 13 canonical screens are fully implemented vs placeholder vs navigation-only).

📋 RECOMMENDATION — Add a 13-screen implementation status table with: screen ID, canonical name, mobile status (implemented/placeholder/navigation-only), desktop status.

---

### 09_PHASE_STATUS.md

| Check | Result |
|-------|--------|
| Internal consistency | ✅ PASS |
| Consistent with implementation | ⚠️ See below |
| Complete phase coverage | ⚠️ See below |

**Issues:**

✅ PASS — §1.2 correctly lists PHASE70–71 as "dealer_settings canonical schema consolidation (migration 070)."

✅ PASS — §1 Post-phase work correctly records the SDD master_specification creation (2026-06-25).

⚠️ WARNING — §4 Feature Completion table: LINE CRM (row 9) and OCR (row 21) are marked `✅ (code)` without distinguishing that they require environment variable provisioning before they function. A `🟡 (code-complete, inactive)` status would be more accurate.

⚠️ WARNING — §3 Pending Phases item 5 says "5 pending migrations (CTO approval required)" but the actual codebase has migration 070 already created as a single combined file. Should reference "apply migration 070" specifically.

⚠️ WARNING — §3 Pending Phases item 6 says "confirm 39 settings keys covered" — the correct count is 37 (CC-1). Must be updated to 37.

⚠️ WARNING — §5 Version Note refers to "1.1.0-dev" as a recommendation. Mark as operator decision item OD-14.

❌ MISSING — §4 Estimate Builder (row 3) is marked ✅ but 6 of 13 wizard steps are PLACEHOLDER screens with no detailed UI (CC-8). Status should distinguish routing-complete from UI-complete.

📋 RECOMMENDATION — Correct pending phase item 5 to reference "apply migration 070" instead of "5 draft migrations."  
📋 RECOMMENDATION — Correct pending phase item 6 to say "37 settings keys" (not 39).

---

### 10_ROADMAP.md

| Check | Result |
|-------|--------|
| Internal consistency | ✅ PASS |
| Consistent with documented project plans | ✅ PASS |
| No invented features | ✅ PASS |

**Issues:**

⚠️ WARNING — Phase C says "Execute pending dealer_settings migrations (5 drafts in `05_DATABASE_REQUIREMENTS.md` §5)." This reference is stale — migration 070 already exists. Phase C should reference applying migration 070, not 5 draft migrations.

✅ PASS — Phase E v1.1 correctly omits OCR (already PHASE67). OCR activation is correctly placed in Phase B.

⚠️ WARNING — No sequencing dependency noted between Phase B (activate LINE) and Phase C (migrate dealer_settings). Activating LINE requires migration 070 LINE columns to be applied first. This dependency is implicit but not stated.

❌ MISSING — No mention of PHASE74 (this audit) or its outputs as a prerequisite gate for Phase A/B/C work.

📋 RECOMMENDATION — Update Phase C to reference "apply migration 070" instead of "5 draft migrations."  
📋 RECOMMENDATION — Add a dependency note: Phase B LINE activation requires migration 070 to be applied first.

---

### 11_CANONICAL_RULES.md

| Check | Result |
|-------|--------|
| Internal consistency | ✅ PASS |
| Rules coverage — business | ✅ PASS |
| Rules coverage — security | ✅ PASS |
| Rules coverage — database | ⚠️ See below |
| Rules coverage — estimate flow | ✅ PASS |

**Issues:**

⚠️ WARNING — §3 Database rules: "Migrations are additive only" is correct, but there is no rule about the dual-column (`maintenance_reminder_templates` + `reminder_templates`) read-fallback logic that migration 070 introduced. Applications must know the fallback order.

⚠️ WARNING — §7 dealer_settings rules: mentions `ppf_price_tables` has 5 table groups, but does not mention the `roof` plan key that appears in `dealer-settings-defaults.ts` (`roof_SS`, `roof_S`, etc.). The canonical JSON does not include a `roof` plan. This may be an extension or a deviation; it needs explicit treatment.

⚠️ WARNING — §7 does not mention the extra JSONB extension blobs added by migration 070. These exist in the schema and types but have no governing rules in this document.

❌ MISSING — No rule covering `line_public_settings` security: it must never contain `line_channel_secret` or `line_access_token`. The rule exists in §2 (general LINE secret rule) but should be explicitly called out for `line_public_settings`.

❌ MISSING — No rule about the `ocr_policy.human_confirmation_required` invariant: this field must always be `true` in stored data and in code; it must never be settable to `false` through any UI or API.

❌ MISSING — No rule about migration 070's `reminder_templates` fallback: applications should read `maintenance_reminder_templates` first; if NULL, fall back to `reminder_templates`; if both NULL, use hardcoded defaults.

📋 RECOMMENDATION — Add §7.8 covering the reminder_templates dual-column read order.  
📋 RECOMMENDATION — Add §7.9 covering the `roof` plan key: either document it as an approved extension or flag it as a deviation from canonical JSON.  
📋 RECOMMENDATION — Add explicit `ocr_policy.human_confirmation_required: always true` rule.

---

## OPERATOR DECISIONS REQUIRED

The following are open decisions that only the operator can make. Implementation must not proceed on these items until they are resolved.

| # | Topic | Documents affected | Question |
|---|-------|--------------------|----------|
| OD-1 | **Migration 070 applied?** | 05, 09 | Has `070_dealer_settings_canonical.sql` been applied to the database? All downstream column-dependent features depend on this answer. |
| OD-2 | **Canonical PPF prices** | 03, 05 | Which PPF plan prices are canonical — `gyeon_flow.json` (lower) or `dealer-settings-defaults.ts` (higher)? The full-body LL difference is ¥120,000. |
| OD-3 | **PPF vehicle ranks** | 03, 05, 11 | 4-rank system (std/premium/upper/luxury from JSON) or 3-rank system (std/premium/ultra from defaults)? The auto-detect logic uses the 4-rank names. |
| OD-4 | **PPF film types** | 03, 05 | Which film types are canonical — JSON (carbon/color@1.8) or defaults (color@1.2/self-heal)? |
| OD-5 | **Window film grades** | 03, 04 | JSON grades: high-heat/security. Defaults: uv-cut/ir-cut. Which is canonical? |
| OD-6 | **Window film part IDs** | 03, 04 | JSON IDs: wf-rear-glass, wf-rear-qtr. Defaults IDs: wf-rear, wf-quarter. Which set is canonical? |
| OD-7 | **Room cleaning parts** | 03, 04 | JSON includes rc-door and rc-trunk; defaults do not. Are these parts supported? |
| OD-8 | **Settings key count** | 04, 05, 11 | Is the canonical count 37 (JSON) or 39 (as stated in all spec docs)? If 39, which 2 keys are missing from the JSON? |
| OD-9 | **Default dealer rate** | 03 | STEP1 spec says default `dealer_rate = 100%`. `dealer-settings-defaults.ts` says `DEFAULT_DEALER_RATE = 70`. Which is correct? |
| OD-10 | **PPF plan label** | 03, 04 | JSON: フロントフル. Defaults: フロントハーフ. Which is the correct product name? |
| OD-11 | **LINE message dual-path** | 07, 11 | Individual columns (`line_message_header/footer`) vs JSONB blob (`line_message_templates`) — which should the application write to? |
| OD-12 | **`roof` PPF plan** | 05, 11 | `dealer-settings-defaults.ts` has `roof_*` plan keys not in the canonical JSON. Is this an approved extension or a deviation? |
| OD-13 | **Activate g5 settings group** | 04, 07 | When will LINE settings group g5 (currently hidden/準備中) be made visible? This determines when LINE activation becomes user-configurable. |
| OD-14 | **Version track** | 09 | Continue as 1.0.0, or introduce 1.1.0-dev for the post-v1 work? |

---

## SUMMARY TABLE

| Document | Overall Status | Critical | Warning | Missing |
|----------|---------------|----------|---------|---------|
| 01_PROJECT_OVERVIEW.md | ⚠️ WARNING | 0 | 2 | 0 |
| 02_SYSTEM_ARCHITECTURE.md | ⚠️ WARNING | 0 | 2 | 2 |
| 03_BUSINESS_WORKFLOW.md | 🔴 CRITICAL | 7 | 4 | 2 |
| 04_SETTINGS_WORKFLOW.md | 🔴 CRITICAL | 1 | 3 | 2 |
| 05_DATABASE_REQUIREMENTS.md | 🔴 CRITICAL | 3 | 3 | 4 |
| 06_OCR_REQUIREMENTS.md | ⚠️ WARNING | 0 | 2 | 3 |
| 07_LINE_REQUIREMENTS.md | ⚠️ WARNING | 0 | 2 | 3 |
| 08_UI_REQUIREMENTS.md | ⚠️ WARNING | 0 | 3 | 2 |
| 09_PHASE_STATUS.md | ⚠️ WARNING | 0 | 4 | 2 |
| 10_ROADMAP.md | ⚠️ WARNING | 0 | 3 | 1 |
| 11_CANONICAL_RULES.md | ⚠️ WARNING | 0 | 3 | 3 |

---

## PRIORITY REMEDIATION ORDER

Work items ordered by impact. All are documentation-only.

### P1 — Resolve before any implementation work begins

1. **OD-1**: Confirm migration 070 applied status → update §1.2 of `09_PHASE_STATUS.md`.
2. **OD-2 through OD-7**: Decide which prices/IDs/ranks are canonical → update `03_BUSINESS_WORKFLOW.md` and `05_DATABASE_REQUIREMENTS.md`.
3. **CC-1 fix**: Replace "39 keys" → "37 keys" in `04_SETTINGS_WORKFLOW.md` §7 and `05_DATABASE_REQUIREMENTS.md` §1.3.
4. **CC-8 fix**: Add implementation status column to `03_BUSINESS_WORKFLOW.md` §4 steps; update `08_UI_REQUIREMENTS.md` §3 to mark 6 wizard steps as placeholder.

### P2 — Resolve before Phase B (integration activation)

5. **07 + OD-11**: Add `line_public_settings` + `line_message_templates` to `07_LINE_REQUIREMENTS.md`; resolve dual-path ambiguity.
6. **06 fix**: Add `ocr_policy` JSONB schema to `06_OCR_REQUIREMENTS.md`; add `vehicle_registration_ocr` table schema.
7. **05 fix**: Revise §4 column count (19 → 32); revise §5 (5 drafts → migration 070 exists).

### P3 — Resolve during Phase C (spec reconciliation)

8. **09 fix**: Add PHASE70 + PHASE71 to completed phases.
9. **11 fix**: Add rules for `reminder_templates` fallback, `roof` PPF plan status, `ocr_policy.human_confirmation_required` invariant.
10. **OD-8**: Confirm settings key count (37 vs 39) against actual canonical JSON.
11. **10 fix**: Update roadmap to reference migration 070 instead of "5 draft migrations."

---

*GYEON Detailer Agent | PHASE74 Audit | Office AZ | 2026-06-25*  
*Audit only — no code, no migrations, no UI, no commits modified.*
