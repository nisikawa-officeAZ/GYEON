// Estimate Wizard Ver2.2 — Phase 8 integration contract tests (Phase 8-B1H).
//
// Pure behavioural tests for the three hardened integration files. No React, no DOM, no server, no
// DB, no API, no pricing, no randomness, no clock. No `any`, no `as any`, no `as unknown as`, and
// no unsafe assertion to the opaque integration type.
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
import { initialEstimateWizardDraftV22 } from "../draft/wizard-draft-state";
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
// NOTE: these tests build the draft with `estimateToWizardDraft`, which constructs a FRESH
// `discountAndCoupon` object literal. `newEstimateWizardDraft()` must NOT be used here — it
// shallow-spreads `initialEstimateWizardDraftV22`, so its nested objects are shared by reference
// with that module const, and mutating them would corrupt every future blank draft.

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
