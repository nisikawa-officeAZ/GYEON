// C2C4 — Estimate Wizard settings: PURE CORE (no React, no DB, no server-only).
//
// Deterministic transforms from authoritative server-resolved data into the
// presentation-safe DTO. This layer never reads a database, never resolves auth, and
// never lets a raw lifecycle enum, revision number, dealer id, or authorization
// detail reach visible text. All visible labels are Japanese.

import type { DealerStaffRole } from "@/lib/staff/staff-types";
import {
  SERVICE_FAMILY_LABEL_JA,
  type ServiceFamily,
  type ServiceOfferings,
} from "@/lib/estimates/service-categories";
import type { WizardCatalogActionErrorCode } from "./wizard-catalog-authoring-types";
import type {
  EstimateWizardPermission,
  EstimateWizardSettingsView,
  WizardSettingsItemView,
  WizardSettingsGroupView,
  WizardSettingsSectionView,
  WizardSettingsSectionId,
  ReviewStatusView,
  MissingSectionView,
  LastReviewView,
  CoatingSummaryView,
  PpfCoatingAdjustmentSectionView,
  PpfCoatingAdjustmentView,
  CouponRuleView,
  FilmPresentationView,
  SupportedAuthoringKind,
} from "./estimate-wizard-settings-types";
import { COEFFICIENT_BP_IDENTITY } from "./ppf-coating-adjustment-core";

// ── raw (server-resolved) inputs ─────────────────────────────────────────────

export interface RawCatalogItem {
  readonly itemId: string;
  readonly code: string;
  readonly kind: string;
  readonly labelJa: string | null;
  readonly defaultUnitPrice: number | null;
  readonly durationMinutes: number | null;
  readonly displayOrder: number;
  readonly priceable: boolean;
  readonly quantityRequired: boolean;
  readonly minQuantity: number | null;
  readonly maxQuantity: number | null;
  readonly presentation: unknown;
  readonly isActive: boolean;
  readonly deletedAt: string | null;
  // B1.1 — optional so every existing loader/fixture keeps compiling unchanged.
  readonly installCoefficientBp?: number | null;
  readonly couponDiscountType?: string | null;
  readonly couponDiscountValue?: number | null;
  readonly couponCombinable?: boolean | null;
  readonly couponValidFrom?: string | null;
  readonly couponValidTo?: string | null;
}

/** One PPF + coating reduction rule as resolved server-side. */
export interface RawPpfCoatingAdjustment {
  readonly ruleId: string;
  readonly ppfMethodCode: string;
  readonly coatingCode: string;
  readonly adjustmentType: string;
  readonly adjustmentValue: number;
  readonly isActive: boolean;
  readonly deletedAt: string | null;
}

export interface RawLifecycle {
  readonly state: string;
  readonly currentRevision: number;
  readonly reviewedRevision: number | null;
  readonly lastReviewedAtIso: string | null;
  readonly lastReviewedRevision: number | null;
}

export interface RawSettingsData {
  readonly role: DealerStaffRole | null;
  readonly rankKnown: boolean;
  readonly items: readonly RawCatalogItem[];
  readonly lifecycle: RawLifecycle | null;
  readonly coatingCount: number;
  /** Resolved display name for last_reviewed_by, or null if unknown/deleted. */
  readonly reviewerName: string | null;
  /**
   * B2-E2G — the dealer's service-offering map. REQUIRED and total: the loader always states every
   * family, so an omitted key can never be misread as OFF at this boundary.
   */
  readonly serviceOfferings: ServiceOfferings;
  /** B1.1 — optional so existing callers keep compiling; absent ⇒ no rules configured. */
  readonly ppfCoatingAdjustments?: readonly RawPpfCoatingAdjustment[];
  /** Code → Japanese label for the global PPF method vocabulary, for rule display. */
  readonly ppfMethodLabels?: Readonly<Record<string, string>>;
  /** Code → Japanese label for coatings, for rule display. */
  readonly coatingLabels?: Readonly<Record<string, string>>;
}

// ── constants (Japanese labels; identities reused from C2C3) ─────────────────

const COATING_EDIT_HREF = "/settings?panel=service";

const KIND_LABEL: Record<SupportedAuthoringKind, string> = {
  film_type: "ウィンドウフィルム",
  maintenance_menu: "メンテナンス",
  wash_menu: "洗車",
  room_cleaning_menu: "室内清掃",
  other_work_preset: "その他作業",
  store_global_option: "店舗オプション",
  coupon: "クーポン",
  ppf_type_group: "PPF種類",
};

interface SectionDef {
  readonly id: WizardSettingsSectionId;
  readonly labelJa: string;
  readonly descriptionJa: string;
  readonly anchorId: string;
  readonly kinds: readonly SupportedAuthoringKind[];
}

// Service groups the three menu kinds under one section with button-tabs.
const SECTION_DEFS: readonly SectionDef[] = [
  { id: "film", labelJa: "ウィンドウフィルム", descriptionJa: "施工するフィルムの種類を登録します。", anchorId: "section-film", kinds: ["film_type"] },
  { id: "ppf", labelJa: "PPF種類・施工係数", descriptionJa: "施工するPPFの種類と、種類ごとの施工係数（×倍率）を登録します。GYEON以外のPPFも登録できます。", anchorId: "section-ppf", kinds: ["ppf_type_group"] },
  { id: "service", labelJa: "サービスメニュー", descriptionJa: "メンテナンス・洗車・室内清掃のメニューを登録します。", anchorId: "section-service", kinds: ["maintenance_menu", "wash_menu", "room_cleaning_menu"] },
  { id: "otherwork", labelJa: "その他作業プリセット", descriptionJa: "見積時に手入力する作業の名称プリセットです（金額は現場入力）。", anchorId: "section-otherwork", kinds: ["other_work_preset"] },
  { id: "store", labelJa: "店舗オプション", descriptionJa: "出張費などの店舗共通オプションを登録します。", anchorId: "section-store", kinds: ["store_global_option"] },
  { id: "coupon", labelJa: "クーポン", descriptionJa: "見積で選択できるクーポンを登録します。金額または％、併用可否、有効期間を設定できます。", anchorId: "section-coupon", kinds: ["coupon"] },
];

// ── formatters (pure) ────────────────────────────────────────────────────────

export function formatYen(n: number | null): string | null {
  if (n === null || !Number.isFinite(n)) return null;
  return `¥${Math.trunc(n).toLocaleString("ja-JP")}（税抜）`;
}

export function formatDuration(min: number | null): string | null {
  if (min === null || !Number.isFinite(min) || min <= 0) return null;
  return `約${Math.trunc(min)}分`;
}

/** `12500` → `×1.25`. Basis points never reach the UI as a raw integer. */
export function formatCoefficient(bp: number | null | undefined): string | null {
  if (bp === null || bp === undefined || !Number.isInteger(bp) || bp <= 0) return null;
  return `×${(bp / COEFFICIENT_BP_IDENTITY).toFixed(2)}`;
}

// ── Two percent units live in this file, and they are NOT interchangeable ────
// The unit is fixed by the schema that stores each value, so each has its own formatter:
//
//   • COUPON percent            — `wizard_catalog_items.coupon_discount_value`, 0–100
//                                 (`wci_coupon_percent_range`). 10 means 10%.
//   • PPF/coating adjustment    — `dealer_ppf_coating_adjustments.adjustment_value`, basis points
//     percent, and the PPF        (`dpca_percent_range`, ≤ 10000). 1000 means 10%.
//     install coefficient
//
// Formatting a coupon with the basis-point formatter renders 10% as "0%", which is exactly the
// confusion that produced the B1.1 defect. Keep them separate.

/** `amount` → `¥5,000引き`; `percent` in BASIS POINTS → `10%引き`. Adjustments only. */
export function formatDiscountValue(type: "amount" | "percent", value: number): string {
  if (type === "amount") return `¥${Math.trunc(value).toLocaleString("ja-JP")}引き`;
  return `${(value / 100).toFixed(value % 100 === 0 ? 0 : 2)}%引き`;
}

/** `amount` → `¥5,000引き`; `percent` as a STORED INTEGER PERCENT (0–100) → `10%引き`. Coupons only. */
export function formatCouponValue(type: "amount" | "percent", value: number): string {
  if (type === "amount") return `¥${Math.trunc(value).toLocaleString("ja-JP")}引き`;
  return `${Math.trunc(value)}%引き`;
}

function formatValidity(from: string | null, to: string | null): string {
  if (!from && !to) return "期限なし";
  if (from && !to) return `${from} 〜`;
  if (!from && to) return `〜 ${to}`;
  return `${from} 〜 ${to}`;
}

function toCouponRuleView(it: RawCatalogItem): CouponRuleView | null {
  const type = it.couponDiscountType;
  if (type !== "amount" && type !== "percent") return null;
  const value = it.couponDiscountValue;
  if (typeof value !== "number" || !Number.isFinite(value)) return null;
  const combinable = it.couponCombinable === true;
  const from = it.couponValidFrom ?? null;
  const to = it.couponValidTo ?? null;
  return {
    discountType: type,
    discountValue: value,
    // Coupons are stored 0–100, so they format with the coupon-unit formatter.
    discountLabelJa: formatCouponValue(type, value),
    combinable,
    combinableLabelJa: combinable ? "併用可" : "併用不可",
    validFrom: from,
    validTo: to,
    validityLabelJa: formatValidity(from, to),
  };
}

function toPresentationView(raw: unknown): FilmPresentationView | null {
  if (raw === null || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  const s = (v: unknown): string | null => (typeof v === "string" && v.trim() !== "" ? v : null);
  const view: FilmPresentationView = {
    brand: s(o.brand),
    vlt: s(o.vlt),
    heatRejection: s(o.heatRejection),
    color: s(o.color),
  };
  if (!view.brand && !view.vlt && !view.heatRejection && !view.color) return null;
  return view;
}

// ── permission ───────────────────────────────────────────────────────────────

export function mapPermission(role: DealerStaffRole | null): EstimateWizardPermission {
  return role === "owner" || role === "manager" ? "editable" : "readonly";
}

// ── item / section building ──────────────────────────────────────────────────

function isActiveEditableItem(it: RawCatalogItem): boolean {
  return it.isActive && it.deletedAt === null && it.labelJa !== null && it.labelJa.trim() !== "";
}

function toItemView(it: RawCatalogItem): WizardSettingsItemView {
  return {
    code: it.code,
    itemId: it.itemId,
    kind: it.kind as SupportedAuthoringKind,
    labelJa: it.labelJa ?? "",
    priceYen: it.defaultUnitPrice,
    priceLabelJa: formatYen(it.defaultUnitPrice),
    durationMinutes: it.durationMinutes,
    durationLabelJa: formatDuration(it.durationMinutes),
    displayOrder: it.displayOrder,
    priceable: it.priceable,
    quantityRequired: it.quantityRequired,
    minQuantity: it.minQuantity,
    maxQuantity: it.maxQuantity,
    presentation: it.kind === "film_type" ? toPresentationView(it.presentation) : null,
    installCoefficientBp: it.installCoefficientBp ?? null,
    coefficientLabelJa: formatCoefficient(it.installCoefficientBp),
    coupon: it.kind === "coupon" ? toCouponRuleView(it) : null,
  };
}

function sortItems(a: WizardSettingsItemView, b: WizardSettingsItemView): number {
  if (a.displayOrder !== b.displayOrder) return a.displayOrder - b.displayOrder;
  // Stable secondary key: the catalog CODE (never a label/index).
  return a.code < b.code ? -1 : a.code > b.code ? 1 : 0;
}

export function buildSections(
  items: readonly RawCatalogItem[],
): WizardSettingsSectionView[] {
  const active = items.filter(isActiveEditableItem).map(toItemView);
  return SECTION_DEFS.map((def) => {
    const groups: WizardSettingsGroupView[] = def.kinds.map((kind) => ({
      kind,
      labelJa: KIND_LABEL[kind],
      items: active.filter((i) => i.kind === kind).sort(sortItems),
    }));
    return {
      id: def.id,
      labelJa: def.labelJa,
      descriptionJa: def.descriptionJa,
      anchorId: def.anchorId,
      kinds: def.kinds,
      groups,
      itemCount: groups.reduce((n, g) => n + g.items.length, 0),
      // B2-E2Q-D2R — NO section is required in order to confirm a review. The former
      // `film` requirement was a RANK rule (wizard_kind_policy ∩ detailer_rank), which
      // the service-offering model replaced and which the all-rank widening turned into
      // a universal block. What a family still needs in order to be USABLE is reported
      // separately, as a warning, by `computeIncompleteFamilies` below.
      required: false,
      satisfied: true,
    };
  });
}

// ── review status ──────────────────────────────────────────────────────────--

/**
 * B2-E2Q-D2R — the families the dealer turned ON that cannot yet be sold, because the
 * dealer-authored rows they need do not exist.
 *
 * This is a WARNING, never a gate. It answers "what is not usable yet", not "may this
 * configuration be reviewed" — the owner may legitimately opt into a family today and
 * register its menus tomorrow, and Step 4 already shows exactly that family as a
 * present-but-locked section while every other family stays usable.
 *
 * Only families with a DEALER-authored prerequisite appear. PPF is absent by design: all
 * of its prerequisites are global rows, which the review RPC checks structurally, so a
 * dealer can never be the reason PPF is incomplete.
 */
const FAMILY_PREREQUISITE: readonly {
  readonly family: ServiceFamily;
  readonly kind: SupportedAuthoringKind;
  readonly sectionId: WizardSettingsSectionId;
}[] = [
  { family: "window_film",   kind: "film_type",          sectionId: "film" },
  { family: "maintenance",   kind: "maintenance_menu",   sectionId: "service" },
  { family: "car_wash",      kind: "wash_menu",          sectionId: "service" },
  { family: "room_cleaning", kind: "room_cleaning_menu", sectionId: "service" },
];

function computeIncompleteFamilies(
  sections: readonly WizardSettingsSectionView[],
  offerings: ServiceOfferings,
): MissingSectionView[] {
  const missingBySection = new Map<WizardSettingsSectionId, string[]>();

  for (const p of FAMILY_PREREQUISITE) {
    if (!offerings[p.family]) continue;   // OFF ⇒ nothing is required of it
    const section = sections.find((s) => s.id === p.sectionId);
    const count = section?.groups.find((g) => g.kind === p.kind)?.items.length ?? 0;
    if (count > 0) continue;
    const list = missingBySection.get(p.sectionId) ?? [];
    list.push(SERVICE_FAMILY_LABEL_JA[p.family]);
    missingBySection.set(p.sectionId, list);
  }

  // One entry per SECTION, so the list keys stay unique even though three families
  // share the service section.
  return [...missingBySection.entries()].map(([sectionId, families]) => {
    const section = sections.find((s) => s.id === sectionId)!;
    return {
      sectionId,
      labelJa: section.labelJa,
      anchorId: section.anchorId,
      reasonJa: `${families.join("・")}をオンにしていますが、メニューが未登録のため見積では選択できません。設定の確定はこのままでも行えます。`,
    };
  });
}

function formatReviewDate(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const y = d.getFullYear();
  const m = `${d.getMonth() + 1}`.padStart(2, "0");
  const day = `${d.getDate()}`.padStart(2, "0");
  return `${y}/${m}/${day}`;
}

export function buildLastReview(
  lifecycle: RawLifecycle | null,
  reviewerName: string | null,
): LastReviewView | null {
  if (!lifecycle || lifecycle.lastReviewedRevision === null || !lifecycle.lastReviewedAtIso) {
    return null; // never reviewed → no durable history to show
  }
  const date = formatReviewDate(lifecycle.lastReviewedAtIso);
  if (!date) return null;
  return {
    dateLabelJa: `最終確認日：${date}`,
    // A deleted/unknown reviewer must never crash the page or leak an id.
    reviewerLabelJa: reviewerName ? `確認者：${reviewerName}` : null,
  };
}

// A currently-reviewed configuration is CATALOG_REVIEWED/ACTIVE with reviewed==current.
function isCurrentlyReviewed(lifecycle: RawLifecycle | null): boolean {
  if (!lifecycle) return false;
  if (lifecycle.state !== "CATALOG_REVIEWED" && lifecycle.state !== "CATALOG_ACTIVE") return false;
  return lifecycle.reviewedRevision !== null && lifecycle.reviewedRevision === lifecycle.currentRevision;
}

export function buildReviewStatus(
  sections: readonly WizardSettingsSectionView[],
  lifecycle: RawLifecycle | null,
  reviewerName: string | null,
  rankKnown: boolean,
  offerings: ServiceOfferings,
): ReviewStatusView {
  const reviewed = isCurrentlyReviewed(lifecycle);
  // Reported, never subtracted from readiness: an incomplete family is a family that is
  // not sellable yet, not a configuration that cannot be reviewed.
  const missingSections = computeIncompleteFamilies(sections, offerings);
  // Fail closed on the ONE thing the confirm RPC also refuses without: an authoritative
  // rank. Nothing about catalog contents can make a review unconfirmable any more.
  const reviewReady = rankKnown;
  const statusDetailJa = reviewed
    ? "現在の設定内容は確認済みです。"
    : !rankKnown
      ? "店舗ランクを確認できないため確定できません。"
      : "設定内容を確認して確定してください。";
  return {
    reviewed,
    reviewRequired: !reviewed,
    reviewReady,
    statusLabelJa: reviewed ? "確認済み" : "確認が必要です",
    statusDetailJa,
    missingSections,
    lastReview: buildLastReview(lifecycle, reviewerName),
  };
}

// ── coating / coupon cards ───────────────────────────────────────────────────

export function buildCoatingSummary(count: number): CoatingSummaryView {
  return {
    titleJa: "コーティング価格",
    configuredCount: count,
    summaryJa: count > 0 ? `登録済みコーティング：${count}件` : "コーティングが登録されていません",
    noticeJa: "コーティングの価格は「価格・メニュー設定」で管理します。ここでは編集しません。",
    editHref: COATING_EDIT_HREF,
    editLabelJa: "価格設定を開く",
  };
}

/**
 * PPF + coating reduction rules. There is deliberately NO default rule: the canonical baseline
 * requires the reduction to come from dealer-defined settings, never from a client constant, so an
 * empty list means "no reduction applies" and must never be silently substituted.
 */
export function buildPpfCoatingAdjustmentSection(
  rules: readonly RawPpfCoatingAdjustment[] | undefined,
  ppfMethodLabels: Readonly<Record<string, string>> | undefined,
  coatingLabels: Readonly<Record<string, string>> | undefined,
): PpfCoatingAdjustmentSectionView {
  const views: PpfCoatingAdjustmentView[] = (rules ?? [])
    .filter((r) => r.deletedAt === null)
    .filter((r): r is RawPpfCoatingAdjustment & { adjustmentType: "amount" | "percent" } =>
      r.adjustmentType === "amount" || r.adjustmentType === "percent")
    .map((r) => ({
      ruleId: r.ruleId,
      ppfMethodCode: r.ppfMethodCode,
      // Fall back to the CODE, never to a blank: an unlabelled rule must stay identifiable.
      ppfMethodLabelJa: ppfMethodLabels?.[r.ppfMethodCode] ?? r.ppfMethodCode,
      coatingCode: r.coatingCode,
      coatingLabelJa: coatingLabels?.[r.coatingCode] ?? r.coatingCode,
      adjustmentType: r.adjustmentType,
      adjustmentValue: r.adjustmentValue,
      // Adjustments stay in BASIS POINTS — unchanged by the B1.1-B3 coupon-unit correction.
      adjustmentLabelJa: formatDiscountValue(r.adjustmentType, r.adjustmentValue),
      isActive: r.isActive,
    }))
    .sort((a, b) =>
      a.ppfMethodCode !== b.ppfMethodCode
        ? a.ppfMethodCode < b.ppfMethodCode ? -1 : 1
        : a.coatingCode < b.coatingCode ? -1 : a.coatingCode > b.coatingCode ? 1 : 0,
    );

  return {
    titleJa: "PPF＋コーティング減額",
    descriptionJa: "PPFとコーティングを併用する場合の減額規則です。登録がない組み合わせは減額されません。",
    anchorId: "section-ppf-coating-adjustment",
    rules: views,
  };
}

// ── top-level assembly ───────────────────────────────────────────────────────

export function buildEstimateWizardSettingsView(raw: RawSettingsData): EstimateWizardSettingsView {
  const permission = mapPermission(raw.role);
  const sections = buildSections(raw.items);
  const reviewStatus = buildReviewStatus(
    sections, raw.lifecycle, raw.reviewerName, raw.rankKnown, raw.serviceOfferings,
  );
  return {
    permission,
    canEdit: permission === "editable",
    rankKnown: raw.rankKnown,
    // Carried through verbatim; never derived from rank or from item counts.
    serviceOfferings: raw.serviceOfferings,
    reviewStatus,
    sections,
    coating: buildCoatingSummary(raw.coatingCount),
    ppfCoatingAdjustment: buildPpfCoatingAdjustmentSection(
      raw.ppfCoatingAdjustments,
      raw.ppfMethodLabels,
      raw.coatingLabels,
    ),
    viewedRevision: raw.lifecycle?.currentRevision ?? 0,
  };
}

// ── action-error / review-outcome presentation (Japanese, safe) ───────────────

export function presentActionError(code: WizardCatalogActionErrorCode): string {
  switch (code) {
    case "PERMISSION_DENIED":
      return "この設定を変更できるのはオーナーまたはマネージャーです";
    case "DEALER_CONTEXT_REQUIRED":
    case "UNAUTHENTICATED":
      return "セッションが確認できませんでした。再度ログインしてください。";
    case "VALIDATION_ERROR":
    case "UNSUPPORTED_KIND":
      return "入力内容を確認してください。";
    case "INVALID_COEFFICIENT":
      return "施工係数は 0 より大きい整数（basis points, 10000 = ×1.00）で入力してください。";
    case "INVALID_COUPON_RULE":
      return "クーポンの割引種別・割引値・併用可否を確認してください。";
    case "INVALID_ADJUSTMENT_RULE":
      return "PPF＋コーティング減額の対象・種別・値を確認してください。";
    case "RANK_UNAVAILABLE":
      return "店舗ランクを確定できませんでした。管理者にお問い合わせください。";
    case "RPC_ERROR":
    default:
      return "処理に失敗しました。時間をおいて再度お試しください。";
  }
}

export const CONCURRENCY_MESSAGE_JA = "設定内容が更新されました。最新の内容を確認してください。";
export const STAFF_READONLY_MESSAGE_JA = "この設定を変更できるのはオーナーまたはマネージャーです";

/**
 * Interpret a successful review against the revision the client last rendered.
 * A mismatch means the configuration changed underneath the confirmation, so the
 * user must re-check the latest content. `reviewedRevision`/`viewedRevision` are
 * internal, non-visible values — only the returned message/kind is presentation.
 */
export function interpretReviewOutcome(
  reviewedRevision: number,
  viewedRevision: number,
): { kind: "success" | "stale"; messageJa: string } {
  if (reviewedRevision !== viewedRevision) {
    return { kind: "stale", messageJa: CONCURRENCY_MESSAGE_JA };
  }
  return { kind: "success", messageJa: "設定内容を確認済みにしました。" };
}
