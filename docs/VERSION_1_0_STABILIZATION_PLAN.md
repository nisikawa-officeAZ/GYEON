# DealerOS — Version 1.0 Stabilization Plan (E11.1)

Planning artifact for stabilizing Version 1.0 based on findings from the Developer
Preview. **Planning only — no code, schema, or deployment changes.**

Inputs: `docs/developer-preview-test-pack.md` (16-flow checklist),
`docs/developer-preview-launch-guide.md`, `docs/DEVELOPER_PREVIEW_SIGNOFF.md`.

---

## 1. Stabilization roadmap

Findings from Developer Preview are triaged into four **severity** groups. Severity
drives scheduling; Priority (§3) drives fix order within a group.

| Severity | Definition | Handling | Blocks 1.0? |
|---|---|---|---|
| **Critical** | Data loss/corruption, dealer-isolation breach, auth bypass, app-wide crash, money miscalculation, PDF shows wrong totals. | Fix immediately; hotfix branch off the feature branch; re-run full regression suite (§4). | **Yes** |
| **High** | A core flow cannot be completed (OCR→estimate→invoice→statement), wrong-but-recoverable amounts, save fails for valid input, a listed route unreachable. | Fix before release; batch by category; regression per §4. | **Yes** |
| **Medium** | Usability friction, missing loading/disabled state, confusing message, non-blocking layout issue, slow-but-usable screen. | Fix if time permits pre-1.0; otherwise schedule to 1.0.x. | No |
| **Low** | Cosmetic (spacing, label wording, minor alignment), nice-to-have. | Backlog for 1.0.x / 1.1. | No |

**Workflow per finding:** log (category + severity + priority + repro + device) → confirm/repro → assign → fix on a branch → regression (§4) → typecheck + build → operator re-verify the affected checklist item → close.

---

## 2. Bug Classification Matrix

Every finding gets exactly one **Category** and one **Severity** (§1) and one
**Priority** (§3). Category owners/notes:

| # | Category | Scope | Typical severity signal |
|---|---|---|---|
| 1 | UI / UX | Layout, flow, clicks, empty states | usually Medium/Low; High if a step is unreachable |
| 2 | OCR | Upload (camera/image/PDF), gpt-4.1-mini extraction, review, save/link | High if extraction/save fails; Critical if wrong data saved silently |
| 3 | Estimate | Wizard routing, category steps, totals, PDF order/branding | Critical if totals wrong; High if a category can't be estimated |
| 4 | Customer | Create/edit, duplicate match, trade fields | High if save fails; Critical if cross-dealer leakage |
| 5 | Vehicle | Create/edit/link, duplicate match | High if save/link fails |
| 6 | Reservation | Create/edit, capacity warnings | High if create fails; Medium for warning inaccuracies |
| 7 | Calendar | Day/time axis, JST correctness, slot click | Critical if wrong-day (TZ) booking; High otherwise |
| 8 | Work Order | Create from estimate, status, handoff | High if data not carried over |
| 9 | Completion Report | Create, PDF, branding | Medium/High |
| 10 | Invoice | Create from estimate/WO, due date, totals, PDF | Critical if totals wrong; High if create fails |
| 11 | Payment | Record payment, paid/balance/progress/status | Critical if balance/status wrong; High otherwise |
| 12 | Statement | Closing-billing preview + non-persisted PDF, aggregation | High if aggregation wrong; Medium for display |
| 13 | Performance | Slow load, unnecessary renders, duplicate API calls | Medium; High if a core screen is unusable |
| 14 | Mobile | iPhone/Android layout, keyboard, safe-area, scroll, dialogs | Medium; High if a core action is impossible on device |
| 15 | Security | dealer isolation, role permissions, error/detail exposure, auth | **Critical** by default until scoped down |

---

## 3. Fix Policy (Priority)

| Priority | Meaning | Examples |
|---|---|---|
| **P1** | Application cannot continue. | Crash, blank screen, save/login impossible, data loss, isolation breach. |
| **P2** | Business operation is difficult. | A core flow needs painful workarounds; wrong-but-recoverable amounts; PDF unusable. |
| **P3** | Usability improvement. | Missing loading/disabled state, confusing copy, extra clicks. |
| **P4** | Cosmetic issue. | Spacing, alignment, label wording, minor color. |

Mapping guidance: **Critical ⇢ typically P1/P2**, **High ⇢ P2**, **Medium ⇢ P3**, **Low ⇢ P4** (Priority may be raised independently for frequency/visibility).

---

## 4. Regression Policy (mandatory per fix)

**Every** fix — regardless of category — must re-verify these before merge, because
they are the shared engines/flows most likely to be disturbed:

1. **OCR** — upload (image + PDF) → extraction → review → save/link still works.
2. **Estimate** — wizard routing + totals unchanged; PDF order/branding intact.
3. **Canonical Pricing Engine** — amounts identical for a fixed sample (spot-check subtotal/discount/tax/total).
4. **Dealer Branding Engine** — logo/name/footer/QR render on Estimate/Invoice/Completion/Statement PDFs.
5. **Reservation** — create/display at correct JST time.
6. **Calendar** — day/time axis + slot behavior unchanged.
7. **Accounts Receivable** — outstanding/paid/overdue/progress/status correct.
8. **Statement Preview** — closing-billing aggregation + PDF correct; per-invoice customers show none.

Plus always: **`npm run typecheck` PASS**, **`npm run build` PASS**, and **`dealer_id` sourced only from `getCurrentDealer()`** (no client-supplied dealer_id introduced).

Regression verification methods: pure-logic harnesses where available (pricing/AR/billing were validated at 24/24, 16/16, 12/12, 20/20, 13/13 during E5–E9); operator re-run of the affected E10.2 checklist items for UI/OCR/mobile.

---

## 5. Version 1.0 Release Criteria (Readiness Checklist)

Release Version 1.0 only when **all** are true:

- [ ] **No Critical bugs** open.
- [ ] **No High bugs** open.
- [ ] **Typecheck PASS** (`npm run typecheck`).
- [ ] **Build PASS** (`npm run build`).
- [ ] **Developer Preview completed** — all High-priority checklist items (E10.2) executed with recorded results.
- [ ] **Operator acceptance completed** — sign-off from the operator on the acceptance run.
- [ ] Regression suite (§4) green on the release candidate commit.
- [ ] **Dealer isolation verified** — no client-supplied `dealer_id`; per-role screen access confirmed (Owner/Manager/Staff/ReadOnly).
- [ ] **No internal-detail/stack-trace exposure** in user-facing errors (spot-check OCR/PDF/save failures).
- [ ] Medium/Low findings triaged and scheduled to 1.0.x (documented, not necessarily fixed).
- [ ] Release notes + known-limitations updated (`docs/UAT_KNOWN_LIMITATIONS.md` or equivalent).
- [ ] Migration state confirmed for the target environment (092/093 applied where the corresponding flags are enabled); **no schema change lands without an approved, created-not-applied migration**.

Out of scope for 1.0 GA (post-1.0): per-customer closing/payment schema (Option C / E8.6+ deferred), estimate `item_group`/`is_option` distinct "options" slot, live OCR provider fallback (Anthropic/Gemini), OCR history operator-name resolution.

---

## Constraints carried forward
- `dealer_id` always from `getCurrentDealer()`; never from client input.
- No production deployment / no merge to main until the release criteria above are met and separately authorized.
