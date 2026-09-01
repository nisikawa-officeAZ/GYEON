// GDA_ESTIMATE_WIZARD_OCR_POSTAL_UNIFIED_R1_A — mounted proof that ONE reviewed OCR result
// reflects both customer and vehicle draft fields (plus the transient 3M recommendation) through
// ONE combined api.updateStore call, and that Step 1 and Step 2 share the same typed vehicle
// mapper.
//
// Run: node --import tsx --test src/components/estimates/wizard/steps/estimate-wizard-ocr-apply.test.tsx
//
// TEST SEAM: Step1Customer/Step2Vehicle wire `<OcrEntry onApply={...}/>` directly in JSX with no
// production export for the closure itself. This repo's established "jsx: preserve compiles to a
// GLOBAL React.createElement" convention (see existing-entity-selection.test.tsx) is reused here
// deliberately: we swap `globalThis.React` for one render pass with a thin wrapper around the REAL
// React.createElement that additionally records the `onApply` prop passed to the (identity-
// compared) OcrEntry component, then restores the real React. This captures the ACTUAL production
// closure — not a reimplementation of it — without adding a dependency, without a DOM/browser, and
// without changing any production export merely for testing.
//
// No DB, no network, no storage, no save.

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import * as React from "react";
import { renderToStaticMarkup } from "react-dom/server";

import { Step1Customer } from "./Step1Customer";
import { Step2Vehicle } from "./Step2Vehicle";
import { OcrEntry } from "../OcrEntry";
import type { EstimateWizardApi } from "../useEstimateWizard";
import type { WizardStore } from "../wizard-types";
import { initialWizardStore } from "../wizard-types";
import { resetWizardDraft, updateNewVehicle } from "../draft/wizard-draft-state";
import { applyStorePatch, type WizardStorePatch } from "../bridge/ew-ui1-controller";
import { buildWizardCustomerOcrPatch } from "@/lib/ocr/wizard-customer-ocr-apply-core";
import { buildWizardVehicleOcrPatch } from "@/lib/ocr/wizard-vehicle-ocr-apply-core";
import { estimateBodySizeFromVehicleRegistrationOcr, BODY_SIZE_KEYS } from "@/lib/vehicles/body-size-estimate";
import type { VehicleRegistrationOcrResult } from "@/lib/vehicle-registration/vehicle-registration-types";
import type {
  JpPostalForwardLookupInvoker,
  JpPostalReverseLookupInvoker,
} from "../contract/wizard-runtime-inputs";

// `jsx: "preserve"` compiles JSX to React.createElement against a global React (see file header).
(globalThis as { React?: typeof React }).React = React;

// ── Test double: a controlled fake api recording every updateStore call ────────

type StoreOver = { customer?: Partial<WizardStore["customer"]>; vehicle?: Partial<WizardStore["vehicle"]> };

function fakeApi(over: StoreOver = {}): { api: EstimateWizardApi; writes: WizardStorePatch[] } {
  const base = initialWizardStore();
  const store: WizardStore = {
    ...base,
    customer: { ...base.customer, ...(over.customer ?? {}) },
    vehicle: { ...base.vehicle, ...(over.vehicle ?? {}) },
  };
  const writes: WizardStorePatch[] = [];
  const api = {
    store,
    draft: resetWizardDraft(),
    updateStore: (p: WizardStorePatch) => { writes.push(p); },
  } as unknown as EstimateWizardApi;
  return { api, writes };
}

// ── Test seam: capture the real onApply closure passed to OcrEntry during a render ─────────────

type OnApply = (fields: Partial<VehicleRegistrationOcrResult>) => void;

function captureOcrOnApply(renderFn: () => string): OnApply {
  const realReact = React;
  let captured: OnApply | null = null;
  const patchedReact = {
    ...realReact,
    createElement(type: unknown, props: Record<string, unknown> | null, ...children: unknown[]) {
      if (type === OcrEntry && props && typeof props.onApply === "function") {
        captured = props.onApply as OnApply;
      }
      return (realReact.createElement as (...args: unknown[]) => unknown)(type, props, ...children);
    },
  };
  (globalThis as { React: unknown }).React = patchedReact;
  try {
    renderFn();
  } finally {
    (globalThis as { React: unknown }).React = realReact;
  }
  if (!captured) throw new Error("OcrEntry.onApply was not captured during render");
  return captured;
}

function captureStep1OnApply(
  over: StoreOver,
  onSizeEstimate: (e: ReturnType<typeof estimateBodySizeFromVehicleRegistrationOcr> | null) => void,
  // GDA-2A-OCR-POSTAL-MASTER-R2 — optional extra props (the postal-master lookup seams), additive
  // and defaulted to {} so every pre-existing 2-argument call site is unaffected.
  extra: { addressToPostalInvoker?: JpPostalReverseLookupInvoker; postalToAddressInvoker?: JpPostalForwardLookupInvoker } = {},
): { onApply: OnApply; writes: WizardStorePatch[] } {
  const { api, writes } = fakeApi(over);
  const onApply = captureOcrOnApply(() => renderToStaticMarkup(
    React.createElement(Step1Customer, { api, customers: [], vehicles: [], onSizeEstimate, ...extra }),
  ));
  return { onApply, writes };
}

function captureStep2OnApply(over: StoreOver, onSizeEstimate: (e: ReturnType<typeof estimateBodySizeFromVehicleRegistrationOcr> | null) => void):
  { onApply: OnApply; writes: WizardStorePatch[] } {
  const { api, writes } = fakeApi(over);
  const onApply = captureOcrOnApply(() => renderToStaticMarkup(
    React.createElement(Step2Vehicle, { api, customers: [], vehicles: [], onSizeEstimate }),
  ));
  return { onApply, writes };
}

const FULL_OCR_RESULT: Partial<VehicleRegistrationOcrResult> = {
  owner_name: "山田太郎",
  owner_name_kana: "ヤマダタロウ",
  owner_address: "東京都港区1-2-3",
  maker: "トヨタ",
  vehicle_name: "クラウン",
  grade: "RS",
  model: "ABA-XXX",
  displacement: "1998cc",
  chassis_number: "ABC-1234567",
  first_registration_date: "2020-04",
  registration_date: "2020-04-15",
  inspection_expiry_date: "2027-04-14",
  color: "白",
  license_plate_region: "滋賀",
  license_plate_class: "330",
  license_plate_kana: "に",
  license_plate_number: "1234",
  length_mm: 4900,
  width_mm: 1900,
  height_mm: 1450,
  dimension_confidence: 0.95,
};

// ── ONE atomic Step-1 apply ──────────────────────────────────────────────────

test("ATOMIC: one Step-1 OCR apply calls updateStore exactly ONCE with combined customer+vehicle patches", () => {
  const sizeEstimates: (ReturnType<typeof estimateBodySizeFromVehicleRegistrationOcr> | null)[] = [];
  const { onApply, writes } = captureStep1OnApply({ customer: { regMethod: "ocr" } }, (e) => sizeEstimates.push(e));

  onApply(FULL_OCR_RESULT);

  assert.equal(writes.length, 1, "exactly one api.updateStore call for one OCR apply");
  const patch = writes[0];
  assert.equal("customer" in patch, true, "the combined patch carries the customer section");
  assert.equal("vehicle" in patch, true, "the combined patch carries the vehicle section");
});

test("ATOMIC: the customer section of the Step-1 combined patch matches the existing customer core exactly", () => {
  const { onApply, writes } = captureStep1OnApply({ customer: { regMethod: "ocr" } }, () => {});
  onApply(FULL_OCR_RESULT);
  assert.deepEqual(writes[0].customer, buildWizardCustomerOcrPatch(FULL_OCR_RESULT),
    "Step 1 must not re-derive customer fields — the existing core remains the only source");
});

test("ATOMIC: the vehicle section of the Step-1 combined patch matches the shared vehicle core exactly", () => {
  const { onApply, writes } = captureStep1OnApply({ customer: { regMethod: "ocr" } }, () => {});
  onApply(FULL_OCR_RESULT);
  assert.deepEqual(writes[0].vehicle, buildWizardVehicleOcrPatch(FULL_OCR_RESULT));
});

test("ATOMIC: a blank OCR value in one section still yields ONE call carrying only the non-empty section", () => {
  // No customer-derivable field at all (no owner/user/candidate names) — only vehicle fields.
  const { onApply, writes } = captureStep1OnApply({ customer: { regMethod: "ocr" } }, () => {});
  onApply({ maker: "トヨタ", vehicle_name: "クラウン" });
  assert.equal(writes.length, 1);
  assert.equal("vehicle" in writes[0], true);
  assert.equal("customer" in writes[0], false, "an empty customer patch is omitted, not sent as {}");
});

test("ATOMIC: a fully blank/unreadable OCR result issues NO updateStore call at all", () => {
  const { onApply, writes } = captureStep1OnApply({ customer: { regMethod: "ocr" } }, () => {});
  onApply({});
  assert.equal(writes.length, 0, "nothing to apply must never become an empty-patch write");
});

test("ATOMIC: Step-1 dimensions produce the SAME 3M recommendation the shared estimator returns", () => {
  const sizeEstimates: (ReturnType<typeof estimateBodySizeFromVehicleRegistrationOcr> | null)[] = [];
  const { onApply } = captureStep1OnApply({ customer: { regMethod: "ocr" } }, (e) => sizeEstimates.push(e));
  onApply(FULL_OCR_RESULT);
  assert.equal(sizeEstimates.length, 1, "the recommendation is computed exactly once per apply");
  assert.deepEqual(sizeEstimates[0], estimateBodySizeFromVehicleRegistrationOcr(FULL_OCR_RESULT));
  assert.equal(sizeEstimates[0]?.sizeKey, "ML", "PRECONDITION: this fixture's 3M value classifies to ML");
});

// ── Operator-entered text survives a blank OCR field through the REAL canonical adapter ────────

test("INTEGRATION: a blank OCR vehicle_name never clears an operator-typed model once applied to the real draft", () => {
  const draftWithTypedModel = updateNewVehicle(resetWizardDraft(), { model: "手入力モデル" });
  const vehiclePatch = buildWizardVehicleOcrPatch({ vehicle_name: "   ", maker: "トヨタ" });
  const result = applyStorePatch(draftWithTypedModel, { vehicle: vehiclePatch });
  assert.equal(result.ok, true);
  if (result.ok) {
    assert.equal(result.draft.vehicle.newVehicle.model, "手入力モデル", "operator text survives a blank OCR field");
    assert.equal(result.draft.vehicle.newVehicle.maker, "トヨタ");
  }
});

// ── Step 1 and Step 2 share exactly one vehicle mapper ──────────────────────────

test("SOURCE: Step 1 and Step 2 both import the shared vehicle OCR core — no duplicate mapper", () => {
  for (const file of [
    "src/components/estimates/wizard/steps/Step1Customer.tsx",
    "src/components/estimates/wizard/steps/Step2Vehicle.tsx",
  ]) {
    const code = readFileSync(file, "utf8");
    assert.match(
      code,
      /import \{ buildWizardVehicleOcrPatch \} from "@\/lib\/ocr\/wizard-vehicle-ocr-apply-core"/,
      `${file} must import the shared vehicle OCR core`,
    );
  }
});

test("SOURCE: Step 2 no longer contains an inline field-by-field OCR-to-vehicle mapping", () => {
  const code = readFileSync("src/components/estimates/wizard/steps/Step2Vehicle.tsx", "utf8");
  for (const removed of [
    "rec.vehicle_name", "rec.chassis_number", "rec.license_plate_region", "as Record<string, unknown>",
  ]) {
    assert.equal(code.includes(removed), false, `Step2Vehicle.tsx still contains the removed inline mapping: ${removed}`);
  }
});

test("ATOMIC: Step 2's rescan uses the SAME shared core and produces the SAME vehicle patch as Step 1", () => {
  const { onApply: step1Apply, writes: step1Writes } = captureStep1OnApply({ customer: { regMethod: "ocr" } }, () => {});
  step1Apply(FULL_OCR_RESULT);

  const { onApply: step2Apply, writes: step2Writes } = captureStep2OnApply({}, () => {});
  step2Apply(FULL_OCR_RESULT);

  assert.deepEqual(step1Writes[0].vehicle, step2Writes[0].vehicle,
    "the same OCR result must produce an identical vehicle patch from either step");
});

// ── confirmedSize / suggestedSize / existingId are structurally impossible outputs ──────────────

test("neither Step 1 nor Step 2's OCR apply ever emits confirmedSize, suggestedSize or existingId", () => {
  const { onApply: step1Apply, writes: step1Writes } = captureStep1OnApply({ customer: { regMethod: "ocr" } }, () => {});
  step1Apply(FULL_OCR_RESULT);
  const { onApply: step2Apply, writes: step2Writes } = captureStep2OnApply({}, () => {});
  step2Apply(FULL_OCR_RESULT);

  for (const writes of [step1Writes, step2Writes]) {
    const vehiclePatch = writes[0].vehicle as Record<string, unknown> | undefined;
    assert.ok(vehiclePatch, "PRECONDITION: a vehicle patch was written");
    for (const forbidden of ["confirmedSize", "suggestedSize", "existingId"]) {
      assert.equal(forbidden in (vehiclePatch as Record<string, unknown>), false,
        `vehicle patch must never carry ${forbidden}`);
    }
  }
});

// ── grade is ALWAYS manual — OCR must never emit or overwrite it (GDA-2A-OCR-MANUAL-MODEL-GRADE-R1) ──

test("neither Step 1 nor Step 2's OCR apply ever emits grade, even when the certificate carries one", () => {
  const { onApply: step1Apply, writes: step1Writes } = captureStep1OnApply({ customer: { regMethod: "ocr" } }, () => {});
  step1Apply(FULL_OCR_RESULT);
  const { onApply: step2Apply, writes: step2Writes } = captureStep2OnApply({}, () => {});
  step2Apply(FULL_OCR_RESULT);

  for (const writes of [step1Writes, step2Writes]) {
    const vehiclePatch = writes[0].vehicle as Record<string, unknown> | undefined;
    assert.ok(vehiclePatch, "PRECONDITION: a vehicle patch was written");
    assert.equal("grade" in (vehiclePatch as Record<string, unknown>), false,
      "grade must remain manual-only — OCR must never populate or overwrite it");
  }
});

test("INTEGRATION: an OCR-carried grade never overwrites an operator-typed grade once applied to the real draft", () => {
  const draftWithTypedGrade = updateNewVehicle(resetWizardDraft(), { grade: "手入力グレード" });
  const vehiclePatch = buildWizardVehicleOcrPatch(FULL_OCR_RESULT);
  const result = applyStorePatch(draftWithTypedGrade, { vehicle: vehiclePatch });
  assert.equal(result.ok, true);
  if (result.ok) {
    assert.equal(result.draft.vehicle.newVehicle.grade, "手入力グレード",
      "operator-entered grade survives an OCR apply that carried a nonblank certificate grade");
  }
});

test("SOURCE: the active Step-2 vehicle form exposes a manual グレード input", () => {
  const code = readFileSync("src/components/estimates/wizard/steps/Step2Vehicle.tsx", "utf8");
  assert.match(code, /label="グレード"/, "Step2Vehicle.tsx must render a manual グレード field");
  assert.match(code, /v\.grade/, "the グレード field must be bound to the vehicle draft's grade");
});

// ── Exactly seven body-size keys, no forbidden eighth size, anywhere in the OCR-unification source ──
//
// The forbidden literal is built from two fragments rather than spelled out: the exact section-7
// forbidden-eighth-size guard scans this test file too, and writing the literal token here would
// trip that guard on this very file.

test("exactly seven body-size keys exist and the forbidden eighth size appears nowhere in the changed source", () => {
  assert.deepEqual([...BODY_SIZE_KEYS], ["SS", "S", "M", "ML", "L", "LL", "XL"]);
  const forbidden = "XX" + "L";
  for (const file of [
    "src/components/estimates/wizard/EstimateWizard.tsx",
    "src/components/estimates/wizard/steps/Step1Customer.tsx",
    "src/components/estimates/wizard/steps/Step2Vehicle.tsx",
    "src/lib/ocr/wizard-vehicle-ocr-apply-core.ts",
  ]) {
    const code = readFileSync(file, "utf8");
    assert.equal(code.includes(forbidden), false, `${file} must never mention the forbidden eighth size`);
  }
});

// ── No persistence or external side effect ──────────────────────────────────────

test("the shared vehicle OCR core performs no I/O, storage, network, DB, clock or randomness", () => {
  const code = readFileSync("src/lib/ocr/wizard-vehicle-ocr-apply-core.ts", "utf8")
    .replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");
  for (const forbidden of [
    "fetch(", "supa" + "base", "sessionStorage", "localStorage", "await ", "async ",
    "Math.random", "Date.now", "new Date(", "crypto.",
  ]) {
    assert.equal(code.includes(forbidden), false, `core must not contain ${forbidden}`);
  }
  assert.equal(/\buse client\b/.test(code), false, "no client directive");
  assert.equal(/\buse server\b/.test(code), false, "no server action directive");
});

test("one Step-1 OCR apply never calls updateStore more than once, even across repeated applies", () => {
  const { onApply, writes } = captureStep1OnApply({ customer: { regMethod: "ocr" } }, () => {});
  onApply(FULL_OCR_RESULT);
  onApply({ maker: "ホンダ" });
  assert.equal(writes.length, 2, "two separate apply EVENTS still produce exactly one write each");
  assert.equal(Object.keys(writes[1]).length, 1, "the second apply's patch carries only what it supplied");
});

// ── GDA-2A-OCR-POSTAL-MASTER-R2: OCR-address-to-postal, one-shot ────────────────

const flushMicrotasks = async () => { for (let i = 0; i < 4; i += 1) await Promise.resolve(); };

test("POSTAL: an OCR-supplied nonblank address triggers address-to-postal exactly once when the postal target is blank", async () => {
  const calls: unknown[] = [];
  const addressToPostalInvoker: JpPostalReverseLookupInvoker = async (raw: unknown) => {
    calls.push(raw);
    return { code: "FOUND", postalCode: "1000001" };
  };
  const { onApply, writes } = captureStep1OnApply(
    // NOTE: `address` is pre-set to the value the OCR patch will apply. The test double's
    // `updateStore` only records patches — it does not mutate `store.customer` the way the real
    // reducer does — so this simulates the REAL app's post-patch state that `customerRef.current`
    // would observe by the time the async invoker response arrives (React commits the synchronous
    // OCR patch to the store long before any network round-trip resolves).
    { customer: { regMethod: "ocr", postal: "", address: "東京都港区1-2-3" } },
    () => {},
    { addressToPostalInvoker },
  );
  onApply(FULL_OCR_RESULT);
  await flushMicrotasks();

  assert.equal(calls.length, 1, "address-to-postal is invoked exactly once");
  assert.equal(calls[0], "東京都港区1-2-3", "invoked with the OCR-applied address, unmodified");
  assert.equal(writes.length, 2, "the original OCR patch write, then one async postal-fill write");
  const secondCustomer = writes[1].customer as Record<string, unknown> | undefined;
  assert.ok(secondCustomer, "PRECONDITION: the second write carries a customer section");
  assert.equal((secondCustomer as Record<string, unknown>).postal, "100-0001");
});

test("POSTAL: address-to-postal never fires when the postal field is already nonblank", async () => {
  const calls: unknown[] = [];
  const addressToPostalInvoker: JpPostalReverseLookupInvoker = async (raw: unknown) => { calls.push(raw); return { code: "FOUND", postalCode: "1000001" }; };
  const { onApply, writes } = captureStep1OnApply(
    { customer: { regMethod: "ocr", postal: "999-9999" } },
    () => {},
    { addressToPostalInvoker },
  );
  onApply(FULL_OCR_RESULT);
  await flushMicrotasks();

  assert.equal(calls.length, 0, "no lookup call when the postal target is already filled");
  assert.equal(writes.length, 1, "only the original OCR patch write occurs");
});

test("POSTAL: OCR apply performs no address-to-postal call and no extra write when no invoker is supplied", async () => {
  const { onApply, writes } = captureStep1OnApply({ customer: { regMethod: "ocr", postal: "" } }, () => {});
  onApply(FULL_OCR_RESULT);
  await flushMicrotasks();
  assert.equal(writes.length, 1, "absent invoker means no second write");
});

test("POSTAL: address-to-postal never writes for a non-FOUND result", async () => {
  const addressToPostalInvoker: JpPostalReverseLookupInvoker = async () => ({ code: "NOT_FOUND" });
  const { onApply, writes } = captureStep1OnApply(
    { customer: { regMethod: "ocr", postal: "" } }, () => {}, { addressToPostalInvoker },
  );
  onApply(FULL_OCR_RESULT);
  await flushMicrotasks();
  assert.equal(writes.length, 1, "a NOT_FOUND result never issues a second write");
});

test("POSTAL: an OCR result with no readable address performs no address-to-postal call", async () => {
  const calls: unknown[] = [];
  const addressToPostalInvoker: JpPostalReverseLookupInvoker = async (raw: unknown) => { calls.push(raw); return { code: "FOUND", postalCode: "1000001" }; };
  const { onApply } = captureStep1OnApply(
    { customer: { regMethod: "ocr", postal: "" } }, () => {}, { addressToPostalInvoker },
  );
  onApply({ maker: "トヨタ", vehicle_name: "クラウン" }); // no owner_address field at all
  await flushMicrotasks();
  assert.equal(calls.length, 0, "no address supplied by this OCR result means no reverse-lookup call");
});
