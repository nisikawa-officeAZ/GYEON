# OPERATOR DECISIONS
## GYEON Detailer Agent — Required Business Decisions

**Date:** 2026-06-25  
**Source:** PHASE74 Audit + PHASE75 Finalization  
**Authority:** Only the operator (business owner / CTO) can resolve these items.

> Implementation must not proceed on any item below until the operator has decided.
> Record the decision date and rationale here when resolved.

---

## HOW TO USE THIS DOCUMENT

1. Review each decision item.
2. Fill in the **Decision** column with your choice.
3. Fill in the **Date** and **Rationale** columns.
4. Notify the engineering team so the relevant spec and implementation files can be updated.

Items marked 🔴 BLOCKER must be resolved before Phase B or C work can begin.  
Items marked ⚠️ IMPORTANT must be resolved before the specific feature is activated.  
Items marked 📋 NORMAL can be deferred to Phase C.

---

## SECTION 1 — DATABASE STATE

### OD-1 🔴 BLOCKER — Migration 070 applied status

**Question:** Has `supabase/migrations/070_dealer_settings_canonical.sql` been applied to the database (staging and/or production)?

**Why it matters:** Every column-dependent feature (LINE settings, OCR settings, pricing settings, reminder templates) depends on these columns existing in `dealer_settings`. If migration 070 has not been applied, all Phase B activation work will fail at the DB level.

**Background:** Migration 070 is a complete, well-formed SQL file in the repo with `ADD COLUMN IF NOT EXISTS` for 32 columns. It was authored in PHASE70. The migration comment says "DO NOT AUTO-APPLY — paste into Supabase SQL Editor manually."

**Choices:**
- [ ] A) Applied to staging only — not yet on production
- [ ] B) Applied to both staging and production
- [ ] C) Not yet applied to any environment
- [ ] D) Applied to production only (not recommended)

**Decision:** ____________________  
**Date:** ____________________  
**Rationale:** ____________________

---

## SECTION 2 — PPF PRICING

### OD-2 🔴 BLOCKER — Canonical PPF plan prices

**Question:** Which PPF plan price table is canonical — `gyeon_flow.json` (lower) or `dealer-settings-defaults.ts` (higher)?

**Divergence table (full-body plan):**

| Size | JSON (canonical) | Defaults.ts (implementation) | Delta |
|------|-----------------|------------------------------|-------|
| SS | ¥250,000 | ¥280,000 | +¥30,000 |
| S  | ¥290,000 | ¥320,000 | +¥30,000 |
| M  | ¥330,000 | ¥360,000 | +¥30,000 |
| ML | ¥350,000 | ¥415,000 | +¥65,000 |
| L  | ¥370,000 | ¥470,000 | +¥100,000 |
| LL | ¥430,000 | ¥550,000 | +¥120,000 |
| 7th size | ¥520,000 | ¥650,000 | +¥130,000 |

**Front-half differences:** ML: ¥180k vs ¥195k | L: ¥190k vs ¥220k | LL: ¥220k vs ¥260k | 7th: ¥260k vs ¥300k

**Choices:**
- [ ] A) JSON values are canonical — update defaults.ts to match JSON prices
- [ ] B) Defaults.ts values are canonical — update gyeon_flow.json to match implementation (then update 03_BUSINESS_WORKFLOW.md)
- [ ] C) Neither — provide correct price table here: ____________________
- [ ] D) Both are correct for different markets/tiers — explain: ____________________

**Decision:** ____________________  
**Date:** ____________________  
**Rationale:** ____________________

---

### OD-3 🔴 BLOCKER — PPF vehicle rank system

**Question:** 4-rank system (JSON) or 3-rank system (implementation)?

| Source | Ranks |
|--------|-------|
| `gyeon_flow.json` (canonical) | std(1.0), premium(1.3), upper(1.5), luxury(1.8) |
| `dealer-settings-defaults.ts` | std(1.0), premium(1.3), ultra(1.6) |

**Impact:** The auto-detect logic in `gyeon_flow.json` references `upper` and `luxury` rank IDs. If the implementation uses `ultra`, the auto-detect feature is broken for 2 of 4 rank tiers.

**Choices:**
- [ ] A) 4-rank system is canonical (JSON): std/premium/upper/luxury — update implementation
- [ ] B) 3-rank system is canonical (implementation): std/premium/ultra — update JSON and spec
- [ ] C) Different system entirely — provide: std/premium/_______ (coeff: ___)

**Decision:** ____________________  
**Date:** ____________________  
**Rationale:** ____________________

---

### OD-4 🔴 BLOCKER — PPF film types

**Question:** Which film type IDs and coefficients are canonical?

| Source | Film types (coeff) |
|--------|--------------------|
| `gyeon_flow.json` (canonical) | clear(1.0), matte(1.3), carbon(1.5), color(1.8) |
| `dealer-settings-defaults.ts` | clear(1.0), matte(1.3), color(1.2), self-heal(1.1) |

**Note:** `carbon` is in the JSON but not in defaults. `self-heal` is in defaults but not in JSON. `color` has different coefficients (1.8 vs 1.2).

**Choices:**
- [ ] A) JSON values are canonical: clear/matte/carbon/color — update defaults.ts
- [ ] B) Defaults.ts values are canonical: clear/matte/color/self-heal — update JSON and spec
- [ ] C) Custom film set — provide: ____________________

**Decision:** ____________________  
**Date:** ____________________  
**Rationale:** ____________________

---

### OD-10 🔴 BLOCKER — PPF front-half plan label

**Question:** What is the correct product name for the `front-half` PPF plan?

| Source | Label |
|--------|-------|
| `gyeon_flow.json` (canonical) | フロントフル |
| `dealer-settings-defaults.ts` | フロントハーフ |

**Choices:**
- [ ] A) フロントフル (matches JSON)
- [ ] B) フロントハーフ (matches implementation)
- [ ] C) Other: ____________________

**Decision:** ____________________  
**Date:** ____________________  
**Rationale:** ____________________

---

### OD-15 ⚠️ IMPORTANT — PPF/body size 7th key

**Question:** What is the canonical key name for the 7th (largest) body size in PPF plan prices?

| Source | Key | Label |
|--------|-----|-------|
| `gyeon_flow.json` (canonical) | LL+ | (implies continuation of LL) |
| `dealer-settings-defaults.ts` | XL | 高級大型 |
| `EstimateWizard.tsx` BODY_SIZES | XL and XXL | XL=高級大型, XXL=プレミアムカー |

**Note:** The wizard actually has 8 sizes (SS/S/M/ML/L/LL/XL/XXL) but the JSON has 7 plan keys. The JSON key `LL+` does not exist in the body size table.

**Choices:**
- [ ] A) XL is the correct 7th key — update JSON and spec to use XL
- [ ] B) LL+ is the correct 7th key — update implementation to use LL+
- [ ] C) The plan price table should cover 8 sizes matching the body size table — provide complete mapping

**Decision:** ____________________  
**Date:** ____________________  
**Rationale:** ____________________

---

## SECTION 3 — WINDOW FILM PRICING

### OD-5 ⚠️ IMPORTANT — Window film grade names and coefficients

**Question:** Which window film grade IDs and coefficients are canonical?

| Source | Grades (coeff) |
|--------|----------------|
| `gyeon_flow.json` (canonical) | standard(1.0), premium(1.3), high-heat(1.6), security(1.2) |
| `dealer-settings-defaults.ts` | standard(1.0), premium(1.3), uv-cut(1.1), ir-cut(1.2) |

**Note:** `high-heat` and `security` are completely different product categories from `uv-cut` and `ir-cut`. This is not a naming difference — it is a different product line.

**Choices:**
- [ ] A) JSON values are canonical: standard/premium/high-heat/security — update defaults.ts
- [ ] B) Defaults.ts values are canonical: standard/premium/uv-cut/ir-cut — update JSON and spec
- [ ] C) Custom grade set — provide: ____________________

**Decision:** ____________________  
**Date:** ____________________  
**Rationale:** ____________________

---

### OD-6 ⚠️ IMPORTANT — Window film part IDs and prices

**Question:** Which window film part IDs and base prices are canonical?

| Part (Japanese) | JSON id / ¥ | Defaults.ts id / ¥ | Decision |
|-----------------|-------------|---------------------|----------|
| リアドアガラス | wf-rear-side / 22,000 | wf-rear-side / 20,000 | Price only |
| リアガラス | wf-rear-glass / 20,000 | wf-rear / 18,000 | ID + price |
| リアクォーターガラス | wf-rear-qtr / 15,000 | wf-quarter / 12,000 | ID + price |
| サンルーフ | wf-sunroof / 18,000 | (absent) | ID + price |
| フロントガラス | wf-windshield / 30,000 | (absent) | ID + price |
| 全窓セット | wf-all / 90,000 | wf-all / 80,000 | Price only |

For missing parts in defaults.ts (wf-sunroof, wf-windshield): are these supported parts?

**Choices:**
- [ ] A) JSON values are canonical — update defaults.ts to match (including adding wf-sunroof and wf-windshield)
- [ ] B) Defaults.ts values are canonical — update JSON and spec (remove wf-sunroof and wf-windshield)
- [ ] C) Provide correct table: ____________________

**Decision:** ____________________  
**Date:** ____________________  
**Rationale:** ____________________

---

## SECTION 4 — ROOM CLEANING PRICING

### OD-7 ⚠️ IMPORTANT — Room cleaning parts list and prices

**Question:** Which room cleaning parts are supported, and at what prices?

| Part (Japanese) | JSON id / ¥ | Defaults.ts id / ¥ | Status |
|-----------------|-------------|---------------------|--------|
| フロアマット | rc-floor / 12,000 | rc-floor / 12,000 | ✅ Match |
| シート | rc-seat / 20,000 | rc-seat / 15,000 | Price differs |
| 天井 | rc-ceiling / 15,000 | rc-ceiling / 8,000 | Price differs |
| ドアトリム | rc-door / 10,000 | (absent) | Missing from defaults |
| ダッシュボード | rc-dash / 8,000 | rc-dash / 10,000 | Price differs |
| トランク | rc-trunk / 8,000 | (absent) | Missing from defaults |
| 全室内セット | (absent) | rc-full / 45,000 | Extra in defaults |

**Choices:**
- [ ] A) JSON values are canonical — update defaults.ts (add rc-door, rc-trunk; remove rc-full; correct prices)
- [ ] B) Defaults.ts values are canonical — update JSON and spec
- [ ] C) Provide correct parts and prices: ____________________

**Decision:** ____________________  
**Date:** ____________________  
**Rationale:** ____________________

---

## SECTION 5 — DEFAULT VALUES

### OD-9 ⚠️ IMPORTANT — Default dealer trade rate

**Question:** What is the correct default dealer discount rate?

| Source | Value | Meaning |
|--------|-------|---------|
| `03_BUSINESS_WORKFLOW.md` §4.1 (from JSON) | 100% | No discount by default |
| `dealer-settings-defaults.ts` DEFAULT_DEALER_RATE | 70% | 30% discount by default |

**Note:** A default of 70% means all dealer estimates are automatically discounted 30%. A default of 100% means no discount unless set explicitly.

**Choices:**
- [ ] A) 100% default (no discount) — update defaults.ts
- [ ] B) 70% default (30% discount) — update JSON and spec
- [ ] C) Other: ______%

**Decision:** ____________________  
**Date:** ____________________  
**Rationale:** ____________________

---

## SECTION 6 — SETTINGS KEY COUNT

### OD-8 📋 NORMAL — Canonical settings key count: 37 or 39?

**Question:** Is the canonical settings key count 37 or 39?

**Background:** PHASE75 fixes all spec docs from "39" to "37" based on direct count of `gyeon_settings_flow.json` `all_settings_keys` array (37 entries). However, some prior documentation written before the SDD restructuring stated 39. If 39 was intentional, 2 keys are missing from the JSON.

**Choices:**
- [ ] A) 37 is correct — the count of 39 in old docs was an error (default assumption)
- [ ] B) 39 is correct — 2 keys are missing from the JSON. Identify the missing keys: ____________________

**Decision:** ____________________  
**Date:** ____________________  
**Notes:** If B, engineering must add the 2 missing keys to the canonical JSON and re-verify the spec.

---

## SECTION 7 — LINE SETTINGS

### OD-11 ⚠️ IMPORTANT — LINE message: individual columns vs JSONB template

**Question:** When sending LINE messages, which column should the application read from?

| Column | Type | Purpose |
|--------|------|---------|
| `line_message_header` (text) | Individual text | 見積LINE転送・冒頭文 |
| `line_message_footer` (text) | Individual text | 見積LINE転送・末尾文 |
| `line_message_templates` (jsonb) | Structured JSONB | `{estimate_sent: {header, footer}, maintenance_reminder: {header, footer}}` |

Both column sets exist in migration 070. Using both paths simultaneously would cause inconsistency.

**Choices:**
- [ ] A) Individual text columns are canonical — deprecate `line_message_templates`
- [ ] B) `line_message_templates` JSONB is canonical — individual columns are legacy stubs
- [ ] C) Individual columns for display; JSONB for send operations (dual path by purpose)

**Decision:** ____________________  
**Date:** ____________________  
**Rationale:** ____________________

---

### OD-13 ⚠️ IMPORTANT — Activate LINE settings group g5

**Question:** When will LINE settings group g5 (currently hidden / 準備中) be made visible in the settings UI?

**Context:** Group g5 (SNS・LINE連携) is currently hidden with a "準備中" label. Making it visible requires LINE credentials to be configured first (OD-1 + env vars). The settings UI that reads from g5 must be designed and implemented.

**Choices:**
- [ ] A) Activate g5 in Phase B (integration activation) — immediately after env vars are provisioned
- [ ] B) Activate g5 in Phase D (hardening) — after full testing
- [ ] C) Activate per-dealer basis when their LINE channel is provisioned

**Decision:** ____________________  
**Date:** ____________________  
**Rationale:** ____________________

---

## SECTION 8 — PPF EXTENSION

### OD-12 📋 NORMAL — `roof` PPF plan in implementation defaults

**Question:** Is the `roof` PPF plan (`roof_SS`, `roof_S`, etc. in `dealer-settings-defaults.ts`) an approved product extension or a deviation from the canonical JSON?

**Context:** `gyeon_flow.json` defines three PPF plans: `front-half`, `full-body`, `partial`. The implementation defaults include a fourth plan `roof` with its own price table. This plan is not in the canonical JSON.

**Choices:**
- [ ] A) Approved extension — add `roof` plan to the canonical JSON and spec
- [ ] B) Deviation — remove `roof` plan from defaults.ts in Phase C
- [ ] C) Keep in defaults but explicitly exclude from standard estimate flow (custom/special order only)

**Decision:** ____________________  
**Date:** ____________________  
**Rationale:** ____________________

---

## SECTION 9 — OCR

### OD-16 📋 NORMAL — OCR field-mapping contract

**Question:** Which fields from the 車検証 (vehicle registration certificate) map to which estimate/vehicle fields?

**Known extracted fields from OCR implementation:** owner name, owner address, vehicle plate number, chassis number, first registration date, inspection expiry date, vehicle model/type.

**Required mapping decisions:**
- Which fields populate `car.maker`, `car.model`, `car.year`?
- How is body size (`sizeKey`) inferred from 車検証 data?
- Which fields are displayed in the OCR review screen?
- Which fields are committed to `vehicles` table on confirmation?

**Decision:** ____________________  
**Date:** ____________________  
**Specification file to update:** `06_OCR_REQUIREMENTS.md` §6.

---

### OD-17 📋 NORMAL — Vehicle registration image retention policy

**Question:** How long should uploaded 車検証 images be retained in private Supabase Storage?

**Context:** 車検証 images contain PII: owner name, address, plate number, chassis number. Storage table is `vehicle_registration_files` with an `archived_at` column for soft deletion.

**Options:**
- [ ] A) Retain indefinitely (current behavior — no automated deletion)
- [ ] B) Delete after OCR confirmation (keep only extracted data)
- [ ] C) Retain for _____ days, then auto-archive
- [ ] D) Retain for _____ days, then permanently delete

**Decision:** ____________________  
**Date:** ____________________  
**Compliance note:** Japanese Act on Protection of Personal Information (APPI) may apply.

---

## SECTION 10 — VERSIONING

### OD-14 📋 NORMAL — Post-v1.0 version track

**Question:** Should the ongoing development (desktop UI, integration activation, spec reconciliation) be tracked as `1.0.0` (same release) or `1.1.0-dev` (new minor track)?

**Context:** `VERSION.md` currently says 1.0.0 "Official Release." Development has continued past this with UI rework, OCR, dealer_settings canonical schema, and now SDD restructuring.

**Choices:**
- [ ] A) Continue as `1.0.0` — version stays frozen until next major milestone
- [ ] B) Introduce `1.1.0-dev` — tracks all post-v1 work; creates clear release milestone
- [ ] C) Skip to `1.1.0` for a planned minor release date: ____________________

**Decision:** ____________________  
**Date:** ____________________  
**Rationale:** ____________________

---

## DECISION STATUS SUMMARY

| OD | Priority | Section | Status |
|----|----------|---------|--------|
| OD-1 | 🔴 BLOCKER | Database state | ⏳ Awaiting |
| OD-2 | 🔴 BLOCKER | PPF plan prices | ⏳ Awaiting |
| OD-3 | 🔴 BLOCKER | PPF vehicle ranks | ⏳ Awaiting |
| OD-4 | 🔴 BLOCKER | PPF film types | ⏳ Awaiting |
| OD-5 | ⚠️ IMPORTANT | Window film grades | ⏳ Awaiting |
| OD-6 | ⚠️ IMPORTANT | Window film parts | ⏳ Awaiting |
| OD-7 | ⚠️ IMPORTANT | Room cleaning parts | ⏳ Awaiting |
| OD-8 | 📋 NORMAL | Settings key count | ⏳ Awaiting (default: 37) |
| OD-9 | ⚠️ IMPORTANT | Default dealer rate | ⏳ Awaiting |
| OD-10 | 🔴 BLOCKER | PPF plan label | ⏳ Awaiting |
| OD-11 | ⚠️ IMPORTANT | LINE message path | ⏳ Awaiting |
| OD-12 | 📋 NORMAL | Roof PPF plan | ⏳ Awaiting |
| OD-13 | ⚠️ IMPORTANT | g5 activation timing | ⏳ Awaiting |
| OD-14 | 📋 NORMAL | Version track | ⏳ Awaiting |
| OD-15 | ⚠️ IMPORTANT | Body size 7th key | ⏳ Awaiting |
| OD-16 | 📋 NORMAL | OCR field mapping | ⏳ Awaiting |
| OD-17 | 📋 NORMAL | Image retention policy | ⏳ Awaiting |

---

## UNBLOCKING PATH

Resolve in this order to unblock Phase B:

1. **OD-1** — Confirm migration 070 DB state (5 min)
2. **OD-2, OD-3, OD-4** — Decide PPF pricing canonical (can be done together: one review session)
3. **OD-5, OD-6** — Decide window film products (one review session)
4. **OD-7** — Decide room cleaning parts (one review session)
5. **OD-9** — Confirm default dealer rate (immediate)
6. **OD-10, OD-15** — Confirm PPF labels and size keys (immediate)

After OD-1 through OD-10 are resolved, Phase B (integration activation) and Phase C (spec reconciliation) can proceed in parallel.

---

*GYEON Detailer Agent | PHASE75 | Office AZ | 2026-06-25*
