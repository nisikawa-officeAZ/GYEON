// Estimate Wizard Ver2.2 — Phase 8 integration contract tests (Phase 8-B1H, extended in 8-B2B).
//
// Pure behavioural tests for the hardened integration files. No React, no DOM, no server, no DB,
// no API, no randomness, no clock. No `any`, no `as any`, no `as unknown as`, and no unsafe
// assertion to the opaque integration type.
//
// PRICING: sections 1–13 compute no prices. Section 14 (the 8-B2B apply plan) does exercise the
// canonical pricing path, because that is precisely what it must prove: that items are produced by
// `buildWizardPricingInput` → `buildLineItems` and by nothing else. It asserts against the real
// production engine's own output rather than any hard-coded amount, so it pins the WIRING, not a
// price. No price is duplicated, predicted, or re-derived in this file.
//
// Fixtures use obviously synthetic identifiers only — no real customer, vehicle, or note content.
//
// Run: npm run test:estimate-wizard-integration

import test from "node:test";
import assert from "node:assert/strict";

import {
  INTEGRATION_ISSUE_CODES,
  integrationIssueKey,
  hasUnresolvedLegacyItems,
  hasValidSourceEstimateId,
  isServiceConfigurationTrustworthy,
  type EstimateHydrationInput,
} from "./estimateWizardIntegrationContract";
import {
  estimateToWizardDraft,
  newEstimateWizardDraft,
  type HydratedWizardDraft,
} from "./estimateToWizardDraft";
import { validateWizardDraftForEstimateEditorIntegration } from "./validateWizardDraftForEstimateEditorIntegration";
import { buildEstimateEditorApplyPlan } from "./wizardDraftToEditorPatch";
import {
  initialEstimateWizardDraftV22, setCurrentStep,
  updateCustomer, updateVehicle, updateServiceSelection, updateServiceConfiguration,
  updateDiscountAndCoupon, updateNotes,
} from "../draft/wizard-draft-state";
import { buildWizardPricingInput } from "../pricing/wizard-pricing-input-adapter";
import { buildWizardPricingInputFromConfig } from "../pricing/wizard-pricing-input-adapter-config";
import {
  buildManualPricingLinesFromConfig,
  WIZARD_PRICING_CONFIG_ERRORS,
  type ProductionPricingConfiguration,
  type ProductionLabelOption,
  type ProductionStoreGlobalOption,
} from "../pricing/wizard-manual-pricing-config";
import { buildLineItems } from "@/lib/pricing/pricing-engine";
import { DEFAULT_PRICING_CATALOG } from "@/lib/pricing/pricing-catalog";
import type { EstimateItemDB, EstimateCategory } from "@/lib/estimates/estimate-types";

// ── Fixtures (synthetic only) ────────────────────────────────────────────────────
function item(id: string, category: EstimateCategory = "coating"): EstimateItemDB {
  return {
    id,
    estimate_id: "EST-TEST",
    dealer_id: "DEALER-TEST",
    category,
    item_name: "TEST-ITEM",
    description: null,
    quantity: 1,
    unit_price: 1000,
    discount_rate: 0,
    line_total: 1000,
    sort_order: 0,
    created_at: "",
    updated_at: "",
  };
}

function estimate(overrides: Partial<EstimateHydrationInput> = {}): EstimateHydrationInput {
  return {
    id: "EST-TEST",
    customer_id: "CUST-TEST",
    vehicle_id: "VEH-TEST",
    discount_amount: 0,
    notes: null,
    internal_memo: null,
    vehicles: { body_size: "M" },
    estimate_items: [],
    ...overrides,
  };
}

const codesOf = (h: HydratedWizardDraft) =>
  validateWizardDraftForEstimateEditorIntegration(h).blockingIssues.map((i) => i.code);

// ── Production pricing configuration (Phase 8-B2F-B) ─────────────────────────────
// The AUTHORITATIVE label source for every manual category. Deliberately uses labels that exist in
// NO fixture module, so any fixture text appearing in production output is unmistakable.
//
// The codes intentionally REUSE the ids the fixture modules also use, because that is the dangerous
// case: if the production path ever fell back to a fixture lookup, it would still find a match and
// silently emit the fixture's label instead of ours. Distinct labels make that visible.
/** A label-only option: code + authoritative label. No price, no quantity fields (8-B2F-BH). */
const opt = (code: string, label: string): ProductionLabelOption => ({ code, label });

/** A store-global option: the ONLY collection carrying priceability + quantity rules. */
const gopt = (
  code: string,
  label: string,
  over: Partial<Omit<ProductionStoreGlobalOption, "code" | "label">> = {},
): ProductionStoreGlobalOption => ({
  code, label, priceable: true, quantityRequired: false, minQuantity: 1, maxQuantity: null, ...over,
});

const TEST_CONFIG: ProductionPricingConfiguration = {
  ppfMethods:         [opt("full", "CFG-PPF-FULL")],
  filmTypes:          [opt("film-a", "CFG-FILM-A")],
  maintenanceMenus:   [opt("maint-a", "CFG-MAINT-A")],
  washMenus:          [opt("wash-a", "CFG-WASH-A")],
  roomCleaningMenus:  [opt("room-a", "CFG-ROOM-A"), opt("room-b", "CFG-ROOM-B")],
  storeGlobalOptions: [
    gopt("gopt-a", "CFG-GOPT-A"),
    gopt("gopt-free", "CFG-GOPT-FREE", { priceable: false }),
    gopt("gopt-qty",  "CFG-GOPT-QTY",  { quantityRequired: true, minQuantity: 1, maxQuantity: 5 }),
  ],
};

/** Every label this configuration can legitimately produce. */
const CONFIG_LABELS = [
  "CFG-PPF-FULL", "CFG-FILM-A", "CFG-MAINT-A", "CFG-WASH-A",
  "CFG-ROOM-A", "CFG-ROOM-B", "CFG-GOPT-A", "CFG-GOPT-QTY",
];

// ── 1. Valid hydration and validation ────────────────────────────────────────────
test("new estimate hydrates to a ready, unblocked draft", () => {
  const h = newEstimateWizardDraft();
  assert.equal(h.integration.sourceKind, "new");
  assert.equal(h.integration.sourceEstimateId, null);
  assert.equal(h.integration.reconstructionStatus, "not-applicable");
  assert.deepEqual(h.integration.unresolvedItemIds, []);

  const r = validateWizardDraftForEstimateEditorIntegration(h);
  assert.equal(r.canApplyToEstimateEditor, true);
  assert.equal(r.canPersist, true);
  assert.deepEqual(r.blockingIssues, []);
});

test("existing estimate with no persisted items is ready", () => {
  const h = estimateToWizardDraft(estimate({ estimate_items: [] }));
  assert.equal(h.integration.sourceKind, "existing");
  assert.equal(h.integration.sourceEstimateId, "EST-TEST");
  assert.equal(h.integration.reconstructionStatus, "complete");

  const r = validateWizardDraftForEstimateEditorIntegration(h);
  assert.equal(r.canApplyToEstimateEditor, true);
  assert.equal(r.canPersist, true);
});

test("hydration copies persisted scalars into the draft", () => {
  const h = estimateToWizardDraft(
    estimate({ discount_amount: 5000, vehicles: { body_size: "L" } }),
  );
  assert.equal(h.draft.customer.sourceMode, "existing");
  assert.equal(h.draft.vehicle.sourceMode, "existing");
  assert.equal(h.draft.vehicle.bodySizeKey, "L");
  assert.equal(h.draft.discountAndCoupon.mode, "amount");
  assert.equal(h.draft.discountAndCoupon.amountInput, "5000");
});

// ── 2. Compile-time opaque construction protection ───────────────────────────────
// The forgery routes below are COMPILE errors (TS2741 — the private witness is missing), so they
// cannot be expressed as runtime assertions without an unsafe assertion, which is forbidden. They
// are recorded here as executable documentation of what the type system rejects:
//
//   const literal: HydratedWizardDraft = { draft, integration };                       // ✗ TS2741
//   const spread:  HydratedWizardDraft = { ...valid, integration: tampered };          // ✗ TS2741
//   validateWizardDraftForEstimateEditorIntegration(bareDraft);                        // ✗ TS2345
//
// Verified in Phase 8-B1E/B1F by compiling probes outside the repository.
test("the opaque draft is produced only by the factories", () => {
  const h = newEstimateWizardDraft();
  // Both factories return a value carrying integration provenance — the only construction path.
  assert.ok(Object.prototype.hasOwnProperty.call(h, "integration"));
  assert.ok(Object.prototype.hasOwnProperty.call(h, "draft"));
});

// ── 3. Runtime immutability ──────────────────────────────────────────────────────
test("the hydrated draft is frozen", () => {
  const h = estimateToWizardDraft(estimate({ estimate_items: [item("ITEM-1")] }));
  assert.equal(Object.isFrozen(h), true);
  assert.equal(Object.isFrozen(h.integration), true);
  assert.equal(Object.isFrozen(h.integration.unresolvedItemIds), true);
  assert.equal(Object.isFrozen(h.integration.issues), true);
  for (const issue of h.integration.issues) assert.equal(Object.isFrozen(issue), true);
});

test("Object.assign on the instance throws and cannot erase blockers", () => {
  const h = estimateToWizardDraft(estimate({ estimate_items: [item("ITEM-1")] }));
  assert.equal(validateWizardDraftForEstimateEditorIntegration(h).canPersist, false);

  assert.throws(() => {
    Object.assign(h, {
      integration: {
        sourceKind: "existing",
        sourceEstimateId: "EST-TEST",
        reconstructionStatus: "complete",
        unresolvedItemIds: [],
        issues: [],
      },
    });
  }, TypeError);

  assert.equal(validateWizardDraftForEstimateEditorIntegration(h).canPersist, false);
});

test("Object.assign on the integration state throws and cannot erase blockers", () => {
  const h = estimateToWizardDraft(estimate({ estimate_items: [item("ITEM-1")] }));

  assert.throws(() => {
    Object.assign(h.integration, { reconstructionStatus: "complete", unresolvedItemIds: [] });
  }, TypeError);

  assert.equal(validateWizardDraftForEstimateEditorIntegration(h).canPersist, false);
  assert.deepEqual(h.integration.unresolvedItemIds, ["ITEM-1"]);
});

test("truncating unresolvedItemIds throws", () => {
  const h = estimateToWizardDraft(estimate({ estimate_items: [item("ITEM-1")] }));
  const ids: readonly string[] = h.integration.unresolvedItemIds;

  assert.throws(() => {
    Object.assign(ids, { length: 0 });
  }, TypeError);

  assert.equal(h.integration.unresolvedItemIds.length, 1);
  assert.equal(validateWizardDraftForEstimateEditorIntegration(h).canPersist, false);
});

test("tampering with the editable draft does not bypass readiness", () => {
  const h = estimateToWizardDraft(estimate({ estimate_items: [item("ITEM-1")] }));
  // `draft` is intentionally NOT frozen — readiness reads `integration`, not `draft`.
  h.draft.serviceSelection.selectedCategories.push("ppf");
  assert.equal(validateWizardDraftForEstimateEditorIntegration(h).canPersist, false);
});

// ── 4. Defensive copying ─────────────────────────────────────────────────────────
// Phase 8-B1J — nested aliasing regression suite.
//
// A shallow spread of `initialEstimateWizardDraftV22` copied only the top level, so every nested
// object and array stayed shared by reference with that module const (which `ScreensPreview` also
// reads). One `blank.draft.notes.internalMemo = "x"` would have leaked into every future blank
// draft. The identity-only assertion that used to live here PASSED throughout — it asserted
// `a.draft !== b.draft` while the nested objects were still shared. These tests replace it.

test("two blank drafts do not share the top-level draft identity", () => {
  const a = newEstimateWizardDraft();
  const b = newEstimateWizardDraft();
  assert.notEqual(a.draft, b.draft);
});

test("mutating notes in draft A does not affect draft B or the shared initial draft", () => {
  const a = newEstimateWizardDraft();
  const b = newEstimateWizardDraft();

  a.draft.notes.internalMemo = "INTERNAL-MEMO-TOKEN";
  a.draft.notes.customerNotes = "CUSTOMER-NOTE-TOKEN";

  assert.equal(b.draft.notes.internalMemo, "");
  assert.equal(b.draft.notes.customerNotes, "");
  assert.equal(initialEstimateWizardDraftV22.notes.internalMemo, "");
  assert.equal(initialEstimateWizardDraftV22.notes.customerNotes, "");
  assert.notEqual(a.draft.notes, b.draft.notes);
  assert.notEqual(a.draft.notes, initialEstimateWizardDraftV22.notes);
});

test("mutating discountAndCoupon in draft A does not affect draft B or the initial draft", () => {
  const a = newEstimateWizardDraft();
  const b = newEstimateWizardDraft();

  a.draft.discountAndCoupon.percentInput = "10";
  a.draft.discountAndCoupon.selectedCouponIds.push("COUPON-TEST-1");

  assert.equal(b.draft.discountAndCoupon.percentInput, "");
  assert.deepEqual(b.draft.discountAndCoupon.selectedCouponIds, []);
  assert.equal(initialEstimateWizardDraftV22.discountAndCoupon.percentInput, "");
  assert.deepEqual(initialEstimateWizardDraftV22.discountAndCoupon.selectedCouponIds, []);
  assert.notEqual(
    a.draft.discountAndCoupon.selectedCouponIds,
    b.draft.discountAndCoupon.selectedCouponIds,
  );
});

test("mutating serviceConfiguration nested arrays/objects in draft A does not affect draft B", () => {
  const a = newEstimateWizardDraft();
  const b = newEstimateWizardDraft();

  a.draft.serviceConfiguration.ppf.selectedPartIds.push("PART-TEST-1");
  a.draft.serviceConfiguration.ppf.quantitiesByPart["PART-TEST-1"] = 2;
  a.draft.serviceConfiguration.ppf.interiorRows.push({
    id: "ROW-TEST-1",
    location: "LOC-TEST",
    amount: "1000",
  });
  a.draft.serviceConfiguration.coating.layerCount = 1;
  a.draft.serviceConfiguration.otherWork.customRows.push({
    id: "CUSTOM-TEST-1",
    name: "NAME-TEST",
    description: "",
    unitPrice: "1000",
    quantity: "1",
    unitLabel: "",
  });
  a.draft.serviceConfiguration.storeGlobalOptions.selectedOptionIds.push("OPT-TEST-1");
  a.draft.serviceConfiguration.roomCleaning.unitPricesByMenu["MENU-TEST-1"] = "500";

  assert.deepEqual(b.draft.serviceConfiguration.ppf.selectedPartIds, []);
  assert.deepEqual(b.draft.serviceConfiguration.ppf.quantitiesByPart, {});
  assert.deepEqual(b.draft.serviceConfiguration.ppf.interiorRows, []);
  assert.equal(b.draft.serviceConfiguration.coating.layerCount, null);
  assert.deepEqual(b.draft.serviceConfiguration.otherWork.customRows, []);
  assert.deepEqual(b.draft.serviceConfiguration.storeGlobalOptions.selectedOptionIds, []);
  assert.deepEqual(b.draft.serviceConfiguration.roomCleaning.unitPricesByMenu, {});

  // The shared module const is untouched.
  assert.deepEqual(initialEstimateWizardDraftV22.serviceConfiguration.ppf.selectedPartIds, []);
  assert.deepEqual(initialEstimateWizardDraftV22.serviceConfiguration.ppf.interiorRows, []);
  assert.equal(initialEstimateWizardDraftV22.serviceConfiguration.coating.layerCount, null);
  assert.deepEqual(initialEstimateWizardDraftV22.serviceConfiguration.otherWork.customRows, []);
});

test("mutating customer and vehicle nested fields in draft A does not affect draft B", () => {
  const a = newEstimateWizardDraft();
  const b = newEstimateWizardDraft();

  a.draft.customer.newCustomer.name = "CUSTOMER-NAME-TOKEN";
  a.draft.customer.newCustomer.isBusiness = true;
  a.draft.vehicle.newVehicle.maker = "MAKER-TOKEN";
  a.draft.vehicle.bodySizeKey = "L";
  a.draft.serviceSelection.selectedCategories.push("coating");

  assert.equal(b.draft.customer.newCustomer.name, "");
  assert.equal(b.draft.customer.newCustomer.isBusiness, false);
  assert.equal(b.draft.vehicle.newVehicle.maker, "");
  assert.equal(b.draft.vehicle.bodySizeKey, "");
  assert.deepEqual(b.draft.serviceSelection.selectedCategories, []);

  assert.equal(initialEstimateWizardDraftV22.customer.newCustomer.name, "");
  assert.equal(initialEstimateWizardDraftV22.vehicle.newVehicle.maker, "");
  assert.deepEqual(initialEstimateWizardDraftV22.serviceSelection.selectedCategories, []);
  assert.notEqual(a.draft.customer.newCustomer, b.draft.customer.newCustomer);
  assert.notEqual(a.draft.vehicle.newVehicle, initialEstimateWizardDraftV22.vehicle.newVehicle);
});

test("no nested object in a blank draft shares identity with the initial draft", () => {
  const a = newEstimateWizardDraft();
  const i = initialEstimateWizardDraftV22;

  assert.notEqual(a.draft.customer, i.customer);
  assert.notEqual(a.draft.customer.newCustomer, i.customer.newCustomer);
  assert.notEqual(a.draft.vehicle, i.vehicle);
  assert.notEqual(a.draft.vehicle.newVehicle, i.vehicle.newVehicle);
  assert.notEqual(a.draft.serviceSelection, i.serviceSelection);
  assert.notEqual(a.draft.serviceSelection.selectedCategories, i.serviceSelection.selectedCategories);
  assert.notEqual(a.draft.serviceConfiguration, i.serviceConfiguration);
  assert.notEqual(a.draft.serviceConfiguration.ppf, i.serviceConfiguration.ppf);
  assert.notEqual(a.draft.serviceConfiguration.ppf.interiorRows, i.serviceConfiguration.ppf.interiorRows);
  assert.notEqual(a.draft.serviceConfiguration.otherWork, i.serviceConfiguration.otherWork);
  assert.notEqual(a.draft.serviceConfiguration.storeGlobalOptions, i.serviceConfiguration.storeGlobalOptions);
  assert.notEqual(a.draft.discountAndCoupon, i.discountAndCoupon);
  assert.notEqual(a.draft.notes, i.notes);
  assert.notEqual(a.draft.review, i.review);
  assert.notEqual(a.draft.metadata, i.metadata);
});

test("a blank draft still deep-equals the initial draft in value", () => {
  const a = newEstimateWizardDraft();
  assert.deepEqual(a.draft, initialEstimateWizardDraftV22); // clone, not a mutation
});

test("the caller's item array is not aliased into the draft", () => {
  const items = [item("ITEM-1")];
  const h = estimateToWizardDraft(estimate({ estimate_items: items }));
  assert.notEqual(h.integration.unresolvedItemIds, items);
  items.push(item("ITEM-2"));
  assert.deepEqual(h.integration.unresolvedItemIds, ["ITEM-1"]); // unaffected
});

// ── 5. Unresolved legacy-item blocking ───────────────────────────────────────────
test("a legacy estimate with persisted items is blocked from apply and persist", () => {
  const h = estimateToWizardDraft(
    estimate({ estimate_items: [item("ITEM-1"), item("ITEM-2", "ppf")] }),
  );
  assert.equal(h.integration.reconstructionStatus, "none");
  assert.deepEqual(h.integration.unresolvedItemIds, ["ITEM-1", "ITEM-2"]);

  const r = validateWizardDraftForEstimateEditorIntegration(h);
  assert.equal(r.canApplyToEstimateEditor, false);
  assert.equal(r.canPersist, false); // apply and persist share ONE gate
  assert.ok(r.blockingIssues.length > 0);
  assert.ok(codesOf(h).includes(INTEGRATION_ISSUE_CODES.UNRESOLVED_LEGACY_ITEMS));
  assert.ok(codesOf(h).includes(INTEGRATION_ISSUE_CODES.SERVICE_CONFIGURATION_NOT_RECONSTRUCTED));
});

test("serviceConfiguration is empty for a legacy estimate and is never trusted", () => {
  const h = estimateToWizardDraft(estimate({ estimate_items: [item("ITEM-1")] }));
  assert.equal(h.draft.serviceConfiguration.coating.layerCount, null);
  assert.deepEqual(h.draft.serviceConfiguration.ppf.selectedPartIds, []);
  assert.equal(isServiceConfigurationTrustworthy(h.integration), false);
  assert.equal(hasUnresolvedLegacyItems(h.integration), true);
});

// ── 6. Estimate-ID invariants ────────────────────────────────────────────────────
test("an existing estimate with a blank id is blocked", () => {
  const h = estimateToWizardDraft(estimate({ id: "   " }));
  assert.equal(h.integration.sourceEstimateId, null);
  assert.equal(hasValidSourceEstimateId(h.integration), false);
  assert.ok(codesOf(h).includes(INTEGRATION_ISSUE_CODES.INVALID_SOURCE_ESTIMATE_ID));
  assert.equal(validateWizardDraftForEstimateEditorIntegration(h).canPersist, false);
});

test("a new draft has a null source id and is still valid", () => {
  const h = newEstimateWizardDraft();
  assert.equal(hasValidSourceEstimateId(h.integration), true);
});

// ── 7. Unsupported adjustment blocking ───────────────────────────────────────────
// Reaching the percent / coupon validator branches requires a draft that CARRIES those values.
// They can never arrive via hydration — the schema has no column for either — so the only honest
// way to exercise the branches is to do what the operator does at runtime: type into Screen 5.
//
// That is legal here without weakening anything. Phase 8-B1G froze `integration` (the safety-critical
// provenance) but deliberately left `draft` mutable, because `draft` is Wizard-owned presentation
// state that Screens 1–7 edit. `WizardDiscountDraft.percentInput` / `.selectedCouponIds` are plain
// mutable fields. So a plain assignment — no cast, no unsafe assertion, no factory seam, no change
// to the production contract — reproduces exactly what Screen 5 produces.
//
// NOTE (corrected in Phase 8-B2C-S): an earlier version of this comment claimed
// `newEstimateWizardDraft()` shallow-spreads `initialEstimateWizardDraftV22` and shares its nested
// objects. That was FALSE — it has always deep-cloned via `cloneWizardDraft`. The claim was exactly
// backwards: `estimateToWizardDraft` was the aliased one, and it is now deep-cloned too (B2C-S).
// Both factories therefore return fully isolated drafts, and mutating either is safe here.

function draftWithOperatorAdjustments(
  edit: (h: HydratedWizardDraft) => void,
): HydratedWizardDraft {
  const h = estimateToWizardDraft(estimate({ estimate_items: [] })); // ready, unblocked
  assert.equal(validateWizardDraftForEstimateEditorIntegration(h).canPersist, true);
  edit(h);
  return h;
}

test("a percentage discount blocks apply and persist, and is never cleared", () => {
  const h = draftWithOperatorAdjustments((d) => {
    d.draft.discountAndCoupon.percentInput = "10";
  });

  const r = validateWizardDraftForEstimateEditorIntegration(h);
  assert.equal(r.canApplyToEstimateEditor, false);
  assert.equal(r.canPersist, false);
  assert.ok(
    r.blockingIssues.some(
      (i) => i.code === INTEGRATION_ISSUE_CODES.UNSUPPORTED_PERCENTAGE_DISCOUNT_PERSISTENCE,
    ),
  );
  // The operator's input survives — it is blocked, never silently discarded.
  assert.equal(h.draft.discountAndCoupon.percentInput, "10");
  assert.equal(typeof h.draft.discountAndCoupon.percentInput, "string"); // scalar cardinality
});

test("a whitespace-only percentage is inactive and does not block", () => {
  const h = draftWithOperatorAdjustments((d) => {
    d.draft.discountAndCoupon.percentInput = "   ";
  });
  assert.equal(validateWizardDraftForEstimateEditorIntegration(h).canPersist, true);
});

test("a selected coupon blocks apply and persist, and is never cleared", () => {
  const h = draftWithOperatorAdjustments((d) => {
    d.draft.discountAndCoupon.selectedCouponIds.push("COUPON-TEST-1");
  });

  const r = validateWizardDraftForEstimateEditorIntegration(h);
  assert.equal(r.canApplyToEstimateEditor, false);
  assert.equal(r.canPersist, false);
  assert.ok(
    r.blockingIssues.some(
      (i) => i.code === INTEGRATION_ISSUE_CODES.UNSUPPORTED_COUPON_PERSISTENCE,
    ),
  );
  // The operator's selection survives — blocked, never silently discarded.
  assert.deepEqual(h.draft.discountAndCoupon.selectedCouponIds, ["COUPON-TEST-1"]); // array cardinality
});

test("multiple coupons keep array cardinality and still block", () => {
  const h = draftWithOperatorAdjustments((d) => {
    d.draft.discountAndCoupon.selectedCouponIds.push("COUPON-TEST-1", "COUPON-TEST-2");
  });
  const r = validateWizardDraftForEstimateEditorIntegration(h);
  assert.equal(r.canPersist, false);
  assert.equal(h.draft.discountAndCoupon.selectedCouponIds.length, 2);
});

test("percent and coupon together raise BOTH blocking codes, deduplicated", () => {
  const h = draftWithOperatorAdjustments((d) => {
    d.draft.discountAndCoupon.percentInput = "15";
    d.draft.discountAndCoupon.selectedCouponIds.push("COUPON-TEST-1");
  });

  const r = validateWizardDraftForEstimateEditorIntegration(h);
  const codes = r.blockingIssues.map((i) => i.code);
  assert.ok(codes.includes(INTEGRATION_ISSUE_CODES.UNSUPPORTED_PERCENTAGE_DISCOUNT_PERSISTENCE));
  assert.ok(codes.includes(INTEGRATION_ISSUE_CODES.UNSUPPORTED_COUPON_PERSISTENCE));

  const keys = r.issues.map(integrationIssueKey);
  assert.equal(new Set(keys).size, keys.length);
});

test("a fixed yen discount does NOT block — it is the one supported adjustment", () => {
  const h = estimateToWizardDraft(estimate({ discount_amount: 5000, estimate_items: [] }));
  const r = validateWizardDraftForEstimateEditorIntegration(h);
  assert.equal(h.draft.discountAndCoupon.amountInput, "5000");
  assert.equal(r.canPersist, true);
  assert.equal(
    r.blockingIssues.some(
      (i) => i.code === INTEGRATION_ISSUE_CODES.UNSUPPORTED_PERCENTAGE_DISCOUNT_PERSISTENCE,
    ),
    false,
  );
});

test("hydration never invents a percent or a coupon", () => {
  const h = estimateToWizardDraft(estimate({ discount_amount: 5000 }));
  assert.equal(h.draft.discountAndCoupon.percentInput, ""); // no persisted source
  assert.deepEqual(h.draft.discountAndCoupon.selectedCouponIds, []); // no persisted source
  assert.equal(h.draft.discountAndCoupon.amountInput, "5000"); // the ONLY supported adjustment
});

// ── 8. Issue deduplication ───────────────────────────────────────────────────────
test("issues are deduplicated by (code, field)", () => {
  const h = estimateToWizardDraft(estimate({ estimate_items: [item("ITEM-1")] }));
  const { issues } = validateWizardDraftForEstimateEditorIntegration(h);
  const keys = issues.map(integrationIssueKey);
  assert.equal(new Set(keys).size, keys.length, "duplicate (code, field) issue found");
});

// ── 9. Notes separation ──────────────────────────────────────────────────────────
test("customerNotes and internalMemo map 1:1 and are never merged", () => {
  const h = estimateToWizardDraft(
    estimate({ notes: "CUSTOMER-NOTE-TOKEN", internal_memo: "INTERNAL-MEMO-TOKEN" }),
  );
  assert.equal(h.draft.notes.customerNotes, "CUSTOMER-NOTE-TOKEN");
  assert.equal(h.draft.notes.internalMemo, "INTERNAL-MEMO-TOKEN");
  assert.ok(!h.draft.notes.customerNotes.includes("INTERNAL-MEMO-TOKEN"));
  assert.ok(!h.draft.notes.internalMemo.includes("CUSTOMER-NOTE-TOKEN"));
});

test("no issue message or field leaks note content", () => {
  const h = estimateToWizardDraft(
    estimate({
      notes: "CUSTOMER-NOTE-TOKEN",
      internal_memo: "INTERNAL-MEMO-TOKEN",
      estimate_items: [item("ITEM-1")],
    }),
  );
  for (const issue of validateWizardDraftForEstimateEditorIntegration(h).issues) {
    assert.ok(!issue.message.includes("CUSTOMER-NOTE-TOKEN"));
    assert.ok(!issue.message.includes("INTERNAL-MEMO-TOKEN"));
    assert.ok(!issue.field.includes("CUSTOMER-NOTE-TOKEN"));
    assert.ok(!issue.field.includes("INTERNAL-MEMO-TOKEN"));
  }
});

// ── 10. Identifier preservation ──────────────────────────────────────────────────
test("persisted identifiers are copied verbatim and never regenerated", () => {
  const h = estimateToWizardDraft(
    estimate({
      id: "EST-TEST",
      customer_id: "CUST-TEST",
      vehicle_id: "VEH-TEST",
      estimate_items: [item("ITEM-1"), item("ITEM-2")],
    }),
  );
  assert.equal(h.integration.sourceEstimateId, "EST-TEST");
  assert.equal(h.draft.customer.customerId, "CUST-TEST");
  assert.equal(h.draft.vehicle.vehicleId, "VEH-TEST");
  assert.deepEqual(h.integration.unresolvedItemIds, ["ITEM-1", "ITEM-2"]);
});

test("hydration is deterministic", () => {
  const input = estimate({ estimate_items: [item("ITEM-1")] });
  const a = estimateToWizardDraft(input);
  const b = estimateToWizardDraft(input);
  assert.deepEqual(a.integration, b.integration);
  assert.deepEqual(a.draft, b.draft);
});

// ── 11. Input non-mutation ───────────────────────────────────────────────────────
test("the persisted input is never mutated", () => {
  const input = estimate({
    discount_amount: 5000,
    notes: "CUSTOMER-NOTE-TOKEN",
    estimate_items: [item("ITEM-1")],
  });
  const snapshot = JSON.parse(JSON.stringify(input)) as EstimateHydrationInput;
  estimateToWizardDraft(input);
  assert.deepEqual(input, snapshot);
});

// ── 12. No Screen4 inference ─────────────────────────────────────────────────────
test("Screen-4 configuration is never inferred from item_name, price, or quantity", () => {
  const h = estimateToWizardDraft(estimate({ estimate_items: [item("ITEM-1", "coating")] }));
  const cfg = h.draft.serviceConfiguration;
  assert.equal(cfg.coating.layerCount, null);
  assert.equal(cfg.coating.layer1Id, null);
  assert.equal(cfg.ppf.installationMethod, null);
  assert.equal(cfg.windowFilm.filmTypeId, null);
  assert.equal(cfg.bodyMaintenance.menuId, null);
  assert.equal(cfg.carWash.menuId, null);
  assert.deepEqual(cfg.roomCleaning.selectedMenuIds, []);
  assert.deepEqual(cfg.otherWork.selectedPresetIds, []);
  assert.deepEqual(cfg.storeGlobalOptions.selectedOptionIds, []);
});

test("Screen-3 categories are mapped, but persisted-only categories are reported not coerced", () => {
  const h = estimateToWizardDraft(
    estimate({ estimate_items: [item("ITEM-1", "coating"), item("ITEM-2", "glass")] }),
  );
  assert.deepEqual(h.draft.serviceSelection.selectedCategories, ["coating"]); // 'glass' NOT coerced
  const codes = validateWizardDraftForEstimateEditorIntegration(h).issues.map((i) => i.code);
  assert.ok(codes.includes(INTEGRATION_ISSUE_CODES.UNMAPPED_ITEM_CATEGORY));
});

// ── 13. Serialization boundary ───────────────────────────────────────────────────
test("a JSON round-trip does not reproduce the opaque draft", () => {
  const h = estimateToWizardDraft(estimate({ estimate_items: [item("ITEM-1")] }));
  const roundTripped: unknown = JSON.parse(JSON.stringify(h));

  // The revived value is a plain, unfrozen object. It is NOT assignable to HydratedWizardDraft
  // (the private witness is missing — TS2741), so it can never reach the validator without an
  // unsafe assertion. Serialization therefore cannot be used to launder a forged envelope.
  assert.equal(Object.isFrozen(roundTripped), false);
  assert.notEqual(Object.getPrototypeOf(roundTripped), Object.getPrototypeOf(h));
});

// ── 14. Apply plan (Phase 8-B2B) ─────────────────────────────────────────────────
// `buildEstimateEditorApplyPlan` is the pure planner: validator first, items only through the
// canonical pricing path, nothing applied.
//
// MUTATION HAZARD — READ BEFORE ADDING A TEST HERE.
// `estimateToWizardDraft` assigns `serviceConfiguration: base.serviceConfiguration`
// (estimateToWizardDraft.ts:344) — the nested config is SHARED BY REFERENCE with the module const
// `initialEstimateWizardDraftV22`. Mutating it in place (e.g. `cfg.otherWork.customRows.push(...)`)
// would corrupt every future draft in the process. So the helper below REPLACES the object
// wholesale instead. No cast, no unsafe assertion — `draft` is plain, mutable, Wizard-owned state.

/**
 * A genuinely NEW draft (sourceKind "new", sourceEstimateId null), edited in place.
 *
 * `newEstimateWizardDraft()` DEEP-CLONES `initialEstimateWizardDraftV22` via `cloneWizardDraft`, so
 * every nested object and array is already private to this draft. `edit` may assign or mutate freely
 * — nothing is shared with the module const or with any other draft. (An earlier comment here
 * claimed the opposite and pre-detached each nested object; that was based on a false premise and
 * the defensive copying was unnecessary. Section 18 proves the isolation.)
 *
 * Since Phase 8-B2C-A, this is the ONLY draft shape that can reach a `"ready"` plan: the provenance
 * gate refuses anything hydrated from a persisted estimate.
 */
function newDraftWith(edit: (d: HydratedWizardDraft["draft"]) => void): HydratedWizardDraft {
  const h = newEstimateWizardDraft();
  edit(h.draft);
  return h;
}

/** A NEW draft carrying one named manual "other" row — the simplest priceable line. */
function newDraftWithOneManualLine(name: string, unitPrice: string): HydratedWizardDraft {
  return newDraftWith((d) => {
    d.serviceSelection = { selectedCategories: ["other"] };
    d.serviceConfiguration = {
      ...d.serviceConfiguration,
      otherWork: {
        ...d.serviceConfiguration.otherWork,
        customRows: [
          { id: "ROW-TEST-1", name, description: "", unitPrice, quantity: "1", unitLabel: "" },
        ],
      },
    };
  });
}

/** An EXISTING-estimate draft carrying one priceable manual row — used to prove the provenance gate. */
function existingDraftWithOneManualLine(name: string, unitPrice: string): HydratedWizardDraft {
  const h = estimateToWizardDraft(estimate({ estimate_items: [] })); // validates clean; still "existing"
  const cfg = h.draft.serviceConfiguration;
  h.draft.serviceSelection = { selectedCategories: ["other"] };
  h.draft.serviceConfiguration = {
    ...cfg,
    otherWork: {
      ...cfg.otherWork,
      customRows: [
        { id: "ROW-TEST-1", name, description: "", unitPrice, quantity: "1", unitLabel: "" },
      ],
    },
  };
  return h;
}

test("a ready plan maps exactly the seven scalar patch fields — and nothing else", () => {
  const h = newDraftWith((d) => {
    d.customer = { ...d.customer, sourceMode: "existing", customerId: "CUST-TEST" };
    d.vehicle  = { ...d.vehicle, sourceMode: "existing", vehicleId: "VEH-TEST", bodySizeKey: "M" };
    d.notes    = { customerNotes: "CUSTOMER-NOTE-TOKEN", internalMemo: "INTERNAL-MEMO-TOKEN" };
    d.discountAndCoupon = { ...d.discountAndCoupon, mode: "amount", amountInput: "5000" };
  });

  const plan = buildEstimateEditorApplyPlan(h, "create", DEFAULT_PRICING_CATALOG, TEST_CONFIG);
  assert.equal(plan.status, "ready");
  if (plan.status !== "ready") return;

  // deepEqual pins the EXACT key set: an eighth field would fail here, and so would a missing one.
  // This is the guard that `isDealer`, `dealerRate` and `taxRate` never enter the patch.
  assert.deepEqual({ ...plan.patch }, {
    sourceEstimateId: null, // a create-mode plan can only ever be built from a NEW draft
    customerId:       "CUST-TEST",
    vehicleId:        "VEH-TEST",
    bodySizeKey:      "M",
    customerNotes:    "CUSTOMER-NOTE-TOKEN",
    internalMemo:     "INTERNAL-MEMO-TOKEN",
    discountAmount:   "5000",
  });
});

test("pricing-owned context is absent from the patch", () => {
  const h = newEstimateWizardDraft();
  const plan = buildEstimateEditorApplyPlan(h, "create", DEFAULT_PRICING_CATALOG, TEST_CONFIG);
  assert.equal(plan.status, "ready");
  if (plan.status !== "ready") return;

  const keys = Object.keys(plan.patch);
  for (const owned of ["isDealer", "dealerRate", "taxRate", "items", "coupons"]) {
    assert.ok(!keys.includes(owned), `Pricing/Editor-owned field leaked into the patch: ${owned}`);
  }
  assert.equal(keys.length, 7);
});

test("customerNotes and internalMemo stay separate in the patch", () => {
  const h = newDraftWith((d) => {
    d.notes = { customerNotes: "CUSTOMER-NOTE-TOKEN", internalMemo: "INTERNAL-MEMO-TOKEN" };
  });
  const plan = buildEstimateEditorApplyPlan(h, "create", DEFAULT_PRICING_CATALOG, TEST_CONFIG);
  assert.equal(plan.status, "ready");
  if (plan.status !== "ready") return;

  assert.equal(plan.patch.customerNotes, "CUSTOMER-NOTE-TOKEN");
  assert.equal(plan.patch.internalMemo, "INTERNAL-MEMO-TOKEN");
  assert.ok(!plan.patch.customerNotes.includes("INTERNAL-MEMO-TOKEN"));
  assert.ok(!plan.patch.internalMemo.includes("CUSTOMER-NOTE-TOKEN"));
});

test("the supported fixed yen discount maps to patch.discountAmount", () => {
  const h = newDraftWith((d) => {
    d.discountAndCoupon = { ...d.discountAndCoupon, mode: "amount", amountInput: "5000" };
  });
  const plan = buildEstimateEditorApplyPlan(h, "create", DEFAULT_PRICING_CATALOG, TEST_CONFIG);
  assert.equal(plan.status, "ready");
  if (plan.status !== "ready") return;

  assert.equal(plan.patch.discountAmount, "5000");
  assert.equal(typeof plan.patch.discountAmount, "string"); // yen text, exactly as Screen 5 holds it
});

test("items are produced ONLY through buildWizardPricingInput → buildLineItems", () => {
  const h = newDraftWithOneManualLine("TEST-SERVICE-LINE", "12000");
  const plan = buildEstimateEditorApplyPlan(h, "create", DEFAULT_PRICING_CATALOG, TEST_CONFIG);
  assert.equal(plan.status, "ready");
  if (plan.status !== "ready") return;

  // The canonical path, computed independently here. If the planner ever composed a line itself,
  // rounded, summed, or adjusted a price, this would diverge.
  const expected = buildLineItems(
    buildWizardPricingInput(h.draft).services,
    DEFAULT_PRICING_CATALOG,
  );
  assert.deepEqual([...plan.items], expected);

  assert.ok(plan.items.length > 0, "a named, priced manual row must produce at least one line");
  assert.ok(plan.items.some((i) => i.item_name === "TEST-SERVICE-LINE"));
});

test("a draft with no service selection produces an empty item list, not a blocked plan", () => {
  const h = newEstimateWizardDraft();
  const plan = buildEstimateEditorApplyPlan(h, "create", DEFAULT_PRICING_CATALOG, TEST_CONFIG);
  assert.equal(plan.status, "ready");
  if (plan.status !== "ready") return;
  assert.deepEqual([...plan.items], []);
});

// ── Blocking: every blocking code must yield a plan with NO items ────────────────
test("an existing estimate with line items is blocked, with an explicit reason", () => {
  const h = estimateToWizardDraft(estimate({ estimate_items: [item("ITEM-1"), item("ITEM-2")] }));
  const plan = buildEstimateEditorApplyPlan(h, "create", DEFAULT_PRICING_CATALOG, TEST_CONFIG);

  assert.equal(plan.status, "blocked");
  if (plan.status !== "blocked") return;

  assert.equal(plan.reason, "integration-blocked");
  const codes = plan.blockingIssues.map((i) => i.code);
  assert.ok(codes.includes(INTEGRATION_ISSUE_CODES.UNRESOLVED_LEGACY_ITEMS));
  assert.ok(codes.includes(INTEGRATION_ISSUE_CODES.SERVICE_CONFIGURATION_NOT_RECONSTRUCTED));

  // The reason is operator-facing and preserved verbatim — never summarized away.
  assert.ok(plan.blockingIssues.every((i) => i.message.trim() !== ""));

  // The blocked variant has NO items field at all — legacy items cannot be overwritten.
  assert.ok(!("items" in plan));
  assert.ok(!("patch" in plan));
});

test("a percentage discount blocks the plan and produces no items", () => {
  const h = draftWithOperatorAdjustments((d) => {
    d.draft.discountAndCoupon.percentInput = "10";
  });
  const plan = buildEstimateEditorApplyPlan(h, "create", DEFAULT_PRICING_CATALOG, TEST_CONFIG);

  assert.equal(plan.status, "blocked");
  if (plan.status !== "blocked") return;
  assert.ok(
    plan.blockingIssues.some(
      (i) => i.code === INTEGRATION_ISSUE_CODES.UNSUPPORTED_PERCENTAGE_DISCOUNT_PERSISTENCE,
    ),
  );
  assert.ok(!("items" in plan));
  assert.equal(h.draft.discountAndCoupon.percentInput, "10"); // never cleared
});

test("a selected coupon blocks the plan and produces no items", () => {
  const h = draftWithOperatorAdjustments((d) => {
    d.draft.discountAndCoupon.selectedCouponIds.push("COUPON-TEST-1");
  });
  const plan = buildEstimateEditorApplyPlan(h, "create", DEFAULT_PRICING_CATALOG, TEST_CONFIG);

  assert.equal(plan.status, "blocked");
  if (plan.status !== "blocked") return;
  assert.ok(
    plan.blockingIssues.some(
      (i) => i.code === INTEGRATION_ISSUE_CODES.UNSUPPORTED_COUPON_PERSISTENCE,
    ),
  );
  assert.ok(!("items" in plan));
  assert.deepEqual(h.draft.discountAndCoupon.selectedCouponIds, ["COUPON-TEST-1"]); // never cleared
});

test("an existing estimate with no usable id is blocked and produces no items", () => {
  const h = estimateToWizardDraft(estimate({ id: "   ", estimate_items: [] }));
  const plan = buildEstimateEditorApplyPlan(h, "create", DEFAULT_PRICING_CATALOG, TEST_CONFIG);

  assert.equal(plan.status, "blocked");
  if (plan.status !== "blocked") return;
  assert.ok(
    plan.blockingIssues.some(
      (i) => i.code === INTEGRATION_ISSUE_CODES.INVALID_SOURCE_ESTIMATE_ID,
    ),
  );
  assert.ok(!("items" in plan));
});

test("every blocking issue code reachable at runtime yields a blocked plan", () => {
  const blocked: HydratedWizardDraft[] = [
    estimateToWizardDraft(estimate({ estimate_items: [item("ITEM-1")] })), // legacy + not-reconstructed
    estimateToWizardDraft(estimate({ id: "  ", estimate_items: [] })),      // invalid source id
    draftWithOperatorAdjustments((d) => { d.draft.discountAndCoupon.percentInput = "10"; }),
    draftWithOperatorAdjustments((d) => { d.draft.discountAndCoupon.selectedCouponIds.push("C-1"); }),
  ];

  for (const h of blocked) {
    const plan = buildEstimateEditorApplyPlan(h, "create", DEFAULT_PRICING_CATALOG, TEST_CONFIG);
    assert.equal(plan.status, "blocked");
    assert.ok(!("items" in plan), "a blocked plan must never carry items");
  }
});

test("a manual row with a missing amount is blocked as pricing-invalid, not applied", () => {
  const h = newDraftWithOneManualLine("TEST-SERVICE-LINE", ""); // named, but no amount
  const plan = buildEstimateEditorApplyPlan(h, "create", DEFAULT_PRICING_CATALOG, TEST_CONFIG);

  assert.equal(plan.status, "blocked");
  if (plan.status !== "blocked") return;
  assert.equal(plan.reason, "pricing-invalid");
  assert.ok(plan.pricingErrors.length > 0);
  assert.ok(!("items" in plan));
});

test("the planner mutates neither the draft nor the shared initial draft", () => {
  const before = JSON.stringify(initialEstimateWizardDraftV22);
  const h = newDraftWithOneManualLine("TEST-SERVICE-LINE", "12000");
  const draftBefore = JSON.stringify(h.draft);

  buildEstimateEditorApplyPlan(h, "create", DEFAULT_PRICING_CATALOG, TEST_CONFIG);

  assert.equal(JSON.stringify(h.draft), draftBefore);
  assert.equal(JSON.stringify(initialEstimateWizardDraftV22), before);
});

// ── 15. Create-mode hardening (Phase 8-B2B-H) ────────────────────────────────────
// Architect Ruling 3 — apply is limited to NEW estimates — is enforced at the PLANNER by a required
// `mode` argument, checked FIRST. "edit" never validates, never prices, never plans.

test("edit mode is blocked even when the draft itself is perfectly valid", () => {
  const h = newEstimateWizardDraft();

  // The draft is genuinely ready — the block is about the SURFACE, not the data.
  assert.equal(validateWizardDraftForEstimateEditorIntegration(h).canApplyToEstimateEditor, true);
  assert.equal(buildEstimateEditorApplyPlan(h, "create", DEFAULT_PRICING_CATALOG, TEST_CONFIG).status, "ready");

  const plan = buildEstimateEditorApplyPlan(h, "edit", DEFAULT_PRICING_CATALOG, TEST_CONFIG);
  assert.equal(plan.status, "blocked");
  if (plan.status !== "blocked") return;
  assert.equal(plan.reason, "unsupported-editor-mode");
  assert.ok(!("items" in plan));
  assert.ok(!("patch" in plan));
});

test("edit mode is blocked when the estimate carries persisted items", () => {
  const h = estimateToWizardDraft(estimate({ estimate_items: [item("ITEM-1"), item("ITEM-2")] }));

  const plan = buildEstimateEditorApplyPlan(h, "edit", DEFAULT_PRICING_CATALOG, TEST_CONFIG);
  assert.equal(plan.status, "blocked");
  if (plan.status !== "blocked") return;

  // The MODE gate fires first, so the reason is the surface — not the (also-true) data block.
  // The legacy items are therefore never even inspected, let alone reconstructed or overwritten.
  assert.equal(plan.reason, "unsupported-editor-mode");
  assert.ok(!("items" in plan));
  assert.deepEqual(h.integration.unresolvedItemIds, ["ITEM-1", "ITEM-2"]); // untouched
});

test("no edit-mode result ever carries items or a patch", () => {
  const drafts: HydratedWizardDraft[] = [
    newEstimateWizardDraft(),
    estimateToWizardDraft(estimate({ estimate_items: [] })),
    estimateToWizardDraft(estimate({ estimate_items: [item("ITEM-1")] })),
    newDraftWithOneManualLine("TEST-SERVICE-LINE", "12000"), // would otherwise price to real items
  ];

  for (const h of drafts) {
    const plan = buildEstimateEditorApplyPlan(h, "edit", DEFAULT_PRICING_CATALOG, TEST_CONFIG);
    assert.equal(plan.status, "blocked");
    assert.ok(!("items" in plan), "an edit-mode plan must never carry items");
    assert.ok(!("patch" in plan), "an edit-mode plan must never carry a patch");
  }
});

test("edit mode runs no pricing and mutates nothing", () => {
  const before = JSON.stringify(initialEstimateWizardDraftV22);
  const h = newDraftWithOneManualLine("TEST-SERVICE-LINE", "12000");
  const draftBefore = JSON.stringify(h.draft);

  const plan = buildEstimateEditorApplyPlan(h, "edit", DEFAULT_PRICING_CATALOG, TEST_CONFIG);

  // A create-mode call on this same draft WOULD have produced priced items. Edit mode produces none,
  // and reports no pricing outcome at all — proof the pricing path was never entered.
  assert.equal(plan.status, "blocked");
  if (plan.status !== "blocked") return;
  assert.deepEqual([...plan.pricingErrors], []);
  assert.deepEqual([...plan.blockingIssues], []); // the validator never ran either

  assert.equal(JSON.stringify(h.draft), draftBefore);
  assert.equal(JSON.stringify(initialEstimateWizardDraftV22), before);
});

test("create mode retains all prior behavior after the mode gate was added", () => {
  // Ready + items.
  const ready = newDraftWithOneManualLine("TEST-SERVICE-LINE", "12000");
  const readyPlan = buildEstimateEditorApplyPlan(ready, "create", DEFAULT_PRICING_CATALOG, TEST_CONFIG);
  assert.equal(readyPlan.status, "ready");
  if (readyPlan.status !== "ready") return;
  assert.ok(readyPlan.items.length > 0);
  assert.equal(Object.keys(readyPlan.patch).length, 7);

  // Still integration-blocked (not mode-blocked) when the data is bad.
  const legacy = estimateToWizardDraft(estimate({ estimate_items: [item("ITEM-1")] }));
  const legacyPlan = buildEstimateEditorApplyPlan(legacy, "create", DEFAULT_PRICING_CATALOG, TEST_CONFIG);
  assert.equal(legacyPlan.status, "blocked");
  if (legacyPlan.status !== "blocked") return;
  assert.equal(legacyPlan.reason, "integration-blocked");
  assert.ok(
    legacyPlan.blockingIssues.some(
      (i) => i.code === INTEGRATION_ISSUE_CODES.UNRESOLVED_LEGACY_ITEMS,
    ),
  );
});

// ── 16. Provenance gate (Phase 8-B2C-A) ──────────────────────────────────────────
// The hole the mode gate does NOT close: an EXISTING estimate with zero persisted items validates
// cleanly, so before this gate it would sail straight through `mode: "create"` and pour a persisted
// estimate's identity into a brand-new row.

test("an existing zero-item estimate is REFUSED in create mode (provenance gate)", () => {
  const h = estimateToWizardDraft(estimate({ estimate_items: [] }));

  // It is genuinely valid data — the integration validator approves it. The refusal is purely about
  // provenance, which is exactly why the mode gate alone was not enough.
  assert.equal(validateWizardDraftForEstimateEditorIntegration(h).canApplyToEstimateEditor, true);
  assert.equal(h.integration.sourceKind, "existing");
  assert.equal(h.integration.sourceEstimateId, "EST-TEST");

  const plan = buildEstimateEditorApplyPlan(h, "create", DEFAULT_PRICING_CATALOG, TEST_CONFIG);
  assert.equal(plan.status, "blocked");
  if (plan.status !== "blocked") return;
  assert.equal(plan.reason, "source-estimate-not-allowed-in-create");
  assert.ok(!("items" in plan));
  assert.ok(!("patch" in plan));
});

test("an existing zero-item estimate carrying priced services is still refused in create mode", () => {
  // Would otherwise price to real line items — proving the gate runs BEFORE pricing.
  const h = existingDraftWithOneManualLine("TEST-SERVICE-LINE", "12000");
  assert.equal(h.integration.sourceKind, "existing");

  const plan = buildEstimateEditorApplyPlan(h, "create", DEFAULT_PRICING_CATALOG, TEST_CONFIG);
  assert.equal(plan.status, "blocked");
  if (plan.status !== "blocked") return;
  assert.equal(plan.reason, "source-estimate-not-allowed-in-create");
  assert.deepEqual([...plan.pricingErrors], []); // pricing never ran
  assert.ok(!("items" in plan));
});

test("only a genuinely new draft reaches ready in create mode", () => {
  const h = newEstimateWizardDraft();
  assert.equal(h.integration.sourceKind, "new");
  assert.equal(h.integration.sourceEstimateId, null);

  const plan = buildEstimateEditorApplyPlan(h, "create", DEFAULT_PRICING_CATALOG, TEST_CONFIG);
  assert.equal(plan.status, "ready");
  if (plan.status !== "ready") return;
  assert.equal(plan.patch.sourceEstimateId, null); // the editor must never write this
});

// ── 17. The container's draft-ownership mechanism (Phase 8-B2C) ──────────────────
// EstimateWizardContainer keeps ONE opaque draft for the session and writes reducer results back
// onto its mutable `.draft` body with Object.assign — because no constructor wraps an arbitrary
// draft in the opaque envelope, and rebuilding one would be the forgery the contract forbids.
//
// The draft body it writes into is a private deep clone (`cloneWizardDraft`), so the write-back can
// never reach the module const or another draft even if a reducer mutated in place. This test pins
// the end-to-end behaviour: edits land on the session draft, and nothing else moves.

test("the container's reducer write-back never corrupts the shared initial draft", () => {
  const pristine = JSON.stringify(initialEstimateWizardDraftV22);
  const h = newEstimateWizardDraft();

  // Exactly what the container's `update()` does, for each reducer family it uses.
  Object.assign(h.draft, updateCustomer(h.draft, { customerId: "CUST-TEST" }));
  Object.assign(h.draft, updateVehicle(h.draft, { vehicleId: "VEH-TEST", bodySizeKey: "L" }));
  Object.assign(h.draft, updateServiceSelection(h.draft, { selectedCategories: ["coating"] }));
  Object.assign(h.draft, updateServiceConfiguration(h.draft, "coating", { layerCount: 1 }));
  Object.assign(h.draft, updateDiscountAndCoupon(h.draft, { amountInput: "5000" }));
  Object.assign(h.draft, updateNotes(h.draft, { customerNotes: "N", internalMemo: "M" }));
  Object.assign(h.draft, setCurrentStep(h.draft, 7));

  // The edits landed on the session draft…
  assert.equal(h.draft.customer.customerId, "CUST-TEST");
  assert.equal(h.draft.vehicle.bodySizeKey, "L");
  assert.equal(h.draft.serviceConfiguration.coating.layerCount, 1);
  assert.equal(h.draft.metadata.currentStep, 7);

  // …and the module const is byte-for-byte untouched.
  assert.equal(JSON.stringify(initialEstimateWizardDraftV22), pristine);

  // Provenance survives the write-back — it is frozen and lives beside `draft`, not inside it.
  assert.equal(h.integration.sourceKind, "new");
  assert.equal(h.integration.sourceEstimateId, null);

  // And the mutated session draft still plans cleanly in create mode.
  const plan = buildEstimateEditorApplyPlan(h, "create", DEFAULT_PRICING_CATALOG, TEST_CONFIG);
  assert.equal(plan.status, "ready");
  if (plan.status !== "ready") return;
  assert.equal(plan.patch.customerId, "CUST-TEST");
  assert.equal(plan.patch.bodySizeKey, "L");
  assert.equal(plan.patch.discountAmount, "5000");
  assert.equal(plan.patch.sourceEstimateId, null); // never written by the editor
});

// ── 18. Existing-estimate draft isolation (Phase 8-B2C-S) ────────────────────────
// THE DEFECT THIS PINS. `estimateToWizardDraft` used to build its draft with a TOP-LEVEL spread of
// `initialEstimateWizardDraftV22` and then assign `serviceConfiguration: base.serviceConfiguration`
// outright. A spread copies only the top level, so `serviceConfiguration`, `review` and
// `customer.newCustomer` stayed SHARED BY REFERENCE with the module const. Measured behaviour before
// the fix:
//
//     h.draft.serviceConfiguration.ppf.selectedPartIds.push("HOOD");
//     initialEstimateWizardDraftV22...selectedPartIds  →  ["HOOD"]   // module const corrupted
//     newEstimateWizardDraft()......selectedPartIds    →  ["HOOD"]   // every future blank draft too
//
// One mutation through one hydrated draft poisoned every draft in the process, for its whole life.
// It is now deep-cloned through the same `cloneWizardDraft` the create path always used.

/** Every mutable nested object/array reachable from a draft body. */
function nestedRefs(d: HydratedWizardDraft["draft"]): [string, unknown][] {
  const cfg = d.serviceConfiguration;
  return [
    ["customer", d.customer],
    ["customer.newCustomer", d.customer.newCustomer],
    ["vehicle", d.vehicle],
    ["vehicle.newVehicle", d.vehicle.newVehicle],
    ["serviceSelection", d.serviceSelection],
    ["serviceSelection.selectedCategories", d.serviceSelection.selectedCategories],
    ["serviceConfiguration", cfg],
    ["cfg.coating", cfg.coating],
    ["cfg.ppf", cfg.ppf],
    ["cfg.ppf.selectedPartIds", cfg.ppf.selectedPartIds],
    ["cfg.ppf.quantitiesByPart", cfg.ppf.quantitiesByPart],
    ["cfg.ppf.interiorRows", cfg.ppf.interiorRows],
    ["cfg.windowFilm", cfg.windowFilm],
    ["cfg.windowFilm.selectedAreaIds", cfg.windowFilm.selectedAreaIds],
    ["cfg.bodyMaintenance", cfg.bodyMaintenance],
    ["cfg.carWash", cfg.carWash],
    ["cfg.roomCleaning", cfg.roomCleaning],
    ["cfg.roomCleaning.selectedMenuIds", cfg.roomCleaning.selectedMenuIds],
    ["cfg.roomCleaning.unitPricesByMenu", cfg.roomCleaning.unitPricesByMenu],
    ["cfg.otherWork", cfg.otherWork],
    ["cfg.otherWork.selectedPresetIds", cfg.otherWork.selectedPresetIds],
    ["cfg.otherWork.customRows", cfg.otherWork.customRows],
    ["cfg.storeGlobalOptions", cfg.storeGlobalOptions],
    ["cfg.storeGlobalOptions.selectedOptionIds", cfg.storeGlobalOptions.selectedOptionIds],
    ["discountAndCoupon", d.discountAndCoupon],
    ["discountAndCoupon.selectedCouponIds", d.discountAndCoupon.selectedCouponIds],
    ["notes", d.notes],
    ["review", d.review],
    ["metadata", d.metadata],
  ];
}

/** Assert that two draft bodies share NO mutable nested reference, field by field. */
function assertNoSharedRefs(
  aLabel: string, a: HydratedWizardDraft["draft"],
  bLabel: string, b: HydratedWizardDraft["draft"],
) {
  const ra = nestedRefs(a);
  const rb = nestedRefs(b);
  for (let i = 0; i < ra.length; i++) {
    assert.notEqual(ra[i][1], rb[i][1], `${aLabel} and ${bLabel} SHARE a reference at ${ra[i][0]}`);
  }
}

test("two estimateToWizardDraft results share no mutable nested reference", () => {
  const a = estimateToWizardDraft(estimate({ estimate_items: [] }));
  const b = estimateToWizardDraft(estimate({ estimate_items: [] }));
  assertNoSharedRefs("hydrated A", a.draft, "hydrated B", b.draft);
});

test("a hydrated existing draft shares no nested reference with the module const", () => {
  const h = estimateToWizardDraft(estimate({ estimate_items: [] }));
  assertNoSharedRefs("hydrated", h.draft, "initial", initialEstimateWizardDraftV22);
});

test("a hydrated existing draft shares no nested reference with a new draft", () => {
  const h = estimateToWizardDraft(estimate({ estimate_items: [] }));
  const n = newEstimateWizardDraft();
  assertNoSharedRefs("hydrated", h.draft, "new", n.draft);
});

test("create-path isolation remains intact", () => {
  const a = newEstimateWizardDraft();
  const b = newEstimateWizardDraft();
  assertNoSharedRefs("new A", a.draft, "new B", b.draft);
  assertNoSharedRefs("new A", a.draft, "initial", initialEstimateWizardDraftV22);
});

test("mutating a hydrated existing draft cannot reach the const, a new draft, or another hydrated draft", () => {
  const victimConst = JSON.stringify(initialEstimateWizardDraftV22);

  const h1 = estimateToWizardDraft(estimate({ estimate_items: [] }));
  const h2 = estimateToWizardDraft(estimate({ estimate_items: [] }));
  const n  = newEstimateWizardDraft();

  // The exact mutation that used to poison the whole process.
  h1.draft.serviceConfiguration.ppf.selectedPartIds.push("HOOD");
  h1.draft.serviceConfiguration.otherWork.customRows.push(
    { id: "ROW-X", name: "X", description: "", unitPrice: "1", quantity: "1", unitLabel: "" },
  );
  h1.draft.discountAndCoupon.selectedCouponIds.push("CPN-X");
  h1.draft.notes.internalMemo = "LEAK";
  h1.draft.review.previewConfirmed = true;
  h1.draft.customer.newCustomer.name = "LEAK";

  // Nothing else moved.
  assert.deepEqual(h2.draft.serviceConfiguration.ppf.selectedPartIds, []);
  assert.deepEqual(h2.draft.serviceConfiguration.otherWork.customRows, []);
  assert.deepEqual(h2.draft.discountAndCoupon.selectedCouponIds, []);
  assert.equal(h2.draft.notes.internalMemo, "");
  assert.equal(h2.draft.review.previewConfirmed, false);
  assert.equal(h2.draft.customer.newCustomer.name, "");

  assert.deepEqual(n.draft.serviceConfiguration.ppf.selectedPartIds, []);
  assert.equal(n.draft.notes.internalMemo, "");
  assert.equal(n.draft.customer.newCustomer.name, "");

  assert.equal(JSON.stringify(initialEstimateWizardDraftV22), victimConst);

  // A draft created AFTER the mutation is still pristine — the const was never poisoned.
  const afterwards = newEstimateWizardDraft();
  assert.deepEqual(afterwards.draft.serviceConfiguration.ppf.selectedPartIds, []);
  assert.deepEqual(afterwards.draft.discountAndCoupon.selectedCouponIds, []);
});

test("the aliasing fix preserves frozen provenance and every blocking behaviour", () => {
  const h = estimateToWizardDraft(estimate({ estimate_items: [item("ITEM-1")] }));

  // Provenance still frozen, still accurate.
  assert.equal(Object.isFrozen(h.integration), true);
  assert.equal(Object.isFrozen(h.integration.unresolvedItemIds), true);
  assert.equal(h.integration.sourceKind, "existing");
  assert.equal(h.integration.sourceEstimateId, "EST-TEST");
  assert.deepEqual(h.integration.unresolvedItemIds, ["ITEM-1"]);
  assert.equal(h.integration.reconstructionStatus, "none");

  // Still blocked, for the same reasons, with the same messages.
  const r = validateWizardDraftForEstimateEditorIntegration(h);
  assert.equal(r.canApplyToEstimateEditor, false);
  assert.equal(r.canPersist, false);
  const codes = r.blockingIssues.map((i) => i.code);
  assert.ok(codes.includes(INTEGRATION_ISSUE_CODES.UNRESOLVED_LEGACY_ITEMS));
  assert.ok(codes.includes(INTEGRATION_ISSUE_CODES.SERVICE_CONFIGURATION_NOT_RECONSTRUCTED));

  // And Screen-4 is still empty — cloning must not have "reconstructed" anything.
  const cfg = h.draft.serviceConfiguration;
  assert.equal(cfg.coating.layerCount, null);
  assert.equal(cfg.ppf.installationMethod, null);
  assert.deepEqual(cfg.roomCleaning.selectedMenuIds, []);
});

// ── 19. Fixture-free production pricing labels (Phase 8-B2F-B) ───────────────────
// `wizard-manual-pricing.ts` resolves labels from hard-imported fixtures with a `?? id` fallback, and
// that label becomes `estimate_items.item_name`. The production path must resolve labels ONLY from
// the required configuration, and must BLOCK — never fall back — on an unknown code.

/** Select a category and configure it, on a genuinely NEW draft. */
function draftFor(edit: (d: HydratedWizardDraft["draft"]) => void): HydratedWizardDraft {
  return newDraftWith(edit);
}

const planFor = (h: HydratedWizardDraft) =>
  buildEstimateEditorApplyPlan(h, "create", DEFAULT_PRICING_CATALOG, TEST_CONFIG);

// ── Every manual category: the AUTHORITATIVE label reaches PricedLineItem ────────
const CATEGORY_CASES: ReadonlyArray<{
  name: string;
  expectLabel: string;
  edit: (d: HydratedWizardDraft["draft"]) => void;
}> = [
  {
    name: "ppf", expectLabel: "PPF CFG-PPF-FULL",
    edit: (d) => {
      d.serviceSelection = { selectedCategories: ["ppf"] };
      d.serviceConfiguration = { ...d.serviceConfiguration,
        ppf: { ...d.serviceConfiguration.ppf, installationMethod: "full", unitPriceInput: "50000" } };
    },
  },
  {
    name: "window", expectLabel: "ウィンドウフィルム（CFG-FILM-A）",
    edit: (d) => {
      d.serviceSelection = { selectedCategories: ["window"] };
      d.serviceConfiguration = { ...d.serviceConfiguration,
        windowFilm: { ...d.serviceConfiguration.windowFilm, filmTypeId: "film-a", unitPriceInput: "30000" } };
    },
  },
  {
    name: "maintenance", expectLabel: "CFG-MAINT-A",
    edit: (d) => {
      d.serviceSelection = { selectedCategories: ["maintenance"] };
      d.serviceConfiguration = { ...d.serviceConfiguration,
        bodyMaintenance: { menuId: "maint-a", unitPriceInput: "12000" } };
    },
  },
  {
    name: "carwash", expectLabel: "CFG-WASH-A",
    edit: (d) => {
      d.serviceSelection = { selectedCategories: ["carwash"] };
      d.serviceConfiguration = { ...d.serviceConfiguration,
        carWash: { menuId: "wash-a", unitPriceInput: "8000" } };
    },
  },
  {
    name: "roomclean", expectLabel: "CFG-ROOM-A",
    edit: (d) => {
      d.serviceSelection = { selectedCategories: ["roomclean"] };
      d.serviceConfiguration = { ...d.serviceConfiguration,
        roomCleaning: { selectedMenuIds: ["room-a"], unitPricesByMenu: { "room-a": "15000" } } };
    },
  },
  {
    name: "store_global_options", expectLabel: "CFG-GOPT-A",
    edit: (d) => {
      d.serviceConfiguration = { ...d.serviceConfiguration,
        storeGlobalOptions: { selectedOptionIds: ["gopt-a"], unitPricesByOption: { "gopt-a": "5000" }, quantitiesByOption: {} } };
    },
  },
];

for (const c of CATEGORY_CASES) {
  test(`[${c.name}] the authoritative configured label reaches the PricedLineItem`, () => {
    const plan = planFor(draftFor(c.edit));
    assert.equal(plan.status, "ready");
    if (plan.status !== "ready") return;

    assert.ok(
      plan.items.some((i) => i.item_name === c.expectLabel),
      `expected item_name "${c.expectLabel}", got ${JSON.stringify(plan.items.map((i) => i.item_name))}`,
    );
    // The stable CODE must never be the name.
    for (const i of plan.items) {
      assert.ok(!["full", "film-a", "maint-a", "wash-a", "room-a", "gopt-a"].includes(i.item_name),
        `a raw code leaked into item_name: ${i.item_name}`);
    }
  });
}

test("free-text custom work keeps the operator's own label — no configuration governs it", () => {
  const plan = planFor(newDraftWithOneManualLine("OPERATOR-TYPED-NAME", "9000"));
  assert.equal(plan.status, "ready");
  if (plan.status !== "ready") return;
  assert.ok(plan.items.some((i) => i.item_name === "OPERATOR-TYPED-NAME"));
});

test("interior PPF rows keep the operator's typed location", () => {
  const h = draftFor((d) => {
    d.serviceSelection = { selectedCategories: ["ppf"] };
    d.serviceConfiguration = { ...d.serviceConfiguration,
      ppf: { ...d.serviceConfiguration.ppf, installationMethod: "interior",
             interiorRows: [{ id: "r1", location: "OPERATOR-LOCATION", amount: "7000" }] } };
  });
  const plan = planFor(h);
  assert.equal(plan.status, "ready");
  if (plan.status !== "ready") return;
  assert.ok(plan.items.some((i) => i.item_name === "OPERATOR-LOCATION"));
});

// ── Unknown codes BLOCK — never `label ?? id` ────────────────────────────────────
const UNKNOWN_CASES: ReadonlyArray<{ name: string; edit: (d: HydratedWizardDraft["draft"]) => void }> = [
  // "partial" is a VALID PpfInstallationMethodId, but the dealer has not configured it. A perfectly
  // well-typed selection the configuration does not offer must still block.
  { name: "ppf method", edit: (d) => {
      d.serviceSelection = { selectedCategories: ["ppf"] };
      d.serviceConfiguration = { ...d.serviceConfiguration,
        ppf: { ...d.serviceConfiguration.ppf, installationMethod: "partial", unitPriceInput: "50000" } };
    } },
  { name: "film type", edit: (d) => {
      d.serviceSelection = { selectedCategories: ["window"] };
      d.serviceConfiguration = { ...d.serviceConfiguration,
        windowFilm: { ...d.serviceConfiguration.windowFilm, filmTypeId: "NOT-IN-CONFIG", unitPriceInput: "1000" } };
    } },
  { name: "maintenance menu", edit: (d) => {
      d.serviceSelection = { selectedCategories: ["maintenance"] };
      d.serviceConfiguration = { ...d.serviceConfiguration,
        bodyMaintenance: { menuId: "NOT-IN-CONFIG", unitPriceInput: "1000" } };
    } },
  { name: "wash menu", edit: (d) => {
      d.serviceSelection = { selectedCategories: ["carwash"] };
      d.serviceConfiguration = { ...d.serviceConfiguration,
        carWash: { menuId: "NOT-IN-CONFIG", unitPriceInput: "1000" } };
    } },
  { name: "room menu", edit: (d) => {
      d.serviceSelection = { selectedCategories: ["roomclean"] };
      d.serviceConfiguration = { ...d.serviceConfiguration,
        roomCleaning: { selectedMenuIds: ["NOT-IN-CONFIG"], unitPricesByMenu: { "NOT-IN-CONFIG": "1000" } } };
    } },
  { name: "store global option", edit: (d) => {
      d.serviceConfiguration = { ...d.serviceConfiguration,
        storeGlobalOptions: { selectedOptionIds: ["NOT-IN-CONFIG"], unitPricesByOption: { "NOT-IN-CONFIG": "1000" }, quantitiesByOption: {} } };
    } },
];

for (const c of UNKNOWN_CASES) {
  test(`[${c.name}] an unknown code BLOCKS with no patch and no items`, () => {
    const plan = planFor(draftFor(c.edit));

    assert.equal(plan.status, "blocked");
    if (plan.status !== "blocked") return;
    assert.equal(plan.reason, "pricing-invalid");
    assert.ok(
      plan.pricingErrors.some((e) => e.code === WIZARD_PRICING_CONFIG_ERRORS.UNKNOWN_CONFIGURED_ITEM),
      `expected UNKNOWN_CONFIGURED_ITEM, got ${JSON.stringify(plan.pricingErrors.map((e) => e.code))}`,
    );
    // The whole point: a blocked plan has no items field, so a raw id cannot become an item_name.
    assert.ok(!("items" in plan));
    assert.ok(!("patch" in plan));
  });
}

test("a raw code never becomes item_name, for any configured category", () => {
  for (const c of CATEGORY_CASES) {
    const plan = planFor(draftFor(c.edit));
    if (plan.status !== "ready") continue;
    for (const i of plan.items) {
      assert.ok(i.item_name.trim() !== "", "an empty item_name would be a silent label loss");
      assert.ok(!/^[a-z0-9-]+$/.test(i.item_name) || CONFIG_LABELS.includes(i.item_name),
        `item_name "${i.item_name}" looks like a raw code`);
    }
  }
});

test("fixture text never enters production output", () => {
  // Every label the production path can emit must come from TEST_CONFIG, the operator's own free
  // text, or the production PricingCatalog (coating). Never from an EXAMPLE_*/DEFAULT_* module.
  const operatorAuthored = ["OPERATOR-TYPED-NAME", "OPERATOR-LOCATION"];
  const allCases = [
    ...CATEGORY_CASES.map((c) => draftFor(c.edit)),
    newDraftWithOneManualLine("OPERATOR-TYPED-NAME", "9000"),
  ];
  for (const h of allCases) {
    const plan = planFor(h);
    if (plan.status !== "ready") continue;
    for (const i of plan.items) {
      const ok =
        CONFIG_LABELS.some((l) => i.item_name.includes(l)) ||
        operatorAuthored.includes(i.item_name);
      assert.ok(ok, `unrecognised (possibly fixture) label reached item_name: "${i.item_name}"`);
    }
  }
});

// ── 20. Non-priceable fail-closed (Phase 8-B2F-BH) ──────────────────────────────
// Architect ruling: a selected production option either produces a priced line or BLOCKS the plan.
// It is never silently discarded. Previously this was a warning, the line was dropped, the plan
// stayed `ready`, and the container — which surfaces only blocking reasons — showed the operator
// nothing. A billable service mis-marked `priceable: false` would vanish from the estimate.

test("a SELECTED non-priceable option BLOCKS with no patch and no items", () => {
  const plan = planFor(draftFor((d) => {
    d.serviceConfiguration = { ...d.serviceConfiguration,
      storeGlobalOptions: { selectedOptionIds: ["gopt-free"], unitPricesByOption: {}, quantitiesByOption: {} } };
  }));

  assert.equal(plan.status, "blocked");
  if (plan.status !== "blocked") return;
  assert.equal(plan.reason, "pricing-invalid");
  assert.ok(plan.pricingErrors.some((e) => e.code === WIZARD_PRICING_CONFIG_ERRORS.NON_PRICEABLE_SELECTED_ITEM));
  assert.ok(!("items" in plan), "a blocked plan must carry no items");
  assert.ok(!("patch" in plan), "a blocked plan must carry no patch");
  // The operator gets a real reason, not silence.
  assert.ok(plan.pricingErrors.every((e) => e.message.trim() !== ""));
});

test("a non-priceable option that is NOT selected does not block", () => {
  // `gopt-free` exists in the configuration but the operator never chose it.
  const plan = planFor(draftFor((d) => {
    d.serviceConfiguration = { ...d.serviceConfiguration,
      storeGlobalOptions: { selectedOptionIds: ["gopt-a"], unitPricesByOption: { "gopt-a": "5000" }, quantitiesByOption: {} } };
  }));
  assert.equal(plan.status, "ready");
  if (plan.status !== "ready") return;
  assert.ok(plan.items.some((i) => i.item_name === "CFG-GOPT-A"));
});

test("an empty selection with a non-priceable option configured does not block", () => {
  const plan = planFor(newEstimateWizardDraft());
  assert.equal(plan.status, "ready");
});

test("a non-priceable line is never produced under any circumstance", () => {
  const bundle = buildManualPricingLinesFromConfig(
    draftFor((d) => {
      d.serviceConfiguration = { ...d.serviceConfiguration,
        storeGlobalOptions: {
          selectedOptionIds: ["gopt-free"],
          unitPricesByOption: { "gopt-free": "9999" }, // even WITH an amount typed in
          quantitiesByOption: {},
        } };
    }).draft,
    TEST_CONFIG,
  );
  assert.deepEqual(bundle.lines, []);
  assert.equal(bundle.errors[0]?.code, WIZARD_PRICING_CONFIG_ERRORS.NON_PRICEABLE_SELECTED_ITEM);
});

// ── Price equivalence: fixture path vs config path ──────────────────────────────
test("equivalent inputs produce IDENTICAL prices on the fixture and config paths", () => {
  // Same draft, same codes. The config supplies different LABELS but identical quantity rules — so
  // every unitPrice, quantity and line total must match exactly. Only names may differ.
  const build = () => newDraftWith((d) => {
    d.serviceSelection = { selectedCategories: ["maintenance", "carwash", "other"] };
    d.serviceConfiguration = {
      ...d.serviceConfiguration,
      bodyMaintenance: { menuId: "maint-a", unitPriceInput: "12000" },
      carWash:         { menuId: "wash-a",  unitPriceInput: "8000" },
      otherWork: { ...d.serviceConfiguration.otherWork,
        customRows: [{ id: "ow1", name: "OPERATOR-ROW", description: "", unitPrice: "3000", quantity: "1", unitLabel: "" }] },
    };
    d.discountAndCoupon = { ...d.discountAndCoupon, mode: "amount", amountInput: "1000" };
  });

  // The fixture path resolves maint-a / wash-a to nothing and falls back to the raw id — that is the
  // very defect. Prices, however, must be untouched by the label source.
  const fixture = buildWizardPricingInput(build().draft);
  const configured = buildWizardPricingInputFromConfig(build().draft, TEST_CONFIG, DEFAULT_PRICING_CATALOG);

  const prices = (lines: readonly { unitPrice: number; quantity: number }[]) =>
    lines.map((l) => ({ unitPrice: l.unitPrice, quantity: l.quantity })).sort(
      (a, b) => a.unitPrice - b.unitPrice || a.quantity - b.quantity);

  assert.deepEqual(prices(configured.manualLines), prices(fixture.manualLines));
  assert.deepEqual(configured.discounts, fixture.discounts);
  assert.equal(configured.taxRate, fixture.taxRate);
  assert.equal(configured.catalogResolved, fixture.catalogResolved);
  assert.deepEqual(configured.discountIntent, fixture.discountIntent);
  assert.deepEqual(configured.couponState, fixture.couponState);

  // And the line TOTALS agree, priced by the same engine.
  const totals = (services: typeof fixture.services) =>
    buildLineItems(services, DEFAULT_PRICING_CATALOG)
      .map((i) => i.unit_price * i.quantity).sort((a, b) => a - b);
  assert.deepEqual(totals(configured.services), totals(fixture.services));

  // The labels DIFFER — which is the whole point.
  const fixtureNames = fixture.manualLines.map((l) => l.label);
  const configNames = configured.manualLines.map((l) => l.label);
  assert.notDeepEqual(configNames, fixtureNames);
  assert.ok(configNames.includes("CFG-MAINT-A"));
  assert.ok(fixtureNames.includes("maint-a")); // the raw-id fallback, demonstrated
});

test("coating remains PricingCatalog-owned on the config path", () => {
  const h = newDraftWith((d) => {
    d.serviceSelection = { selectedCategories: ["coating"] };
    d.vehicle = { ...d.vehicle, bodySizeKey: "M" };
    d.serviceConfiguration = { ...d.serviceConfiguration,
      coating: { ...d.serviceConfiguration.coating, layerCount: 1, layer1Id: "one-evo" } };
  });
  const configured = buildWizardPricingInputFromConfig(h.draft, TEST_CONFIG, DEFAULT_PRICING_CATALOG);
  const fixture = buildWizardPricingInput(h.draft);

  assert.equal(configured.catalogResolved, true);
  assert.deepEqual(configured.services, fixture.services); // identical catalog service
  assert.deepEqual(configured.errors, fixture.errors);
});

test("an unknown coating id still raises UNKNOWN_PRICING_REFERENCE on the config path", () => {
  const h = newDraftWith((d) => {
    d.serviceSelection = { selectedCategories: ["coating"] };
    d.serviceConfiguration = { ...d.serviceConfiguration,
      coating: { ...d.serviceConfiguration.coating, layer1Id: "matte-evo" } }; // not in PricingCatalog
  });
  const configured = buildWizardPricingInputFromConfig(h.draft, TEST_CONFIG, DEFAULT_PRICING_CATALOG);
  assert.equal(configured.catalogResolved, false);
  assert.ok(configured.errors.length > 0);
});

// ── The config builder in isolation ─────────────────────────────────────────────
test("buildManualPricingLinesFromConfig never emits a raw code as a label", () => {
  const h = draftFor((d) => {
    d.serviceSelection = { selectedCategories: ["maintenance"] };
    d.serviceConfiguration = { ...d.serviceConfiguration,
      bodyMaintenance: { menuId: "UNKNOWN-CODE", unitPriceInput: "1000" } };
  });
  const bundle = buildManualPricingLinesFromConfig(h.draft, TEST_CONFIG);
  assert.deepEqual(bundle.lines, []); // no line at all — the code cannot become a label
  assert.equal(bundle.errors[0]?.code, WIZARD_PRICING_CONFIG_ERRORS.UNKNOWN_CONFIGURED_ITEM);
});

// ── Compile-time: quantity/priceable fields exist ONLY on store-global options ──
// `@ts-expect-error` is verified by tsc: if any of these ever STOPPED being a type error, the unused
// directive itself fails the build (TS2578). This is what makes "quantity rules cannot change price
// semantics elsewhere" a type-level guarantee rather than a convention.
test("TypeScript rejects quantity/priceable fields on non-store collections", () => {
  const bad: ProductionPricingConfiguration = {
    // @ts-expect-error — `quantityRequired` does not exist on ProductionLabelOption.
    ppfMethods:        [{ code: "full", label: "L", quantityRequired: true }],
    // @ts-expect-error — `priceable` does not exist on ProductionLabelOption.
    filmTypes:         [{ code: "film-a", label: "L", priceable: false }],
    // @ts-expect-error — `minQuantity` does not exist on ProductionLabelOption.
    maintenanceMenus:  [{ code: "maint-a", label: "L", minQuantity: 2 }],
    // @ts-expect-error — `maxQuantity` does not exist on ProductionLabelOption.
    washMenus:         [{ code: "wash-a", label: "L", maxQuantity: 9 }],
    // @ts-expect-error — `priceable` does not exist on ProductionLabelOption.
    roomCleaningMenus: [{ code: "room-a", label: "L", priceable: true }],
    // Store-global options legitimately carry all four.
    storeGlobalOptions: [gopt("gopt-a", "CFG-GOPT-A", { quantityRequired: true, maxQuantity: 3 })],
  };
  assert.equal(bad.storeGlobalOptions.length, 1);
  assert.equal(bad.storeGlobalOptions[0].quantityRequired, true);

  // A label-only option has exactly two keys — nothing to silently ignore.
  assert.deepEqual(Object.keys(opt("x", "Y")).sort(), ["code", "label"]);
});

test("quantity bounds apply only to store-global options", () => {
  // Room cleaning selects TWO menus; each prices as a single unit regardless of any quantity input.
  const plan = planFor(draftFor((d) => {
    d.serviceSelection = { selectedCategories: ["roomclean"] };
    d.serviceConfiguration = { ...d.serviceConfiguration,
      roomCleaning: {
        selectedMenuIds: ["room-a", "room-b"],
        unitPricesByMenu: { "room-a": "15000", "room-b": "5000" },
      } };
  }));
  assert.equal(plan.status, "ready");
  if (plan.status !== "ready") return;

  const a = plan.items.find((i) => i.item_name === "CFG-ROOM-A");
  const b = plan.items.find((i) => i.item_name === "CFG-ROOM-B");
  assert.ok(a && b);
  assert.equal(a.quantity, 1);
  assert.equal(b.quantity, 1);
  assert.equal(a.unit_price, 15000); // never multiplied — quantity rules do not reach this category
  assert.equal(b.unit_price, 5000);
});

test("quantityRequired is honoured from configuration, not from a fixture", () => {
  const plan = planFor(draftFor((d) => {
    d.serviceConfiguration = { ...d.serviceConfiguration,
      storeGlobalOptions: {
        selectedOptionIds: ["gopt-qty"],
        unitPricesByOption: { "gopt-qty": "1000" },
        quantitiesByOption: { "gopt-qty": 3 },
      } };
  }));
  assert.equal(plan.status, "ready");
  if (plan.status !== "ready") return;
  const line = plan.items.find((i) => i.item_name === "CFG-GOPT-QTY");
  assert.ok(line);
  assert.equal(line.unit_price, 3000); // 1000 × 3, composed exactly as the fixture path composes it
});

test("an out-of-range configured quantity blocks with INVALID_QUANTITY", () => {
  const plan = planFor(draftFor((d) => {
    d.serviceConfiguration = { ...d.serviceConfiguration,
      storeGlobalOptions: {
        selectedOptionIds: ["gopt-qty"],
        unitPricesByOption: { "gopt-qty": "1000" },
        quantitiesByOption: { "gopt-qty": 99 }, // maxQuantity is 5
      } };
  }));
  assert.equal(plan.status, "blocked");
  if (plan.status !== "blocked") return;
  assert.equal(plan.reason, "pricing-invalid");
  assert.ok(!("items" in plan));
});

// ── Compile-time: `mode` is REQUIRED and cannot be omitted or widened ────────────
// `@ts-expect-error` is verified by `tsc`, not at runtime: if either call below ever STOPPED being
// a type error, the unused directive itself becomes a compile error (TS2578) and `npm run typecheck`
// fails. So this is a real, enforced proof — not a comment. No cast, no unsafe assertion.
test("omitting mode, or passing an unknown mode, is rejected by TypeScript", () => {
  const h = newEstimateWizardDraft();

  // @ts-expect-error — `mode` is required; a 2-argument call must not compile.
  buildEstimateEditorApplyPlan(h, DEFAULT_PRICING_CATALOG, TEST_CONFIG);

  // @ts-expect-error — only "create" | "edit" are valid modes.
  buildEstimateEditorApplyPlan(h, "view", DEFAULT_PRICING_CATALOG, TEST_CONFIG);

  // The runtime assertion is incidental; the compile-time rejection above is the actual test.
  assert.equal(buildEstimateEditorApplyPlan(h, "create", DEFAULT_PRICING_CATALOG, TEST_CONFIG).status, "ready");
});
