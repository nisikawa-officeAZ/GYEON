// GDA-ESTIMATE-REVIEW-DISPLAY-R1 — focused Step 7 display-resolution tests.
//
// Step7Review resolves existing-entity labels at render time through the SAME pure
// authorities the selection steps use (effectiveExistingCustomer /
// effectiveExistingVehicle) against the server-supplied reference arrays. These
// tests pin the display contract: a resolved existing selection shows ONLY the
// server-composed displayName, new entries keep their draft-field display, and any
// claimed reference that fails to resolve (missing, stale, duplicate/ambiguous, or
// owned by another customer) fails closed to the em dash. Resolution is display
// only — the supplied store/draft must never be mutated.
//
// Rendering is pure: renderToStaticMarkup needs no DOM, no session, no storage.

import React from "react";
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { renderToStaticMarkup } from "react-dom/server";

// Test-only classic JSX shim used by the repository's other TSX render tests.
(globalThis as unknown as { React: typeof React }).React = React;

import { Step7Review } from "./Step7Review";
import { applyServiceLineAdjustmentPatch, type EstimateWizardApi, type ServiceLineAdjustmentPatch } from "../useEstimateWizard";
import type { WizardReviewDraft } from "../draft/wizard-draft-types";
import type {
  WizardExistingCustomerReference,
  WizardExistingVehicleReference,
} from "../contract/wizard-runtime-inputs";
import { EMPTY_WIZARD_PRICING_RESULT, type WizardPricingResult } from "../pricing/wizard-pricing-types";
import type { WizardSaveBinding } from "../save/WizardSavePanel";
import { initializeWizardSession, type WizardSessionDeps } from "../save/wizard-idempotency-session";

const CUSTOMERS: readonly WizardExistingCustomerReference[] = [
  { id: "c1", displayName: "山田 太郎 様", phone: "09011112222" },
  { id: "c2", displayName: "佐藤 花子 様", phone: null },
];

const VEHICLES: readonly WizardExistingVehicleReference[] = [
  { id: "v1", customerId: "c1", displayName: "トヨタ プリウス（品川 300 あ 12-34）", plateNumber: "品川 300 あ 12-34", bodySize: "M" },
  { id: "v2", customerId: "c2", displayName: "ホンダ フィット", plateNumber: null, bodySize: null },
];

// Exactly the fields Step 7 reads from the store projection. Draft fields are
// deliberately populated in most cases to prove resolution never falls back to
// them for a claimed existing reference.
type Step7Store = {
  customer: { regMethod: "new" | "ocr" | "search"; existingId: string | null; name: string };
  vehicle: { existingId: string | null; maker: string; model: string };
  categories: string[];
};

function storeWith(overrides: Partial<Step7Store> = {}): Step7Store {
  return {
    customer: { regMethod: "new", existingId: null, name: "", ...overrides.customer },
    vehicle: { existingId: null, maker: "", model: "", ...overrides.vehicle },
    categories: overrides.categories ?? [],
  };
}

// Step 7 reads only api.store (api.draft feeds the OPTIONAL save panel, absent in
// every test here), so a minimal projection stands in for the full hook.
function apiFor(store: Step7Store): EstimateWizardApi {
  return {
    store,
    draft: { review: { serviceLineOrder: [], quantityInputsByLine: {}, unitPriceInputsByLine: {} } },
    setServiceLineOrder: () => undefined,
    setServiceLineAdjustment: () => undefined,
  } as unknown as EstimateWizardApi;
}

function renderStep(
  store: Step7Store,
  customers: readonly WizardExistingCustomerReference[] = CUSTOMERS,
  vehicles: readonly WizardExistingVehicleReference[] = VEHICLES,
): string {
  return renderToStaticMarkup(
    <Step7Review api={apiFor(store)} customers={customers} vehicles={vehicles} pricing={EMPTY_WIZARD_PRICING_RESULT} />,
  );
}

/** The <dd> text rendered next to a summary label (顧客 / 車両 / 作業). */
function rowValue(html: string, label: string): string {
  const match = html.match(new RegExp(`>${label}</dt><dd>([^<]*)</dd>`));
  if (match === null) throw new Error(`summary row not found: ${label}`);
  return match[1];
}

function deepFreeze<T>(value: T): T {
  if (value !== null && typeof value === "object") {
    for (const v of Object.values(value)) deepFreeze(v);
    Object.freeze(value);
  }
  return value;
}

describe("Step7Review — existing selections render the server displayName only", () => {
  it("shows the server-composed customer and vehicle displayName, never draft fields", () => {
    const html = renderStep(storeWith({
      customer: { regMethod: "search", existingId: "c1", name: "下書きの名前" },
      vehicle: { existingId: "v1", maker: "下書きメーカー", model: "下書きモデル" },
    }));
    assert.equal(rowValue(html, "顧客"), "山田 太郎 様");
    assert.equal(rowValue(html, "車両"), "トヨタ プリウス（品川 300 あ 12-34）");
    // The draft CREATE fields must not leak into an existing selection's label.
    assert.ok(!html.includes("下書きの名前"));
    assert.ok(!html.includes("下書きメーカー"));
    assert.ok(!html.includes("下書きモデル"));
  });
});

describe("Step7Review — new entries keep their draft-field display", () => {
  it("renders the draft customer name and maker/model when nothing existing is claimed", () => {
    const html = renderStep(storeWith({
      customer: { regMethod: "new", existingId: null, name: "新規 顧客" },
      vehicle: { existingId: null, maker: "スバル", model: "レヴォーグ" },
    }));
    assert.equal(rowValue(html, "顧客"), "新規 顧客");
    assert.equal(rowValue(html, "車両"), "スバル レヴォーグ");
  });
});

describe("Step7Review — unresolvable claimed references fail closed to the em dash", () => {
  it("missing/stale existing customer id renders — and never the new-customer draft name", () => {
    const html = renderStep(storeWith({
      customer: { regMethod: "search", existingId: "gone", name: "下書きの名前" },
    }));
    assert.equal(rowValue(html, "顧客"), "—");
    assert.ok(!html.includes("下書きの名前"));
  });

  it("duplicate/ambiguous customer id renders — rather than picking either row", () => {
    const duplicated: readonly WizardExistingCustomerReference[] = [
      { id: "dup", displayName: "一人目 様", phone: null },
      { id: "dup", displayName: "二人目 様", phone: null },
    ];
    const html = renderStep(
      storeWith({ customer: { regMethod: "search", existingId: "dup", name: "" } }),
      duplicated,
    );
    assert.equal(rowValue(html, "顧客"), "—");
    assert.ok(!html.includes("一人目 様"));
    assert.ok(!html.includes("二人目 様"));
  });

  it("missing/stale claimed vehicle id renders — and never the draft maker/model", () => {
    const html = renderStep(storeWith({
      customer: { regMethod: "search", existingId: "c1", name: "" },
      vehicle: { existingId: "ghost", maker: "下書きメーカー", model: "下書きモデル" },
    }));
    assert.equal(rowValue(html, "車両"), "—");
    assert.ok(!html.includes("下書きメーカー"));
  });

  it("duplicate/ambiguous vehicle id renders — rather than picking either row", () => {
    const duplicated: readonly WizardExistingVehicleReference[] = [
      { id: "vdup", customerId: "c1", displayName: "一台目", plateNumber: null, bodySize: null },
      { id: "vdup", customerId: "c1", displayName: "二台目", plateNumber: null, bodySize: null },
    ];
    const html = renderStep(
      storeWith({
        customer: { regMethod: "search", existingId: "c1", name: "" },
        vehicle: { existingId: "vdup", maker: "", model: "" },
      }),
      CUSTOMERS,
      duplicated,
    );
    assert.equal(rowValue(html, "車両"), "—");
    assert.ok(!html.includes("一台目"));
    assert.ok(!html.includes("二台目"));
  });

  it("a vehicle owned by another customer renders — even though the id exists", () => {
    const html = renderStep(storeWith({
      customer: { regMethod: "search", existingId: "c1", name: "" },
      // v2 belongs to c2, not the effective customer c1.
      vehicle: { existingId: "v2", maker: "下書きメーカー", model: "" },
    }));
    assert.equal(rowValue(html, "車両"), "—");
    assert.ok(!html.includes("ホンダ フィット"));
  });

  it("a claimed vehicle under an unresolved customer renders — for both rows", () => {
    const html = renderStep(storeWith({
      customer: { regMethod: "search", existingId: "gone", name: "" },
      vehicle: { existingId: "v1", maker: "", model: "" },
    }));
    assert.equal(rowValue(html, "顧客"), "—");
    assert.equal(rowValue(html, "車両"), "—");
    assert.ok(!html.includes("トヨタ プリウス"));
  });
});

describe("Step7Review — service categories use the canonical Japanese labels", () => {
  it("renders every known category id as its canonical label, other as その他作業", () => {
    const html = renderStep(storeWith({
      categories: ["coating", "ppf", "window", "maintenance", "carwash", "roomclean", "other"],
    }));
    assert.equal(
      rowValue(html, "作業"),
      "ボディコーティング / PPF / ウィンドウフィルム / ボディ定期メンテナンス / メンテナンス洗車 / ルームクリーニング / その他作業",
    );
  });

  it("renders other alone as その他作業", () => {
    const html = renderStep(storeWith({ categories: ["other"] }));
    assert.equal(rowValue(html, "作業"), "その他作業");
  });
});

describe("Step7Review — canonical line-order controls stay inside the responsive card", () => {
  it("renders persisted order with fixed controls and no wide table", () => {
    const pricing = {
      ...EMPTY_WIZARD_PRICING_RESULT,
      lines: [
        {
          kind: "catalog" as const, category: "coating", sourceId: "coating:PURE EVO", label: "PURE EVO",
          quantity: 1, unitPrice: 80_000, lineSubtotal: 80_000, discountAmount: null, taxAmount: null,
          lineTotal: 80_000, pricingReferenceId: "pure-evo", catalogLineRole: "base" as const,
        },
        {
          kind: "manual" as const, category: "maintenance", sourceId: "maintenance:mm1", label: "メンテナンス",
          quantity: 1, unitPrice: 5_000, lineSubtotal: 5_000, discountAmount: null, taxAmount: null,
          lineTotal: 5_000, pricingReferenceId: null, catalogLineRole: null,
        },
      ],
    };
    const api = {
      ...apiFor(storeWith()),
      draft: {
        review: {
          serviceLineOrder: ["manual:maintenance:mm1", "catalog:coating:base:pure-evo"],
          quantityInputsByLine: { "catalog:coating:base:pure-evo": "2" },
          unitPriceInputsByLine: {},
        },
      },
    } as unknown as EstimateWizardApi;
    const html = renderToStaticMarkup(
      <Step7Review api={api} customers={CUSTOMERS} vehicles={VEHICLES} pricing={pricing} />,
    );
    assert.ok(html.indexOf("メンテナンス") < html.indexOf("PURE EVO"), "saved order is rendered");
    assert.match(html, /明細の詳細/);
    assert.match(html, /md:grid-cols-\[minmax\(0,1fr\)_6rem_8rem_auto\]/);
    // one editable quantity + unit-price pair per line, keyed by the stable line identity
    assert.match(html, /aria-label="メンテナンスの数量"[^>]*value="1"/);
    assert.match(html, /aria-label="メンテナンスの金額（単価）"[^>]*value="5000"/);
    assert.match(html, /aria-label="PURE EVOの数量"[^>]*value="2"/, "draft text wins over the priced quantity");
    assert.match(html, /aria-label="PURE EVOの金額（単価）"[^>]*value="80000"/);
    assert.equal((html.match(/の数量"/g) ?? []).length, 2, "exactly one quantity input per line");
    assert.match(html, /aria-label="メンテナンスを上へ"/);
    assert.match(html, /aria-label="PURE EVOを下へ"/);
    assert.doesNotMatch(html, /<table/);
  });
});

// ── GDA-ESTIMATE-SAVE-PRICING-GUARD-R1 — Step 7 hands the SAME pricing result to the save panel ──
describe("Step7Review — the save panel is gated by the pricing result Step 7 displays", () => {
  function binding(): WizardSaveBinding {
    const map = new Map<string, string>();
    const deps: WizardSessionDeps = {
      storage: { getItem: (k) => map.get(k) ?? null, setItem: (k, v) => { map.set(k, v); } },
      crypto: { getRandomValues(a: Uint8Array): Uint8Array { a.fill(0x1a); return a; } },
    };
    const init = initializeWizardSession(deps, () => {});
    if (!init.ok) throw new Error("fixture: initialization must succeed");
    return {
      expectedConfigRevision: 1,
      saveInvoker: async () => { throw new Error("must not be invoked by a render"); },
      session: init.session,
      sessionDeps: deps,
      onCompleted: () => undefined,
    };
  }
  const line = {
    kind: "catalog" as const, category: "coating", sourceId: "coating:PURE EVO", label: "PURE EVO",
    quantity: 1, unitPrice: 80_000, lineSubtotal: 80_000, discountAmount: null, taxAmount: null,
    lineTotal: 80_000, pricingReferenceId: "pure-evo", catalogLineRole: "base" as const,
  };
  const ppfIssue = { code: "PPF_R1_SETTINGS_REQUIRED", category: "ppf", sourceId: null, message: "PPFの正式価格表が未設定です。設定画面で価格を保存してください。" };

  it("priced coating + PPF configuration error: no Save/PDF controls, the reason is visible, no internal code", () => {
    const pricing: WizardPricingResult = {
      ...EMPTY_WIZARD_PRICING_RESULT, status: "success", completeness: "partial", lines: [line],
      subtotal: 80_000, grandTotal: 88_000, errors: [ppfIssue],
    };
    const html = renderToStaticMarkup(
      <Step7Review api={apiFor(storeWith({ categories: ["coating", "ppf"] }))} customers={CUSTOMERS} vehicles={VEHICLES} pricing={pricing} saveBinding={binding()} />,
    );
    assert.ok(html.includes("wizard-save-panel"), "PRECONDITION: the panel rendered");
    assert.equal(html.includes('data-testid="save-submit"'), false);
    assert.equal(html.includes('data-testid="save-submit-pdf"'), false);
    assert.ok(html.includes("save-state-pricing-incomplete"));
    assert.ok(html.includes(ppfIssue.message), "concrete pricing/configuration reason visible");
    assert.equal(html.includes("PPF_R1_SETTINGS_REQUIRED"), false, "internal code never rendered");
  });

  it("complete clean pricing keeps the fresh Save / Save-and-PDF controls", () => {
    const pricing: WizardPricingResult = {
      ...EMPTY_WIZARD_PRICING_RESULT, status: "success", completeness: "complete", lines: [line],
      subtotal: 80_000, discountTotal: 0, taxableSubtotal: 80_000, taxTotal: 8_000, grandTotal: 88_000,
    };
    const html = renderToStaticMarkup(
      <Step7Review api={apiFor(storeWith({ categories: ["coating"] }))} customers={CUSTOMERS} vehicles={VEHICLES} pricing={pricing} saveBinding={binding()} />,
    );
    assert.ok(html.includes('data-testid="save-submit"'));
    assert.ok(html.includes('data-testid="save-submit-pdf"'));
    assert.equal(html.includes("save-state-pricing-incomplete"), false);
    // GDA-ESTIMATE-PR123-R2: the future customer-product action sits beside save/PDF, disabled, no mutation.
    assert.match(html, /data-testid="add-customer-product"[^>]*disabled/);
  });
});

describe("Step7Review — display resolution never mutates its inputs", () => {
  it("renders against deep-frozen store, draft and reference arrays without writing to them", () => {
    const store = deepFreeze(storeWith({
      customer: { regMethod: "search", existingId: "c1", name: "下書きの名前" },
      vehicle: { existingId: "v1", maker: "下書きメーカー", model: "下書きモデル" },
      categories: ["coating", "other"],
    }));
    const customers = deepFreeze(CUSTOMERS.map((c) => ({ ...c })));
    const vehicles = deepFreeze(VEHICLES.map((v) => ({ ...v })));
    const before = JSON.stringify({ store, customers, vehicles });

    // Frozen inputs make any mutation throw; the snapshot comparison then proves
    // the rendered resolution left every supplied object byte-identical.
    const html = renderToStaticMarkup(
      <Step7Review api={apiFor(store)} customers={customers} vehicles={vehicles} pricing={EMPTY_WIZARD_PRICING_RESULT} />,
    );

    assert.equal(rowValue(html, "顧客"), "山田 太郎 様");
    assert.equal(JSON.stringify({ store, customers, vehicles }), before);
  });
});

// ── GDA-ESTIMATE-PR133 P2-2 — editing one review field never freezes the other ─────────────────

/** Walk a React element tree (no rendering) and return the first element whose aria-label matches. */
function findByAriaLabel(node: unknown, label: string): { props: Record<string, unknown> } | null {
  if (node === null || node === undefined || typeof node !== "object") return null;
  if (Array.isArray(node)) {
    for (const child of node) { const hit = findByAriaLabel(child, label); if (hit) return hit; }
    return null;
  }
  const el = node as { props?: Record<string, unknown> };
  if (el.props === undefined) return null;
  if (el.props["aria-label"] === label) return el as { props: Record<string, unknown> };
  return findByAriaLabel(el.props.children, label);
}

describe("Step7Review — each review input submits ONLY its own field (P2-2)", () => {
  const line = {
    kind: "manual" as const, category: "store_global_options", sourceId: "store_global_options:go-q", label: "数量オプション",
    quantity: 2, unitPrice: 3_000, lineSubtotal: 6_000, discountAmount: null, taxAmount: null,
    lineTotal: 6_000, pricingReferenceId: null, catalogLineRole: null,
  };
  const lineId = "manual:store_global_options:go-q";

  function captureApi(): { api: EstimateWizardApi; calls: Array<[string, ServiceLineAdjustmentPatch]> } {
    const calls: Array<[string, ServiceLineAdjustmentPatch]> = [];
    const api = {
      ...apiFor(storeWith({ categories: ["coating"] })),
      setServiceLineAdjustment: (id: string, patch: ServiceLineAdjustmentPatch) => { calls.push([id, patch]); },
    } as unknown as EstimateWizardApi;
    return { api, calls };
  }

  it("a quantity edit passes { quantityInput } only — no unitPriceInput key", () => {
    const { api, calls } = captureApi();
    // Step7Review is hook-free, so its element tree can be produced directly and its handlers invoked.
    const tree = Step7Review({ api, customers: CUSTOMERS, vehicles: VEHICLES, pricing: { ...EMPTY_WIZARD_PRICING_RESULT, lines: [line] } });
    const input = findByAriaLabel(tree, "数量オプションの数量");
    assert.ok(input, "quantity input present");
    (input.props.onChange as (e: { target: { value: string } }) => void)({ target: { value: "3" } });
    assert.deepEqual(calls, [[lineId, { quantityInput: "3" }]]);
    assert.equal("unitPriceInput" in calls[0][1], false, "the displayed unit price is never re-submitted");
  });

  it("a unit-price edit passes { unitPriceInput } only — no quantityInput key", () => {
    const { api, calls } = captureApi();
    const tree = Step7Review({ api, customers: CUSTOMERS, vehicles: VEHICLES, pricing: { ...EMPTY_WIZARD_PRICING_RESULT, lines: [line] } });
    const input = findByAriaLabel(tree, "数量オプションの金額（単価）");
    assert.ok(input, "unit-price input present");
    (input.props.onChange as (e: { target: { value: string } }) => void)({ target: { value: "" } });
    assert.deepEqual(calls, [[lineId, { unitPriceInput: "" }]], "an in-progress empty string is passed through as-is");
    assert.equal("quantityInput" in calls[0][1], false, "the displayed quantity is never re-submitted");
  });
});

describe("applyServiceLineAdjustmentPatch — updates only explicitly provided keys (P2-2)", () => {
  const lineId = "manual:store_global_options:go-q";
  const review = (): WizardReviewDraft => ({
    previewConfirmed: true, serviceLineOrder: [], quantityInputsByLine: {}, unitPriceInputsByLine: {},
  });

  it("quantity-only edit stores the quantity and leaves unitPriceInputsByLine untouched (no frozen unit price)", () => {
    const next = applyServiceLineAdjustmentPatch(review(), lineId, { quantityInput: "3" });
    assert.deepEqual(next.quantityInputsByLine, { [lineId]: "3" });
    assert.deepEqual(next.unitPriceInputsByLine, {}, "no unit-price override is created");
    assert.equal(next.previewConfirmed, false, "any edit resets preview confirmation");
  });

  it("unit-price-only edit stores the unit price and leaves quantityInputsByLine untouched (no frozen quantity)", () => {
    const next = applyServiceLineAdjustmentPatch(review(), lineId, { unitPriceInput: "8000" });
    assert.deepEqual(next.unitPriceInputsByLine, { [lineId]: "8000" });
    assert.deepEqual(next.quantityInputsByLine, {}, "no quantity override is created");
    assert.equal(next.previewConfirmed, false);
  });

  it("an explicitly provided empty string is stored while the operator is editing", () => {
    const next = applyServiceLineAdjustmentPatch(review(), lineId, { quantityInput: "" });
    assert.deepEqual(next.quantityInputsByLine, { [lineId]: "" });
    assert.deepEqual(next.unitPriceInputsByLine, {});
  });

  it("a later edit of the other field keeps the earlier field's value; other lines are untouched", () => {
    const first = applyServiceLineAdjustmentPatch(review(), lineId, { quantityInput: "3" });
    const second = applyServiceLineAdjustmentPatch(first, lineId, { unitPriceInput: "2500" });
    assert.deepEqual(second.quantityInputsByLine, { [lineId]: "3" });
    assert.deepEqual(second.unitPriceInputsByLine, { [lineId]: "2500" });
    const third = applyServiceLineAdjustmentPatch(second, "manual:maintenance:mm1", { unitPriceInput: "7000" });
    assert.deepEqual(third.quantityInputsByLine, { [lineId]: "3" });
    assert.deepEqual(third.unitPriceInputsByLine, { [lineId]: "2500", "manual:maintenance:mm1": "7000" });
  });

  it("an empty patch or a blank line id is a no-op returning the same review object", () => {
    const r = review();
    assert.equal(applyServiceLineAdjustmentPatch(r, lineId, {}), r);
    assert.equal(applyServiceLineAdjustmentPatch(r, "  ", { quantityInput: "3" }), r);
    assert.equal(r.previewConfirmed, true, "input never mutated");
  });
});
