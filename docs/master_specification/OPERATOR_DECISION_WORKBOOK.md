# OPERATOR DECISION WORKBOOK
## GYEON Detailer Agent — PHASE78

| Field | Value |
|-------|-------|
| **Version** | 1.0 |
| **Status** | Awaiting Operator Input |
| **Date** | 2026-06-25 |
| **Source** | OPERATOR_DECISIONS.md, MASTER_SPECIFICATION_V1_READY.md, IMPLEMENTATION_BACKLOG.md |
| **Related** | `OPERATOR_DECISIONS.md`, `IMPLEMENTATION_UNLOCK_REPORT.md`, `VERSION1_READINESS_SUMMARY.md` |

> **How to use this workbook:**
> For each decision, review the options, read the advantages/disadvantages, and write your choice in **「Final Selection」** field.
> Resolved decisions here will be transcribed to `OPERATOR_DECISIONS.md` by engineering.

---

## STEP 1 & 2 — Decision Review and Classification

### Category A — Must decide before Version 1.0

| OD | Topic | Why V1.0 cannot ship without this |
|----|-------|----------------------------------|
| OD-1 | Migration 070 apply status | DB foundation — LINE/OCR/settings extensions fail at DB level |
| OD-2 | PPF plan prices | Customer-facing prices are wrong by ¥30k–¥130k |
| OD-3 | PPF vehicle ranks | Auto-detect feature broken for upper/luxury tiers |
| OD-4 | PPF film types | Carbon film missing; color coefficient wrong |
| OD-5 | Window film grades | Different product lines — cannot build selection UI without knowing products |
| OD-6 | Window film part IDs | Wrong IDs stored in estimates DB — breaks data integrity |
| OD-7 | Room cleaning parts | Missing parts + 4 wrong prices quoted to customers |
| OD-9 | Default dealer rate | 70% default discounts ALL estimates 30% — active production defect |
| OD-10 | PPF plan label | Wrong product name shown to customers |
| OD-15 | PPF 7th body size key | Largest vehicles get wrong/missing PPF pricing |

### Category B — Can use temporary default

| OD | Topic | Current default behavior |
|----|-------|--------------------------|
| OD-11 | LINE message dual-path | Individual text columns (currently used) — safe until LINE activated |
| OD-13 | g5 activation timing | Currently hidden (準備中) — safe to leave until Phase B |

### Category C — Defer to Version 1.1+

| OD | Topic | Impact of deferral |
|----|-------|-------------------|
| OD-8 | Settings key count | Already defaulted to 37 (correct per JSON) — no functional impact |
| OD-12 | Roof PPF plan | Not in standard flow — no customer impact |
| OD-14 | Version track | Versioning only — no functional impact |
| OD-16 | OCR field mapping | OCR inactive — needed before Phase B only |
| OD-17 | Image retention | OCR inactive — APPI compliance needed before Phase B |

---

## STEP 3 — OPERATOR DECISION WORKBOOK

---

### OD-1 — Migration 070 Applied Status

**Category:** A — Must decide before V1.0  
**Current status:** ⏳ Awaiting

**Description:** File `supabase/migrations/070_dealer_settings_canonical.sql` exists in the repo but it's unknown whether it has been executed against the Supabase database. This migration adds 32 new columns to `dealer_settings`.

**Why this decision is required:** Without these columns, any feature that reads LINE settings, OCR settings, reminder templates, or extension JSONB fields will get `null` or throw a DB error. All of Phase B (LINE activation, OCR activation) is blocked.

**Affected modules:**
- `dealer_settings` table (all reads and writes)
- LINE settings (`src/lib/line/*`)
- OCR settings (`src/app/api/ocr/*`)
- Reminder templates (`src/lib/maintenance/*`)
- All dealer settings reads (`src/lib/dealer-settings/*`)

**Default currently assumed:** Unknown — no assumption possible.

**Risk if left undecided:** Phase B cannot begin. LINE and OCR activation fail silently or with DB column errors. Settings pages that reference extension columns return nulls.

---

**Options:**

| Choice | Description | Recommended? |
|--------|-------------|-------------|
| A | Applied to staging only — verify, then apply to production | ✅ Best path if staging not done |
| B | Applied to both staging and production already | ✅ Best outcome — nothing to do |
| C | Not yet applied to any environment | Start with staging; production after staging verified |
| D | Applied to production only (skipped staging) | ⚠️ Not recommended — violates staging-first rule |

**Advantages of applying (A/B/C):**
- All 32 columns become available
- LINE/OCR/reminders can be activated in Phase B
- `ADD COLUMN IF NOT EXISTS` makes it 100% safe to re-apply — no risk of double-apply errors

**Disadvantages of not applying:**
- Blocks 50+ checklist items
- Phase B cannot start
- Some settings reads return unexpected nulls

**Recommended default:** Apply to staging immediately, verify, then apply to production. Use choice **B** if already applied.

---

**Final Operator Selection:**
- [ ] A) Applied to staging only
- [ ] B) Applied to both staging and production ← fill this if already done
- [ ] C) Not yet applied — will apply this week
- [ ] D) Applied to production only

**Date decided:** ____________________
**Notes:** ____________________

---

### OD-2 — Canonical PPF Plan Prices

**Category:** A — Must decide before V1.0  
**Current status:** ⏳ Awaiting

**Description:** PPF base prices differ between `gyeon_flow.json` (lower) and `dealer-settings-defaults.ts` (higher) by ¥30,000–¥130,000 depending on body size.

**Why required:** When the PPF wizard step is built, prices are loaded from `dealer-settings-defaults.ts`. If wrong, every PPF estimate shown to customers quotes the wrong amount.

**Affected modules:** `dealer-settings-defaults.ts` (`ppf_price_tables.plan_prices`), `EstimateWizard.tsx` (PPF step), `03_BUSINESS_WORKFLOW.md` §4.5

**Default currently assumed:** `dealer-settings-defaults.ts` values (higher prices) — because the implementation uses this file.

**Risk if left undecided:** PPF estimates quote the wrong price by up to ¥130,000. This is a customer-facing defect.

---

**Divergence table:**

| Size | JSON ¥ | Defaults.ts ¥ | Delta |
|------|---------|--------------|-------|
| SS フルボディ | 250,000 | 280,000 | +30,000 |
| S  フルボディ | 290,000 | 320,000 | +30,000 |
| M  フルボディ | 330,000 | 360,000 | +30,000 |
| ML フルボディ | 350,000 | 415,000 | +65,000 |
| L  フルボディ | 370,000 | 470,000 | +100,000 |
| LL フルボディ | 430,000 | 550,000 | +120,000 |
| 7th フルボディ | 520,000 | 650,000 | +130,000 |

**Options:**

| Choice | Description | Advantages | Disadvantages |
|--------|-------------|-----------|--------------|
| A | JSON values canonical — update defaults.ts to JSON prices | Aligns with canonical spec authority | Reduces revenue if defaults.ts prices were intentional |
| B | Defaults.ts values canonical — update JSON + spec | Preserves higher revenue if correct | Requires updating canonical JSON (Tier 1 doc) |
| C | Provide correct prices manually | Uses actual confirmed GYEON pricing | Requires operator to look up current price list |

**Recommended default:** Whichever matches the current GYEON Japan official price list. **Check the official GYEON dealer price sheet and fill in choice C if neither A nor B matches exactly.**

---

**Final Operator Selection:**
- [ ] A) JSON values are correct
- [ ] B) Defaults.ts values are correct
- [ ] C) Custom — correct price table: ____________________

**Date decided:** ____________________
**Rationale:** ____________________

---

### OD-3 — PPF Vehicle Rank System

**Category:** A — Must decide before V1.0  
**Current status:** ⏳ Awaiting

**Description:** The canonical JSON defines 4 vehicle ranks (std/premium/upper/luxury); the implementation uses 3 ranks (std/premium/ultra). The auto-detect feature in the JSON references `upper` and `luxury` IDs — if these don't exist in the implementation, auto-detection is broken.

**Affected modules:** `dealer-settings-defaults.ts` (`ppf_price_tables.rank_coeff`), `EstimateWizard.tsx` (PPF rank selection), auto-detect logic

**Default currently assumed:** 3-rank system (std/premium/ultra) from defaults.ts.

**Risk if left undecided:** Building PPF step with the wrong rank system means either the UI shows an extra `ultra` rank that doesn't exist in the spec, or the auto-detect feature silently fails for upper/luxury vehicles.

---

**Comparison:**

| Source | Ranks | Coefficients |
|--------|-------|-------------|
| `gyeon_flow.json` | std / premium / upper / luxury | 1.0 / 1.3 / 1.5 / 1.8 |
| `dealer-settings-defaults.ts` | std / premium / ultra | 1.0 / 1.3 / 1.6 |

**Options:**

| Choice | Description | Advantages | Disadvantages |
|--------|-------------|-----------|--------------|
| A | 4-rank JSON system | Auto-detect works for all vehicle tiers; matches canonical | Requires updating defaults.ts; adds upper/luxury UI elements |
| B | 3-rank implementation system | Simpler; no UI changes needed now | Auto-detect broken for 2 ranks; diverges from canonical |
| C | Custom system | Fully customized to operator's needs | Requires updating both JSON and spec |

**Recommended default:** **Choice A** — the 4-rank system. The JSON's `upper` and `luxury` ranks correspond to real vehicle categories (imported luxury cars, supercars) that GYEON detailers handle. The `ultra` rank in defaults.ts appears to be a consolidation of these two tiers. Using 4 ranks preserves auto-detect functionality.

---

**Final Operator Selection:**
- [ ] A) 4-rank: std / premium / upper / luxury (JSON canonical)
- [ ] B) 3-rank: std / premium / ultra (implementation)
- [ ] C) Custom: ____________________

**Date decided:** ____________________
**Rationale:** ____________________

---

### OD-4 — PPF Film Types

**Category:** A — Must decide before V1.0  
**Current status:** ⏳ Awaiting

**Description:** Film type IDs and price coefficients differ between JSON and implementation. `carbon` exists in JSON but not in defaults.ts; `self-heal` exists in defaults.ts but not in JSON. `color` coefficient differs (1.8 vs 1.2).

**Affected modules:** `dealer-settings-defaults.ts` (`ppf_price_tables.film_coeff`), `EstimateWizard.tsx` (PPF film selection)

**Default currently assumed:** defaults.ts values: clear(1.0) / matte(1.3) / color(1.2) / self-heal(1.1)

**Risk if left undecided:** Either the carbon film option is missing from customer estimates (lost revenue opportunity), or self-heal is shown as a separate film type when it is actually a film property rather than a type.

---

**Comparison:**

| Film | JSON coeff | Defaults coeff | Status |
|------|-----------|---------------|--------|
| clear | 1.0 | 1.0 | ✅ Match |
| matte | 1.3 | 1.3 | ✅ Match |
| carbon | 1.5 | (absent) | JSON only |
| color | 1.8 | 1.2 | Coeff differs |
| self-heal | (absent) | 1.1 | Defaults only |

**Note:** `self-heal` is typically a property of a film grade (e.g., "self-healing clear"), not a separate film type. If this is the case for GYEON's product line, it should not appear as a standalone film option.

**Options:**

| Choice | Description | Advantages | Disadvantages |
|--------|-------------|-----------|--------------|
| A | JSON canonical: clear/matte/carbon/color@1.8 | Includes carbon film; higher color premium | Removes self-heal option |
| B | Defaults canonical: clear/matte/color@1.2/self-heal@1.1 | Keeps self-heal option | Missing carbon; lower color premium |
| C | Custom combination | Precisely matches GYEON's actual film product lineup | Requires operator to specify |

**Recommended default:** **Choice A or C**. Carbon film is a real GYEON product category and should be available. `self-heal` is more accurately a film property than a type — confirm with GYEON product documentation.

---

**Final Operator Selection:**
- [ ] A) JSON canonical: clear(1.0) / matte(1.3) / carbon(1.5) / color(1.8)
- [ ] B) Defaults: clear(1.0) / matte(1.3) / color(1.2) / self-heal(1.1)
- [ ] C) Custom: ____________________

**Date decided:** ____________________
**Rationale:** ____________________

---

### OD-5 — Window Film Grade Names and Coefficients

**Category:** A — Must decide before V1.0  
**Current status:** ⏳ Awaiting

**Description:** Window film grade names differ fundamentally between JSON and implementation. `high-heat` and `security` (JSON) are different product categories from `uv-cut` and `ir-cut` (defaults.ts). This is not a naming difference — it is a different product lineup.

**Affected modules:** `dealer-settings-defaults.ts` (`service_price_settings.window_film.grades`), `EstimateWizard.tsx` (window film step)

**Default currently assumed:** defaults.ts values: standard / premium / uv-cut / ir-cut

**Risk if left undecided:** The window film selection UI will show the wrong product grades to customers. An operator offering `high-heat` film but the system showing `uv-cut` is a product catalog error.

---

**Comparison:**

| Source | Grade 1 | Grade 2 | Grade 3 | Grade 4 |
|--------|---------|---------|---------|---------|
| JSON | standard(1.0) | premium(1.3) | high-heat(1.6) | security(1.2) |
| Defaults | standard(1.0) | premium(1.3) | uv-cut(1.1) | ir-cut(1.2) |

**Options:**

| Choice | Description |
|--------|-------------|
| A | JSON canonical: standard / premium / high-heat / security |
| B | Defaults canonical: standard / premium / uv-cut / ir-cut |
| C | Custom grade set matching actual GYEON window film lineup |

**Recommended default:** **Check GYEON's window film product catalog.** The JSON likely reflects the intended product lineup. However, this is the one decision where the operator's knowledge of the actual product range is essential.

---

**Final Operator Selection:**
- [ ] A) standard / premium / high-heat / security (JSON)
- [ ] B) standard / premium / uv-cut / ir-cut (defaults)
- [ ] C) Custom: Grade 3 = __________ (coeff: ____) / Grade 4 = __________ (coeff: ____)

**Date decided:** ____________________
**Rationale:** ____________________

---

### OD-6 — Window Film Part IDs and Prices

**Category:** A — Must decide before V1.0  
**Current status:** ⏳ Awaiting

**Description:** Window film part IDs differ between JSON and implementation. Parts stored in estimates use these IDs — using wrong IDs creates estimates referencing non-existent parts. Additionally, `wf-sunroof` and `wf-windshield` exist in the JSON but not in defaults.ts.

**Affected modules:** `dealer-settings-defaults.ts` (window film parts), `EstimateWizard.tsx` (window film step), stored estimates in DB

**Default currently assumed:** defaults.ts IDs: wf-front-side / wf-rear-side / wf-rear / wf-quarter / wf-all

**Risk if left undecided:** Existing estimates saved with defaults.ts IDs will not match JSON IDs after reconciliation, causing display errors.

---

**Part comparison:**

| Part | JSON id / ¥ | Defaults id / ¥ |
|------|------------|----------------|
| リアドアガラス | wf-rear-side / 22,000 | wf-rear-side / 20,000 |
| リアガラス | wf-rear-glass / 20,000 | wf-rear / 18,000 |
| リアクォーター | wf-rear-qtr / 15,000 | wf-quarter / 12,000 |
| サンルーフ | wf-sunroof / 18,000 | (absent) |
| フロントガラス | wf-windshield / 30,000 | (absent) |
| 全窓セット | wf-all / 90,000 | wf-all / 80,000 |

**Options:**

| Choice | Description | Advantages | Disadvantages |
|--------|-------------|-----------|--------------|
| A | JSON canonical — update defaults.ts | Adds sunroof/windshield options; correct IDs | Requires checking existing estimates for old IDs |
| B | Defaults canonical — update JSON | No existing data migration needed | Missing 2 window parts; lower prices |
| C | Custom table | Operator-specified correct parts and prices | Requires full specification |

**Recommended default:** **Choice A** — the JSON parts list is more complete (includes sunroof and windshield). Check whether any estimates exist with `wf-rear` or `wf-quarter` IDs before renaming; a data fix may be needed.

---

**Final Operator Selection:**
- [ ] A) JSON canonical (update defaults.ts, check existing data)
- [ ] B) Defaults canonical (update JSON)
- [ ] C) Custom parts: ____________________

**Date decided:** ____________________
**Rationale:** ____________________

---

### OD-7 — Room Cleaning Parts and Prices

**Category:** A — Must decide before V1.0  
**Current status:** ⏳ Awaiting

**Description:** Room cleaning part list and prices differ between JSON and implementation. `rc-door` and `rc-trunk` are in the JSON but missing from defaults.ts. `rc-full` (full-room set discount) exists in defaults.ts but not in JSON. 4 prices differ.

**Affected modules:** `dealer-settings-defaults.ts` (`service_price_settings.room_cleaning`), `EstimateWizard.tsx` (room cleaning step)

**Default currently assumed:** defaults.ts: rc-floor / rc-seat / rc-ceiling / rc-dash / rc-full (¥45,000 set)

**Risk if left undecided:** Room cleaning estimates show wrong prices and are missing door trim and trunk cleaning options.

---

**Parts comparison:**

| Part | JSON id / ¥ | Defaults id / ¥ |
|------|------------|----------------|
| フロアマット | rc-floor / 12,000 | rc-floor / 12,000 ✅ |
| シート | rc-seat / 20,000 | rc-seat / 15,000 ⚠️ |
| 天井 | rc-ceiling / 15,000 | rc-ceiling / 8,000 ⚠️ |
| ドアトリム | rc-door / 10,000 | (absent) ❌ |
| ダッシュボード | rc-dash / 8,000 | rc-dash / 10,000 ⚠️ |
| トランク | rc-trunk / 8,000 | (absent) ❌ |
| 全室内セット | (absent) | rc-full / 45,000 ➕ |

**Options:**

| Choice | Description | Advantages | Disadvantages |
|--------|-------------|-----------|--------------|
| A | JSON canonical — add rc-door, rc-trunk; correct prices; remove rc-full if not canonical | Most complete parts list | Removes the set-discount option |
| B | Defaults canonical | Keeps set option (rc-full) | Missing 2 parts; 4 wrong prices |
| C | Custom | Operator defines exact parts and prices | Requires specification |

**Recommended default:** **Choice A with one question about rc-full** — add the 2 missing parts and correct prices. Before removing `rc-full`, confirm whether a full-room cleaning set discount is an actual product offering. If yes, add it to the JSON as well.

---

**Final Operator Selection:**
- [ ] A) JSON canonical (add rc-door/rc-trunk, correct prices, remove rc-full)
- [ ] B) Defaults canonical (keep rc-full, exclude rc-door/rc-trunk)
- [ ] C) Custom: ____________________
- [ ] D) Choice A + keep rc-full as a bonus set option: add to JSON too

**Date decided:** ____________________
**Rationale:** ____________________

---

### OD-8 — Canonical Settings Key Count

**Category:** C — Defer to V1.1  
**Current status:** ⏳ Awaiting (default: 37)

**Description:** All spec documents now say 37 canonical settings keys (corrected in PHASE75 from 39). The count of 37 comes from directly counting `gyeon_settings_flow.json` `all_settings_keys` array.

**Default currently assumed:** 37 (correct per JSON direct count)

**Risk if left undecided:** None — 37 is the observable fact. If the operator believes 39 is correct, 2 keys are missing from the JSON and must be identified.

---

**Options:**

| Choice | Description |
|--------|-------------|
| A | 37 is correct — old "39" was a documentation error |
| B | 39 is correct — 2 keys are missing from the JSON; identify them |

**Recommended default:** **Choice A**. The JSON has 37 entries. No functional impact.

---

**Final Operator Selection:**
- [ ] A) 37 is correct ← recommended
- [ ] B) 39 is correct — missing keys: ____________________

**Date decided:** ____________________

---

### OD-9 — Default Dealer Trade Rate

**Category:** A — Must decide before V1.0  
**Current status:** ⏳ Awaiting

**Description:** The default dealer discount rate differs between the canonical spec (100% = no discount) and the implementation (70% = 30% automatic discount on all estimates). **This affects all active estimates in production right now.**

**Affected modules:** `dealer-settings-defaults.ts` (`DEFAULT_DEALER_RATE`), ALL estimates throughout the system

**Default currently assumed:** 70% (30% automatic discount) from defaults.ts

**Risk if left undecided:** Every dealer is currently getting a 30% automatic discount on all their estimates. If this is unintentional, revenue is being understated on every quote.

---

**Options:**

| Choice | Description | Advantages | Disadvantages |
|--------|-------------|-----------|--------------|
| A | 100% (no discount by default) | New dealers start at full price; matches JSON canonical | Existing dealers who rely on 70% will need their rate explicitly set |
| B | 70% (30% discount by default) | Matches current behavior | Systematic discount on all estimates; may be incorrect |
| C | Other percentage | Operator-defined | Requires justification |

**Recommended default:** **Choice A — 100%**. A default of 70% means that a dealer who has never configured their trade rate is automatically getting a 30% discount. This is almost certainly unintentional. Dealers who have negotiated a discount should set it explicitly in their settings. **This is the highest-urgency decision — it affects production quotes now.**

---

**Final Operator Selection:**
- [ ] A) 100% — no discount by default ← recommended
- [ ] B) 70% — 30% discount by default
- [ ] C) Other: ______%

**Date decided:** ____________________
**Rationale:** ____________________

---

### OD-10 — PPF Front-Half Plan Label

**Category:** A — Must decide before V1.0  
**Current status:** ⏳ Awaiting

**Description:** The PPF `front-half` plan has different Japanese labels in JSON and implementation. This label is shown directly to customers in estimates.

**Affected modules:** `dealer-settings-defaults.ts` (PPF plan label), `EstimateWizard.tsx` (PPF plan selection UI)

**Default currently assumed:** フロントハーフ (defaults.ts)

**Risk if left undecided:** Customers see the wrong product name on their estimates.

---

**Options:**

| Choice | Label | Source | Meaning |
|--------|-------|--------|---------|
| A | フロントフル | gyeon_flow.json | "Front full" — could imply full front |
| B | フロントハーフ | defaults.ts | "Front half" — describes partial front coverage |

**Recommended default:** **Choice B — フロントハーフ**. The plan ID is `front-half` which describes partial front coverage. `フロントハーフ` is the accurate Japanese translation. `フロントフル` would be confusing as it implies complete coverage. The implementation name appears to be the correct one.

---

**Final Operator Selection:**
- [ ] A) フロントフル
- [ ] B) フロントハーフ ← recommended

**Date decided:** ____________________
**Rationale:** ____________________

---

### OD-11 — LINE Message Column Path

**Category:** B — Temporary default can be used  
**Current status:** ⏳ Awaiting

**Description:** Migration 070 adds both individual text columns (`line_message_header`, `line_message_footer`) and a structured JSONB column (`line_message_templates`). Using both paths simultaneously would cause inconsistency. The LINE feature is currently inactive, so this does not affect V1.0 operation.

**Affected modules:** `src/app/api/line/*`, `src/lib/line/*`, LINE settings UI (g5 drawer)

**Default currently assumed:** Individual text columns (these exist in the schema and appear to be the original implementation path)

**Risk if left undecided:** When LINE is activated in Phase B, the send function will read from one path but the settings UI may write to the other. Silent message template mismatches.

---

**Options:**

| Choice | Description | Advantages | Disadvantages |
|--------|-------------|-----------|--------------|
| A | Individual columns canonical — deprecate `line_message_templates` | Simple; matches likely current code path | Less structured; can't hold multiple template types |
| B | `line_message_templates` JSONB canonical — individual columns are stubs | Structured; can hold estimate_sent, maintenance_reminder, etc. as separate templates | More complex to read/write |
| C | Individual columns for display; JSONB for send operations | Separation of concerns | Dual-maintenance; inconsistency risk |

**Recommended default:** **Choice A for V1.0** — use individual text columns since they are already the implementation path. Migrate to JSONB (`line_message_templates`) in V1.1 if multi-template support is needed.

---

**Final Operator Selection:**
- [ ] A) Individual text columns canonical ← recommended for V1.0
- [ ] B) `line_message_templates` JSONB canonical
- [ ] C) Dual-path (display vs send)

**Date decided:** ____________________
**Rationale:** ____________________

---

### OD-12 — Roof PPF Plan

**Category:** C — Defer to V1.1  
**Current status:** ⏳ Awaiting

**Description:** `dealer-settings-defaults.ts` includes a `roof` PPF plan (roof_SS, roof_S, etc.) that is not in `gyeon_flow.json`. It is not shown in the standard estimate flow.

**Affected modules:** `dealer-settings-defaults.ts` (`ppf_price_tables`), `03_BUSINESS_WORKFLOW.md`

**Default currently assumed:** Roof plan exists in defaults but is not presented to customers (excluded from standard flow).

**Risk if left undecided:** None in V1.0 — the plan is not shown. Confirm in Phase C whether to add to canonical JSON.

---

**Options:**

| Choice | Description |
|--------|-------------|
| A | Approved extension — add `roof` to canonical JSON and spec |
| B | Deviation — remove from defaults.ts in Phase C |
| C | Keep in defaults, exclude from standard flow (special order) |

**Recommended default:** **Choice C for now** — keep in defaults but don't show in the standard wizard. If GYEON offers roof PPF as a service, add to canonical JSON in Phase C.

---

**Final Operator Selection:**
- [ ] A) Add to canonical JSON (approved product)
- [ ] B) Remove from defaults.ts (deviation)
- [ ] C) Keep but exclude from standard flow ← recommended for V1.0

**Date decided:** ____________________

---

### OD-13 — Activate LINE Settings Group g5

**Category:** B — Temporary default can be used  
**Current status:** ⏳ Awaiting

**Description:** Settings group g5 (SNS・LINE連携) is currently hidden with 「準備中」. The question is when to make it visible to dealers.

**Affected modules:** `src/app/settings/page.tsx`, `src/components/settings/SettingsCategoryNav.tsx`

**Default currently assumed:** Hidden — safe and correct current state.

**Risk if left undecided:** None — hidden is the correct default until LINE credentials are provisioned.

---

**Options:**

| Choice | Description |
|--------|-------------|
| A | Activate in Phase B — immediately after LINE credentials provisioned |
| B | Activate in Phase D — after full testing |
| C | Activate per-dealer when their LINE channel is provisioned |

**Recommended default:** **Choice A** — activate g5 as part of Phase B LINE activation. The settings group should become visible when the dealer configures their LINE credentials. There is no reason to delay beyond Phase B.

---

**Final Operator Selection:**
- [ ] A) Activate in Phase B ← recommended
- [ ] B) Activate in Phase D
- [ ] C) Per-dealer activation

**Date decided:** ____________________

---

### OD-14 — Post-v1.0 Version Track

**Category:** C — Defer to V1.1  
**Current status:** ⏳ Awaiting

**Description:** `VERSION.md` says `1.0.0 "Official Release"` but development has continued. The question is whether ongoing work is tracked as `1.0.0` or a new minor version.

**Affected modules:** `VERSION.md`, `CHANGELOG.md`, `09_PHASE_STATUS.md`

**Default currently assumed:** 1.0.0 (frozen version label)

**Risk if left undecided:** No functional risk — versioning only.

---

**Options:**

| Choice | Description | Advantages |
|--------|-------------|-----------|
| A | Stay as `1.0.0` | Simplicity; one version until major milestone | 
| B | Introduce `1.1.0-dev` | Clear milestone tracking; useful for dealers and changelog |
| C | Skip to `1.1.0` with planned release date | Creates external commitment |

**Recommended default:** **Choice B — introduce `1.1.0-dev`**. All the post-v1 work (desktop UI, integration activation, spec reconciliation) represents a meaningful feature release. Tracking it as `1.1.0-dev` is cleaner than pretending `1.0.0` is still current.

---

**Final Operator Selection:**
- [ ] A) Remain as 1.0.0
- [ ] B) Introduce 1.1.0-dev ← recommended
- [ ] C) Release as 1.1.0 on date: ____________________

**Date decided:** ____________________

---

### OD-15 — PPF 7th Body Size Key

**Category:** A — Must decide before V1.0  
**Current status:** ⏳ Awaiting

**Description:** `EstimateWizard.tsx` defines 8 body sizes (SS/S/M/ML/L/LL/XL/XXL) but the PPF plan price table in the JSON covers only 7 entries. The 7th JSON key is `LL+` which doesn't match any wizard body size. The implementation uses `XL` as the 7th key.

**Affected modules:** `dealer-settings-defaults.ts` (PPF plan_prices keys), `EstimateWizard.tsx` (body size → PPF lookup), `03_BUSINESS_WORKFLOW.md` §4.2 and §4.5

**Default currently assumed:** `XL` (from defaults.ts, labeled 高級大型)

**Risk if left undecided:** Vehicles classified as `XL` or `XXL` either get wrong PPF pricing or fall through to a null price.

---

**Comparison:**

| Source | Sizes covered |
|--------|--------------|
| EstimateWizard.tsx BODY_SIZES | SS / S / M / ML / L / LL / XL / XXL (8 sizes) |
| gyeon_flow.json plan keys | SS / S / M / ML / L / LL / LL+ (7 sizes) |
| dealer-settings-defaults.ts | SS / S / M / ML / L / LL / XL (7 sizes) |

**Options:**

| Choice | Description | Advantages | Disadvantages |
|--------|-------------|-----------|--------------|
| A | XL is the 7th key — update JSON from LL+ to XL | Matches implementation; XL is clear naming | No price for XXL vehicles |
| B | LL+ is the 7th key — update implementation from XL to LL+ | Matches JSON canonical | Confusing key name; XXL still uncovered |
| C | Extend to 8 sizes matching all BODY_SIZES — XL and XXL each get their own price | Complete coverage for all vehicles | Requires adding one more price tier |

**Recommended default:** **Choice C — extend to 8 sizes**. The wizard clearly supports 8 sizes and XXL (プレミアムカー — supercars/hypercars) is a real and important GYEON customer segment. The current gap means the most premium vehicles get no PPF price. Add both `XL` and `XXL` entries to the plan prices.

---

**Final Operator Selection:**
- [ ] A) XL is the 7th key (7-size coverage)
- [ ] B) LL+ is the 7th key (7-size coverage)
- [ ] C) 8-size coverage: XL + XXL ← recommended

If Choice C, provide XXL price (relative to XL):
- XXL フルボディ: ¥____________________
- XXL フロントハーフ: ¥____________________

**Date decided:** ____________________
**Rationale:** ____________________

---

### OD-16 — OCR Field Mapping Contract

**Category:** C — Defer to V1.1 (before Phase B)  
**Current status:** ⏳ Awaiting

**Description:** The OCR system extracts fields from 車検証 (vehicle registration). It's not documented which extracted fields map to which estimate/vehicle DB fields. This mapping is required before OCR can be activated.

**Affected modules:** `src/app/api/ocr/*`, `src/lib/ocr/*`, `vehicles` table, `06_OCR_REQUIREMENTS.md` §6

**Default currently assumed:** Unknown — no mapping defined.

**Risk if left undecided:** OCR activation in Phase B without this mapping means extracted data is displayed to users but cannot be automatically applied to vehicle records.

---

**Known extracted fields:** owner_name, owner_address, plate_number, chassis_number, first_registration_date, inspection_expiry_date, vehicle_model, vehicle_type

**Mapping decision needed:**

| 車検証 field | Maps to | Notes |
|------------|---------|-------|
| vehicle_model | `vehicles.model` | |
| plate_number | `vehicles.plate_number` | |
| chassis_number | `vehicles.vin` (?) | Confirm field name |
| first_registration_date | `vehicles.year` (year extracted) | |
| inspection_expiry_date | `vehicles.inspection_expiry` (?) | Confirm field exists |
| body size | How inferred from 車検証? | No direct field — requires lookup table |

**Recommended default:** Define the mapping in `06_OCR_REQUIREMENTS.md` §6 before Phase B begins. Defer to V1.1 is acceptable since OCR is inactive in V1.0.

---

**Final Operator Selection:**
- [ ] Defer to V1.1 (before Phase B activation) ← recommended
- [ ] Define now: [fill in mapping]

**Date decided:** ____________________

---

### OD-17 — Vehicle Registration Image Retention Policy

**Category:** C — Defer to V1.1 (before Phase B)  
**Current status:** ⏳ Awaiting

**Description:** 車検証 images stored in Supabase Storage contain PII (name, address, plate number, chassis number). Japanese APPI (個人情報保護法) requires a retention policy. The `vehicle_registration_files` table has an `archived_at` column for soft-deletion.

**Affected modules:** `vehicle_registration_files` table, Supabase Storage, `src/app/api/ocr/*`

**Default currently assumed:** Retain indefinitely (no automated deletion — current behavior).

**Risk if left undecided:** APPI compliance gap. Indefinite retention of vehicle owner PII may require disclosure in a privacy policy.

---

**Options:**

| Choice | Description | APPI compliance |
|--------|-------------|----------------|
| A | Retain indefinitely | Acceptable if disclosed in privacy policy |
| B | Delete after OCR confirmation | Minimization approach — cleanest for compliance |
| C | Retain for N days, then auto-archive | Balance of usability and compliance |
| D | Retain for N days, then permanently delete | Strictest compliance |

**Recommended default:** **Choice C — retain for 90 days, then auto-archive**. This preserves the ability to re-examine the image during the warranty/service period while eventually archiving. Pair with a privacy policy disclosure. Set `archived_at` via a cron job.

---

**Final Operator Selection:**
- [ ] A) Retain indefinitely
- [ ] B) Delete after OCR confirmation
- [ ] C) Archive after _____ days ← recommended
- [ ] D) Delete after _____ days

**Date decided:** ____________________
**Compliance note:** Update privacy policy when OCR is activated.

---

## Decision Completion Tracker

| OD | Topic | Category | Status | Date |
|----|-------|---------|--------|------|
| OD-1 | Migration 070 | A | ⏳ | |
| OD-2 | PPF prices | A | ⏳ | |
| OD-3 | PPF ranks | A | ⏳ | |
| OD-4 | PPF films | A | ⏳ | |
| OD-5 | Window film grades | A | ⏳ | |
| OD-6 | Window film parts | A | ⏳ | |
| OD-7 | Room cleaning | A | ⏳ | |
| OD-8 | Settings key count | C | ⏳ | |
| OD-9 | Dealer rate | A | ⏳ | |
| OD-10 | PPF label | A | ⏳ | |
| OD-11 | LINE message path | B | ⏳ | |
| OD-12 | Roof PPF plan | C | ⏳ | |
| OD-13 | g5 timing | B | ⏳ | |
| OD-14 | Version track | C | ⏳ | |
| OD-15 | 7th size key | A | ⏳ | |
| OD-16 | OCR field mapping | C | ⏳ | |
| OD-17 | Image retention | C | ⏳ | |

**Category A resolved:** 0 / 10  
**Category B resolved:** 0 / 2  
**Category C resolved:** 0 / 5  
**Total resolved:** 0 / 17

---

*GYEON Detailer Agent | PHASE78 — Operator Decision Workbook | Office AZ | 2026-06-25*  
*Documentation only — no code, no UI, no migrations, no commits.*
