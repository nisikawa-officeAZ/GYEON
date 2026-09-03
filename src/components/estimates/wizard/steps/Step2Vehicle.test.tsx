// GDA_ESTIMATE_WIZARD_OCR_CHASSIS_UI_R6_IMPLEMENTATION — proof that the active Step-2
// new-vehicle form renders one editable 車台番号 field bound to v.vin, that editing it
// emits exactly { vehicle: { vin: "<value>" } } with no unrelated key, and that the
// existing OCR-apply contract still preserves a nonblank operator VIN when the
// certificate's chassis_number is blank.
//
// Run: node --import tsx --test src/components/estimates/wizard/steps/Step2Vehicle.test.tsx
//
// TEST SEAM: same convention as estimate-wizard-ocr-apply.test.tsx — this repo's
// "jsx: preserve compiles to a GLOBAL React.createElement" convention is reused to
// capture the REAL production `<Field label="車台番号">…<TextInput .../></Field>`
// element pair produced during a render pass, by temporarily swapping
// `globalThis.React` for a thin wrapper around the real React.createElement. The
// child TextInput element (already fully constructed as a plain object by the time
// its parent Field element is created, since JSX evaluates children before parents)
// is located by identity comparison against the imported TextInput reference —
// never by DOM traversal, snapshot text-matching, or a rewritten production export.
//
// No DB, no network, no storage, no save.

import { test } from "node:test";
import assert from "node:assert/strict";
import * as React from "react";
import { renderToStaticMarkup } from "react-dom/server";

import { Step2Vehicle } from "./Step2Vehicle";
import { Field, TextInput } from "../ui";
import type { EstimateWizardApi } from "../useEstimateWizard";
import type { WizardStore } from "../wizard-types";
import { initialWizardStore } from "../wizard-types";
import { resetWizardDraft, updateNewVehicle } from "../draft/wizard-draft-state";
import { applyStorePatch, type WizardStorePatch } from "../bridge/ew-ui1-controller";
import { buildWizardVehicleOcrPatch } from "@/lib/ocr/wizard-vehicle-ocr-apply-core";

// `jsx: "preserve"` compiles JSX to React.createElement against a global React (see file header).
(globalThis as { React?: typeof React }).React = React;

// ── Test double: a controlled fake api recording every updateStore call ────────

type StoreOver = { vehicle?: Partial<WizardStore["vehicle"]> };

function fakeApi(over: StoreOver = {}): { api: EstimateWizardApi; writes: WizardStorePatch[] } {
  const base = initialWizardStore();
  const store: WizardStore = {
    ...base,
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

// ── Test seam: capture the real 車台番号 TextInput's { value, onChange } during a render ──

interface CapturedVinField {
  value: string;
  onChange: (v: string) => void;
}

function captureVinField(renderFn: () => string): CapturedVinField {
  const realReact = React;
  let captured: CapturedVinField | null = null;
  const patchedReact = {
    ...realReact,
    createElement(type: unknown, props: Record<string, unknown> | null, ...children: unknown[]) {
      if (type === Field && props && (props as { label?: unknown }).label === "車台番号") {
        for (const child of children) {
          if (
            child !== null &&
            typeof child === "object" &&
            (child as { type?: unknown }).type === TextInput
          ) {
            const childProps = (child as { props: Record<string, unknown> }).props;
            captured = {
              value: childProps.value as string,
              onChange: childProps.onChange as (v: string) => void,
            };
          }
        }
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
  if (!captured) throw new Error("車台番号 field was not captured during render");
  return captured;
}

function renderStep2(over: StoreOver = {}): { field: CapturedVinField; writes: WizardStorePatch[] } {
  const { api, writes } = fakeApi(over);
  const field = captureVinField(() => renderToStaticMarkup(
    React.createElement(Step2Vehicle, { api, customers: [], vehicles: [] }),
  ));
  return { field, writes };
}

// ── Rendering ────────────────────────────────────────────────────────────────

test("車台番号 field renders with the current vehicle.vin value", () => {
  const { field } = renderStep2({ vehicle: { vin: "ABC-1234567" } });
  assert.equal(field.value, "ABC-1234567");
});

test("車台番号 field reflects an OCR-populated vin value", () => {
  const { field } = renderStep2({ vehicle: { vin: "OCR-9999999" } });
  assert.equal(field.value, "OCR-9999999");
});

test("車台番号 field renders blank when vin is unset", () => {
  const { field } = renderStep2();
  assert.equal(field.value, "");
});

// ── Editing emits exactly one key ───────────────────────────────────────────

test("editing 車台番号 emits exactly { vehicle: { vin: '<value>' } }", () => {
  const { field, writes } = renderStep2({ vehicle: { vin: "" } });
  field.onChange("NEW-VIN-0001");
  assert.equal(writes.length, 1, "exactly one api.updateStore call for one edit");
  assert.deepEqual(writes[0], { vehicle: { vin: "NEW-VIN-0001" } });
});

test("editing 車台番号 emits no unrelated vehicle key (maker/model/vehicleCode/grade/displacement/plateNumber/confirmedSize/existingId)", () => {
  const { field, writes } = renderStep2({
    vehicle: {
      vin: "",
      maker: "トヨタ",
      model: "クラウン",
      vehicleCode: "ABA-XXX",
      grade: "RS",
      displacement: "1998cc",
      plateNumber: "滋賀 330 に 1234",
      confirmedSize: "M",
    },
  });
  field.onChange("ANOTHER-VIN");
  assert.equal(writes.length, 1);
  const vehiclePatch = writes[0].vehicle as Record<string, unknown>;
  assert.deepEqual(Object.keys(vehiclePatch), ["vin"], "the patch must carry only the edited key");
});

// ── Existing OCR-apply contract: blank certificate chassis data never erases operator VIN ──

test("INTEGRATION: a blank OCR chassis_number never clears an operator-typed vin once applied to the real draft", () => {
  const draftWithTypedVin = updateNewVehicle(resetWizardDraft(), { vin: "手入力車台番号" });
  const vehiclePatch = buildWizardVehicleOcrPatch({ chassis_number: "   ", maker: "トヨタ" });
  const result = applyStorePatch(draftWithTypedVin, { vehicle: vehiclePatch });
  assert.equal(result.ok, true);
  if (result.ok) {
    assert.equal(result.draft.vehicle.newVehicle.vin, "手入力車台番号", "operator VIN survives a blank OCR chassis_number");
    assert.equal(result.draft.vehicle.newVehicle.maker, "トヨタ");
  }
});

test("INTEGRATION: a nonblank OCR chassis_number fills an empty operator vin through the real draft", () => {
  const emptyDraft = resetWizardDraft();
  const vehiclePatch = buildWizardVehicleOcrPatch({ chassis_number: "XYZ-7654321" });
  const result = applyStorePatch(emptyDraft, { vehicle: vehiclePatch });
  assert.equal(result.ok, true);
  if (result.ok) {
    assert.equal(result.draft.vehicle.newVehicle.vin, "XYZ-7654321");
  }
});
