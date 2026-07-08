"use client";

// Full-page Estimate Editor — Phase 2 + Phase 3 (CURRENT_TASK.md §10).
// Sections: customer / vehicle / services / items / discounts / notes / totals.
// Modes: "edit" (prefilled from getEstimate → updateEstimate) and
//        "create" (empty → createEstimate).
//
// Pricing is REUSED, never reimplemented: services build a ServiceInput[] exactly
// like EstimateWizard (L412-434) and generate line items via buildLineItems(); the
// discount + totals use calculateEstimateTotals — the same authoritative functions
// the server uses on persist (§11.2 Functional Parity). No pricing/OCR/PDF change.
//
// §11.1 Unsaved Changes Protection, §11.3 Customer/Vehicle Integrity (select existing
// only — inline creation is Phase 4), and §11.4 Catalog Loading Guard (save blocked
// until the dealer catalog resolves) are honored.

import { useState, useEffect, useRef, useTransition } from "react";
import { useRouter } from "next/navigation";
import { EstimateDB, estimateDisplayNo } from "@/lib/estimates/estimate-types";
import { CustomerDB, customerDisplayName } from "@/lib/customers/customer-types";
import { VehicleDB, vehicleDisplayName } from "@/lib/vehicles/vehicle-types";
import { updateEstimate } from "@/lib/estimates/update-estimate";
import { createEstimate } from "@/lib/estimates/create-estimate";
import { createVehicle } from "@/lib/vehicles/create-vehicle";
import { createCustomer } from "@/lib/customers/create-customer";
import { estimateBodySize, type BodySizeEstimate } from "@/lib/vehicles/body-size-estimate";
import { buildLineItems, type ServiceInput, type PricedLineItem } from "@/lib/pricing/pricing-engine";
import { calculateEstimateTotals, lineTotal } from "@/lib/pricing/estimate-totals";
import { DEFAULT_PRICING_CATALOG, type PricingCatalog } from "@/lib/pricing/pricing-catalog";
import { getDealerPricingCatalog } from "@/lib/pricing/get-dealer-pricing-catalog";
import dynamic from "next/dynamic";
import type { VehicleRegistrationOcrResult } from "@/lib/vehicle-registration/vehicle-registration-types";
import {
  CATEGORY_LABEL, PPF_QTY_REQUIRED, card, secHdr, lbl, inp, chip,
  DEFAULT_COUPONS, formatYen, useUnsavedChangesGuard, type EditorItem,
} from "./estimate-editor-helpers";

// G3 — reuse the existing OCR pipeline (loaded lazily) inside the editor. No OCR
// logic is duplicated or modified; the same components the onboarding flow uses.
const VehicleRegistrationUpload = dynamic(
  () => import("@/components/vehicle-registration/VehicleRegistrationUpload"),
  { ssr: false, loading: () => <div className="py-8 text-center text-xs text-slate-500">読み込み中...</div> },
);
const VehicleRegistrationOcrReview = dynamic(
  () => import("@/components/vehicle-registration/VehicleRegistrationOcrReview"),
  { ssr: false, loading: () => <div className="py-8 text-center text-xs text-slate-500">読み込み中...</div> },
);

interface EstimateEditorProps {
  mode:               "create" | "edit";
  estimate?:          EstimateDB;
  customers:          CustomerDB[];
  vehicles:           VehicleDB[];
  defaultCustomerId?: string;
  defaultVehicleId?:  string;
}

export default function EstimateEditor({ mode, estimate, customers, vehicles, defaultCustomerId, defaultVehicleId }: EstimateEditorProps) {
  const router = useRouter();
  const isEdit = mode === "edit";

  // ── Catalog (client-fetch; §11.4 guard) ────────────────────────────────────
  const [catalog, setCatalog] = useState<PricingCatalog>(DEFAULT_PRICING_CATALOG);
  const [catalogReady, setCatalogReady] = useState(false);
  useEffect(() => {
    let cancelled = false;
    getDealerPricingCatalog()
      .then((c) => { if (!cancelled) { setCatalog(c); setCatalogReady(true); } })
      .catch(() => { if (!cancelled) setCatalogReady(true); });
    return () => { cancelled = true; };
  }, []);

  // ── Customer / Vehicle / Notes ──────────────────────────────────────────────
  const initialCustomerId = estimate?.customer_id ?? defaultCustomerId ?? "";
  const initialVehicleId  = estimate?.vehicle_id ?? defaultVehicleId ?? "";
  const initialNotes      = estimate?.notes ?? "";
  const initialMemo       = estimate?.internal_memo ?? "";

  const [customerId,   setCustomerId]   = useState(initialCustomerId);
  const [vehicleId,    setVehicleId]    = useState(initialVehicleId);

  // G1 — inline customer creation (reuses the existing createCustomer action).
  const [customerMode,     setCustomerMode]     = useState<"select" | "new">("select");
  const [creatingCustomer, setCreatingCustomer] = useState(false);
  const [localCustomers,   setLocalCustomers]   = useState<CustomerDB[]>(customers);
  const [nc, setNc] = useState({
    name: "", phone: "", email: "", postal: "", address: "", lineId: "",
    isBusiness: false, tradeRate: "70", arAllowed: false, closingDay: "", paymentDay: "",
  });
  const [notes,        setNotes]        = useState(initialNotes);
  const [internalMemo, setInternalMemo] = useState(initialMemo);

  // ── Items (editable) ────────────────────────────────────────────────────────
  const keyRef = useRef(0);
  const nextKey = () => `k${keyRef.current++}`;
  const initialItems: EditorItem[] = (estimate?.estimate_items ?? []).map((it) => ({
    key:           it.id,
    category:      it.category,
    item_name:     it.item_name,
    description:   it.description ?? "",
    quantity:      it.quantity,
    unit_price:    it.unit_price,
    discount_rate: it.discount_rate,
  }));
  const [items, setItems] = useState<EditorItem[]>(initialItems);
  const initialItemsSig = useRef(JSON.stringify(initialItems.map((i) => ({ ...i, key: 0 }))));

  // ── Discounts ───────────────────────────────────────────────────────────────
  const [coupons,    setCoupons]    = useState<boolean[]>(DEFAULT_COUPONS.map(() => false));
  // Edit: preserve the saved flat discount by seeding it as the "extra" amount.
  const [extraDisc,  setExtraDisc]  = useState<string>(isEdit ? String(estimate?.discount_amount ?? 0) : "0");
  const [isDealer,   setIsDealer]   = useState(false);
  const [dealerRate, setDealerRate] = useState(70);
  const [taxRate]    = useState<number>(estimate?.tax_rate ?? 10);

  // ── Services selection (build ServiceInput[] like the wizard) ───────────────
  const sizeKeys = catalog.bodySizes.map((b) => b.key);
  const [sizeKey, setSizeKey] = useState<string>(estimate?.vehicles?.body_size ?? "M");
  // coating
  const [coatingId,   setCoatingId]   = useState("");
  const [topcoat2,    setTopcoat2]    = useState("");
  const [topcoat3,    setTopcoat3]    = useState("");
  const [coatingOpts, setCoatingOpts] = useState<string[]>([]);
  // ppf
  const [ppfPlan,       setPpfPlan]       = useState("");
  const [ppfFilm,       setPpfFilm]       = useState("clear");
  const [ppfRank,       setPpfRank]       = useState("std");
  const [ppfFrontGlass, setPpfFrontGlass] = useState("");
  // PPF partial work (部位別・プラン非依存). Per-part: selection, editable price
  // (temporary, estimate-only), and quantity (only for quantity-required parts).
  const [ppfPartSel,   setPpfPartSel]   = useState<Record<string, boolean>>({});
  const [ppfPartPrice, setPpfPartPrice] = useState<Record<string, string>>({});
  const [ppfPartQty,   setPpfPartQty]   = useState<Record<string, number>>({});
  // window
  const [windowParts, setWindowParts] = useState<string[]>([]);
  const [windowGrade, setWindowGrade] = useState("standard");
  // maintenance / carwash
  const [maintSel,   setMaintSel]   = useState<string[]>([]);
  const [carwashSel, setCarwashSel] = useState<string[]>([]);
  // roomclean
  const [roomSel,  setRoomSel]  = useState<string[]>([]);
  const [roomCond, setRoomCond] = useState("normal");
  // other
  const [otherName,  setOtherName]  = useState("");
  const [otherPrice, setOtherPrice] = useState("");

  const [error,   setError]        = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  // G3 — Vehicle Registration OCR (reuses the shared pipeline; no OCR logic here).
  const [ocrStage,   setOcrStage]   = useState<"closed" | "upload" | "review">("closed");
  const [pendingOcr, setPendingOcr] = useState<VehicleRegistrationOcrResult | null>(null);

  // G2 — editable Vehicle Information panel (select existing OR enter a new vehicle).
  // A new vehicle is persisted via the existing createVehicle action on save.
  const [vehMode, setVehMode] = useState<"select" | "new">("select");
  const [nv, setNv] = useState({
    maker: "", model: "", grade: "", vehicle_code: "", vin: "",
    first_registration_year_month: "", registration_date: "", inspection_expiry_date: "",
    displacement: "", color: "", plate_number: "",
  });
  const [sizeEstimate, setSizeEstimate] = useState<BodySizeEstimate | null>(null);

  const filteredVehicles = customerId ? vehicles.filter((v) => v.customer_id === customerId) : vehicles;

  const norm = (s: string | null | undefined) => (s ?? "").replace(/[\s　]/g, "");

  // Apply the reviewed OCR result: (1) append the extracted 車検証 info as a
  // reference block to 社内メモ (the existing editable field — mirrors the legacy
  // EstimateForm OCR); (2) best-effort select a MATCHING existing vehicle by VIN or
  // plate (no vehicle is created — that stays in the onboarding flow). Manual editing
  // is preserved throughout.
  function applyOcr(selected: Partial<VehicleRegistrationOcrResult>) {
    // OCR apply → populate the VISIBLE customer/vehicle form (not memo-only).
    // Vehicle: prefer an existing match (select it); otherwise switch to the
    // new-vehicle panel and fill it (incl. body color). Customer: prefer an
    // existing name match (select it); otherwise switch to the new-customer panel
    // and fill it. Manual edits are preserved (empty-only fill / overwrite confirm).

    // ── Vehicle ────────────────────────────────────────────────────────────────
    const plate = [
      selected.license_plate_region, selected.license_plate_class,
      selected.license_plate_kana, selected.license_plate_number,
    ].filter(Boolean).join(" ");
    const regDate = selected.registration_date
      ? (selected.registration_date.length === 7 ? selected.registration_date + "-01" : selected.registration_date)
      : "";

    // Best-effort match to an EXISTING vehicle by VIN or plate number.
    const vin     = norm(selected.chassis_number);
    const plateNo = norm(selected.license_plate_number);
    const pickedVehicle =
      (vin ? vehicles.find((v) => norm(v.vin) !== "" && norm(v.vin) === vin) : undefined) ??
      (plateNo ? vehicles.find((v) => norm(v.plate_number).includes(plateNo) && plateNo !== "") : undefined);

    const hasVehicleOcr = !!(
      selected.maker || selected.vehicle_name || selected.model || selected.grade ||
      selected.chassis_number || plate || selected.first_registration_date ||
      selected.registration_date || selected.inspection_expiry_date ||
      selected.displacement || selected.color
    );

    if (pickedVehicle) {
      // Prefer the existing vehicle: select it (and adopt its owner as the customer).
      setVehMode("select");
      setVehicleId(pickedVehicle.id);
      setCustomerId(pickedVehicle.customer_id);
    } else if (hasVehicleOcr) {
      // No match → fill the new-vehicle form (switch the panel to new-vehicle mode).
      // 車名(vehicle_name)→ model, 型式(model)→ vehicle_code, 色(color)→ body color.
      const mapped: Partial<typeof nv> = {
        maker:                         selected.maker ?? "",
        model:                         selected.vehicle_name ?? "",
        grade:                         selected.grade ?? "",
        vehicle_code:                  selected.model ?? "",
        vin:                           selected.chassis_number ?? "",
        first_registration_year_month: selected.first_registration_date ?? "",
        registration_date:             regDate,
        inspection_expiry_date:        selected.inspection_expiry_date ?? "",
        displacement:                  selected.displacement ?? "",
        color:                         selected.color ?? "",
        plate_number:                  plate,
      };
      const hasManual = Object.entries(nv).some(([, v]) => v.trim() !== "");
      const overwrite = !hasManual ||
        window.confirm("入力済みの車両情報があります。OCR結果で上書きしますか？（キャンセル＝空欄のみ補完）");
      setVehMode("new");
      setNv((prev) => {
        const u = { ...prev };
        for (const [k, val] of Object.entries(mapped) as [keyof typeof nv, string][]) {
          if (!val) continue;
          if (overwrite || !prev[k].trim()) u[k] = val;
        }
        return u;
      });
      // Vehicle Size — 3M classification (fills sizeKey; user can override).
      const est = estimateBodySize({
        maker: selected.maker, vehicleName: selected.vehicle_name, model: selected.model,
        grade: selected.grade, year: selected.first_registration_date?.slice(0, 4),
      });
      setSizeEstimate(est);
      if (est.sizeKey && (overwrite || sizeKey === "M")) setSizeKey(est.sizeKey);
    }

    // ── Customer ─────────────────────────────────────────────────────────────
    // Skip when an existing vehicle was matched — its owner is already selected.
    const custName = (selected.customer_candidate_name ?? "").trim();
    const custAddr = (selected.customer_candidate_address ?? "").trim();
    if (!pickedVehicle && custName) {
      const nk = norm(custName);
      const pickedCustomer = localCustomers.find((c) => {
        const cn = norm(customerDisplayName(c) || c.last_name || "");
        return cn !== "" && (cn === nk || cn.includes(nk) || nk.includes(cn));
      });
      if (pickedCustomer) {
        // Prefer the existing customer: select it.
        setCustomerMode("select");
        setCustomerId(pickedCustomer.id);
      } else {
        // No match → fill the new-customer form (empty-only, preserving manual input).
        setCustomerMode("new");
        setNc((prev) => ({
          ...prev,
          name:       prev.name.trim() ? prev.name : custName,
          address:    prev.address.trim() ? prev.address : custAddr,
          isBusiness: selected.customer_type === "corporation" ? true : prev.isBusiness,
        }));
      }
    }

    // ── Internal memo reference block (kept; no longer the ONLY effect) ─────────
    const labelMap: Record<string, string> = {
      vehicle_name: "車名", maker: "メーカー", model: "型式", grade: "グレード", chassis_number: "車台番号",
      license_plate_region: "ナンバー地域", license_plate_class: "分類番号", license_plate_kana: "かな",
      license_plate_number: "指定番号", first_registration_date: "初度登録年月", registration_date: "登録年月日",
      inspection_expiry_date: "車検有効期限", owner_name: "所有者", user_name: "使用者",
      owner_address: "所有者住所", user_address: "使用者住所",
      customer_candidate_name: "顧客氏名", customer_candidate_address: "顧客住所",
      color: "色", displacement: "排気量",
    };
    const lines: string[] = ["【車検証読み取り結果】"];
    for (const [k, v] of Object.entries(selected)) {
      if (v && k !== "confidence" && k !== "customer_type" && labelMap[k]) lines.push(`${labelMap[k]}: ${v}`);
    }
    const ocrText = lines.join("\n");
    setInternalMemo((prev) => (prev ? `${prev}\n\n${ocrText}` : ocrText));

    setOcrStage("closed"); setPendingOcr(null);
  }

  // Manual 3M re-estimate from the entered maker/model.
  function estimateSize() {
    const est = estimateBodySize({ maker: nv.maker, vehicleName: nv.model, grade: nv.grade });
    setSizeEstimate(est);
    if (est.sizeKey) setSizeKey(est.sizeKey);
  }

  // G1 — create a customer inline (reuses createCustomer, no new write path). The
  // customer is a first-class record created immediately (same as the legacy
  // onboarding/wizard) and set as selected; unsaved vehicle/item/discount data is
  // untouched. Repeated clicks are guarded.
  async function handleCreateCustomer() {
    setError(null);
    const fullName = nc.name.trim(); // single full-name field — never split (corp names as-is)
    if (!fullName) { setError("お客様名を入力してください。"); return; }
    if (creatingCustomer) return;
    setCreatingCustomer(true);

    const cfd = new FormData();
    cfd.set("name",               fullName);
    cfd.set("phone",              nc.phone);
    cfd.set("email",              nc.email);
    cfd.set("postal_code",        nc.postal);
    cfd.set("address1",           nc.address);
    cfd.set("line_user_id",       nc.lineId);
    cfd.set("is_business",        nc.isBusiness ? "true" : "false");
    cfd.set("trade_discount_pct", nc.isBusiness ? nc.tradeRate : "0");
    cfd.set("closing_day",                 nc.isBusiness ? nc.closingDay : "");
    cfd.set("payment_day",                 nc.isBusiness ? nc.paymentDay : "");
    cfd.set("accounts_receivable_allowed", (nc.isBusiness && nc.arAllowed) ? "true" : "false");

    const r = await createCustomer(cfd);
    setCreatingCustomer(false);
    if ("error" in r) { setError(r.error ?? "顧客の作成に失敗しました。"); return; }
    const newId = "customerId" in r ? r.customerId : "";
    if (!newId) { setError("顧客IDの取得に失敗しました。"); return; }

    const newCust: CustomerDB = {
      id: newId, dealer_id: null, customer_code: null,
      last_name: fullName, first_name: null, last_name_kana: null, first_name_kana: null,
      phone: nc.phone.trim() || null, email: nc.email.trim() || null,
      postal_code: nc.postal.trim() || null, prefecture: null, city: null,
      address1: nc.address.trim() || null, address2: null,
      birthday: null, gender: null, occupation: null, notes: null,
      line_user_id: nc.lineId.trim() || null, line_display_name: null, line_picture_url: null, line_connected: false,
      is_business: nc.isBusiness, trade_discount_pct: nc.isBusiness ? (Number(nc.tradeRate) || 0) : 0, credit_terms: null,
      deleted_at: null, created_at: "", updated_at: "",
    };
    setLocalCustomers((prev) => [newCust, ...prev]);
    setCustomerId(newId);
    if (vehMode === "select") setVehicleId(""); // the new customer has no existing vehicles yet
    setCustomerMode("select");
  }

  // ── Totals (client preview = server-authoritative function) ─────────────────
  const itemsForCalc = items.map((i) => ({ quantity: i.quantity, unit_price: i.unit_price, discount_rate: i.discount_rate }));
  const rawSubtotal  = items.reduce((s, i) => s + lineTotal(i.quantity, i.unit_price, i.discount_rate), 0);
  // Category subtotals — display only. Grouped from the SAME line items via the SAME
  // lineTotal(); does not affect subtotal / discount / tax / total. Empty categories
  // are omitted. Shown in canonical CATEGORY_LABEL order.
  const categorySubtotals = (() => {
    const order = Object.keys(CATEGORY_LABEL);
    const m = new Map<string, number>();
    for (const i of items) m.set(i.category, (m.get(i.category) ?? 0) + lineTotal(i.quantity, i.unit_price, i.discount_rate));
    return Array.from(m.entries())
      .filter(([, amt]) => Math.round(amt) !== 0)
      .sort((a, b) => order.indexOf(a[0]) - order.indexOf(b[0]));
  })();
  const couponTotal  = DEFAULT_COUPONS.reduce((s, c, i) => s + (coupons[i] ? c.amount : 0), 0);
  const extraAmount  = Number(extraDisc) || 0;
  const dealerDiscount = isDealer ? Math.round(rawSubtotal * (1 - dealerRate / 100)) : 0;
  const discountAmount = couponTotal + extraAmount + dealerDiscount;
  const totals = calculateEstimateTotals(itemsForCalc, discountAmount, taxRate);

  // ── PPF partial work: selection state / validation (§enable rules) ──────────
  const ppfSelectedParts = catalog.ppfSingleParts.filter((sp) => ppfPartSel[sp.id]);
  const ppfPartMsg =
    ppfSelectedParts.length === 0
      ? "追加するPPF部位を選択してください"
      : ppfSelectedParts.some((sp) => !(ppfPartUnitPrice(sp) > 0))
        ? "価格を入力してください"
        : ppfSelectedParts.some((sp) => PPF_QTY_REQUIRED.has(sp.id) && !(ppfPartQuantity(sp) >= 1))
          ? "数量を入力してください"
          : null;
  const ppfPartAddEnabled = ppfPartMsg === null;

  // ── Dirty tracking (§11.1) ──────────────────────────────────────────────────
  const currentItemsSig = JSON.stringify(items.map((i) => ({ ...i, key: 0 })));
  const dirty =
    customerId !== initialCustomerId ||
    vehicleId  !== initialVehicleId  ||
    notes      !== initialNotes      ||
    internalMemo !== initialMemo     ||
    currentItemsSig !== initialItemsSig.current ||
    couponTotal !== 0 ||
    (isEdit ? extraAmount !== (estimate?.discount_amount ?? 0) : extraAmount !== 0) ||
    isDealer ||
    (vehMode === "new" && Object.values(nv).some((v) => v.trim() !== "")) ||
    (customerMode === "new" && (nc.name.trim() !== "" || nc.phone.trim() !== "" || nc.email.trim() !== "" || nc.address.trim() !== ""));
  useUnsavedChangesGuard(dirty && !pending);

  // ── Item helpers ────────────────────────────────────────────────────────────
  function appendService(input: ServiceInput) {
    const generated: PricedLineItem[] = buildLineItems([input], catalog);
    if (generated.length === 0) return;
    setItems((prev) => [
      ...prev,
      ...generated.map((g) => ({
        key: nextKey(), category: g.category, item_name: g.item_name,
        description: "", quantity: g.quantity, unit_price: g.unit_price, discount_rate: g.discount_rate,
      })),
    ]);
  }
  // TASK 1 — single-instance categories (Window Film / Room Cleaning). These may
  // exist only once per estimate: pressing 明細に追加 REGENERATES the category's lines
  // from the current selection (removing the existing ones) instead of appending a
  // duplicate. The category set is derived from the freshly generated lines, so the
  // taxonomy-flag mapping (roomclean→interior when the flag is off) is honored. No
  // pricing change — buildLineItems is the same authoritative function as append.
  function appendServiceSingle(input: ServiceInput) {
    const generated: PricedLineItem[] = buildLineItems([input], catalog);
    if (generated.length === 0) return;
    const cats = new Set(generated.map((g) => g.category));
    setItems((prev) => [
      ...prev.filter((i) => !cats.has(i.category)),
      ...generated.map((g) => ({
        key: nextKey(), category: g.category, item_name: g.item_name,
        description: "", quantity: g.quantity, unit_price: g.unit_price, discount_rate: g.discount_rate,
      })),
    ]);
  }
  function updateItem(key: string, patch: Partial<EditorItem>) {
    setItems((prev) => prev.map((i) => (i.key === key ? { ...i, ...patch } : i)));
  }
  function removeItem(key: string) { setItems((prev) => prev.filter((i) => i.key !== key)); }
  function addBlankItem() {
    setItems((prev) => [...prev, { key: nextKey(), category: "other", item_name: "", description: "", quantity: 1, unit_price: 0, discount_rate: 0 }]);
  }

  // PPF partial work → add each SELECTED part as an estimate line using the
  // (possibly edited) unit price and quantity. Raw items are pushed exactly like
  // addBlankItem, so the existing estimate-totals calculation applies unchanged.
  // The edited price lives only in component state → the price master is untouched.
  function ppfPartUnitPrice(sp: { id: string; price: number }) {
    const raw = ppfPartPrice[sp.id];
    return raw == null || raw === "" ? sp.price : Number(raw);
  }
  function ppfPartQuantity(sp: { id: string }) {
    return PPF_QTY_REQUIRED.has(sp.id) ? Math.max(1, ppfPartQty[sp.id] ?? 1) : 1;
  }
  function handleAddPpfParts() {
    const selected = catalog.ppfSingleParts.filter((sp) => ppfPartSel[sp.id]);
    if (selected.length === 0) return; // guarded by disabled button + inline message
    setItems((prev) => {
      const next = [...prev];
      for (const sp of selected) {
        const name  = `PPF ${sp.name}`;
        const price = ppfPartUnitPrice(sp);
        const qty   = ppfPartQuantity(sp);
        // TASK 2 (Option A) — if this PPF part is already in the estimate, UPDATE the
        // existing line (price/qty) instead of creating a duplicate.
        const idx = next.findIndex((it) => it.category === "ppf" && it.item_name === name);
        if (idx >= 0) next[idx] = { ...next[idx], unit_price: price, quantity: qty };
        else next.push({ key: nextKey(), category: "ppf", item_name: name, description: "", quantity: qty, unit_price: price, discount_rate: 0 });
      }
      return next;
    });
    // TASK 1 — keep the current UI state (selection / edited prices / quantities).
    // Nothing is reset automatically; the operator changes selections manually.
  }
  const toggle = (arr: string[], id: string) => (arr.includes(id) ? arr.filter((x) => x !== id) : [...arr, id]);

  function handleCancel() {
    if (dirty && !window.confirm("未保存の変更があります。破棄して戻りますか？")) return;
    router.push(isEdit && estimate ? `/estimates/${estimate.id}` : "/estimates");
  }

  // PDF / LINE — post-save actions available once the estimate has an id (edit mode).
  // Both reuse the EXISTING flows; no new PDF/LINE logic is added here.
  const savedEstimateId = isEdit && estimate ? estimate.id : undefined;
  function handleOpenPdf() {
    if (savedEstimateId) window.open(`/pdf?estimateId=${savedEstimateId}`, "_blank", "noopener,noreferrer");
  }
  function handleOpenLine() {
    // No estimate-scoped LINE-send flow exists; route to the existing LINE surface.
    if (savedEstimateId) router.push("/line");
  }

  function handleSave() {
    setError(null);
    if (!catalogReady) { setError("価格表の読み込み中です。少し待ってから保存してください。"); return; }
    if (!customerId) { setError("顧客を選択してください。"); return; }
    if (vehMode === "select" && !vehicleId) { setError("車両を選択してください。"); return; }
    if (vehMode === "new" && !nv.maker.trim() && !nv.plate_number.trim()) { setError("新規車両のメーカーまたはナンバーを入力してください。"); return; }
    if (items.length === 0) { setError("明細を1件以上追加してください。"); return; }

    const itemsPayload = items.map((i, idx) => ({
      category: i.category, item_name: i.item_name, description: i.description,
      quantity: i.quantity, unit_price: i.unit_price, discount_rate: i.discount_rate, sort_order: idx,
    }));

    const fd = new FormData();
    fd.set("customer_id",     customerId);
    fd.set("tax_rate",        String(taxRate));
    fd.set("discount_amount", String(discountAmount));
    fd.set("notes",           notes);
    fd.set("internal_memo",   internalMemo);
    fd.set("subtotal",        String(totals.subtotal));
    fd.set("tax_amount",      String(totals.tax_amount));
    fd.set("total",           String(totals.total));
    fd.set("items_json",      JSON.stringify(itemsPayload));

    startTransition(async () => {
      // Resolve the vehicle: create a new one (reusing the existing createVehicle
      // action) when in "new" mode, otherwise use the selected vehicle.
      let resolvedVehicleId = vehicleId;
      if (vehMode === "new") {
        const vfd = new FormData();
        vfd.set("customer_id",            customerId);
        vfd.set("maker",                  nv.maker);
        vfd.set("model",                  nv.model);
        vfd.set("grade",                  nv.grade);
        vfd.set("vehicle_code",           nv.vehicle_code);
        vfd.set("vin",                    nv.vin);
        vfd.set("color",                  nv.color);
        vfd.set("plate_number",           nv.plate_number);
        vfd.set("displacement",           nv.displacement);
        vfd.set("inspection_expiry_date", nv.inspection_expiry_date);
        vfd.set("registration_date",      nv.registration_date);
        vfd.set("body_size",              sizeKey);
        vfd.set("year",                   nv.first_registration_year_month.slice(0, 4));
        vfd.set("first_registration_year_month", nv.first_registration_year_month);
        const vr = await createVehicle(vfd);
        if ("error" in vr) { setError(vr.error ?? "車両の登録に失敗しました。"); return; }
        resolvedVehicleId = "vehicleId" in vr ? vr.vehicleId : "";
      }
      if (!resolvedVehicleId) { setError("車両の解決に失敗しました。"); return; }
      fd.set("vehicle_id", resolvedVehicleId);

      if (isEdit && estimate) {
        // Preserve status / number / title / valid-until on edit.
        fd.set("status",      String(estimate.status));
        fd.set("estimate_no", estimate.estimate_number ?? estimate.estimate_no ?? "");
        fd.set("title",       estimate.title ?? "");
        fd.set("valid_until", estimate.valid_until ?? "");
        const r = await updateEstimate(estimate.id, fd);
        if ("error" in r) { setError(r.error ?? "保存に失敗しました。"); return; }
        router.push(`/estimates/${estimate.id}`);
      } else {
        fd.set("status", "draft"); // new estimates are drafts
        const r = await createEstimate(fd);
        if (r?.error) { setError(r.error); return; }
        const newId = "estimateId" in r ? r.estimateId : undefined;
        router.push(newId ? `/estimates/${newId}` : "/estimates");
      }
    });
  }

  return (
    <div className="flex flex-col gap-4 pb-36 lg:pb-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-base font-semibold text-slate-100">{isEdit ? "見積編集" : "新規見積"}</h1>
          {isEdit && estimate && (
            <p className="text-xs text-slate-500 mt-0.5">{estimateDisplayNo(estimate)}{estimate.title ? ` / ${estimate.title}` : ""}</p>
          )}
        </div>
        {/* Desktop action buttons moved into the sticky total summary card (below).
            Tablet/mobile use the fixed bottom action bar. */}
      </div>

      {!catalogReady && <p className="text-[11px] text-amber-400">価格表を読み込み中... 読み込み完了まで保存できません。</p>}
      {error && (
        <div className="px-3 py-2 rounded-lg border border-red-500/30 bg-red-500/10"><p className="text-xs text-red-400">{error}</p></div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 flex flex-col gap-4">
          {/* Customer */}
          <div className={card}>
            <h3 className={secHdr}>顧客</h3>

            {/* Mode: select existing OR create a new customer */}
            <div className="flex gap-2 mb-3">
              <button type="button" onClick={() => setCustomerMode("select")} className={chip(customerMode === "select")}>既存顧客を選択</button>
              <button type="button" onClick={() => setCustomerMode("new")} className={chip(customerMode === "new")}>新規顧客を作成</button>
            </div>

            {customerMode === "select" ? (
              <>
                <label className={lbl}>顧客を選択</label>
                <select value={customerId} onChange={(e) => { setCustomerId(e.target.value); setVehicleId(""); }} className={`${inp} mt-1`}>
                  <option value="">顧客を選択...</option>
                  {localCustomers.map((c) => <option key={c.id} value={c.id}>{customerDisplayName(c) || c.last_name || "（無名）"}</option>)}
                </select>
              </>
            ) : (
              <div className="flex flex-col gap-2">
                <div>
                  <label className={lbl}>お客様名 / 会社名<span className="text-red-400"> *</span></label>
                  <input type="text" value={nc.name} onChange={(e) => setNc((p) => ({ ...p, name: e.target.value }))} placeholder="山田太郎 / 株式会社〇〇" className={`${inp} mt-1`} />
                  <span className="text-[10px] text-slate-600">個人名・法人名をそのまま1項目で入力（分割しません）</span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <div><label className={lbl}>電話番号</label><input type="tel" inputMode="tel" value={nc.phone} onChange={(e) => setNc((p) => ({ ...p, phone: e.target.value }))} placeholder="090-0000-0000" className={`${inp} mt-1`} /></div>
                  <div><label className={lbl}>メール</label><input type="email" value={nc.email} onChange={(e) => setNc((p) => ({ ...p, email: e.target.value }))} className={`${inp} mt-1`} /></div>
                  <div><label className={lbl}>郵便番号</label><input type="text" value={nc.postal} onChange={(e) => setNc((p) => ({ ...p, postal: e.target.value }))} placeholder="000-0000" className={`${inp} mt-1`} /></div>
                  <div><label className={lbl}>LINE ID</label><input type="text" value={nc.lineId} onChange={(e) => setNc((p) => ({ ...p, lineId: e.target.value }))} className={`${inp} mt-1`} /></div>
                  <div className="col-span-2"><label className={lbl}>住所</label><input type="text" value={nc.address} onChange={(e) => setNc((p) => ({ ...p, address: e.target.value }))} placeholder="都道府県・市区町村・番地" className={`${inp} mt-1`} /></div>
                </div>
                <div className="flex items-center gap-2 mt-1">
                  <button type="button" onClick={() => setNc((p) => ({ ...p, isBusiness: !p.isBusiness }))} className={`w-5 h-5 rounded border-2 flex items-center justify-center ${nc.isBusiness ? "bg-[#1d4ed8] border-[#1d4ed8]" : "border-slate-600"}`}>{nc.isBusiness && <span className="text-white text-[10px]">✓</span>}</button>
                  <span className="text-sm text-slate-300">業者（法人）</span>
                </div>
                {nc.isBusiness && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 border border-slate-700/60 rounded-lg p-3">
                    <div><label className={lbl}>掛け率（%）</label><input type="number" min={0} max={100} value={nc.tradeRate} onChange={(e) => setNc((p) => ({ ...p, tradeRate: e.target.value }))} className={`${inp} mt-1`} /></div>
                    <div className="flex items-end gap-2 pb-1">
                      <button type="button" onClick={() => setNc((p) => ({ ...p, arAllowed: !p.arAllowed }))} className={`w-5 h-5 rounded border-2 flex items-center justify-center ${nc.arAllowed ? "bg-[#1d4ed8] border-[#1d4ed8]" : "border-slate-600"}`}>{nc.arAllowed && <span className="text-white text-[10px]">✓</span>}</button>
                      <span className="text-xs text-slate-300">売掛（AR）許可</span>
                    </div>
                    <div><label className={lbl}>締め日</label><input type="number" min={1} max={31} value={nc.closingDay} onChange={(e) => setNc((p) => ({ ...p, closingDay: e.target.value }))} placeholder="例: 20" className={`${inp} mt-1`} /></div>
                    <div><label className={lbl}>支払日</label><input type="number" min={1} max={31} value={nc.paymentDay} onChange={(e) => setNc((p) => ({ ...p, paymentDay: e.target.value }))} placeholder="例: 末=31" className={`${inp} mt-1`} /></div>
                  </div>
                )}
                <button type="button" onClick={handleCreateCustomer} disabled={creatingCustomer || !nc.name.trim()}
                  className="self-start text-xs font-medium bg-[#1d4ed8] hover:bg-[#1e40af] disabled:opacity-50 text-white px-4 py-2 rounded-lg transition-colors">
                  {creatingCustomer ? "登録中..." : "この顧客を登録"}
                </button>
              </div>
            )}
          </div>

          {/* Vehicle */}
          <div className={card}>
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider">車両</h3>
              <button type="button" onClick={() => setOcrStage("upload")}
                className="text-xs px-3 py-1.5 rounded-lg text-blue-400 border border-blue-500/30 bg-blue-500/5 hover:bg-blue-500/10 transition-colors">
                📄 車検証OCR
              </button>
            </div>

            {/* Mode: select existing OR enter a new vehicle */}
            <div className="flex gap-2 mb-3">
              <button type="button" onClick={() => setVehMode("select")} className={chip(vehMode === "select")}>既存車両を選択</button>
              <button type="button" onClick={() => setVehMode("new")} className={chip(vehMode === "new")}>新規車両を入力</button>
            </div>

            {vehMode === "select" ? (
              <>
                <label className={lbl}>車両を選択</label>
                <select value={vehicleId} onChange={(e) => setVehicleId(e.target.value)} className={`${inp} mt-1`}>
                  <option value="">車両を選択...</option>
                  {filteredVehicles.map((v) => <option key={v.id} value={v.id}>{vehicleDisplayName(v) || "（車両）"}</option>)}
                </select>
                {customerId && filteredVehicles.length === 0 && <p className="text-[10px] text-slate-500 mt-1.5">この顧客に紐づく車両がありません。「新規車両を入力」で登録できます。</p>}
              </>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <div><label className={lbl}>メーカー</label><input type="text" value={nv.maker} onChange={(e) => setNv((p) => ({ ...p, maker: e.target.value }))} placeholder="トヨタ" className={`${inp} mt-1`} /></div>
                <div><label className={lbl}>車名</label><input type="text" value={nv.model} onChange={(e) => setNv((p) => ({ ...p, model: e.target.value }))} placeholder="クラウン" className={`${inp} mt-1`} /></div>
                <div><label className={lbl}>グレード</label><input type="text" value={nv.grade} onChange={(e) => setNv((p) => ({ ...p, grade: e.target.value }))} placeholder="アスリート" className={`${inp} mt-1`} /></div>
                <div><label className={lbl}>型式</label><input type="text" value={nv.vehicle_code} onChange={(e) => setNv((p) => ({ ...p, vehicle_code: e.target.value }))} placeholder="ABA-XXX" className={`${inp} mt-1`} /></div>
                <div className="col-span-2"><label className={lbl}>車台番号</label><input type="text" value={nv.vin} onChange={(e) => setNv((p) => ({ ...p, vin: e.target.value }))} className={`${inp} mt-1`} /></div>
                <div><label className={lbl}>初度登録年月</label><input type="text" value={nv.first_registration_year_month} onChange={(e) => setNv((p) => ({ ...p, first_registration_year_month: e.target.value }))} placeholder="2020-04" className={`${inp} mt-1`} /></div>
                <div><label className={lbl}>登録年月日</label><input type="date" value={nv.registration_date} onChange={(e) => setNv((p) => ({ ...p, registration_date: e.target.value }))} className={`${inp} mt-1`} /></div>
                <div><label className={lbl}>車検満了日</label><input type="date" value={nv.inspection_expiry_date} onChange={(e) => setNv((p) => ({ ...p, inspection_expiry_date: e.target.value }))} className={`${inp} mt-1`} /></div>
                <div><label className={lbl}>排気量</label><input type="text" value={nv.displacement} onChange={(e) => setNv((p) => ({ ...p, displacement: e.target.value }))} placeholder="1998cc" className={`${inp} mt-1`} /></div>
                <div><label className={lbl}>ボディカラー<span className="text-[9px] text-slate-500">（手入力）</span></label><input type="text" value={nv.color} onChange={(e) => setNv((p) => ({ ...p, color: e.target.value }))} placeholder="ホワイトパール" className={`${inp} mt-1`} /></div>
                <div className="col-span-2"><label className={lbl}>ナンバー</label><input type="text" value={nv.plate_number} onChange={(e) => setNv((p) => ({ ...p, plate_number: e.target.value }))} placeholder="品川 300 あ 1234" className={`${inp} mt-1`} /></div>
                <div className="col-span-2">
                  <label className={lbl}>ボディサイズ<span className="text-[9px] text-slate-500">（3M推定）</span></label>
                  <div className="flex items-center gap-2 mt-1">
                    <select value={sizeKey} onChange={(e) => setSizeKey(e.target.value)} className="bg-[#0f172a] border border-slate-700 rounded px-2 py-2 text-sm text-slate-100">
                      {sizeKeys.map((k) => <option key={k} value={k}>{k}</option>)}
                    </select>
                    <button type="button" onClick={estimateSize} className="text-xs text-blue-400 border border-blue-500/30 bg-blue-500/5 hover:bg-blue-500/10 px-3 py-1.5 rounded-lg">3M推定</button>
                    {sizeEstimate && <span className="text-[10px] text-slate-500">{sizeEstimate.basis}</span>}
                  </div>
                </div>
                <p className="col-span-2 text-[10px] text-slate-600">保存時に車両として登録されます。</p>
              </div>
            )}
          </div>

          {/* Services */}
          <div className={card}>
            <h3 className={secHdr}>サービス（明細生成）</h3>
            <p className="text-[10px] text-slate-500 mb-3">カテゴリを設定し「明細に追加」で価格表から明細を生成します。生成後は下の明細で数量・割引を調整できます。</p>

            <div className="flex items-center gap-2 mb-4">
              <span className={lbl}>ボディサイズ</span>
              <select value={sizeKey} onChange={(e) => setSizeKey(e.target.value)} className="bg-[#0f172a] border border-slate-700 rounded px-2 py-1 text-sm text-slate-100">
                {sizeKeys.map((k) => <option key={k} value={k}>{k}</option>)}
              </select>
            </div>

            <div className="flex flex-col gap-4">
              {/* Coating */}
              <div className="border border-slate-700/60 rounded-lg p-3">
                <p className="text-xs font-semibold text-blue-300 mb-2">コーティング</p>
                <select value={coatingId} onChange={(e) => setCoatingId(e.target.value)} className={`${inp} mb-2`}>
                  <option value="">コーティングを選択...</option>
                  {catalog.coatings.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mb-2">
                  <select value={topcoat2} onChange={(e) => setTopcoat2(e.target.value)} className={inp}>
                    <option value="">トップコート2層目なし</option>
                    {Object.keys(catalog.topcoatBase).map((t) => <option key={t} value={t}>{catalog.topcoatName[t] ?? t}</option>)}
                  </select>
                  <select value={topcoat3} onChange={(e) => setTopcoat3(e.target.value)} className={inp}>
                    <option value="">トップコート3層目なし</option>
                    {Object.keys(catalog.topcoatBase).map((t) => <option key={t} value={t}>{catalog.topcoatName[t] ?? t}</option>)}
                  </select>
                </div>
                <div className="flex flex-wrap gap-1.5 mb-2">
                  {catalog.coatingOptions.filter((o) => o.cat === "coating").map((o) => (
                    <button key={o.id} type="button" onClick={() => setCoatingOpts((p) => toggle(p, o.id))} className={chip(coatingOpts.includes(o.id))}>{o.name}</button>
                  ))}
                </div>
                {/* TASK 2 — enable once a base coating OR at least one coating option
                    is selected (options such as ハードポリッシュ/鉄粉除去/付着物除去/タッチアップ
                    alone are valid). calcCoating already emits lines from options only. */}
                <button type="button" disabled={!coatingId && coatingOpts.length === 0} onClick={() => appendService({ type: "coating", coatingId, sizeKey, topcoat2: topcoat2 || undefined, topcoat3: topcoat3 || undefined, optionIds: coatingOpts })}
                  className="text-xs text-blue-400 border border-blue-500/30 bg-blue-500/5 hover:bg-blue-500/10 disabled:opacity-40 px-3 py-1.5 rounded-lg">明細に追加</button>
              </div>

              {/* PPF プラン（全体施工） */}
              <div className="border border-slate-700/60 rounded-lg p-3">
                <p className="text-xs font-semibold text-blue-300 mb-2">PPF プラン（全体施工）</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mb-2">
                  <select value={ppfPlan} onChange={(e) => setPpfPlan(e.target.value)} className={inp}>
                    <option value="">プランを選択...</option>
                    {catalog.ppfPlans.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                  </select>
                  <select value={ppfFilm} onChange={(e) => setPpfFilm(e.target.value)} className={inp}>
                    {catalog.ppfFilmTypes.map((f) => <option key={f.id} value={f.id}>{f.name}</option>)}
                  </select>
                  <select value={ppfRank} onChange={(e) => setPpfRank(e.target.value)} className={inp}>
                    {catalog.ppfVehicleRanks.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
                  </select>
                  <select value={ppfFrontGlass} onChange={(e) => setPpfFrontGlass(e.target.value)} className={inp}>
                    <option value="">フロントガラスなし</option>
                    {catalog.ppfFrontGlass.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}
                  </select>
                </div>
                <button type="button" disabled={!ppfPlan} onClick={() => appendService({ type: "ppf", planId: ppfPlan, filmType: ppfFilm, vehicleRank: ppfRank, sizeKey, frontGlass: ppfFrontGlass || undefined, singleParts: [] })}
                  className="text-xs text-blue-400 border border-blue-500/30 bg-blue-500/5 hover:bg-blue-500/10 disabled:opacity-40 px-3 py-1.5 rounded-lg">明細に追加</button>
              </div>

              {/* PPF 部分施工（部位別・プラン不要・独立） */}
              {catalog.ppfSingleParts.length > 0 && (
                <div className="border border-slate-700/60 rounded-lg p-3">
                  <p className="text-xs font-semibold text-blue-300 mb-1">PPF 部分施工（部位別）</p>
                  <p className="text-[10px] text-slate-500 mb-2">プラン選択は不要。部位を選び、必要に応じて価格・数量を編集して追加します。</p>
                  <div className="flex flex-col gap-1.5 mb-2">
                    {catalog.ppfSingleParts.map((sp) => {
                      const sel     = !!ppfPartSel[sp.id];
                      const qtyReq  = PPF_QTY_REQUIRED.has(sp.id);
                      const priceStr = ppfPartPrice[sp.id] ?? String(sp.price);
                      const priceNum = Number(priceStr);
                      const qty     = qtyReq ? (ppfPartQty[sp.id] ?? 1) : 1;
                      const sub     = (priceNum > 0 ? priceNum : 0) * (qty >= 1 ? qty : 0);
                      return (
                        <div key={sp.id} className={`flex items-center gap-2 text-xs rounded-md px-2 py-1.5 ${sel ? "bg-blue-500/5 border border-blue-500/25" : "border border-slate-700/40"}`}>
                          <button type="button" aria-pressed={sel} onClick={() => setPpfPartSel((p) => ({ ...p, [sp.id]: !p[sp.id] }))}
                            className={`w-4 h-4 shrink-0 rounded border flex items-center justify-center ${sel ? "bg-[#1d4ed8] border-[#1d4ed8]" : "border-slate-600"}`}>
                            {sel && <span className="text-white text-[9px] leading-none">✓</span>}
                          </button>
                          <span className="flex-1 text-slate-200 truncate">{sp.name}</span>
                          <span className="hidden sm:inline text-[10px] text-slate-500 shrink-0">既定 {sp.price > 0 ? `¥${sp.price.toLocaleString("ja-JP")}` : "価格未設定"}</span>
                          <div className="flex items-center gap-0.5 shrink-0">
                            <span className="text-slate-500">¥</span>
                            <input type="number" min={0} value={priceStr} disabled={!sel}
                              onChange={(e) => setPpfPartPrice((p) => ({ ...p, [sp.id]: e.target.value }))}
                              className="w-20 bg-[#0f172a] border border-slate-700 rounded px-2 py-1 text-right text-slate-100 disabled:opacity-40" />
                          </div>
                          {qtyReq ? (
                            <input type="number" min={1} max={sp.maxQty > 1 ? sp.maxQty : undefined} value={qty} disabled={!sel}
                              onChange={(e) => setPpfPartQty((p) => ({ ...p, [sp.id]: Math.max(1, Number(e.target.value) || 1) }))}
                              className="w-12 bg-[#0f172a] border border-slate-700 rounded px-2 py-1 text-right text-slate-100 disabled:opacity-40" title="数量" />
                          ) : (
                            <span className="w-12 text-center text-slate-600 shrink-0" title="数量1固定">×1</span>
                          )}
                          <span className="w-20 text-right tabular-nums shrink-0 text-slate-300">{sel ? `¥${sub.toLocaleString("ja-JP")}` : "—"}</span>
                        </div>
                      );
                    })}
                  </div>
                  {ppfPartMsg && <p className={`text-[11px] mb-2 ${ppfSelectedParts.length === 0 ? "text-slate-500" : "text-amber-400"}`}>{ppfPartMsg}</p>}
                  <button type="button" disabled={!ppfPartAddEnabled} onClick={handleAddPpfParts}
                    className="text-xs text-blue-400 border border-blue-500/30 bg-blue-500/5 hover:bg-blue-500/10 disabled:opacity-40 px-3 py-1.5 rounded-lg">明細に追加</button>
                </div>
              )}

              {/* Window */}
              <div className="border border-slate-700/60 rounded-lg p-3">
                <p className="text-xs font-semibold text-blue-300 mb-2">ウィンドウフィルム</p>
                <div className="flex flex-wrap gap-1.5 mb-2">
                  {catalog.windowParts.map((p) => <button key={p.id} type="button" onClick={() => setWindowParts((x) => toggle(x, p.id))} className={chip(windowParts.includes(p.id))}>{p.name}</button>)}
                </div>
                <select value={windowGrade} onChange={(e) => setWindowGrade(e.target.value)} className={`${inp} mb-2`}>
                  {catalog.windowGrades.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}
                </select>
                {/* TASK 1 — Window Film is single-instance: re-adding updates the
                    existing line(s) instead of creating a duplicate. */}
                <button type="button" disabled={windowParts.length === 0} onClick={() => appendServiceSingle({ type: "window", partIds: windowParts, grade: windowGrade })}
                  className="text-xs text-blue-400 border border-blue-500/30 bg-blue-500/5 hover:bg-blue-500/10 disabled:opacity-40 px-3 py-1.5 rounded-lg">明細に追加</button>
              </div>

              {/* Maintenance / Carwash — TASK 3: these are maintenance-menu services and
                  are HIDDEN on the Estimate Edit screen (they should not appear during
                  normal estimate editing). Still available when creating an estimate;
                  not removed from the application. Existing maintenance/carwash line
                  items on an edited estimate remain visible in the 明細 table below. */}
              {!isEdit && (
                <>
                  {/* Maintenance */}
                  <div className="border border-slate-700/60 rounded-lg p-3">
                    <p className="text-xs font-semibold text-blue-300 mb-2">ボディ定期メンテナンス</p>
                    <div className="flex flex-wrap gap-1.5 mb-2">
                      {catalog.maintenanceMenus.map((m) => <button key={m.id} type="button" onClick={() => setMaintSel((x) => toggle(x, m.id))} className={chip(maintSel.includes(m.id))}>{m.name}</button>)}
                    </div>
                    <button type="button" disabled={maintSel.length === 0} onClick={() => appendService({ type: "maintenance", menuIds: maintSel })}
                      className="text-xs text-blue-400 border border-blue-500/30 bg-blue-500/5 hover:bg-blue-500/10 disabled:opacity-40 px-3 py-1.5 rounded-lg">明細に追加</button>
                  </div>

                  {/* Carwash */}
                  <div className="border border-slate-700/60 rounded-lg p-3">
                    <p className="text-xs font-semibold text-blue-300 mb-2">メンテナンス洗車</p>
                    <div className="flex flex-wrap gap-1.5 mb-2">
                      {catalog.carwashMenus.map((m) => <button key={m.id} type="button" onClick={() => setCarwashSel((x) => toggle(x, m.id))} className={chip(carwashSel.includes(m.id))}>{m.name}</button>)}
                    </div>
                    <button type="button" disabled={carwashSel.length === 0} onClick={() => appendService({ type: "carwash", menuIds: carwashSel })}
                      className="text-xs text-blue-400 border border-blue-500/30 bg-blue-500/5 hover:bg-blue-500/10 disabled:opacity-40 px-3 py-1.5 rounded-lg">明細に追加</button>
                  </div>
                </>
              )}

              {/* Room clean */}
              <div className="border border-slate-700/60 rounded-lg p-3">
                <p className="text-xs font-semibold text-blue-300 mb-2">ルームクリーニング</p>
                <div className="flex flex-wrap gap-1.5 mb-2">
                  {catalog.roomCleanParts.map((p) => <button key={p.id} type="button" onClick={() => setRoomSel((x) => toggle(x, p.id))} className={chip(roomSel.includes(p.id))}>{p.name}</button>)}
                </div>
                <select value={roomCond} onChange={(e) => setRoomCond(e.target.value)} className={`${inp} mb-2`}>
                  {catalog.roomCleanConditions.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}
                </select>
                {/* TASK 1 — Room Cleaning is single-instance: re-adding updates the
                    existing line(s) instead of creating a duplicate. */}
                <button type="button" disabled={roomSel.length === 0} onClick={() => appendServiceSingle({ type: "roomclean", partIds: roomSel, condition: roomCond })}
                  className="text-xs text-blue-400 border border-blue-500/30 bg-blue-500/5 hover:bg-blue-500/10 disabled:opacity-40 px-3 py-1.5 rounded-lg">明細に追加</button>
              </div>

              {/* Other */}
              <div className="border border-slate-700/60 rounded-lg p-3">
                <p className="text-xs font-semibold text-blue-300 mb-2">その他作業</p>
                <div className="flex gap-2 mb-2">
                  <input type="text" value={otherName} onChange={(e) => setOtherName(e.target.value)} placeholder="項目名" className={inp} />
                  <input type="number" value={otherPrice} onChange={(e) => setOtherPrice(e.target.value)} placeholder="金額" className="w-28 bg-[#0f172a] border border-slate-700 rounded-lg px-3 py-2.5 text-sm text-slate-100" />
                </div>
                <button type="button" disabled={!otherName.trim() || !(Number(otherPrice) > 0)}
                  onClick={() => { appendService({ type: "other", items: [{ name: otherName.trim(), price: Number(otherPrice) || 0 }] }); setOtherName(""); setOtherPrice(""); }}
                  className="text-xs text-blue-400 border border-blue-500/30 bg-blue-500/5 hover:bg-blue-500/10 disabled:opacity-40 px-3 py-1.5 rounded-lg">明細に追加</button>
              </div>
            </div>
          </div>

          {/* Items */}
          <div className={card}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider">明細</h3>
              <button type="button" onClick={addBlankItem} className="text-xs text-blue-400 hover:text-blue-300">＋ 行を追加</button>
            </div>
            {items.length === 0 ? (
              <p className="text-xs text-slate-600">明細がありません。上のサービスから追加するか「＋ 行を追加」で手入力してください。</p>
            ) : (
              <div className="overflow-x-auto -mx-1 px-1">
                <table className="w-full min-w-[560px] text-xs">
                  <thead>
                    <tr className="border-b border-slate-700 text-slate-500">
                      <th className="text-left pb-2 pr-2">カテゴリ</th>
                      <th className="text-left pb-2 pr-2">品目</th>
                      <th className="text-right pb-2 pr-2">単価</th>
                      <th className="text-right pb-2 pr-2">数量</th>
                      <th className="text-right pb-2 pr-2">割引%</th>
                      <th className="text-right pb-2 pr-2">小計</th>
                      <th className="pb-2" />
                    </tr>
                  </thead>
                  <tbody>
                    {items.map((it) => (
                      <tr key={it.key} className="border-b border-slate-700/40 last:border-b-0">
                        <td className="py-1.5 pr-2 text-slate-500 whitespace-nowrap">{CATEGORY_LABEL[it.category] ?? it.category}</td>
                        <td className="py-1.5 pr-2">
                          <input type="text" value={it.item_name} onChange={(e) => updateItem(it.key, { item_name: e.target.value })} className="w-40 bg-[#0f172a] border border-slate-700 rounded px-2 py-1 text-slate-200" />
                        </td>
                        <td className="py-1.5 pr-2 text-right">
                          <input type="number" value={it.unit_price} onChange={(e) => updateItem(it.key, { unit_price: Number(e.target.value) || 0 })} className="w-24 bg-[#0f172a] border border-slate-700 rounded px-2 py-1 text-right text-slate-200" />
                        </td>
                        <td className="py-1.5 pr-2 text-right">
                          <input type="number" min={0} value={it.quantity} onChange={(e) => updateItem(it.key, { quantity: Number(e.target.value) || 0 })} className="w-16 bg-[#0f172a] border border-slate-700 rounded px-2 py-1 text-right text-slate-200" />
                        </td>
                        <td className="py-1.5 pr-2 text-right">
                          <input type="number" min={0} max={100} value={it.discount_rate} onChange={(e) => updateItem(it.key, { discount_rate: Number(e.target.value) || 0 })} className="w-16 bg-[#0f172a] border border-slate-700 rounded px-2 py-1 text-right text-slate-200" />
                        </td>
                        <td className="py-1.5 pr-2 text-right text-slate-200 whitespace-nowrap">{formatYen(lineTotal(it.quantity, it.unit_price, it.discount_rate))}</td>
                        <td className="py-1.5 text-right">
                          <button type="button" onClick={() => removeItem(it.key)} className="text-slate-500 hover:text-red-400">✕</button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Discounts */}
          <div className={card}>
            <h3 className={secHdr}>値引き</h3>
            <div className="flex flex-wrap gap-1.5 mb-3">
              {DEFAULT_COUPONS.map((c, i) => (
                <button key={c.name} type="button" onClick={() => setCoupons((p) => p.map((v, j) => (j === i ? !v : v)))} className={chip(coupons[i])}>
                  {c.name}（{formatYen(c.amount)}）
                </button>
              ))}
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className={lbl}>その他値引き（円）</label>
                <input type="number" value={extraDisc} onChange={(e) => setExtraDisc(e.target.value)} className={`${inp} mt-1`} />
              </div>
              <div>
                <label className={lbl}>業販</label>
                <div className="flex items-center gap-2 mt-1">
                  <button type="button" onClick={() => setIsDealer((v) => !v)} className={`w-5 h-5 rounded border-2 flex items-center justify-center ${isDealer ? "bg-[#1d4ed8] border-[#1d4ed8]" : "border-slate-600"}`}>{isDealer && <span className="text-white text-[10px]">✓</span>}</button>
                  {isDealer && (
                    <><input type="number" min={0} max={100} value={dealerRate} onChange={(e) => setDealerRate(Number(e.target.value) || 0)} className="w-16 bg-[#0f172a] border border-slate-700 rounded px-2 py-1 text-sm text-slate-100" /><span className="text-slate-400 text-sm">%</span></>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Notes */}
          <div className={card}>
            <h3 className={secHdr}>備考・メモ</h3>
            <label className={lbl}>お客様向け備考</label>
            <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} placeholder="見積書に記載する備考..." className={`${inp} mt-1 mb-3 resize-y`} />
            <label className={lbl}>社内メモ</label>
            <textarea value={internalMemo} onChange={(e) => setInternalMemo(e.target.value)} rows={3} placeholder="社内向けメモ（見積書には出ません）..." className={`${inp} mt-1 resize-y`} />
          </div>
        </div>

        {/* Totals */}
        <div className="lg:col-span-1">
          {/* Sticky on desktop only. Offset clears the fixed top header
              (--app-header-h ≈ 56px) plus ~40px breathing room (≈96px total) so the
              card is never clipped under the header / notification / user icon /
              save-cancel actions. max-h + overflow guards against vertical clipping on
              short viewports. Below lg it stays in normal flow (no sticky → no clip). */}
          <div className={`${card} lg:sticky lg:top-[calc(var(--app-header-h)+2.5rem)] lg:max-h-[calc(100vh-var(--app-header-h)-3.5rem)] lg:overflow-y-auto`}>
            <h3 className={secHdr}>合計</h3>
            <div className="space-y-2 text-sm">
              {/* Category subtotals (display only) — replaces the single 小計 line. */}
              {categorySubtotals.length > 0 ? (
                categorySubtotals.map(([cat, amt]) => (
                  <div key={cat} className="flex justify-between"><span className="text-slate-400">{CATEGORY_LABEL[cat] ?? cat}</span><span className="text-slate-200">{formatYen(amt)}</span></div>
                ))
              ) : (
                <div className="flex justify-between"><span className="text-slate-400">小計</span><span className="text-slate-200">{formatYen(totals.subtotal)}</span></div>
              )}
              <div className="flex justify-between border-t border-slate-700/60 pt-2"><span className="text-slate-400">値引き</span><span className="text-slate-200">-{formatYen(totals.discount_amount)}</span></div>
              <div className="flex justify-between"><span className="text-slate-400">消費税（{taxRate}%）</span><span className="text-slate-200">{formatYen(totals.tax_amount)}</span></div>
              <div className="flex justify-between border-t border-slate-700 pt-2 font-semibold"><span className="text-slate-200">合計</span><span className="text-white">{formatYen(totals.total)}</span></div>
            </div>
            <p className="text-[10px] text-slate-600 mt-3">金額は保存時にサーバーで再計算され確定します。</p>
            {/* Desktop action buttons — inside the sticky card so they follow scroll
                with the totals. Tablet/mobile use the fixed bottom bar instead.
                PDF作成 / LINE送信 reuse existing flows and require a saved estimate. */}
            <div className="hidden lg:grid grid-cols-2 gap-2 mt-4 pt-3 border-t border-slate-700/60">
              <button type="button" onClick={handleCancel} disabled={pending}
                className="text-xs font-medium bg-slate-700 hover:bg-slate-600 disabled:opacity-50 text-slate-200 px-4 py-2.5 rounded-lg transition-colors">キャンセル</button>
              <button type="button" onClick={handleSave} disabled={pending || !catalogReady}
                className="text-xs font-medium bg-[#1d4ed8] hover:bg-[#1e40af] disabled:opacity-50 text-white px-4 py-2.5 rounded-lg transition-colors">{pending ? "保存中..." : "保存"}</button>
              <button type="button" onClick={handleOpenPdf} disabled={!savedEstimateId} title={savedEstimateId ? undefined : "保存後に利用できます"}
                className="text-xs font-medium bg-slate-700 hover:bg-slate-600 disabled:opacity-40 text-slate-200 px-4 py-2.5 rounded-lg transition-colors">PDF作成</button>
              <button type="button" onClick={handleOpenLine} disabled={!savedEstimateId} title={savedEstimateId ? undefined : "保存後に利用できます"}
                className="text-xs font-medium bg-slate-700 hover:bg-slate-600 disabled:opacity-40 text-slate-200 px-4 py-2.5 rounded-lg transition-colors">LINE画面へ</button>
            </div>
          </div>
        </div>
      </div>

      {/* G3 — Vehicle Registration OCR modal (reuses VehicleRegistrationUpload/Review) */}
      {ocrStage !== "closed" && (
        <div className="fixed inset-0 z-[60] flex items-start justify-center p-3 sm:p-4 overflow-y-auto bg-black/60"
          onClick={() => { setOcrStage("closed"); setPendingOcr(null); }}>
          <div className="bg-[#1e293b] border border-slate-700 rounded-xl shadow-xl w-full max-w-lg p-5 sm:p-6 my-4"
            onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-semibold text-slate-100">{ocrStage === "upload" ? "車検証を読み取る" : "読み取り結果を確認"}</h3>
              <button type="button" onClick={() => { setOcrStage("closed"); setPendingOcr(null); }}
                className="text-slate-500 hover:text-slate-200 text-lg leading-none transition-colors">✕</button>
            </div>
            {ocrStage === "upload" && (
              <VehicleRegistrationUpload
                customerId={customerId || undefined}
                vehicleId={vehicleId || undefined}
                onComplete={(result) => { setPendingOcr(result); setOcrStage("review"); }}
                onCancel={() => { setOcrStage("closed"); setPendingOcr(null); }}
              />
            )}
            {ocrStage === "review" && pendingOcr && (
              <VehicleRegistrationOcrReview
                ocrResult={pendingOcr}
                onApply={applyOcr}
                onCancel={() => { setOcrStage("closed"); setPendingOcr(null); }}
              />
            )}
          </div>
        </div>
      )}

      {/* Mobile + tablet fixed action bar (desktop uses the sticky-card buttons) */}
      <div className="lg:hidden fixed bottom-0 left-0 right-0 z-40 grid grid-cols-2 gap-2 p-3 bg-[#0f172a]/95 backdrop-blur border-t border-slate-800">
        <button type="button" onClick={handleCancel} disabled={pending} className="text-sm font-medium bg-slate-700 hover:bg-slate-600 disabled:opacity-50 text-slate-200 px-4 py-3 rounded-lg">キャンセル</button>
        <button type="button" onClick={handleSave} disabled={pending || !catalogReady} className="text-sm font-medium bg-[#1d4ed8] hover:bg-[#1e40af] disabled:opacity-50 text-white px-4 py-3 rounded-lg">{pending ? "保存中..." : "保存"}</button>
        <button type="button" onClick={handleOpenPdf} disabled={!savedEstimateId} className="text-sm font-medium bg-slate-700 hover:bg-slate-600 disabled:opacity-40 text-slate-200 px-4 py-3 rounded-lg">PDF作成</button>
        <button type="button" onClick={handleOpenLine} disabled={!savedEstimateId} className="text-sm font-medium bg-slate-700 hover:bg-slate-600 disabled:opacity-40 text-slate-200 px-4 py-3 rounded-lg">LINE画面へ</button>
      </div>
    </div>
  );
}
