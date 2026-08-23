"use client";

// C2C4 — Estimate Wizard settings client. Consumes ONLY the presentation-safe DTO and
// the accepted C2C3 server actions. It never sends a dealer id or rank, never writes to
// the database directly, never mounts the Estimate Wizard, and never optimistically
// claims success. After every successful mutation it re-fetches the authoritative view
// via router.refresh(). Owner/manager may edit; everyone else is strictly read-only —
// the server actions remain the real security boundary.

import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from "react";
import type { ReactNode } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  saveWizardCatalogItem,
  archiveWizardCatalogItem,
  confirmWizardCatalogReview,
  setServiceOffering,
} from "@/lib/wizard-catalog/wizard-catalog-authoring-actions";
import { SERVICE_FAMILIES, SERVICE_FAMILY_LABEL_JA, type ServiceFamily } from "@/lib/estimates/service-categories";
import { validateWizardItemForm } from "@/lib/wizard-catalog/estimate-wizard-settings-form";
import {
  presentActionError,
  interpretReviewOutcome,
  STAFF_READONLY_MESSAGE_JA,
} from "@/lib/wizard-catalog/estimate-wizard-settings-core";
import type {
  EstimateWizardSettingsView,
  WizardSettingsSectionView,
  WizardSettingsItemView,
  SupportedAuthoringKind,
} from "@/lib/wizard-catalog/estimate-wizard-settings-types";

// ── S8B — four real Estimate Wizard access cards ────────────────────────────
// A visual access layer over the existing sections below; hrefs are anchors into this
// same page, derived from the authoritative `view.sections`, never hardcoded route text.
// No new route, action, form, or business behavior is introduced here.

type WizardAccessBadgeVariant = "solid_active" | "solid_unset";

function WizardAccessBadgeChip({ variant }: { variant: WizardAccessBadgeVariant }) {
  if (variant === "solid_active") {
    return (
      <span className="inline-flex items-center rounded-full bg-gradient-to-br from-[#60a5fa] to-[#2563eb] px-2.5 py-1 text-[10px] font-bold tracking-wide text-white shadow-[0_2px_8px_rgba(37,99,235,.35)]">
        有効
      </span>
    );
  }
  return (
    <span className="inline-flex items-center rounded-full border border-[#94a3b8]/30 bg-[#94a3b8]/20 px-2.5 py-1 text-[10px] font-bold tracking-wide text-[#94a3b8]">
      未設定
    </span>
  );
}

interface WizardAccessCardDef {
  readonly id: string;
  readonly label: string;
  readonly labelEn: string;
  readonly description: string;
  readonly badge: WizardAccessBadgeVariant;
  /** null when the derived section anchor is unavailable — the card then fails closed: informational, not clickable, no fabricated route. */
  readonly anchorId: string | null;
  readonly icon: ReactNode;
}

function WizardAccessCard({ card }: { card: WizardAccessCardDef }) {
  const isReachable = card.anchorId !== null;
  const inner = (
    <div
      className={[
        "group relative flex h-full min-h-[64px] flex-row items-center gap-3 rounded-2xl border p-4 transition-all duration-200",
        "md:min-h-[168px] md:flex-col md:items-stretch md:gap-3 md:p-5",
        isReachable
          ? "cursor-pointer border-[#263955] bg-[#111826]/90 hover:-translate-y-0.5 hover:border-[#3b6eb4] hover:bg-[#141e2f] hover:shadow-[0_18px_45px_rgba(0,0,0,.24)]"
          : "border-[#1d2b40] bg-[#0b111d]/80",
      ].join(" ")}
    >
      <span className="grid h-12 w-12 shrink-0 place-items-center rounded-xl border border-[#31568c] bg-[#122142] md:rounded-2xl">
        <span className="text-[#91b9ff]" aria-hidden="true">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            {card.icon}
          </svg>
        </span>
      </span>
      <div className="min-w-0 flex-1 md:pr-16">
        <p className="truncate text-[15px] font-bold leading-tight text-[#edf3fc] md:overflow-visible md:whitespace-normal">{card.label}</p>
        <p className="mt-1 truncate text-[9px] font-semibold tracking-[0.18em] text-[#8191ad] md:overflow-visible md:whitespace-normal">{card.labelEn}</p>
      </div>
      <span className="shrink-0 md:absolute md:right-4 md:top-4">
        <WizardAccessBadgeChip variant={card.badge} />
      </span>
      <p className="hidden text-[12px] leading-6 text-[#95a4bc] md:mt-3 md:block">{card.description}</p>
      {isReachable && (
        <span className="hidden text-[11px] font-semibold tracking-[0.08em] text-[#5f9cff] md:mt-auto md:block md:self-start">開く →</span>
      )}
    </div>
  );

  if (!isReachable) {
    return (
      <div className="h-full" role="group" aria-label={card.label}>
        {inner}
      </div>
    );
  }
  return (
    <a
      href={`#${card.anchorId}`}
      className="block h-full rounded-2xl transition-transform duration-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#5f9cff] active:scale-[0.985]"
    >
      {inner}
    </a>
  );
}

function buildWizardAccessCards(view: EstimateWizardSettingsView): WizardAccessCardDef[] {
  const serviceSection = view.sections.find(section => section.id === "service");
  const otherworkSection = view.sections.find(section => section.id === "otherwork");
  const storeSection = view.sections.find(section => section.id === "store");

  return [
    {
      id: "service-availability",
      label: "施工メニュー提供設定",
      labelEn: "SERVICE AVAILABILITY",
      description: "この店舗で提供する施工メニューを選択します。オフにしたメニューは見積ウィザードに表示されません。",
      badge: "solid_active",
      anchorId: "section-service-offerings",
      icon: (
        <>
          <rect x="4" y="4" width="16" height="16" rx="2" />
          <path d="M8 9l1.5 1.5L12 8" />
          <path d="M14 9.5h4M14 14.5h4" />
          <path d="M8 13.5l1.5 1.5L12 12.5" />
        </>
      ),
    },
    {
      id: "service-menus",
      label: "サービスメニュー",
      labelEn: "SERVICE MENUS",
      description: "メンテナンス・洗車・室内清掃のメニューを登録します。",
      badge: "solid_unset",
      anchorId: serviceSection?.anchorId ?? null,
      icon: (
        <>
          <path d="M14.7 6.3a4 4 0 0 0-5.2 5.2L4 17l3 3 5.5-5.5a4 4 0 0 0 5.2-5.2l-2.6 2.6-2-2z" />
          <path d="M18.5 13c1 1.3 2 2.3 2 3.4a2 2 0 1 1-4 0c0-1.1 1-2.1 2-3.4z" />
        </>
      ),
    },
    {
      id: "work-presets",
      label: "その他作業プリセット",
      labelEn: "WORK PRESETS",
      description: "見積時に手入力する作業の名称プリセットです（金額は現場入力）。",
      badge: "solid_unset",
      anchorId: otherworkSection?.anchorId ?? null,
      icon: (
        <>
          <rect x="5" y="4" width="14" height="17" rx="2" />
          <path d="M9 4a3 3 0 0 1 6 0" />
          <path d="M9 10h6M9 13.5h4" />
          <path d="M17.5 16.5v4M15.5 18.5h4" />
        </>
      ),
    },
    {
      id: "shop-options",
      label: "店舗オプション",
      labelEn: "SHOP OPTIONS",
      description: "出張費などの店舗共通オプションを登録します。",
      badge: "solid_unset",
      anchorId: storeSection?.anchorId ?? null,
      icon: (
        <>
          <path d="M4 7h10M18 7h2M4 12h4M12 12h8M4 17h12M20 17h0" />
          <circle cx="16" cy="7" r="2" />
          <circle cx="10" cy="12" r="2" />
          <circle cx="18" cy="17" r="2" />
        </>
      ),
    },
  ];
}

type Toast = { text: string; type: "ok" | "err" | "info" };

interface DraftFields {
  itemId: string | null;
  kind: SupportedAuthoringKind;
  labelJa: string;
  displayOrder: string;
  priceYen: string;
  durationMinutes: string;
  priceable: boolean;
  quantityRequired: boolean;
  minQuantity: string;
  maxQuantity: string;
  brand: string;
  vlt: string;
  heatRejection: string;
  color: string;
  // B1.1 — entered as a human ×multiplier (e.g. "1.25") and converted to integer basis points
  // on submit, so no float multiplier is ever stored or sent.
  coefficient: string;
  couponDiscountType: "amount" | "percent";
  couponDiscountValue: string;
  couponCombinable: boolean;
  couponValidFrom: string;
  couponValidTo: string;
}

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

const SERVICE_KINDS: SupportedAuthoringKind[] = ["maintenance_menu", "wash_menu", "room_cleaning_menu"];
/** The kinds that carry an installation coefficient. */
const COEFFICIENT_KINDS: SupportedAuthoringKind[] = ["film_type", "ppf_type_group"];
const BP_PER_UNIT = 10_000;

/** "1.25" → 12500. Returns null for anything not a positive finite multiplier. */
function multiplierToBasisPoints(raw: string): number | null {
  const t = raw.trim();
  if (t === "") return null;
  const n = Number(t);
  if (!Number.isFinite(n) || n <= 0) return null;
  return Math.round(n * BP_PER_UNIT);
}

/** 12500 → "1.25". Keeps the editor showing the same multiplier the operator typed. */
function basisPointsToMultiplier(bp: number | null): string {
  if (bp === null || !Number.isInteger(bp) || bp <= 0) return "";
  return String(bp / BP_PER_UNIT);
}

const inputCls =
  "w-full rounded-xl border border-[#263955] bg-[#0b1220]/80 px-2.5 py-2 text-sm text-[#E8EEF7] placeholder-[#5C6B84] transition-colors focus:border-[#60a5fa] focus:outline-none focus:ring-2 focus:ring-[#2F6BFF]/25 disabled:opacity-50";
const primaryBtn =
  "px-4 py-2 rounded-xl bg-[#2F6BFF] hover:bg-[#3b82f6] disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-semibold shadow-[0_0_22px_rgba(47,107,255,0.32)] transition-colors";
const secondaryBtn =
  "px-3 py-1.5 rounded-xl border border-[#263955] bg-[#0b1220]/70 hover:border-[#60a5fa]/50 hover:text-[#E8EEF7] disabled:opacity-50 text-[#93A4BD] text-xs font-semibold transition-colors";
const dangerBtn =
  "px-4 py-2 rounded-xl border border-red-500/35 bg-red-950/40 hover:bg-red-900/40 disabled:opacity-50 text-red-300 text-sm font-semibold transition-colors";
const dangerSecondaryBtn =
  "px-3 py-1.5 rounded-xl border border-[#263955] bg-[#0b1220]/70 hover:border-red-500/40 hover:bg-red-950/30 disabled:opacity-50 text-red-300 text-xs font-semibold transition-colors";
const glassSectionCls =
  "px-4 py-4 rounded-2xl border border-[#263955] bg-[#111826]/90 backdrop-blur-xl flex flex-col gap-3";

function emptyDraft(kind: SupportedAuthoringKind): DraftFields {
  return {
    itemId: null, kind, labelJa: "", displayOrder: "", priceYen: "", durationMinutes: "",
    priceable: true, quantityRequired: false, minQuantity: "", maxQuantity: "",
    brand: "", vlt: "", heatRejection: "", color: "",
    coefficient: "", couponDiscountType: "amount", couponDiscountValue: "",
    couponCombinable: true, couponValidFrom: "", couponValidTo: "",
  };
}

function draftFromItem(item: WizardSettingsItemView): DraftFields {
  return {
    itemId: item.itemId,
    kind: item.kind,
    labelJa: item.labelJa,
    displayOrder: String(item.displayOrder ?? ""),
    priceYen: item.priceYen === null ? "" : String(item.priceYen),
    durationMinutes: item.durationMinutes === null ? "" : String(item.durationMinutes),
    priceable: item.priceable,
    quantityRequired: item.quantityRequired,
    minQuantity: item.minQuantity === null ? "" : String(item.minQuantity),
    maxQuantity: item.maxQuantity === null ? "" : String(item.maxQuantity),
    brand: item.presentation?.brand ?? "",
    vlt: item.presentation?.vlt ?? "",
    heatRejection: item.presentation?.heatRejection ?? "",
    color: item.presentation?.color ?? "",
    coefficient: basisPointsToMultiplier(item.installCoefficientBp),
    couponDiscountType: item.coupon?.discountType ?? "amount",
    // Coupon values are stored in the unit they are authored in — yen for `amount`, an INTEGER
    // PERCENT 0–100 for `percent` — so both display directly with no conversion. (Contrast the
    // PPF coefficient just above, which IS stored in basis points and is converted.)
    couponDiscountValue: item.coupon === null ? "" : String(item.coupon.discountValue),
    couponCombinable: item.coupon?.combinable ?? true,
    couponValidFrom: item.coupon?.validFrom ?? "",
    couponValidTo: item.coupon?.validTo ?? "",
  };
}

// Build the raw record with ONLY the fields valid for the draft's kind.
function buildRaw(d: DraftFields): Record<string, unknown> {
  const raw: Record<string, unknown> = { kind: d.kind, labelJa: d.labelJa };
  if (d.itemId) raw.itemId = d.itemId;
  if (d.displayOrder.trim() !== "") raw.displayOrder = d.displayOrder.trim();
  const isMenu = SERVICE_KINDS.includes(d.kind);
  if (
    (isMenu || d.kind === "film_type" || d.kind === "ppf_type_group" || d.kind === "store_global_option") &&
    d.priceYen.trim() !== ""
  ) {
    raw.priceYen = d.priceYen.trim();
  }
  if (isMenu && d.durationMinutes.trim() !== "") raw.durationMinutes = d.durationMinutes.trim();
  if (d.kind === "film_type") {
    const pres: Record<string, string> = {};
    if (d.brand.trim()) pres.brand = d.brand.trim();
    if (d.vlt.trim()) pres.vlt = d.vlt.trim();
    if (d.heatRejection.trim()) pres.heatRejection = d.heatRejection.trim();
    if (d.color.trim()) pres.color = d.color.trim();
    if (Object.keys(pres).length > 0) raw.presentation = pres;
  }
  if (d.kind === "store_global_option") {
    raw.priceable = d.priceable;
    raw.quantityRequired = d.quantityRequired;
    if (d.minQuantity.trim() !== "") raw.minQuantity = d.minQuantity.trim();
    if (d.maxQuantity.trim() !== "") raw.maxQuantity = d.maxQuantity.trim();
  }
  // ── PPF COEFFICIENT: BASIS POINTS ──────────────────────────────────────────
  // The operator types a ×multiplier ("1.25"); the column is basis points, so it IS converted.
  // This is the ONLY unit conversion performed on submit.
  if (COEFFICIENT_KINDS.includes(d.kind)) {
    const bp = multiplierToBasisPoints(d.coefficient);
    if (bp !== null) raw.installCoefficientBp = bp;
  }
  // ── COUPON VALUE: NO CONVERSION ────────────────────────────────────────────
  // `coupon_discount_value` is stored in the unit it is authored in: yen for `amount`, and an
  // INTEGER PERCENT 0–100 for `percent` (enforced by `wci_coupon_percent_range`). Multiplying by
  // 100 here — the B1.1 defect — sent a 10% coupon as 1000 and the CHECK rejected every rate
  // above 1%. Truncation, not rounding, keeps the submitted value exactly what was typed.
  if (d.kind === "coupon") {
    raw.couponDiscountType = d.couponDiscountType;
    const v = Number(d.couponDiscountValue.trim());
    if (d.couponDiscountValue.trim() !== "" && Number.isFinite(v)) {
      raw.couponDiscountValue = Math.trunc(v);
    }
    raw.couponCombinable = d.couponCombinable;
    raw.couponValidFrom = d.couponValidFrom.trim() === "" ? null : d.couponValidFrom.trim();
    raw.couponValidTo = d.couponValidTo.trim() === "" ? null : d.couponValidTo.trim();
  }
  return raw;
}

export default function EstimateWizardSettingsClient({ view }: { view: EstimateWizardSettingsView }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [toast, setToast] = useState<Toast | null>(null);
  const [draft, setDraft] = useState<DraftFields | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [archiveTarget, setArchiveTarget] = useState<WizardSettingsItemView | null>(null);
  const [serviceTab, setServiceTab] = useState<SupportedAuthoringKind>("maintenance_menu");
  const busyRef = useRef(false);

  const canEdit = view.canEdit;
  const overlayOpen = draft !== null;

  const showToast = useCallback((text: string, type: Toast["type"]) => {
    setToast({ text, type });
    window.setTimeout(() => setToast(null), 6000);
  }, []);

  // Escape closes the overlay / archive dialog.
  useEffect(() => {
    if (!overlayOpen && !archiveTarget) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !isPending) {
        setDraft(null);
        setArchiveTarget(null);
        setFieldErrors({});
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [overlayOpen, archiveTarget, isPending]);

  const guardEdit = useCallback((): boolean => {
    if (!canEdit) {
      showToast(STAFF_READONLY_MESSAGE_JA, "err");
      return false;
    }
    return true;
  }, [canEdit, showToast]);

  const openAdd = useCallback((kind: SupportedAuthoringKind) => {
    if (!guardEdit()) return;
    setFieldErrors({});
    setDraft(emptyDraft(kind));
  }, [guardEdit]);

  const openEdit = useCallback((item: WizardSettingsItemView) => {
    if (!guardEdit()) return;
    setFieldErrors({});
    setDraft(draftFromItem(item));
  }, [guardEdit]);

  const closeOverlay = useCallback(() => {
    if (isPending) return;
    setDraft(null);
    setFieldErrors({});
  }, [isPending]);

  const submitSave = useCallback(() => {
    if (!draft || busyRef.current) return;
    if (!guardEdit()) return;
    const parsed = validateWizardItemForm(buildRaw(draft));
    if (!parsed.ok) {
      setFieldErrors(parsed.errors); // preserve entered values; show field errors
      return;
    }
    setFieldErrors({});
    busyRef.current = true;
    startTransition(async () => {
      try {
        const res = await saveWizardCatalogItem(parsed.input);
        if (res.ok) {
          setDraft(null);
          showToast(res.action === "updated" ? "更新しました" : "追加しました", "ok");
          router.refresh(); // re-fetch authoritative view (returns to review-required)
        } else {
          showToast(presentActionError(res.code), "err");
        }
      } finally {
        busyRef.current = false;
      }
    });
  }, [draft, guardEdit, router, showToast]);

  const confirmArchive = useCallback(() => {
    if (!archiveTarget || busyRef.current) return;
    if (!guardEdit()) return;
    const target = archiveTarget;
    busyRef.current = true;
    startTransition(async () => {
      try {
        const res = await archiveWizardCatalogItem(target.itemId);
        if (res.ok) {
          setArchiveTarget(null);
          showToast(res.action === "already_archived" ? "すでに無効化されています" : "無効化しました", "ok");
          router.refresh();
        } else {
          showToast(presentActionError(res.code), "err");
        }
      } finally {
        busyRef.current = false;
      }
    });
  }, [archiveTarget, guardEdit, router, showToast]);

  const submitReview = useCallback(() => {
    if (busyRef.current) return;
    if (!guardEdit()) return;
    busyRef.current = true;
    startTransition(async () => {
      try {
        const res = await confirmWizardCatalogReview();
        if (res.ok) {
          const outcome = interpretReviewOutcome(res.reviewedRevision, view.viewedRevision);
          showToast(outcome.messageJa, outcome.kind === "stale" ? "info" : "ok");
        } else {
          showToast(presentActionError(res.code), "err");
        }
        router.refresh(); // always re-sync authoritative state after a review attempt
      } finally {
        busyRef.current = false;
      }
    });
  }, [guardEdit, router, showToast, view.viewedRevision]);

  const status = view.reviewStatus;

  /**
   * B2-E2G — toggle one service-offering family.
   *
   * Sends an EXPLICIT boolean for both directions: turning a service off persists `false` rather
   * than removing anything, so the dealer's decision is recorded as a decision. Nothing is claimed
   * optimistically — the authoritative view is re-fetched, exactly like every other mutation here.
   */
  const onToggleOffering = useCallback((family: ServiceFamily, next: boolean) => {
    if (!guardEdit()) return;
    if (busyRef.current) return;
    busyRef.current = true;
    startTransition(async () => {
      try {
        const res = await setServiceOffering(family, next);
        if (res.ok) {
          showToast(next ? "この施工メニューを提供する設定にしました" : "この施工メニューを提供しない設定にしました", "ok");
          router.refresh();
        } else {
          showToast(presentActionError(res.code), "err");
        }
      } finally {
        busyRef.current = false;
      }
    });
  }, [guardEdit, router, showToast]);

  return (
    <div className="flex flex-col gap-6">
      {toast && (
        <div
          role="status"
          className={`px-3 py-2 rounded-xl text-xs font-medium border backdrop-blur-xl ${
            toast.type === "ok"
              ? "bg-emerald-950/40 text-emerald-400 border-emerald-500/30"
              : toast.type === "info"
                ? "bg-amber-950/30 text-amber-400 border-amber-500/20"
                : "bg-red-950/40 text-red-300 border-red-500/35"
          }`}
        >
          {toast.text}
        </div>
      )}

      {/* Read-only notice for staff */}
      {!canEdit && (
        <div className="px-4 py-3 rounded-xl border border-[#263955] bg-[#111826]/70 text-xs text-[#93A4BD]">
          {STAFF_READONLY_MESSAGE_JA}
        </div>
      )}

      {/* S8B — four real Estimate Wizard access cards; visual access layer only, no new route/data flow */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
        {buildWizardAccessCards(view).map((card) => (
          <WizardAccessCard key={card.id} card={card} />
        ))}
      </div>

      {/* ── B2-E2G: 施工メニュー提供設定 ───────────────────────────────────────────
          Which services this shop offers at all. Deliberately ABOVE the catalog sections: a dealer
          decides what they sell before they configure the details of it, and an opted-out family's
          catalog section is not something they need to look at. Rank is never mentioned — it does
          not participate in this decision. */}
      <section
        id="section-service-offerings"
        className={`${glassSectionCls} scroll-mt-4`}
      >
        <div className="flex flex-col gap-1">
          <h2 className="text-sm font-bold text-[#edf3fc]">施工メニュー提供設定</h2>
          <p className="text-xs text-[#95a4bc] leading-relaxed">
            この店舗で提供する施工メニューを選択します。オフにしたメニューは見積ウィザードに表示されません。
          </p>
          <p className="text-[11px] text-amber-300/80 leading-relaxed">
            オンにしたメニューを見積で使用するには、対応するメニュー内容の登録と、設定内容の確認（レビュー確定）が必要です。
          </p>
        </div>

        <ul className="flex flex-col divide-y divide-[#263955]">
          {SERVICE_FAMILIES.map((family) => {
            const on = view.serviceOfferings[family];
            return (
              <li key={family} className="flex items-center justify-between gap-3 py-2.5">
                <span className="text-xs text-[#c3cee2]">{SERVICE_FAMILY_LABEL_JA[family]}</span>
                <button
                  type="button"
                  role="switch"
                  aria-checked={on}
                  aria-label={`${SERVICE_FAMILY_LABEL_JA[family]}を提供する`}
                  data-testid={`offering-toggle-${family}`}
                  disabled={!canEdit || isPending}
                  onClick={() => onToggleOffering(family, !on)}
                  className={`min-h-[44px] px-4 rounded-full text-xs font-semibold border transition-colors disabled:opacity-40 ${
                    on
                      ? "bg-gradient-to-br from-[#60a5fa] to-[#2563eb] text-white border-transparent shadow-[0_2px_8px_rgba(37,99,235,.35)] hover:brightness-110"
                      : "bg-[#0b1220]/70 text-[#8191ad] border-[#263955] hover:border-[#3b6eb4] hover:text-[#c3cee2]"
                  }`}
                >
                  {on ? "提供する" : "提供しない"}
                </button>
              </li>
            );
          })}
        </ul>
      </section>

      {/* Configuration status card */}
      <section className={glassSectionCls}>
        <div className="flex items-center justify-between gap-3">
          <div className="flex flex-col">
            <span className="text-[10px] font-semibold text-[#7788a4] uppercase tracking-wider">設定ステータス</span>
            <span
              className={`text-sm font-semibold ${status.reviewed ? "text-emerald-400" : "text-amber-300"}`}
            >
              {status.statusLabelJa}
            </span>
          </div>
          {canEdit && status.reviewRequired && (
            <button
              type="button"
              onClick={submitReview}
              disabled={!status.reviewReady || isPending}
              className={primaryBtn}
              title={status.reviewReady ? "内容を確認済みにします" : "店舗ランクを確認できないため確定できません"}
            >
              {isPending ? "処理中…" : "内容を確認して確定"}
            </button>
          )}
        </div>
        <p className="text-xs text-[#95a4bc]">{status.statusDetailJa}</p>

        {status.missingSections.length > 0 && (
          <div className="flex flex-col gap-1 rounded-xl bg-amber-950/30 border border-amber-800/40 px-3 py-2">
            <span className="text-[11px] font-semibold text-amber-300">見積で使えないサービス（確定はできます）</span>
            {status.missingSections.map((m) => (
              <a key={m.sectionId} href={`#${m.anchorId}`} className="text-[11px] text-amber-200 underline hover:text-amber-100">
                {m.labelJa}：{m.reasonJa}
              </a>
            ))}
          </div>
        )}

        {status.lastReview && (
          <div className="text-[11px] text-[#7788a4]">
            {status.lastReview.dateLabelJa}
            {status.lastReview.reviewerLabelJa ? `／${status.lastReview.reviewerLabelJa}` : ""}
          </div>
        )}
      </section>

      {/* Coating summary + link only */}
      <section className="px-4 py-4 rounded-2xl border border-[#263955] bg-[#111826]/90 backdrop-blur-xl flex flex-col gap-2">
        <span className="text-[10px] font-semibold text-[#7788a4] uppercase tracking-wider">{view.coating.titleJa}</span>
        <p className="text-sm text-[#c3cee2]">{view.coating.summaryJa}</p>
        <p className="text-[11px] text-[#7788a4]">{view.coating.noticeJa}</p>
        <Link href={view.coating.editHref} className={`${secondaryBtn} self-start`}>
          {view.coating.editLabelJa}
        </Link>
      </section>

      {/* Editable sections */}
      {view.sections.map((section) => (
        <SectionCard
          key={section.id}
          section={section}
          canEdit={canEdit}
          isPending={isPending}
          serviceTab={serviceTab}
          onServiceTab={setServiceTab}
          onAdd={openAdd}
          onEdit={openEdit}
          onArchive={(it) => { if (guardEdit()) setArchiveTarget(it); }}
        />
      ))}

      {/* PPF + coating reduction rules (B1.1). Read-only listing: rules are authored through
          saveDealerPpfCoatingAdjustment. There is no default rule — an empty list genuinely means
          "no reduction applies", and a client constant must never stand in for dealer settings. */}
      <section
        id={view.ppfCoatingAdjustment.anchorId}
        className={`${glassSectionCls} scroll-mt-4`}
      >
        <div className="flex flex-col gap-1">
          <span className="text-sm font-semibold text-[#c3cee2]">{view.ppfCoatingAdjustment.titleJa}</span>
          <p className="text-[11px] text-[#7788a4]">{view.ppfCoatingAdjustment.descriptionJa}</p>
        </div>
        {view.ppfCoatingAdjustment.rules.length === 0 ? (
          <p className="text-[11px] text-[#7788a4]">減額規則は登録されていません。</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {view.ppfCoatingAdjustment.rules.map((r) => (
              <li
                key={r.ruleId}
                className="flex flex-wrap items-center gap-2 px-3 py-2 rounded-xl bg-[#0b1220]/70 border border-[#263955]"
              >
                <span className="text-sm text-[#c3cee2]">
                  {r.ppfMethodLabelJa} ＋ {r.coatingLabelJa}
                </span>
                <span className="text-xs text-[#8191ad]">{r.adjustmentLabelJa}</span>
                {!r.isActive && (
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-[#151f31] border border-[#263955] text-[#8191ad]">無効</span>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Add / edit overlay: bottom sheet on mobile, side panel on tablet/desktop */}
      {overlayOpen && draft && (
        <DraftOverlay
          draft={draft}
          errors={fieldErrors}
          isPending={isPending}
          onChange={setDraft}
          onClose={closeOverlay}
          onSubmit={submitSave}
        />
      )}

      {/* Deactivate (無効化) confirmation */}
      {archiveTarget && (
        <ConfirmArchive
          item={archiveTarget}
          isPending={isPending}
          onCancel={() => { if (!isPending) setArchiveTarget(null); }}
          onConfirm={confirmArchive}
        />
      )}
    </div>
  );
}

// ── section card ─────────────────────────────────────────────────────────────

function SectionCard({
  section, canEdit, isPending, serviceTab, onServiceTab, onAdd, onEdit, onArchive,
}: {
  section: WizardSettingsSectionView;
  canEdit: boolean;
  isPending: boolean;
  serviceTab: SupportedAuthoringKind;
  onServiceTab: (k: SupportedAuthoringKind) => void;
  onAdd: (k: SupportedAuthoringKind) => void;
  onEdit: (i: WizardSettingsItemView) => void;
  onArchive: (i: WizardSettingsItemView) => void;
}) {
  const isService = section.id === "service";
  const activeKind = isService ? serviceTab : section.kinds[0];
  const activeGroup = section.groups.find((g) => g.kind === activeKind) ?? section.groups[0];

  return (
    <section id={section.anchorId} className={`${glassSectionCls} scroll-mt-4`}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex flex-col">
          <div className="flex items-center gap-2">
            <span className="text-sm font-bold text-[#edf3fc]">{section.labelJa}</span>
            {section.required && (
              <span className={`text-[10px] px-1.5 py-0.5 rounded-full border font-medium ${section.satisfied ? "bg-emerald-950/40 text-emerald-400 border-emerald-500/30" : "bg-amber-950/30 text-amber-400 border-amber-500/20"}`}>
                {section.satisfied ? "必須・登録済" : "必須・未登録"}
              </span>
            )}
          </div>
          <span className="text-[11px] text-[#7788a4]">{section.descriptionJa}</span>
        </div>
        {canEdit && (
          <button type="button" onClick={() => onAdd(activeKind)} disabled={isPending} className={secondaryBtn}>
            ＋ 追加
          </button>
        )}
      </div>

      {isService && (
        <div className="flex gap-1.5" role="tablist" aria-label="サービス種別">
          {SERVICE_KINDS.map((k) => (
            <button
              key={k}
              type="button"
              role="tab"
              aria-selected={serviceTab === k}
              onClick={() => onServiceTab(k)}
              className={`px-3 py-1.5 text-xs font-semibold rounded-full border transition-colors ${
                serviceTab === k
                  ? "bg-gradient-to-br from-[#60a5fa] to-[#2563eb] text-white border-transparent shadow-[0_2px_8px_rgba(37,99,235,.35)]"
                  : "bg-[#0b1220]/70 text-[#8191ad] border-[#263955] hover:border-[#3b6eb4] hover:text-[#c3cee2]"
              }`}
            >
              {KIND_LABEL[k]}
            </button>
          ))}
        </div>
      )}

      {activeGroup && activeGroup.items.length > 0 ? (
        <ul className="flex flex-col gap-2">
          {activeGroup.items.map((it) => (
            <li key={it.code} className="flex items-center justify-between gap-3 rounded-xl bg-[#0b1220]/70 border border-[#263955] px-3 py-2.5">
              <div className="flex flex-col min-w-0">
                <span className="text-sm text-[#edf3fc] truncate">{it.labelJa}</span>
                <span className="text-[11px] text-[#7788a4]">
                  {it.priceLabelJa ?? "価格なし"}
                  {it.durationLabelJa ? `・${it.durationLabelJa}` : ""}
                  {it.kind === "store_global_option" && it.quantityRequired ? "・数量指定あり" : ""}
                </span>
                {it.presentation && (
                  <span className="text-[10px] text-[#5C6B84] truncate">
                    {[it.presentation.brand, it.presentation.vlt, it.presentation.heatRejection, it.presentation.color].filter(Boolean).join(" / ")}
                  </span>
                )}
              </div>
              {canEdit && (
                <div className="flex items-center gap-2 shrink-0">
                  <button type="button" onClick={() => onEdit(it)} disabled={isPending} className={secondaryBtn}>編集</button>
                  <button type="button" onClick={() => onArchive(it)} disabled={isPending} className={dangerSecondaryBtn}>無効化</button>
                </div>
              )}
            </li>
          ))}
        </ul>
      ) : (
        <div className="flex flex-col items-center justify-center gap-2 px-4 py-8 text-center">
          <div className="grid h-11 w-11 place-items-center rounded-xl border border-[#31568c] bg-[#122142] text-[#5f83b8]">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <rect x="4" y="5" width="16" height="15" rx="2" />
              <path d="M4 10h16M9 15h6" />
            </svg>
          </div>
          <p className="text-[11px] text-[#7788a4]">まだ登録がありません。</p>
        </div>
      )}
    </section>
  );
}

// ── draft overlay (responsive) ───────────────────────────────────────────────

function DraftOverlay({
  draft, errors, isPending, onChange, onClose, onSubmit,
}: {
  draft: DraftFields;
  errors: Record<string, string>;
  isPending: boolean;
  onChange: (d: DraftFields) => void;
  onClose: () => void;
  onSubmit: () => void;
}) {
  const firstFieldRef = useRef<HTMLInputElement>(null);
  useEffect(() => { firstFieldRef.current?.focus(); }, []);

  const set = (patch: Partial<DraftFields>) => onChange({ ...draft, ...patch });
  const isMenu = SERVICE_KINDS.includes(draft.kind);
  const isFilm = draft.kind === "film_type";
  const isStore = draft.kind === "store_global_option";
  const hasCoefficient = COEFFICIENT_KINDS.includes(draft.kind);
  const isCoupon = draft.kind === "coupon";
  // Coupons carry no catalog unit price — their monetary meaning is the discount value below,
  // and the RPC rejects `default_unit_price` on a coupon (WIZ_COUPON_PRICE_FORBIDDEN).
  const supportsPrice = draft.kind !== "other_work_preset" && draft.kind !== "coupon";
  const titleJa = `${KIND_LABEL[draft.kind]}を${draft.itemId ? "編集" : "追加"}`;

  const Err = ({ id }: { id: string }) =>
    errors[id] ? <span id={`err-${id}`} className="text-[11px] text-red-400">{errors[id]}</span> : null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center sm:items-stretch sm:justify-end bg-black/60 backdrop-blur-sm"
      onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}
      role="dialog"
      aria-modal="true"
      aria-label={titleJa}
    >
      <div className="w-full sm:w-[440px] sm:max-w-[92vw] sm:h-full bg-[#111826]/95 border border-[#263955] backdrop-blur-xl rounded-t-2xl sm:rounded-t-none sm:rounded-l-2xl shadow-[0_18px_60px_rgba(0,0,0,0.4)] flex flex-col max-h-[88vh] sm:max-h-full">
        <div className="flex items-center justify-between px-4 py-3 border-b border-[#263955]">
          <span className="text-sm font-bold text-[#edf3fc]">{titleJa}</span>
          <button type="button" onClick={onClose} disabled={isPending} className="text-[#7788a4] hover:text-[#c3cee2] text-lg leading-none disabled:opacity-50" aria-label="閉じる">×</button>
        </div>

        <div className="flex-1 overflow-y-auto px-4 py-4 flex flex-col gap-4">
          {errors._form && (
            <div className="px-3 py-2 rounded-xl bg-red-950/40 border border-red-500/35 text-[11px] text-red-300">{errors._form}</div>
          )}

          <label className="flex flex-col gap-1">
            <span className="text-[11px] text-[#93A4BD]">表示名（日本語）<span className="text-red-400">必須</span></span>
            <input
              ref={firstFieldRef}
              className={inputCls}
              value={draft.labelJa}
              onChange={(e) => set({ labelJa: e.target.value })}
              disabled={isPending}
              aria-invalid={!!errors.labelJa}
              aria-describedby={errors.labelJa ? "err-labelJa" : undefined}
            />
            <Err id="labelJa" />
          </label>

          {supportsPrice && (
            <label className="flex flex-col gap-1">
              <span className="text-[11px] text-[#93A4BD]">価格（税抜・円）</span>
              <input
                className={inputCls}
                inputMode="numeric"
                value={draft.priceYen}
                onChange={(e) => set({ priceYen: e.target.value })}
                disabled={isPending}
                aria-invalid={!!errors.priceYen}
                aria-describedby={errors.priceYen ? "err-priceYen" : undefined}
              />
              <Err id="priceYen" />
            </label>
          )}

          {isMenu && (
            <label className="flex flex-col gap-1">
              <span className="text-[11px] text-[#93A4BD]">所要時間（分・任意）</span>
              <input
                className={inputCls}
                inputMode="numeric"
                value={draft.durationMinutes}
                onChange={(e) => set({ durationMinutes: e.target.value })}
                disabled={isPending}
                aria-invalid={!!errors.durationMinutes}
                aria-describedby={errors.durationMinutes ? "err-durationMinutes" : undefined}
              />
              <Err id="durationMinutes" />
            </label>
          )}

          {hasCoefficient && (
            <label className="flex flex-col gap-1">
              <span className="text-[11px] text-[#93A4BD]">施工係数（任意・倍率）</span>
              <input
                className={inputCls}
                inputMode="decimal"
                placeholder="例: 1.25"
                value={draft.coefficient}
                onChange={(e) => set({ coefficient: e.target.value })}
                disabled={isPending}
                aria-invalid={!!errors.installCoefficientBp}
                aria-describedby={errors.installCoefficientBp ? "err-installCoefficientBp" : undefined}
              />
              <span className="text-[10px] text-[#7788a4]">
                基本単価に掛ける倍率です。1.00 で等倍。未入力の場合は係数なし（等倍）になります。
              </span>
              <Err id="installCoefficientBp" />
            </label>
          )}

          {isCoupon && (
            <div className="flex flex-col gap-3 rounded-xl bg-[#0b1220]/70 border border-[#263955] px-3 py-3">
              <span className="text-[10px] font-semibold text-[#7788a4] uppercase tracking-wider">クーポン内容</span>

              <div className="flex flex-col gap-1">
                <span className="text-[11px] text-[#93A4BD]">割引種別</span>
                {/* Button-based, never a dropdown (Ver2.2 UI rule). */}
                <div className="flex gap-2">
                  {(["amount", "percent"] as const).map((t) => (
                    <button
                      key={t}
                      type="button"
                      onClick={() => set({ couponDiscountType: t })}
                      disabled={isPending}
                      aria-pressed={draft.couponDiscountType === t}
                      className={
                        draft.couponDiscountType === t
                          ? "px-3 py-1.5 rounded-full text-xs font-semibold bg-gradient-to-br from-[#60a5fa] to-[#2563eb] text-white shadow-[0_2px_8px_rgba(37,99,235,.35)]"
                          : "px-3 py-1.5 rounded-full text-xs font-semibold border border-[#263955] bg-[#0b1220]/70 text-[#8191ad] hover:border-[#3b6eb4] hover:text-[#c3cee2]"
                      }
                    >
                      {t === "amount" ? "金額（円）" : "率（％）"}
                    </button>
                  ))}
                </div>
              </div>

              <label className="flex flex-col gap-1">
                <span className="text-[11px] text-[#93A4BD]">
                  {draft.couponDiscountType === "amount" ? "割引額（円）" : "割引率（％）"}
                </span>
                <input
                  className={inputCls}
                  inputMode="decimal"
                  value={draft.couponDiscountValue}
                  onChange={(e) => set({ couponDiscountValue: e.target.value })}
                  disabled={isPending}
                  aria-invalid={!!errors.couponDiscountValue}
                  aria-describedby={errors.couponDiscountValue ? "err-couponDiscountValue" : undefined}
                />
                <Err id="couponDiscountValue" />
              </label>

              <div className="flex flex-col gap-1">
                <span className="text-[11px] text-[#93A4BD]">併用</span>
                <div className="flex gap-2">
                  {([true, false] as const).map((v) => (
                    <button
                      key={String(v)}
                      type="button"
                      onClick={() => set({ couponCombinable: v })}
                      disabled={isPending}
                      aria-pressed={draft.couponCombinable === v}
                      className={
                        draft.couponCombinable === v
                          ? "px-3 py-1.5 rounded-full text-xs font-semibold bg-gradient-to-br from-[#60a5fa] to-[#2563eb] text-white shadow-[0_2px_8px_rgba(37,99,235,.35)]"
                          : "px-3 py-1.5 rounded-full text-xs font-semibold border border-[#263955] bg-[#0b1220]/70 text-[#8191ad] hover:border-[#3b6eb4] hover:text-[#c3cee2]"
                      }
                    >
                      {v ? "他クーポンと併用可" : "併用不可"}
                    </button>
                  ))}
                </div>
                <span className="text-[10px] text-[#7788a4]">
                  併用不可のクーポンが他のクーポンと同時に選択された場合、見積では全クーポンが適用されません。
                </span>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <label className="flex flex-col gap-1">
                  <span className="text-[11px] text-[#93A4BD]">有効期間（開始・任意）</span>
                  <input
                    className={inputCls}
                    type="date"
                    value={draft.couponValidFrom}
                    onChange={(e) => set({ couponValidFrom: e.target.value })}
                    disabled={isPending}
                  />
                </label>
                <label className="flex flex-col gap-1">
                  <span className="text-[11px] text-[#93A4BD]">有効期間（終了・任意）</span>
                  <input
                    className={inputCls}
                    type="date"
                    value={draft.couponValidTo}
                    onChange={(e) => set({ couponValidTo: e.target.value })}
                    disabled={isPending}
                  />
                </label>
              </div>
              <Err id="couponValidTo" />
            </div>
          )}

          {isFilm && (
            <div className="flex flex-col gap-3 rounded-xl bg-[#0b1220]/70 border border-[#263955] px-3 py-3">
              <span className="text-[10px] font-semibold text-[#7788a4] uppercase tracking-wider">フィルム情報（任意）</span>
              {(["brand", "vlt", "heatRejection", "color"] as const).map((k) => (
                <label key={k} className="flex flex-col gap-1">
                  <span className="text-[11px] text-[#93A4BD]">
                    {k === "brand" ? "ブランド" : k === "vlt" ? "可視光線透過率" : k === "heatRejection" ? "遮熱性能" : "カラー"}
                  </span>
                  <input className={inputCls} value={draft[k]} onChange={(e) => set({ [k]: e.target.value } as Partial<DraftFields>)} disabled={isPending} />
                </label>
              ))}
              <Err id="presentation" />
            </div>
          )}

          {isStore && (
            <div className="flex flex-col gap-3">
              <label className="flex items-center gap-2">
                <input type="checkbox" checked={draft.priceable} onChange={(e) => set({ priceable: e.target.checked })} disabled={isPending} />
                <span className="text-[11px] text-[#c3cee2]">価格対象にする</span>
              </label>
              <label className="flex items-center gap-2">
                <input type="checkbox" checked={draft.quantityRequired} onChange={(e) => set({ quantityRequired: e.target.checked })} disabled={isPending} />
                <span className="text-[11px] text-[#c3cee2]">数量入力を必須にする</span>
              </label>
              <div className="grid grid-cols-2 gap-3">
                <label className="flex flex-col gap-1">
                  <span className="text-[11px] text-[#93A4BD]">最小数量</span>
                  <input className={inputCls} inputMode="numeric" value={draft.minQuantity} onChange={(e) => set({ minQuantity: e.target.value })} disabled={isPending} aria-invalid={!!errors.minQuantity} />
                  <Err id="minQuantity" />
                </label>
                <label className="flex flex-col gap-1">
                  <span className="text-[11px] text-[#93A4BD]">最大数量</span>
                  <input className={inputCls} inputMode="numeric" value={draft.maxQuantity} onChange={(e) => set({ maxQuantity: e.target.value })} disabled={isPending} aria-invalid={!!errors.maxQuantity} />
                  <Err id="maxQuantity" />
                </label>
              </div>
            </div>
          )}

          <label className="flex flex-col gap-1">
            <span className="text-[11px] text-[#93A4BD]">表示順（任意・0以上）</span>
            <input className={inputCls} inputMode="numeric" value={draft.displayOrder} onChange={(e) => set({ displayOrder: e.target.value })} disabled={isPending} aria-invalid={!!errors.displayOrder} aria-describedby={errors.displayOrder ? "err-displayOrder" : undefined} />
            <Err id="displayOrder" />
          </label>
        </div>

        <div className="flex items-center justify-end gap-2 px-4 py-3 border-t border-[#263955]">
          <button type="button" onClick={onClose} disabled={isPending} className={secondaryBtn}>キャンセル</button>
          <button type="button" onClick={onSubmit} disabled={isPending} className={primaryBtn}>
            {isPending ? "保存中…" : "保存"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── deactivate confirmation ─────────────────────────────────────────────────

function ConfirmArchive({
  item, isPending, onCancel, onConfirm,
}: {
  item: WizardSettingsItemView;
  isPending: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  return (
    <div className="fixed inset-0 z-[60] flex items-end justify-center sm:items-center bg-black/60 backdrop-blur-sm" role="dialog" aria-modal="true" aria-label="無効化の確認"
      onMouseDown={(e) => { if (e.target === e.currentTarget) onCancel(); }}>
      <div className="w-full sm:w-[380px] sm:max-w-[92vw] bg-[#111826]/95 border border-[#263955] backdrop-blur-xl rounded-t-2xl sm:rounded-2xl shadow-[0_18px_60px_rgba(0,0,0,0.4)] flex flex-col">
        <div className="px-4 py-3 border-b border-[#263955]">
          <span className="text-sm font-bold text-[#edf3fc]">項目を無効化しますか？</span>
        </div>
        <div className="px-4 py-4 flex flex-col gap-2">
          <p className="text-sm text-[#c3cee2]">「{item.labelJa}」を無効化します。</p>
          <p className="text-[11px] text-[#93A4BD]">
            無効化しても過去の見積の内容には影響しません。今後の新しい見積でのみ選択できなくなります。削除ではありません。
          </p>
        </div>
        <div className="flex items-center justify-end gap-2 px-4 py-3 border-t border-[#263955]">
          <button type="button" onClick={onCancel} disabled={isPending} className={secondaryBtn}>キャンセル</button>
          <button type="button" onClick={onConfirm} disabled={isPending} className={dangerBtn}>{isPending ? "処理中…" : "無効化する"}</button>
        </div>
      </div>
    </div>
  );
}
