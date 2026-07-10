"use client";

// Estimate Wizard Ver2.2 — NON-FUNCTIONAL preview for Step1/Step2 (validation only).
//
// Supplies representative props (local presentation state + no-op handlers) so Step1/Step2
// can be visually validated inside the responsive WizardShell. NOT connected to the live
// EstimateEditor and contains NO pricing / OCR / save business logic. Not route-mounted.

import { useState } from "react";
import { WizardShell } from "../foundation/WizardShell";
import type { WizardStepId } from "../foundation/tokens";
import type { WizardTotalsView } from "../foundation/MiniTotalBar";
import { Step1Customer } from "./Step1Customer";
import { Step2Vehicle } from "./Step2Vehicle";
import { Step3Category } from "./Step3Category";
import { Step4Estimate } from "./Step4Estimate";
import { CoatingSelector } from "./CoatingSelector";
import {
  firstLayerOptions, secondLayerOptions, thirdLayerOptions, isCoatingAvailableForRank,
} from "./coating-matrix";
import { PpfSelector } from "./PpfSelector";
import { DEFAULT_PPF_METHODS, DEFAULT_PPF_PARTS, DEFAULT_PPF_TYPE_GROUPS } from "./ppf-config";
import { WindowFilmSelector } from "./WindowFilmSelector";
import { DEFAULT_WINDOW_AREAS, EXAMPLE_FILM_TYPES } from "./window-film-config";
import { BodyMaintenanceSelector } from "./BodyMaintenanceSelector";
import { EXAMPLE_MAINTENANCE_MENUS } from "./body-maintenance-config";
import { CarWashSelector } from "./CarWashSelector";
import { EXAMPLE_WASH_MENUS } from "./car-wash-config";
import { RoomCleaningSelector } from "./RoomCleaningSelector";
import { EXAMPLE_ROOM_MENUS } from "./room-cleaning-config";
import { OtherWorkSelector } from "./OtherWorkSelector";
import { EXAMPLE_OTHER_WORK_PRESETS } from "./other-work-config";
import { StoreGlobalOptionsSelector } from "./StoreGlobalOptionsSelector";
import { EXAMPLE_STORE_GLOBAL_OPTIONS } from "./store-global-options-config";
import { Step5Discount } from "./Step5Discount";
import { EXAMPLE_COUPONS } from "./discount-coupon-config";
import { Step6Notes } from "./Step6Notes";
import { initialStep6NotesState } from "./step-types";
import { Step7Review } from "./Step7Review";
import { WizardEstimatePreviewBridge } from "../integration/WizardEstimatePreviewBridge";
import type { WizardPreviewInput } from "../integration/wizardToEstimateAdapter";
import { formatYen } from "../foundation/tokens";
import type { OtherWorkCustomRow, DiscountMode, Step6NotesState } from "./step-types";
import type { ReviewField, ReviewServiceLine, ReviewPriceSummary } from "./step-types";
import type { ShopRank, LayerCount, PpfInstallationMethodId, InteriorPpfRow } from "./step-types";
import type { NewCustomerDraft, NewVehicleDraft, CustomerMode, VehicleMode } from "./step-types";
import type { BodySizeEstimate } from "@/lib/vehicles/body-size-estimate";
import { SERVICE_CATEGORY_IDS, serviceCategoryLabel } from "@/lib/estimates/service-categories";

// Preview-only cross-service scenarios (Phase 4I validation aid — not production).
const PREVIEW_SCENARIOS: { label: string; ids: string[] }[] = [
  { label: "① コーティングのみ", ids: ["coating"] },
  { label: "② PPFのみ", ids: ["ppf"] },
  { label: "③ フィルムのみ", ids: ["window"] },
  { label: "④ コーティング+PPF", ids: ["coating", "ppf"] },
  { label: "⑤ PPF+フィルム", ids: ["ppf", "window"] },
  { label: "⑥ メンテ+洗車", ids: ["maintenance", "carwash"] },
  { label: "⑦ ルーム+その他", ids: ["roomclean", "other"] },
  { label: "⑧ 全7カテゴリ", ids: [...SERVICE_CATEGORY_IDS] },
];

const MOCK_TOTALS: WizardTotalsView = { subtotal: 0, discount: 0, tax: 0, total: 0, ready: false };

function cnBtn(active: boolean): string {
  return [
    "text-[11px] px-2.5 min-h-[36px] rounded-md border transition-colors",
    active ? "bg-[#1d4ed8] border-[#1d4ed8] text-white" : "bg-[#0f172a] border-slate-700 text-slate-400",
  ].join(" ");
}
const EMPTY_NC: NewCustomerDraft = {
  name: "", phone: "", email: "", postal: "", address: "", lineId: "",
  isBusiness: false, tradeRate: "", arAllowed: false, closingDay: "", paymentDay: "",
};
const EMPTY_NV: NewVehicleDraft = {
  maker: "", model: "", grade: "", vehicle_code: "", vin: "",
  first_registration_year_month: "", registration_date: "", inspection_expiry_date: "",
  displacement: "", color: "", plate_number: "",
};

export default function ScreensPreview() {
  const [step, setStep] = useState<WizardStepId>(1);
  const [customerMode, setCustomerMode] = useState<CustomerMode>("new");
  const [vehicleMode, setVehicleMode] = useState<VehicleMode>("new");
  const [nc, setNc] = useState<NewCustomerDraft>(EMPTY_NC);
  const [nv, setNv] = useState<NewVehicleDraft>(EMPTY_NV);
  const [sizeKey, setSizeKey] = useState("");
  const [sizeEstimate, setSizeEstimate] = useState<BodySizeEstimate | null>(null);
  const [categories, setCategories] = useState<string[]>([]);
  // Screen4 (Phase 4A) preview state — presentation only, no pricing.
  const [activeSection, setActiveSection] = useState("coating");
  const [shopRank, setShopRank] = useState<ShopRank>("detailer");
  const [layerCount, setLayerCount] = useState<LayerCount | null>(null);
  const [layer1, setLayer1] = useState<string | null>(null);
  const [layer2, setLayer2] = useState<string | null>(null);
  const [layer3, setLayer3] = useState<string | null>(null);
  // Screen4 PPF (Phase 4B) preview state — presentation only, no pricing.
  const [ppfMethod, setPpfMethod] = useState<PpfInstallationMethodId | null>(null);
  const [ppfParts, setPpfParts] = useState<string[]>([]);
  const [ppfQty, setPpfQty] = useState<Record<string, number>>({});
  const [ppfType, setPpfType] = useState<string | null>(null);
  const [ppfUnitPrice, setPpfUnitPrice] = useState("");
  const [interiorRows, setInteriorRows] = useState<InteriorPpfRow[]>([]);
  const [rowSeq, setRowSeq] = useState(1);
  // Screen4 Window Film (Phase 4C) preview state — presentation only, no pricing.
  const [windowAreas, setWindowAreas] = useState<string[]>([]);
  const [windowFilm, setWindowFilm] = useState<string | null>(null);
  const [windowUnitPrice, setWindowUnitPrice] = useState("");
  // Screen4 Body Maintenance (Phase 4D) preview state — presentation only, no pricing.
  const [maintMenu, setMaintMenu] = useState<string | null>(null);
  const [maintUnitPrice, setMaintUnitPrice] = useState("");
  // Screen4 Car Wash (Phase 4E) preview state — presentation only, no pricing.
  const [washMenu, setWashMenu] = useState<string | null>(null);
  const [washUnitPrice, setWashUnitPrice] = useState("");
  // Screen4 Room Cleaning (Phase 4F) preview state — presentation only, no pricing.
  const [roomMenus, setRoomMenus] = useState<string[]>([]);
  const [roomUnitPrices, setRoomUnitPrices] = useState<Record<string, string>>({});
  // Screen4 Other Work (Phase 4G) preview state — presentation only, no pricing.
  const [owPresets, setOwPresets] = useState<string[]>([]);
  const [owPrices, setOwPrices] = useState<Record<string, string>>({});
  const [owQty, setOwQty] = useState<Record<string, number>>({});
  const [owRows, setOwRows] = useState<OtherWorkCustomRow[]>([]);
  const [owRowSeq, setOwRowSeq] = useState(1);
  // Screen4 Store Global Options (Phase 4H) preview state — presentation only, no pricing.
  const [globalOpts, setGlobalOpts] = useState<string[]>([]);
  const [globalOptPrices, setGlobalOptPrices] = useState<Record<string, string>>({});
  const [globalOptQty, setGlobalOptQty] = useState<Record<string, number>>({});
  // Screen5 Discount / Coupon (Phase 5) preview state — presentation only, no pricing.
  const [discountMode, setDiscountMode] = useState<DiscountMode>("amount");
  const [discountAmount, setDiscountAmount] = useState("");
  const [discountPercent, setDiscountPercent] = useState("");
  const [selectedCoupons, setSelectedCoupons] = useState<string[]>([]);
  const PREVIEW_SUBTOTAL = 300000; // preview-only subtotal (real value comes from parent later)
  // Screen6 Notes / Internal Memo (Phase 6) preview state — two explicit separated fields.
  const [notes, setNotes] = useState<Step6NotesState>(initialStep6NotesState);
  // Screen7 Final Review (Phase 7) preview state — local preview-only confirmation.
  const [previewConfirmed, setPreviewConfirmed] = useState(false);
  const handlePreviewConfirm = () => setPreviewConfirmed(true);
  // Phase 8 — toggle to render the read-only EstimateEditor preview via the adapter bridge.
  const [showEditorPreview, setShowEditorPreview] = useState(false);

  const clamp = (n: number) => Math.min(7, Math.max(1, n)) as WizardStepId;

  // Phase 4I — derive a VALID active section from the selected categories (fixed order). If the
  // stored activeSection was deselected, fall back to the first selected section. Entered state
  // stays in the top-level hooks above, so hidden/deselected sections keep their values.
  const orderedSelected = SERVICE_CATEGORY_IDS.filter((id) => categories.includes(id));
  const resolvedActive = categories.includes(activeSection) ? activeSection : (orderedSelected[0] ?? "");
  const showAdjustment = categories.includes("coating") && categories.includes("ppf");

  // Phase 5 — preview parent supplies the %→yen conversion (component never calculates it).
  const pctNum = Number(discountPercent);
  const convertedDiscountAmount =
    discountMode === "percent" && discountPercent !== "" && Number.isFinite(pctNum)
      ? Math.round((PREVIEW_SUBTOTAL * pctNum) / 100)
      : null;
  // Preview-only non-combinable conflict demo (real conflict comes from the parent later).
  const nonCombinable = EXAMPLE_COUPONS.filter((c) => c.combinable === false).map((c) => c.id);
  const anyCombinableSelected = selectedCoupons.some((id) => !nonCombinable.includes(id));
  const anyNonCombinableSelected = selectedCoupons.some((id) => nonCombinable.includes(id));
  const disabledCouponIds = anyNonCombinableSelected
    ? EXAMPLE_COUPONS.filter((c) => !selectedCoupons.includes(c.id)).map((c) => c.id) // 併用不可選択中 → 他を無効
    : anyCombinableSelected
      ? nonCombinable.filter((id) => !selectedCoupons.includes(id)) // 併用可選択中 → 併用不可を無効
      : [];
  const discountCouponMessages: string[] = [];
  if (anyNonCombinableSelected) discountCouponMessages.push("このクーポンは他のクーポンと併用できません。");
  if (nc.isBusiness) discountCouponMessages.push("業者掛け率適用中は追加値引きできません。");

  // Phase 7 — build read-only review DISPLAY data from the preview state (owner resolves ids →
  // labels; the review screen never resolves or calculates). Empty values become 未入力/未選択/なし.
  const yen = (v: string) => formatYen(Number(v) || 0);
  const customerName = customerMode === "select" ? "既存のお客様" : (nc.name || "未入力");
  const vehicleName =
    vehicleMode === "select" ? "既存の車両" : ([nv.maker, nv.model].filter(Boolean).join(" ") || "未入力");

  const customerFields: ReviewField[] =
    customerMode === "select"
      ? [{ label: "登録方法", value: "既存のお客様" }]
      : [
          { label: "登録方法", value: "新規のお客様" },
          { label: "お名前", value: nc.name || "未入力" },
          { label: "電話番号", value: nc.phone || "未入力" },
          { label: "メール", value: nc.email || "未入力" },
          { label: "郵便番号", value: nc.postal || "未入力" },
          { label: "住所", value: nc.address || "未入力" },
          { label: "LINE ID", value: nc.lineId || "未入力" },
          { label: "顧客区分", value: nc.isBusiness ? "業者" : "一般" },
          ...(nc.isBusiness
            ? [
                { label: "掛け率", value: nc.tradeRate ? `${nc.tradeRate}%` : "未入力" },
                { label: "掛売り", value: nc.arAllowed ? "あり" : "なし" },
                { label: "締め日", value: nc.closingDay || "未入力" },
                { label: "支払日", value: nc.paymentDay || "未入力" },
              ]
            : []),
        ];

  const vehicleFields: ReviewField[] =
    vehicleMode === "select"
      ? [{ label: "登録方法", value: "既存の車両" }]
      : [
          { label: "登録方法", value: "新規の車両" },
          { label: "メーカー", value: nv.maker || "未入力" },
          { label: "車名", value: nv.model || "未入力" },
          { label: "グレード", value: nv.grade || "未入力" },
          { label: "型式", value: nv.vehicle_code || "未入力" },
          { label: "初年度登録", value: nv.first_registration_year_month || "未入力" },
          { label: "ボディカラー", value: nv.color || "未入力" },
          { label: "ナンバー", value: nv.plate_number || "未入力" },
          { label: "排気量", value: nv.displacement || "未入力" },
          { label: "車検満了", value: nv.inspection_expiry_date || "未入力" },
          { label: "ボディサイズ(3M)", value: sizeKey || "未選択" },
        ];

  const serviceLines: ReviewServiceLine[] = [];
  for (const cat of orderedSelected) {
    if (cat === "coating") {
      const l1 = firstLayerOptions(shopRank).find((o) => o.id === layer1)?.label;
      const l2 = secondLayerOptions(layer1).find((o) => o.id === layer2)?.label;
      const l3 = thirdLayerOptions(layer1).find((o) => o.id === layer3)?.label;
      const parts = [l1, l2, l3].filter(Boolean) as string[];
      serviceLines.push({
        category: serviceCategoryLabel("coating"),
        name: layerCount ? `${layerCount}層コーティング` : "未選択",
        detail: parts.length ? parts.join(" / ") : undefined,
      });
    } else if (cat === "ppf") {
      const method = DEFAULT_PPF_METHODS.find((m) => m.id === ppfMethod)?.label;
      const type = DEFAULT_PPF_TYPE_GROUPS.flatMap((g) => g.products).find((p) => p.id === ppfType)?.label;
      const partLabels = ppfParts.map((id) => {
        const p = DEFAULT_PPF_PARTS.find((x) => x.id === id);
        const q = ppfQty[id];
        return p ? `${p.label}${q ? `×${q}` : ""}` : id;
      });
      const details: string[] = [];
      if (type) details.push(`種別: ${type}`);
      if (partLabels.length) details.push(`部位: ${partLabels.join(", ")}`);
      const interior = interiorRows.filter((r) => r.location || r.amount);
      if (interior.length) details.push(`内装: ${interior.map((r) => `${r.location || "—"}${r.amount ? ` ${r.amount}` : ""}`).join(", ")}`);
      serviceLines.push({
        category: serviceCategoryLabel("ppf"),
        name: method ?? "未選択",
        detail: details.join(" / ") || undefined,
        amount: ppfUnitPrice ? yen(ppfUnitPrice) : undefined,
      });
    } else if (cat === "window") {
      const areas = windowAreas.map((id) => DEFAULT_WINDOW_AREAS.find((a) => a.id === id)?.label ?? id);
      const film = EXAMPLE_FILM_TYPES.find((f) => f.id === windowFilm)?.label;
      const details: string[] = [];
      if (film) details.push(`フィルム: ${film}`);
      if (areas.length) details.push(`エリア: ${areas.join(", ")}`);
      serviceLines.push({
        category: serviceCategoryLabel("window"),
        name: film ?? "未選択",
        detail: details.join(" / ") || undefined,
        amount: windowUnitPrice ? yen(windowUnitPrice) : undefined,
      });
    } else if (cat === "maintenance") {
      const m = EXAMPLE_MAINTENANCE_MENUS.find((x) => x.id === maintMenu);
      serviceLines.push({
        category: serviceCategoryLabel("maintenance"),
        name: m?.name ?? "未選択",
        amount: maintUnitPrice ? yen(maintUnitPrice) : m ? formatYen(m.defaultPrice) : undefined,
      });
    } else if (cat === "carwash") {
      const m = EXAMPLE_WASH_MENUS.find((x) => x.id === washMenu);
      serviceLines.push({
        category: serviceCategoryLabel("carwash"),
        name: m?.name ?? "未選択",
        amount: washUnitPrice ? yen(washUnitPrice) : m ? formatYen(m.defaultPrice) : undefined,
      });
    } else if (cat === "roomclean") {
      const menus = roomMenus.map((id) => EXAMPLE_ROOM_MENUS.find((x) => x.id === id)?.name ?? id);
      serviceLines.push({
        category: serviceCategoryLabel("roomclean"),
        name: menus.length ? `${menus.length} メニュー` : "未選択",
        detail: menus.length ? menus.join(", ") : undefined,
      });
    } else if (cat === "other") {
      const presets = owPresets.map((id) => EXAMPLE_OTHER_WORK_PRESETS.find((x) => x.id === id)?.name ?? id);
      const customs = owRows.filter((r) => r.name.trim()).map((r) => r.name);
      const names = [...presets, ...customs];
      serviceLines.push({
        category: serviceCategoryLabel("other"),
        name: names.length ? `${names.length} 件` : "未選択",
        detail: names.length ? names.join(", ") : undefined,
      });
    }
  }
  const goptNames = globalOpts.map((id) => EXAMPLE_STORE_GLOBAL_OPTIONS.find((o) => o.id === id)?.name ?? id);
  if (goptNames.length) {
    serviceLines.push({ category: "追加サービスオプション", name: `${goptNames.length} 件`, detail: goptNames.join(", ") });
  }

  const discountFields: ReviewField[] = [
    { label: "値引きモード", value: discountMode === "amount" ? "金額値引き" : "％値引き" },
    discountMode === "amount"
      ? { label: "値引き額", value: discountAmount ? yen(discountAmount) : "なし" }
      : { label: "値引き率", value: discountPercent ? `${discountPercent}%` : "なし" },
    ...(discountMode === "percent" && convertedDiscountAmount != null
      ? [{ label: "換算値引き額（プレビュー）", value: formatYen(convertedDiscountAmount) }]
      : []),
  ];
  const couponSummaries = selectedCoupons.map((id) => {
    const c = EXAMPLE_COUPONS.find((x) => x.id === id);
    if (!c) return id;
    const v = c.discountType === "percent" ? `${c.discountValue}%` : formatYen(c.discountValue);
    return `${c.name}（${v}）`;
  });

  const priceSummary: ReviewPriceSummary = {
    mockRows: [{ label: "小計（プレビュー基準額）", value: formatYen(PREVIEW_SUBTOTAL) }],
    note: "本計算（サービス小計・オプション・税・合計）はプレビューでは行いません。今後の統合時に親の既存ロジックが算出します。",
  };

  // Phase 8 — plain snapshot of the live wizard state handed to the adapter (no logic here; the
  // adapter/mapper resolve ids → labels). The wizard remains the single state owner.
  const wizardPreviewInput: WizardPreviewInput = {
    customerMode, nc, vehicleMode, nv, sizeKey,
    categories, shopRank,
    layerCount, layer1, layer2, layer3,
    ppfMethod, ppfParts, ppfQty, ppfType, ppfUnitPrice, interiorRows,
    windowAreas, windowFilm, windowUnitPrice,
    maintMenu, maintUnitPrice, washMenu, washUnitPrice,
    roomMenus,
    owPresets, owRows,
    globalOpts,
    discountMode, discountAmount, discountPercent, convertedDiscountAmount, selectedCoupons,
    customerNotes: notes.customerNotes, internalMemo: notes.internalMemo,
    previewSubtotal: PREVIEW_SUBTOTAL,
  };

  // Phase 8 — when toggled on, render the read-only EstimateEditor preview through the adapter
  // bridge (Wizard → Adapter → EstimateEditor). Toggling off (adapter removed) returns to the
  // wizard, i.e. the preview disappears. No production action, save, API, or DB write occurs.
  if (showEditorPreview) {
    return (
      <div className="min-h-screen bg-[#080d1a]">
        <div className="max-w-3xl mx-auto px-4 pt-4">
          <button
            type="button"
            onClick={() => setShowEditorPreview(false)}
            className="text-xs text-slate-300 border border-slate-700 hover:border-slate-500 px-3 min-h-[40px] rounded-lg transition-colors"
          >
            ← ウィザードに戻る（プレビューを閉じる）
          </button>
        </div>
        <WizardEstimatePreviewBridge input={wizardPreviewInput} />
      </div>
    );
  }

  return (
    <WizardShell
      title="見積ウィザード（Step1/2 プレビュー）"
      estimateNo="PREVIEW"
      step={step}
      jumpTo={setStep}
      onBack={() => setStep((s) => clamp(s - 1))}
      onNext={() => setStep((s) => clamp(s + 1))}
      isFirst={step === 1}
      isLast={step === 7}
      totals={MOCK_TOTALS}
    >
      {step === 1 && (
        <Step1Customer
          customerMode={customerMode}
          onSetCustomerMode={setCustomerMode}
          onOpenOcr={() => {}}
          customerId=""
          onSelectCustomer={() => {}}
          customers={[]}
          nc={nc}
          onChangeNc={(patch) => setNc((p) => ({ ...p, ...patch }))}
          onCreateCustomer={() => {}}
          creatingCustomer={false}
          lineBusinessConfigured={false}
        />
      )}
      {step === 2 && (
        <Step2Vehicle
          vehicleMode={vehicleMode}
          onSetVehicleMode={setVehicleMode}
          onOpenOcr={() => {}}
          vehicleId=""
          onSelectVehicle={() => {}}
          vehicles={[]}
          nv={nv}
          onChangeNv={(patch) => setNv((p) => ({ ...p, ...patch }))}
          sizeKey={sizeKey}
          onSelectSize={setSizeKey}
          sizeKeys={["SS", "S", "M", "ML", "L", "LL", "XL"]}
          sizeEstimate={sizeEstimate}
          onEstimateSize={() => setSizeEstimate({ sizeKey: "L", basis: "プレビュー（3M推定の例）" } as BodySizeEstimate)}
        />
      )}
      {step === 3 && (
        <Step3Category
          selected={categories}
          onToggle={(id) =>
            setCategories((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]))
          }
        />
      )}
      {step === 4 && (
        <div className="flex flex-col gap-3">
          {/* Preview-only cross-service scenario presets (Phase 4I validation aid). */}
          <div className="bg-[#1e293b] rounded-xl shadow-lg p-3 flex flex-wrap items-center gap-2">
            <span className="text-[11px] text-slate-500">シナリオ（プレビュー）:</span>
            {PREVIEW_SCENARIOS.map((s) => (
              <button
                key={s.label}
                type="button"
                onClick={() => setCategories(s.ids)}
                className={cnBtn(categories.length === s.ids.length && s.ids.every((id) => categories.includes(id)))}
              >
                {s.label}
              </button>
            ))}
          </div>

          {/* Preview-only shop-rank switch (in production this comes from dealer settings). */}
          <div className="bg-[#1e293b] rounded-xl shadow-lg p-3 flex flex-wrap items-center gap-2">
            <span className="text-[11px] text-slate-500">ショップランク（プレビュー切替）:</span>
            {(["shop", "detailer", "certified", "ppf_installer"] as ShopRank[]).map((r) => (
              <button
                key={r}
                type="button"
                onClick={() => { setShopRank(r); setLayer1(null); setLayer2(null); setLayer3(null); }}
                className={cnBtn(shopRank === r)}
              >
                {r}
              </button>
            ))}
          </div>

          <Step4Estimate
            selectedCategories={categories}
            activeSection={resolvedActive}
            onSelectSection={setActiveSection}
            adjustmentNotice={
              showAdjustment
                ? "コーティング + PPF 併用による店舗設定ベースの価格調整メッセージがここに表示されます（例）。実際の減額計算・価格変更は行いません。"
                : undefined
            }
            globalOptionsSlot={
              <StoreGlobalOptionsSelector
                globalOptions={EXAMPLE_STORE_GLOBAL_OPTIONS}
                selectedCategoryIds={categories}
                selectedGlobalOptionIds={globalOpts}
                unitPricesByOption={globalOptPrices}
                quantitiesByOption={globalOptQty}
                onGlobalOptionToggle={(id) =>
                  setGlobalOpts((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]))
                }
                onUnitPriceChange={(id, v) => setGlobalOptPrices((p) => ({ ...p, [id]: v }))}
                onQuantityChange={(id, qty) => setGlobalOptQty((p) => ({ ...p, [id]: qty }))}
                informationalMessage={null}
                onAddOrUpdate={() => {}}
              />
            }
          >
            {resolvedActive === "coating" ? (
              <CoatingSelector
                shopRank={shopRank}
                coatingLocked={!isCoatingAvailableForRank(shopRank)}
                lockReason="GYEON PPFインストーラーはコーティングを施工できません。"
                selectedLayerCount={layerCount}
                selectedLayer1ProductId={layer1}
                selectedLayer2ProductId={layer2}
                selectedLayer3ProductId={layer3}
                availableLayer1Products={firstLayerOptions(shopRank)}
                availableLayer2Products={secondLayerOptions(layer1)}
                availableLayer3Products={thirdLayerOptions(layer1)}
                onLayerCountChange={setLayerCount}
                onLayer1Change={(id) => { setLayer1(id); setLayer2(null); setLayer3(null); }}
                onLayer2Change={setLayer2}
                onLayer3Change={setLayer3}
                onAddOrUpdate={() => {}}
              />
            ) : resolvedActive === "ppf" ? (
              <PpfSelector
                shopRank={shopRank}
                ppfLocked={shopRank === "shop"}
                lockReason="GYEONショップランクでは PPF は施工できません。"
                selectedInstallationMethod={ppfMethod}
                installationMethods={DEFAULT_PPF_METHODS}
                onInstallationMethodChange={(id) => { setPpfMethod(id); }}
                selectedPartialPartIds={ppfParts}
                partialParts={DEFAULT_PPF_PARTS}
                quantitiesByPart={ppfQty}
                onPartialPartToggle={(id) =>
                  setPpfParts((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]))
                }
                onQuantityChange={(id, qty) => setPpfQty((p) => ({ ...p, [id]: qty }))}
                selectedPpfTypeId={ppfType}
                ppfTypes={DEFAULT_PPF_TYPE_GROUPS}
                onPpfTypeChange={setPpfType}
                interiorRows={interiorRows}
                onInteriorRowAdd={() => { setInteriorRows((r) => [...r, { id: `row-${rowSeq}`, location: "", amount: "" }]); setRowSeq((n) => n + 1); }}
                onInteriorRowUpdate={(id, patch) => setInteriorRows((r) => r.map((x) => (x.id === id ? { ...x, ...patch } : x)))}
                onInteriorRowDelete={(id) => setInteriorRows((r) => r.filter((x) => x.id !== id))}
                displayedUnitPrice={ppfType ? 180000 : null}
                editableUnitPrice={ppfUnitPrice}
                onUnitPriceChange={setPpfUnitPrice}
                coefficientDisplay={ppfType ? "×1.00（例・表示のみ）" : null}
                combinedServiceAdjustment={null}
                onAddOrUpdate={() => {}}
              />
            ) : resolvedActive === "window" ? (
              <WindowFilmSelector
                shopRank={shopRank}
                windowLocked={shopRank === "shop"}
                lockReason="GYEONショップランクではウィンドウフィルムは選択できません。"
                areas={DEFAULT_WINDOW_AREAS}
                selectedAreaIds={windowAreas}
                onAreaToggle={(id) =>
                  setWindowAreas((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]))
                }
                filmTypes={EXAMPLE_FILM_TYPES}
                selectedFilmTypeId={windowFilm}
                onFilmTypeChange={setWindowFilm}
                displayedUnitPrice={windowFilm ? (EXAMPLE_FILM_TYPES.find((f) => f.id === windowFilm)?.defaultUnitPrice ?? null) : null}
                editableUnitPrice={windowUnitPrice}
                onUnitPriceChange={setWindowUnitPrice}
                onAddOrUpdate={() => {}}
              />
            ) : resolvedActive === "maintenance" ? (
              <BodyMaintenanceSelector
                maintenanceMenus={EXAMPLE_MAINTENANCE_MENUS}
                selectedMaintenanceMenuId={maintMenu}
                onMaintenanceMenuChange={setMaintMenu}
                displayedUnitPrice={maintMenu ? (EXAMPLE_MAINTENANCE_MENUS.find((m) => m.id === maintMenu)?.defaultPrice ?? null) : null}
                editablePriceAllowed
                editableUnitPrice={maintUnitPrice}
                onUnitPriceChange={setMaintUnitPrice}
                informationalMessage={null}
                onAddOrUpdate={() => {}}
              />
            ) : resolvedActive === "carwash" ? (
              <CarWashSelector
                washMenus={EXAMPLE_WASH_MENUS}
                selectedWashMenuId={washMenu}
                onWashMenuChange={setWashMenu}
                displayedUnitPrice={washMenu ? (EXAMPLE_WASH_MENUS.find((m) => m.id === washMenu)?.defaultPrice ?? null) : null}
                editablePriceAllowed
                editableUnitPrice={washUnitPrice}
                onUnitPriceChange={setWashUnitPrice}
                informationalMessage={null}
                onAddOrUpdate={() => {}}
              />
            ) : resolvedActive === "roomclean" ? (
              <RoomCleaningSelector
                roomMenus={EXAMPLE_ROOM_MENUS}
                selectedRoomMenuIds={roomMenus}
                onRoomMenuToggle={(id) =>
                  setRoomMenus((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]))
                }
                editablePriceAllowed
                editableUnitPrices={roomUnitPrices}
                onUnitPriceChange={(id, v) => setRoomUnitPrices((p) => ({ ...p, [id]: v }))}
                informationalMessage={null}
                onAddOrUpdate={() => {}}
              />
            ) : resolvedActive === "other" ? (
              <OtherWorkSelector
                presetOtherWorkItems={EXAMPLE_OTHER_WORK_PRESETS}
                selectedPresetItemIds={owPresets}
                onPresetItemToggle={(id) =>
                  setOwPresets((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]))
                }
                unitPricesByItem={owPrices}
                onUnitPriceChange={(id, v) => setOwPrices((p) => ({ ...p, [id]: v }))}
                quantitiesByItem={owQty}
                onQuantityChange={(id, qty) => setOwQty((p) => ({ ...p, [id]: qty }))}
                customRows={owRows}
                onCustomRowAdd={() => { setOwRows((r) => [...r, { id: `ow-${owRowSeq}`, name: "", description: "", unitPrice: "", quantity: "", unitLabel: "" }]); setOwRowSeq((n) => n + 1); }}
                onCustomRowUpdate={(id, patch) => setOwRows((r) => r.map((x) => (x.id === id ? { ...x, ...patch } : x)))}
                onCustomRowDelete={(id) => setOwRows((r) => r.filter((x) => x.id !== id))}
                informationalMessage={null}
                onAddOrUpdate={() => {}}
              />
            ) : (
              <div className="bg-[#1e293b] rounded-xl shadow-lg p-5">
                <p className="text-xs text-slate-400">
                  「{resolvedActive || "（未選択）"}」セクションは後続フェーズで実装します。追加サービスオプションは全カテゴリ共通で下部に表示されます。
                </p>
              </div>
            )}
          </Step4Estimate>
        </div>
      )}
      {step === 5 && (
        <Step5Discount
          subtotal={PREVIEW_SUBTOTAL}
          activeDiscountMode={discountMode}
          discountAmountValue={discountAmount}
          discountPercentValue={discountPercent}
          convertedDiscountAmount={convertedDiscountAmount}
          maximumDiscountAmount={100000}
          minimumDiscountPercent={0}
          maximumDiscountPercent={30}
          availableCoupons={EXAMPLE_COUPONS}
          selectedCouponIds={selectedCoupons}
          disabledCouponIds={disabledCouponIds}
          disabledReasonByCoupon={{}}
          informationalMessages={discountCouponMessages}
          discountValidationMessage={null}
          onDiscountModeChange={(m) => setDiscountMode(m)}
          onDiscountAmountChange={setDiscountAmount}
          onDiscountPercentChange={setDiscountPercent}
          onDiscountClear={() => { setDiscountAmount(""); setDiscountPercent(""); }}
          onCouponToggle={(id) =>
            setSelectedCoupons((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]))
          }
          onContinue={() => setStep((s) => clamp(s + 1))}
        />
      )}
      {step === 6 && (
        <Step6Notes
          customerNotes={notes.customerNotes}
          internalMemo={notes.internalMemo}
          onCustomerNotesChange={(v) => setNotes((p) => ({ ...p, customerNotes: v }))}
          onInternalMemoChange={(v) => setNotes((p) => ({ ...p, internalMemo: v }))}
          onBack={() => setStep((s) => clamp(s - 1))}
          onContinue={() => setStep((s) => clamp(s + 1))}
        />
      )}
      {step === 7 && (
        <div className="mb-3">
          <button
            type="button"
            onClick={() => setShowEditorPreview(true)}
            className="text-xs text-blue-300 border border-blue-500/30 bg-blue-500/5 hover:bg-blue-500/10 px-3 min-h-[40px] rounded-lg transition-colors"
          >
            EstimateEditor 読み取りプレビューを開く（Phase 8 ブリッジ）
          </button>
        </div>
      )}
      {step === 7 && (
        <Step7Review
          customerName={customerName}
          vehicleName={vehicleName}
          categoryCount={categories.length}
          customerFields={customerFields}
          vehicleFields={vehicleFields}
          serviceLines={serviceLines}
          discountFields={discountFields}
          couponSummaries={couponSummaries}
          customerNotes={notes.customerNotes}
          internalMemo={notes.internalMemo}
          priceSummary={priceSummary}
          previewConfirmed={previewConfirmed}
          onPreviewConfirm={handlePreviewConfirm}
          onEditCustomer={() => setStep(1)}
          onEditVehicle={() => setStep(2)}
          onEditServices={() => setStep(categories.length ? 4 : 3)}
          onEditDiscount={() => setStep(5)}
          onEditNotes={() => setStep(6)}
          onBack={() => setStep(6)}
        />
      )}
    </WizardShell>
  );
}
