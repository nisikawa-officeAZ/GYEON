// C2C4 — DI/pure unit tests for the settings core (no DB, no React).
// Run: node --import tsx --test src/lib/wizard-catalog/estimate-wizard-settings-core.test.ts

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import {
  buildEstimateWizardSettingsView,
  buildSections,
  mapPermission,
  presentActionError,
  interpretReviewOutcome,
  formatYen,
  formatDuration,
  formatCouponValue,
  formatDiscountValue,
  CONCURRENCY_MESSAGE_JA,
  type RawCatalogItem,
  type RawSettingsData,
  type RawLifecycle,
} from "./estimate-wizard-settings-core";

function item(p: Partial<RawCatalogItem> & Pick<RawCatalogItem, "code" | "kind">): RawCatalogItem {
  return {
    itemId: `id-${p.code}`,
    defaultUnitPrice: null, durationMinutes: null, displayOrder: 0, priceable: true,
    quantityRequired: false, minQuantity: null, maxQuantity: null, presentation: null,
    isActive: true, deletedAt: null,
    ...p,
    labelJa: p.labelJa ?? p.code,
  };
}

function raw(p: Partial<RawSettingsData> = {}): RawSettingsData {
  return {
    role: "owner", rankKnown: true, items: [], lifecycle: null,
    coatingCount: 0, reviewerName: null,
    // B2-E2G — every managed family OFF, which is the default a brand-new dealer sees.
    serviceOfferings: { window_film: false, ppf: false, maintenance: false, room_cleaning: false, car_wash: false },
    ...p,
  };
}

const REVIEWED_LIFECYCLE: RawLifecycle = {
  state: "CATALOG_REVIEWED", currentRevision: 5, reviewedRevision: 5,
  lastReviewedAtIso: "2026-07-10T02:00:00.000Z", lastReviewedRevision: 5,
};

// ── permission ─────────────────────────────────────────────────────────────
test("owner/manager are editable; staff/readonly/null are read-only", () => {
  assert.equal(mapPermission("owner"), "editable");
  assert.equal(mapPermission("manager"), "editable");
  assert.equal(mapPermission("staff"), "readonly");
  assert.equal(mapPermission("readonly"), "readonly");
  assert.equal(mapPermission(null), "readonly");
});

test("view.canEdit follows permission", () => {
  assert.equal(buildEstimateWizardSettingsView(raw({ role: "manager" })).canEdit, true);
  assert.equal(buildEstimateWizardSettingsView(raw({ role: "staff" })).canEdit, false);
});

// ── section grouping ───────────────────────────────────────────────────────
test("sections group by family; service holds the three legacy menus, other_coating holds B5a wheel/glass", () => {
  const v = buildEstimateWizardSettingsView(raw({
    items: [
      item({ code: "film-1", kind: "film_type" }),
      item({ code: "maint-1", kind: "maintenance_menu" }),
      item({ code: "wash-1", kind: "wash_menu" }),
      item({ code: "room-1", kind: "room_cleaning_menu" }),
      item({ code: "wheel-1", kind: "wheel_menu", quantityRequired: true, minQuantity: 1 }),
      item({ code: "glass-1", kind: "glass_menu", quantityRequired: true, minQuantity: 1 }),
      item({ code: "other-1", kind: "other_work_preset" }),
      item({ code: "store-1", kind: "store_global_option" }),
    ],
  }));
  const ids = v.sections.map((s) => s.id);
  // B1.1 added the `ppf` and `coupon` sections; the original four keep their identity and order.
  // GDA-OTHER-COATINGS-R1 Stage A moves ONLY wheel/glass out of `service` into the dedicated
  // `other_coating` section directly after it. No offering family is introduced.
  assert.deepEqual(ids, ["film", "ppf", "service", "other_coating", "otherwork", "store", "coupon"]);
  const service = v.sections.find((s) => s.id === "service")!;
  assert.deepEqual(service.groups.map((g) => g.kind), ["maintenance_menu", "wash_menu", "room_cleaning_menu"]);
  assert.equal(service.itemCount, 3);
  assert.equal(service.anchorId, "section-service", "the existing section id / anchor is reused");
  const otherCoating = v.sections.find((s) => s.id === "other_coating")!;
  // B1 adds the extensible other_coating_menu group after the two B5 kinds.
  assert.deepEqual(otherCoating.groups.map((g) => g.kind), ["wheel_menu", "glass_menu", "other_coating_menu"]);
  assert.equal(otherCoating.itemCount, 2);
  assert.equal(otherCoating.anchorId, "section-other-coating");
  assert.equal(otherCoating.labelJa, "その他のコーティング");
  assert.equal(otherCoating.required, false, "Stage A never gates review on the new section");
  assert.equal(v.sections.find((s) => s.id === "film")!.itemCount, 1);
  assert.equal(v.sections.find((s) => s.id === "store")!.itemCount, 1, "wheel/glass never land in the store-option section");
});

// ── GDA-ESTIMATE-QUANTITY-POLICY-R1 (B5a): dedicated wheel / glass menu groups ─────────────────
test("B5a: wheel/glass items carry a NULLABLE per-unit price (null ⇒ no label, never ¥0) and their quantity bounds", () => {
  const v = buildEstimateWizardSettingsView(raw({
    items: [
      item({ code: "wheel-1", kind: "wheel_menu", labelJa: "ホイールコーティング", defaultUnitPrice: null, quantityRequired: true, minQuantity: 1, maxQuantity: null }),
      item({ code: "glass-1", kind: "glass_menu", labelJa: "ガラスコーティング", defaultUnitPrice: 12000, quantityRequired: true, minQuantity: 1, maxQuantity: 6 }),
    ],
  }));
  const otherCoating = v.sections.find((s) => s.id === "other_coating")!;
  const wheel = otherCoating.groups.find((g) => g.kind === "wheel_menu")!;
  const glass = otherCoating.groups.find((g) => g.kind === "glass_menu")!;
  assert.equal(wheel.labelJa, "ホイール");
  assert.equal(glass.labelJa, "ガラス");
  assert.match(otherCoating.descriptionJa, /ホイール/);
  assert.match(otherCoating.descriptionJa, /ガラス/);
  // Stage A: the legacy service section no longer describes or hosts wheel/glass.
  const service = v.sections.find((s) => s.id === "service")!;
  assert.doesNotMatch(service.descriptionJa, /ホイール|ガラス/);
  assert.equal(service.groups.some((g) => g.kind === "wheel_menu" || g.kind === "glass_menu"), false);

  const w = wheel.items[0];
  assert.equal(w.code, "wheel-1", "identity is the stable code");
  assert.equal(w.itemId, "id-wheel-1");
  assert.equal(w.priceYen, null, "an unconfigured price stays null");
  assert.equal(w.priceLabelJa, null, "…and renders NO label — never ¥0（税抜）");
  assert.equal(w.quantityRequired, true);
  assert.equal(w.minQuantity, 1);
  assert.equal(w.maxQuantity, null, "no configured maximum is null, not an invented bound");

  const g = glass.items[0];
  assert.equal(g.priceYen, 12000);
  assert.equal(g.priceLabelJa, "¥12,000（税抜）");
  assert.equal(g.maxQuantity, 6);

  for (const s of v.sections) {
    if (s.id === "other_coating") continue;
    assert.ok(s.groups.every((grp) => grp.kind !== "wheel_menu" && grp.kind !== "glass_menu"), `${s.id} must not host wheel/glass`);
  }
});

test("B5a: wheel/glass have NO offering family — their empty groups are never reported as an incomplete family", () => {
  const v = buildEstimateWizardSettingsView(raw({
    items: [],
    serviceOfferings: { window_film: false, ppf: false, maintenance: true, room_cleaning: true, car_wash: true },
  }));
  assert.equal(v.reviewStatus.reviewReady, true);
  assert.equal(v.reviewStatus.missingSections.length, 1, "exactly the service section, for the three ON families");
  const service = v.reviewStatus.missingSections[0];
  assert.equal(service.sectionId, "service");
  assert.doesNotMatch(service.reasonJa, /ホイール/, "no wheel family exists to be incomplete");
  assert.doesNotMatch(service.reasonJa, /ガラス/, "no glass family exists to be incomplete");
  // …and the offering map itself is untouched: still exactly the five managed families.
  assert.deepEqual(Object.keys(v.serviceOfferings).sort(), ["car_wash", "maintenance", "ppf", "room_cleaning", "window_film"]);
});

// ── GDA-OTHER-COATINGS-R1 Stage A: settings surface only ─────────────────────────────────────
test("Stage A: other_coating is a settings-only section — no seeded rows, no offering family, never review-gating", () => {
  const empty = buildEstimateWizardSettingsView(raw({ items: [] }));
  const section = empty.sections.find((s) => s.id === "other_coating")!;
  assert.deepEqual(section.kinds, ["wheel_menu", "glass_menu", "other_coating_menu"], "the two B5 kinds plus the B1 extensible kind");
  assert.equal(section.itemCount, 0, "Stage A / B1 seed nothing");
  assert.equal(section.required, false);
  assert.equal(section.satisfied, true);
  assert.equal(empty.reviewStatus.reviewReady, true);
  assert.equal(empty.reviewStatus.missingSections.length, 0);

  // Every family ON with nothing registered: the warning list names only offering-backed sections.
  // other_coating has no family, so it is never reported, and the family map is unchanged.
  const allOn = buildEstimateWizardSettingsView(raw({
    items: [],
    serviceOfferings: { window_film: true, ppf: true, maintenance: true, room_cleaning: true, car_wash: true },
  }));
  assert.ok(allOn.reviewStatus.missingSections.every((m) => m.sectionId !== "other_coating"));
  assert.deepEqual(Object.keys(allOn.serviceOfferings).sort(), ["car_wash", "maintenance", "ppf", "room_cleaning", "window_film"]);
});

// ── GDA-OTHER-COATINGS-R1 (B1): the extensible other_coating_menu kind ───────────────────────────
test("B1: other_coating_menu items present in the other_coating section with a NULLABLE positive price and an explicit quantity flag", () => {
  const v = buildEstimateWizardSettingsView(raw({
    items: [
      item({ code: "oc-2", kind: "other_coating_menu", labelJa: "ヘッドライトコーティング", defaultUnitPrice: null, quantityRequired: false, minQuantity: null, maxQuantity: null, displayOrder: 2 }),
      item({ code: "oc-1", kind: "other_coating_menu", labelJa: "ホイールハウスコーティング", defaultUnitPrice: 6000, quantityRequired: true, minQuantity: 1, maxQuantity: 2, displayOrder: 1 }),
      item({ code: "wheel-1", kind: "wheel_menu", quantityRequired: true, minQuantity: 1 }),
    ],
  }));
  const section = v.sections.find((s) => s.id === "other_coating")!;
  assert.equal(section.itemCount, 3);
  assert.match(section.descriptionJa, /その他コーティング/);
  const group = section.groups.find((g) => g.kind === "other_coating_menu")!;
  assert.equal(group.labelJa, "その他コーティング");
  assert.deepEqual(group.items.map((i) => i.code), ["oc-1", "oc-2"], "sorted by displayOrder then code");

  const priced = group.items[0];
  assert.equal(priced.itemId, "id-oc-1");
  assert.equal(priced.priceYen, 6000);
  assert.equal(priced.priceLabelJa, "¥6,000（税抜）");
  assert.equal(priced.quantityRequired, true);
  assert.equal(priced.minQuantity, 1);
  assert.equal(priced.maxQuantity, 2);
  assert.equal(priced.durationLabelJa, null, "no duration on this kind");

  const unpriced = group.items[1];
  assert.equal(unpriced.priceYen, null, "unconfigured stays null");
  assert.equal(unpriced.priceLabelJa, null, "…and renders no label — never ¥0（税抜）");
  assert.equal(unpriced.quantityRequired, false, "an explicit false survives to the view");
  assert.equal(unpriced.minQuantity, null);
  assert.equal(unpriced.maxQuantity, null);

  // The wheel group is unaffected by the sibling kind, and no other section hosts the new kind.
  assert.equal(section.groups.find((g) => g.kind === "wheel_menu")!.items.length, 1);
  for (const s of v.sections) {
    if (s.id === "other_coating") continue;
    assert.ok(s.groups.every((grp) => grp.kind !== "other_coating_menu"), `${s.id} must not host other_coating_menu`);
  }
});

test("B1: other_coating_menu has NO offering family and never gates or warns the review", () => {
  const allOn = buildEstimateWizardSettingsView(raw({
    items: [],
    serviceOfferings: { window_film: true, ppf: true, maintenance: true, room_cleaning: true, car_wash: true },
  }));
  const section = allOn.sections.find((s) => s.id === "other_coating")!;
  assert.equal(section.required, false);
  assert.equal(section.satisfied, true);
  assert.equal(allOn.reviewStatus.reviewReady, true);
  assert.ok(allOn.reviewStatus.missingSections.every((m) => m.sectionId !== "other_coating"));
  assert.ok(allOn.reviewStatus.missingSections.every((m) => !/その他コーティング/.test(m.reasonJa)));
  assert.deepEqual(Object.keys(allOn.serviceOfferings).sort(), ["car_wash", "maintenance", "ppf", "room_cleaning", "window_film"], "no new family");
});

test("B1: the authoritative settings loader reads all three other_coating kinds", () => {
  const source = readFileSync("src/lib/wizard-catalog/get-estimate-wizard-settings-view.ts", "utf8");
  const allowlist = source.match(/const EDITABLE_KINDS = \[([\s\S]*?)\] as const;/)?.[1] ?? "";
  for (const kind of ["wheel_menu", "glass_menu", "other_coating_menu"]) {
    assert.match(allowlist, new RegExp(`"${kind}"`), `${kind} must be visible after authoring`);
  }
});

test("identity is the stable code; items sort by displayOrder then code (not label/index)", () => {
  const v = buildSections(
    [
      item({ code: "maint-z", kind: "maintenance_menu", displayOrder: 2, labelJa: "AAA" }),
      item({ code: "maint-a", kind: "maintenance_menu", displayOrder: 1, labelJa: "ZZZ" }),
      item({ code: "maint-b", kind: "maintenance_menu", displayOrder: 1, labelJa: "MMM" }),
    ],
  );
  const g = v.find((s) => s.id === "service")!.groups.find((x) => x.kind === "maintenance_menu")!;
  assert.deepEqual(g.items.map((i) => i.code), ["maint-a", "maint-b", "maint-z"]);
});

test("inactive / soft-deleted / blank-label items are excluded from active lists", () => {
  const v = buildSections(
    [
      item({ code: "a", kind: "film_type" }),
      item({ code: "b", kind: "film_type", isActive: false }),
      item({ code: "c", kind: "film_type", deletedAt: "2026-01-01T00:00:00Z" }),
      item({ code: "d", kind: "film_type", labelJa: "   " }),
    ],
  );
  assert.deepEqual(v.find((s) => s.id === "film")!.groups[0].items.map((i) => i.code), ["a"]);
});

// ── completeness / missing / review-ready ──────────────────────────────────
// B2-E2Q-D2R — the catalog review attests REVIEW, not COMPLETENESS. What used to be
// asserted here is the exact defect that was removed: a rank-derived film_type
// requirement that refused the review of a store selling no window film at all — and,
// once film_type was widened to every rank, refused it for every dealer.
test("ALL FIVE FAMILIES OFF with zero items => review is ready and nothing is reported", () => {
  const v = buildEstimateWizardSettingsView(raw({ items: [] }));
  const film = v.sections.find((s) => s.id === "film")!;
  assert.equal(film.required, false, "no section is required in order to review");
  assert.equal(film.satisfied, true);
  assert.equal(v.reviewStatus.reviewReady, true);
  assert.equal(v.reviewStatus.missingSections.length, 0);
});

test("family ON but unconfigured => STILL ready; warned, with the section anchor", () => {
  const v = buildEstimateWizardSettingsView(raw({
    items: [],
    serviceOfferings: { window_film: true, ppf: false, maintenance: false, room_cleaning: false, car_wash: false },
  }));
  assert.equal(v.reviewStatus.reviewReady, true, "an incomplete family never blocks the review");
  assert.equal(v.reviewStatus.missingSections.length, 1);
  assert.equal(v.reviewStatus.missingSections[0].sectionId, "film");
  assert.equal(v.reviewStatus.missingSections[0].anchorId, "section-film");
  assert.match(v.reviewStatus.missingSections[0].reasonJa, /確定はこのままでも行えます/);
});

test("family ON and configured => ready, and no warning remains", () => {
  const v = buildEstimateWizardSettingsView(raw({
    items: [item({ code: "film-1", kind: "film_type" })],
    serviceOfferings: { window_film: true, ppf: false, maintenance: false, room_cleaning: false, car_wash: false },
  }));
  assert.equal(v.reviewStatus.reviewReady, true);
  assert.equal(v.reviewStatus.missingSections.length, 0);
});

test("an OFF family with zero items is never warned about", () => {
  const v = buildEstimateWizardSettingsView(raw({
    items: [],
    serviceOfferings: { window_film: false, ppf: false, maintenance: true, room_cleaning: false, car_wash: false },
  }));
  assert.equal(v.reviewStatus.missingSections.length, 1, "only the ON family is reported");
  assert.equal(v.reviewStatus.missingSections[0].sectionId, "service");
});

test("rank unknown => never review-ready (fail closed)", () => {
  const v = buildEstimateWizardSettingsView(raw({ rankKnown: false }));
  assert.equal(v.reviewStatus.reviewReady, false);
  assert.match(v.reviewStatus.statusDetailJa, /店舗ランク/);
});

// ── reviewed status ────────────────────────────────────────────────────────
test("reviewed lifecycle => reviewed=true, statusLabel 確認済み", () => {
  const v = buildEstimateWizardSettingsView(raw({ lifecycle: REVIEWED_LIFECYCLE }));
  assert.equal(v.reviewStatus.reviewed, true);
  assert.equal(v.reviewStatus.statusLabelJa, "確認済み");
});

test("edited-after-review (reviewed<current) => review required again", () => {
  const v = buildEstimateWizardSettingsView(raw({
    lifecycle: { ...REVIEWED_LIFECYCLE, state: "MIGRATED_UNREVIEWED", reviewedRevision: null, currentRevision: 6 },
  }));
  assert.equal(v.reviewStatus.reviewed, false);
  assert.equal(v.reviewStatus.statusLabelJa, "確認が必要です");
});

// ── durable last-review presentation ───────────────────────────────────────
test("durable last-review shows date + reviewer name", () => {
  const v = buildEstimateWizardSettingsView(raw({ lifecycle: REVIEWED_LIFECYCLE, reviewerName: "山田 太郎" }));
  assert.ok(v.reviewStatus.lastReview);
  assert.match(v.reviewStatus.lastReview!.dateLabelJa, /2026\/07\/10/);
  assert.equal(v.reviewStatus.lastReview!.reviewerLabelJa, "確認者：山田 太郎");
});

test("deleted reviewer => date retained, reviewer label null (no crash, no id)", () => {
  const v = buildEstimateWizardSettingsView(raw({ lifecycle: REVIEWED_LIFECYCLE, reviewerName: null }));
  assert.ok(v.reviewStatus.lastReview);
  assert.match(v.reviewStatus.lastReview!.dateLabelJa, /2026\/07\/10/);
  assert.equal(v.reviewStatus.lastReview!.reviewerLabelJa, null);
});

test("never-reviewed => no durable history", () => {
  const v = buildEstimateWizardSettingsView(raw({
    lifecycle: { state: "MIGRATED_UNREVIEWED", currentRevision: 0, reviewedRevision: null, lastReviewedAtIso: null, lastReviewedRevision: null },
  }));
  assert.equal(v.reviewStatus.lastReview, null);
});

// ── coating / coupon ───────────────────────────────────────────────────────
test("coating is summary + link only (no editor)", () => {
  const v = buildEstimateWizardSettingsView(raw({ coatingCount: 3 }));
  assert.equal(v.coating.configuredCount, 3);
  assert.equal(v.coating.editHref, "/settings?panel=service");
  assert.match(v.coating.summaryJa, /3件/);
});

// B1.1-B3 — the two percent units are distinct and must never be formatted with each other's
// formatter. Formatting a 10% coupon with the basis-point formatter renders "0%", which is the
// exact confusion that produced the original defect.
test("coupon percent formats from the STORED 0–100 unit", () => {
  assert.equal(formatCouponValue("percent", 10), "10%引き");
  assert.equal(formatCouponValue("percent", 100), "100%引き");
  assert.equal(formatCouponValue("percent", 0), "0%引き");
  assert.equal(formatCouponValue("amount", 5000), "¥5,000引き");
});

test("PPF/coating adjustment percent stays in BASIS POINTS", () => {
  assert.equal(formatDiscountValue("percent", 1000), "10%引き");
  assert.equal(formatDiscountValue("percent", 10000), "100%引き");
  assert.equal(formatDiscountValue("amount", 30000), "¥30,000引き");
});

test("a coupon rule view renders its stored percent directly, never divided by 100", () => {
  const v = buildEstimateWizardSettingsView(
    raw({
      items: [
        item({
          code: "coupon-a", kind: "coupon", labelJa: "新規ご来店",
          couponDiscountType: "percent", couponDiscountValue: 10,
          couponCombinable: true, couponValidFrom: null, couponValidTo: null,
        }),
      ],
    }),
  );
  const coupon = v.sections.find((s) => s.id === "coupon");
  const rule = coupon?.groups[0]?.items[0]?.coupon;
  assert.equal(rule?.discountValue, 10);
  assert.equal(rule?.discountLabelJa, "10%引き");
});

// B1.1 — coupons are a real editable section; the "planned" card is gone.
test("coupon is an editable section, not a planned card", () => {
  const v = buildEstimateWizardSettingsView(raw());
  const coupon = v.sections.find((s) => s.id === "coupon");
  assert.ok(coupon, "coupon section must exist");
  assert.equal(coupon.kinds.includes("coupon"), true);
  assert.equal("coupon" in v, false, "the planned-only coupon card must no longer exist");
});

test("the authoritative settings loader reads every settings-authorable kind", () => {
  const source = readFileSync(
    "src/lib/wizard-catalog/get-estimate-wizard-settings-view.ts",
    "utf8",
  );
  const allowlist = source.match(/const EDITABLE_KINDS = \[([\s\S]*?)\] as const;/)?.[1] ?? "";

  for (const kind of [
    "film_type",
    "ppf_type_group",
    "maintenance_menu",
    "wash_menu",
    "room_cleaning_menu",
    "other_work_preset",
    "store_global_option",
    "coupon",
  ]) {
    assert.match(allowlist, new RegExp(`"${kind}"`), `${kind} must be visible after authoring`);
  }
});

test("the authoritative settings loader selects and maps every coupon rule column", () => {
  const source = readFileSync(
    "src/lib/wizard-catalog/get-estimate-wizard-settings-view.ts",
    "utf8",
  );

  for (const [column, property] of [
    ["coupon_discount_type", "couponDiscountType"],
    ["coupon_discount_value", "couponDiscountValue"],
    ["coupon_combinable", "couponCombinable"],
    ["coupon_valid_from", "couponValidFrom"],
    ["coupon_valid_to", "couponValidTo"],
  ] as const) {
    assert.match(source, new RegExp(`\\b${column}\\b`), `${column} must be selected`);
    assert.match(
      source,
      new RegExp(`${property}: \\(r\\.${column}`),
      `${column} must be mapped to ${property}`,
    );
  }
});

test("PPF types are an editable section", () => {
  const v = buildEstimateWizardSettingsView(raw());
  const ppf = v.sections.find((s) => s.id === "ppf");
  assert.ok(ppf, "ppf section must exist");
  assert.equal(ppf.kinds.includes("ppf_type_group"), true);
});

test("PPF+coating adjustment: no rules configured means no reduction (never a default rule)", () => {
  const v = buildEstimateWizardSettingsView(raw());
  assert.deepEqual(v.ppfCoatingAdjustment.rules, []);
});

test("PPF+coating adjustment: archived rules are excluded, labels fall back to the CODE", () => {
  const v = buildEstimateWizardSettingsView(
    raw({
      ppfCoatingAdjustments: [
        { ruleId: "r1", ppfMethodCode: "full", coatingCode: "pure-evo", adjustmentType: "amount", adjustmentValue: 30000, isActive: true, deletedAt: null },
        { ruleId: "r2", ppfMethodCode: "partial", coatingCode: "pure-evo", adjustmentType: "percent", adjustmentValue: 2000, isActive: true, deletedAt: "2026-07-01T00:00:00Z" },
      ],
    }),
  );
  assert.equal(v.ppfCoatingAdjustment.rules.length, 1);
  assert.equal(v.ppfCoatingAdjustment.rules[0].ruleId, "r1");
  // No label map supplied ⇒ the CODE is shown, never a blank.
  assert.equal(v.ppfCoatingAdjustment.rules[0].ppfMethodLabelJa, "full");
  assert.equal(v.ppfCoatingAdjustment.rules[0].adjustmentLabelJa, "¥30,000引き");
});

// ── empty catalog ──────────────────────────────────────────────────────────
test("empty catalog yields seven empty sections without crashing", () => {
  const v = buildEstimateWizardSettingsView(raw({ items: [] }));
  // B1.1 added the ppf and coupon sections to the original four; GDA-OTHER-COATINGS-R1 Stage A
  // added other_coating.
  assert.equal(v.sections.length, 7);
  assert.equal(v.sections.reduce((n, s) => n + s.itemCount, 0), 0);
});

// ── no raw leakage ─────────────────────────────────────────────────────────
test("presentation view never leaks raw lifecycle enums, dealer id, or revision wording", () => {
  const v = buildEstimateWizardSettingsView(raw({
    role: "owner", lifecycle: REVIEWED_LIFECYCLE, reviewerName: "山田",
    items: [item({ code: "film-1", kind: "film_type" })],
  }));
  const json = JSON.stringify(v);
  for (const forbidden of ["MIGRATED_UNREVIEWED", "CATALOG_REVIEWED", "CATALOG_ACTIVE", "LEGACY", "reviewed_configuration_revision", "dealer_id"]) {
    assert.ok(!json.includes(forbidden), `view leaked "${forbidden}"`);
  }
});

// ── formatters ─────────────────────────────────────────────────────────────
test("formatYen / formatDuration", () => {
  assert.equal(formatYen(3000), "¥3,000（税抜）");
  assert.equal(formatYen(0), "¥0（税抜）");
  assert.equal(formatYen(null), null);
  assert.equal(formatDuration(30), "約30分");
  assert.equal(formatDuration(null), null);
  assert.equal(formatDuration(0), null);
});

// ── action-error + review-outcome presentation ─────────────────────────────
test("presentActionError maps codes to safe Japanese (no raw text)", () => {
  assert.match(presentActionError("PERMISSION_DENIED"), /オーナーまたはマネージャー/);
  assert.match(presentActionError("RANK_UNAVAILABLE"), /店舗ランク/);
  assert.match(presentActionError("RPC_ERROR"), /失敗/);
});

test("interpretReviewOutcome: matching revision => success; mismatch => stale/concurrency message", () => {
  assert.equal(interpretReviewOutcome(7, 7).kind, "success");
  const stale = interpretReviewOutcome(8, 7);
  assert.equal(stale.kind, "stale");
  assert.equal(stale.messageJa, CONCURRENCY_MESSAGE_JA);
});

// ── B2-E2G: the service-offering map reaches the view untouched ──────────────
test("service offerings are carried into the view verbatim, never derived", () => {
  const offerings = { window_film: true, ppf: false, maintenance: true, room_cleaning: false, car_wash: true };
  const v = buildEstimateWizardSettingsView(raw({ serviceOfferings: offerings }));
  assert.deepEqual(v.serviceOfferings, offerings, "the map is passed through, not recomputed");
  // Independence from the two things it must NEVER be inferred from: rank, and item counts.
  const noItems = buildEstimateWizardSettingsView(raw({ serviceOfferings: offerings, items: [] }));
  assert.deepEqual(noItems.serviceOfferings, offerings, "an empty catalog does not flip any family off");
  const noRank = buildEstimateWizardSettingsView(raw({ serviceOfferings: offerings, rankKnown: false }));
  assert.deepEqual(noRank.serviceOfferings, offerings, "an unknown rank does not flip any family off");
});

test("the default view has every managed family OFF", () => {
  assert.deepEqual(buildEstimateWizardSettingsView(raw()).serviceOfferings, {
    window_film: false, ppf: false, maintenance: false, room_cleaning: false, car_wash: false,
  });
});
