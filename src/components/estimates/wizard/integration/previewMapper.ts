// Estimate Wizard Ver2.2 — Wizard → preview mapper (Phase 8).
//
// Translates raw Wizard preview state into the neutral EstimateEditorPreviewData shape (ids →
// labels resolved here; empty values become 未入力/未選択/なし). This is the ONLY place the
// aggregation lives. It is READ-ONLY: no calculation of production prices/tax/discounts, no save,
// no API/DB/OCR/PDF/LINE. The `previewSubtotal` is a mock preview value the caller supplies —
// never a computed total. Depends on the wizard layer (types + config); EstimateEditor never
// imports this module.

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
import type {
  NewCustomerDraft, NewVehicleDraft, CustomerMode, VehicleMode,
  ShopRank, LayerCount, PpfInstallationMethodId, InteriorPpfRow, OtherWorkCustomRow, DiscountMode,
} from "../screens/step-types";
import type { EstimateEditorPreviewData, PreviewField, PreviewServiceLine } from "./previewTypes";

/** Raw wizard preview state consumed by the adapter (owner-held; the single state owner remains
 *  the wizard host — this is just a snapshot passed downward). */
export interface WizardPreviewInput {
  customerMode: CustomerMode;
  nc:           NewCustomerDraft;
  vehicleMode:  VehicleMode;
  nv:           NewVehicleDraft;
  sizeKey:      string;
  categories:   string[];
  shopRank:     ShopRank;
  // coating
  layerCount:   LayerCount | null;
  layer1:       string | null;
  layer2:       string | null;
  layer3:       string | null;
  // ppf
  ppfMethod:    PpfInstallationMethodId | null;
  ppfParts:     string[];
  ppfQty:       Record<string, number>;
  ppfType:      string | null;
  ppfUnitPrice: string;
  interiorRows: InteriorPpfRow[];
  // window
  windowAreas:     string[];
  windowFilm:      string | null;
  windowUnitPrice: string;
  // maintenance / car wash
  maintMenu:      string | null;
  maintUnitPrice: string;
  washMenu:       string | null;
  washUnitPrice:  string;
  // room cleaning
  roomMenus:      string[];
  // other work
  owPresets:      string[];
  owRows:         OtherWorkCustomRow[];
  // store global options
  globalOpts:     string[];
  // discount / coupon
  discountMode:            DiscountMode;
  discountAmount:          string;
  discountPercent:         string;
  convertedDiscountAmount: number | null;
  selectedCoupons:         string[];
  // notes
  customerNotes: string;
  internalMemo:  string;
  // mock preview subtotal (never a computed production total)
  previewSubtotal: number;
}

export function mapWizardToPreview(input: WizardPreviewInput): EstimateEditorPreviewData {
  const yen = (v: string) => formatYen(Number(v) || 0);
  const { nc, nv, customerMode, vehicleMode } = input;

  const customerName = customerMode === "select" ? "既存のお客様" : (nc.name || "未入力");
  const vehicleName =
    vehicleMode === "select" ? "既存の車両" : ([nv.maker, nv.model].filter(Boolean).join(" ") || "未入力");

  const customerFields: PreviewField[] =
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

  const vehicleFields: PreviewField[] =
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
          { label: "ボディサイズ(3M)", value: input.sizeKey || "未選択" },
        ];

  // Fixed logical category order (same canonical order as Screen 4).
  const ordered = SERVICE_CATEGORY_IDS.filter((id) => input.categories.includes(id));
  const serviceLines: PreviewServiceLine[] = [];
  for (const cat of ordered) {
    if (cat === "coating") {
      const l1 = firstLayerOptions(input.shopRank).find((o) => o.id === input.layer1)?.label;
      const l2 = secondLayerOptions(input.layer1).find((o) => o.id === input.layer2)?.label;
      const l3 = thirdLayerOptions(input.layer1).find((o) => o.id === input.layer3)?.label;
      const parts = [l1, l2, l3].filter(Boolean) as string[];
      serviceLines.push({
        category: serviceCategoryLabel("coating"),
        name: input.layerCount ? `${input.layerCount}層コーティング` : "未選択",
        detail: parts.length ? parts.join(" / ") : undefined,
      });
    } else if (cat === "ppf") {
      const method = DEFAULT_PPF_METHODS.find((m) => m.id === input.ppfMethod)?.label;
      const type = DEFAULT_PPF_TYPE_GROUPS.flatMap((g) => g.products).find((p) => p.id === input.ppfType)?.label;
      const partLabels = input.ppfParts.map((id) => {
        const p = DEFAULT_PPF_PARTS.find((x) => x.id === id);
        const q = input.ppfQty[id];
        return p ? `${p.label}${q ? `×${q}` : ""}` : id;
      });
      const details: string[] = [];
      if (type) details.push(`種別: ${type}`);
      if (partLabels.length) details.push(`部位: ${partLabels.join(", ")}`);
      const interior = input.interiorRows.filter((r) => r.location || r.amount);
      if (interior.length) details.push(`内装: ${interior.map((r) => `${r.location || "—"}${r.amount ? ` ${r.amount}` : ""}`).join(", ")}`);
      serviceLines.push({
        category: serviceCategoryLabel("ppf"),
        name: method ?? "未選択",
        detail: details.join(" / ") || undefined,
        amount: input.ppfUnitPrice ? yen(input.ppfUnitPrice) : undefined,
      });
    } else if (cat === "window") {
      const areas = input.windowAreas.map((id) => DEFAULT_WINDOW_AREAS.find((a) => a.id === id)?.label ?? id);
      const film = EXAMPLE_FILM_TYPES.find((f) => f.id === input.windowFilm)?.label;
      const details: string[] = [];
      if (film) details.push(`フィルム: ${film}`);
      if (areas.length) details.push(`エリア: ${areas.join(", ")}`);
      serviceLines.push({
        category: serviceCategoryLabel("window"),
        name: film ?? "未選択",
        detail: details.join(" / ") || undefined,
        amount: input.windowUnitPrice ? yen(input.windowUnitPrice) : undefined,
      });
    } else if (cat === "maintenance") {
      const m = EXAMPLE_MAINTENANCE_MENUS.find((x) => x.id === input.maintMenu);
      serviceLines.push({
        category: serviceCategoryLabel("maintenance"),
        name: m?.name ?? "未選択",
        amount: input.maintUnitPrice ? yen(input.maintUnitPrice) : m ? formatYen(m.defaultPrice) : undefined,
      });
    } else if (cat === "carwash") {
      const m = EXAMPLE_WASH_MENUS.find((x) => x.id === input.washMenu);
      serviceLines.push({
        category: serviceCategoryLabel("carwash"),
        name: m?.name ?? "未選択",
        amount: input.washUnitPrice ? yen(input.washUnitPrice) : m ? formatYen(m.defaultPrice) : undefined,
      });
    } else if (cat === "roomclean") {
      const menus = input.roomMenus.map((id) => EXAMPLE_ROOM_MENUS.find((x) => x.id === id)?.name ?? id);
      serviceLines.push({
        category: serviceCategoryLabel("roomclean"),
        name: menus.length ? `${menus.length} メニュー` : "未選択",
        detail: menus.length ? menus.join(", ") : undefined,
      });
    } else if (cat === "other") {
      const presets = input.owPresets.map((id) => EXAMPLE_OTHER_WORK_PRESETS.find((x) => x.id === id)?.name ?? id);
      const customs = input.owRows.filter((r) => r.name.trim()).map((r) => r.name);
      const names = [...presets, ...customs];
      serviceLines.push({
        category: serviceCategoryLabel("other"),
        name: names.length ? `${names.length} 件` : "未選択",
        detail: names.length ? names.join(", ") : undefined,
      });
    }
  }
  const goptNames = input.globalOpts.map((id) => EXAMPLE_STORE_GLOBAL_OPTIONS.find((o) => o.id === id)?.name ?? id);
  if (goptNames.length) {
    serviceLines.push({ category: "追加サービスオプション", name: `${goptNames.length} 件`, detail: goptNames.join(", ") });
  }

  const discountFields: PreviewField[] = [
    { label: "値引きモード", value: input.discountMode === "amount" ? "金額値引き" : "％値引き" },
    input.discountMode === "amount"
      ? { label: "値引き額", value: input.discountAmount ? yen(input.discountAmount) : "なし" }
      : { label: "値引き率", value: input.discountPercent ? `${input.discountPercent}%` : "なし" },
    ...(input.discountMode === "percent" && input.convertedDiscountAmount != null
      ? [{ label: "換算値引き額（プレビュー）", value: formatYen(input.convertedDiscountAmount) }]
      : []),
  ];
  const couponSummaries = input.selectedCoupons.map((id) => {
    const c = EXAMPLE_COUPONS.find((x) => x.id === id);
    if (!c) return id;
    const v = c.discountType === "percent" ? `${c.discountValue}%` : formatYen(c.discountValue);
    return `${c.name}（${v}）`;
  });

  return {
    mode: "wizard-preview",
    customerName,
    vehicleName,
    categoryCount: input.categories.length,
    customerFields,
    vehicleFields,
    serviceLines,
    discountFields,
    couponSummaries,
    customerNotes: input.customerNotes,
    internalMemo: input.internalMemo,
    priceSummary: {
      mockRows: [{ label: "小計（プレビュー基準額）", value: formatYen(input.previewSubtotal) }],
      note: "本計算（サービス小計・オプション・税・合計）はプレビューでは行いません。今後の統合時に親の既存ロジックが算出します。",
    },
  };
}
