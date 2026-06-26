# OPERATOR DECISION SESSION
## GYEON Detailer Agent — Category A Decisions

| Field | Value |
|-------|-------|
| **Version** | 1.0 |
| **Status** | Awaiting Operator — Session Document |
| **Date** | 2026-06-25 |
| **Estimated session time** | 90 minutes |
| **Related** | `OPERATOR_DECISION_WORKBOOK.md`, `IMPLEMENTATION_UNLOCK_REPORT.md` |

> **Instructions:** Work through each decision in order. Mark your selection and sign off.
> Engineering will apply decisions to code and spec immediately after this session.
> All 10 decisions together unlock approximately 50 blocked implementation tasks.

---

## DECISION 1 of 10 — OD-9: Default Dealer Trade Rate

| Field | Value |
|-------|-------|
| **ID** | OD-9 |
| **Current default** | 70% (30% automatic discount on all estimates) |
| **Recommended** | 100% (no automatic discount) |
| **Risk level** | 🔴 CRITICAL — affects every estimate in production right now |

**Issue:** Every dealer estimate is currently discounted 30% automatically because `DEFAULT_DEALER_RATE = 0.7` in the codebase. A new dealer who has never set a discount rate is already getting a 30% price reduction on all quotes.

**Business impact:** All estimates are understated by 30% unless the dealer has manually overridden their rate. Customer quotes are incorrect.

**Implementation impact:** Single constant change — `DEFAULT_DEALER_RATE`. Takes 5 minutes to fix once decided.

**Options:**
- [ ] **A) 100%** — No discount by default. Dealer must explicitly configure a discount. ← **Recommended**
- [ ] **B) 70%** — Keep 30% discount as default. Existing behavior is intentional.
- [ ] **C) Other: ______%**

**Selection:** _______ **Date:** _______ **Initials:** _______

---

## DECISION 2 of 10 — OD-1: Migration 070 Database Status

| Field | Value |
|-------|-------|
| **ID** | OD-1 |
| **Current default** | Unknown — DB state unconfirmed |
| **Recommended** | Confirm and apply if not yet done |
| **Risk level** | 🔴 CRITICAL — all Phase B features fail without this |

**Issue:** Migration file `070_dealer_settings_canonical.sql` exists in the repo and adds 32 columns to `dealer_settings`. It is unknown whether this has been applied to the Supabase database (staging and/or production).

**Business impact:** LINE settings, OCR settings, reminder templates, and 12 extension JSONB columns are all unavailable until migration 070 is applied. Phase B (LINE + OCR activation) cannot begin.

**Implementation impact:** Apply via Supabase SQL Editor. The migration uses `ADD COLUMN IF NOT EXISTS` — completely safe to run even if partially applied. No data loss risk.

**Options:**
- [ ] **A) Applied to staging only** — will apply to production after staging verified
- [ ] **B) Applied to both staging and production** — already done; no action needed
- [ ] **C) Not yet applied to any environment** — will apply this week
- [ ] **D) Applied to production only** — staging apply needed

**Selection:** _______ **Date:** _______ **Initials:** _______

---

## DECISION 3 of 10 — OD-10: PPF Front-Half Plan Label

| Field | Value |
|-------|-------|
| **ID** | OD-10 |
| **Current default** | フロントハーフ (defaults.ts implementation) |
| **Recommended** | フロントハーフ |
| **Risk level** | 🟡 MEDIUM — wrong product name shown to customers |

**Issue:** The `front-half` PPF plan is labeled `フロントフル` in `gyeon_flow.json` but `フロントハーフ` in the implementation. These mean different things: "front full" vs "front half."

**Business impact:** Customers see a product name on their estimate. `フロントフル` could imply complete front coverage, misleading customers about what they are purchasing.

**Implementation impact:** Single string change in `dealer-settings-defaults.ts`.

**Options:**
- [ ] **A) フロントフル** — matches gyeon_flow.json
- [ ] **B) フロントハーフ** — matches implementation; more accurate description ← **Recommended**
- [ ] **C) Other: ____________________**

**Selection:** _______ **Date:** _______ **Initials:** _______

---

## DECISION 4 of 10 — OD-2: PPF Plan Prices

| Field | Value |
|-------|-------|
| **ID** | OD-2 |
| **Current default** | defaults.ts values (higher) |
| **Recommended** | Verify against GYEON Japan official price list |
| **Risk level** | 🔴 CRITICAL — wrong prices quoted to customers (delta: ¥30k–¥130k) |

**Issue:** PPF plan prices differ between the canonical JSON (lower) and the implementation (higher) by ¥30,000 to ¥130,000 depending on body size.

**Price comparison (full-body plan):**

| Size | JSON | Implementation | Difference |
|------|------|----------------|-----------|
| SS | ¥250,000 | ¥280,000 | +¥30,000 |
| M  | ¥330,000 | ¥360,000 | +¥30,000 |
| L  | ¥370,000 | ¥470,000 | +¥100,000 |
| LL | ¥430,000 | ¥550,000 | +¥120,000 |
| 7th size | ¥520,000 | ¥650,000 | +¥130,000 |

**Business impact:** Every PPF estimate will quote the wrong price. Revenue impact or customer trust impact depending on which set is wrong.

**Implementation impact:** Update `ppf_price_tables.plan_prices` in `dealer-settings-defaults.ts` for all size/plan combinations.

**Options:**
- [ ] **A) JSON values are correct** — update implementation to JSON prices
- [ ] **B) Implementation values are correct** — update JSON and spec to match
- [ ] **C) Neither — correct prices are: ____________________** ← **Recommended if unsure**

**Selection:** _______ **Date:** _______ **Initials:** _______

---

## DECISION 5 of 10 — OD-3: PPF Vehicle Rank System

| Field | Value |
|-------|-------|
| **ID** | OD-3 |
| **Current default** | 3-rank system: std / premium / ultra (implementation) |
| **Recommended** | 4-rank system: std / premium / upper / luxury (JSON) |
| **Risk level** | 🟠 HIGH — auto-detect broken for premium vehicle tiers |

**Issue:** The canonical JSON defines 4 ranks (std / premium / upper / luxury with coefficients 1.0 / 1.3 / 1.5 / 1.8). The implementation uses 3 ranks (std / premium / ultra at 1.0 / 1.3 / 1.6). The auto-detect feature references `upper` and `luxury` rank IDs — these do not exist in the implementation.

**Business impact:** Vehicles that should be detected as `upper` (imported luxury) or `luxury` (supercars/hypercars) fall through to wrong rank assignment. Estimates for the most expensive vehicles are incorrect.

**Implementation impact:** Add `upper` and `luxury` entries to `ppf_price_tables.rank_coeff` in `dealer-settings-defaults.ts`; update PPF rank selection UI.

**Options:**
- [ ] **A) 4-rank: std / premium / upper / luxury** (JSON) — coefficients: 1.0 / 1.3 / 1.5 / 1.8 ← **Recommended**
- [ ] **B) 3-rank: std / premium / ultra** (implementation) — coefficients: 1.0 / 1.3 / 1.6
- [ ] **C) Custom: ____________________**

**Selection:** _______ **Date:** _______ **Initials:** _______

---

## DECISION 6 of 10 — OD-4: PPF Film Types

| Field | Value |
|-------|-------|
| **ID** | OD-4 |
| **Current default** | clear / matte / color(1.2) / self-heal(1.1) (implementation) |
| **Recommended** | clear / matte / carbon(1.5) / color(1.8) (JSON) |
| **Risk level** | 🟠 HIGH — carbon film missing; color premium incorrect |

**Issue:** The JSON includes `carbon` film (coeff 1.5) and `color` at coefficient 1.8. The implementation includes `self-heal` (coeff 1.1) and `color` at coefficient 1.2. Carbon film is absent; self-heal is a film property rather than a film type.

**Business impact:** Carbon PPF film is a real premium GYEON product. If absent from the selection UI, dealers cannot quote it. The color coefficient difference (1.8 vs 1.2) is a 50% pricing gap.

**Implementation impact:** Add/remove entries in `ppf_price_tables.film_coeff` in `dealer-settings-defaults.ts`.

| Film | JSON coeff | Implementation coeff |
|------|-----------|---------------------|
| clear | 1.0 | 1.0 ✅ |
| matte | 1.3 | 1.3 ✅ |
| carbon | 1.5 | **absent** |
| color | 1.8 | 1.2 ⚠️ |
| self-heal | **absent** | 1.1 |

**Options:**
- [ ] **A) JSON: clear / matte / carbon / color@1.8** ← **Recommended**
- [ ] **B) Implementation: clear / matte / color@1.2 / self-heal**
- [ ] **C) Custom: ____________________**

**Selection:** _______ **Date:** _______ **Initials:** _______

---

## DECISION 7 of 10 — OD-15: PPF Body Size Coverage

| Field | Value |
|-------|-------|
| **ID** | OD-15 |
| **Current default** | 7 sizes: SS/S/M/ML/L/LL/XL (implementation) |
| **Recommended** | 8 sizes: SS/S/M/ML/L/LL/XL/XXL |
| **Risk level** | 🟠 HIGH — largest vehicles (supercars/hypercars) get no PPF price |

**Issue:** The estimate wizard supports 8 body sizes (SS through XXL). The PPF plan price table covers only 7. The JSON uses a key `LL+` that doesn't match any wizard size. The implementation uses `XL` as key 7 but has no entry for `XXL` (labeled "プレミアムカー / supercar").

**Business impact:** `XXL` vehicles — the highest-value GYEON customers — have no PPF price. The wizard either shows ¥0 or crashes for this segment.

**Implementation impact:** Add `XXL` price entries to `ppf_price_tables.plan_prices` in `dealer-settings-defaults.ts`. Operator must provide the XXL price point.

**Options:**
- [ ] **A) 7 sizes with XL as the top** — no XXL coverage
- [ ] **B) 7 sizes with LL+ as the 7th key** — update implementation key name
- [ ] **C) 8 sizes: XL + XXL** ← **Recommended** — requires XXL price

If Choice C, provide prices:
- XXL full-body: ¥ _____________
- XXL front-half: ¥ _____________

**Selection:** _______ **Date:** _______ **Initials:** _______

---

## DECISION 8 of 10 — OD-5: Window Film Grades

| Field | Value |
|-------|-------|
| **ID** | OD-5 |
| **Current default** | standard / premium / uv-cut / ir-cut (implementation) |
| **Recommended** | Confirm against GYEON window film product lineup |
| **Risk level** | 🟠 HIGH — wrong products shown to customers |

**Issue:** Window film grades in the JSON (high-heat / security) are fundamentally different product categories from the implementation (uv-cut / ir-cut). This is not a naming difference — it is a different product lineup.

**Business impact:** The window film selection UI will display product grades that do not match what the dealer actually offers. Customers will select a film grade that may not exist in the dealer's catalog.

**Implementation impact:** Update `service_price_settings.window_film.grades` in `dealer-settings-defaults.ts` with confirmed grade IDs and coefficients.

| Grades | JSON | Implementation |
|--------|------|----------------|
| Grade 1 | standard (1.0) | standard (1.0) ✅ |
| Grade 2 | premium (1.3) | premium (1.3) ✅ |
| Grade 3 | high-heat (1.6) | uv-cut (1.1) ❌ different |
| Grade 4 | security (1.2) | ir-cut (1.2) ❌ different |

**Options:**
- [ ] **A) JSON: standard / premium / high-heat / security**
- [ ] **B) Implementation: standard / premium / uv-cut / ir-cut**
- [ ] **C) Custom — provide grade 3 and 4: ____________________**

**Selection:** _______ **Date:** _______ **Initials:** _______

---

## DECISION 9 of 10 — OD-6: Window Film Part IDs and Prices

| Field | Value |
|-------|-------|
| **ID** | OD-6 |
| **Current default** | defaults.ts IDs: wf-rear / wf-quarter (shorter IDs) |
| **Recommended** | JSON IDs: wf-rear-glass / wf-rear-qtr (add sunroof + windshield) |
| **Risk level** | 🟠 HIGH — wrong IDs stored in DB estimates; 2 parts missing |

**Issue:** Part IDs differ between JSON and implementation for 2 parts. Additionally, `wf-sunroof` and `wf-windshield` exist in the JSON but are absent from the implementation. Part IDs are stored in saved estimates — a mismatch causes display errors on older records.

**Business impact:** Dealers cannot quote sunroof or windshield window film. Estimates saved before any ID fix may reference incorrect part identifiers.

**Implementation impact:** Update part IDs in `dealer-settings-defaults.ts`. If existing estimates use the old IDs (`wf-rear`, `wf-quarter`), a one-time data fix will be needed — engineering will check before renaming.

| Part | JSON id / price | Impl id / price |
|------|----------------|----------------|
| Rear side door glass | wf-rear-side / ¥22,000 | wf-rear-side / ¥20,000 |
| Rear glass | **wf-rear-glass** / ¥20,000 | **wf-rear** / ¥18,000 |
| Rear quarter glass | **wf-rear-qtr** / ¥15,000 | **wf-quarter** / ¥12,000 |
| Sunroof | wf-sunroof / ¥18,000 | **absent** |
| Windshield | wf-windshield / ¥30,000 | **absent** |
| Full set | wf-all / ¥90,000 | wf-all / ¥80,000 |

**Options:**
- [ ] **A) JSON canonical** — correct IDs + add sunroof and windshield ← **Recommended**
- [ ] **B) Implementation canonical** — keep current IDs; remove sunroof/windshield from spec
- [ ] **C) Custom: ____________________**

**Selection:** _______ **Date:** _______ **Initials:** _______

---

## DECISION 10 of 10 — OD-7: Room Cleaning Parts and Prices

| Field | Value |
|-------|-------|
| **ID** | OD-7 |
| **Current default** | defaults.ts: 5 parts (missing door trim + trunk) |
| **Recommended** | Add rc-door and rc-trunk; correct 3 prices |
| **Risk level** | 🟡 MEDIUM — incomplete parts list; wrong prices |

**Issue:** `rc-door` (door trim cleaning) and `rc-trunk` (trunk cleaning) exist in the JSON but are absent from the implementation. Three prices differ significantly (seat: ¥20k vs ¥15k; ceiling: ¥15k vs ¥8k; dash: ¥8k vs ¥10k). The implementation has an extra `rc-full` full-room set package not in the JSON.

**Business impact:** Room cleaning estimates are missing 2 service items. Prices for seat, ceiling, and dash differ from the canonical spec.

**Implementation impact:** Add/remove parts and correct prices in `service_price_settings.room_cleaning` in `dealer-settings-defaults.ts`.

| Part | JSON id / price | Impl id / price |
|------|----------------|----------------|
| Floor mat | rc-floor / ¥12,000 | rc-floor / ¥12,000 ✅ |
| Seat | rc-seat / ¥20,000 | rc-seat / ¥15,000 ⚠️ |
| Ceiling | rc-ceiling / ¥15,000 | rc-ceiling / ¥8,000 ⚠️ |
| Door trim | **rc-door / ¥10,000** | **absent** |
| Dashboard | rc-dash / ¥8,000 | rc-dash / ¥10,000 ⚠️ |
| Trunk | **rc-trunk / ¥8,000** | **absent** |
| Full set | absent | rc-full / ¥45,000 (extra) |

**Options:**
- [ ] **A) JSON canonical** — add rc-door + rc-trunk; correct 3 prices; remove rc-full
- [ ] **B) Implementation canonical** — keep 5-part list; keep rc-full; update JSON
- [ ] **C) JSON canonical + keep rc-full as set discount** — add to JSON too ← **Recommended if rc-full is a real product offering**
- [ ] **D) Custom: ____________________**

**Selection:** _______ **Date:** _______ **Initials:** _______

---

## Session Completion Checklist

| # | OD | Topic | Selected | Initials | Date |
|---|----|----|---------|---------|------|
| 1 | OD-9 | Default dealer rate | | | |
| 2 | OD-1 | Migration 070 status | | | |
| 3 | OD-10 | PPF plan label | | | |
| 4 | OD-2 | PPF plan prices | | | |
| 5 | OD-3 | PPF vehicle ranks | | | |
| 6 | OD-4 | PPF film types | | | |
| 7 | OD-15 | PPF body size coverage | | | |
| 8 | OD-5 | Window film grades | | | |
| 9 | OD-6 | Window film parts | | | |
| 10 | OD-7 | Room cleaning parts | | | |

**Session completed by:** ____________________  
**Date:** ____________________  
**Total time:** ____________________

---

## Post-Session Handoff

After this session, forward completed decisions to engineering with the following action request:

1. Apply migration 070 to staging (if OD-1 = A or C)
2. Update `DEFAULT_DEALER_RATE` constant (OD-9 decision)
3. Update all PPF tables in `dealer-settings-defaults.ts` (OD-2, OD-3, OD-4, OD-10, OD-15)
4. Update window film grades and parts (OD-5, OD-6)
5. Update room cleaning parts and prices (OD-7)
6. Update `03_BUSINESS_WORKFLOW.md` with confirmed prices
7. Update `OPERATOR_DECISIONS.md` with resolution records

**Engineering unlock after this session: ~50 blocked implementation tasks.**

---

*GYEON Detailer Agent | PHASE79 — Operator Decision Session | Office AZ | 2026-06-25*
*Documentation only. No code. No UI. No migrations. No commits.*
