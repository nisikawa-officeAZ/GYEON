// C2C4 — Estimate Wizard settings: PURE CORE (no React, no DB, no server-only).
//
// Deterministic transforms from authoritative server-resolved data into the
// presentation-safe DTO. This layer never reads a database, never resolves auth, and
// never lets a raw lifecycle enum, revision number, dealer id, or authorization
// detail reach visible text. All visible labels are Japanese.

import type { DealerStaffRole } from "@/lib/staff/staff-types";
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
  CouponPlannedView,
  FilmPresentationView,
  SupportedAuthoringKind,
} from "./estimate-wizard-settings-types";

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
  /** Computed by the loader from wizard_kind_policy(film_type) ∩ authoritative rank. */
  readonly filmRequired: boolean;
  readonly items: readonly RawCatalogItem[];
  readonly lifecycle: RawLifecycle | null;
  readonly coatingCount: number;
  /** Resolved display name for last_reviewed_by, or null if unknown/deleted. */
  readonly reviewerName: string | null;
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
  { id: "service", labelJa: "サービスメニュー", descriptionJa: "メンテナンス・洗車・室内清掃のメニューを登録します。", anchorId: "section-service", kinds: ["maintenance_menu", "wash_menu", "room_cleaning_menu"] },
  { id: "otherwork", labelJa: "その他作業プリセット", descriptionJa: "見積時に手入力する作業の名称プリセットです（金額は現場入力）。", anchorId: "section-otherwork", kinds: ["other_work_preset"] },
  { id: "store", labelJa: "店舗オプション", descriptionJa: "出張費などの店舗共通オプションを登録します。", anchorId: "section-store", kinds: ["store_global_option"] },
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
  };
}

function sortItems(a: WizardSettingsItemView, b: WizardSettingsItemView): number {
  if (a.displayOrder !== b.displayOrder) return a.displayOrder - b.displayOrder;
  // Stable secondary key: the catalog CODE (never a label/index).
  return a.code < b.code ? -1 : a.code > b.code ? 1 : 0;
}

export function buildSections(
  items: readonly RawCatalogItem[],
  filmRequired: boolean,
): WizardSettingsSectionView[] {
  const active = items.filter(isActiveEditableItem).map(toItemView);
  return SECTION_DEFS.map((def) => {
    const groups: WizardSettingsGroupView[] = def.kinds.map((kind) => ({
      kind,
      labelJa: KIND_LABEL[kind],
      items: active.filter((i) => i.kind === kind).sort(sortItems),
    }));
    const itemCount = groups.reduce((n, g) => n + g.items.length, 0);
    const required = def.id === "film" ? filmRequired : false;
    return {
      id: def.id,
      labelJa: def.labelJa,
      descriptionJa: def.descriptionJa,
      anchorId: def.anchorId,
      kinds: def.kinds,
      groups,
      itemCount,
      required,
      satisfied: required ? itemCount > 0 : true,
    };
  });
}

// ── review status ──────────────────────────────────────────────────────────--

function computeMissingSections(sections: readonly WizardSettingsSectionView[]): MissingSectionView[] {
  return sections
    .filter((s) => s.required && !s.satisfied)
    .map((s) => ({
      sectionId: s.id,
      labelJa: s.labelJa,
      anchorId: s.anchorId,
      reasonJa: s.id === "film"
        ? "この店舗ランクではウィンドウフィルムの種類を1件以上登録する必要があります。"
        : "必須項目が未登録です。",
    }));
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
): ReviewStatusView {
  const reviewed = isCurrentlyReviewed(lifecycle);
  const missingSections = computeMissingSections(sections);
  // Fail closed: rank must be known before a review can be confirmed.
  const reviewReady = rankKnown && missingSections.length === 0;
  const statusDetailJa = reviewed
    ? "現在の設定内容は確認済みです。"
    : !rankKnown
      ? "店舗ランクを確認できないため確定できません。"
      : reviewReady
        ? "設定内容を確認して確定してください。"
        : "必須項目が未登録のため確定できません。";
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

export function buildCouponPlanned(): CouponPlannedView {
  return {
    titleJa: "クーポン",
    badgeJa: "今後対応予定",
    descriptionJa: "クーポン機能は今後対応予定です。現在は登録・編集できません。",
  };
}

// ── top-level assembly ───────────────────────────────────────────────────────

export function buildEstimateWizardSettingsView(raw: RawSettingsData): EstimateWizardSettingsView {
  const permission = mapPermission(raw.role);
  const sections = buildSections(raw.items, raw.filmRequired);
  const reviewStatus = buildReviewStatus(sections, raw.lifecycle, raw.reviewerName, raw.rankKnown);
  return {
    permission,
    canEdit: permission === "editable",
    rankKnown: raw.rankKnown,
    filmRequired: raw.filmRequired,
    reviewStatus,
    sections,
    coating: buildCoatingSummary(raw.coatingCount),
    coupon: buildCouponPlanned(),
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
