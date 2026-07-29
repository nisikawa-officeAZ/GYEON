// C2C4 — DI/pure unit tests for the settings core (no DB, no React).
// Run: node --import tsx --test src/lib/wizard-catalog/estimate-wizard-settings-core.test.ts

import { test } from "node:test";
import assert from "node:assert/strict";

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
test("sections group by family; service holds three kind-groups", () => {
  const v = buildEstimateWizardSettingsView(raw({
    items: [
      item({ code: "film-1", kind: "film_type" }),
      item({ code: "maint-1", kind: "maintenance_menu" }),
      item({ code: "wash-1", kind: "wash_menu" }),
      item({ code: "room-1", kind: "room_cleaning_menu" }),
      item({ code: "other-1", kind: "other_work_preset" }),
      item({ code: "store-1", kind: "store_global_option" }),
    ],
  }));
  const ids = v.sections.map((s) => s.id);
  // B1.1 added the `ppf` and `coupon` sections; the original four keep their identity and order.
  assert.deepEqual(ids, ["film", "ppf", "service", "otherwork", "store", "coupon"]);
  const service = v.sections.find((s) => s.id === "service")!;
  assert.deepEqual(service.groups.map((g) => g.kind), ["maintenance_menu", "wash_menu", "room_cleaning_menu"]);
  assert.equal(service.itemCount, 3);
  assert.equal(v.sections.find((s) => s.id === "film")!.itemCount, 1);
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
test("empty catalog yields six empty sections without crashing", () => {
  const v = buildEstimateWizardSettingsView(raw({ items: [] }));
  // B1.1 added the ppf and coupon sections to the original four.
  assert.equal(v.sections.length, 6);
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
