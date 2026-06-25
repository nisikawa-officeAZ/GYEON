import { EstimateCategory } from "../estimates/estimate-types";
import {
  BODY_SIZES, COATINGS, TOPCOAT_BASE, TOPCOAT_NAME, COATING_OPTIONS,
  MAINTENANCE_MENUS, CARWASH_MENUS, ROOM_CLEAN_PARTS, ROOM_CLEAN_CONDITIONS,
  WINDOW_FILM_PARTS, WINDOW_FILM_GRADES,
} from "./pricing-data";

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

export interface PpfInput { type: "ppf"; }

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

// ── Internal helpers ──────────────────────────────────────────────────────────

function sizeMultiplier(sizeKey: string): number {
  return BODY_SIZES.find(s => s.key === sizeKey)?.multi ?? 1.0;
}

function mkItem(cat: EstimateCategory, name: string, price: number, sortOrder: number): PricedLineItem {
  return {
    category: cat, item_name: name, quantity: 1, unit_price: price,
    discount_rate: 0, sort_order: sortOrder, item_type: "manual",
    product_id: null, sku: null, product_name_snapshot: null, retail_price_snapshot: null,
  };
}

function sum(items: PricedLineItem[]): number {
  return items.reduce((s, i) => s + i.unit_price, 0);
}

// ── Service calculators ───────────────────────────────────────────────────────

function calcCoating(input: CoatingInput, offset: number): ServiceSubtotal {
  const items: PricedLineItem[] = [];
  let idx = offset;
  const multi = sizeMultiplier(input.sizeKey);
  const coat  = COATINGS.find(c => c.id === input.coatingId);
  if (coat) items.push(mkItem("coating", coat.name, Math.round(coat.base * multi), idx++));
  if (input.topcoat2) {
    const p = Math.round((TOPCOAT_BASE[input.topcoat2] ?? 0) * multi);
    items.push(mkItem("coating", `トップコート: ${TOPCOAT_NAME[input.topcoat2] ?? input.topcoat2}`, p, idx++));
  }
  if (input.topcoat3) {
    const p = Math.round((TOPCOAT_BASE[input.topcoat3] ?? 0) * multi);
    items.push(mkItem("coating", `トップコート(3層): ${TOPCOAT_NAME[input.topcoat3] ?? input.topcoat3}`, p, idx++));
  }
  (input.optionIds ?? []).forEach(id => {
    const opt = COATING_OPTIONS.find(o => o.id === id);
    if (opt) items.push(mkItem(opt.cat, opt.name, opt.price, idx++));
  });
  return { type: "coating", lineItems: items, subtotal: sum(items) };
}

function calcMaintenance(input: MaintenanceInput, offset: number): ServiceSubtotal {
  const items: PricedLineItem[] = [];
  let idx = offset;
  input.menuIds.forEach(id => {
    const m = MAINTENANCE_MENUS.find(x => x.id === id);
    if (m) items.push(mkItem("other", m.name, m.price, idx++));
  });
  return { type: "maintenance", lineItems: items, subtotal: sum(items) };
}

function calcCarwash(input: CarwashInput, offset: number): ServiceSubtotal {
  const items: PricedLineItem[] = [];
  let idx = offset;
  input.menuIds.forEach(id => {
    const m = CARWASH_MENUS.find(x => x.id === id);
    if (m) items.push(mkItem("other", m.name, m.price, idx++));
  });
  return { type: "carwash", lineItems: items, subtotal: sum(items) };
}

function calcRoomClean(input: RoomCleanInput, offset: number): ServiceSubtotal {
  const items: PricedLineItem[] = [];
  let idx = offset;
  const cond  = ROOM_CLEAN_CONDITIONS.find(c => c.id === input.condition);
  const coeff = cond?.coeff ?? 1.0;
  input.partIds.forEach(id => {
    const p = ROOM_CLEAN_PARTS.find(x => x.id === id);
    if (p) {
      const price = Math.round(p.basePrice * coeff);
      const label = cond && cond.id !== "normal" ? `${p.name}（${cond.label}）` : p.name;
      items.push(mkItem("interior", label, price, idx++));
    }
  });
  return { type: "roomclean", lineItems: items, subtotal: sum(items) };
}

function calcOther(input: OtherInput, offset: number): ServiceSubtotal {
  const items = input.items.map((item, i) => mkItem("other", item.name, item.price, offset + i));
  return { type: "other", lineItems: items, subtotal: sum(items) };
}

function calcWindow(input: WindowInput, offset: number): ServiceSubtotal {
  const items: PricedLineItem[] = [];
  let idx = offset;
  const grade = WINDOW_FILM_GRADES.find(g => g.id === input.grade);
  const coeff = grade?.coeff ?? 1.0;
  input.partIds.forEach(id => {
    const part = WINDOW_FILM_PARTS.find(p => p.id === id);
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

// ── Public API ────────────────────────────────────────────────────────────────

export function calculateService(input: ServiceInput, sortOffset = 0): ServiceSubtotal {
  switch (input.type) {
    case "coating":     return calcCoating(input, sortOffset);
    case "maintenance": return calcMaintenance(input, sortOffset);
    case "carwash":     return calcCarwash(input, sortOffset);
    case "roomclean":   return calcRoomClean(input, sortOffset);
    case "other":       return calcOther(input, sortOffset);
    case "ppf":         return { type: "ppf", lineItems: [], subtotal: 0 };
    case "window":      return calcWindow(input, sortOffset);
  }
}

export function calculateEstimate(
  services:  ServiceInput[],
  discounts: DiscountInput,
  taxRate:   number,
): EstimateResult {
  let offset = 0;
  const calculated = services.map(s => {
    const r = calculateService(s, offset);
    offset += r.lineItems.length;
    return r;
  });

  const subtotal       = calculated.reduce((s, r) => s + r.subtotal, 0);
  const couponDiscount = discounts.couponTotal;
  const extraDiscount  = discounts.extraAmount;
  const dealerDiscount = discounts.isDealer
    ? Math.round(subtotal * (1 - discounts.dealerRate / 100))
    : 0;
  const taxableAmount = subtotal - couponDiscount - extraDiscount - dealerDiscount;
  const taxAmount     = Math.floor(taxableAmount * taxRate / 100);
  const total         = taxableAmount + taxAmount;

  return { services: calculated, subtotal, couponDiscount, extraDiscount, dealerDiscount, taxableAmount, taxAmount, total };
}

export function buildLineItems(services: ServiceInput[]): PricedLineItem[] {
  let offset = 0;
  const items: PricedLineItem[] = [];
  services.forEach(s => {
    const r = calculateService(s, offset);
    items.push(...r.lineItems);
    offset += r.lineItems.length;
  });
  return items;
}
