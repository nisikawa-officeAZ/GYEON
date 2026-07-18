import { EstimateCategory } from "../estimates/estimate-types";
import { calculateEstimateTotals, lineTotal } from "./estimate-totals";
import { ESTIMATE_TAXONOMY_READY } from "@/lib/flags";
import {
  type PricingCatalog,
  DEFAULT_PRICING_CATALOG,
  bodySizeMultiplier,
} from "./pricing-catalog";

// Plan A (migration 093): write distinct line-item categories once the schema is
// live; otherwise keep the legacy mapping so inserts never violate the old CHECK.
const CAT_MAINTENANCE: EstimateCategory = ESTIMATE_TAXONOMY_READY ? "maintenance" : "other";
const CAT_CARWASH: EstimateCategory     = ESTIMATE_TAXONOMY_READY ? "carwash"     : "other";
const CAT_ROOMCLEAN: EstimateCategory   = ESTIMATE_TAXONOMY_READY ? "roomclean"   : "interior";

// ── Input types ───────────────────────────────────────────────────────────────

export interface CoatingInput {
  type:       "coating";
  coatingId:  string;
  sizeKey:    string;
  topcoat2?:  string;
  topcoat3?:  string;
  optionIds?: string[];
}

export interface MaintenanceInput { type: "maintenance"; menuIds: string[]; }
export interface CarwashInput     { type: "carwash";     menuIds: string[]; }

export interface RoomCleanInput {
  type:      "roomclean";
  partIds:   string[];
  condition: string;
}

export interface OtherInput {
  type:  "other";
  items: { name: string; price: number }[];
}

export interface PpfInput {
  type:         "ppf";
  planId?:      string;                          // "front-half" | "full-body"
  filmType?:    string;                          // "clear" | "matte" | "carbon" | "color"
  vehicleRank?: string;                          // "std" | "premium" | "upper" | "luxury"
  sizeKey?:     string;                          // "SS"|"S"|"M"|"ML"|"L"|"LL"|"XL"|"XXL"
  frontGlass?:  string;                          // "ppf" | "tpu"
  singleParts?: { id: string; qty: number }[];   // single parts with quantity
  // Sprint 5C fills planId/filmType/vehicleRank/sizeKey from wizard state.
  // Until then, omitted fields produce subtotal: 0 (safe fallback in calcPpf).
}

export interface WindowInput {
  type:    "window";
  partIds: string[];
  grade:   string;
}

export type ServiceInput =
  | CoatingInput | MaintenanceInput | CarwashInput
  | RoomCleanInput | OtherInput | PpfInput | WindowInput;

// ── Output types ──────────────────────────────────────────────────────────────

export interface PricedLineItem {
  category:              EstimateCategory;
  item_name:             string;
  quantity:              number;
  unit_price:            number;
  discount_rate:         number;
  sort_order:            number;
  item_type:             "manual";
  product_id:            null;
  sku:                   null;
  product_name_snapshot: null;
  retail_price_snapshot: null;
  // Stable authoritative catalog identity (EW-UI-5A1-B1). Non-null ONLY for catalog-priced lines that
  // currently project as Wizard catalog lines — i.e. COATING lines (see calcCoating). It is the
  // engine-owned persistence identity: never a label, index, or line order. Every other line
  // (manual, and the not-yet-projected maintenance/carwash/roomclean/PPF/window catalog lines)
  // stays null — B1 does NOT claim every catalog-backed engine line has an id.
  pricing_reference_id:  string | null;
}

export interface ServiceSubtotal {
  type:      ServiceInput["type"];
  lineItems: PricedLineItem[];
  subtotal:  number;
}

export interface DiscountInput {
  couponTotal: number;
  extraAmount: number;
  isDealer:    boolean;
  dealerRate:  number;
}

export interface EstimateResult {
  services:       ServiceSubtotal[];
  subtotal:       number;
  couponDiscount: number;
  extraDiscount:  number;
  dealerDiscount: number;
  taxableAmount:  number;
  taxAmount:      number;
  total:          number;
}

// PpfConfig — serialisable snapshot for future cutting-software / inventory /
// dealer-order integrations. Persisted alongside the estimate (column reserved).
export interface PpfConfig {
  planId:           string;
  planName:         string;
  filmType:         string;
  filmName:         string;
  vehicleRank:      string;
  rankName:         string;
  sizeKey:          string;
  frontGlass?:      string;
  frontGlassName?:  string;
  singleParts:      { id: string; name: string; qty: number; unitPrice: number }[];
  adjustedPlanPrice: number;
  subtotal:         number;
  // Reserved — populate when integrations are built:
  // product_sku?:        string;   // inventory link
  // cut_template_id?:    string;   // cutting software
  // dealer_order_ref?:   string;   // dealer orders
}

// ── Internal helpers ──────────────────────────────────────────────────────────

function mkItem(cat: EstimateCategory, name: string, price: number, sortOrder: number, qty = 1, pricingReferenceId: string | null = null): PricedLineItem {
  return {
    category: cat, item_name: name, quantity: qty, unit_price: price,
    discount_rate: 0, sort_order: sortOrder, item_type: "manual",
    product_id: null, sku: null, product_name_snapshot: null, retail_price_snapshot: null,
    pricing_reference_id: pricingReferenceId,
  };
}

// unit_price × quantity — all non-PPF items use qty=1 so behaviour is unchanged.
function sum(items: PricedLineItem[]): number {
  return items.reduce((s, i) => s + i.unit_price * i.quantity, 0);
}

// ── Service calculators (all price data via the injected catalog) ─────────────

function calcCoating(input: CoatingInput, offset: number, catalog: PricingCatalog): ServiceSubtotal {
  const items: PricedLineItem[] = [];
  let idx = offset;
  const multi = bodySizeMultiplier(catalog, input.sizeKey);
  const coat  = catalog.coatings.find(c => c.id === input.coatingId);
  // EW-UI-5A1-B1: each coating line carries its STABLE authoritative catalog id (never the label) —
  // base → coatingId, second → topcoat2, third → topcoat3, option → option id.
  if (coat) items.push(mkItem("coating", coat.name, Math.round(coat.base * multi), idx++, 1, input.coatingId));
  if (input.topcoat2) {
    const p = Math.round((catalog.topcoatBase[input.topcoat2] ?? 0) * multi);
    items.push(mkItem("coating", `トップコート: ${catalog.topcoatName[input.topcoat2] ?? input.topcoat2}`, p, idx++, 1, input.topcoat2));
  }
  if (input.topcoat3) {
    const p = Math.round((catalog.topcoatBase[input.topcoat3] ?? 0) * multi);
    items.push(mkItem("coating", `トップコート(3層): ${catalog.topcoatName[input.topcoat3] ?? input.topcoat3}`, p, idx++, 1, input.topcoat3));
  }
  (input.optionIds ?? []).forEach(id => {
    const opt = catalog.coatingOptions.find(o => o.id === id);
    if (opt) items.push(mkItem(opt.cat, opt.name, opt.price, idx++, 1, opt.id));
  });
  return { type: "coating", lineItems: items, subtotal: sum(items) };
}

function calcMaintenance(input: MaintenanceInput, offset: number, catalog: PricingCatalog): ServiceSubtotal {
  const items: PricedLineItem[] = [];
  let idx = offset;
  input.menuIds.forEach(id => {
    const m = catalog.maintenanceMenus.find(x => x.id === id);
    if (m) items.push(mkItem(CAT_MAINTENANCE, m.name, m.price, idx++));
  });
  return { type: "maintenance", lineItems: items, subtotal: sum(items) };
}

function calcCarwash(input: CarwashInput, offset: number, catalog: PricingCatalog): ServiceSubtotal {
  const items: PricedLineItem[] = [];
  let idx = offset;
  input.menuIds.forEach(id => {
    const m = catalog.carwashMenus.find(x => x.id === id);
    if (m) items.push(mkItem(CAT_CARWASH, m.name, m.price, idx++));
  });
  return { type: "carwash", lineItems: items, subtotal: sum(items) };
}

function calcRoomClean(input: RoomCleanInput, offset: number, catalog: PricingCatalog): ServiceSubtotal {
  const items: PricedLineItem[] = [];
  let idx = offset;
  const cond  = catalog.roomCleanConditions.find(c => c.id === input.condition);
  const coeff = cond?.coeff ?? 1.0;
  input.partIds.forEach(id => {
    const p = catalog.roomCleanParts.find(x => x.id === id);
    if (p) {
      const price = Math.round(p.basePrice * coeff);
      const label = cond && cond.id !== "normal" ? `${p.name}（${cond.label}）` : p.name;
      items.push(mkItem(CAT_ROOMCLEAN, label, price, idx++));
    }
  });
  return { type: "roomclean", lineItems: items, subtotal: sum(items) };
}

function calcOther(input: OtherInput, offset: number): ServiceSubtotal {
  const items = input.items.map((item, i) => mkItem("other", item.name, item.price, offset + i));
  return { type: "other", lineItems: items, subtotal: sum(items) };
}

function calcPpf(input: PpfInput, offset: number, catalog: PricingCatalog): ServiceSubtotal {
  const planId    = input.planId    ?? "";
  const sizeKey   = input.sizeKey   ?? "";
  const filmType  = input.filmType  ?? "clear";
  const rankType  = input.vehicleRank ?? "std";

  const planPrices    = catalog.ppfPlanPrices[planId];
  const basePlanPrice = planPrices?.[sizeKey] ?? 0;
  if (basePlanPrice === 0) return { type: "ppf", lineItems: [], subtotal: 0 };

  const items: PricedLineItem[] = [];
  let idx = offset;

  const film = catalog.ppfFilmTypes.find(f => f.id === filmType);
  const rank = catalog.ppfVehicleRanks.find(r => r.id === rankType);
  const plan = catalog.ppfPlans.find(p => p.id === planId);

  const filmCoeff = film?.coeff ?? 1.0;
  const rankCoeff = rank?.coeff ?? 1.0;
  const planLabel = `PPF ${plan?.name ?? planId}（${film?.name ?? filmType} × ${rank?.name ?? rankType}）`;

  items.push(mkItem("ppf", planLabel, Math.round(basePlanPrice * filmCoeff * rankCoeff), idx++));

  if (input.frontGlass) {
    const fg = catalog.ppfFrontGlass.find(g => g.id === input.frontGlass);
    if (fg) items.push(mkItem("ppf", fg.name, fg.price, idx++));
  }

  (input.singleParts ?? []).forEach(sp => {
    if (sp.qty <= 0) return;
    const part = catalog.ppfSingleParts.find(p => p.id === sp.id);
    if (part) {
      const qty = Math.min(sp.qty, part.maxQty);
      items.push(mkItem("ppf", part.name, part.price, idx++, qty));
    }
  });

  return { type: "ppf", lineItems: items, subtotal: sum(items) };
}

function calcWindow(input: WindowInput, offset: number, catalog: PricingCatalog): ServiceSubtotal {
  const items: PricedLineItem[] = [];
  let idx = offset;
  const grade = catalog.windowGrades.find(g => g.id === input.grade);
  const coeff = grade?.coeff ?? 1.0;
  input.partIds.forEach(id => {
    const part = catalog.windowParts.find(p => p.id === id);
    if (part) {
      const price = Math.round(part.basePrice * coeff);
      const label = grade && grade.id !== "standard"
        ? `${part.name}（${grade.name}）`
        : part.name;
      items.push(mkItem("window", label, price, idx++));
    }
  });
  return { type: "window", lineItems: items, subtotal: sum(items) };
}

// ── Public API (catalog defaults to DEFAULT_PRICING_CATALOG → identical) ───────

export function calculateService(
  input: ServiceInput,
  sortOffset = 0,
  catalog: PricingCatalog = DEFAULT_PRICING_CATALOG,
): ServiceSubtotal {
  switch (input.type) {
    case "coating":     return calcCoating(input, sortOffset, catalog);
    case "maintenance": return calcMaintenance(input, sortOffset, catalog);
    case "carwash":     return calcCarwash(input, sortOffset, catalog);
    case "roomclean":   return calcRoomClean(input, sortOffset, catalog);
    case "other":       return calcOther(input, sortOffset);
    case "ppf":         return calcPpf(input, sortOffset, catalog);
    case "window":      return calcWindow(input, sortOffset, catalog);
  }
}

export function calculateEstimate(
  services:  ServiceInput[],
  discounts: DiscountInput,
  taxRate:   number,
  catalog:   PricingCatalog = DEFAULT_PRICING_CATALOG,
): EstimateResult {
  let offset = 0;
  const calculated = services.map(s => {
    const r = calculateService(s, offset, catalog);
    offset += r.lineItems.length;
    return r;
  });

  const couponDiscount = discounts.couponTotal;
  const extraDiscount  = discounts.extraAmount;

  // Calculation integrity (Estimate Completion Sprint 3): the FINAL totals are derived
  // from the SAME authoritative function the server uses on persist
  // (calculateEstimateTotals), so the UI, the saved estimate, and the PDF always agree —
  // including discount clamping (the combined discount is clamped to [0, subtotal], so a
  // total can never go negative as it previously could here).
  const allItems = calculated.flatMap(r => r.lineItems);
  const subtotal = allItems.reduce(
    (s, i) => s + lineTotal(i.quantity, i.unit_price, i.discount_rate),
    0,
  );
  const dealerDiscount = discounts.isDealer
    ? Math.round(subtotal * (1 - discounts.dealerRate / 100))
    : 0;
  const combinedDiscount = couponDiscount + extraDiscount + dealerDiscount;

  const authoritative = calculateEstimateTotals(allItems, combinedDiscount, taxRate);
  const taxableAmount  = authoritative.subtotal - authoritative.discount_amount;

  return {
    services:       calculated,
    subtotal:       authoritative.subtotal,
    couponDiscount,
    extraDiscount,
    dealerDiscount,
    taxableAmount,
    taxAmount:      authoritative.tax_amount,
    total:          authoritative.total,
  };
}

export function buildPpfConfig(
  input: PpfInput,
  result: ServiceSubtotal,
  catalog: PricingCatalog = DEFAULT_PRICING_CATALOG,
): PpfConfig {
  const film = catalog.ppfFilmTypes.find(f => f.id === input.filmType);
  const rank = catalog.ppfVehicleRanks.find(r => r.id === input.vehicleRank);
  const plan = catalog.ppfPlans.find(p => p.id === input.planId);
  const fg   = input.frontGlass ? catalog.ppfFrontGlass.find(g => g.id === input.frontGlass) : undefined;
  return {
    planId:           input.planId      ?? "",
    planName:         plan?.name        ?? (input.planId ?? ""),
    filmType:         input.filmType    ?? "clear",
    filmName:         film?.name        ?? (input.filmType ?? "clear"),
    vehicleRank:      input.vehicleRank ?? "std",
    rankName:         rank?.name        ?? (input.vehicleRank ?? "std"),
    sizeKey:          input.sizeKey     ?? "",
    frontGlass:       input.frontGlass,
    frontGlassName:   fg?.name,
    singleParts:      (input.singleParts ?? []).map(sp => {
      const part = catalog.ppfSingleParts.find(p => p.id === sp.id);
      return { id: sp.id, name: part?.name ?? sp.id, qty: sp.qty, unitPrice: part?.price ?? 0 };
    }),
    adjustedPlanPrice: result.lineItems[0]?.unit_price ?? 0,
    subtotal:         result.subtotal,
  };
}

export function buildLineItems(
  services: ServiceInput[],
  catalog: PricingCatalog = DEFAULT_PRICING_CATALOG,
): PricedLineItem[] {
  let offset = 0;
  const items: PricedLineItem[] = [];
  services.forEach(s => {
    const r = calculateService(s, offset, catalog);
    items.push(...r.lineItems);
    offset += r.lineItems.length;
  });
  return items;
}
