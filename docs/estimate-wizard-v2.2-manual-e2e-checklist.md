# Estimate Wizard Ver2.2 — Manual E2E Browser Verification Checklist (Phase 11M-A)

Status: **manual checklist**. Code, build, RPC, and database verification are ACCEPTED (Phase 11M).
Only human browser verification remains. This document is executed by an authenticated **super_admin**
in **DealerOS-Dev**. Use test data only. Do not run against Production.

Context already verified (do not re-verify at code level):
- Typecheck: passed. Build: passed. Route registered.
- Atomic RPC `save_estimate_from_wizard` applied to DealerOS-Dev; anon EXECUTE revoked; RLS enabled.
- Scenarios A–F verified at the RPC/DB level (same code path the Save button triggers). No code defect.

## 0. Environment

- [ ] Supabase project is **DealerOS-Dev** (`fbieiotihlmpfzybowbt`). Confirm in the dashboard / app footer.
- [ ] Production is **not** connected (no production URL, no production data).
- [ ] You are signed in as an authenticated **super_admin** (other roles are redirected to
      `/admin/dashboard`; unauthenticated is redirected to `/login`).
- [ ] Preview route URL: **`/admin/dev-preview/estimate-wizard`** (dev-only; 404 in production).

## 1. Desktop Test (new customer + new vehicle)

Open the preview route and complete Screen 1 → 7.

| # | Step | Expected | Pass/Fail |
| --- | --- | --- | --- |
| 1 | Open `/admin/dev-preview/estimate-wizard` | Wizard loads on Screen 1 | |
| 2 | Screen 1 — choose "新規のお客様", enter a new individual customer (name required) | State saved; Next enabled | |
| 3 | Screen 2 — choose new vehicle (maker/model), set body size (3M) | State saved | |
| 4 | Screen 3 — select **Coating** + one manual-price category (e.g. Car Wash) | Categories selected | |
| 5 | Screen 4 — configure Coating (a catalog product) and the manual service (enter a valid unit price) | Selections + manual price entered | |
| 6 | Screen 5 — leave discount none (or fixed amount) | No unsupported % marked applied | |
| 7 | Screen 6 — enter a **customer-facing note** and an **internal memo** (distinct text) | Both fields accept text | |
| 8 | Screen 7 — review | Pricing summary shows **完全 / complete**; catalog + manual lines listed; totals shown | |
| 9 | Confirm pricing completeness = complete (no "未価格" items) | Save button enabled | |
| 10 | Click **見積を保存（下書き）** | Button shows 保存中…, then success | |
| 11 | Record the **Estimate number** shown on success (e.g. `EST-YYYY-NNNNN`) | Number displayed; estimate_id NOT shown to user | |
| 12 | Open the saved Estimate in the existing Estimate view (`/estimates`, then the new draft) | Estimate opens; status = draft | |
| 13 | Confirm all values (customer, vehicle, coating line, manual line, subtotal/tax/total, note) | Match what was entered | |
| 14 | Confirm exactly **one** Estimate was created (no duplicate in the list) | Single estimate | |

Expected reference (from RPC verification): status `draft`; catalog line carries `pricing_source=catalog`
+ `pricing_reference_id`; manual line carries `pricing_source=manual` + `manual_pricing_identity`;
totals equal the reviewed snapshot (no recalculation).

## 2. Existing Customer Test

- [ ] Screen 1 — select an **existing** customer (dealer's own).
- [ ] Screen 2 — select an **existing** vehicle (dealer's own).
- [ ] Complete Screens 3–7 with valid pricing and Save.
- [ ] Save succeeds; estimate number recorded.
- [ ] No duplicate **customer** created (customer list count unchanged).
- [ ] No duplicate **vehicle** created (vehicle list count unchanged).
- [ ] Estimate belongs to the current dealer and opens correctly.

## 3. Validation Test (rejection; no partial data)

Attempt to save each and confirm a controlled error, Wizard state intact, and **no** partial DB record:

- [ ] **No service** selected → save rejected (SERVICE required). No customer/vehicle/estimate created.
- [ ] **Missing manual price** (manual category selected, price left blank) → rejected
      (PRICING_INCOMPLETE / manual price required). No partial record.
- [ ] **Incomplete pricing** (an unresolved item) → rejected (PRICING_INCOMPLETE). No partial record.
- [ ] After each rejection, the Wizard still shows all entered data (nothing cleared).

## 4. Idempotency Test

- [ ] Reach Screen 7 with a valid estimate; click **Save** once → success (record the number).
- [ ] Immediately click **Save** again (or retry) with the same session → treated as a successful
      **replay** (same estimate; the panel shows "再送信のため既存の見積を返しました").
- [ ] Confirm **only one** Estimate exists for this session.
- [ ] Confirm **no duplicate** Customer, Vehicle, or Estimate Items.

## 5. Notes Test

- [ ] Customer note appears in the **customer-facing** notes field of the saved Estimate.
- [ ] Internal memo appears only in the **internal-only** field.
- [ ] Internal memo is **NOT** shown in any customer-facing preview (Screen 7 renders it in the amber
      "社内メモ（スタッフ専用） / お客様には表示されません" block only).
- [ ] Internal memo does **not** appear in any PDF / LINE / email preparation path.

## 6. Responsive Test

Use browser devtools responsive mode. For each width, check the boxes.

| Check | Desktop 1440px | iPad 768px | iPhone 390px |
| --- | --- | --- | --- |
| No horizontal overflow | | | |
| Buttons usable | | | |
| Step navigation visible | | | |
| Review screen readable | | | |
| Save status (idle/saving/success) clear | | | |
| Error state clear | | | |
| Success state clear | | | |

## 7. Evidence (record for every scenario)

| Scenario | Pass/Fail | Screenshot filename | Estimate number | Notes | Defect (if failed) |
| --- | --- | --- | --- | --- | --- |
| A — New customer + new vehicle | | | | | |
| B — Existing customer + existing vehicle | | | | | |
| C — Validation rejection (no service) | | | — | | |
| C — Validation rejection (missing manual price) | | | — | | |
| C — Validation rejection (incomplete pricing) | | | — | | |
| D — Idempotent retry | | | | | |
| E — Cross-dealer rejection | | | — | | |
| F — Notes protection | | | | | |
| Desktop 1440px | | | — | | |
| iPad 768px | | | — | | |
| iPhone 390px | | | — | | |
| Saved Estimate reload | | | | | |
| EstimateEditor regression (existing estimate opens) | | | | | |

Save screenshots under an agreed folder (e.g. `docs/e2e-evidence/`) and reference filenames above.

## 8. Completion Status (Phase 11M)

- Code verification: **passed**
- Typecheck: **passed**
- Build: **passed**
- RPC verification: **passed**
- Database verification: **passed**
- Browser verification: **pending manual execution** (this checklist)
- Production: **untouched**

Sign-off (super_admin): name / date / overall Pass or Fail: ______________________

## Cleanup

After verification, remove test estimates/customers/vehicles created during the run (test data only;
never delete unrelated records). Deleting a test estimate cascades to its items.
