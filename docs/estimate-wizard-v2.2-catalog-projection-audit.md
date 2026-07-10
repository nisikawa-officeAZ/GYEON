# Estimate Wizard Ver2.2 — Catalog Projection Audit (Phase 10C)

**Phase:** 10C (identity projection only — no pricing execution, no Wizard UI data-source change).
**Deliverable:** a read-only, deterministic projection layer (`wizard/catalog/*`) + this audit.
All findings were read directly from source; nothing is guessed.

---

## 1. Production catalog authority
`src/lib/pricing/pricing-catalog.ts` — the single injectable price/identity source
(`PricingCatalog`, `DEFAULT_PRICING_CATALOG`, `makePricingCatalog`, `dealerSettingsToPricingCatalog`,
`bodySizeMultiplier`), backed by `pricing-data.ts`. Exposed via the canonical entry point
`src/lib/pricing/canonical-pricing-engine.ts`. The projection depends on the **pure** `PricingCatalog`
object; it does **not** call the `"use server"` `getDealerPricingCatalog()` (side-effecting).

## 2. Catalog input shape
`PricingCatalog` = `{ bodySizes[], coatings[], topcoatBase/Name, coatingOptions[], maintenanceMenus[],
carwashMenus[], roomCleanParts[], roomCleanConditions[], windowParts[], windowGrades[], ppfPlans[],
ppfPlanPrices{plan→size→price}, ppfFilmTypes[], ppfVehicleRanks[], ppfFrontGlass[], ppfSingleParts[] }`.
Item identity is a stable string `id` on each entry. There is **no** per-item `active` field and **no**
per-item manual-price metadata in the catalog.

## 3. Wizard projection output shape
`WizardCatalogProjection = { schemaVersion:'2.2', categories: WizardCatalogCategory[], warnings[],
errors[] }`, where each `WizardCatalogItem` carries `presentationId`, `pricingReferenceId`,
`category`, `label`, `description`, `pricingPolicy`, `manualPricePolicy`, `active`, `eligible`,
`supportedBodySizes[]`, `optionReferenceIds[]`, and a `presentation` block (displayOrder, iconKey,
badge, groupKey). **No price/tax/total is exposed.**

## 4. Category-by-category support matrix
| Wizard category | Prod catalog support | Authoritative ids | Options | Size pricing | Manual-price meta | Wizard presentation meta today | Future UI migration safe? |
|---|---|---|---|---|---|---|---|
| coating | Yes (`coatings`) | Yes (`cancoat-evo…infinit2`) | Yes (`coatingOptions`) | Yes (bodySize multiplier) | No | Yes (`coating-matrix.ts`) | Yes (5/8 ids align; reconcile 3) |
| ppf | Yes (`ppfPlans`+`ppfSingleParts`+`ppfFrontGlass`) | Yes | film/rank coeff modifiers | Yes (`ppfPlanPrices`) | No | Yes (`ppf-config.ts`) | Needs method→plan model projection |
| window | Yes (`windowParts`+`windowGrades`) | Yes (`wf-*`) | grade modifier | No | No | Yes (`window-film-config.ts`) | Needs area→part projection |
| maintenance | Yes (`maintenanceMenus` A–E) | Yes but **priced 0** | — | No | No | Yes (`body-maintenance-config.ts`) | Needs dealer pricing + re-key |
| carwash | Yes (`carwashMenus` cw-*) | Yes | — | No | No | Yes (`car-wash-config.ts`) | Yes (re-key) |
| roomclean | Yes (`roomCleanParts` rc-* + condition) | Yes | condition modifier | No | No | Yes (`room-cleaning-config.ts`) | Needs condition selector |
| other | **No catalog** (OtherInput free) | No | — | No | manual only | Yes (`other-work-config.ts`) | manual_only path |
| store_global_options | Yes (as `coatingOptions`) | Yes | — | No | No | Yes (`store-global-options-config.ts`) | Reconcile ids; cross-category semantics |

Projection includes **every** category (none silently dropped); `other` is emitted as an empty
category with an `UNSUPPORTED_WIZARD_CATEGORY` warning (manual_only).

## 5. Current Wizard config source files
`coating-matrix.ts`, `ppf-config.ts`, `window-film-config.ts`, `body-maintenance-config.ts`,
`car-wash-config.ts`, `room-cleaning-config.ts`, `other-work-config.ts`,
`store-global-options-config.ts`, `discount-coupon-config.ts` (all under `wizard/screens/`).
**Config files containing pricing-like data (must NOT be treated as production prices):**
`body-maintenance-config.ts` (`defaultPrice`), `car-wash-config.ts` (`defaultPrice`),
`room-cleaning-config.ts` (`defaultPrice`), `window-film-config.ts` (`defaultUnitPrice`),
`other-work-config.ts` (`defaultPrice`), `store-global-options-config.ts` (`defaultPrice`),
`discount-coupon-config.ts` (`discountValue`). These are **preview fixtures**; production prices come
only from the catalog.

## 6. Identity mismatch list (id-based; verified by `compareWizardConfigToCatalog`)
- **maintenance:** wizard `maint-6m/12m/coating/light/premium` ↔ catalog `A,B,C,D,E` → **0 matched**.
- **carwash:** wizard `wash-*` ↔ catalog `cw-*` → **0 matched**.
- **roomclean:** wizard `room-*` ↔ catalog `rc-*` → **0 matched**.
- **store_global_options:** wizard `gopt-iron/hardpolish/scratch/headlight/touchpen` ↔ catalog options
  `iron/polish/…/headlight/…` → **0 matched by id** (names coincide for 3; `scratch`/`touchpen` absent).
- **coating:** 5/8 match; `matte-evo` (no prod id), `infinite-base-1/2 ≠ infinit1/2`.
- **window/ppf:** structurally different models (areas/methods vs parts/plans) — projected as catalog
  identities; Wizard selection re-keying/projection is 10D-pre-work.

## 7. Duplicate identity findings
Over `DEFAULT_PRICING_CATALOG`, the projection reports **no** duplicate presentation ids, **no**
duplicate production ids, and **no** duplicate option ids (all catalog ids are unique within and
across projected item sets). The projection **detects and reports** duplicates (`DUPLICATE_PRESENTATION_ID`,
`DUPLICATE_PRODUCTION_ID`, `DUPLICATE_OPTION_ID`) if a future catalog introduces them — it never
auto-repairs. Because `presentationId` intentionally reuses `pricingReferenceId`, "one presentation id
→ multiple production ids" cannot occur by construction.

## 8. Missing presentation metadata
The catalog carries identity/price but no icon/order/badge/grouping. The projection raises
`MISSING_PRESENTATION_METADATA` / `MISSING_ICON_METADATA` for any catalog id absent from the injected
metadata and falls back to catalog name + positional `displayOrder` (presentation only, never
identity). The dev fixture (`wizard-catalog-fixtures.ts`) supplies metadata for a representative
subset; the rest warn (expected until a full presentation-metadata set is authored in 10C-follow-up).

## 9. Missing production identities
`matte-evo`, `infinite-base-1`, `infinite-base-2` (coating), `gopt-scratch` (傷補修),
`gopt-touchpen` (タッチペン), and all `maint-*/wash-*/room-*` Wizard ids have **no** production id. The
projection never invents these — items are projected only from the catalog side; the Wizard-side gap
is reported in §6 and by the compare utility.

## 10. Eligibility handling
The catalog's only eligibility flag is `coatings[].certOnly` (CERTIFIED-only). Rank eligibility depends
on a dealer rank that is **not** an input to the projection signature, so the projection **does not
recompute eligibility** — it sets `eligible: true` uniformly and preserves rank/cert as a future
context concern (documented). No rank rule is hardcoded, no eligibility is inferred from labels. (A
future signature may accept a rank/eligibility context to set `eligible`/`INELIGIBLE_CATALOG_ITEM`.)

## 11. Manual price policy findings
The catalog has **no** manual-price metadata for any category. Per the 10B contract and §14, the
projection uses the safest non-behavioral fallback `manualPricePolicy: 'disabled'` for all items and
raises `MANUAL_POLICY_UNRESOLVED` for the categories where 10A left the override policy pending
(`ppf, window, maintenance, carwash, roomclean, store_global_options`). Manual override is **not**
enabled merely because the current UI has an editable field.

## 12. Pricing policy findings
`pricingPolicy` is set from the approved 10A conclusions: `coating/ppf/window/maintenance/carwash/
roomclean/store_global_options → catalog_only`, `other → manual_only`. Not derived from UI labels; no
behavior depends on the projected policy yet.

## 13. Future Screen 3 migration plan
Screen 3 (category selection) is category-level and already uses the canonical `ServiceCategoryId`s
(single source of truth). Migration is low-risk: gate category availability by "does the projected
catalog contain items for this category" (all 7 do except manual `other`). No id re-keying needed at
Screen 3. Keep the current toggle UI; drive only the *enabled/disabled* state from projection presence.

## 14. Future Screen 4 migration plan
Screen 4 (per-service configuration) is where id alignment matters. Plan:
1. Author full presentation metadata keyed by production id (icons/order/badges/groups) — config files
   become presentation-only.
2. Re-key or project each selector's options from `projectProductionCatalogToWizard(...)`:
   maintenance/carwash/roomclean → direct id lists; window (area→`wf-*` part + grade), ppf
   (method→plan + film/rank + `sp-*` parts), coating (layer→`coatingId`+`topcoat`), store options →
   `coatingOptions`.
3. Resolve the §6 blockers (coating id reconciliation, maintenance pricing, missing options) first.
4. Keep GenSpark visuals and selection-state shapes unchanged; only the *option source* changes.
Runtime Screen 4 data source is **not** switched in this phase.

## 15. Blocking issues for PHASE 10D
1. **Coating id reconciliation** (`infinite-base-1/2 ↔ infinit1/2`; `matte-evo`).
2. **Maintenance pricing** — catalog `A..E` priced 0; needs dealer prices and Wizard re-key.
3. **Window/PPF/Room model projection** — method/area/menu → plan/part/condition.
4. **Store global options** — id reconciliation + cross-category semantics + missing `scratch`/`touchpen`.
5. **Manual-override policy** per category (unresolved) — required before override-aware pricing.
6. **Full presentation metadata** authoring (icons/order/badges) to clear `MISSING_*` warnings.
These are the same 10A blockers; 10D read-only pricing should map only items with resolved
`pricingReferenceId`s and return controlled `UNKNOWN_SERVICE_ID`/`PRICING_REFERENCE_NOT_FOUND` for the rest.

## 16. Non-goals (this phase)
No pricing/tax/discount/coupon execution; no Screen 3/4 runtime data-source change; no removal of
preview config; no UI/label/layout/selection-shape change; no catalog loading/`getDealerPricingCatalog`
call; no save/DB/API/server-action/migration/PDF/LINE/OCR; no dependency; no modification of the
excluded Unified Wizard draft or unrelated PDF/estimate-type files. The projection + audit are the
sole deliverables.
