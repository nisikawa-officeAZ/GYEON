// C2C4 — pure validation tests for the settings add/edit form (no DB, no React).
// Run: node --import tsx --test src/lib/wizard-catalog/estimate-wizard-settings-form.test.ts

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

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

// ── GDA-ESTIMATE-QUANTITY-POLICY-R1 (B5a): dedicated wheel / glass menus ──────────────────────
test("B5a: a wheel menu authors a tax-exclusive per-unit price and quantity bounds; quantity is required BY KIND", () => {
  const input = ok(validateWizardItemForm({
    kind: "wheel_menu", labelJa: "ホイールコーティング", priceYen: "8000", minQuantity: "1", maxQuantity: "4", displayOrder: "2",
  }));
  assert.deepEqual(input, {
    itemId: null, kind: "wheel_menu", labelJa: "ホイールコーティング",
    displayOrder: 2, defaultUnitPrice: 8000, quantityRequired: true, minQuantity: 1, maxQuantity: 4,
  });
});

test("B5a: a glass menu without a price OMITS the price (server stores null — never 0) and still requires quantity", () => {
  const input = ok(validateWizardItemForm({ kind: "glass_menu", labelJa: "ガラスコーティング" }));
  assert.equal("defaultUnitPrice" in input, false, "no price authored ⇒ no price field; null is 'not configured', not ¥0");
  assert.equal(input.quantityRequired, true, "quantity-bearing by kind, not by client choice");
  assert.equal("minQuantity" in input, false, "no explicit minimum authored ⇒ omitted (the server default applies)");
  assert.equal("maxQuantity" in input, false, "no maximum authored ⇒ omitted (no invented bound)");
  assert.equal("durationMinutes" in input, false);
  assert.equal("priceable" in input, false);
});

test("B5a: wheel/glass edits keep the stable itemId; an EXPLICIT zero price is preserved as authored", () => {
  const input = ok(validateWizardItemForm({ itemId: "wheel-item-1", kind: "wheel_menu", labelJa: "x", priceYen: 0, minQuantity: 2 }));
  assert.equal(input.itemId, "wheel-item-1");
  assert.equal(input.defaultUnitPrice, 0);
  assert.equal(input.minQuantity, 2);
  assert.equal(input.quantityRequired, true);
});

test("B5a: wheel/glass reject minQuantity < 1, maxQuantity < minQuantity, negative price, and every non-writable key", () => {
  for (const kind of ["wheel_menu", "glass_menu"]) {
    assert.match(err(validateWizardItemForm({ kind, labelJa: "x", minQuantity: 0 })).minQuantity, /最小数量/, kind);
    assert.match(err(validateWizardItemForm({ kind, labelJa: "x", minQuantity: "1.5" })).minQuantity, /最小数量/, kind);
    assert.match(err(validateWizardItemForm({ kind, labelJa: "x", minQuantity: 4, maxQuantity: 2 })).maxQuantity, /最大数量/, kind);
    assert.match(err(validateWizardItemForm({ kind, labelJa: "x", maxQuantity: 0 })).maxQuantity, /最大数量/, `${kind}: max below the implicit minimum of 1`);
    assert.match(err(validateWizardItemForm({ kind, labelJa: "x", priceYen: -1 })).priceYen, /価格/, kind);
    // Not client-writable: the kind itself decides these, so a client cannot switch quantity off,
    // make the menu unpriceable, or attach a duration nothing in the contract authorises.
    assert.match(err(validateWizardItemForm({ kind, labelJa: "x", quantityRequired: false }))._form, /許可されていない/, kind);
    assert.match(err(validateWizardItemForm({ kind, labelJa: "x", quantityRequired: true }))._form, /許可されていない/, kind);
    assert.match(err(validateWizardItemForm({ kind, labelJa: "x", priceable: false }))._form, /許可されていない/, kind);
    assert.match(err(validateWizardItemForm({ kind, labelJa: "x", durationMinutes: 30 }))._form, /許可されていない/, kind);
    assert.match(err(validateWizardItemForm({ kind, labelJa: "x", presentation: { brand: "x" } }))._form, /許可されていない/, kind);
    assert.match(err(validateWizardItemForm({ kind, labelJa: "x", dealerId: "d-1" }))._form, /許可されていない/, kind);
  }
});

test("B5a: the existing menu kinds do NOT acquire quantity fields (wheel/glass are dedicated, not a widening)", () => {
  for (const kind of ["maintenance_menu", "wash_menu", "room_cleaning_menu"]) {
    assert.match(err(validateWizardItemForm({ kind, labelJa: "x", minQuantity: 1 }))._form, /許可されていない/, kind);
    const input = ok(validateWizardItemForm({ kind, labelJa: "x", priceYen: 1000 }));
    assert.equal("quantityRequired" in input, false, `${kind} payload shape is unchanged`);
  }
});

// ── GDA-OTHER-COATINGS-R1 (B1): the extensible other_coating_menu kind ───────────────────────────
test("B1: an other_coating_menu authors name, POSITIVE unit price, an EXPLICIT quantity flag and bounds → exact payload", () => {
  const input = ok(validateWizardItemForm({
    kind: "other_coating_menu", labelJa: "ヘッドライトコーティング", priceYen: "6000",
    quantityRequired: true, minQuantity: "1", maxQuantity: "2", displayOrder: "3",
  }));
  assert.deepEqual(input, {
    itemId: null, kind: "other_coating_menu", labelJa: "ヘッドライトコーティング",
    displayOrder: 3, defaultUnitPrice: 6000, quantityRequired: true, minQuantity: 1, maxQuantity: 2,
  });
  assert.equal("durationMinutes" in input, false, "no duration on this kind");
  assert.equal("priceable" in input, false, "no priceable toggle on this kind");
});

test("B1: quantityRequired=false is CARRIED as false — never omitted — in both boolean and string form", () => {
  const b = ok(validateWizardItemForm({ kind: "other_coating_menu", labelJa: "x", priceYen: 6000, quantityRequired: false }));
  assert.equal("quantityRequired" in b, true, "false must be present in the payload");
  assert.equal(b.quantityRequired, false);
  const s = ok(validateWizardItemForm({ kind: "other_coating_menu", labelJa: "x", priceYen: 6000, quantityRequired: "false" }));
  assert.equal(s.quantityRequired, false);
  const t = ok(validateWizardItemForm({ kind: "other_coating_menu", labelJa: "x", priceYen: 6000, quantityRequired: "true" }));
  assert.equal(t.quantityRequired, true);
});

test("B1: the quantity flag is MANDATORY for other_coating_menu — absence or a non-boolean is an error, not false", () => {
  assert.match(err(validateWizardItemForm({ kind: "other_coating_menu", labelJa: "x", priceYen: 6000 })).quantityRequired, /数量指定/);
  assert.match(err(validateWizardItemForm({ kind: "other_coating_menu", labelJa: "x", priceYen: 6000, quantityRequired: "yes" })).quantityRequired, /数量指定/);
  assert.match(err(validateWizardItemForm({ kind: "other_coating_menu", labelJa: "x", priceYen: 6000, quantityRequired: 1 })).quantityRequired, /数量指定/);
  assert.match(err(validateWizardItemForm({ kind: "other_coating_menu", labelJa: "x", priceYen: 6000, quantityRequired: null })).quantityRequired, /数量指定/);
});

test("B1: a blank unit price is an EXPLICIT null (unconfigured) — never 0, never dropped", () => {
  for (const blank of [undefined, null, "", "   "]) {
    const rawRecord: Record<string, unknown> = { kind: "other_coating_menu", labelJa: "x", quantityRequired: false };
    if (blank !== undefined) rawRecord.priceYen = blank;
    const input = ok(validateWizardItemForm(rawRecord));
    assert.equal("defaultUnitPrice" in input, true, `blank ${JSON.stringify(blank)} must yield an explicit price key`);
    assert.equal(input.defaultUnitPrice, null, `blank ${JSON.stringify(blank)} must be null, not 0`);
  }
});

test("B1: 0 is REJECTED as a unit price for other_coating_menu, while wheel/glass still preserve an explicit 0 (no compatibility change)", () => {
  assert.match(err(validateWizardItemForm({ kind: "other_coating_menu", labelJa: "x", priceYen: 0, quantityRequired: false })).priceYen, /1以上/);
  assert.match(err(validateWizardItemForm({ kind: "other_coating_menu", labelJa: "x", priceYen: "0", quantityRequired: false })).priceYen, /1以上/);
  assert.match(err(validateWizardItemForm({ kind: "other_coating_menu", labelJa: "x", priceYen: -1, quantityRequired: false })).priceYen, /1以上/);
  assert.match(err(validateWizardItemForm({ kind: "other_coating_menu", labelJa: "x", priceYen: "100.5", quantityRequired: false })).priceYen, /1以上/);
  assert.match(err(validateWizardItemForm({ kind: "other_coating_menu", labelJa: "x", priceYen: "abc", quantityRequired: false })).priceYen, /1以上/);
  assert.equal(ok(validateWizardItemForm({ kind: "other_coating_menu", labelJa: "x", priceYen: 1, quantityRequired: false })).defaultUnitPrice, 1);
  // Wheel/glass compatibility is untouched: 0 preserved, blank omitted (not null).
  assert.equal(ok(validateWizardItemForm({ kind: "wheel_menu", labelJa: "x", priceYen: 0 })).defaultUnitPrice, 0);
  assert.equal(ok(validateWizardItemForm({ kind: "glass_menu", labelJa: "x", priceYen: 0 })).defaultUnitPrice, 0);
  assert.equal("defaultUnitPrice" in ok(validateWizardItemForm({ kind: "glass_menu", labelJa: "x" })), false);
  // …and the legacy store option still preserves 0 as well.
  assert.equal(ok(validateWizardItemForm({ kind: "store_global_option", labelJa: "x", priceYen: 0 })).defaultUnitPrice, 0);
});

test("B1: bounds must be positive and ordered; omitted bounds are omitted (no invented bound)", () => {
  const base = { kind: "other_coating_menu", labelJa: "x", priceYen: 6000, quantityRequired: true };
  assert.match(err(validateWizardItemForm({ ...base, minQuantity: 0 })).minQuantity, /最小数量/);
  assert.match(err(validateWizardItemForm({ ...base, minQuantity: -2 })).minQuantity, /最小数量/);
  assert.match(err(validateWizardItemForm({ ...base, minQuantity: "1.5" })).minQuantity, /最小数量/);
  assert.match(err(validateWizardItemForm({ ...base, maxQuantity: 0 })).maxQuantity, /最大数量/);
  assert.match(err(validateWizardItemForm({ ...base, maxQuantity: -1 })).maxQuantity, /最大数量/);
  assert.match(err(validateWizardItemForm({ ...base, minQuantity: 3, maxQuantity: 2 })).maxQuantity, /最大数量/);
  const eq = ok(validateWizardItemForm({ ...base, minQuantity: "2", maxQuantity: "2" }));
  assert.equal(eq.minQuantity, 2);
  assert.equal(eq.maxQuantity, 2);
  const none = ok(validateWizardItemForm({ ...base }));
  assert.equal("minQuantity" in none, false);
  assert.equal("maxQuantity" in none, false);
  // C5 F3: bounds on a FIXED-ONE row (quantityRequired false) are a contradiction and are REJECTED —
  // see the dedicated C5 F3 test below. (B1 previously accepted them; the SQL policy refuses them.)
  assert.equal(validateWizardItemForm({ ...base, quantityRequired: false, minQuantity: 1, maxQuantity: 4 }).ok, false);
});

// ── GDA-OTHER-COATINGS-R1 (C5 F3): fixed-one other_coating_menu rows carry NO bounds ─────────────
test("C5 F3: a FIXED-ONE other_coating_menu (quantityRequired=false) REJECTS authored min/max with a field error and never carries bounds; blank bounds are fine", () => {
  const fixed = { kind: "other_coating_menu", labelJa: "x", priceYen: 6000, quantityRequired: false };
  assert.match(err(validateWizardItemForm({ ...fixed, minQuantity: 1 })).minQuantity, /最小数量・最大数量を設定できません/);
  assert.match(err(validateWizardItemForm({ ...fixed, maxQuantity: 4 })).maxQuantity, /最小数量・最大数量を設定できません/);
  const both = err(validateWizardItemForm({ ...fixed, minQuantity: "2", maxQuantity: "5" }));
  assert.match(both.minQuantity, /設定できません/);
  assert.match(both.maxQuantity, /設定できません/);
  // string-form false is the same decision
  assert.match(err(validateWizardItemForm({ ...fixed, quantityRequired: "false", minQuantity: 1 })).minQuantity, /設定できません/);
  // a malformed bound on a fixed-one row is still an error (never silently dropped)
  assert.equal(validateWizardItemForm({ ...fixed, minQuantity: 0 }).ok, false);
  assert.equal(validateWizardItemForm({ ...fixed, maxQuantity: "abc" }).ok, false);
  // clean fixed-one payload: exact shape, no bound keys
  assert.deepEqual(ok(validateWizardItemForm(fixed)), {
    itemId: null, kind: "other_coating_menu", labelJa: "x", defaultUnitPrice: 6000, quantityRequired: false,
  });
  for (const blank of ["", "   ", null, undefined]) {
    const rawRecord: Record<string, unknown> = { ...fixed };
    if (blank !== undefined) { rawRecord.minQuantity = blank; rawRecord.maxQuantity = blank; }
    const input = ok(validateWizardItemForm(rawRecord));
    assert.equal("minQuantity" in input, false, `blank ${JSON.stringify(blank)} min omitted`);
    assert.equal("maxQuantity" in input, false, `blank ${JSON.stringify(blank)} max omitted`);
  }
  // an edit of an existing item behaves identically
  const edit = err(validateWizardItemForm({ ...fixed, itemId: "oc-item-1", minQuantity: 2 }));
  assert.match(edit.minQuantity, /設定できません/);
});

test("C5 F3: a QUANTITY-BEARING other_coating_menu keeps explicit, validated bounds; wheel / glass / store option bound handling is unchanged", () => {
  const qb = ok(validateWizardItemForm({ kind: "other_coating_menu", labelJa: "x", priceYen: 6000, quantityRequired: true, minQuantity: "2", maxQuantity: "5" }));
  assert.equal(qb.quantityRequired, true);
  assert.equal(qb.minQuantity, 2);
  assert.equal(qb.maxQuantity, 5);
  assert.match(err(validateWizardItemForm({ kind: "other_coating_menu", labelJa: "x", priceYen: 6000, quantityRequired: true, minQuantity: 3, maxQuantity: 2 })).maxQuantity, /最大数量は最小数量以上/);
  assert.match(err(validateWizardItemForm({ kind: "other_coating_menu", labelJa: "x", priceYen: 6000, quantityRequired: true, minQuantity: 0 })).minQuantity, /最小数量は1以上/);
  // wheel / glass: bounds still authored freely (quantity-bearing by kind)
  for (const kind of ["wheel_menu", "glass_menu"]) {
    const w = ok(validateWizardItemForm({ kind, labelJa: "x", priceYen: 8000, minQuantity: 2, maxQuantity: 4 }));
    assert.deepEqual([w.quantityRequired, w.minQuantity, w.maxQuantity], [true, 2, 4], kind);
  }
  // store option: bounds with quantityRequired=false remain accepted exactly as before (no widening, no narrowing)
  const store = ok(validateWizardItemForm({ kind: "store_global_option", labelJa: "x", priceYen: 5000, priceable: true, quantityRequired: false, minQuantity: 1, maxQuantity: 3 }));
  assert.deepEqual([store.quantityRequired, store.minQuantity, store.maxQuantity], [false, 1, 3]);
});

test("C5 F3: the settings client sends other-coating bounds ONLY for a quantity-bearing draft, clears them when the box is unchecked, hides the inputs for fixed-one, and hides bounds from a fixed-one row summary (source pins)", () => {
  const src = readFileSync("src/app/settings/estimate-wizard/EstimateWizardSettingsClient.tsx", "utf8");
  // buildRaw: bounds nested under the quantityRequired guard for other coating
  assert.match(src, /if \(isOtherCoating\) \{\s*raw\.quantityRequired = d\.quantityRequired;[\s\S]{0,400}?if \(d\.quantityRequired\) \{\s*if \(d\.minQuantity\.trim\(\) !== ""\) raw\.minQuantity = d\.minQuantity\.trim\(\);\s*if \(d\.maxQuantity\.trim\(\) !== ""\) raw\.maxQuantity = d\.maxQuantity\.trim\(\);\s*\}\s*\}/, "buildRaw omits bounds for a fixed-one draft");
  // unchecking clears the bound text
  assert.match(src, /\{ quantityRequired: false, minQuantity: "", maxQuantity: "" \}/, "unchecking clears min/max");
  // bound inputs render only while quantityRequired is true
  assert.match(src, /\{draft\.quantityRequired \? \(\s*<>\s*<span[^>]*>\s*数量の下限・上限を設定する場合のみ入力してください/, "bound inputs gated on quantityRequired");
  assert.match(src, /数量は1点（固定）として見積に計上されます。数量の下限・上限は設定できません。/, "fixed-one explanation shown instead");
  // row summary shows other-coating bounds only when quantity-bearing
  assert.match(src, /\(it\.kind === OTHER_COATING_MENU_KIND && it\.quantityRequired\)\) && unitMenuBoundsLabel\(it\)/, "summary bounds gated on quantityRequired");
  // wheel / glass bound block and store block untouched
  assert.match(src, /\{isUnitMenu && \(\s*<div[^>]*>\s*<span[^>]*>数量範囲（任意）<\/span>/, "wheel/glass bound block unchanged");
  assert.match(src, /if \(isUnitMenu\) \{\s*if \(d\.minQuantity\.trim\(\) !== ""\) raw\.minQuantity = d\.minQuantity\.trim\(\);\s*if \(d\.maxQuantity\.trim\(\) !== ""\) raw\.maxQuantity = d\.maxQuantity\.trim\(\);\s*\}/, "wheel/glass buildRaw unchanged");
  assert.match(src, /if \(d\.kind === "store_global_option"\) \{\s*raw\.priceable = d\.priceable;\s*raw\.quantityRequired = d\.quantityRequired;\s*if \(d\.minQuantity\.trim\(\) !== ""\) raw\.minQuantity/, "store buildRaw unchanged");
});

test("B1: other_coating_menu rejects duration, priceable, presentation, coefficient, coupon and server-controlled keys", () => {
  const base = { kind: "other_coating_menu", labelJa: "x", priceYen: 6000, quantityRequired: false };
  for (const bad of [
    { durationMinutes: 30 },
    { priceable: false },
    { priceable: true },
    { presentation: { brand: "x" } },
    { installCoefficientBp: 10000 },
    { couponDiscountType: "amount" },
    { dealerId: "d-1" },
    { code: "forged" },
    { ownerScope: "global" },
  ]) {
    assert.match(err(validateWizardItemForm({ ...base, ...bad }))._form, /許可されていない/, `should reject ${JSON.stringify(bad)}`);
  }
});

test("B1: an other_coating_menu edit keeps its stable itemId and trims the name", () => {
  const input = ok(validateWizardItemForm({
    itemId: "oc-item-1", kind: "other_coating_menu", labelJa: "  ヘッドライト  ", priceYen: "4500", quantityRequired: "false",
  }));
  assert.equal(input.itemId, "oc-item-1");
  assert.equal(input.labelJa, "ヘッドライト");
  assert.equal(input.defaultUnitPrice, 4500);
  assert.equal(input.quantityRequired, false);
});
