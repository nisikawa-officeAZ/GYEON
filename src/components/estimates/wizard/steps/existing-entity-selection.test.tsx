// B7-2A — existing/new entity parity: pure resolution AND mounted Step1/Step2 binding.
//
// Run: node --import tsx --test src/components/estimates/wizard/steps/existing-entity-selection.test.tsx
//
// `.tsx` because the contract is only half proven by the pure resolver: the other
// half is that Step 1 and Step 2 actually bind to it, show read-only summaries for
// existing selections, keep new/OCR fields editable, and never write display data
// into the CREATE payload. Those are rendering facts and need a real mount.
//
// No DB, no network, no storage, no save. Everything below operates on arrays.

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import * as React from "react";
import { renderToStaticMarkup } from "react-dom/server";

import {
  resolvePreselection, preselectionStorePatch, initialPreselectionStorePatch, selectableCustomers,
  selectableVehiclesForCustomer, existingVehicleSurvives,
  customerIsSelectable, vehicleIsSelectable,
  effectiveExistingCustomer, effectiveExistingVehicle,
  customerSelectionPatch, vehicleSelectionPatch,
} from "./existing-entity-selection";
import { Step1Customer } from "./Step1Customer";
import { Step2Vehicle } from "./Step2Vehicle";
import type { EstimateWizardApi } from "../useEstimateWizard";
import type { WizardStore } from "../wizard-types";
import type {
  WizardExistingCustomerReference, WizardExistingVehicleReference,
  WizardScreenConfiguration, WizardReservationPrefill,
} from "../contract/wizard-runtime-inputs";
import type { ProductionPricingConfiguration } from "../pricing/wizard-manual-pricing-config";
import { makePricingCatalog } from "@/lib/pricing/pricing-catalog";
import { toCustomerReference, toVehicleReference } from "@/lib/estimates/wizard-entity-references";
import EstimateWizard from "../EstimateWizard";
import { initialWizardStore } from "../wizard-types";
import { resetWizardDraft } from "../draft/wizard-draft-state";
import type { EstimateWizardDraftV22 } from "../draft/wizard-draft-types";

// `jsx: "preserve"` compiles JSX to React.createElement against a global React.
(globalThis as { React?: typeof React }).React = React;

// ── Fixtures ────────────────────────────────────────────────────────────────

const C1: WizardExistingCustomerReference = { id: "c-1", displayName: "山田太郎", phone: "090-0000-0001" };
const C2: WizardExistingCustomerReference = { id: "c-2", displayName: "鈴木花子", phone: "090-0000-0002" };
const CUSTOMERS = [C1, C2] as const;

const V1: WizardExistingVehicleReference = { id: "v-1", customerId: "c-1", displayName: "TOYOTA CROWN", plateNumber: "滋賀 330 に 1234", bodySize: "M" };
const V2: WizardExistingVehicleReference = { id: "v-2", customerId: "c-2", displayName: "HONDA FIT", plateNumber: "京都 500 は 5678", bodySize: "S" };
const VEHICLES = [V1, V2] as const;

// ── 1. Preselection — every branch ──────────────────────────────────────────

test("no preselection ids → nothing selected", () => {
  assert.deepEqual(resolvePreselection(CUSTOMERS, VEHICLES, undefined, undefined),
    { customerId: null, vehicleId: null });
});

test("valid customer + valid owned vehicle → both selected", () => {
  assert.deepEqual(resolvePreselection(CUSTOMERS, VEHICLES, "c-1", "v-1"),
    { customerId: "c-1", vehicleId: "v-1" });
});

test("valid customer, no vehicle id → customer only", () => {
  assert.deepEqual(resolvePreselection(CUSTOMERS, VEHICLES, "c-1", undefined),
    { customerId: "c-1", vehicleId: null });
});

test("INVALID customer clears BOTH — a vehicle cannot outlive an unverifiable owner", () => {
  for (const bad of ["c-999", "", "  ", "../../etc", "C-1"]) {
    assert.deepEqual(resolvePreselection(CUSTOMERS, VEHICLES, bad, "v-1"),
      { customerId: null, vehicleId: null }, `customer ${JSON.stringify(bad)}`);
  }
});

test("a foreign-tenant id is INDISTINGUISHABLE from a nonexistent one", () => {
  // Both are simply absent from the RLS-scoped array. Same code path, same result.
  const foreign = resolvePreselection(CUSTOMERS, VEHICLES, "c-from-another-dealer", undefined);
  const missing = resolvePreselection(CUSTOMERS, VEHICLES, "c-does-not-exist", undefined);
  assert.deepEqual(foreign, missing);
  assert.deepEqual(foreign, { customerId: null, vehicleId: null });
});

test("vehicle without a customer → no vehicle", () => {
  assert.deepEqual(resolvePreselection(CUSTOMERS, VEHICLES, undefined, "v-1"),
    { customerId: null, vehicleId: null });
});

test("valid customer + INVALID vehicle → customer kept, vehicle cleared", () => {
  for (const bad of ["v-999", "", "V-1"]) {
    assert.deepEqual(resolvePreselection(CUSTOMERS, VEHICLES, "c-1", bad),
      { customerId: "c-1", vehicleId: null }, `vehicle ${JSON.stringify(bad)}`);
  }
});

test("valid customer + FOREIGN-OWNED vehicle → customer kept, vehicle cleared", () => {
  assert.deepEqual(resolvePreselection(CUSTOMERS, VEHICLES, "c-1", "v-2"),
    { customerId: "c-1", vehicleId: null });
});

// ── 2. Duplicates are ambiguous, never resolved ─────────────────────────────

test("DUPLICATE customer id is ambiguous → both cleared, and unselectable", () => {
  const dupes = [C1, { ...C1, displayName: "別の山田" }, C2] as const;
  assert.deepEqual(resolvePreselection(dupes, VEHICLES, "c-1", "v-1"),
    { customerId: null, vehicleId: null });
  assert.equal(customerIsSelectable(dupes, "c-1"), false);
  // Neither first- nor last-write-wins: the id disappears from the pool entirely.
  assert.deepEqual(selectableCustomers(dupes).map((c) => c.id), ["c-2"]);
});

test("DUPLICATE vehicle id is ambiguous → customer kept, vehicle cleared and unselectable", () => {
  const dupes = [V1, { ...V1, displayName: "別のクラウン" }, V2] as const;
  assert.deepEqual(resolvePreselection(CUSTOMERS, dupes, "c-1", "v-1"),
    { customerId: "c-1", vehicleId: null });
  assert.equal(vehicleIsSelectable(dupes, "v-1"), false);
  assert.deepEqual(selectableVehiclesForCustomer(dupes, "c-1").map((v) => v.id), []);
});

// ── 3. Ownership filtering ──────────────────────────────────────────────────

test("only vehicles owned by the selected customer are offered", () => {
  assert.deepEqual(selectableVehiclesForCustomer(VEHICLES, "c-1").map((v) => v.id), ["v-1"]);
  assert.deepEqual(selectableVehiclesForCustomer(VEHICLES, "c-2").map((v) => v.id), ["v-2"]);
});

test("no customer → NO vehicles offered", () => {
  assert.deepEqual(selectableVehiclesForCustomer(VEHICLES, null), []);
  assert.deepEqual(selectableVehiclesForCustomer(VEHICLES, ""), []);
});

test("customer change or leaving existing mode drops an incompatible vehicle", () => {
  assert.equal(existingVehicleSurvives(VEHICLES, "c-1", "v-1", true), true, "same owner survives");
  assert.equal(existingVehicleSurvives(VEHICLES, "c-2", "v-1", true), false, "owner changed");
  assert.equal(existingVehicleSurvives(VEHICLES, "c-1", "v-1", false), false, "left existing mode");
  assert.equal(existingVehicleSurvives(VEHICLES, null, "v-1", true), false, "no customer");
  assert.equal(existingVehicleSurvives(VEHICLES, "c-1", null, true), false, "no vehicle");
});

// ── 4. Customer search moved to the server (B2.2B) ──────────────────────────
//
// The former in-memory `filterCustomers` test is deleted, not adapted: Screen 1 no longer filters
// customers in the browser. Search is an authenticated, tenant-scoped Server Action, and its term
// handling is covered by src/lib/customers/search-dealer-customers-core.test.ts. Its tenancy is
// provable only against a real database and is verified in B2.6, never claimed here.
//
// Customer SELECTION — which is what this file is really about — remains client-side and is still
// covered by the effective/patch tests above and below.

test("the resolver module performs no fetch, storage or DB access", () => {
  const code = readFileSync("src/components/estimates/wizard/steps/existing-entity-selection.ts", "utf8")
    .replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");
  for (const forbidden of ["fetch(", "supa" + "base", "sessionStorage", "localStorage", "await ", "async "]) {
    assert.equal(code.includes(forbidden), false, `resolver must not contain ${forbidden}`);
  }
});

// ── 5. The store patch writes ids only ──────────────────────────────────────

test("the initial patch carries ONLY ids and the mode — no display data", () => {
  const patch = preselectionStorePatch({ customerId: "c-1", vehicleId: "v-1" });
  assert.deepEqual(patch, {
    customer: { regMethod: "search", existingId: "c-1" },
    vehicle: { existingId: "v-1" },
  });
  const serialized = JSON.stringify(patch);
  // The bodySize canary is the QUOTED JSON scalar `"M"`, not the bare letter.
  // A one-character substring is not a canary: `M` occurs inside `regMethod`, a key
  // the contract REQUIRES, so the bare form failed against correct output. Quoting it
  // still catches a leaked value (`"bodySize":"M"`) while it cannot match a key name.
  for (const leak of ["山田太郎", "090-0000-0001", "TOYOTA", "滋賀", '"M"', "displayName", "phone", "plateNumber", "bodySize"]) {
    assert.equal(serialized.includes(leak), false, `patch leaks ${leak} into the draft`);
  }
});

test("no resolved customer → no patch at all (plain canonical initial draft)", () => {
  assert.equal(preselectionStorePatch({ customerId: null, vehicleId: null }), undefined);
  assert.equal(preselectionStorePatch({ customerId: null, vehicleId: "v-1" }), undefined);
});

// ── 6. Projection DTOs carry exactly the allowed keys ───────────────────────

test("customer projection exposes exactly three keys and drops everything else", () => {
  const row = {
    id: "c-1", dealer_id: "d-1", customer_code: "K-1", last_name: "山田", first_name: "太郎",
    last_name_kana: "ヤマダ", first_name_kana: "タロウ", phone: "090-0000-0001",
    email: "a@example.test", postal_code: "1000001", prefecture: "東京都", city: "千代田区",
    address1: "1-1", address2: "203", birthday: "1980-01-01", gender: "m", occupation: "会社員",
    notes: "CANARY-NOTE", line_user_id: "CANARY-LINE", line_display_name: "CANARY-LINE-NAME",
    line_picture_url: "https://example.test/x.png", line_connected: true,
    is_business: false, trade_discount_pct: 0, credit_terms: "翌月末",
    deleted_at: null, created_at: "2026-01-01", updated_at: "2026-01-02",
  };
  const ref = toCustomerReference(row as Parameters<typeof toCustomerReference>[0]);

  assert.deepEqual(Object.keys(ref).sort(), ["displayName", "id", "phone"]);
  assert.equal(ref.displayName, "山田 太郎", "composed server-side");

  const serialized = JSON.stringify(ref);
  for (const leak of ["CANARY", "d-1", "birthday", "1980", "千代田", "example.test", "翌月末", "2026-01-01"]) {
    assert.equal(serialized.includes(leak), false, `customer reference leaks ${leak}`);
  }
});

test("vehicle projection exposes exactly five keys and drops everything else", () => {
  const row = {
    id: "v-1", dealer_id: "d-1", customer_id: "c-1", vehicle_code: "ABA-X", maker: "TOYOTA",
    model: "CROWN", grade: "G", year: "2020", color: "白", plate_number: "滋賀 330 に 1234",
    vin: "CANARY-VIN", body_size: "M", mileage: 12345, inspection_expiry_date: "2027-01-01",
    notes: "CANARY-NOTE", displacement: "1998cc", fuel_type: "ガソリン",
    registration_date: "2020-01-01", deleted_at: null, created_at: "2026-01-01",
    updated_at: "2026-01-02", customers: { last_name: "山田", first_name: "太郎" },
  };
  const ref = toVehicleReference(row as Parameters<typeof toVehicleReference>[0]);

  assert.deepEqual(Object.keys(ref).sort(), ["bodySize", "customerId", "displayName", "id", "plateNumber"]);
  assert.equal(ref.displayName, "TOYOTA CROWN");

  const serialized = JSON.stringify(ref);
  for (const leak of ["CANARY", "d-1", "12345", "ガソリン", "2027", "customers", "山田"]) {
    assert.equal(serialized.includes(leak), false, `vehicle reference leaks ${leak}`);
  }
});

// ── 7. Mounted Step 1 / Step 2 binding ──────────────────────────────────────

// Fixtures carry their real contract types, and the catalog comes from the same
// factory the sibling binding test uses. With the cast gone (below) these are no
// longer hidden behind an assertion — the compiler checks them, which is the point.
const SC: WizardScreenConfiguration = {
  // B2-E2G: every managed family opted OUT — this fixture configures none of them.
  serviceOfferings: { window_film: false, ppf: false, maintenance: false, room_cleaning: false, car_wash: false },
  filmTypes: [], windowAreas: [], maintenanceMenus: [], washMenus: [], roomMenus: [],
  otherWorkPresets: [], storeGlobalOptions: [], coupons: [], ppfMethods: [], ppfParts: [], ppfTypeGroups: [],
};
const PC: ProductionPricingConfiguration = {
  ppfMethods: [], filmTypes: [], maintenanceMenus: [], washMenus: [], roomCleaningMenus: [], storeGlobalOptions: [],
};

/**
 * Only the two OPTIONAL preselection props may be overridden.
 *
 * The previous `Record<string, unknown>` widened the object enough that TypeScript
 * refused the props assertion (TS2352) — and the assertion was itself the problem:
 * it silenced every prop-type check in this harness. A narrow `Pick` restores full
 * precision, so a required prop cannot be dropped or misspelled here, and a
 * deliberately WRONG override is a compile error rather than a silent pass.
 */
type MountOverrides = Pick<
  React.ComponentProps<typeof EstimateWizard>,
  "defaultCustomerId" | "defaultVehicleId"
>;

function mount(over: MountOverrides = {}): string {
  // Typed on the way in — no cast, so all six required props are checked.
  const props: React.ComponentProps<typeof EstimateWizard> = {
    shopRank: "detailer",
    screenConfig: SC,
    catalog: makePricingCatalog(),
    pricingConfig: PC,
    customers: CUSTOMERS,
    vehicles: VEHICLES,
    ...over,
  };

  return renderToStaticMarkup(React.createElement(EstimateWizard, props));
}

test("MOUNTED: with no preselection Step 1 shows the NEW-customer form, not a summary", () => {
  const html = mount();
  assert.ok(html.length > 0, "PRECONDITION: the host rendered");
  assert.equal(html.includes("existing-customer-summary"), false, "no existing selection");
  assert.ok(html.includes("お客様名 / 会社名"), "new-record fields are editable and present");
});

test("MOUNTED: a valid preselection renders the read-only existing summary", () => {
  const html = mount({ defaultCustomerId: "c-1", defaultVehicleId: "v-1" });
  assert.ok(html.includes("existing-customer-summary"), "PRECONDITION: the summary rendered");
  assert.ok(html.includes("既存顧客を選択中"));
  assert.ok(html.includes("山田太郎"), "the server-composed label is shown");

  // The CREATE payload fields must be gone — showing them would invite an operator
  // to describe a new customer that duplicates the selected one.
  assert.equal(html.includes("お客様名 / 会社名"), false, "new-record fields are not offered");
  // Read-only: no text input carries the reference's display data as a value.
  assert.equal(html.includes('value="山田太郎"'), false, "display data is not an editable field value");
});

test("MOUNTED: an INVALID preselected customer falls back to the new-customer form", () => {
  const html = mount({ defaultCustomerId: "c-999", defaultVehicleId: "v-1" });
  assert.equal(html.includes("existing-customer-summary"), false);
  assert.ok(html.includes("お客様名 / 会社名"));
});

test("MOUNTED: a foreign-owned preselected vehicle keeps the customer and drops the vehicle", () => {
  const html = mount({ defaultCustomerId: "c-1", defaultVehicleId: "v-2" });
  assert.ok(html.includes("existing-customer-summary"), "customer survived");
  assert.equal(html.includes("HONDA FIT"), false, "the foreign vehicle is not attached");
});

test("MOUNTED: Step 4 never receives the entity arrays", () => {
  const host = readFileSync("src/components/estimates/wizard/EstimateWizard.tsx", "utf8")
    .replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");
  const mount4 = host.slice(host.indexOf("<Step4Estimate"), host.indexOf("<Step5Discount"));
  assert.equal(mount4.includes("customers"), false);
  assert.equal(mount4.includes("vehicles"), false);
});

// ── 8. No snapshot pollution, no auto body size ─────────────────────────────

test("an existing selection leaves the new-record snapshots untouched", () => {
  // The canonical empty store is the reference: selecting an existing record must
  // not differ from it in any CREATE field.
  const empty = initialWizardStore();
  assert.equal(empty.customer.name, "");
  assert.equal(empty.vehicle.model, "");
  assert.equal(empty.vehicle.confirmedSize, null);

  const patch = preselectionStorePatch({ customerId: "c-1", vehicleId: "v-1" });
  const customerKeys = Object.keys(patch?.customer ?? {});
  const vehicleKeys = Object.keys(patch?.vehicle ?? {});
  assert.deepEqual(customerKeys.sort(), ["existingId", "regMethod"]);
  assert.deepEqual(vehicleKeys, ["existingId"]);
  // Specifically: never confirmedSize/suggestedSize from the reference's bodySize.
  assert.equal(vehicleKeys.includes("confirmedSize"), false);
  assert.equal(vehicleKeys.includes("suggestedSize"), false);
});

// ── 9. MOUNTED Step 2 — a controlled fake api, real JSX ─────────────────────

type StoreOver = { customer?: Partial<WizardStore["customer"]>; vehicle?: Partial<WizardStore["vehicle"]> };

function fakeApi(over: StoreOver = {}): { api: EstimateWizardApi; writes: unknown[] } {
  const base = initialWizardStore();
  const store: WizardStore = {
    ...base,
    customer: { ...base.customer, ...(over.customer ?? {}) },
    vehicle: { ...base.vehicle, ...(over.vehicle ?? {}) },
  };
  // EST-WIZ-REQ-F2-R1: Step 2 reads api.draft for the persistence-mode discriminator
  // (willSaveExistingVehicle), so the fake supplies a CANONICAL draft coherent with the
  // store overrides — sourceMode derives from the stored id, exactly the production
  // invariant the patch adapter maintains.
  const d = resetWizardDraft();
  const draft: EstimateWizardDraftV22 = {
    ...d,
    customer: {
      ...d.customer,
      registrationMethod: store.customer.regMethod,
      sourceMode: store.customer.regMethod === "search" ? "existing" : "new",
      customerId: store.customer.existingId,
      newCustomer: { ...d.customer.newCustomer, name: store.customer.name },
    },
    vehicle: {
      ...d.vehicle,
      sourceMode: store.vehicle.existingId ? "existing" : "new",
      vehicleId: store.vehicle.existingId,
      newVehicle: {
        ...d.vehicle.newVehicle,
        model: store.vehicle.model,
        maker: store.vehicle.maker,
        plate_number: store.vehicle.plateNumber,
      },
    },
  };
  const writes: unknown[] = [];
  const api = { store, draft, updateStore: (p: unknown) => { writes.push(p); } } as unknown as EstimateWizardApi;
  return { api, writes };
}

const step2 = (over: StoreOver = {}, refs: readonly WizardExistingCustomerReference[] = CUSTOMERS) =>
  renderToStaticMarkup(React.createElement(Step2Vehicle, {
    api: fakeApi(over).api, customers: refs, vehicles: VEHICLES,
  }));

const EXISTING_C1 = { regMethod: "search" as const, existingId: "c-1" };

test("MOUNTED Step 2: a valid existing vehicle renders the read-only summary", () => {
  const html = step2({ customer: EXISTING_C1, vehicle: { existingId: "v-1" } });
  assert.ok(html.includes("existing-vehicle-summary"), "PRECONDITION: the summary rendered");
  assert.ok(html.includes("既存車両を選択中"));
  assert.ok(html.includes("TOYOTA CROWN"));
});

test("MOUNTED Step 2: the selected reference never becomes an editable input value", () => {
  const html = step2({ customer: EXISTING_C1, vehicle: { existingId: "v-1" } });
  for (const leak of ['value="TOYOTA CROWN"', 'value="滋賀 330 に 1234"', 'value="M"']) {
    assert.equal(html.includes(leak), false, `reference data used as an input value: ${leak}`);
  }
});

test("MOUNTED Step 2: only vehicles OWNED by the selected customer are offered", () => {
  const html = step2({ customer: EXISTING_C1 });
  assert.ok(html.includes("existing-vehicle-option-v-1"), "PRECONDITION: the owned vehicle is offered");
  assert.equal(html.includes("existing-vehicle-option-v-2"), false, "a foreign-owned vehicle is absent");
  assert.equal(html.includes("HONDA FIT"), false);
});

test("MOUNTED Step 2: no existing selection preserves the editable/OCR new-vehicle flow", () => {
  const html = step2({ customer: EXISTING_C1 });
  assert.ok(html.includes("車名"), "the required manual model field is present");
  assert.ok(html.includes("ボディサイズ"), "the operator body-size chooser is present");
});

test("MOUNTED Step 2: an existing selection hides CREATE fields but keeps the shared size chooser", () => {
  const html = step2({ customer: EXISTING_C1, vehicle: { existingId: "v-1" } });
  assert.equal(html.includes("車名"), false, "the CREATE model field is not offered");
  assert.equal(html.includes("ボディサイズ（3M推定"), true,
    "the same confirmed body-size authority must remain available for existing vehicles");
});

test("MOUNTED Step 2: bodySize is reference-only display and never sets confirmedSize", () => {
  const html = step2({ customer: EXISTING_C1, vehicle: { existingId: "v-1" } });
  assert.ok(html.includes("参考表示"), "PRECONDITION: bodySize is shown as reference only");
  // The store's confirmedSize is untouched by rendering, and no button is marked
  // selected from the reference value.
  const { api } = fakeApi({ customer: EXISTING_C1, vehicle: { existingId: "v-1" } });
  assert.equal(api.store.vehicle.confirmedSize, null, "confirmedSize was never auto-set");
});

test("MOUNTED Step 2: new/OCR customer mode exposes NO existing-vehicle selection", () => {
  for (const regMethod of ["new", "ocr"] as const) {
    const html = step2({ customer: { regMethod, existingId: "c-1" } });
    assert.equal(html.includes("existing-vehicle-selector"), false, `${regMethod}: no selector`);
    assert.equal(html.includes("existing-vehicle-summary"), false, `${regMethod}: no summary`);
    assert.equal(html.includes("既存車両"), false, `${regMethod}: no existing-vehicle card`);
    assert.ok(html.includes("車名"), `${regMethod}: the editable flow is preserved`);
  }
});

test("MOUNTED Step 2 REGRESSION: an AMBIGUOUS customer offers no existing-vehicle surface", () => {
  // regMethod=search, stored existingId=c-1, and c-1 appears TWICE. Step 1 already
  // refuses to treat this as a selection; Step 2 must refuse identically. Trusting
  // the stored id here would let an ambiguous customer offer "its" vehicles — and
  // which record it names is precisely what is unknown.
  const dupes = [C1, { ...C1, displayName: "別の山田" }, C2] as const;

  // No stored vehicle id → the editable / OCR new-vehicle flow stands.
  const noVehicle = step2({ customer: { regMethod: "search", existingId: "c-1" }, vehicle: {} }, dupes);
  assert.equal(noVehicle.includes("existing-vehicle-selector"), false, "no selector");
  assert.equal(noVehicle.includes("existing-vehicle-summary"), false, "no summary");
  assert.equal(noVehicle.includes("existing-vehicle-option-v-1"), false, "no option offered");
  assert.equal(noVehicle.includes("既存車両"), false, "no existing-vehicle card at all");
  assert.ok(noVehicle.includes("車名"), "the required manual model field is present");
  assert.ok(noVehicle.includes("ボディサイズ"), "the operator body-size chooser is present");

  // A RETAINED id under the ambiguous owner is an INEFFECTIVE existing selection: the
  // closed F2-R1 recovery contract renders ONLY the recovery alert + clear action for
  // the vehicle area — no selector, no summary, and no editable form until the operator
  // explicitly clears.
  const retained = step2({ customer: { regMethod: "search", existingId: "c-1" }, vehicle: { existingId: "v-1" } }, dupes);
  assert.ok(retained.includes("ineffective-existing-vehicle-recovery"), "the recovery alert renders");
  assert.ok(retained.includes("ineffective-existing-vehicle-clear"), "with its explicit clear action");
  for (const absent of ["existing-vehicle-selector", "existing-vehicle-summary", "existing-vehicle-option-v-1",
                        "既存車両", "車名", "ボディサイズ"]) {
    assert.equal(retained.includes(absent), false, `recovery state must not render ${absent}`);
  }

  // PRECONDITION: with a UNIQUE customer the same inputs DO render the surface —
  // without this, the assertions above could pass against a component that never
  // renders an existing-vehicle surface at all.
  const unique = step2({ customer: { regMethod: "search", existingId: "c-1" } }, CUSTOMERS);
  assert.ok(unique.includes("existing-vehicle-option-v-1"), "unique customer DOES offer the vehicle");
});

// ── EST-WIZ-REQ-F2-R1: the closed ineffective-selection recovery contract ───

test("MOUNTED Step 2: a foreign-owned retained id renders ONLY the recovery surface", () => {
  // Owner c-2 is uniquely effective, but v-1 belongs to c-1 → will-save-existing yet
  // ineffective. Even the (effective) owner's own selector is withheld until the clear.
  const html = step2({ customer: { regMethod: "search", existingId: "c-2" }, vehicle: { existingId: "v-1" } });
  assert.ok(html.includes("ineffective-existing-vehicle-recovery"), "the recovery alert renders");
  assert.ok(html.includes("ineffective-existing-vehicle-clear"), "with its explicit clear action");
  for (const absent of ["existing-vehicle-selector", "existing-vehicle-summary", "existing-vehicle-option-v-2",
                        "既存車両", "車名", "ボディサイズ"]) {
    assert.equal(html.includes(absent), false, `recovery state must not render ${absent}`);
  }
});

test("MOUNTED Step 2: an owner who LEFT search mode with a retained id gets the recovery surface", () => {
  for (const regMethod of ["new", "ocr"] as const) {
    const html = step2({ customer: { regMethod, existingId: null }, vehicle: { existingId: "v-1" } });
    assert.ok(html.includes("ineffective-existing-vehicle-recovery"), `${regMethod}: recovery renders`);
    assert.equal(html.includes("車名"), false, `${regMethod}: no editable form until cleared`);
  }
});

test("MOUNTED Step 2: after clearing, typed fields survive and the editable flow returns", () => {
  // The cleared state (existingId null) with previously typed model text: no recovery,
  // and the text is still in the editable form — vehicleSelectionPatch(null) touches
  // exactly one key, so the CREATE payload survives.
  const html = step2({ customer: { regMethod: "search", existingId: "c-2" }, vehicle: { existingId: null, model: "クラウン" } });
  assert.equal(html.includes("ineffective-existing-vehicle-recovery"), false, "no recovery once cleared");
  assert.ok(html.includes('value="クラウン"'), "typed model text preserved in the editable form");
  assert.ok(html.includes("車名"), "the editable flow is back");
  assert.deepEqual(vehicleSelectionPatch(null), { vehicle: { existingId: null } }, "the clear patch is one key");
});

test("MOUNTED Step 2: the recovery clear action is BOUND to vehicleSelectionPatch(null)", () => {
  const code = readFileSync("src/components/estimates/wizard/steps/Step2Vehicle.tsx", "utf8");
  const recovery = code.slice(code.indexOf("ineffective-existing-vehicle-recovery"));
  assert.match(recovery, /data-testid="ineffective-existing-vehicle-clear"[\s\S]*?onClick=\{\(\) => setExistingVehicle\(null\)\}/,
    "the clear button calls setExistingVehicle(null)");
  assert.match(code, /setExistingVehicle = \(id: string \| null\) => \{[\s\S]*?api\.updateStore\(vehicleSelectionPatch\(id\)\);[\s\S]*?\};/,
    "which is vehicleSelectionPatch — one key, never a spread");
});

test("MOUNTED Step 2: setV is typed changed-keys-only and CANNOT re-assert existingId", () => {
  const code = readFileSync("src/components/estimates/wizard/steps/Step2Vehicle.tsx", "utf8");
  assert.match(code, /type EditableVehiclePatch = Partial<Omit<VehicleDraft, "existingId" \| "suggestedSize">>/,
    "the editable patch TYPE excludes identity");
  assert.match(code, /const setV = \(patch: EditableVehiclePatch\) => api\.updateStore\(\{ vehicle: patch \}\)/,
    "changed keys only — no projection spread");
  assert.equal(/updateStore\(\{ vehicle: \{ \.\.\.v/.test(code), false, "no full-projection spread remains");
});

test("the host passes BOTH customers and vehicles to Step2Vehicle", () => {
  const host = readFileSync("src/components/estimates/wizard/EstimateWizard.tsx", "utf8")
    .replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");
  const mount2 = host.slice(host.indexOf("<Step2Vehicle"), host.indexOf("<Step3Category"));
  assert.equal(mount2.includes("api={api}"), true);
  assert.equal(mount2.includes("customers={customers}"), true);
  assert.equal(mount2.includes("vehicles={vehicles}"), true,
    "Step 2 must receive both reference arrays");
  assert.equal(mount2.includes("sizeEstimate={bodySizeEstimate}"), true);
  assert.equal(mount2.includes("onSizeEstimate={setBodySizeEstimate}"), true,
    "Step 2 must receive transient display-only size evidence");
  // Step 4 still receives neither — the contracts stay separate.
  const mount4 = host.slice(host.indexOf("<Step4Estimate"), host.indexOf("<Step5Discount"));
  assert.equal(mount4.includes("customers"), false);
  assert.equal(mount4.includes("vehicles"), false);
});

test("MOUNTED Step 2: existing select/clear writes ONE key", () => {
  const code = readFileSync("src/components/estimates/wizard/steps/Step2Vehicle.tsx", "utf8");
  assert.match(code, /setExistingVehicle = \(id: string \| null\) => \{[\s\S]*?api\.updateStore\(vehicleSelectionPatch\(id\)\);[\s\S]*?\};/);
  assert.deepEqual(vehicleSelectionPatch("v-1"), { vehicle: { existingId: "v-1" } });
  assert.deepEqual(vehicleSelectionPatch(null), { vehicle: { existingId: null } });
  assert.deepEqual(Object.keys(vehicleSelectionPatch("v-1").vehicle), ["existingId"]);
});

// ── 10. MOUNTED Step 1 — search mode with NO selection ──────────────────────

const step1 = (over: StoreOver = {}) =>
  renderToStaticMarkup(React.createElement(Step1Customer, {
    api: fakeApi(over).api, customers: CUSTOMERS, vehicles: VEHICLES,
  }));

test("MOUNTED Step 1: search mode with NO selection shows ONLY the selector", () => {
  const html = step1({ customer: { regMethod: "search", existingId: null } });
  assert.ok(html.includes("existing-customer-selector"), "PRECONDITION: the selector rendered");
  assert.equal(html.includes("existing-customer-summary"), false, "nothing selected yet");

  // No CREATE fields, and no business / credit-sale terms.
  for (const field of ["お客様名 / 会社名", "フリガナ", "メール", "郵便番号", "LINE ID", "住所",
                       "業者", "掛売り"]) {
    assert.equal(html.includes(field), false, `search mode must not offer ${field}`);
  }
});

test("MOUNTED Step 1: an AMBIGUOUS stored id does not count as a selection", () => {
  const dupes = [C1, { ...C1, displayName: "別の山田" }, C2] as const;
  const html = renderToStaticMarkup(React.createElement(Step1Customer, {
    api: fakeApi({ customer: { regMethod: "search", existingId: "c-1" } }).api,
    customers: dupes, vehicles: VEHICLES,
  }));
  assert.equal(html.includes("existing-customer-summary"), false, "ambiguous id is not effective");
  assert.ok(html.includes("existing-customer-selector"), "the selector is shown instead");
});

test("MOUNTED Step 1: new and OCR modes retain every editable field", () => {
  for (const regMethod of ["new", "ocr"] as const) {
    const html = step1({ customer: { regMethod, existingId: null } });
    for (const field of ["お客様名 / 会社名", "フリガナ", "電話番号", "メール", "郵便番号",
                         "LINE ID", "住所", "業者", "掛売り"]) {
      assert.ok(html.includes(field), `${regMethod} must retain ${field}`);
    }
    assert.equal(html.includes("existing-customer-selector"), false, `${regMethod}: no selector`);
  }
});

// ── 11. Effective-selection helpers ─────────────────────────────────────────

test("an existing customer is effective only in search mode with a unique id", () => {
  assert.equal(effectiveExistingCustomer(CUSTOMERS, "search", "c-1")?.id, "c-1");
  assert.equal(effectiveExistingCustomer(CUSTOMERS, "new", "c-1"), null, "wrong mode");
  assert.equal(effectiveExistingCustomer(CUSTOMERS, "ocr", "c-1"), null, "wrong mode");
  assert.equal(effectiveExistingCustomer(CUSTOMERS, "search", "c-999"), null, "unknown id");
  assert.equal(effectiveExistingCustomer(CUSTOMERS, "search", null), null, "no id");
  const dupes = [C1, { ...C1 }] as const;
  assert.equal(effectiveExistingCustomer(dupes, "search", "c-1"), null, "ambiguous id");
});

test("an existing vehicle is effective only under its owning customer", () => {
  assert.equal(effectiveExistingVehicle(VEHICLES, "c-1", "v-1")?.id, "v-1");
  assert.equal(effectiveExistingVehicle(VEHICLES, "c-2", "v-1"), null, "foreign owner");
  assert.equal(effectiveExistingVehicle(VEHICLES, null, "v-1"), null, "no customer");
  assert.equal(effectiveExistingVehicle(VEHICLES, "c-1", null), null, "no vehicle");
});

// ── 12. Customer selection patch — exact keys, every branch ─────────────────

test("PATCH: search + selected customer → exact id, no vehicle section", () => {
  const patch = customerSelectionPatch(VEHICLES, "search", "c-1", null);
  assert.deepEqual(patch, { customer: { regMethod: "search", existingId: "c-1" } });
  assert.deepEqual(Object.keys(patch), ["customer"]);
  assert.deepEqual(Object.keys(patch.customer).sort(), ["existingId", "regMethod"]);
});

test("PATCH: new / OCR → existingId null", () => {
  for (const mode of ["new", "ocr"] as const) {
    const patch = customerSelectionPatch(VEHICLES, mode, "c-1", null);
    assert.deepEqual(patch, { customer: { regMethod: mode, existingId: null } });
  }
});

test("PATCH: COMPATIBLE vehicle → the vehicle section is omitted entirely", () => {
  const patch = customerSelectionPatch(VEHICLES, "search", "c-1", "v-1");
  assert.deepEqual(Object.keys(patch), ["customer"], "no vehicle section");
  assert.equal("vehicle" in patch, false);
});

test("PATCH: INCOMPATIBLE vehicle → cleared in the SAME atomic patch", () => {
  // Owner changed.
  const changed = customerSelectionPatch(VEHICLES, "search", "c-2", "v-1");
  assert.deepEqual(changed, {
    customer: { regMethod: "search", existingId: "c-2" },
    vehicle: { existingId: null },
  });
  // Left existing mode.
  const left = customerSelectionPatch(VEHICLES, "new", null, "v-1");
  assert.deepEqual(left, {
    customer: { regMethod: "new", existingId: null },
    vehicle: { existingId: null },
  });
});

test("PATCH: no new-customer or new-vehicle CREATE field ever appears", () => {
  const patches = [
    customerSelectionPatch(VEHICLES, "search", "c-1", null),
    customerSelectionPatch(VEHICLES, "search", "c-2", "v-1"),
    customerSelectionPatch(VEHICLES, "new", null, "v-1"),
    customerSelectionPatch(VEHICLES, "ocr", "c-1", "v-1"),
  ];
  for (const patch of patches) {
    const serialized = JSON.stringify(patch);
    for (const forbidden of ["name", "kana", "email", "postal", "address", "phone", "lineId",
                             "contractor", "creditSale", "creditTerms", "maker", "model",
                             "plateNumber", "confirmedSize", "suggestedSize", "displayName", "bodySize"]) {
      assert.equal(serialized.includes(forbidden), false, `patch contains ${forbidden}`);
    }
    assert.deepEqual(Object.keys(patch.customer).sort(), ["existingId", "regMethod"]);
    if ("vehicle" in patch) assert.deepEqual(Object.keys(patch.vehicle!), ["existingId"]);
  }
});

test("the step components never spread a full customer/vehicle projection into a selection patch", () => {
  const step1src = readFileSync("src/components/estimates/wizard/steps/Step1Customer.tsx", "utf8");
  assert.match(step1src, /api\.updateStore\(customerSelectionPatch\(/, "selection goes through the pure helper");
  assert.equal(/updateStore\(\{\s*customer: \{ \.\.\.c, regMethod/.test(step1src), false,
    "no spread-based selection write remains");
});

test("Step 1 and Step 2 never copy reference display fields into new-record state", () => {
  for (const file of [
    "src/components/estimates/wizard/steps/Step1Customer.tsx",
    "src/components/estimates/wizard/steps/Step2Vehicle.tsx",
  ]) {
    const code = readFileSync(file, "utf8").replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");
    for (const bad of ["name: selected.", "phone: selected.", "model: selected.", "maker: selected.",
                       "plateNumber: selected.", "confirmedSize: selected."]) {
      assert.equal(code.includes(bad), false, `${file} copies reference data via ${bad}`);
    }
  }
});

// ── 13. GDA-1R2-C3R — server reservation prefill (pure initial patch) ───────

const prefill = (over: Partial<WizardReservationPrefill> = {}): WizardReservationPrefill => ({
  customerId: null, vehicleId: null, category: null, notesInternal: null, ...over,
});

test("PREFILL: a valid server prefill yields ONE exact patch — ids, category, internal memo", () => {
  assert.deepEqual(
    initialPreselectionStorePatch(CUSTOMERS, VEHICLES, undefined, undefined,
      prefill({ customerId: "c-1", vehicleId: "v-1", category: "maintenance", notesInternal: "予約からの引き継ぎメモ" })),
    {
      customer: { regMethod: "search", existingId: "c-1" },
      vehicle: { existingId: "v-1" },
      categories: ["maintenance"],
      notesInternal: "予約からの引き継ぎメモ",
    });
});

test("PREFILL: matching explicit query ids add no authority — the server-derived patch is identical", () => {
  const p = prefill({ customerId: "c-1", vehicleId: "v-1", category: "maintenance", notesInternal: "予約メモ" });
  assert.deepEqual(
    initialPreselectionStorePatch(CUSTOMERS, VEHICLES, "c-1", "v-1", p),
    initialPreselectionStorePatch(CUSTOMERS, VEHICLES, undefined, undefined, p));
});

test("PREFILL: a CONFLICTING customer query drops ALL defaults — category and memo included", () => {
  const p = prefill({ customerId: "c-1", vehicleId: "v-1", category: "maintenance", notesInternal: "予約メモ" });
  assert.equal(initialPreselectionStorePatch(CUSTOMERS, VEHICLES, "c-2", "v-1", p), undefined);
  // A non-null explicit id against a NULL server id is also a conflict.
  assert.equal(initialPreselectionStorePatch(CUSTOMERS, VEHICLES, "c-1", undefined,
    prefill({ customerId: null, notesInternal: "予約メモ" })), undefined);
});

test("PREFILL: a CONFLICTING vehicle query drops ALL defaults", () => {
  const p = prefill({ customerId: "c-1", vehicleId: "v-1", category: "maintenance", notesInternal: "予約メモ" });
  assert.equal(initialPreselectionStorePatch(CUSTOMERS, VEHICLES, "c-1", "v-2", p), undefined);
  assert.equal(initialPreselectionStorePatch(CUSTOMERS, VEHICLES, undefined, "v-1",
    prefill({ customerId: "c-1", vehicleId: null, category: "maintenance" })), undefined);
});

test("PREFILL: an EMPTY explicit customer query is a conflict — the entire prefill is dropped", () => {
  // page.scalar returns `?customer_id=` as "" — explicitly present, not absent.
  const p = prefill({ customerId: "c-1", vehicleId: "v-1", category: "maintenance", notesInternal: "予約メモ" });
  assert.equal(initialPreselectionStorePatch(CUSTOMERS, VEHICLES, "", "v-1", p), undefined);
  // "" also conflicts with a NULL server customer id: only undefined is absence.
  assert.equal(initialPreselectionStorePatch(CUSTOMERS, VEHICLES, "", undefined,
    prefill({ customerId: null, notesInternal: "予約メモ" })), undefined);
});

test("PREFILL: an EMPTY explicit vehicle query is a conflict — the entire prefill is dropped", () => {
  const p = prefill({ customerId: "c-1", vehicleId: "v-1", category: "maintenance", notesInternal: "予約メモ" });
  assert.equal(initialPreselectionStorePatch(CUSTOMERS, VEHICLES, "c-1", "", p), undefined);
  assert.equal(initialPreselectionStorePatch(CUSTOMERS, VEHICLES, undefined, "",
    prefill({ customerId: "c-1", vehicleId: null, category: "maintenance" })), undefined);
});

test("PREFILL: an invalid, ambiguous or foreign server entity drops ALL defaults", () => {
  const extras = { category: "maintenance", notesInternal: "予約メモ" } as const;
  // Unknown / foreign-tenant customer — absent from the RLS-scoped array either way.
  assert.equal(initialPreselectionStorePatch(CUSTOMERS, VEHICLES, undefined, undefined,
    prefill({ customerId: "c-999", ...extras })), undefined);
  // Ambiguous customer id.
  const dupeCustomers = [C1, { ...C1, displayName: "別の山田" }, C2] as const;
  assert.equal(initialPreselectionStorePatch(dupeCustomers, VEHICLES, undefined, undefined,
    prefill({ customerId: "c-1", ...extras })), undefined);
  // A vehicle without its owner.
  assert.equal(initialPreselectionStorePatch(CUSTOMERS, VEHICLES, undefined, undefined,
    prefill({ customerId: null, vehicleId: "v-1", ...extras })), undefined);
  // An unknown vehicle under a valid customer — NO partial keep, unlike resolvePreselection.
  assert.equal(initialPreselectionStorePatch(CUSTOMERS, VEHICLES, undefined, undefined,
    prefill({ customerId: "c-1", vehicleId: "v-999", ...extras })), undefined);
  // A foreign-owned vehicle.
  assert.equal(initialPreselectionStorePatch(CUSTOMERS, VEHICLES, undefined, undefined,
    prefill({ customerId: "c-1", vehicleId: "v-2", ...extras })), undefined);
  // An ambiguous vehicle id.
  const dupeVehicles = [V1, { ...V1, displayName: "別のクラウン" }, V2] as const;
  assert.equal(initialPreselectionStorePatch(CUSTOMERS, dupeVehicles, undefined, undefined,
    prefill({ customerId: "c-1", vehicleId: "v-1", ...extras })), undefined);
});

test("PREFILL: null ids are allowed — category and memo alone form the patch", () => {
  assert.deepEqual(initialPreselectionStorePatch(CUSTOMERS, VEHICLES, undefined, undefined,
    prefill({ category: "maintenance", notesInternal: "予約メモ" })),
    { categories: ["maintenance"], notesInternal: "予約メモ" });
  assert.deepEqual(initialPreselectionStorePatch(CUSTOMERS, VEHICLES, undefined, undefined,
    prefill({ notesInternal: "予約メモ" })),
    { notesInternal: "予約メモ" });
  // An all-null prefill would produce an EMPTY patch → undefined, never {}.
  assert.equal(initialPreselectionStorePatch(CUSTOMERS, VEHICLES, undefined, undefined, prefill()), undefined);
});

test("PREFILL absent: the existing onboarding behavior is preserved exactly", () => {
  const cases = [
    [undefined, undefined], ["c-1", "v-1"], ["c-1", undefined], ["c-1", "v-2"],
    ["c-999", "v-1"], [undefined, "v-1"],
  ] as const;
  for (const [cid, vid] of cases) {
    assert.deepEqual(
      initialPreselectionStorePatch(CUSTOMERS, VEHICLES, cid, vid),
      preselectionStorePatch(resolvePreselection(CUSTOMERS, VEHICLES, cid, vid)),
      `(${String(cid)}, ${String(vid)})`);
  }
});

test("PREFILL: the patch NEVER carries notesCustomer or service/config/display keys", () => {
  const patch = initialPreselectionStorePatch(CUSTOMERS, VEHICLES, undefined, undefined,
    prefill({ customerId: "c-1", vehicleId: "v-1", category: "maintenance", notesInternal: "予約メモ" }));
  assert.ok(patch, "PRECONDITION: the full prefill produced a patch");
  assert.deepEqual(Object.keys(patch).sort(), ["categories", "customer", "notesInternal", "vehicle"]);
  assert.deepEqual(Object.keys(patch.customer!).sort(), ["existingId", "regMethod"]);
  assert.deepEqual(Object.keys(patch.vehicle!), ["existingId"]);
  const serialized = JSON.stringify(patch);
  for (const forbidden of ["notesCustomer", "displayName", "phone", "plateNumber", "bodySize",
                           "confirmedSize", "suggestedSize", "filmType", "windowAreas", "ppf",
                           "washMenu", "roomMenu", "otherWork", "coupon", "discount", "options"]) {
    assert.equal(serialized.includes(forbidden), false, `patch contains ${forbidden}`);
  }
});
