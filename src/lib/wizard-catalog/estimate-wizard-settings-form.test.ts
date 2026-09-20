// C2C4 — pure validation tests for the settings add/edit form (no DB, no React).
// Run: node --import tsx --test src/lib/wizard-catalog/estimate-wizard-settings-form.test.ts

import { test } from "node:test";
import assert from "node:assert/strict";

import { validateWizardItemForm } from "./estimate-wizard-settings-form";

function ok(r: ReturnType<typeof validateWizardItemForm>) {
  assert.equal(r.ok, true, "expected ok:true, got " + JSON.stringify(r));
  return (r as Extract<typeof r, { ok: true }>).input;
}
function err(r: ReturnType<typeof validateWizardItemForm>) {
  assert.equal(r.ok, false, "expected ok:false, got " + JSON.stringify(r));
  return (r as Extract<typeof r, { ok: false }>).errors;
}

// ── valid payloads ─────────────────────────────────────────────────────────
test("valid add payload (maintenance) → exact C2C3 input shape", () => {
  const input = ok(validateWizardItemForm({
    kind: "maintenance_menu", labelJa: "オイル交換", priceYen: "3000", durationMinutes: "30", displayOrder: "1",
  }));
  assert.deepEqual(input, {
    itemId: null, kind: "maintenance_menu", labelJa: "オイル交換",
    displayOrder: 1, defaultUnitPrice: 3000, durationMinutes: 30,
  });
});

test("valid edit payload carries itemId", () => {
  const input = ok(validateWizardItemForm({ itemId: "abc-123", kind: "wash_menu", labelJa: "手洗い", priceYen: 2000 }));
  assert.equal(input.itemId, "abc-123");
  assert.equal(input.defaultUnitPrice, 2000);
});

test("valid film payload with presentation allowlist", () => {
  const input = ok(validateWizardItemForm({
    kind: "film_type", labelJa: "UV90", priceYen: 15000,
    presentation: { brand: "GYEON", vlt: "90%", heatRejection: "高", color: "クリア" },
  }));
  assert.deepEqual(input.presentation, { brand: "GYEON", vlt: "90%", heatRejection: "高", color: "クリア" });
});

test("valid store payload with quantity range", () => {
  const input = ok(validateWizardItemForm({
    kind: "store_global_option", labelJa: "出張費", priceYen: 5000,
    priceable: true, quantityRequired: true, minQuantity: 1, maxQuantity: 3,
  }));
  assert.equal(input.priceable, true);
  assert.equal(input.minQuantity, 1);
  assert.equal(input.maxQuantity, 3);
});

test("valid other_work has no price/duration (price omitted from payload)", () => {
  const input = ok(validateWizardItemForm({ kind: "other_work_preset", labelJa: "下回り防錆" }));
  assert.equal("defaultUnitPrice" in input, false);
  assert.equal("durationMinutes" in input, false);
});

// ── normalization ──────────────────────────────────────────────────────────
test("whitespace around the name is trimmed", () => {
  const input = ok(validateWizardItemForm({ kind: "wash_menu", labelJa: "  手洗い洗車  " }));
  assert.equal(input.labelJa, "手洗い洗車");
});

test("zero price is preserved as a valid value", () => {
  const input = ok(validateWizardItemForm({ kind: "maintenance_menu", labelJa: "点検", priceYen: 0 }));
  assert.equal(input.defaultUnitPrice, 0);
});

test("coupon is a supported authoring kind with an explicit rule", () => {
  const input = ok(validateWizardItemForm({
    kind: "coupon",
    labelJa: "100円引き",
    couponDiscountType: "amount",
    couponDiscountValue: 100,
    couponCombinable: false,
    couponValidFrom: "2026-09-20",
    couponValidTo: "2026-09-30",
  }));
  assert.deepEqual(input, {
    itemId: null,
    kind: "coupon",
    labelJa: "100円引き",
    couponDiscountType: "amount",
    couponDiscountValue: 100,
    couponCombinable: false,
    couponValidFrom: "2026-09-20",
    couponValidTo: "2026-09-30",
  });
});

// ── rejections ─────────────────────────────────────────────────────────────
test("blank required name is rejected (Japanese)", () => {
  const e = err(validateWizardItemForm({ kind: "wash_menu", labelJa: "   " }));
  assert.match(e.labelJa, /表示名/);
});

test("coupon without a rule is rejected, and an unknown kind remains unsupported", () => {
  const couponErrors = err(validateWizardItemForm({ kind: "coupon", labelJa: "x" }));
  assert.match(couponErrors.couponDiscountType, /割引種別/);
  assert.match(couponErrors.couponDiscountValue, /割引値/);
  assert.match(couponErrors.couponCombinable, /併用可否/);
  assert.match(err(validateWizardItemForm({ kind: "nonsense", labelJa: "x" })).kind, /種別/);
});

test("coupon validity rejects impossible dates and a reversed range before persistence", () => {
  const base = {
    kind: "coupon",
    labelJa: "x",
    couponDiscountType: "amount",
    couponDiscountValue: 100,
    couponCombinable: false,
  };
  assert.match(err(validateWizardItemForm({ ...base, couponValidFrom: "2026-02-30" })).couponValidFrom, /実在する日付/);
  assert.match(err(validateWizardItemForm({ ...base, couponValidTo: "2027-02-29" })).couponValidTo, /実在する日付/);
  assert.match(err(validateWizardItemForm({
    ...base,
    couponValidFrom: "2026-09-30",
    couponValidTo: "2026-09-20",
  })).couponValidTo, /開始日以降/);
  assert.equal(validateWizardItemForm({ ...base, couponValidFrom: "2028-02-29" }).ok, true);
});

test("negative price rejected", () => {
  assert.match(err(validateWizardItemForm({ kind: "maintenance_menu", labelJa: "x", priceYen: -5 })).priceYen, /価格/);
});

test("fractional yen rejected", () => {
  assert.match(err(validateWizardItemForm({ kind: "maintenance_menu", labelJa: "x", priceYen: "100.5" })).priceYen, /価格/);
  assert.match(err(validateWizardItemForm({ kind: "maintenance_menu", labelJa: "x", priceYen: 100.5 })).priceYen, /価格/);
});

test("NaN / Infinity price rejected", () => {
  assert.match(err(validateWizardItemForm({ kind: "maintenance_menu", labelJa: "x", priceYen: Number.NaN })).priceYen, /価格/);
  assert.match(err(validateWizardItemForm({ kind: "maintenance_menu", labelJa: "x", priceYen: Number.POSITIVE_INFINITY })).priceYen, /価格/);
  assert.match(err(validateWizardItemForm({ kind: "maintenance_menu", labelJa: "x", priceYen: "abc" })).priceYen, /価格/);
});

test("invalid duration rejected; fractional/zero/negative", () => {
  assert.match(err(validateWizardItemForm({ kind: "maintenance_menu", labelJa: "x", durationMinutes: 0 })).durationMinutes, /所要時間/);
  assert.match(err(validateWizardItemForm({ kind: "maintenance_menu", labelJa: "x", durationMinutes: -10 })).durationMinutes, /所要時間/);
  assert.match(err(validateWizardItemForm({ kind: "maintenance_menu", labelJa: "x", durationMinutes: "1.5" })).durationMinutes, /所要時間/);
});

test("invalid displayOrder rejected", () => {
  assert.match(err(validateWizardItemForm({ kind: "wash_menu", labelJa: "x", displayOrder: -1 })).displayOrder, /表示順/);
  assert.match(err(validateWizardItemForm({ kind: "wash_menu", labelJa: "x", displayOrder: "2.2" })).displayOrder, /表示順/);
});

test("store maxQuantity < minQuantity rejected", () => {
  assert.match(err(validateWizardItemForm({
    kind: "store_global_option", labelJa: "x", priceable: true, quantityRequired: true, minQuantity: 5, maxQuantity: 2,
  })).maxQuantity, /最大数量/);
});

test("store minQuantity < 1 rejected", () => {
  assert.match(err(validateWizardItemForm({
    kind: "store_global_option", labelJa: "x", priceable: true, quantityRequired: true, minQuantity: 0,
  })).minQuantity, /最小数量/);
});

// ── forbidden server-controlled fields ──────────────────────────────────────
test("dealer id is rejected", () => {
  assert.match(err(validateWizardItemForm({ kind: "wash_menu", labelJa: "x", dealerId: "d-1" }))._form, /許可されていない/);
  assert.match(err(validateWizardItemForm({ kind: "wash_menu", labelJa: "x", dealer_id: "d-1" }))._form, /許可されていない/);
});

test("dealer rank is rejected", () => {
  assert.match(err(validateWizardItemForm({ kind: "wash_menu", labelJa: "x", rank: "certified" }))._form, /許可されていない/);
  assert.match(err(validateWizardItemForm({ kind: "wash_menu", labelJa: "x", detailerRank: "certified" }))._form, /許可されていない/);
});

test("lifecycle / review / authorization / identity fields are rejected", () => {
  for (const bad of [
    { state: "CATALOG_REVIEWED" },
    { reviewedRevision: 3 },
    { revision: 9 },
    { ownerScope: "global" },
    { code: "forged-code" },
    { productMode: "generic" },
    { market: "us" },
  ]) {
    const e = err(validateWizardItemForm({ kind: "wash_menu", labelJa: "x", ...bad }));
    assert.match(e._form, /許可されていない/, `should reject ${JSON.stringify(bad)}`);
  }
});

test("film duration/quantity keys (cross-kind) are rejected as not-allowed", () => {
  assert.match(err(validateWizardItemForm({ kind: "film_type", labelJa: "x", durationMinutes: 10 }))._form, /許可されていない/);
  assert.match(err(validateWizardItemForm({ kind: "other_work_preset", labelJa: "x", priceYen: 100 }))._form, /許可されていない/);
});

test("bad presentation key/value rejected", () => {
  assert.match(err(validateWizardItemForm({ kind: "film_type", labelJa: "x", presentation: { hacker: "y" } })).presentation, /フィルム情報/);
  assert.match(err(validateWizardItemForm({ kind: "film_type", labelJa: "x", presentation: { brand: 5 } })).presentation, /フィルム情報/);
});
