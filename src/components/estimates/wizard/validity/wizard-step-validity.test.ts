// EST-WIZ-REQ-F1 — Behavioral proof of the navigation-validity contract.
//
// Run: node --import tsx --test src/components/estimates/wizard/validity/wizard-step-validity.test.ts
//
// Two halves, both required by the contract:
//   1. BEHAVIORAL — the pure predicates and transition resolvers are exercised over the
//      full Step-1/Step-2 state matrix, so R11 ("next() fails closed") and R13 ("jumpTo()
//      rejects a blocked forward target") are proven at the resolver level as
//      metadata.currentStep OUTCOMES, never as button-disabled assertions.
//   2. SOURCE-BOUNDARY — the hook, shell, host and Step 2 are proven to CONSUME the
//      resolvers (the established readFileSync guard pattern), so resolver behavior IS
//      canonical-step behavior. No hook-rendering dependency exists in this repo and
//      none is added.

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import {
  step1Valid, step2Valid, stepIsValid, willSaveExistingVehicle,
  firstUnmetStep, maxEnterableStep, resolveJump, resolveNext, normalizeRestoredStep,
  canAdvanceFrom, blockedReasonJa,
  EMPTY_NAVIGATION_REFERENCES,
  type WizardStepValidityInputs,
} from "./wizard-step-validity";
import { resetWizardDraft } from "../draft/wizard-draft-state";
import type { EstimateWizardDraftV22, CustomerRegistrationMethod } from "../draft/wizard-draft-types";
import type { StepId } from "../wizard-types";
import type {
  WizardExistingCustomerReference, WizardExistingVehicleReference,
} from "../contract/wizard-runtime-inputs";
import type { ServiceCategoryId } from "@/lib/estimates/service-categories";

// ── Fixtures (same shape as the existing-entity tests) ──────────────────────

const C1: WizardExistingCustomerReference = { id: "c-1", displayName: "山田太郎", phone: "090-0000-0001" };
const C2: WizardExistingCustomerReference = { id: "c-2", displayName: "鈴木花子", phone: "090-0000-0002" };
const CUSTOMERS = [C1, C2] as const;

const V1: WizardExistingVehicleReference = { id: "v-1", customerId: "c-1", displayName: "TOYOTA CROWN", plateNumber: "滋賀 330 に 1234", bodySize: "M" };
const V2: WizardExistingVehicleReference = { id: "v-2", customerId: "c-2", displayName: "HONDA FIT", plateNumber: "京都 500 は 5678", bodySize: "S" };
const VEHICLES = [V1, V2] as const;

type DraftOver = {
  regMethod?: CustomerRegistrationMethod;
  customerId?: string | null;
  name?: string;
  vSourceMode?: "existing" | "new" | null;
  vehicleId?: string | null;
  model?: string;
  maker?: string;
  plateNumber?: string;
  categories?: ServiceCategoryId[];
};

/** Compose a canonical draft. vehicle.sourceMode defaults to the production invariant
 *  (derived from vehicleId) but can be overridden to build DEGENERATE drafts. */
function draft(over: DraftOver = {}): EstimateWizardDraftV22 {
  const d = resetWizardDraft();
  const vehicleId = over.vehicleId ?? null;
  return {
    ...d,
    customer: {
      ...d.customer,
      registrationMethod: over.regMethod ?? "new",
      sourceMode: (over.regMethod ?? "new") === "search" ? "existing" : "new",
      customerId: over.customerId ?? null,
      newCustomer: { ...d.customer.newCustomer, name: over.name ?? "" },
    },
    vehicle: {
      ...d.vehicle,
      sourceMode: over.vSourceMode !== undefined ? over.vSourceMode : (vehicleId !== null ? "existing" : "new"),
      vehicleId,
      newVehicle: {
        ...d.vehicle.newVehicle,
        model: over.model ?? "",
        maker: over.maker ?? "",
        plate_number: over.plateNumber ?? "",
      },
    },
    serviceSelection: { selectedCategories: over.categories ?? [] },
  };
}

const inp = (
  d: EstimateWizardDraftV22,
  customers: readonly WizardExistingCustomerReference[] = CUSTOMERS,
  vehicles: readonly WizardExistingVehicleReference[] = VEHICLES,
): WizardStepValidityInputs => ({ draft: d, customers, vehicles });

const DUPE_CUSTOMERS = [C1, { ...C1, displayName: "別の山田" }, C2] as const;
const DUPE_VEHICLES = [V1, { ...V1, displayName: "別のクラウン" }, V2] as const;

// Fully valid seven-step draft: effective existing customer + vehicle + one category.
const allValid = () => draft({ regMethod: "search", customerId: "c-1", vehicleId: "v-1", categories: ["maintenance"] });

// ── Step 1 ──────────────────────────────────────────────────────────────────

test("step 1: new/ocr require a non-empty trimmed name", () => {
  for (const regMethod of ["new", "ocr"] as const) {
    assert.equal(step1Valid(inp(draft({ regMethod }))), false, `${regMethod}: empty name`);
    assert.equal(step1Valid(inp(draft({ regMethod, name: "   " }))), false, `${regMethod}: whitespace name`);
    assert.equal(step1Valid(inp(draft({ regMethod, name: "山田太郎" }))), true, `${regMethod}: name entered`);
  }
});

test("step 1: search requires a uniquely effective existing customer", () => {
  assert.equal(step1Valid(inp(draft({ regMethod: "search", customerId: "c-1" }))), true, "effective");
  assert.equal(step1Valid(inp(draft({ regMethod: "search", customerId: null }))), false, "no selection");
  assert.equal(step1Valid(inp(draft({ regMethod: "search", customerId: "c-999" }))), false, "absent id");
  assert.equal(step1Valid(inp(draft({ regMethod: "search", customerId: "c-1" }), DUPE_CUSTOMERS)), false, "ambiguous id");
});

test("step 1 REGRESSION: stale name text never satisfies search mode", () => {
  assert.equal(step1Valid(inp(draft({ regMethod: "search", customerId: "c-999", name: "残留テキスト" }))), false);
});

// ── Step 2 — the corrected matrix (S1–S4) ───────────────────────────────────

test("S1: new vehicle without a model is invalid", () => {
  assert.equal(step2Valid(inp(draft())), false);
  assert.equal(step2Valid(inp(draft({ model: "  " }))), false, "whitespace model");
});

test("S2: new vehicle with a trimmed model is valid", () => {
  assert.equal(step2Valid(inp(draft({ model: "クラウン" }))), true);
});

test("S2 REGRESSION: OCR-applied maker/plate WITHOUT a manually entered model stays invalid", () => {
  // The vehicle OCR apply path populates only maker and plate_number — never model.
  assert.equal(step2Valid(inp(draft({ maker: "トヨタ", plateNumber: "滋賀 330 に 1234" }))), false);
});

test("S3: an effective existing selection is valid regardless of stale model text", () => {
  const d = draft({ regMethod: "search", customerId: "c-1", vehicleId: "v-1", model: "残留モデル" });
  assert.equal(willSaveExistingVehicle(d), true);
  assert.equal(step2Valid(inp(d)), true);
});

test("S4: an INEFFECTIVE existing selection is invalid even with stale model text", () => {
  const stale = { model: "残留モデル" };
  const cases: Array<[string, EstimateWizardDraftV22, readonly WizardExistingCustomerReference[], readonly WizardExistingVehicleReference[]]> = [
    ["owner left search mode", draft({ regMethod: "new", name: "山田", vSourceMode: "existing", vehicleId: "v-1", ...stale }), CUSTOMERS, VEHICLES],
    ["owner id absent",        draft({ regMethod: "search", customerId: "c-999", vehicleId: "v-1", ...stale }), CUSTOMERS, VEHICLES],
    ["owner ambiguous",        draft({ regMethod: "search", customerId: "c-1", vehicleId: "v-1", ...stale }), DUPE_CUSTOMERS, VEHICLES],
    ["vehicle foreign-owned",  draft({ regMethod: "search", customerId: "c-1", vehicleId: "v-2", ...stale }), CUSTOMERS, VEHICLES],
    ["vehicle id absent",      draft({ regMethod: "search", customerId: "c-1", vehicleId: "v-999", ...stale }), CUSTOMERS, VEHICLES],
    ["vehicle ambiguous",      draft({ regMethod: "search", customerId: "c-1", vehicleId: "v-1", ...stale }), CUSTOMERS, DUPE_VEHICLES],
  ];
  for (const [label, d, customers, vehicles] of cases) {
    assert.equal(willSaveExistingVehicle(d), true, `${label}: would save as existing`);
    assert.equal(step2Valid(inp(d, customers, vehicles)), false, `${label}: must be invalid`);
  }
});

test("degenerate drafts fall to the NEW branch exactly as the save mapper does", () => {
  // sourceMode "new"/null with a non-null id → the mapper saves NEW → model gates validity.
  for (const vSourceMode of ["new", null] as const) {
    const noModel = draft({ vSourceMode, vehicleId: "v-1" });
    const withModel = draft({ vSourceMode, vehicleId: "v-1", model: "クラウン" });
    assert.equal(willSaveExistingVehicle(noModel), false);
    assert.equal(step2Valid(inp(noModel)), false, `${String(vSourceMode)}: no model`);
    assert.equal(step2Valid(inp(withModel)), true, `${String(vSourceMode)}: model entered`);
  }
});

test("F2-R1: the discriminator is TRUTHY — an empty-string vehicleId falls to the NEW branch", () => {
  // The save mapper tests `sourceMode === "existing" && v.vehicleId` (truthy), so an
  // empty string must fall to the new branch HERE too, or the two would disagree.
  const emptyId = draft({ vSourceMode: "existing", vehicleId: "" });
  assert.equal(willSaveExistingVehicle(emptyId), false, "matches the mapper's truthy test");
  assert.equal(step2Valid(inp(emptyId)), false, "new branch without a model");
  assert.equal(step2Valid(inp(draft({ vSourceMode: "existing", vehicleId: "", model: "クラウン" }))), true,
    "new branch gates on the model");
});

test("F2-R1: canAdvanceFrom mirrors resolveNext exactly", () => {
  const ok = inp(allValid());
  assert.equal(canAdvanceFrom(1, ok), true);
  assert.equal(canAdvanceFrom(7, ok), false, "terminal step never advances");
  assert.equal(canAdvanceFrom(1, inp(draft())), false, "invalid current step");
  const poisoned = inp(draft({ model: "クラウン" })); // step 2 valid, step 1 invalid
  assert.equal(stepIsValid(2, poisoned), true, "PRECONDITION: the current step itself is valid");
  assert.equal(canAdvanceFrom(2, poisoned), false, "an earlier unmet prerequisite still blocks");
});

test("F2-R1: blockedReasonJa — null when advancable or terminal; names the FIRST unmet step", () => {
  const ok = inp(allValid());
  assert.equal(blockedReasonJa(1, ok), null, "advancable → no reason");
  assert.equal(blockedReasonJa(7, ok), null, "step 7 has no forward action");

  assert.equal(blockedReasonJa(1, inp(draft())), "お客様名が未入力です。", "new/ocr customer");
  assert.equal(blockedReasonJa(1, inp(draft({ regMethod: "search" }))), "お客様が選択されていません。", "search customer");
  assert.equal(blockedReasonJa(2, inp(draft({ name: "山田" }))), "車名が未入力です。", "new vehicle");
  assert.equal(
    blockedReasonJa(2, inp(draft({ regMethod: "search", customerId: "c-999", vehicleId: "v-1" }))),
    "お客様が選択されていません。",
    "the FIRST unmet step (1) wins even while standing on step 2",
  );
  assert.equal(
    blockedReasonJa(2, inp(draft({ regMethod: "search", customerId: "c-1", vehicleId: "v-999" }))),
    "車両が選択されていません。",
    "ineffective existing selection",
  );
  assert.equal(blockedReasonJa(3, inp(draft({ name: "山田", model: "クラウン" }))), "サービスが1件も選択されていません。");
  assert.equal(blockedReasonJa(5, inp(draft({ name: "山田", model: "クラウン", categories: ["maintenance"] }))), null,
    "all prerequisites met mid-wizard");
  assert.equal(blockedReasonJa(5, inp(draft({ model: "クラウン", categories: ["maintenance"] }))), "お客様名が未入力です。",
    "blocked at a later step by an earlier prerequisite");
});

test("fail-closed default references: an existing selection is never effective", () => {
  const d = draft({ regMethod: "search", customerId: "c-1", vehicleId: "v-1" });
  assert.equal(step2Valid({ draft: d, ...EMPTY_NAVIGATION_REFERENCES }), false);
  assert.equal(step1Valid({ draft: d, ...EMPTY_NAVIGATION_REFERENCES }), false);
});

// ── Steps 3–7 ───────────────────────────────────────────────────────────────

test("step 3 requires one selected category; steps 4–6 and 7 carry no own requirement", () => {
  const empty = inp(draft());
  assert.equal(stepIsValid(3, empty), false);
  assert.equal(stepIsValid(3, inp(draft({ categories: ["maintenance"] }))), true);
  for (const s of [4, 5, 6, 7] as StepId[]) {
    assert.equal(stepIsValid(s, empty), true, `step ${s} has no invented requirement`);
  }
});

// ── firstUnmetStep / maxEnterableStep ───────────────────────────────────────

test("maxEnterableStep is the first unmet step (operator may stand ON it, never beyond)", () => {
  assert.equal(firstUnmetStep(inp(allValid())), null);
  assert.equal(maxEnterableStep(inp(allValid())), 7);

  assert.equal(maxEnterableStep(inp(draft())), 1, "step 1 unmet → only step 1");
  assert.equal(maxEnterableStep(inp(draft({ name: "山田" }))), 2, "step 2 unmet → up to step 2");
  assert.equal(maxEnterableStep(inp(draft({ name: "山田", model: "クラウン" }))), 3, "step 3 unmet → up to step 3");
});

// ── R13 — resolveJump ───────────────────────────────────────────────────────

test("R13: backward navigation is ALWAYS allowed, even over invalid steps", () => {
  const empty = inp(draft());
  assert.equal(resolveJump(5, 2, empty), 2);
  assert.equal(resolveJump(5, 5, empty), 5, "same step is a no-op");
  assert.equal(resolveJump(7, 1, empty), 1);
});

test("R13: a blocked forward target leaves the current step UNCHANGED (no partial advance)", () => {
  const i = inp(draft({ name: "山田" })); // steps: 1 valid, 2 unmet → maxEnterable 2
  assert.equal(resolveJump(1, 2, i), 2, "the first unmet step itself is enterable");
  assert.equal(resolveJump(1, 3, i), 1, "beyond it is rejected, not clamped forward");
  assert.equal(resolveJump(2, 7, i), 2, "a far jump is rejected outright");
});

test("R13: an allowed forward jump proceeds; junk targets clamp fail-closed", () => {
  const ok = inp(allValid());
  assert.equal(resolveJump(1, 7, ok), 7, "all prerequisites met");
  assert.equal(resolveJump(3, 99, ok), 7, "over-range clamps to the last step");
  assert.equal(resolveJump(3, -4, ok), 1, "under-range clamps to the first step (backward)");
  assert.equal(resolveJump(3, Number.NaN, ok), 1, "NaN clamps to the first step");
});

// ── R11 — resolveNext ───────────────────────────────────────────────────────

test("R11: next() fails closed on an invalid current step", () => {
  assert.equal(resolveNext(1, inp(draft())), 1, "invalid step 1 does not advance");
  assert.equal(resolveNext(2, inp(draft({ name: "山田" }))), 2, "invalid step 2 does not advance");
});

test("R11: next() also fails closed when an EARLIER step became invalid", () => {
  // Standing on a valid step 2 whose step-1 prerequisite has been invalidated.
  const i = inp(draft({ model: "クラウン" })); // step 2 valid (new+model), step 1 invalid (no name)
  assert.equal(stepIsValid(2, i), true, "PRECONDITION: step 2 itself is valid");
  assert.equal(resolveNext(2, i), 2, "the poisoned prefix blocks the advance");
});

test("R11: a valid current step advances by exactly one; step 7 has no forward action", () => {
  const ok = inp(allValid());
  assert.equal(resolveNext(1, ok), 2);
  assert.equal(resolveNext(6, ok), 7);
  assert.equal(resolveNext(7, ok), 7, "terminal step never advances");
});

test("S4 END-TO-END: stale model text cannot ride an ineffective existing id through next()", () => {
  const s4 = inp(draft({ regMethod: "search", customerId: "c-999", vehicleId: "v-1", model: "残留モデル" }));
  assert.equal(resolveNext(2, s4), 2);
  assert.equal(resolveJump(2, 3, s4), 2);
});

// ── Restored-step normalization ─────────────────────────────────────────────

test("a restored later step normalizes to its first unmet prerequisite", () => {
  assert.equal(normalizeRestoredStep(7, inp(draft({ name: "山田" }))), 2);
  assert.equal(normalizeRestoredStep(5, inp(allValid())), 5, "nothing unmet → restored step kept");
  assert.equal(normalizeRestoredStep(0, inp(allValid())), 1, "clamped");
  assert.equal(normalizeRestoredStep(99, inp(draft())), 1, "clamped then normalized");
});

// ── Source-boundary assertions — the runtime CONSUMES the resolvers ─────────

const codeOf = (p: string): string =>
  readFileSync(p, "utf8").replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");

test("useEstimateWizard routes next/jumpTo through the resolvers — never a bare increment", () => {
  const hook = codeOf("src/components/estimates/wizard/useEstimateWizard.ts");
  assert.match(hook, /from "\.\/validity\/wizard-step-validity"/, "imports the validity module");
  assert.match(hook, /resolveNext\(/, "next() resolves through resolveNext");
  assert.match(hook, /resolveJump\(/, "jumpTo() resolves through resolveJump");
  assert.match(hook, /normalizeRestoredStep\(/, "the restored step is normalized at init");
  assert.match(hook, /canAdvance: canAdvanceFrom\(step, validity\)/, "canAdvance is the resolver-mirroring helper");
  assert.match(hook, /blockedReasonJa: blockedReasonJa\(step, validity\)/, "the blocked reason comes from the pure helper");
  assert.equal(hook.includes("currentStep + 1"), false, "no bare forward increment remains");
});

test("WizardShell pairs the disabled states with the SAME validity the resolvers enforce", () => {
  const shell = codeOf("src/components/estimates/wizard/WizardShell.tsx");
  assert.match(shell, /disabled=\{api\.isLast \|\| !api\.canAdvance\}/,
    "Next pairs with canAdvance — never current-step validity alone");
  assert.equal(shell.includes("currentStepValid"), false, "current-step validity alone no longer drives the UI");
  assert.match(shell, /s\.id > step && s\.id > maxEnterableStep/,
    "only targets FORWARD of the current step can be blocked — never the current step or a backward target");
  assert.match(shell, /aria-live="polite"/, "the blocked reason renders in a polite live region");
  assert.match(shell, /\{api\.blockedReasonJa\}/, "the reason text is the hook's blockedReasonJa");
});

test("F2-R1: checkmarks derive from steps BEHIND the operator via stepIsValid only", () => {
  const hook = codeOf("src/components/estimates/wizard/useEstimateWizard.ts");
  assert.match(hook, /s\.id < step && stepIsValid\(s\.id, validity\)/,
    "completed = behind-the-operator AND authoritative validity");
  assert.equal(hook.includes("notesCustomer"), false, "the notes-content completion heuristic is removed");
});

test("the host passes the reference arrays into the hook as navigation inputs", () => {
  const host = codeOf("src/components/estimates/wizard/EstimateWizard.tsx");
  assert.match(host, /useEstimateWizard\(\s*preselectionStorePatch\([\s\S]*?\),\s*\{ customers, vehicles \},?\s*\)/,
    "the hook receives { customers, vehicles }");
});

test("Step 2 renders the ineffective-selection recovery surface and writes narrow patches", () => {
  const step2 = readFileSync("src/components/estimates/wizard/steps/Step2Vehicle.tsx", "utf8");
  assert.match(step2, /data-testid="ineffective-existing-vehicle-recovery"/, "the recovery card exists");
  assert.match(step2, /data-testid="ineffective-existing-vehicle-clear"/, "with an operable clear action");
  assert.match(step2, /onClick=\{\(\) => setExistingVehicle\(null\)\}/, "the action clears via the one-key patch");
  assert.equal(/updateStore\(\{ vehicle: \{ \.\.\.v/.test(step2), false,
    "setV no longer spreads the full vehicle projection (identity is never re-asserted by a field edit)");
});

test("the validity module is pure — no React, fetch, storage or async", () => {
  const code = codeOf("src/components/estimates/wizard/validity/wizard-step-validity.ts");
  for (const forbidden of ["react", "fetch(", "localStorage", "sessionStorage", "await ", "async "]) {
    assert.equal(code.includes(forbidden), false, `validity module must not contain ${forbidden}`);
  }
});
