// Estimate Wizard Ver2.2 — Canonical draft → preview mapper (Phase 9).
//
// Translates the canonical EstimateWizardDraftV22 into the neutral EstimateEditorPreviewData
// shape (ids → labels; empty values become 未入力/未選択/なし). DETERMINISTIC and side-effect free:
// no production price/tax/discount/coupon calculation, no save, no API/DB/OCR/PDF/LINE. Unknown
// ids fall back to the raw id (never crash). A small PreviewContext carries non-draft preview
// context only — the dealer shop rank (needed to resolve coating layer labels), a mock preview
// subtotal, and an owner-supplied mock %→yen conversion — NOT wizard screen state. Depends on the
// wizard layer (canonical draft + config); EstimateEditor never imports this module.

import { formatYen } from "../foundation/tokens";
import { serviceCategoryLabel, SERVICE_CATEGORY_IDS } from "@/lib/estimates/service-categories";
import { firstLayerOptions, secondLayerOptions, thirdLayerOptions } from "../screens/coating-matrix";
import { DEFAULT_PPF_METHODS, DEFAULT_PPF_PARTS, DEFAULT_PPF_TYPE_GROUPS } from "../screens/ppf-config";
import { DEFAULT_WINDOW_AREAS, EXAMPLE_FILM_TYPES } from "../screens/window-film-config";
import { EXAMPLE_MAINTENANCE_MENUS } from "../screens/body-maintenance-config";
import { EXAMPLE_WASH_MENUS } from "../screens/car-wash-config";
import { EXAMPLE_ROOM_MENUS } from "../screens/room-cleaning-config";
import { EXAMPLE_OTHER_WORK_PRESETS } from "../screens/other-work-config";
import { EXAMPLE_STORE_GLOBAL_OPTIONS } from "../screens/store-global-options-config";
import { EXAMPLE_COUPONS } from "../screens/discount-coupon-config";
import type { ShopRank } from "../screens/step-types";
import type { EstimateWizardDraftV22 } from "../draft/wizard-draft-types";
import type { EstimateEditorPreviewData, PreviewField, PreviewServiceLine, PreviewPriceSummary } from "./previewTypes";

/** Non-draft preview context. NOT wizard screen state — the dealer rank (for coating label
 *  resolution) plus the OWNER-SUPPLIED read-only price summary (built from the production pricing
 *  engine result). The mapper never calculates prices. */
export interface PreviewContext {
  shopRank:     ShopRank;
  priceSummary: PreviewPriceSummary;
}

export function mapWizardDraftToPreview(draft: EstimateWizardDraftV22, ctx: PreviewContext): EstimateEditorPreviewData {
  const yen = (v: string) => formatYen(Number(v) || 0);
  const c = draft.customer;
  const v = draft.vehicle;
  const nc = c.newCustomer;
  const nv = v.newVehicle;
  const cfg = draft.serviceConfiguration;

  const customerName = c.sourceMode === "existing" ? "既存のお客様" : (nc.name || "未入力");
  const vehicleName =
    v.sourceMode === "existing" ? "既存の車両" : ([nv.maker, nv.model].filter(Boolean).join(" ") || "未入力");

  const customerFields: PreviewField[] =
    c.sourceMode === "existing"
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

  const vehicleFields: PreviewField[] =
    v.sourceMode === "existing"
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
          { label: "ボディサイズ(3M)", value: v.bodySizeKey || "未選択" },
        ];

  const ordered = SERVICE_CATEGORY_IDS.filter((id) => draft.serviceSelection.selectedCategories.includes(id));
  const serviceLines: PreviewServiceLine[] = [];
  for (const cat of ordered) {
    if (cat === "coating") {
      const co = cfg.coating;
      const l1 = firstLayerOptions(ctx.shopRank).find((o) => o.id === co.layer1Id)?.label;
      const l2 = secondLayerOptions(co.layer1Id).find((o) => o.id === co.layer2Id)?.label;
      const l3 = thirdLayerOptions(co.layer1Id).find((o) => o.id === co.layer3Id)?.label;
      const parts = [l1, l2, l3].filter(Boolean) as string[];
      serviceLines.push({
        category: serviceCategoryLabel("coating"),
        name: co.layerCount ? `${co.layerCount}層コーティング` : "未選択",
        detail: parts.length ? parts.join(" / ") : undefined,
      });
    } else if (cat === "ppf") {
      const p = cfg.ppf;
      const method = DEFAULT_PPF_METHODS.find((m) => m.id === p.installationMethod)?.label;
      const type = DEFAULT_PPF_TYPE_GROUPS.flatMap((g) => g.products).find((x) => x.id === p.ppfTypeId)?.label;
      const partLabels = p.selectedPartIds.map((id) => {
        const part = DEFAULT_PPF_PARTS.find((x) => x.id === id);
        const q = p.quantitiesByPart[id];
        return part ? `${part.label}${q ? `×${q}` : ""}` : id;
      });
      const details: string[] = [];
      if (type) details.push(`種別: ${type}`);
      if (partLabels.length) details.push(`部位: ${partLabels.join(", ")}`);
      const interior = p.interiorRows.filter((r) => r.location || r.amount);
      if (interior.length) details.push(`内装: ${interior.map((r) => `${r.location || "—"}${r.amount ? ` ${r.amount}` : ""}`).join(", ")}`);
      serviceLines.push({
        category: serviceCategoryLabel("ppf"),
        name: method ?? "未選択",
        detail: details.join(" / ") || undefined,
        amount: p.unitPriceInput ? yen(p.unitPriceInput) : undefined,
      });
    } else if (cat === "window") {
      const w = cfg.windowFilm;
      const areas = w.selectedAreaIds.map((id) => DEFAULT_WINDOW_AREAS.find((a) => a.id === id)?.label ?? id);
      const film = EXAMPLE_FILM_TYPES.find((f) => f.id === w.filmTypeId)?.label;
      const details: string[] = [];
      if (film) details.push(`フィルム: ${film}`);
      if (areas.length) details.push(`エリア: ${areas.join(", ")}`);
      serviceLines.push({
        category: serviceCategoryLabel("window"),
        name: film ?? "未選択",
        detail: details.join(" / ") || undefined,
        amount: w.unitPriceInput ? yen(w.unitPriceInput) : undefined,
      });
    } else if (cat === "maintenance") {
      const bm = cfg.bodyMaintenance;
      const m = EXAMPLE_MAINTENANCE_MENUS.find((x) => x.id === bm.menuId);
      serviceLines.push({
        category: serviceCategoryLabel("maintenance"),
        name: m?.name ?? "未選択",
        amount: bm.unitPriceInput ? yen(bm.unitPriceInput) : m ? formatYen(m.defaultPrice) : undefined,
      });
    } else if (cat === "carwash") {
      const cw = cfg.carWash;
      const m = EXAMPLE_WASH_MENUS.find((x) => x.id === cw.menuId);
      serviceLines.push({
        category: serviceCategoryLabel("carwash"),
        name: m?.name ?? "未選択",
        amount: cw.unitPriceInput ? yen(cw.unitPriceInput) : m ? formatYen(m.defaultPrice) : undefined,
      });
    } else if (cat === "roomclean") {
      const menus = cfg.roomCleaning.selectedMenuIds.map((id) => EXAMPLE_ROOM_MENUS.find((x) => x.id === id)?.name ?? id);
      serviceLines.push({
        category: serviceCategoryLabel("roomclean"),
        name: menus.length ? `${menus.length} メニュー` : "未選択",
        detail: menus.length ? menus.join(", ") : undefined,
      });
    } else if (cat === "other") {
      const ow = cfg.otherWork;
      const presets = ow.selectedPresetIds.map((id) => EXAMPLE_OTHER_WORK_PRESETS.find((x) => x.id === id)?.name ?? id);
      const customs = ow.customRows.filter((r) => r.name.trim()).map((r) => r.name);
      const names = [...presets, ...customs];
      serviceLines.push({
        category: serviceCategoryLabel("other"),
        name: names.length ? `${names.length} 件` : "未選択",
        detail: names.length ? names.join(", ") : undefined,
      });
    }
  }
  const goptNames = cfg.storeGlobalOptions.selectedOptionIds.map((id) => EXAMPLE_STORE_GLOBAL_OPTIONS.find((o) => o.id === id)?.name ?? id);
  if (goptNames.length) {
    serviceLines.push({ category: "追加サービスオプション", name: `${goptNames.length} 件`, detail: goptNames.join(", ") });
  }

  const dc = draft.discountAndCoupon;
  const discountModeLabel = dc.mode === "amount" ? "金額値引き" : dc.mode === "percent" ? "％値引き" : "値引きなし";
  const discountFields: PreviewField[] = [
    { label: "値引きモード", value: discountModeLabel },
    // Only the ACTIVE mode presents a value; `none` presents no active amount/percentage.
    ...(dc.mode === "amount"
      ? [{ label: "値引き額", value: dc.amountInput ? yen(dc.amountInput) : "なし" }]
      : dc.mode === "percent"
      ? [{ label: "値引き率", value: dc.percentInput ? `${dc.percentInput}%（本エンジン未対応）` : "なし" }]
      : []),
  ];
  const couponSummaries = dc.selectedCouponIds.map((id) => {
    const cp = EXAMPLE_COUPONS.find((x) => x.id === id);
    if (!cp) return id;
    const val = cp.discountType === "percent" ? `${cp.discountValue}%` : formatYen(cp.discountValue);
    return `${cp.name}（${val}）`;
  });

  return {
    mode: "wizard-preview",
    customerName,
    vehicleName,
    categoryCount: draft.serviceSelection.selectedCategories.length,
    customerFields,
    vehicleFields,
    serviceLines,
    discountFields,
    couponSummaries,
    customerNotes: draft.notes.customerNotes,
    internalMemo: draft.notes.internalMemo,
    priceSummary: ctx.priceSummary,
  };
}
