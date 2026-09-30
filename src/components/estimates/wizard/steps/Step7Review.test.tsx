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
import {
  applyServiceLineAdjustment, applyServiceLineAdjustmentPatch, dedicatedMenuReviewLineId, parseReviewQuantityText, partialPpfReviewLineId,
  reconcileDedicatedMenuReviewOverrides, reconcilePartialPpfReviewOverrides, type EstimateWizardApi, type ServiceLineAdjustmentPatch,
} from "../useEstimateWizard";
import { resetWizardDraft } from "../draft/wizard-draft-state";
import type { EstimateWizardDraftV22 } from "../draft/wizard-draft-types";
import { wizardPricingLineId } from "../pricing/wizard-line-order";
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
    // GDA-ESTIMATE-QUANTITY-POLICY-R1 (Stage A): a coating catalog line and a maintenance line are
    // FIXED-quantity lines (the pricing route rejects any quantity change), so NEITHER renders an
    // editable quantity input — each shows its authoritative quantity read-only. The stale draft
    // text "2" for the coating line is NOT offered as an editable value (it would fail closed);
    // instead (stale repair) that line — and only that line — offers an explicit reset control.
    assert.equal((html.match(/の数量"/g) ?? []).length, 0, "no quantity input on fixed-quantity lines");
    assert.equal((html.match(/data-testid="review-quantity-fixed"/g) ?? []).length, 2, "one read-only quantity per fixed line");
    assert.doesNotMatch(html, /data-testid="review-quantity-fixed"[^>]*>2</, "stale draft quantity is never displayed as the line quantity");
    assert.equal((html.match(/data-testid="review-quantity-fixed"[^>]*>1</g) ?? []).length, 2, "the authoritative quantity 1 is shown for both");
    assert.equal((html.match(/data-testid="review-quantity-stale-reset"/g) ?? []).length, 1, "exactly one reset control: the coating line with the stale draft");
    assert.match(html, /aria-label="PURE EVOの数量を1に戻す"/);
    assert.doesNotMatch(html, /aria-label="メンテナンスの数量を1に戻す"/, "the maintenance line has no draft entry → no reset control");
    // unit-price editing, keyed by the stable line identity, is preserved on every line
    assert.match(html, /aria-label="メンテナンスの金額（単価）"[^>]*value="5000"/);
    assert.match(html, /aria-label="PURE EVOの金額（単価）"[^>]*value="80000"/);
    assert.match(html, /aria-label="メンテナンスを上へ"/);
    assert.match(html, /aria-label="PURE EVOを下へ"/);
    assert.doesNotMatch(html, /<table/);
  });
});

// ── GDA-ESTIMATE-QUANTITY-POLICY-R1 (Stage A) — the quantity control follows the canonical policy ──
describe("Step7Review — quantity control follows the SAME policy the pricing route enforces", () => {
  const catalogLine = {
    kind: "catalog" as const, category: "coating", sourceId: "coating:PURE EVO", label: "PURE EVO",
    quantity: 1, unitPrice: 80_000, lineSubtotal: 80_000, discountAmount: null, taxAmount: null,
    lineTotal: 80_000, pricingReferenceId: "pure-evo", catalogLineRole: "base" as const,
    quantityPolicy: null,
  };
  const ppfLine = {
    kind: "manual" as const, category: "ppf", sourceId: "ppf:ppf_r1_full_body_t1", label: "PPF フルボディ",
    quantity: 1, unitPrice: 300_000, lineSubtotal: 300_000, discountAmount: null, taxAmount: null,
    lineTotal: 300_000, pricingReferenceId: null, catalogLineRole: null,
    quantityPolicy: null,
  };
  // Not annotated at all (e.g. a result that never passed through the compute route): fail closed.
  const unannotatedLine = {
    kind: "manual" as const, category: "maintenance", sourceId: "maintenance:mm1", label: "メンテナンス",
    quantity: 1, unitPrice: 5_000, lineSubtotal: 5_000, discountAmount: null, taxAmount: null,
    lineTotal: 5_000, pricingReferenceId: null, catalogLineRole: null,
  };
  const boundedLine = {
    kind: "manual" as const, category: "store_global_options", sourceId: "store_global_options:go-min", label: "最小数量オプション",
    quantity: 3, unitPrice: 1_000, lineSubtotal: 3_000, discountAmount: null, taxAmount: null,
    lineTotal: 3_000, pricingReferenceId: null, catalogLineRole: null,
    quantityPolicy: { minQuantity: 2, maxQuantity: 4 },
  };
  const unboundedLine = {
    kind: "manual" as const, category: "store_global_options", sourceId: "store_global_options:go-open", label: "上限なしオプション",
    quantity: 1, unitPrice: 500, lineSubtotal: 500, discountAmount: null, taxAmount: null,
    lineTotal: 500, pricingReferenceId: null, catalogLineRole: null,
    quantityPolicy: { minQuantity: 1, maxQuantity: null },
  };
  const pricingWith = (lines: WizardPricingResult["lines"]): WizardPricingResult =>
    ({ ...EMPTY_WIZARD_PRICING_RESULT, lines });

  it("fixed-quantity lines (policy null or absent) render a read-only quantity and NO number input", () => {
    const html = renderToStaticMarkup(
      <Step7Review api={apiFor(storeWith())} customers={CUSTOMERS} vehicles={VEHICLES} pricing={pricingWith([catalogLine, ppfLine, unannotatedLine])} />,
    );
    assert.equal((html.match(/の数量"/g) ?? []).length, 0, "no quantity input at all");
    assert.equal((html.match(/data-testid="review-quantity-fixed"/g) ?? []).length, 3, "every fixed line shows a read-only quantity");
    assert.equal((html.match(/data-testid="review-quantity-fixed"[^>]*>1</g) ?? []).length, 3);
    assert.equal((html.match(/data-testid="review-quantity-stale-reset"/g) ?? []).length, 0, "no draft quantity entry → no reset control");
    assert.doesNotMatch(html, /<input[^>]*aria-label="PURE EVOの数量"/);
    assert.doesNotMatch(html, /<input[^>]*aria-label="PPF フルボディの数量"/);
    assert.doesNotMatch(html, /<input[^>]*aria-label="メンテナンスの数量"/);
    // unit-price editing is untouched on fixed lines
    assert.match(html, /<input[^>]*aria-label="PURE EVOの金額（単価）"[^>]*value="80000"/);
    assert.match(html, /<input[^>]*aria-label="PPF フルボディの金額（単価）"[^>]*value="300000"/);
    assert.match(html, /<input[^>]*aria-label="メンテナンスの金額（単価）"[^>]*value="5000"/);
    // ordering controls are untouched
    assert.match(html, /aria-label="PURE EVOを下へ"/);
    assert.match(html, /aria-label="メンテナンスを上へ"/);
  });

  it("a fixed line has NO quantity change handler; its unit-price handler still submits only unitPriceInput", () => {
    const calls: Array<[string, ServiceLineAdjustmentPatch]> = [];
    const api = {
      ...apiFor(storeWith()),
      setServiceLineAdjustment: (id: string, patch: ServiceLineAdjustmentPatch) => { calls.push([id, patch]); },
    } as unknown as EstimateWizardApi;
    const tree = Step7Review({ api, customers: CUSTOMERS, vehicles: VEHICLES, pricing: pricingWith([catalogLine, unannotatedLine]) });
    assert.equal(findByAriaLabel(tree, "PURE EVOの数量"), null, "no quantity control element for a fixed catalog line");
    assert.equal(findByAriaLabel(tree, "メンテナンスの数量"), null, "no quantity control element for an un-annotated line");
    const price = findByAriaLabel(tree, "PURE EVOの金額（単価）");
    assert.ok(price, "unit-price input still present");
    (price.props.onChange as (e: { target: { value: string } }) => void)({ target: { value: "75000" } });
    assert.deepEqual(calls, [["catalog:coating:base:pure-evo", { unitPriceInput: "75000" }]]);
  });

  it("a bounded quantity-required line keeps the number input with the configured min/max and draft text wins", () => {
    const api = {
      ...apiFor(storeWith()),
      draft: { review: { serviceLineOrder: [], quantityInputsByLine: { "manual:store_global_options:go-min": "4" }, unitPriceInputsByLine: {} } },
    } as unknown as EstimateWizardApi;
    const html = renderToStaticMarkup(
      <Step7Review api={api} customers={CUSTOMERS} vehicles={VEHICLES} pricing={pricingWith([catalogLine, boundedLine, unboundedLine])} />,
    );
    assert.equal((html.match(/の数量"/g) ?? []).length, 2, "exactly one quantity input per EDITABLE line");
    assert.equal((html.match(/data-testid="review-quantity-fixed"/g) ?? []).length, 1, "the fixed line is read-only");
    assert.match(html, /<input[^>]*type="number"[^>]*min="2"[^>]*max="4"[^>]*aria-label="最小数量オプションの数量"[^>]*value="4"/, "bounded: min/max from the policy, draft text wins");
    assert.match(html, /<input[^>]*type="number"[^>]*min="1"[^>]*aria-label="上限なしオプションの数量"[^>]*value="1"/, "unbounded above: min only");
    assert.doesNotMatch(html, /<input[^>]*max="[^"]*"[^>]*aria-label="上限なしオプションの数量"/, "no max attribute when maxQuantity is null");
    assert.match(html, /<input[^>]*aria-label="最小数量オプションの金額（単価）"[^>]*value="1000"/);
  });

  it("a bounded line's quantity handler submits ONLY quantityInput (unchanged P2-2 contract)", () => {
    const calls: Array<[string, ServiceLineAdjustmentPatch]> = [];
    const api = {
      ...apiFor(storeWith()),
      setServiceLineAdjustment: (id: string, patch: ServiceLineAdjustmentPatch) => { calls.push([id, patch]); },
    } as unknown as EstimateWizardApi;
    const tree = Step7Review({ api, customers: CUSTOMERS, vehicles: VEHICLES, pricing: pricingWith([boundedLine]) });
    const input = findByAriaLabel(tree, "最小数量オプションの数量");
    assert.ok(input, "quantity input present for the bounded line");
    assert.equal(input.props.min, 2);
    assert.equal(input.props.max, 4);
    (input.props.onChange as (e: { target: { value: string } }) => void)({ target: { value: "2" } });
    assert.deepEqual(calls, [["manual:store_global_options:go-min", { quantityInput: "2" }]]);
  });
});

// ── GDA-ESTIMATE-QUANTITY-POLICY-R1 (Stage A stale repair) — a stale draft quantity on a FIXED line is recoverable ──
//
// A restored draft/revision may carry `quantityInputsByLine[id]` for a fixed-quantity line (typed
// before the input was removed, or malformed). The pricing route then fails the whole result closed
// and, with no number input, the operator could not correct it. The row must offer an explicit,
// labeled reset that writes the authoritative quantity back through the SAME adjustment API (the
// accepted identity → recompute). Identity/absent values and editable option lines get no reset.
describe("Step7Review — a stale quantityInputsByLine entry on a FIXED line offers an explicit reset", () => {
  const catalogLine = {
    kind: "catalog" as const, category: "coating", sourceId: "coating:PURE EVO", label: "PURE EVO",
    quantity: 1, unitPrice: 80_000, lineSubtotal: 80_000, discountAmount: null, taxAmount: null,
    lineTotal: 80_000, pricingReferenceId: "pure-evo", catalogLineRole: "base" as const,
    quantityPolicy: null,
  };
  // Policy absent (never annotated) is treated as fixed, so it must be recoverable the same way.
  const unannotatedLine = {
    kind: "manual" as const, category: "maintenance", sourceId: "maintenance:mm1", label: "メンテナンス",
    quantity: 1, unitPrice: 5_000, lineSubtotal: 5_000, discountAmount: null, taxAmount: null,
    lineTotal: 5_000, pricingReferenceId: null, catalogLineRole: null,
  };
  const optionLine = {
    kind: "manual" as const, category: "store_global_options", sourceId: "store_global_options:go-q", label: "数量オプション",
    quantity: 2, unitPrice: 3_000, lineSubtotal: 6_000, discountAmount: null, taxAmount: null,
    lineTotal: 6_000, pricingReferenceId: null, catalogLineRole: null,
    quantityPolicy: { minQuantity: 1, maxQuantity: 5 },
  };
  const catalogId = "catalog:coating:base:pure-evo";
  const maintenanceId = "manual:maintenance:mm1";
  const optionId = "manual:store_global_options:go-q";
  const pricingWith = (lines: WizardPricingResult["lines"]): WizardPricingResult =>
    ({ ...EMPTY_WIZARD_PRICING_RESULT, lines });
  type Handler = (e?: unknown) => void;

  function captureApi(
    quantityInputsByLine: Record<string, string>,
    unitPriceInputsByLine: Record<string, string> = {},
  ): { api: EstimateWizardApi; calls: Array<[string, ServiceLineAdjustmentPatch]> } {
    const calls: Array<[string, ServiceLineAdjustmentPatch]> = [];
    const api = {
      ...apiFor(storeWith({ categories: ["coating"] })),
      draft: { review: { serviceLineOrder: [], quantityInputsByLine, unitPriceInputsByLine } },
      setServiceLineAdjustment: (id: string, patch: ServiceLineAdjustmentPatch) => { calls.push([id, patch]); },
    } as unknown as EstimateWizardApi;
    return { api, calls };
  }

  it("stale numeric value: authoritative read-only quantity, no number input, and a labeled reset that restores the identity", () => {
    const { api, calls } = captureApi({ [catalogId]: "2" });
    const html = renderToStaticMarkup(
      <Step7Review api={api} customers={CUSTOMERS} vehicles={VEHICLES} pricing={pricingWith([catalogLine])} />,
    );
    // fixed behavior preserved: no input, authoritative quantity shown, the stale value never shown as the quantity
    assert.equal((html.match(/の数量"/g) ?? []).length, 0, "still no editable quantity input");
    assert.equal((html.match(/data-testid="review-quantity-fixed"[^>]*>1</g) ?? []).length, 1);
    assert.doesNotMatch(html, /data-testid="review-quantity-fixed"[^>]*>2</);
    // the stale value is visible and clearly labeled, with an actionable reset on the same line
    assert.match(html, /data-testid="review-quantity-stale-notice"[^>]*>[^<]*「2」[^<]*<\/p>/, "the stale draft text is named");
    assert.match(html, /<button[^>]*type="button"[^>]*data-testid="review-quantity-stale-reset"[^>]*aria-label="PURE EVOの数量を1に戻す"[^>]*>数量を1に戻す<\/button>/);
    assert.equal((html.match(/data-testid="review-quantity-stale-reset"/g) ?? []).length, 1);

    // activating it writes the authoritative quantity back through the existing adjustment API
    const tree = Step7Review({ api, customers: CUSTOMERS, vehicles: VEHICLES, pricing: pricingWith([catalogLine]) });
    const reset = findByAriaLabel(tree, "PURE EVOの数量を1に戻す");
    assert.ok(reset, "reset control present in the element tree");
    assert.equal(reset.props.type, "button");
    (reset.props.onClick as Handler)();
    assert.deepEqual(calls, [[catalogId, { quantityInput: "1" }]], "exactly the identity quantity, once");
    assert.equal("unitPriceInput" in calls[0][1], false, "the unit price is never re-submitted by the reset");
  });

  it("malformed stale values (blank, non-numeric) on fixed and un-annotated lines each get a recovery control", () => {
    const { api, calls } = captureApi({ [catalogId]: "", [maintenanceId]: "abc" });
    const pricing = pricingWith([catalogLine, unannotatedLine]);
    const html = renderToStaticMarkup(
      <Step7Review api={api} customers={CUSTOMERS} vehicles={VEHICLES} pricing={pricing} />,
    );
    assert.equal((html.match(/の数量"/g) ?? []).length, 0, "no editable quantity input");
    assert.equal((html.match(/data-testid="review-quantity-fixed"[^>]*>1</g) ?? []).length, 2, "both show the authoritative quantity");
    assert.equal((html.match(/data-testid="review-quantity-stale-reset"/g) ?? []).length, 2, "one reset per stale line");
    assert.match(html, /data-testid="review-quantity-stale-notice"[^>]*>[^<]*（空欄）[^<]*<\/p>/, "a blank draft value is named as blank");
    assert.match(html, /data-testid="review-quantity-stale-notice"[^>]*>[^<]*「abc」[^<]*<\/p>/, "a non-numeric draft value is named");
    assert.match(html, /aria-label="PURE EVOの数量を1に戻す"/);
    assert.match(html, /aria-label="メンテナンスの数量を1に戻す"/);

    const tree = Step7Review({ api, customers: CUSTOMERS, vehicles: VEHICLES, pricing });
    const resetCatalog = findByAriaLabel(tree, "PURE EVOの数量を1に戻す");
    const resetMaintenance = findByAriaLabel(tree, "メンテナンスの数量を1に戻す");
    assert.ok(resetCatalog && resetMaintenance, "both recovery controls present");
    (resetCatalog.props.onClick as Handler)();
    (resetMaintenance.props.onClick as Handler)();
    assert.deepEqual(calls, [
      [catalogId, { quantityInput: "1" }],
      [maintenanceId, { quantityInput: "1" }],
    ]);
  });

  it("identity or absent draft quantity on a fixed line renders NO reset control and NO notice", () => {
    const { api, calls } = captureApi({ [catalogId]: "1" }); // maintenance: no entry at all
    const pricing = pricingWith([catalogLine, unannotatedLine]);
    const html = renderToStaticMarkup(
      <Step7Review api={api} customers={CUSTOMERS} vehicles={VEHICLES} pricing={pricing} />,
    );
    assert.equal((html.match(/data-testid="review-quantity-fixed"/g) ?? []).length, 2);
    assert.equal((html.match(/data-testid="review-quantity-stale-reset"/g) ?? []).length, 0, "identity → nothing to reset");
    assert.equal((html.match(/data-testid="review-quantity-stale-notice"/g) ?? []).length, 0);
    assert.equal((html.match(/の数量"/g) ?? []).length, 0);
    const tree = Step7Review({ api, customers: CUSTOMERS, vehicles: VEHICLES, pricing });
    assert.equal(findByAriaLabel(tree, "PURE EVOの数量を1に戻す"), null);
    assert.equal(findByAriaLabel(tree, "メンテナンスの数量を1に戻す"), null);
    assert.deepEqual(calls, [], "rendering never writes to the draft");
  });

  it("an editable quantity-required option keeps its number input and never renders the reset control — even for an out-of-range or malformed draft", () => {
    const { api } = captureApi({ [optionId]: "9" });
    const html = renderToStaticMarkup(
      <Step7Review api={api} customers={CUSTOMERS} vehicles={VEHICLES} pricing={pricingWith([optionLine, catalogLine])} />,
    );
    assert.match(html, /<input[^>]*type="number"[^>]*min="1"[^>]*max="5"[^>]*aria-label="数量オプションの数量"[^>]*value="9"/, "the draft text stays in the editable input (P2-2 / Stage A contract)");
    assert.equal((html.match(/の数量"/g) ?? []).length, 1, "exactly one editable quantity input");
    assert.equal((html.match(/data-testid="review-quantity-stale-reset"/g) ?? []).length, 0, "editable option → no reset control");
    assert.equal((html.match(/data-testid="review-quantity-stale-notice"/g) ?? []).length, 0);
    assert.equal((html.match(/data-testid="review-quantity-fixed"/g) ?? []).length, 1, "the fixed line is still read-only");

    const { api: malformedApi } = captureApi({ [optionId]: "abc" });
    const malformedHtml = renderToStaticMarkup(
      <Step7Review api={malformedApi} customers={CUSTOMERS} vehicles={VEHICLES} pricing={pricingWith([optionLine])} />,
    );
    assert.match(malformedHtml, /<input[^>]*aria-label="数量オプションの数量"[^>]*value="abc"/);
    assert.equal((malformedHtml.match(/data-testid="review-quantity-stale-reset"/g) ?? []).length, 0);
  });

  it("the reset touches ONLY the quantity: unit-price override, unit-price handler and order controls are unchanged", () => {
    const { api, calls } = captureApi({ [catalogId]: "2" }, { [catalogId]: "75000" });
    const pricing = pricingWith([catalogLine, unannotatedLine]);
    const html = renderToStaticMarkup(
      <Step7Review api={api} customers={CUSTOMERS} vehicles={VEHICLES} pricing={pricing} />,
    );
    assert.match(html, /<input[^>]*aria-label="PURE EVOの金額（単価）"[^>]*value="75000"/, "unit-price draft override still shown");
    assert.match(html, /<input[^>]*aria-label="メンテナンスの金額（単価）"[^>]*value="5000"/);
    assert.match(html, /aria-label="PURE EVOを下へ"/);
    assert.match(html, /aria-label="メンテナンスを上へ"/);
    assert.match(html, /md:grid-cols-\[minmax\(0,1fr\)_6rem_8rem_auto\]/, "row layout unchanged");

    const tree = Step7Review({ api, customers: CUSTOMERS, vehicles: VEHICLES, pricing });
    (findByAriaLabel(tree, "PURE EVOの数量を1に戻す")!.props.onClick as Handler)();
    (findByAriaLabel(tree, "PURE EVOの金額（単価）")!.props.onChange as Handler)({ target: { value: "70000" } });
    assert.deepEqual(calls, [
      [catalogId, { quantityInput: "1" }],
      [catalogId, { unitPriceInput: "70000" }],
    ], "each control submits only its own field");
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

describe("Step7Review — each review input submits ONLY its own field (P2-2)", () => {
  // GDA-ESTIMATE-QUANTITY-POLICY-R1: a quantity-required option line carries its configured bounds
  // (annotated by the compute route); only such a line renders an editable quantity input.
  const line = {
    kind: "manual" as const, category: "store_global_options", sourceId: "store_global_options:go-q", label: "数量オプション",
    quantity: 2, unitPrice: 3_000, lineSubtotal: 6_000, discountAmount: null, taxAmount: null,
    lineTotal: 6_000, pricingReferenceId: null, catalogLineRole: null,
    quantityPolicy: { minQuantity: 1, maxQuantity: 5 },
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

// ── GDA-ESTIMATE-QUANTITY-POLICY-R1 (Stage B) — partial PPF PART lines: editable, and synced with Step 4 ──
describe("Step7Review — a partial PPF PART line is editable and passes ppfPartSync; other lines are unchanged", () => {
  const partLine = {
    kind: "manual" as const, category: "ppf", sourceId: "ppf:ppf_r1_partial_t1_bonnet", label: "PPF 部分施工 ボンネット（T1）",
    quantity: 2, unitPrice: 50_000, lineSubtotal: 100_000, discountAmount: null, taxAmount: null,
    lineTotal: 100_000, pricingReferenceId: null, catalogLineRole: null,
    quantityPolicy: { minQuantity: 1, maxQuantity: 4, ppfPartCode: "bonnet" },
  };
  const optionLine = {
    kind: "manual" as const, category: "store_global_options", sourceId: "store_global_options:go-q", label: "数量オプション",
    quantity: 2, unitPrice: 3_000, lineSubtotal: 6_000, discountAmount: null, taxAmount: null,
    lineTotal: 6_000, pricingReferenceId: null, catalogLineRole: null, quantityPolicy: { minQuantity: 1, maxQuantity: 5 },
  };
  const fullLine = {
    kind: "manual" as const, category: "ppf", sourceId: "ppf:ppf_r1_full_body_t1", label: "PPF フルボディ（T1）",
    quantity: 1, unitPrice: 300_000, lineSubtotal: 300_000, discountAmount: null, taxAmount: null,
    lineTotal: 300_000, pricingReferenceId: null, catalogLineRole: null, quantityPolicy: null,
  };
  const pricing: WizardPricingResult = { ...EMPTY_WIZARD_PRICING_RESULT, lines: [partLine, optionLine, fullLine] };

  it("renders a bounded number input for the part line and a read-only quantity for full-body PPF", () => {
    const html = renderToStaticMarkup(<Step7Review api={apiFor(storeWith())} customers={CUSTOMERS} vehicles={VEHICLES} pricing={pricing} />);
    assert.match(html, /<input[^>]*type="number"[^>]*min="1"[^>]*max="4"[^>]*aria-label="PPF 部分施工 ボンネット（T1）の数量"[^>]*value="2"/);
    assert.equal((html.match(/の数量"/g) ?? []).length, 2, "part line + option line");
    assert.equal((html.match(/data-testid="review-quantity-fixed"/g) ?? []).length, 1, "full-body PPF fixed");
    assert.doesNotMatch(html, /<input[^>]*aria-label="PPF フルボディ（T1）の数量"/);
  });

  it("the part line handler submits { quantityInput, ppfPartSync }; the store option still submits { quantityInput } only", () => {
    const calls: Array<[string, ServiceLineAdjustmentPatch]> = [];
    const api = { ...apiFor(storeWith()), setServiceLineAdjustment: (id: string, patch: ServiceLineAdjustmentPatch) => { calls.push([id, patch]); } } as unknown as EstimateWizardApi;
    const tree = Step7Review({ api, customers: CUSTOMERS, vehicles: VEHICLES, pricing });
    (findByAriaLabel(tree, "PPF 部分施工 ボンネット（T1）の数量")!.props.onChange as (e: { target: { value: string } }) => void)({ target: { value: "3" } });
    (findByAriaLabel(tree, "数量オプションの数量")!.props.onChange as (e: { target: { value: string } }) => void)({ target: { value: "4" } });
    assert.deepEqual(calls, [
      ["manual:ppf:ppf_r1_partial_t1_bonnet", { quantityInput: "3", ppfPartSync: { partCode: "bonnet", minQuantity: 1, maxQuantity: 4 } }],
      ["manual:store_global_options:go-q", { quantityInput: "4" }],
    ]);
    assert.equal(findByAriaLabel(tree, "PPF フルボディ（T1）の数量"), null);
  });
});

describe("useEstimateWizard pure reducers — Step 4 ↔ final review partial PPF quantity sync (Stage B)", () => {
  const BONNET = partialPpfReviewLineId("t1", "bonnet");
  const SYNC = { partCode: "bonnet", minQuantity: 1, maxQuantity: 4 };
  const base = (over?: (d: EstimateWizardDraftV22) => void): EstimateWizardDraftV22 => {
    const d = resetWizardDraft();
    d.serviceSelection.selectedCategories = ["ppf"];
    d.serviceConfiguration.ppf = { ...d.serviceConfiguration.ppf, installationMethod: "partial", fullCoverage: null, ppfTypeId: "t1", selectedPartIds: ["bonnet", "fender"], quantitiesByPart: { bonnet: 2 } };
    d.review = { ...d.review, previewConfirmed: true, unitPriceInputsByLine: { [BONNET]: "49000" } };
    over?.(d);
    return d;
  };

  it("drift pins: the hook's line id equals wizardPricingLineId of the adapter part line; the parser matches the pricing route rule", () => {
    assert.equal(BONNET, wizardPricingLineId({ kind: "manual", category: "ppf", sourceId: "ppf:ppf_r1_partial_t1_bonnet", label: "", quantity: 1, unitPrice: 1, lineSubtotal: 1, discountAmount: null, taxAmount: null, lineTotal: 1, pricingReferenceId: null, catalogLineRole: null }));
    assert.deepEqual(["3", "0", "03", "", "abc", "1.5", "1e3", "12"].map(parseReviewQuantityText), [3, null, null, null, null, null, null, 12]);
  });

  it("W1: a valid in-bounds review edit writes through to Step 4 quantitiesByPart and keeps the identical buffer text", () => {
    const next = applyServiceLineAdjustment(base(), BONNET, { quantityInput: "3", ppfPartSync: SYNC });
    assert.equal(next.serviceConfiguration.ppf.quantitiesByPart.bonnet, 3);
    assert.deepEqual(next.review.quantityInputsByLine, { [BONNET]: "3" });
    assert.deepEqual(next.review.unitPriceInputsByLine, { [BONNET]: "49000" }, "unit-price buffers untouched");
    assert.equal(next.review.previewConfirmed, false);
    assert.deepEqual(next.serviceConfiguration.ppf.selectedPartIds, ["bonnet", "fender"]);
  });

  it("W2: invalid / empty / out-of-bounds text, or a failed guard, updates ONLY the buffer and retains the last valid base", () => {
    for (const q of ["9", "0", "", "abc", "03", "1.5"]) {
      const next = applyServiceLineAdjustment(base(), BONNET, { quantityInput: q, ppfPartSync: SYNC });
      assert.equal(next.serviceConfiguration.ppf.quantitiesByPart.bonnet, 2, `base retained for "${q}"`);
      assert.equal(next.review.quantityInputsByLine[BONNET], q, `buffer shows "${q}"`);
    }
    // guards: unselected part, id mismatch, wrong type, full method, malformed bounds, no sync (store option contract)
    const cases: Array<[EstimateWizardDraftV22, string, ServiceLineAdjustmentPatch]> = [
      [base(), BONNET, { quantityInput: "3", ppfPartSync: { ...SYNC, partCode: "roof" } }],
      [base(), partialPpfReviewLineId("t2", "bonnet"), { quantityInput: "3", ppfPartSync: SYNC }],
      [base((d) => { d.serviceConfiguration.ppf.ppfTypeId = "t2"; }), BONNET, { quantityInput: "3", ppfPartSync: SYNC }],
      [base((d) => { d.serviceConfiguration.ppf.installationMethod = "full"; }), BONNET, { quantityInput: "3", ppfPartSync: SYNC }],
      [base(), BONNET, { quantityInput: "3", ppfPartSync: { ...SYNC, minQuantity: 0 } }],
      [base(), BONNET, { quantityInput: "3", ppfPartSync: { ...SYNC, maxQuantity: 0 } }],
      [base(), BONNET, { quantityInput: "3" }],
    ];
    for (const [d, id, patch] of cases) {
      const next = applyServiceLineAdjustment(d, id, patch);
      assert.equal(next.serviceConfiguration.ppf.quantitiesByPart.bonnet, 2, "no base write");
      assert.equal(next.review.quantityInputsByLine[id], "3", "buffer only");
    }
    const priceOnly = applyServiceLineAdjustment(base(), BONNET, { unitPriceInput: "51000", ppfPartSync: SYNC });
    assert.equal(priceOnly.serviceConfiguration.ppf.quantitiesByPart.bonnet, 2);
    assert.deepEqual(priceOnly.review.quantityInputsByLine, {});
  });

  it("W3: a later Step-4 change of a part's quantity clears ONLY that part's buffer; toggles and unrelated parts change nothing", () => {
    const prev = base((d) => { d.review.quantityInputsByLine = { [BONNET]: "3", [partialPpfReviewLineId("t1", "fender")]: "abc", "manual:store_global_options:go-q": "4" }; });
    const bonnetChanged = { ...prev, serviceConfiguration: { ...prev.serviceConfiguration, ppf: { ...prev.serviceConfiguration.ppf, quantitiesByPart: { bonnet: 4 } } } };
    const r1 = reconcilePartialPpfReviewOverrides(prev, bonnetChanged);
    assert.deepEqual(r1.review.quantityInputsByLine, { [partialPpfReviewLineId("t1", "fender")]: "abc", "manual:store_global_options:go-q": "4" });
    assert.equal(r1.review.previewConfirmed, false);
    assert.deepEqual(r1.review.unitPriceInputsByLine, { [BONNET]: "49000" }, "unit-price buffers untouched");
    const fenderSet = { ...prev, serviceConfiguration: { ...prev.serviceConfiguration, ppf: { ...prev.serviceConfiguration.ppf, quantitiesByPart: { bonnet: 2, fender: 2 } } } };
    assert.deepEqual(reconcilePartialPpfReviewOverrides(prev, fenderSet).review.quantityInputsByLine, { [BONNET]: "3", "manual:store_global_options:go-q": "4" }, "malformed fender buffer cleared by the fender edit; bonnet kept");
    const toggled = { ...prev, serviceConfiguration: { ...prev.serviceConfiguration, ppf: { ...prev.serviceConfiguration.ppf, selectedPartIds: ["bonnet"] } } };
    assert.equal(reconcilePartialPpfReviewOverrides(prev, toggled), toggled, "part toggle: same object, no buffer change");
    assert.equal(reconcilePartialPpfReviewOverrides(prev, prev), prev);
  });

  it("W4: a PPF type or installation-method change clears EVERY partial-part buffer and nothing else", () => {
    const prev = base((d) => { d.review.quantityInputsByLine = { [BONNET]: "3", [partialPpfReviewLineId("t1", "fender")]: "2", "manual:store_global_options:go-q": "4", "catalog:coating:base:pure-evo": "1" }; });
    for (const patch of [{ ppfTypeId: "t2" }, { installationMethod: "full" as const }]) {
      const next = { ...prev, serviceConfiguration: { ...prev.serviceConfiguration, ppf: { ...prev.serviceConfiguration.ppf, ...patch } } };
      const r = reconcilePartialPpfReviewOverrides(prev, next);
      assert.deepEqual(r.review.quantityInputsByLine, { "manual:store_global_options:go-q": "4", "catalog:coating:base:pure-evo": "1" }, JSON.stringify(patch));
      assert.deepEqual(r.review.unitPriceInputsByLine, prev.review.unitPriceInputsByLine);
      assert.equal(r.review.previewConfirmed, false);
    }
  });

  it("round trip: Step 7 → Step 4 → Step 7 never leaves a valid contradiction", () => {
    const afterReview = applyServiceLineAdjustment(base(), BONNET, { quantityInput: "3", ppfPartSync: SYNC });
    assert.equal(afterReview.serviceConfiguration.ppf.quantitiesByPart.bonnet, 3);
    const step4 = { ...afterReview, serviceConfiguration: { ...afterReview.serviceConfiguration, ppf: { ...afterReview.serviceConfiguration.ppf, quantitiesByPart: { bonnet: 4 } } } };
    const reconciled = reconcilePartialPpfReviewOverrides(afterReview, step4);
    assert.equal(reconciled.serviceConfiguration.ppf.quantitiesByPart.bonnet, 4);
    assert.equal(BONNET in reconciled.review.quantityInputsByLine, false, "review follows the new canonical quantity");
  });
});

// ── GDA-ESTIMATE-QUANTITY-POLICY-R1 (B5c2, plan §24.1) — DEDICATED wheel / glass menu lines: editable, labeled, synced ──
describe("Step7Review — a dedicated wheel / glass menu line is editable under its own category label and passes dedicatedMenuSync", () => {
  const wheelLine = {
    kind: "manual" as const, category: "wheel", sourceId: "wheel:wm1", label: "ホイールコート",
    quantity: 4, unitPrice: 8_000, lineSubtotal: 32_000, discountAmount: null, taxAmount: null,
    lineTotal: 32_000, pricingReferenceId: null, catalogLineRole: null,
    quantityPolicy: { minQuantity: 1, maxQuantity: null, dedicatedMenu: { kind: "wheel" as const, menuCode: "wm1" } },
  };
  const wheelLine2 = {
    kind: "manual" as const, category: "wheel", sourceId: "wheel:wm2", label: "ホイール撥水",
    quantity: 4, unitPrice: 3_000, lineSubtotal: 12_000, discountAmount: null, taxAmount: null,
    lineTotal: 12_000, pricingReferenceId: null, catalogLineRole: null,
    quantityPolicy: { minQuantity: 2, maxQuantity: 8, dedicatedMenu: { kind: "wheel" as const, menuCode: "wm2" } },
  };
  const glassLine = {
    kind: "manual" as const, category: "glass", sourceId: "glass:gm1", label: "ガラス撥水",
    quantity: 1, unitPrice: 12_000, lineSubtotal: 12_000, discountAmount: null, taxAmount: null,
    lineTotal: 12_000, pricingReferenceId: null, catalogLineRole: null,
    quantityPolicy: { minQuantity: 1, maxQuantity: 6, dedicatedMenu: { kind: "glass" as const, menuCode: "gm1" } },
  };
  // A wheel/glass line the compute route left FIXED (stale/unknown configuration) — no input, no sync.
  const fixedGlassLine = {
    kind: "manual" as const, category: "glass", sourceId: "glass:gm9", label: "ガラス旧メニュー",
    quantity: 1, unitPrice: 1_000, lineSubtotal: 1_000, discountAmount: null, taxAmount: null,
    lineTotal: 1_000, pricingReferenceId: null, catalogLineRole: null, quantityPolicy: null,
  };
  const coatingLine = {
    kind: "catalog" as const, category: "coating", sourceId: "coating:PURE EVO", label: "PURE EVO",
    quantity: 1, unitPrice: 80_000, lineSubtotal: 80_000, discountAmount: null, taxAmount: null,
    lineTotal: 80_000, pricingReferenceId: "pure-evo", catalogLineRole: "base" as const, quantityPolicy: null,
  };
  const partLine = {
    kind: "manual" as const, category: "ppf", sourceId: "ppf:ppf_r1_partial_t1_bonnet", label: "PPF 部分施工 ボンネット（T1）",
    quantity: 2, unitPrice: 50_000, lineSubtotal: 100_000, discountAmount: null, taxAmount: null,
    lineTotal: 100_000, pricingReferenceId: null, catalogLineRole: null,
    quantityPolicy: { minQuantity: 1, maxQuantity: 4, ppfPartCode: "bonnet" },
  };
  const optionLine = {
    kind: "manual" as const, category: "store_global_options", sourceId: "store_global_options:go-q", label: "数量オプション",
    quantity: 2, unitPrice: 3_000, lineSubtotal: 6_000, discountAmount: null, taxAmount: null,
    lineTotal: 6_000, pricingReferenceId: null, catalogLineRole: null, quantityPolicy: { minQuantity: 1, maxQuantity: 5 },
  };
  const pricing: WizardPricingResult = { ...EMPTY_WIZARD_PRICING_RESULT, lines: [wheelLine, wheelLine2, glassLine, fixedGlassLine, coatingLine, partLine, optionLine] };

  it("renders editable bounded inputs (4 / 1 prefilled) under ホイール / ガラス labels; fixed wheel/glass, coating stay read-only; draft text wins", () => {
    const api = {
      ...apiFor(storeWith({ categories: ["coating", "wheel", "glass"] })),
      draft: { review: { serviceLineOrder: [], quantityInputsByLine: { "manual:wheel:wm2": "abc" }, unitPriceInputsByLine: {} } },
    } as unknown as EstimateWizardApi;
    const html = renderToStaticMarkup(<Step7Review api={api} customers={CUSTOMERS} vehicles={VEHICLES} pricing={pricing} />);
    assert.equal(rowValue(html, "作業"), "ボディコーティング / ホイール / ガラス");
    assert.match(html, /<input[^>]*type="number"[^>]*min="1"[^>]*aria-label="ホイールコートの数量"[^>]*value="4"/, "wheel initial 4, min only");
    assert.doesNotMatch(html, /<input[^>]*max="[^"]*"[^>]*aria-label="ホイールコートの数量"/, "no max attribute when unbounded above");
    assert.match(html, /<input[^>]*type="number"[^>]*min="2"[^>]*max="8"[^>]*aria-label="ホイール撥水の数量"[^>]*value="abc"/, "bounded: configured min/max; invalid draft text stays visible");
    assert.match(html, /<input[^>]*type="number"[^>]*min="1"[^>]*max="6"[^>]*aria-label="ガラス撥水の数量"[^>]*value="1"/, "glass initial 1");
    assert.equal((html.match(/の数量"/g) ?? []).length, 5, "wheel ×2 + glass + PPF part + option");
    assert.equal((html.match(/data-testid="review-quantity-fixed"/g) ?? []).length, 2, "fixed glass line + coating read-only");
    assert.doesNotMatch(html, /<input[^>]*aria-label="ガラス旧メニューの数量"/);
    assert.doesNotMatch(html, /<input[^>]*aria-label="PURE EVOの数量"/);
    assert.equal((html.match(/data-testid="review-quantity-stale-reset"/g) ?? []).length, 0, "editable dedicated lines never offer the fixed-line reset");
    // category labels: the dedicated categories, never 共通オプション
    assert.match(html, /ホイール・¥32,000/);
    assert.match(html, /ガラス・¥12,000/);
    assert.equal((html.match(/共通オプション/g) ?? []).length, 1, "only the store option carries 共通オプション");
    // unit-price editing preserved on every line
    assert.match(html, /<input[^>]*aria-label="ホイールコートの金額（単価）"[^>]*value="8000"/);
    assert.match(html, /<input[^>]*aria-label="ガラス撥水の金額（単価）"[^>]*value="12000"/);
  });

  it("the handler submits { quantityInput, dedicatedMenuSync } with the exact kind/code/bounds; PPF part and option contracts unchanged; unit price submits only its own field", () => {
    const calls: Array<[string, ServiceLineAdjustmentPatch]> = [];
    const api = { ...apiFor(storeWith()), setServiceLineAdjustment: (id: string, patch: ServiceLineAdjustmentPatch) => { calls.push([id, patch]); } } as unknown as EstimateWizardApi;
    const tree = Step7Review({ api, customers: CUSTOMERS, vehicles: VEHICLES, pricing });
    type Change = (e: { target: { value: string } }) => void;
    (findByAriaLabel(tree, "ホイールコートの数量")!.props.onChange as Change)({ target: { value: "5" } });
    (findByAriaLabel(tree, "ガラス撥水の数量")!.props.onChange as Change)({ target: { value: "" } });
    (findByAriaLabel(tree, "PPF 部分施工 ボンネット（T1）の数量")!.props.onChange as Change)({ target: { value: "3" } });
    (findByAriaLabel(tree, "数量オプションの数量")!.props.onChange as Change)({ target: { value: "4" } });
    (findByAriaLabel(tree, "ホイールコートの金額（単価）")!.props.onChange as Change)({ target: { value: "9000" } });
    assert.deepEqual(calls, [
      ["manual:wheel:wm1", { quantityInput: "5", dedicatedMenuSync: { kind: "wheel", menuCode: "wm1", minQuantity: 1, maxQuantity: null } }],
      ["manual:glass:gm1", { quantityInput: "", dedicatedMenuSync: { kind: "glass", menuCode: "gm1", minQuantity: 1, maxQuantity: 6 } }],
      ["manual:ppf:ppf_r1_partial_t1_bonnet", { quantityInput: "3", ppfPartSync: { partCode: "bonnet", minQuantity: 1, maxQuantity: 4 } }],
      ["manual:store_global_options:go-q", { quantityInput: "4" }],
      ["manual:wheel:wm1", { unitPriceInput: "9000" }],
    ]);
    assert.equal(findByAriaLabel(tree, "ガラス旧メニューの数量"), null, "fixed wheel/glass line has no quantity control");
    assert.equal(findByAriaLabel(tree, "PURE EVOの数量"), null);
  });
});

describe("useEstimateWizard pure reducers — Step 4 ↔ final review dedicated wheel / glass quantity sync (B5c2)", () => {
  const WM1 = dedicatedMenuReviewLineId("wheel", "wm1");
  const WM2 = dedicatedMenuReviewLineId("wheel", "wm2");
  const GM1 = dedicatedMenuReviewLineId("glass", "gm1");
  const WHEEL_SYNC = { kind: "wheel" as const, menuCode: "wm1", minQuantity: 1, maxQuantity: null };
  const GLASS_SYNC = { kind: "glass" as const, menuCode: "gm1", minQuantity: 1, maxQuantity: 6 };
  const base = (over?: (d: EstimateWizardDraftV22) => void): EstimateWizardDraftV22 => {
    const d = resetWizardDraft();
    d.serviceSelection.selectedCategories = ["wheel", "glass"];
    d.serviceConfiguration.wheel = { selectedMenuIds: ["wm1", "wm2"], unitPricesByMenu: { wm1: "8000", wm2: "3000" }, quantitiesByMenu: { wm1: 4, wm2: 4 } };
    d.serviceConfiguration.glass = { selectedMenuIds: ["gm1"], unitPricesByMenu: { gm1: "12000" }, quantitiesByMenu: { gm1: 1 } };
    d.review = { ...d.review, previewConfirmed: true, unitPriceInputsByLine: { [WM1]: "7900", [GM1]: "11000" } };
    over?.(d);
    return d;
  };
  const wheelQty = (d: EstimateWizardDraftV22) => d.serviceConfiguration.wheel!.quantitiesByMenu;
  const glassQty = (d: EstimateWizardDraftV22) => d.serviceConfiguration.glass!.quantitiesByMenu;

  it("drift pins: the hook's line id equals wizardPricingLineId of a B5c1 wheel / glass line", () => {
    const line = (category: "wheel" | "glass", code: string) => ({ kind: "manual" as const, category, sourceId: `${category}:${code}`, label: "", quantity: 1, unitPrice: 1, lineSubtotal: 1, discountAmount: null, taxAmount: null, lineTotal: 1, pricingReferenceId: null, catalogLineRole: null });
    assert.equal(WM1, wizardPricingLineId(line("wheel", "wm1")));
    assert.equal(GM1, wizardPricingLineId(line("glass", "gm1")));
    assert.equal(WM1, "manual:wheel:wm1");
    assert.equal(GM1, "manual:glass:gm1");
  });

  it("D1: a valid in-bounds review edit writes through to the ONE canonical quantitiesByMenu of that section and keeps the identical buffer text", () => {
    const wheel = applyServiceLineAdjustment(base(), WM1, { quantityInput: "5", dedicatedMenuSync: WHEEL_SYNC });
    assert.deepEqual(wheelQty(wheel), { wm1: 5, wm2: 4 }, "only wm1 written");
    assert.deepEqual(glassQty(wheel), { gm1: 1 }, "the other section untouched");
    assert.deepEqual(wheel.review.quantityInputsByLine, { [WM1]: "5" });
    assert.deepEqual(wheel.review.unitPriceInputsByLine, { [WM1]: "7900", [GM1]: "11000" }, "unit-price buffers untouched");
    assert.equal(wheel.review.previewConfirmed, false);
    assert.deepEqual(wheel.serviceConfiguration.wheel!.selectedMenuIds, ["wm1", "wm2"]);
    assert.deepEqual(wheel.serviceConfiguration.wheel!.unitPricesByMenu, { wm1: "8000", wm2: "3000" }, "Step-4 unit prices untouched");
    const glass = applyServiceLineAdjustment(base(), GM1, { quantityInput: "6", dedicatedMenuSync: GLASS_SYNC });
    assert.deepEqual(glassQty(glass), { gm1: 6 }, "max bound inclusive");
    assert.deepEqual(wheelQty(glass), { wm1: 4, wm2: 4 });
    // identity write is a no-op on the canonical section (buffer still recorded)
    const identity = applyServiceLineAdjustment(base(), WM1, { quantityInput: "4", dedicatedMenuSync: WHEEL_SYNC });
    assert.deepEqual(wheelQty(identity), { wm1: 4, wm2: 4 });
    assert.deepEqual(identity.review.quantityInputsByLine, { [WM1]: "4" });
  });

  it("D2: invalid / blank / out-of-bounds text, or a failed guard, updates ONLY the buffer and retains the last valid canonical value", () => {
    for (const q of ["0", "", "abc", "04", "1.5", "1e3", "-1"]) {
      const next = applyServiceLineAdjustment(base(), WM1, { quantityInput: q, dedicatedMenuSync: WHEEL_SYNC });
      assert.deepEqual(wheelQty(next), { wm1: 4, wm2: 4 }, `canonical retained for "${q}"`);
      assert.equal(next.review.quantityInputsByLine[WM1], q, `buffer shows "${q}"`);
    }
    for (const q of ["0", "7", "99"]) {
      const next = applyServiceLineAdjustment(base(), GM1, { quantityInput: q, dedicatedMenuSync: GLASS_SYNC });
      assert.deepEqual(glassQty(next), { gm1: 1 }, `glass canonical retained for "${q}"`);
      assert.equal(next.review.quantityInputsByLine[GM1], q);
    }
    // guards: unselected menu, id/kind/code mismatch, absent section, malformed bounds, both syncs, unknown kind, no sync
    const cases: Array<[string, EstimateWizardDraftV22, string, ServiceLineAdjustmentPatch]> = [
      ["deselected menu", base((d) => { d.serviceConfiguration.wheel!.selectedMenuIds = ["wm2"]; }), WM1, { quantityInput: "5", dedicatedMenuSync: WHEEL_SYNC }],
      ["foreign code", base(), WM1, { quantityInput: "5", dedicatedMenuSync: { ...WHEEL_SYNC, menuCode: "wm2" } }],
      ["line id of the other kind", base(), dedicatedMenuReviewLineId("glass", "wm1"), { quantityInput: "5", dedicatedMenuSync: WHEEL_SYNC }],
      ["kind/code hint for another line", base(), GM1, { quantityInput: "5", dedicatedMenuSync: WHEEL_SYNC }],
      ["PPF-shaped id", base(), partialPpfReviewLineId("t1", "wm1"), { quantityInput: "5", dedicatedMenuSync: WHEEL_SYNC }],
      ["legacy draft without the section", base((d) => { delete d.serviceConfiguration.wheel; }), WM1, { quantityInput: "5", dedicatedMenuSync: WHEEL_SYNC }],
      ["malformed min", base(), WM1, { quantityInput: "5", dedicatedMenuSync: { ...WHEEL_SYNC, minQuantity: 0 } }],
      ["malformed max", base(), WM1, { quantityInput: "5", dedicatedMenuSync: { ...WHEEL_SYNC, maxQuantity: 0 } }],
      ["blank code", base(), "manual:wheel:", { quantityInput: "5", dedicatedMenuSync: { ...WHEEL_SYNC, menuCode: " " } }],
      ["unknown kind", base(), "manual:other:wm1", { quantityInput: "5", dedicatedMenuSync: { ...WHEEL_SYNC, kind: "other" as unknown as "wheel" } }],
      ["both sync hints", base(), WM1, { quantityInput: "5", dedicatedMenuSync: WHEEL_SYNC, ppfPartSync: { partCode: "wm1", minQuantity: 1, maxQuantity: null } }],
      ["no sync (store-option contract)", base(), WM1, { quantityInput: "5" }],
    ];
    for (const [label, d, id, patch] of cases) {
      const next = applyServiceLineAdjustment(d, id, patch);
      assert.deepEqual(next.serviceConfiguration.wheel?.quantitiesByMenu, d.serviceConfiguration.wheel?.quantitiesByMenu, `${label}: no wheel write`);
      assert.deepEqual(glassQty(next), { gm1: 1 }, `${label}: no glass write`);
      assert.equal(next.serviceConfiguration.ppf.quantitiesByPart.wm1, undefined, `${label}: no PPF write`);
      assert.equal(next.review.quantityInputsByLine[id], "5", `${label}: buffer only`);
    }
    // a unit-price edit carrying the hint never touches a quantity anywhere
    const priceOnly = applyServiceLineAdjustment(base(), WM1, { unitPriceInput: "8100", dedicatedMenuSync: WHEEL_SYNC });
    assert.deepEqual(wheelQty(priceOnly), { wm1: 4, wm2: 4 });
    assert.deepEqual(priceOnly.review.quantityInputsByLine, {});
    assert.equal(priceOnly.review.unitPriceInputsByLine[WM1], "8100");
  });

  it("D3: a later Step-4 quantity change clears ONLY that menu's buffer; selecting a menu or editing its price clears nothing", () => {
    const prev = base((d) => { d.review.quantityInputsByLine = { [WM1]: "5", [WM2]: "abc", [GM1]: "3", "manual:store_global_options:go-q": "4", "manual:ppf:ppf_r1_partial_t1_bonnet": "3" }; });
    const wheelSection = (over: Partial<EstimateWizardDraftV22["serviceConfiguration"]["wheel"] & object>) =>
      ({ ...prev, serviceConfiguration: { ...prev.serviceConfiguration, wheel: { ...prev.serviceConfiguration.wheel!, ...over } } });
    const wm1Changed = wheelSection({ quantitiesByMenu: { wm1: 6, wm2: 4 } });
    const r1 = reconcileDedicatedMenuReviewOverrides(prev, wm1Changed);
    assert.deepEqual(r1.review.quantityInputsByLine, { [WM2]: "abc", [GM1]: "3", "manual:store_global_options:go-q": "4", "manual:ppf:ppf_r1_partial_t1_bonnet": "3" });
    assert.equal(r1.review.previewConfirmed, false);
    assert.deepEqual(r1.review.unitPriceInputsByLine, prev.review.unitPriceInputsByLine, "unit-price buffers untouched");
    const wm2Changed = wheelSection({ quantitiesByMenu: { wm1: 4, wm2: 3 } });
    assert.deepEqual(reconcileDedicatedMenuReviewOverrides(prev, wm2Changed).review.quantityInputsByLine, { [WM1]: "5", [GM1]: "3", "manual:store_global_options:go-q": "4", "manual:ppf:ppf_r1_partial_t1_bonnet": "3" }, "malformed wm2 buffer cleared by the wm2 edit; wm1 kept");
    const glassChanged = { ...prev, serviceConfiguration: { ...prev.serviceConfiguration, glass: { ...prev.serviceConfiguration.glass!, quantitiesByMenu: { gm1: 2 } } } };
    assert.deepEqual(reconcileDedicatedMenuReviewOverrides(prev, glassChanged).review.quantityInputsByLine, { [WM1]: "5", [WM2]: "abc", "manual:store_global_options:go-q": "4", "manual:ppf:ppf_r1_partial_t1_bonnet": "3" });
    const priceEdited = wheelSection({ unitPricesByMenu: { wm1: "8500", wm2: "3000" } });
    assert.equal(reconcileDedicatedMenuReviewOverrides(prev, priceEdited), priceEdited, "price edit: same object, no buffer change");
    const selectedMore = wheelSection({ selectedMenuIds: ["wm1", "wm2", "wm3"], quantitiesByMenu: { wm1: 4, wm2: 4, wm3: 4 } });
    assert.equal(reconcileDedicatedMenuReviewOverrides(prev, selectedMore), selectedMore, "newly selected menu with no buffer: nothing stale");
    assert.equal(reconcileDedicatedMenuReviewOverrides(prev, prev), prev);
  });

  it("D4: deselecting a menu at Step 4 clears its buffer so a reselect never resurrects stale review text; a vanished section clears every buffer of that kind only", () => {
    const prev = base((d) => { d.review.quantityInputsByLine = { [WM1]: "abc", [WM2]: "5", [GM1]: "3", "manual:store_global_options:go-q": "4" }; });
    const deselected = { ...prev, serviceConfiguration: { ...prev.serviceConfiguration, wheel: { ...prev.serviceConfiguration.wheel!, selectedMenuIds: ["wm2"] } } };
    const r = reconcileDedicatedMenuReviewOverrides(prev, deselected);
    assert.deepEqual(r.review.quantityInputsByLine, { [WM2]: "5", [GM1]: "3", "manual:store_global_options:go-q": "4" });
    assert.deepEqual(r.serviceConfiguration.wheel!.quantitiesByMenu, { wm1: 4, wm2: 4 }, "Step-4 quantity kept in the draft (B5b2), only the review buffer dropped");
    // reselect: the canonical quantity is still 4 and no stale "abc" comes back
    const reselected = { ...r, serviceConfiguration: { ...r.serviceConfiguration, wheel: { ...r.serviceConfiguration.wheel!, selectedMenuIds: ["wm2", "wm1"] } } };
    const r2 = reconcileDedicatedMenuReviewOverrides(r, reselected);
    assert.equal(r2, reselected);
    assert.equal(WM1 in r2.review.quantityInputsByLine, false);
    const gone = { ...prev, serviceConfiguration: { ...prev.serviceConfiguration } };
    delete gone.serviceConfiguration.glass;
    assert.deepEqual(reconcileDedicatedMenuReviewOverrides(prev, gone).review.quantityInputsByLine, { [WM1]: "abc", [WM2]: "5", "manual:store_global_options:go-q": "4" });
  });

  it("round trip: Step 7 → Step 4 → Step 7 never leaves a valid contradiction; the PPF reconciler leaves dedicated buffers alone and vice versa", () => {
    const afterReview = applyServiceLineAdjustment(base(), WM1, { quantityInput: "5", dedicatedMenuSync: WHEEL_SYNC });
    assert.equal(wheelQty(afterReview).wm1, 5);
    const step4 = { ...afterReview, serviceConfiguration: { ...afterReview.serviceConfiguration, wheel: { ...afterReview.serviceConfiguration.wheel!, quantitiesByMenu: { wm1: 2, wm2: 4 } } } };
    const reconciled = reconcileDedicatedMenuReviewOverrides(afterReview, reconcilePartialPpfReviewOverrides(afterReview, step4));
    assert.equal(wheelQty(reconciled).wm1, 2);
    assert.equal(WM1 in reconciled.review.quantityInputsByLine, false, "review follows the new canonical quantity");
    // composition order is irrelevant and each reconciler only removes its own stale buffers
    const mixed = base((d) => { d.review.quantityInputsByLine = { [WM1]: "5", [partialPpfReviewLineId("t1", "bonnet")]: "3" }; d.serviceConfiguration.ppf = { ...d.serviceConfiguration.ppf, installationMethod: "partial", ppfTypeId: "t1", selectedPartIds: ["bonnet"], quantitiesByPart: { bonnet: 2 } }; });
    const ppfOnly = { ...mixed, serviceConfiguration: { ...mixed.serviceConfiguration, ppf: { ...mixed.serviceConfiguration.ppf, quantitiesByPart: { bonnet: 3 } } } };
    assert.deepEqual(reconcileDedicatedMenuReviewOverrides(mixed, ppfOnly).review.quantityInputsByLine, mixed.review.quantityInputsByLine, "dedicated reconciler ignores a PPF-only change");
    assert.deepEqual(reconcilePartialPpfReviewOverrides(mixed, ppfOnly).review.quantityInputsByLine, { [WM1]: "5" });
    const wheelOnly = { ...mixed, serviceConfiguration: { ...mixed.serviceConfiguration, wheel: { ...mixed.serviceConfiguration.wheel!, quantitiesByMenu: { wm1: 6, wm2: 4 } } } };
    assert.deepEqual(reconcilePartialPpfReviewOverrides(mixed, wheelOnly).review.quantityInputsByLine, mixed.review.quantityInputsByLine, "PPF reconciler ignores a wheel-only change");
    assert.deepEqual(reconcileDedicatedMenuReviewOverrides(mixed, wheelOnly).review.quantityInputsByLine, { [partialPpfReviewLineId("t1", "bonnet")]: "3" });
  });
});

// ── GDA-OTHER-COATINGS-R1 (C4) — other-coating lines: fixed-one read-only, quantity-bearing editable + synced ──
describe("Step7Review — an other-coating line renders read-only (fixed-one) or editable with dedicatedMenuSync { kind: other_coating } (quantity-bearing)", () => {
  const fixedOneLine = {
    kind: "manual" as const, category: "other_coating", sourceId: "other_coating:oc1", label: "樹脂パーツコーティング",
    quantity: 1, unitPrice: 6_000, lineSubtotal: 6_000, discountAmount: null, taxAmount: null,
    lineTotal: 6_000, pricingReferenceId: null, catalogLineRole: null, quantityPolicy: null,
  };
  const boundedLine = {
    kind: "manual" as const, category: "other_coating", sourceId: "other_coating:oc2", label: "シートコーティング",
    quantity: 2, unitPrice: 4_000, lineSubtotal: 8_000, discountAmount: null, taxAmount: null,
    lineTotal: 8_000, pricingReferenceId: null, catalogLineRole: null,
    quantityPolicy: { minQuantity: 1, maxQuantity: 5, dedicatedMenu: { kind: "other_coating" as const, menuCode: "oc2" } },
  };
  const unboundedLine = {
    kind: "manual" as const, category: "other_coating", sourceId: "other_coating:oc3", label: "エンジンルームコーティング",
    quantity: 3, unitPrice: 2_500, lineSubtotal: 7_500, discountAmount: null, taxAmount: null,
    lineTotal: 7_500, pricingReferenceId: null, catalogLineRole: null,
    quantityPolicy: { minQuantity: 1, maxQuantity: null, dedicatedMenu: { kind: "other_coating" as const, menuCode: "oc3" } },
  };
  const wheelLine = {
    kind: "manual" as const, category: "wheel", sourceId: "wheel:wm1", label: "ホイールコート",
    quantity: 4, unitPrice: 8_000, lineSubtotal: 32_000, discountAmount: null, taxAmount: null,
    lineTotal: 32_000, pricingReferenceId: null, catalogLineRole: null,
    quantityPolicy: { minQuantity: 1, maxQuantity: null, dedicatedMenu: { kind: "wheel" as const, menuCode: "wm1" } },
  };
  const coatingLine = {
    kind: "catalog" as const, category: "coating", sourceId: "coating:PURE EVO", label: "PURE EVO",
    quantity: 1, unitPrice: 80_000, lineSubtotal: 80_000, discountAmount: null, taxAmount: null,
    lineTotal: 80_000, pricingReferenceId: "pure-evo", catalogLineRole: "base" as const, quantityPolicy: null,
  };
  const pricing: WizardPricingResult = { ...EMPTY_WIZARD_PRICING_RESULT, lines: [coatingLine, wheelLine, fixedOneLine, boundedLine, unboundedLine] };

  it("fixed-one × 1 renders the read-only quantity with NO number input; quantity-bearing renders a bounded input under その他コーティング; body coating stays read-only; no 共通オプション", () => {
    const api = {
      ...apiFor(storeWith({ categories: ["coating", "wheel", "other_coating"] })),
      draft: { review: { serviceLineOrder: [], quantityInputsByLine: { "manual:other_coating:oc3": "abc" }, unitPriceInputsByLine: {} } },
    } as unknown as EstimateWizardApi;
    const html = renderToStaticMarkup(<Step7Review api={api} customers={CUSTOMERS} vehicles={VEHICLES} pricing={pricing} />);
    assert.equal(rowValue(html, "作業"), "ボディコーティング / ホイール / その他コーティング");
    assert.doesNotMatch(html, /<input[^>]*aria-label="樹脂パーツコーティングの数量"/, "fixed-one: no quantity input");
    assert.match(html, /<input[^>]*type="number"[^>]*min="1"[^>]*max="5"[^>]*aria-label="シートコーティングの数量"[^>]*value="2"/, "quantity-bearing: configured min/max, canonical 2 prefilled");
    assert.match(html, /<input[^>]*type="number"[^>]*min="1"[^>]*aria-label="エンジンルームコーティングの数量"[^>]*value="abc"/, "unbounded above: min only; invalid draft text stays visible");
    assert.doesNotMatch(html, /<input[^>]*max="[^"]*"[^>]*aria-label="エンジンルームコーティングの数量"/);
    assert.equal((html.match(/の数量"/g) ?? []).length, 3, "wheel + two quantity-bearing other-coating inputs");
    assert.equal((html.match(/data-testid="review-quantity-fixed"/g) ?? []).length, 2, "fixed-one other coating + body coating read-only");
    assert.equal((html.match(/data-testid="review-quantity-stale-reset"/g) ?? []).length, 0, "identity draft on the fixed-one line: no reset");
    assert.match(html, /その他コーティング・¥6,000/);
    assert.match(html, /その他コーティング・¥8,000/);
    assert.equal((html.match(/共通オプション/g) ?? []).length, 0, "never labeled as a store option");
    // unit price stays editable on the fixed-one line too
    assert.match(html, /<input[^>]*aria-label="樹脂パーツコーティングの金額（単価）"[^>]*value="6000"/);
    assert.match(html, /<input[^>]*aria-label="シートコーティングの金額（単価）"[^>]*value="4000"/);
  });

  it("the quantity-bearing handler submits { quantityInput, dedicatedMenuSync: { kind: other_coating, menuCode, bounds } }; the fixed-one line has NO quantity handler and its unit price submits only unitPriceInput; wheel unchanged", () => {
    const calls: Array<[string, ServiceLineAdjustmentPatch]> = [];
    const api = { ...apiFor(storeWith()), setServiceLineAdjustment: (id: string, patch: ServiceLineAdjustmentPatch) => { calls.push([id, patch]); } } as unknown as EstimateWizardApi;
    const tree = Step7Review({ api, customers: CUSTOMERS, vehicles: VEHICLES, pricing });
    type Change = (e: { target: { value: string } }) => void;
    (findByAriaLabel(tree, "シートコーティングの数量")!.props.onChange as Change)({ target: { value: "4" } });
    (findByAriaLabel(tree, "エンジンルームコーティングの数量")!.props.onChange as Change)({ target: { value: "" } });
    (findByAriaLabel(tree, "樹脂パーツコーティングの金額（単価）")!.props.onChange as Change)({ target: { value: "7000" } });
    (findByAriaLabel(tree, "ホイールコートの数量")!.props.onChange as Change)({ target: { value: "5" } });
    assert.deepEqual(calls, [
      ["manual:other_coating:oc2", { quantityInput: "4", dedicatedMenuSync: { kind: "other_coating", menuCode: "oc2", minQuantity: 1, maxQuantity: 5 } }],
      ["manual:other_coating:oc3", { quantityInput: "", dedicatedMenuSync: { kind: "other_coating", menuCode: "oc3", minQuantity: 1, maxQuantity: null } }],
      ["manual:other_coating:oc1", { unitPriceInput: "7000" }],
      ["manual:wheel:wm1", { quantityInput: "5", dedicatedMenuSync: { kind: "wheel", menuCode: "wm1", minQuantity: 1, maxQuantity: null } }],
    ]);
    assert.equal(findByAriaLabel(tree, "樹脂パーツコーティングの数量"), null, "fixed-one line has no quantity control");
    assert.equal(findByAriaLabel(tree, "PURE EVOの数量"), null);
  });

  it("a stale non-identity draft quantity on the fixed-one line offers ONLY the labeled reset to 1 — still no number input", () => {
    const api = {
      ...apiFor(storeWith()),
      draft: { review: { serviceLineOrder: [], quantityInputsByLine: { "manual:other_coating:oc1": "3" }, unitPriceInputsByLine: {} } },
    } as unknown as EstimateWizardApi;
    const html = renderToStaticMarkup(<Step7Review api={api} customers={CUSTOMERS} vehicles={VEHICLES} pricing={pricing} />);
    assert.doesNotMatch(html, /<input[^>]*aria-label="樹脂パーツコーティングの数量"/);
    assert.match(html, /data-testid="review-quantity-stale-notice"[^>]*>下書きに残った数量「3」は使用できません。/);
    assert.match(html, /aria-label="樹脂パーツコーティングの数量を1に戻す"/);
    assert.equal((html.match(/data-testid="review-quantity-stale-reset"/g) ?? []).length, 1);
  });

  it("C5 F2: the unit-price input min mirrors the per-line positive-price rule — 1 on every other_coating line (fixed-one and quantity-bearing), 0 on wheel / body coating; handlers unchanged", () => {
    const html = renderToStaticMarkup(<Step7Review api={apiFor(storeWith())} customers={CUSTOMERS} vehicles={VEHICLES} pricing={pricing} />);
    assert.match(html, /<input[^>]*type="number"[^>]*min="1"[^>]*step="1"[^>]*aria-label="樹脂パーツコーティングの金額（単価）"[^>]*value="6000"/, "fixed-one other coating: min 1");
    assert.match(html, /<input[^>]*type="number"[^>]*min="1"[^>]*step="1"[^>]*aria-label="シートコーティングの金額（単価）"[^>]*value="4000"/, "quantity-bearing other coating: min 1");
    assert.match(html, /<input[^>]*type="number"[^>]*min="1"[^>]*step="1"[^>]*aria-label="エンジンルームコーティングの金額（単価）"[^>]*value="2500"/, "unbounded other coating: min 1");
    assert.match(html, /<input[^>]*type="number"[^>]*min="0"[^>]*step="1"[^>]*aria-label="ホイールコートの金額（単価）"[^>]*value="8000"/, "wheel keeps min 0");
    assert.match(html, /<input[^>]*type="number"[^>]*min="0"[^>]*step="1"[^>]*aria-label="PURE EVOの金額（単価）"[^>]*value="80000"/, "body coating keeps min 0");
    assert.equal((html.match(/min="1"[^>]*の金額（単価）"/g) ?? []).length, 3, "exactly the three other-coating lines carry min 1");
    // Presentation only: the unit-price handler still submits ONLY unitPriceInput (the adjuster decides).
    const calls: Array<[string, ServiceLineAdjustmentPatch]> = [];
    const api = { ...apiFor(storeWith()), setServiceLineAdjustment: (id: string, patch: ServiceLineAdjustmentPatch) => { calls.push([id, patch]); } } as unknown as EstimateWizardApi;
    const tree = Step7Review({ api, customers: CUSTOMERS, vehicles: VEHICLES, pricing });
    type Change = (e: { target: { value: string } }) => void;
    (findByAriaLabel(tree, "樹脂パーツコーティングの金額（単価）")!.props.onChange as Change)({ target: { value: "0" } });
    assert.deepEqual(calls, [["manual:other_coating:oc1", { unitPriceInput: "0" }]], "the text reaches the draft buffer verbatim; refusal is the adjuster's, not a silent UI swallow");
  });
});

describe("useEstimateWizard pure reducers — Step 4 ↔ final review other-coating quantity sync (C4)", () => {
  const OC1 = dedicatedMenuReviewLineId("other_coating", "oc1");
  const OC2 = dedicatedMenuReviewLineId("other_coating", "oc2");
  const WM1 = dedicatedMenuReviewLineId("wheel", "wm1");
  const OC2_SYNC = { kind: "other_coating" as const, menuCode: "oc2", minQuantity: 1, maxQuantity: 5 };
  const base = (over?: (d: EstimateWizardDraftV22) => void): EstimateWizardDraftV22 => {
    const d = resetWizardDraft();
    d.serviceSelection.selectedCategories = ["wheel", "other_coating"];
    d.serviceConfiguration.wheel = { selectedMenuIds: ["wm1"], unitPricesByMenu: { wm1: "8000" }, quantitiesByMenu: { wm1: 4 } };
    d.serviceConfiguration.otherCoating = { selectedMenuIds: ["oc1", "oc2"], unitPricesByMenu: { oc1: "6000", oc2: "4000" }, quantitiesByMenu: { oc1: 1, oc2: 2 } };
    d.review = { ...d.review, previewConfirmed: true, unitPriceInputsByLine: { [OC1]: "5900" } };
    over?.(d);
    return d;
  };
  const ocQty = (d: EstimateWizardDraftV22) => d.serviceConfiguration.otherCoating!.quantitiesByMenu;
  const wheelQty = (d: EstimateWizardDraftV22) => d.serviceConfiguration.wheel!.quantitiesByMenu;

  it("drift pin: the hook's line id equals wizardPricingLineId of a C4 other-coating line — manual:other_coating:<code>", () => {
    const line = { kind: "manual" as const, category: "other_coating", sourceId: "other_coating:oc2", label: "", quantity: 1, unitPrice: 1, lineSubtotal: 1, discountAmount: null, taxAmount: null, lineTotal: 1, pricingReferenceId: null, catalogLineRole: null };
    assert.equal(OC2, wizardPricingLineId(line));
    assert.equal(OC2, "manual:other_coating:oc2");
  });

  it("E1: a valid in-bounds review edit writes through to services.otherCoating.quantitiesByMenu ONLY and keeps the identical buffer text; wheel / glass / unit prices untouched", () => {
    const next = applyServiceLineAdjustment(base(), OC2, { quantityInput: "4", dedicatedMenuSync: OC2_SYNC });
    assert.deepEqual(ocQty(next), { oc1: 1, oc2: 4 }, "only oc2 written; the fixed-one entry untouched");
    assert.deepEqual(wheelQty(next), { wm1: 4 }, "wheel section untouched");
    assert.equal(next.serviceConfiguration.glass?.selectedMenuIds.length ?? 0, 0, "glass section untouched");
    assert.deepEqual(next.review.quantityInputsByLine, { [OC2]: "4" });
    assert.deepEqual(next.review.unitPriceInputsByLine, { [OC1]: "5900" }, "unit-price buffers untouched");
    assert.equal(next.review.previewConfirmed, false);
    assert.deepEqual(next.serviceConfiguration.otherCoating!.selectedMenuIds, ["oc1", "oc2"]);
    assert.deepEqual(next.serviceConfiguration.otherCoating!.unitPricesByMenu, { oc1: "6000", oc2: "4000" }, "Step-4 unit prices untouched");
    const max = applyServiceLineAdjustment(base(), OC2, { quantityInput: "5", dedicatedMenuSync: OC2_SYNC });
    assert.deepEqual(ocQty(max), { oc1: 1, oc2: 5 }, "max bound inclusive");
    const identity = applyServiceLineAdjustment(base(), OC2, { quantityInput: "2", dedicatedMenuSync: OC2_SYNC });
    assert.deepEqual(ocQty(identity), { oc1: 1, oc2: 2 });
    assert.deepEqual(identity.review.quantityInputsByLine, { [OC2]: "2" });
  });

  it("E2: invalid / blank / out-of-bounds text, a fixed-one hint, or a failed guard updates ONLY the buffer and retains the canonical value", () => {
    for (const q of ["0", "", "abc", "04", "1.5", "6", "-1"]) {
      const next = applyServiceLineAdjustment(base(), OC2, { quantityInput: q, dedicatedMenuSync: OC2_SYNC });
      assert.deepEqual(ocQty(next), { oc1: 1, oc2: 2 }, `canonical retained for "${q}"`);
      assert.equal(next.review.quantityInputsByLine[OC2], q, `buffer shows "${q}"`);
    }
    const cases: Array<[string, EstimateWizardDraftV22, string, ServiceLineAdjustmentPatch]> = [
      ["deselected menu", base((d) => { d.serviceConfiguration.otherCoating!.selectedMenuIds = ["oc1"]; }), OC2, { quantityInput: "4", dedicatedMenuSync: OC2_SYNC }],
      ["foreign code", base(), OC2, { quantityInput: "4", dedicatedMenuSync: { ...OC2_SYNC, menuCode: "oc1" } }],
      ["wheel-kind hint on an other-coating id", base(), OC2, { quantityInput: "4", dedicatedMenuSync: { ...OC2_SYNC, kind: "wheel" } }],
      ["other-coating hint on a wheel id", base(), WM1, { quantityInput: "4", dedicatedMenuSync: { ...OC2_SYNC, menuCode: "wm1" } }],
      ["legacy draft without the section", base((d) => { delete d.serviceConfiguration.otherCoating; }), OC2, { quantityInput: "4", dedicatedMenuSync: OC2_SYNC }],
      ["malformed min", base(), OC2, { quantityInput: "4", dedicatedMenuSync: { ...OC2_SYNC, minQuantity: 0 } }],
      ["malformed max", base(), OC2, { quantityInput: "4", dedicatedMenuSync: { ...OC2_SYNC, maxQuantity: 0 } }],
      ["both sync hints", base(), OC2, { quantityInput: "4", dedicatedMenuSync: OC2_SYNC, ppfPartSync: { partCode: "oc2", minQuantity: 1, maxQuantity: null } }],
      ["no sync (store-option contract)", base(), OC2, { quantityInput: "4" }],
      // A fixed-one row never earns a sync from the pricing route; even a forged hint cannot move it past 1 → 1..1 rejects 4.
      ["forged fixed-one hint", base(), OC1, { quantityInput: "4", dedicatedMenuSync: { kind: "other_coating", menuCode: "oc1", minQuantity: 1, maxQuantity: 1 } }],
    ];
    for (const [label, d, id, patch] of cases) {
      const next = applyServiceLineAdjustment(d, id, patch);
      assert.deepEqual(next.serviceConfiguration.otherCoating?.quantitiesByMenu, d.serviceConfiguration.otherCoating?.quantitiesByMenu, `${label}: no other-coating write`);
      assert.deepEqual(wheelQty(next), { wm1: 4 }, `${label}: no wheel write`);
      assert.equal(next.serviceConfiguration.ppf.quantitiesByPart.oc2, undefined, `${label}: no PPF write`);
      assert.equal(next.review.quantityInputsByLine[id], "4", `${label}: buffer only`);
    }
    const priceOnly = applyServiceLineAdjustment(base(), OC2, { unitPriceInput: "4100", dedicatedMenuSync: OC2_SYNC });
    assert.deepEqual(ocQty(priceOnly), { oc1: 1, oc2: 2 });
    assert.deepEqual(priceOnly.review.quantityInputsByLine, {});
    assert.equal(priceOnly.review.unitPriceInputsByLine[OC2], "4100");
  });

  it("E3: a later Step-4 change clears ONLY that menu's buffer; deselect clears its buffer; a vanished section clears only other-coating buffers; wheel changes leave them alone", () => {
    const prev = base((d) => { d.review.quantityInputsByLine = { [OC2]: "4", [OC1]: "3", [WM1]: "5", "manual:store_global_options:go-q": "4" }; });
    const ocSection = (over: Partial<NonNullable<EstimateWizardDraftV22["serviceConfiguration"]["otherCoating"]>>) =>
      ({ ...prev, serviceConfiguration: { ...prev.serviceConfiguration, otherCoating: { ...prev.serviceConfiguration.otherCoating!, ...over } } });
    const oc2Changed = ocSection({ quantitiesByMenu: { oc1: 1, oc2: 3 } });
    const r1 = reconcileDedicatedMenuReviewOverrides(prev, oc2Changed);
    assert.deepEqual(r1.review.quantityInputsByLine, { [OC1]: "3", [WM1]: "5", "manual:store_global_options:go-q": "4" });
    assert.equal(r1.review.previewConfirmed, false);
    assert.deepEqual(r1.review.unitPriceInputsByLine, prev.review.unitPriceInputsByLine, "unit-price buffers untouched");
    const deselected = ocSection({ selectedMenuIds: ["oc2"] });
    assert.deepEqual(reconcileDedicatedMenuReviewOverrides(prev, deselected).review.quantityInputsByLine, { [OC2]: "4", [WM1]: "5", "manual:store_global_options:go-q": "4" }, "stale oc1 buffer dropped on deselect");
    const priceEdited = ocSection({ unitPricesByMenu: { oc1: "6500", oc2: "4000" } });
    assert.equal(reconcileDedicatedMenuReviewOverrides(prev, priceEdited), priceEdited, "price edit: same object, no buffer change");
    const gone = { ...prev, serviceConfiguration: { ...prev.serviceConfiguration } };
    delete gone.serviceConfiguration.otherCoating;
    assert.deepEqual(reconcileDedicatedMenuReviewOverrides(prev, gone).review.quantityInputsByLine, { [WM1]: "5", "manual:store_global_options:go-q": "4" }, "only other-coating buffers cleared");
    const wheelChanged = { ...prev, serviceConfiguration: { ...prev.serviceConfiguration, wheel: { ...prev.serviceConfiguration.wheel!, quantitiesByMenu: { wm1: 2 } } } };
    assert.deepEqual(reconcileDedicatedMenuReviewOverrides(prev, wheelChanged).review.quantityInputsByLine, { [OC2]: "4", [OC1]: "3", "manual:store_global_options:go-q": "4" }, "a wheel change clears only the wheel buffer");
    assert.equal(reconcileDedicatedMenuReviewOverrides(prev, prev), prev);
    // round trip: Step 7 → Step 4 → Step 7 never leaves a valid contradiction
    const afterReview = applyServiceLineAdjustment(base(), OC2, { quantityInput: "4", dedicatedMenuSync: OC2_SYNC });
    const step4 = { ...afterReview, serviceConfiguration: { ...afterReview.serviceConfiguration, otherCoating: { ...afterReview.serviceConfiguration.otherCoating!, quantitiesByMenu: { oc1: 1, oc2: 3 } } } };
    const reconciled = reconcileDedicatedMenuReviewOverrides(afterReview, reconcilePartialPpfReviewOverrides(afterReview, step4));
    assert.equal(ocQty(reconciled).oc2, 3);
    assert.equal(OC2 in reconciled.review.quantityInputsByLine, false, "review follows the new canonical quantity");
  });
});
