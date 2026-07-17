"use client";

// C2C4 — Estimate Wizard settings client. Consumes ONLY the presentation-safe DTO and
// the accepted C2C3 server actions. It never sends a dealer id or rank, never writes to
// the database directly, never mounts the Estimate Wizard, and never optimistically
// claims success. After every successful mutation it re-fetches the authoritative view
// via router.refresh(). Owner/manager may edit; everyone else is strictly read-only —
// the server actions remain the real security boundary.

import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  saveWizardCatalogItem,
  archiveWizardCatalogItem,
  confirmWizardCatalogReview,
} from "@/lib/wizard-catalog/wizard-catalog-authoring-actions";
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
}

const KIND_LABEL: Record<SupportedAuthoringKind, string> = {
  film_type: "ウィンドウフィルム",
  maintenance_menu: "メンテナンス",
  wash_menu: "洗車",
  room_cleaning_menu: "室内清掃",
  other_work_preset: "その他作業",
  store_global_option: "店舗オプション",
};

const SERVICE_KINDS: SupportedAuthoringKind[] = ["maintenance_menu", "wash_menu", "room_cleaning_menu"];

const inputCls =
  "w-full bg-[#1e293b] border border-slate-700 rounded-lg px-2.5 py-2 text-sm text-slate-200 focus:outline-none focus:border-blue-500 disabled:opacity-50";
const primaryBtn =
  "px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-medium rounded-lg transition-colors";
const secondaryBtn =
  "px-3 py-1.5 bg-slate-700 hover:bg-slate-600 disabled:opacity-50 text-slate-200 text-xs font-medium rounded-lg transition-colors";
const dangerBtn =
  "px-4 py-2 bg-red-700 hover:bg-red-600 disabled:opacity-50 text-white text-sm font-medium rounded-lg transition-colors";

function emptyDraft(kind: SupportedAuthoringKind): DraftFields {
  return {
    itemId: null, kind, labelJa: "", displayOrder: "", priceYen: "", durationMinutes: "",
    priceable: true, quantityRequired: false, minQuantity: "", maxQuantity: "",
    brand: "", vlt: "", heatRejection: "", color: "",
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
  };
}

// Build the raw record with ONLY the fields valid for the draft's kind.
function buildRaw(d: DraftFields): Record<string, unknown> {
  const raw: Record<string, unknown> = { kind: d.kind, labelJa: d.labelJa };
  if (d.itemId) raw.itemId = d.itemId;
  if (d.displayOrder.trim() !== "") raw.displayOrder = d.displayOrder.trim();
  const isMenu = SERVICE_KINDS.includes(d.kind);
  if ((isMenu || d.kind === "film_type" || d.kind === "store_global_option") && d.priceYen.trim() !== "") {
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

  return (
    <div className="flex flex-col gap-6">
      {toast && (
        <div
          role="status"
          className={`px-3 py-2 rounded-lg text-xs font-medium border ${
            toast.type === "ok"
              ? "bg-green-900/60 text-green-300 border-green-700/40"
              : toast.type === "info"
                ? "bg-amber-900/50 text-amber-200 border-amber-700/40"
                : "bg-red-900/60 text-red-300 border-red-700/40"
          }`}
        >
          {toast.text}
        </div>
      )}

      {/* Read-only notice for staff */}
      {!canEdit && (
        <div className="px-4 py-3 bg-slate-800/50 border border-slate-700 rounded-xl text-xs text-slate-300">
          {STAFF_READONLY_MESSAGE_JA}
        </div>
      )}

      {/* Configuration status card */}
      <section className="px-4 py-4 bg-slate-900/60 border border-slate-800 rounded-xl flex flex-col gap-3">
        <div className="flex items-center justify-between gap-3">
          <div className="flex flex-col">
            <span className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider">設定ステータス</span>
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
              title={status.reviewReady ? "内容を確認済みにします" : "必須項目を登録してください"}
            >
              {isPending ? "処理中…" : "内容を確認して確定"}
            </button>
          )}
        </div>
        <p className="text-xs text-slate-400">{status.statusDetailJa}</p>

        {status.missingSections.length > 0 && (
          <div className="flex flex-col gap-1 rounded-lg bg-amber-950/30 border border-amber-800/40 px-3 py-2">
            <span className="text-[11px] font-semibold text-amber-300">未登録の必須項目</span>
            {status.missingSections.map((m) => (
              <a key={m.sectionId} href={`#${m.anchorId}`} className="text-[11px] text-amber-200 underline hover:text-amber-100">
                {m.labelJa}：{m.reasonJa}
              </a>
            ))}
          </div>
        )}

        {status.lastReview && (
          <div className="text-[11px] text-slate-500">
            {status.lastReview.dateLabelJa}
            {status.lastReview.reviewerLabelJa ? `／${status.lastReview.reviewerLabelJa}` : ""}
          </div>
        )}
      </section>

      {/* Coating summary + link only */}
      <section className="px-4 py-4 bg-slate-900/60 border border-slate-800 rounded-xl flex flex-col gap-2">
        <span className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider">{view.coating.titleJa}</span>
        <p className="text-sm text-slate-200">{view.coating.summaryJa}</p>
        <p className="text-[11px] text-slate-500">{view.coating.noticeJa}</p>
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

      {/* Coupon planned card */}
      <section className="px-4 py-4 bg-slate-900/40 border border-slate-800 rounded-xl flex flex-col gap-1">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-slate-300">{view.coupon.titleJa}</span>
          <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-700 text-slate-300">{view.coupon.badgeJa}</span>
        </div>
        <p className="text-[11px] text-slate-500">{view.coupon.descriptionJa}</p>
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
    <section id={section.anchorId} className="px-4 py-4 bg-slate-900/60 border border-slate-800 rounded-xl flex flex-col gap-3 scroll-mt-4">
      <div className="flex items-start justify-between gap-3">
        <div className="flex flex-col">
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold text-slate-100">{section.labelJa}</span>
            {section.required && (
              <span className={`text-[10px] px-1.5 py-0.5 rounded ${section.satisfied ? "bg-emerald-900/60 text-emerald-300" : "bg-amber-900/60 text-amber-300"}`}>
                {section.satisfied ? "必須・登録済" : "必須・未登録"}
              </span>
            )}
          </div>
          <span className="text-[11px] text-slate-500">{section.descriptionJa}</span>
        </div>
        {canEdit && (
          <button type="button" onClick={() => onAdd(activeKind)} disabled={isPending} className={secondaryBtn}>
            ＋ 追加
          </button>
        )}
      </div>

      {isService && (
        <div className="flex gap-1" role="tablist" aria-label="サービス種別">
          {SERVICE_KINDS.map((k) => (
            <button
              key={k}
              type="button"
              role="tab"
              aria-selected={serviceTab === k}
              onClick={() => onServiceTab(k)}
              className={`px-3 py-1.5 text-xs rounded-lg transition-colors ${
                serviceTab === k ? "bg-blue-600 text-white" : "bg-slate-800 text-slate-300 hover:bg-slate-700"
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
            <li key={it.code} className="flex items-center justify-between gap-3 rounded-lg bg-[#0f172a] border border-slate-800 px-3 py-2.5">
              <div className="flex flex-col min-w-0">
                <span className="text-sm text-slate-200 truncate">{it.labelJa}</span>
                <span className="text-[11px] text-slate-500">
                  {it.priceLabelJa ?? "価格なし"}
                  {it.durationLabelJa ? `・${it.durationLabelJa}` : ""}
                  {it.kind === "store_global_option" && it.quantityRequired ? "・数量指定あり" : ""}
                </span>
                {it.presentation && (
                  <span className="text-[10px] text-slate-600 truncate">
                    {[it.presentation.brand, it.presentation.vlt, it.presentation.heatRejection, it.presentation.color].filter(Boolean).join(" / ")}
                  </span>
                )}
              </div>
              {canEdit && (
                <div className="flex items-center gap-2 shrink-0">
                  <button type="button" onClick={() => onEdit(it)} disabled={isPending} className={secondaryBtn}>編集</button>
                  <button type="button" onClick={() => onArchive(it)} disabled={isPending} className="px-3 py-1.5 bg-slate-800 hover:bg-red-900/40 disabled:opacity-50 text-red-300 text-xs font-medium rounded-lg transition-colors">無効化</button>
                </div>
              )}
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-[11px] text-slate-600 px-1 py-3">まだ登録がありません。</p>
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
  const supportsPrice = draft.kind !== "other_work_preset";
  const titleJa = `${KIND_LABEL[draft.kind]}を${draft.itemId ? "編集" : "追加"}`;

  const Err = ({ id }: { id: string }) =>
    errors[id] ? <span id={`err-${id}`} className="text-[11px] text-red-400">{errors[id]}</span> : null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center sm:items-stretch sm:justify-end bg-black/60"
      onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}
      role="dialog"
      aria-modal="true"
      aria-label={titleJa}
    >
      <div className="w-full sm:w-[440px] sm:max-w-[92vw] sm:h-full bg-[#0f172a] border border-slate-700 rounded-t-2xl sm:rounded-t-none sm:rounded-l-2xl shadow-2xl flex flex-col max-h-[88vh] sm:max-h-full">
        <div className="flex items-center justify-between px-4 py-3 border-b border-slate-800">
          <span className="text-sm font-semibold text-slate-100">{titleJa}</span>
          <button type="button" onClick={onClose} disabled={isPending} className="text-slate-500 hover:text-slate-300 text-lg leading-none disabled:opacity-50" aria-label="閉じる">×</button>
        </div>

        <div className="flex-1 overflow-y-auto px-4 py-4 flex flex-col gap-4">
          {errors._form && (
            <div className="px-3 py-2 rounded-lg bg-red-900/40 border border-red-800/60 text-[11px] text-red-300">{errors._form}</div>
          )}

          <label className="flex flex-col gap-1">
            <span className="text-[11px] text-slate-400">表示名（日本語）<span className="text-red-400">必須</span></span>
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
              <span className="text-[11px] text-slate-400">価格（税抜・円）</span>
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
              <span className="text-[11px] text-slate-400">所要時間（分・任意）</span>
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

          {isFilm && (
            <div className="flex flex-col gap-3 rounded-lg bg-slate-900/40 border border-slate-800 px-3 py-3">
              <span className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider">フィルム情報（任意）</span>
              {(["brand", "vlt", "heatRejection", "color"] as const).map((k) => (
                <label key={k} className="flex flex-col gap-1">
                  <span className="text-[11px] text-slate-400">
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
                <span className="text-[11px] text-slate-300">価格対象にする</span>
              </label>
              <label className="flex items-center gap-2">
                <input type="checkbox" checked={draft.quantityRequired} onChange={(e) => set({ quantityRequired: e.target.checked })} disabled={isPending} />
                <span className="text-[11px] text-slate-300">数量入力を必須にする</span>
              </label>
              <div className="grid grid-cols-2 gap-3">
                <label className="flex flex-col gap-1">
                  <span className="text-[11px] text-slate-400">最小数量</span>
                  <input className={inputCls} inputMode="numeric" value={draft.minQuantity} onChange={(e) => set({ minQuantity: e.target.value })} disabled={isPending} aria-invalid={!!errors.minQuantity} />
                  <Err id="minQuantity" />
                </label>
                <label className="flex flex-col gap-1">
                  <span className="text-[11px] text-slate-400">最大数量</span>
                  <input className={inputCls} inputMode="numeric" value={draft.maxQuantity} onChange={(e) => set({ maxQuantity: e.target.value })} disabled={isPending} aria-invalid={!!errors.maxQuantity} />
                  <Err id="maxQuantity" />
                </label>
              </div>
            </div>
          )}

          <label className="flex flex-col gap-1">
            <span className="text-[11px] text-slate-400">表示順（任意・0以上）</span>
            <input className={inputCls} inputMode="numeric" value={draft.displayOrder} onChange={(e) => set({ displayOrder: e.target.value })} disabled={isPending} aria-invalid={!!errors.displayOrder} aria-describedby={errors.displayOrder ? "err-displayOrder" : undefined} />
            <Err id="displayOrder" />
          </label>
        </div>

        <div className="flex items-center justify-end gap-2 px-4 py-3 border-t border-slate-800">
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
    <div className="fixed inset-0 z-[60] flex items-end justify-center sm:items-center bg-black/60" role="dialog" aria-modal="true" aria-label="無効化の確認"
      onMouseDown={(e) => { if (e.target === e.currentTarget) onCancel(); }}>
      <div className="w-full sm:w-[380px] sm:max-w-[92vw] bg-[#0f172a] border border-slate-700 rounded-t-2xl sm:rounded-2xl shadow-2xl flex flex-col">
        <div className="px-4 py-3 border-b border-slate-800">
          <span className="text-sm font-semibold text-slate-100">項目を無効化しますか？</span>
        </div>
        <div className="px-4 py-4 flex flex-col gap-2">
          <p className="text-sm text-slate-200">「{item.labelJa}」を無効化します。</p>
          <p className="text-[11px] text-slate-400">
            無効化しても過去の見積の内容には影響しません。今後の新しい見積でのみ選択できなくなります。削除ではありません。
          </p>
        </div>
        <div className="flex items-center justify-end gap-2 px-4 py-3 border-t border-slate-800">
          <button type="button" onClick={onCancel} disabled={isPending} className={secondaryBtn}>キャンセル</button>
          <button type="button" onClick={onConfirm} disabled={isPending} className={dangerBtn}>{isPending ? "処理中…" : "無効化する"}</button>
        </div>
      </div>
    </div>
  );
}
