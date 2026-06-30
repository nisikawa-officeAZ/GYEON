"use client";

import { useState, useTransition, useEffect, useRef } from "react";
import { createCustomer }        from "@/lib/customers/create-customer";
import { createVehicle }         from "@/lib/vehicles/create-vehicle";
import { createEstimate }        from "@/lib/estimates/create-estimate";
import { previewDocumentNumber } from "@/lib/numbering/preview-document-number";
import { CustomerDB }            from "@/lib/customers/customer-types";
import { VehicleDB }             from "@/lib/vehicles/vehicle-types";
import {
  BODY_SIZES, COATINGS, TOPCOAT_BASE, TOPCOAT_NAME, COATING_OPTIONS,
  MAINTENANCE_MENUS, CARWASH_MENUS, ROOM_CLEAN_PARTS, ROOM_CLEAN_CONDITIONS,
  WINDOW_FILM_PARTS, WINDOW_FILM_GRADES,
  PPF_PLANS, PPF_PLAN_PRICES, PPF_FILM_TYPES, PPF_VEHICLE_RANKS,
  PPF_FRONT_GLASS, PPF_SINGLE_PARTS, detectPpfRank,
} from "@/lib/pricing/pricing-data";
import type { CoatingId }        from "@/lib/pricing/pricing-data";
import { calculateEstimate, buildLineItems } from "@/lib/pricing/pricing-engine";
import { SERVICE_CATEGORIES, type ServiceCategoryId } from "@/lib/estimates/service-categories";
import type { ServiceInput }     from "@/lib/pricing/pricing-engine";
import dynamic                   from "next/dynamic";
import type { VehicleRegistrationOcrResult } from "@/lib/vehicle-registration/vehicle-registration-types";
import type { DetailerRank }     from "@/lib/dealer-settings/dealer-settings-types";
import { rankEmoji, rankLabelJa } from "@/lib/ranks/dealer-ranks";
import { meetsTier } from "@/lib/ranks/permission-tiers";

const VehicleRegistrationUpload = dynamic(
  () => import("@/components/vehicle-registration/VehicleRegistrationUpload"),
  { ssr: false }
);
const VehicleRegistrationOcrReview = dynamic(
  () => import("@/components/vehicle-registration/VehicleRegistrationOcrReview"),
  { ssr: false }
);

// ── Types ─────────────────────────────────────────────────────────────────────

type Screen =
  | "category" | "step1" | "step2" | "step3" | "step4"
  | "step-ppf" | "step-window" | "step-maintenance"
  | "step-carwash" | "step-roomclean" | "step-other" | "step5";

// Service categories are defined canonically in the Service Category model
// (src/lib/estimates/service-categories.ts). Wired here for a single source of
// truth; selection/order/labels are unchanged (backward-compatible).
type CategoryId = ServiceCategoryId;
type LayerMode  = "none" | "2layer" | "3layer";

// ── Constants ─────────────────────────────────────────────────────────────────

const CATEGORIES = SERVICE_CATEGORIES;

const DEFAULT_COUPONS = [
  { name: "新規ご来店クーポン",   amount: 5000  },
  { name: "リピーター割引",       amount: 3000  },
  { name: "紹介特典クーポン",     amount: 5000  },
  { name: "キャンペーンクーポン", amount: 10000 },
  { name: "スタッフ割引",         amount: 3000  },
];

const SCREEN_LABEL: Record<Screen, string> = {
  category:           "カテゴリ選択",
  step1:              "STEP 1 / 顧客・車両情報",
  step2:              "STEP 2 / ボディサイズ",
  step3:              "STEP 3 / コーティング選択",
  step4:              "STEP 4 / 追加オプション",
  "step-ppf":         "PPF",
  "step-window":      "ウィンドウフィルム",
  "step-maintenance": "ボディ定期メンテナンス",
  "step-carwash":     "メンテナンス洗車",
  "step-roomclean":   "ルームクリーニング",
  "step-other":       "その他作業",
  step5:              "STEP 5 / お見積確認",
};

const PLACEHOLDER_SCREENS: Screen[] = [];

function topcoatOpts(coatingId: string, layer: LayerMode, cert: boolean): { id: string; name: string }[] {
  if (layer === "none") return [];
  if (coatingId === "syncro-evo") return layer === "2layer" ? [{ id: "mohs-evo", name: "MOHS EVO" }] : [];
  const isInfinit = coatingId.startsWith("infinit");
  if (cert && isInfinit) {
    const all = [
      { id: "infinit1",   name: "infinit Base Type 1" },
      { id: "infinit2",   name: "infinit Base Type 2" },
      { id: "infinit-t1", name: "infinit TopCoat Type 1" },
      { id: "infinit-t2", name: "infinit TopCoat Type 2" },
    ];
    return layer === "2layer" ? all : all.slice(2);
  }
  const std = cert
    ? [
        { id: "one-evo", name: "ONE EVO" }, { id: "pure-evo", name: "PURE EVO" },
        { id: "mohs-evo", name: "MOHS EVO" }, { id: "cancoat-evo", name: "CanCoat EVO" },
        { id: "cancoat-evo-pro", name: "CanCoat EVO PRO" },
      ]
    : [
        { id: "one-evo", name: "ONE EVO" }, { id: "pure-evo", name: "PURE EVO" },
        { id: "mohs-evo", name: "MOHS EVO" }, { id: "cancoat-evo", name: "CanCoat EVO" },
      ];
  if (layer === "3layer") {
    return cert
      ? std.filter(t => t.id === "cancoat-evo" || t.id === "cancoat-evo-pro")
      : [{ id: "cancoat-evo", name: "CanCoat EVO" }];
  }
  return std;
}

// ── Navigation ────────────────────────────────────────────────────────────────

function nextScreen(cur: Screen, cats: CategoryId[]): Screen {
  const has = (c: CategoryId) => cats.includes(c);
  switch (cur) {
    case "category": return "step1";
    case "step1":
      if (has("coating") || has("ppf")) return "step2";
      if (has("window"))       return "step-window";
      if (has("maintenance"))  return "step-maintenance";
      if (has("carwash"))      return "step-carwash";
      if (has("roomclean"))    return "step-roomclean";
      if (has("other"))        return "step-other";
      return "step5";
    case "step2":
      if (has("coating")) return "step3";
      if (has("ppf"))     return "step-ppf";
      if (has("window"))  return "step-window";
      return "step5";
    case "step3": return "step4";
    case "step4":
      if (has("ppf"))         return "step-ppf";
      if (has("window"))      return "step-window";
      if (has("maintenance")) return "step-maintenance";
      if (has("carwash"))     return "step-carwash";
      if (has("roomclean"))   return "step-roomclean";
      if (has("other"))       return "step-other";
      return "step5";
    case "step-ppf":
      if (has("window"))       return "step-window";
      if (has("maintenance"))  return "step-maintenance";
      if (has("carwash"))      return "step-carwash";
      if (has("roomclean"))    return "step-roomclean";
      if (has("other"))        return "step-other";
      return "step5";
    case "step-window":
      if (has("maintenance"))  return "step-maintenance";
      if (has("carwash"))      return "step-carwash";
      if (has("roomclean"))    return "step-roomclean";
      if (has("other"))        return "step-other";
      return "step5";
    case "step-maintenance":
      if (has("carwash"))     return "step-carwash";
      if (has("roomclean"))   return "step-roomclean";
      if (has("other"))       return "step-other";
      return "step5";
    case "step-carwash":
      if (has("roomclean"))   return "step-roomclean";
      if (has("other"))       return "step-other";
      return "step5";
    case "step-roomclean":
      return has("other") ? "step-other" : "step5";
    default: return "step5";
  }
}

// ── Styles ────────────────────────────────────────────────────────────────────

const inp = "bg-[#0f172a] border border-slate-700 rounded-lg px-3 py-2.5 text-base sm:text-sm text-slate-100 placeholder-slate-600 focus:outline-none focus:border-[#1d4ed8] transition-colors w-full";
const lbl = "text-xs font-medium text-slate-400";

// ── Component ─────────────────────────────────────────────────────────────────

export interface EstimateWizardProps {
  customers:          CustomerDB[];
  vehicles:           VehicleDB[];
  dealerRank:         DetailerRank;
  defaultCustomerId?: string;
  onCancel?:          () => void;
  onSuccess?:         (estimateId?: string) => void;
}

export default function EstimateWizard({ customers, vehicles, dealerRank, defaultCustomerId, onCancel, onSuccess }: EstimateWizardProps) {

  const [history, setHistory] = useState<Screen[]>(["category"]);
  const screen = history[history.length - 1]!;
  const [error, setError]   = useState<string | null>(null);
  const [pending, startTx]  = useTransition();
  // Double-submit guards (Estimate Completion Sprint 5):
  //   submittingRef — synchronous in-flight lock; blocks re-entry into ANY create action
  //     before the pending re-render can disable the button (rapid double-clicks / repeats).
  //   submittedRef  — permanent lock set after a successful estimate save, so a completed
  //     estimate can never be submitted twice (e.g. enabled-looking button before unmount).
  const submittingRef = useRef(false);
  const submittedRef  = useRef(false);
  // Release the in-flight lock once the pending transition settles (success or error), so
  // the next step's create can run. The post-success estimate lock is NOT released here.
  useEffect(() => { if (!pending) submittingRef.current = false; }, [pending]);

  function push(s: Screen) { setHistory(h => [...h, s]); setError(null); }
  function pop()            { setHistory(h => h.length > 1 ? h.slice(0, -1) : h); setError(null); }

  // ── Category ──────────────────────────────────────────────────────────────
  const [cats, setCats] = useState<CategoryId[]>([]);
  const has = (c: CategoryId) => cats.includes(c);
  function toggleCat(id: CategoryId) {
    setCats(p => p.includes(id) ? p.filter(c => c !== id) : [...p, id]);
  }

  // ── Customer ──────────────────────────────────────────────────────────────
  const _defaultCust = defaultCustomerId ? customers.find(c => c.id === defaultCustomerId) : null;
  const [cMode,                 setCMode]                 = useState<"select" | "create">("select");
  const [customerId,            setCustomerId]            = useState(_defaultCust?.id ?? "");
  const [wizardCreatedCustomerId, setWizardCreatedCustomerId] = useState("");
  const [custLabel,  setCustLabel]  = useState(
    _defaultCust ? [_defaultCust.last_name, _defaultCust.first_name].filter(Boolean).join(" ") : ""
  );
  const [searchQ,    setSearchQ]    = useState("");
  const [isDealer,   setIsDealer]   = useState(false);
  const [dealerRate, setDealerRate] = useState(70);
  const [nc, setNc] = useState({
    last_name: "", first_name: "", last_name_kana: "", first_name_kana: "",
    phone: "", email: "", line_user_id: "", address: "",
  });

  type OcrStage = "idle" | "upload" | "review";
  const [ocrStage,   setOcrStage]   = useState<OcrStage>("idle");
  const [pendingOcr, setPendingOcr] = useState<VehicleRegistrationOcrResult | null>(null);
  const [ocrVehicle, setOcrVehicle] = useState<Partial<VehicleRegistrationOcrResult> | null>(null);

  const matchedCusts = customers.filter(c => {
    if (!searchQ) return true;
    const q  = searchQ.toLowerCase();
    const cv = vehicles.filter(v => v.customer_id === c.id);
    return (
      [c.last_name, c.first_name, c.last_name_kana, c.first_name_kana].filter(Boolean).join(" ").toLowerCase().includes(q) ||
      (c.phone?.toLowerCase().includes(q) ?? false) ||
      cv.some(v => [v.maker, v.model, v.plate_number].filter(Boolean).join(" ").toLowerCase().includes(q))
    );
  });

  // ── Vehicle ───────────────────────────────────────────────────────────────
  const [vMode,     setVMode]     = useState<"select" | "create">("select");
  const [vehicleId, setVehicleId] = useState("");
  const [vehLabel,  setVehLabel]  = useState("");
  const [nv, setNv] = useState({
    maker: "", model: "", grade: "", vehicle_code: "", year: "", color: "", plate_number: "", vin: "",
    inspection_expiry_date: "",
    displacement: "", fuel_type: "", registration_date: "",
  });

  const custVehicles = vehicles.filter(v => v.customer_id === customerId);

  // Pre-fill vehicle fields from OCR as soon as the OCR result is applied. Keyed on the
  // OCR result (not the body-size screen) so the data reaches the new-vehicle form for
  // EVERY service flow — previously only coating/PPF (the flows that have a step2 screen)
  // received it, and other flows lost the OCR vehicle data. Firing on apply also lets the
  // user review/correct the fields in step1 before saving. Merge-only, so manual edits
  // made after OCR are preserved (the effect re-runs only when a new OCR result arrives).
  useEffect(() => {
    if (!ocrVehicle || vMode !== "create") return;
    setNv(p => {
      const u = { ...p };
      if (ocrVehicle.maker)                   u.maker             = ocrVehicle.maker;
      if (ocrVehicle.vehicle_name)            u.model             = ocrVehicle.vehicle_name;
      if (ocrVehicle.model)                   u.vehicle_code      = ocrVehicle.model;
      if (ocrVehicle.grade)                   u.grade             = ocrVehicle.grade;
      if (ocrVehicle.chassis_number)          u.vin               = ocrVehicle.chassis_number;
      if (ocrVehicle.color)                   u.color             = ocrVehicle.color;
      if (ocrVehicle.displacement)            u.displacement      = ocrVehicle.displacement;
      if (ocrVehicle.fuel_type)               u.fuel_type         = ocrVehicle.fuel_type;
      if (ocrVehicle.inspection_expiry_date)  u.inspection_expiry_date = ocrVehicle.inspection_expiry_date;
      if (ocrVehicle.first_registration_date) {
        u.year              = ocrVehicle.first_registration_date.slice(0, 4);
        // Convert YYYY-MM to YYYY-MM-01 for the date column
        u.registration_date = ocrVehicle.first_registration_date.length === 7
          ? ocrVehicle.first_registration_date + "-01"
          : ocrVehicle.first_registration_date;
      }
      const plate = [
        ocrVehicle.license_plate_region, ocrVehicle.license_plate_class,
        ocrVehicle.license_plate_kana,   ocrVehicle.license_plate_number,
      ].filter(Boolean).join(" ");
      if (plate) u.plate_number = plate;
      return u;
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ocrVehicle]);

  // ── Body size ─────────────────────────────────────────────────────────────
  const [sizeKey, setSizeKey] = useState("M");

  // ── Coating ───────────────────────────────────────────────────────────────
  // rank is server-controlled (Admin-assigned). Never from client state.
  const rank     = dealerRank;
  const [coatId,    setCoatId]    = useState<CoatingId | "">("");
  const [layerMode, setLayerMode] = useState<LayerMode>("none");
  const [topcoat2,  setTopcoat2]  = useState("");
  const [topcoat3,  setTopcoat3]  = useState("");

  const isCert   = meetsTier(rank, "certified");
  const visCoats = COATINGS.filter(c => !c.certOnly || isCert);
  const tc2Opts  = coatId ? topcoatOpts(coatId, layerMode, isCert) : [];
  const tc3Opts  = coatId && layerMode === "3layer" && topcoat2
    ? topcoatOpts(coatId, "3layer", isCert).filter(t => t.id !== topcoat2)
    : [];

  useEffect(() => { setTopcoat2(""); setTopcoat3(""); }, [coatId, layerMode]);
  useEffect(() => { if (nv.maker) setPpfVehicleRank(detectPpfRank(nv.maker)); }, [nv.maker]);

  // ── Options ───────────────────────────────────────────────────────────────
  const [selOpts, setSelOpts] = useState<string[]>([]);

  // ── Maintenance / Carwash / Room Clean / Window / Other ─────────────────
  const [maintenanceSel, setMaintenanceSel] = useState<string[]>([]);
  const [carwashSel,     setCarwashSel]     = useState<string[]>([]);
  const [roomCleanSel,   setRoomCleanSel]   = useState<string[]>([]);
  const [roomCleanCond,  setRoomCleanCond]  = useState<string>("normal");
  const [windowPartSel,  setWindowPartSel]  = useState<string[]>([]);
  const [windowGrade,    setWindowGrade]    = useState<string>("standard");
  const [ppfPlan,        setPpfPlan]        = useState<string>("");
  const [ppfFilmType,    setPpfFilmType]    = useState<string>("clear");
  const [ppfVehicleRank, setPpfVehicleRank] = useState<string>("std");
  const [ppfFrontGlass,  setPpfFrontGlass]  = useState<string>("");
  const [ppfSingleParts, setPpfSingleParts] = useState<{ id: string; qty: number }[]>([]);
  const [otherItems, setOtherItems] = useState<{ id: string; name: string; price: number }[]>([]);
  const [otherName,  setOtherName]  = useState("");
  const [otherPrice, setOtherPrice] = useState("");

  // ── Confirmation ──────────────────────────────────────────────────────────
  const [previewNo,       setPreviewNo]      = useState("");
  const [notes,           setNotes]          = useState("");
  const [appliedCoupons,  setAppliedCoupons] = useState<boolean[]>(DEFAULT_COUPONS.map(() => false));
  const [extraDisc,       setExtraDisc]      = useState("0");
  const [taxRate,         setTaxRate]        = useState(10);

  useEffect(() => {
    if (screen === "step5") {
      previewDocumentNumber("estimate").then(p => setPreviewNo(p ?? "")).catch(() => {});
    }
  }, [screen]);

  // ── Pricing Engine ────────────────────────────────────────────────────────
  const serviceInputs: ServiceInput[] = [];
  if (has("coating") && coatId)
    serviceInputs.push({ type: "coating", coatingId: coatId, sizeKey, topcoat2: topcoat2 || undefined, topcoat3: topcoat3 || undefined, optionIds: selOpts });
  if (has("ppf") && ppfPlan)
    serviceInputs.push({
      type:        "ppf",
      planId:      ppfPlan,
      filmType:    ppfFilmType,
      vehicleRank: ppfVehicleRank,
      sizeKey,
      frontGlass:  ppfFrontGlass  || undefined,
      singleParts: ppfSingleParts.filter(sp => sp.qty > 0),
    });
  if (has("window"))
    serviceInputs.push({ type: "window", partIds: windowPartSel, grade: windowGrade });
  if (has("maintenance") && maintenanceSel.length > 0)
    serviceInputs.push({ type: "maintenance", menuIds: maintenanceSel });
  if (has("carwash") && carwashSel.length > 0)
    serviceInputs.push({ type: "carwash", menuIds: carwashSel });
  if (has("roomclean") && roomCleanSel.length > 0)
    serviceInputs.push({ type: "roomclean", partIds: roomCleanSel, condition: roomCleanCond });
  if (has("other") && otherItems.length > 0)
    serviceInputs.push({ type: "other", items: otherItems });

  const couponDisc  = DEFAULT_COUPONS.reduce((s, c, i) => s + (appliedCoupons[i] ? c.amount : 0), 0);
  const extraDiscN  = Number(extraDisc) || 0;
  const estCalc     = calculateEstimate(
    serviceInputs,
    { couponTotal: couponDisc, extraAmount: extraDiscN, isDealer, dealerRate },
    taxRate,
  );

  const { subtotal, couponDiscount, extraDiscount, dealerDiscount, taxableAmount, taxAmount, total } = estCalc;
  const dealerDisc = dealerDiscount;
  const afterDisc  = taxableAmount;
  const taxAmt     = taxAmount;
  // Discount-breakdown consistency: when the configured discounts exceed the subtotal,
  // the applied discount is capped at the subtotal and the payable is clamped to ¥0
  // (matches the server / saved / PDF). The breakdown lines stay informational; a note
  // makes the clamp explicit so the displayed lines are never misleading.
  const combinedDiscount = couponDisc + extraDiscN + dealerDisc;
  const overDiscounted   = combinedDiscount > subtotal;

  // Per-service display values derived from engine
  const coatSvc      = estCalc.services.find(s => s.type === "coating");
  const coatItems    = coatSvc?.lineItems ?? [];
  const cPrice       = coatItems[0]?.unit_price ?? 0;
  const tc2P         = topcoat2 ? (coatItems[1]?.unit_price ?? 0) : 0;
  const tc3P         = topcoat3 ? (coatItems[2]?.unit_price ?? 0) : 0;
  const optTot       = (coatSvc?.subtotal ?? 0) - cPrice - tc2P - tc3P;
  const maintTot     = estCalc.services.find(s => s.type === "maintenance")?.subtotal ?? 0;
  const carwashTot   = estCalc.services.find(s => s.type === "carwash")?.subtotal    ?? 0;
  const roomCleanTot = estCalc.services.find(s => s.type === "roomclean")?.subtotal  ?? 0;
  const otherTot     = estCalc.services.find(s => s.type === "other")?.subtotal      ?? 0;
  const rcCondCoeff  = ROOM_CLEAN_CONDITIONS.find(c => c.id === roomCleanCond)?.coeff ?? 1.0;
  const wfGradeCoeff = WINDOW_FILM_GRADES.find(g => g.id === windowGrade)?.coeff ?? 1.0;
  const windowTot    = estCalc.services.find(s => s.type === "window")?.subtotal ?? 0;
  const ppfSvc        = estCalc.services.find(s => s.type === "ppf");
  const ppfTot        = ppfSvc?.subtotal ?? 0;
  const windowSvc     = estCalc.services.find(s => s.type === "window");
  const roomCleanSvc  = estCalc.services.find(s => s.type === "roomclean");

  // ── OCR ───────────────────────────────────────────────────────────────────
  function applyOcr(sel: Partial<VehicleRegistrationOcrResult>) {
    const raw = sel.owner_name || sel.user_name || "";
    if (raw) {
      const parts = raw.trim().split(/\s+/);
      setNc(p => ({ ...p, last_name: parts[0] ?? p.last_name, first_name: parts.slice(1).join(" ") || p.first_name }));
    }
    const addr = sel.owner_address || sel.user_address || "";
    if (addr) setNc(p => ({ ...p, address: addr }));
    setOcrVehicle(sel);
    setOcrStage("idle"); setPendingOcr(null);
  }

  // ── Navigation handlers ───────────────────────────────────────────────────
  function handleCategoryNext() {
    if (cats.length === 0) { setError("1つ以上選択してください"); return; }
    push("step1");
  }

  function handleStep1Next() {
    setError(null);
    if (cMode === "select") {
      if (!customerId) { setError("顧客を選択してください"); return; }
      if (vMode === "select" && custVehicles.length > 0 && !vehicleId) { setError("車両を選択してください"); return; }
      if (vMode === "select" && custVehicles.length === 0) setVMode("create");
      push(nextScreen("step1", cats));
      return;
    }
    if (!nc.last_name) { setError("お客様名（姓）は必須です"); return; }
    // Reuse customer created earlier in this session — prevents duplicate on back-navigation
    if (wizardCreatedCustomerId) {
      setCustomerId(wizardCreatedCustomerId);
      setVMode("create");
      push(nextScreen("step1", cats));
      return;
    }
    if (submittingRef.current) return;
    submittingRef.current = true;
    startTx(async () => {
      const fd = new FormData();
      fd.set("last_name",       nc.last_name);
      fd.set("first_name",      nc.first_name);
      fd.set("last_name_kana",  nc.last_name_kana);
      fd.set("first_name_kana", nc.first_name_kana);
      fd.set("phone",           nc.phone);
      fd.set("email",           nc.email);
      fd.set("line_user_id",    nc.line_user_id);
      fd.set("address1",        nc.address);
      fd.set("is_business",        isDealer ? "true" : "false");
      fd.set("trade_discount_pct", isDealer ? String(dealerRate) : "0");
      const r = await createCustomer(fd);
      if ("error" in r) { setError(r.error ?? "顧客の作成に失敗しました"); return; }
      const cid = "customerId" in r ? r.customerId : undefined;
      if (!cid) { setError("顧客IDの取得に失敗しました"); return; }
      setWizardCreatedCustomerId(cid);
      setCustomerId(cid);
      setCustLabel(`${nc.last_name} ${nc.first_name}`.trim());
      setVMode("create");
      push(nextScreen("step1", cats));
    });
  }

  function handleStep2Next() {
    push(nextScreen("step2", cats));
  }

  function handleStep3Next() {
    if (!coatId) { setError("コーティングを選択してください"); return; }
    if (layerMode !== "none" && !topcoat2) { setError("トップコートを選択してください"); return; }
    push("step4");
  }

  function handleStep4Next() {
    if (vMode === "create" && !vehicleId) {
      if (submittingRef.current) return;
      submittingRef.current = true;
      startTx(async () => {
        if (!customerId) { setError("顧客が未設定です"); return; }
        const fd = new FormData();
        fd.set("customer_id",  customerId);
        fd.set("maker",        nv.maker);
        fd.set("model",        nv.model);
        fd.set("grade",        nv.grade);
        fd.set("vehicle_code", nv.vehicle_code);
        fd.set("year",         nv.year);
        fd.set("color",        nv.color);
        fd.set("plate_number",           nv.plate_number);
        fd.set("vin",                    nv.vin);
        fd.set("body_size",              sizeKey);
        fd.set("inspection_expiry_date", nv.inspection_expiry_date);
        fd.set("displacement",           nv.displacement);
        fd.set("fuel_type",              nv.fuel_type);
        fd.set("registration_date",      nv.registration_date);
        const r = await createVehicle(fd);
        if ("error" in r) { setError(r.error ?? "車両の作成に失敗しました"); return; }
        const vid = "vehicleId" in r ? r.vehicleId : undefined;
        if (!vid) { setError("車両IDの取得に失敗しました"); return; }
        setVehicleId(vid);
        setVehLabel([nv.maker, nv.model, nv.plate_number].filter(Boolean).join(" ") || "新規車両");
        push(nextScreen("step4", cats));
      });
    } else {
      push(nextScreen("step4", cats));
    }
  }

  function handleSave() {
    if (!customerId) { setError("顧客が未設定です"); return; }
    // Block double-submit and any re-submit after a successful save.
    if (submittingRef.current || submittedRef.current) return;
    submittingRef.current = true;
    const items = buildLineItems(serviceInputs);

    startTx(async () => {
      // Create vehicle here for maintenance/carwash/other flows that bypass step4
      let resolvedVehicleId = vehicleId;
      if (!resolvedVehicleId && vMode === "create") {
        const vfd = new FormData();
        vfd.set("customer_id",            customerId);
        vfd.set("maker",                  nv.maker);
        vfd.set("model",                  nv.model);
        vfd.set("grade",                  nv.grade);
        vfd.set("vehicle_code",           nv.vehicle_code);
        vfd.set("year",                   nv.year);
        vfd.set("color",                  nv.color);
        vfd.set("plate_number",           nv.plate_number);
        vfd.set("vin",                    nv.vin);
        vfd.set("body_size",              sizeKey);
        vfd.set("inspection_expiry_date", nv.inspection_expiry_date);
        vfd.set("displacement",           nv.displacement);
        vfd.set("fuel_type",              nv.fuel_type);
        vfd.set("registration_date",      nv.registration_date);
        const vr = await createVehicle(vfd);
        if ("error" in vr) { setError(vr.error ?? "車両の作成に失敗しました"); return; }
        const vid = "vehicleId" in vr ? vr.vehicleId : undefined;
        if (!vid) { setError("車両IDの取得に失敗しました"); return; }
        setVehicleId(vid);
        setVehLabel([nv.maker, nv.model, nv.plate_number].filter(Boolean).join(" ") || "新規車両");
        resolvedVehicleId = vid;
      }

      const fd = new FormData();
      fd.set("customer_id",     customerId);
      fd.set("vehicle_id",      resolvedVehicleId ?? "");
      fd.set("status",          "sent");
      fd.set("tax_rate",        String(taxRate));
      fd.set("discount_amount", String(couponDisc + extraDiscN + dealerDisc));
      fd.set("notes",           notes);
      fd.set("subtotal",        String(subtotal));
      fd.set("tax_amount",      String(taxAmt));
      fd.set("total",           String(total));
      fd.set("items_json",      JSON.stringify(items));
      const r = await createEstimate(fd);
      if (r?.error) { setError(r.error); return; }
      // Permanently lock further submits — the estimate is created (cannot submit twice).
      submittedRef.current = true;
      onSuccess?.("estimateId" in r ? r.estimateId : undefined);
    });
  }

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="flex flex-col gap-5">

      <p className="text-xs font-semibold text-slate-400 tracking-wide uppercase">{SCREEN_LABEL[screen]}</p>

      {error && (
        <div className="bg-red-900/30 border border-red-700 rounded-lg px-3 py-2">
          <p className="text-xs text-red-400">{error}</p>
        </div>
      )}

      {/* ══ CATEGORY ══ */}
      {screen === "category" && (
        <div className="flex flex-col gap-3">
          <p className={lbl}>施工カテゴリを選択（複数可）</p>
          <div className="grid grid-cols-2 gap-2">
            {CATEGORIES.map(cat => {
              const sel = has(cat.id);
              return (
                <button key={cat.id} type="button" onClick={() => toggleCat(cat.id)}
                  className={`flex items-center gap-3 px-4 py-4 rounded-xl border text-left transition-all ${sel ? "bg-blue-950/40 border-[#1d4ed8]/60 text-slate-100" : "bg-[#0f172a] border-slate-700 text-slate-400 hover:border-slate-500 hover:text-slate-200"}`}>
                  <span className="text-xl shrink-0">{cat.emoji}</span>
                  <span className="text-sm font-medium leading-tight">{cat.label}</span>
                  {sel && <span className="ml-auto text-[#1d4ed8] font-bold">✓</span>}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* ══ STEP1 Customer + Vehicle ══ */}
      {screen === "step1" && (
        <div className="flex flex-col gap-5">

          {/* Customer */}
          <div className="flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-slate-200">お客様情報</h3>
              <div className="flex gap-1.5">
                {(["select", "create"] as const).map(m => (
                  <button key={m} type="button" onClick={() => setCMode(m)}
                    className={cMode === m ? "text-xs px-3 py-1.5 rounded-lg bg-[#1d4ed8] text-white font-medium" : "text-xs px-3 py-1.5 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-700 transition-colors"}>
                    {m === "select" ? "既存顧客" : "新規登録"}
                  </button>
                ))}
              </div>
            </div>

            {cMode === "select" && (
              <div className="flex flex-col gap-2">
                <div className="relative">
                  <input type="text" value={searchQ} onChange={e => setSearchQ(e.target.value)} placeholder="氏名・電話番号・車両で検索..." className={inp} />
                  {searchQ && <button type="button" onClick={() => setSearchQ("")} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 text-xs">✕</button>}
                </div>
                <div className="flex flex-col border border-slate-700 rounded-lg max-h-44 overflow-y-auto">
                  {matchedCusts.length === 0
                    ? <div className="py-4 text-center text-xs text-slate-600">{searchQ ? "見つかりません" : "顧客が登録されていません"}</div>
                    : matchedCusts.map(c => {
                        const name = [c.last_name, c.first_name].filter(Boolean).join(" ");
                        const cv   = vehicles.filter(v => v.customer_id === c.id);
                        return (
                          <button key={c.id} type="button"
                            onClick={() => {
                              setCustomerId(c.id);
                              setCustLabel(name);
                              setVehicleId("");
                              // Apply business customer discount from DB (migration 073)
                              if (c.is_business) {
                                setIsDealer(true);
                                setDealerRate(c.trade_discount_pct ?? 70);
                              } else {
                                setIsDealer(false);
                                setDealerRate(70);
                              }
                            }}
                            className={`w-full text-left px-4 py-3 border-t border-slate-700/40 first:border-t-0 transition-colors ${customerId === c.id ? "bg-blue-950/30" : "hover:bg-slate-800/40"}`}>
                            <p className="text-sm text-slate-200">{name}</p>
                            {c.phone && <p className="text-xs text-slate-500">{c.phone}</p>}
                            {cv.length > 0 && <p className="text-[10px] text-slate-600 mt-0.5">{cv.map(v => [v.maker, v.model].filter(Boolean).join(" ")).join(" / ")}</p>}
                          </button>
                        );
                      })
                  }
                </div>
              </div>
            )}

            {cMode === "create" && (
              <div className="flex flex-col gap-3">
                <button type="button" onClick={() => setOcrStage("upload")}
                  className="self-start text-xs px-3 py-1.5 rounded-lg text-blue-400 border border-blue-500/30 bg-blue-500/5 hover:bg-blue-500/10 transition-colors">
                  📄 車検証から自動入力（OCR）
                </button>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="flex flex-col gap-1">
                    <label className={lbl}>お客様名（姓）<span className="text-red-400"> *</span></label>
                    <input type="text" value={nc.last_name} onChange={e => setNc(p => ({ ...p, last_name: e.target.value }))} placeholder="山田" className={inp} />
                  </div>
                  <div className="flex flex-col gap-1">
                    <label className={lbl}>名</label>
                    <input type="text" value={nc.first_name} onChange={e => setNc(p => ({ ...p, first_name: e.target.value }))} placeholder="太郎" className={inp} />
                  </div>
                  <div className="flex flex-col gap-1">
                    <label className={lbl}>電話番号</label>
                    <input type="tel" value={nc.phone} onChange={e => setNc(p => ({ ...p, phone: e.target.value }))} placeholder="090-0000-0000" className={inp} />
                  </div>
                  <div className="flex flex-col gap-1">
                    <label className={lbl}>LINE ID</label>
                    <input type="text" value={nc.line_user_id} onChange={e => setNc(p => ({ ...p, line_user_id: e.target.value }))} placeholder="LINE ID" className={inp} />
                  </div>
                  <div className="col-span-2 flex flex-col gap-1">
                    <label className={lbl}>住所</label>
                    <input type="text" value={nc.address} onChange={e => setNc(p => ({ ...p, address: e.target.value }))} placeholder="都道府県・市区町村・番地" className={inp} />
                  </div>
                </div>
                <div className="flex items-center gap-3 flex-wrap">
                  <button type="button" onClick={() => setIsDealer(v => !v)}
                    className={`w-4 h-4 rounded border-2 shrink-0 flex items-center justify-center transition-colors ${isDealer ? "bg-[#1d4ed8] border-[#1d4ed8]" : "border-slate-600"}`}>
                    {isDealer && <span className="text-white text-[10px]">✓</span>}
                  </button>
                  <span className="text-sm text-slate-300">業者（業販）</span>
                  {isDealer && (
                    <div className="flex items-center gap-1.5 ml-2">
                      <label className={lbl}>掛け率</label>
                      <input type="number" value={dealerRate} onChange={e => setDealerRate(Number(e.target.value))} min="0" max="100"
                        className="w-16 bg-[#0f172a] border border-slate-700 rounded px-2 py-1 text-sm text-slate-100 focus:outline-none focus:border-[#1d4ed8]" />
                      <span className="text-slate-400 text-sm">%</span>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          <div className="border-t border-slate-700/50" />

          {/* Vehicle */}
          <div className="flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-slate-200">車両情報</h3>
              <div className="flex gap-1.5">
                <button type="button" onClick={() => setVMode("select")} disabled={custVehicles.length === 0}
                  className={`text-xs px-3 py-1.5 rounded-lg transition-colors disabled:opacity-30 ${vMode === "select" ? "bg-[#1d4ed8] text-white font-medium" : "text-slate-400 hover:text-slate-200 hover:bg-slate-700"}`}>
                  登録済み
                </button>
                <button type="button" onClick={() => setVMode("create")}
                  className={`text-xs px-3 py-1.5 rounded-lg transition-colors ${vMode === "create" ? "bg-[#1d4ed8] text-white font-medium" : "text-slate-400 hover:text-slate-200 hover:bg-slate-700"}`}>
                  新規登録
                </button>
              </div>
            </div>

            {vMode === "select" && (
              custVehicles.length === 0
                ? <p className="text-xs text-slate-500">顧客を選択してください（または「新規登録」）</p>
                : <div className="flex flex-col gap-2">
                    {custVehicles.map(v => {
                      const label = [v.maker, v.model, v.plate_number].filter(Boolean).join(" ") || v.id;
                      return (
                        <button key={v.id} type="button" onClick={() => { setVehicleId(v.id); setVehLabel(label); if (v.maker) setPpfVehicleRank(detectPpfRank(v.maker)); }}
                          className={`w-full text-left px-4 py-3 rounded-lg border transition-colors ${vehicleId === v.id ? "bg-blue-950/30 border-[#1d4ed8]/50" : "bg-[#0f172a] border-slate-700 hover:border-slate-500"}`}>
                          <p className="text-sm text-slate-200">{label}</p>
                          {v.year && <p className="text-xs text-slate-500">{v.year}年式{v.color ? ` ${v.color}` : ""}</p>}
                        </button>
                      );
                    })}
                  </div>
            )}

            {vMode === "create" && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {ocrVehicle && (
                  <div className="col-span-2 text-xs text-emerald-400 border border-emerald-500/30 rounded-lg px-3 py-2 bg-emerald-950/20">
                    ✓ 車検証OCRデータ引用済み — 内容を確認してください
                  </div>
                )}
                <div className="flex flex-col gap-1">
                  <label className={lbl}>メーカー</label>
                  <input type="text" value={nv.maker} onChange={e => setNv(p => ({ ...p, maker: e.target.value }))} placeholder="Toyota" className={inp} />
                </div>
                <div className="flex flex-col gap-1">
                  <label className={lbl}>車種</label>
                  <input type="text" value={nv.model} onChange={e => setNv(p => ({ ...p, model: e.target.value }))} placeholder="Prius" className={inp} />
                </div>
                <div className="flex flex-col gap-1">
                  <label className={lbl}>グレード</label>
                  <input type="text" value={nv.grade} onChange={e => setNv(p => ({ ...p, grade: e.target.value }))} placeholder="Z" className={inp} />
                </div>
                <div className="flex flex-col gap-1">
                  <label className={lbl}>型式</label>
                  <input type="text" value={nv.vehicle_code} onChange={e => setNv(p => ({ ...p, vehicle_code: e.target.value }))} placeholder="ZVW50" className={inp} />
                </div>
                <div className="flex flex-col gap-1">
                  <label className={lbl}>年式</label>
                  <input type="text" value={nv.year} onChange={e => setNv(p => ({ ...p, year: e.target.value }))} placeholder="2023" className={inp} />
                </div>
                <div className="flex flex-col gap-1">
                  <label className={lbl}>カラー</label>
                  <input type="text" value={nv.color} onChange={e => setNv(p => ({ ...p, color: e.target.value }))} placeholder="ホワイト" className={inp} />
                </div>
                <div className="col-span-2 flex flex-col gap-1">
                  <label className={lbl}>ナンバー</label>
                  <input type="text" value={nv.plate_number} onChange={e => setNv(p => ({ ...p, plate_number: e.target.value }))} placeholder="品川 300 あ 1234" className={inp} />
                </div>
                <div className="col-span-2 flex flex-col gap-1">
                  <label className={lbl}>車台番号（VIN）</label>
                  <input type="text" value={nv.vin} onChange={e => setNv(p => ({ ...p, vin: e.target.value }))} placeholder="ZVW5000000000" className={inp} />
                </div>
                <div className="col-span-2 flex flex-col gap-1">
                  <label className={lbl}>車検満了日</label>
                  <input type="date" value={nv.inspection_expiry_date} onChange={e => setNv(p => ({ ...p, inspection_expiry_date: e.target.value }))} className={inp} />
                </div>
              </div>
            )}
          </div>

          {/* OCR modal */}
          {ocrStage !== "idle" && (
            <div className="fixed inset-0 z-[60] flex items-start justify-center p-3 sm:p-4 overflow-y-auto bg-black/60" onClick={() => { setOcrStage("idle"); setPendingOcr(null); }}>
              <div className="bg-[#1e293b] border border-slate-700 rounded-xl shadow-xl w-full max-w-lg p-5 sm:p-6 my-4" onClick={e => e.stopPropagation()}>
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-sm font-semibold text-slate-100">{ocrStage === "upload" ? "車検証を読み取る" : "読み取り結果を確認"}</h3>
                  <button type="button" onClick={() => { setOcrStage("idle"); setPendingOcr(null); }} className="w-9 h-9 flex items-center justify-center rounded-md text-slate-500 hover:text-slate-200 hover:bg-slate-700/50 text-lg">✕</button>
                </div>
                {ocrStage === "upload" && (
                  <VehicleRegistrationUpload
                    onComplete={r => { setPendingOcr(r); setOcrStage("review"); }}
                    onCancel={() => { setOcrStage("idle"); setPendingOcr(null); }}
                  />
                )}
                {ocrStage === "review" && pendingOcr && (
                  <VehicleRegistrationOcrReview
                    ocrResult={pendingOcr}
                    onApply={applyOcr}
                    onCancel={() => { setOcrStage("idle"); setPendingOcr(null); }}
                  />
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ══ STEP2 Body size ══ */}
      {screen === "step2" && (
        <div className="flex flex-col gap-3">
          <p className={lbl}>ボディサイズを選択してください</p>
          <div className="grid grid-cols-2 gap-2">
            {BODY_SIZES.map(s => {
              const price = has("coating") && coatId ? Math.round((COATINGS.find(c => c.id === coatId)?.base ?? 0) * (BODY_SIZES.find(b => b.key === s.key)?.multi ?? 1.0)) : null;
              const isSel = sizeKey === s.key;
              return (
                <button key={s.key} type="button" onClick={() => setSizeKey(s.key)}
                  className={`flex items-center gap-3 px-4 py-4 rounded-xl border text-left transition-all ${isSel ? "bg-blue-950/40 border-[#1d4ed8]/60" : "bg-[#0f172a] border-slate-700 hover:border-slate-500"}`}>
                  <div className="min-w-0">
                    <p className={`text-base font-bold ${isSel ? "text-white" : "text-slate-200"}`}>{s.key}</p>
                    <p className="text-xs text-slate-500">{s.name}</p>
                    {price !== null && <p className="text-xs text-blue-400 font-medium mt-0.5">¥{price.toLocaleString("ja-JP")}</p>}
                  </div>
                  {isSel && <span className="ml-auto text-[#1d4ed8] font-bold">✓</span>}
                </button>
              );
            })}
          </div>
          {has("coating") && coatId && (
            <p className="text-xs text-slate-600">係数 ×{BODY_SIZES.find(s => s.key === sizeKey)?.multi ?? 1.0} / {COATINGS.find(c => c.id === coatId)?.name}</p>
          )}
        </div>
      )}

      {/* ══ STEP3 Coating ══ */}
      {screen === "step3" && (
        <div className="flex flex-col gap-4">
          {/* Read-only rank badge — Admin-assigned, dealer cannot change */}
          <div className="flex items-center gap-2 px-3 py-2 rounded-lg border border-slate-700 bg-[#0f172a]">
            <span className="text-sm">{rankEmoji(rank)}</span>
            <span className="text-sm text-slate-300">
              {rankLabelJa(rank)}
            </span>
            <span className="text-[10px] text-slate-500 ml-auto">管理者設定ランク</span>
          </div>

          <div className="flex flex-col gap-2">
            {visCoats.map(c => {
              const price = Math.round(c.base * (BODY_SIZES.find(b => b.key === sizeKey)?.multi ?? 1.0));
              const isSel = coatId === c.id;
              const gc = c.grade === "CERTIFIED" ? "border-amber-500/50 text-amber-400 bg-amber-950/20"
                : c.grade === "プレミアム" ? "border-purple-500/50 text-purple-400"
                : c.grade === "スタンダード" ? "border-blue-500/50 text-blue-400"
                : "border-slate-600 text-slate-500";
              return (
                <button key={c.id} type="button" onClick={() => setCoatId(c.id)}
                  className={`flex items-center justify-between px-4 py-4 rounded-xl border text-left transition-all ${isSel ? "bg-blue-950/40 border-[#1d4ed8]/60" : "bg-[#0f172a] border-slate-700 hover:border-slate-500"}`}>
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-sm font-semibold text-slate-100">{c.name}</span>
                      <span className={`text-[10px] px-2 py-0.5 rounded-full border ${gc}`}>{c.grade}</span>
                    </div>
                    <p className="text-sm font-medium text-blue-400">¥{price.toLocaleString("ja-JP")}</p>
                  </div>
                  {isSel && <span className="text-[#1d4ed8] font-bold text-lg ml-4">✓</span>}
                </button>
              );
            })}
          </div>

          {coatId && (
            <div className="flex flex-col gap-2">
              <label className={lbl}>レイヤー構成</label>
              <div className="flex gap-2">
                {(["none", "2layer", ...(coatId !== "syncro-evo" ? ["3layer"] : [])] as LayerMode[]).map(lm => (
                  <button key={lm} type="button" onClick={() => setLayerMode(lm)}
                    className={`px-4 py-2 text-sm font-medium rounded-lg border transition-colors ${layerMode === lm ? "bg-[#1d4ed8] border-[#1d4ed8] text-white" : "bg-[#0f172a] border-slate-700 text-slate-400 hover:border-slate-500"}`}>
                    {lm === "none" ? "単層" : lm === "2layer" ? "2層" : "3層"}
                  </button>
                ))}
              </div>
            </div>
          )}

          {coatId && layerMode !== "none" && tc2Opts.length > 0 && (
            <div className="flex flex-col gap-2">
              <label className={lbl}>2層目トップコート <span className="text-red-400">*</span></label>
              {tc2Opts.map(t => {
                const p = Math.round((TOPCOAT_BASE[t.id] ?? 0) * (BODY_SIZES.find(b => b.key === sizeKey)?.multi ?? 1.0));
                return (
                  <button key={t.id} type="button" onClick={() => setTopcoat2(t.id)}
                    className={`flex items-center justify-between px-4 py-3 rounded-lg border text-left transition-colors ${topcoat2 === t.id ? "bg-blue-950/30 border-[#1d4ed8]/50" : "bg-[#0f172a] border-slate-700 hover:border-slate-600"}`}>
                    <span className="text-sm text-slate-200">{t.name}</span>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-blue-400">+¥{p.toLocaleString("ja-JP")}</span>
                      {topcoat2 === t.id && <span className="text-[#1d4ed8]">✓</span>}
                    </div>
                  </button>
                );
              })}
            </div>
          )}

          {coatId && layerMode === "3layer" && topcoat2 && tc3Opts.length > 0 && (
            <div className="flex flex-col gap-2">
              <label className={lbl}>3層目トップコート</label>
              {tc3Opts.map(t => {
                const p = Math.round((TOPCOAT_BASE[t.id] ?? 0) * (BODY_SIZES.find(b => b.key === sizeKey)?.multi ?? 1.0));
                return (
                  <button key={t.id} type="button" onClick={() => setTopcoat3(t.id)}
                    className={`flex items-center justify-between px-4 py-3 rounded-lg border text-left transition-colors ${topcoat3 === t.id ? "bg-blue-950/30 border-[#1d4ed8]/50" : "bg-[#0f172a] border-slate-700 hover:border-slate-600"}`}>
                    <span className="text-sm text-slate-200">{t.name}</span>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-blue-400">+¥{p.toLocaleString("ja-JP")}</span>
                      {topcoat3 === t.id && <span className="text-[#1d4ed8]">✓</span>}
                    </div>
                  </button>
                );
              })}
            </div>
          )}

          {coatId && (
            <div className="border border-slate-700 rounded-lg px-4 py-3 flex justify-between">
              <span className="text-xs text-slate-500">コーティング小計</span>
              <span className="text-sm font-semibold text-slate-100">¥{(cPrice + tc2P + tc3P).toLocaleString("ja-JP")}</span>
            </div>
          )}
        </div>
      )}

      {/* ══ STEP4 Options ══ */}
      {screen === "step4" && (
        <div className="flex flex-col gap-3">
          <p className={lbl}>追加オプション（任意・スキップ可）</p>
          {COATING_OPTIONS.map(opt => {
            const checked = selOpts.includes(opt.id);
            return (
              <button key={opt.id} type="button"
                onClick={() => setSelOpts(p => checked ? p.filter(id => id !== opt.id) : [...p, opt.id])}
                className={`flex items-center gap-3 px-4 py-3 rounded-lg border transition-colors ${checked ? "bg-blue-950/20 border-[#1d4ed8]/40" : "bg-[#0f172a] border-slate-700 hover:border-slate-600"}`}>
                <div className={`w-4 h-4 rounded border-2 shrink-0 flex items-center justify-center transition-colors ${checked ? "bg-[#1d4ed8] border-[#1d4ed8]" : "border-slate-600"}`}>
                  {checked && <span className="text-white text-[10px]">✓</span>}
                </div>
                <span className="text-sm text-slate-200 flex-1 text-left">{opt.name}</span>
                <span className={`text-xs font-medium shrink-0 ${checked ? "text-blue-400" : "text-slate-500"}`}>¥{opt.price.toLocaleString("ja-JP")}</span>
              </button>
            );
          })}
          {selOpts.length > 0 && (
            <div className="border border-slate-700 rounded-lg px-4 py-3 flex justify-between">
              <span className="text-xs text-slate-500">オプション合計</span>
              <span className="text-sm font-medium text-slate-100">¥{optTot.toLocaleString("ja-JP")}</span>
            </div>
          )}
        </div>
      )}

      {/* ══ STEP: Maintenance ══ */}
      {screen === "step-maintenance" && (
        <div className="flex flex-col gap-3">
          <p className={lbl}>メンテナンスメニューを選択してください（複数可）</p>
          {MAINTENANCE_MENUS.map(menu => {
            const checked = maintenanceSel.includes(menu.id);
            return (
              <button key={menu.id} type="button"
                onClick={() => setMaintenanceSel(p => checked ? p.filter(id => id !== menu.id) : [...p, menu.id])}
                className={`flex items-center gap-3 px-4 py-3 rounded-lg border transition-colors ${checked ? "bg-blue-950/20 border-[#1d4ed8]/40" : "bg-[#0f172a] border-slate-700 hover:border-slate-600"}`}>
                <div className={`w-4 h-4 rounded border-2 shrink-0 flex items-center justify-center transition-colors ${checked ? "bg-[#1d4ed8] border-[#1d4ed8]" : "border-slate-600"}`}>
                  {checked && <span className="text-white text-[10px] leading-none">✓</span>}
                </div>
                <span className="text-sm text-slate-200 flex-1 text-left">{menu.name}</span>
                <span className={`text-xs font-medium shrink-0 ${menu.price > 0 ? (checked ? "text-blue-400" : "text-slate-500") : "text-slate-600"}`}>
                  {menu.price > 0 ? `¥${menu.price.toLocaleString("ja-JP")}` : "価格未設定"}
                </span>
              </button>
            );
          })}
          {maintenanceSel.length > 0 && maintTot > 0 && (
            <div className="border border-slate-700 rounded-lg px-4 py-3 flex justify-between">
              <span className="text-xs text-slate-500">メンテナンス小計</span>
              <span className="text-sm font-medium text-slate-100">¥{maintTot.toLocaleString("ja-JP")}</span>
            </div>
          )}
        </div>
      )}

      {/* ══ STEP: Carwash ══ */}
      {screen === "step-carwash" && (
        <div className="flex flex-col gap-3">
          <p className={lbl}>洗車メニューを選択してください（複数可）</p>
          {CARWASH_MENUS.map(menu => {
            const checked = carwashSel.includes(menu.id);
            return (
              <button key={menu.id} type="button"
                onClick={() => setCarwashSel(p => checked ? p.filter(id => id !== menu.id) : [...p, menu.id])}
                className={`flex items-center gap-3 px-4 py-3 rounded-lg border transition-colors ${checked ? "bg-blue-950/20 border-[#1d4ed8]/40" : "bg-[#0f172a] border-slate-700 hover:border-slate-600"}`}>
                <div className={`w-4 h-4 rounded border-2 shrink-0 flex items-center justify-center transition-colors ${checked ? "bg-[#1d4ed8] border-[#1d4ed8]" : "border-slate-600"}`}>
                  {checked && <span className="text-white text-[10px] leading-none">✓</span>}
                </div>
                <span className="text-sm text-slate-200 flex-1 text-left">{menu.name}</span>
                <span className={`text-xs font-medium shrink-0 ${checked ? "text-blue-400" : "text-slate-500"}`}>
                  ¥{menu.price.toLocaleString("ja-JP")}
                </span>
              </button>
            );
          })}
          {carwashSel.length > 0 && (
            <div className="border border-slate-700 rounded-lg px-4 py-3 flex justify-between">
              <span className="text-xs text-slate-500">洗車小計</span>
              <span className="text-sm font-medium text-slate-100">¥{carwashTot.toLocaleString("ja-JP")}</span>
            </div>
          )}
        </div>
      )}

      {/* ══ STEP: Other ══ */}
      {screen === "step-other" && (
        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <p className={lbl}>作業内容・金額を追加してください</p>
            <div className="flex gap-2">
              <input type="text" value={otherName} onChange={e => setOtherName(e.target.value)}
                placeholder="作業内容を入力" className={`${inp} flex-1`} />
              <div className="flex items-center gap-1 shrink-0">
                <span className="text-slate-500 text-sm">¥</span>
                <input type="number" value={otherPrice} onChange={e => setOtherPrice(e.target.value)}
                  min="0" placeholder="0"
                  className="w-24 bg-[#0f172a] border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-100 focus:outline-none focus:border-[#1d4ed8]" />
              </div>
              <button type="button"
                onClick={() => {
                  const name = otherName.trim();
                  const price = Number(otherPrice) || 0;
                  if (!name) return;
                  setOtherItems(p => [...p, { id: crypto.randomUUID(), name, price }]);
                  setOtherName("");
                  setOtherPrice("");
                }}
                className="px-4 py-2 text-sm font-medium bg-[#1d4ed8] hover:bg-[#1e40af] text-white rounded-lg transition-colors shrink-0">
                追加
              </button>
            </div>
          </div>
          {otherItems.length > 0 && (
            <div className="flex flex-col gap-2">
              {otherItems.map(item => (
                <div key={item.id} className="flex items-center gap-3 px-4 py-3 rounded-lg border border-slate-700 bg-[#0f172a]">
                  <span className="text-sm text-slate-200 flex-1">{item.name}</span>
                  <span className="text-xs text-blue-400 font-medium">¥{item.price.toLocaleString("ja-JP")}</span>
                  <button type="button"
                    onClick={() => setOtherItems(p => p.filter(i => i.id !== item.id))}
                    className="text-slate-500 hover:text-red-400 transition-colors text-xs ml-2">✕</button>
                </div>
              ))}
              <div className="border border-slate-700 rounded-lg px-4 py-3 flex justify-between">
                <span className="text-xs text-slate-500">その他小計</span>
                <span className="text-sm font-medium text-slate-100">¥{otherTot.toLocaleString("ja-JP")}</span>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ══ STEP: Room Clean ══ */}
      {screen === "step-roomclean" && (
        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <p className={lbl}>汚染度を選択してください</p>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {ROOM_CLEAN_CONDITIONS.map(cond => {
                const active = roomCleanCond === cond.id;
                return (
                  <button key={cond.id} type="button"
                    onClick={() => setRoomCleanCond(cond.id)}
                    className={`flex flex-col items-center gap-1 px-3 py-3 rounded-lg border transition-colors ${active ? "bg-blue-950/30 border-[#1d4ed8]/60 text-slate-100" : "bg-[#0f172a] border-slate-700 text-slate-400 hover:border-slate-600"}`}>
                    <span className="text-xs font-semibold">{cond.label}</span>
                    <span className={`text-[10px] ${active ? "text-blue-400" : "text-slate-600"}`}>×{cond.coeff.toFixed(1)}</span>
                  </button>
                );
              })}
            </div>
          </div>
          <div className="flex flex-col gap-2">
            <p className={lbl}>クリーニング箇所を選択してください（複数可）</p>
            {ROOM_CLEAN_PARTS.map(part => {
              const checked = roomCleanSel.includes(part.id);
              const price   = Math.round(part.basePrice * rcCondCoeff);
              return (
                <button key={part.id} type="button"
                  onClick={() => setRoomCleanSel(p => checked ? p.filter(id => id !== part.id) : [...p, part.id])}
                  className={`flex items-center gap-3 px-4 py-3 rounded-lg border transition-colors ${checked ? "bg-blue-950/20 border-[#1d4ed8]/40" : "bg-[#0f172a] border-slate-700 hover:border-slate-600"}`}>
                  <div className={`w-4 h-4 rounded border-2 shrink-0 flex items-center justify-center transition-colors ${checked ? "bg-[#1d4ed8] border-[#1d4ed8]" : "border-slate-600"}`}>
                    {checked && <span className="text-white text-[10px] leading-none">✓</span>}
                  </div>
                  <span className="text-sm text-slate-200 flex-1 text-left">{part.name}</span>
                  <div className="flex flex-col items-end shrink-0">
                    <span className={`text-xs font-medium ${checked ? "text-blue-400" : "text-slate-500"}`}>
                      ¥{price.toLocaleString("ja-JP")}
                    </span>
                    {rcCondCoeff !== 1.0 && (
                      <span className="text-[10px] text-slate-600 line-through">
                        ¥{part.basePrice.toLocaleString("ja-JP")}
                      </span>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
          {roomCleanSel.length > 0 && (
            <div className="border border-slate-700 rounded-lg px-4 py-3 flex justify-between">
              <span className="text-xs text-slate-500">ルームクリーニング小計</span>
              <span className="text-sm font-medium text-slate-100">¥{roomCleanTot.toLocaleString("ja-JP")}</span>
            </div>
          )}
        </div>
      )}

      {/* ══ STEP: Window Film ══ */}
      {screen === "step-window" && (
        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <p className={lbl}>フィルムグレードを選択してください</p>
            <div className="grid grid-cols-2 gap-2">
              {WINDOW_FILM_GRADES.map(grade => {
                const active = windowGrade === grade.id;
                return (
                  <button key={grade.id} type="button"
                    onClick={() => setWindowGrade(grade.id)}
                    className={`flex flex-col items-center gap-1 px-3 py-3 rounded-lg border transition-colors ${active ? "bg-blue-950/30 border-[#1d4ed8]/60 text-slate-100" : "bg-[#0f172a] border-slate-700 text-slate-400 hover:border-slate-600"}`}>
                    <span className="text-xs font-semibold">{grade.name}</span>
                    <span className={`text-[10px] ${active ? "text-blue-400" : "text-slate-600"}`}>×{grade.coeff.toFixed(1)}</span>
                  </button>
                );
              })}
            </div>
          </div>
          <div className="flex flex-col gap-2">
            <p className={lbl}>施工箇所を選択してください（複数可）</p>
            {WINDOW_FILM_PARTS.map(part => {
              const checked = windowPartSel.includes(part.id);
              const price   = Math.round(part.basePrice * wfGradeCoeff);
              return (
                <button key={part.id} type="button"
                  onClick={() => setWindowPartSel(p => checked ? p.filter(id => id !== part.id) : [...p, part.id])}
                  className={`flex items-center gap-3 px-4 py-3 rounded-lg border transition-colors ${checked ? "bg-blue-950/20 border-[#1d4ed8]/40" : "bg-[#0f172a] border-slate-700 hover:border-slate-600"}`}>
                  <div className={`w-4 h-4 rounded border-2 shrink-0 flex items-center justify-center transition-colors ${checked ? "bg-[#1d4ed8] border-[#1d4ed8]" : "border-slate-600"}`}>
                    {checked && <span className="text-white text-[10px] leading-none">✓</span>}
                  </div>
                  <span className="text-sm text-slate-200 flex-1 text-left">{part.name}</span>
                  <div className="flex flex-col items-end shrink-0">
                    <span className={`text-xs font-medium ${checked ? "text-blue-400" : "text-slate-500"}`}>
                      ¥{price.toLocaleString("ja-JP")}
                    </span>
                    {wfGradeCoeff !== 1.0 && (
                      <span className="text-[10px] text-slate-600 line-through">
                        ¥{part.basePrice.toLocaleString("ja-JP")}
                      </span>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
          {windowPartSel.length > 0 && (
            <div className="border border-slate-700 rounded-lg px-4 py-3 flex justify-between">
              <span className="text-xs text-slate-500">ウィンドウフィルム小計</span>
              <span className="text-sm font-medium text-slate-100">¥{windowTot.toLocaleString("ja-JP")}</span>
            </div>
          )}
        </div>
      )}

      {/* ══ STEP: PPF ══ */}
      {screen === "step-ppf" && (
        <div className="flex flex-col gap-5">

          {/* ① Plan */}
          <div className="flex flex-col gap-2">
            <p className={lbl}>① プランを選択してください <span className="text-red-400">*</span></p>
            <div className="flex flex-col gap-2">
              {PPF_PLANS.map(plan => {
                const active     = ppfPlan === plan.id;
                const basePrice  = sizeKey ? (PPF_PLAN_PRICES[plan.id]?.[sizeKey] ?? 0) : 0;
                return (
                  <button key={plan.id} type="button"
                    onClick={() => setPpfPlan(plan.id)}
                    className={`flex items-center justify-between px-4 py-3 rounded-lg border transition-colors text-left ${active ? "bg-blue-950/20 border-[#1d4ed8]/40" : "bg-[#0f172a] border-slate-700 hover:border-slate-600"}`}>
                    <div className="flex items-center gap-3 min-w-0">
                      <div className={`w-4 h-4 rounded-full border-2 shrink-0 transition-colors ${active ? "bg-[#1d4ed8] border-[#1d4ed8]" : "border-slate-600"}`} />
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-slate-200">{plan.name}</p>
                        <p className="text-[10px] text-slate-500 truncate">{plan.desc}</p>
                      </div>
                    </div>
                    {basePrice > 0 && (
                      <span className={`text-xs font-medium shrink-0 ml-2 ${active ? "text-blue-400" : "text-slate-500"}`}>
                        ¥{basePrice.toLocaleString("ja-JP")}〜
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {/* ② Film type */}
          <div className="flex flex-col gap-2">
            <p className={lbl}>② フィルムタイプ <span className="text-red-400">*</span></p>
            <div className="grid grid-cols-2 gap-2">
              {PPF_FILM_TYPES.map(film => {
                const active = ppfFilmType === film.id;
                return (
                  <button key={film.id} type="button"
                    onClick={() => setPpfFilmType(film.id)}
                    className={`flex flex-col items-center gap-1 px-3 py-3 rounded-lg border transition-colors ${active ? "bg-blue-950/30 border-[#1d4ed8]/60 text-slate-100" : "bg-[#0f172a] border-slate-700 text-slate-400 hover:border-slate-600"}`}>
                    <span className="text-xs font-semibold">{film.name}</span>
                    <span className={`text-[10px] ${active ? "text-blue-400" : "text-slate-600"}`}>×{film.coeff.toFixed(1)}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* ③ Vehicle rank */}
          <div className="flex flex-col gap-2">
            <div className="flex items-center gap-2 flex-wrap">
              <p className={lbl}>③ 車両ランク <span className="text-red-400">*</span></p>
              {nv.maker && (
                <span className="text-[10px] text-amber-400">自動検出: {nv.maker}</span>
              )}
            </div>
            <div className="grid grid-cols-2 gap-2">
              {PPF_VEHICLE_RANKS.map(rank => {
                const active = ppfVehicleRank === rank.id;
                return (
                  <button key={rank.id} type="button"
                    onClick={() => setPpfVehicleRank(rank.id)}
                    className={`flex flex-col items-center gap-1 px-3 py-3 rounded-lg border transition-colors ${active ? "bg-blue-950/30 border-[#1d4ed8]/60 text-slate-100" : "bg-[#0f172a] border-slate-700 text-slate-400 hover:border-slate-600"}`}>
                    <span className="text-xs font-semibold">{rank.name}</span>
                    <span className={`text-[10px] ${active ? "text-blue-400" : "text-slate-600"}`}>×{rank.coeff.toFixed(1)}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* ④ Front glass option */}
          <div className="flex flex-col gap-2">
            <p className={lbl}>④ フロントガラスオプション（任意）</p>
            <div className="flex flex-col gap-2">
              <button type="button"
                onClick={() => setPpfFrontGlass("")}
                className={`flex items-center gap-3 px-4 py-3 rounded-lg border transition-colors ${ppfFrontGlass === "" ? "bg-blue-950/20 border-[#1d4ed8]/40" : "bg-[#0f172a] border-slate-700 hover:border-slate-600"}`}>
                <div className={`w-4 h-4 rounded-full border-2 shrink-0 transition-colors ${ppfFrontGlass === "" ? "bg-[#1d4ed8] border-[#1d4ed8]" : "border-slate-600"}`} />
                <span className="text-sm text-slate-300">なし（スキップ）</span>
              </button>
              {PPF_FRONT_GLASS.map(fg => {
                const active = ppfFrontGlass === fg.id;
                return (
                  <button key={fg.id} type="button"
                    onClick={() => setPpfFrontGlass(fg.id)}
                    className={`flex items-center justify-between px-4 py-3 rounded-lg border transition-colors ${active ? "bg-blue-950/20 border-[#1d4ed8]/40" : "bg-[#0f172a] border-slate-700 hover:border-slate-600"}`}>
                    <div className="flex items-center gap-3">
                      <div className={`w-4 h-4 rounded-full border-2 shrink-0 transition-colors ${active ? "bg-[#1d4ed8] border-[#1d4ed8]" : "border-slate-600"}`} />
                      <span className="text-sm text-slate-200">{fg.name}</span>
                    </div>
                    <span className={`text-xs font-medium ${active ? "text-blue-400" : "text-slate-500"}`}>¥{fg.price.toLocaleString("ja-JP")}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* ⑤ Single parts */}
          <div className="flex flex-col gap-2">
            <p className={lbl}>⑤ 単体パーツ追加（任意・複数可）</p>
            {PPF_SINGLE_PARTS.map(part => {
              const sel       = ppfSingleParts.find(p => p.id === part.id);
              const checked   = !!sel;
              const qty       = sel?.qty ?? 0;
              const isDoorCup = part.id === "sp-door-cup";
              return (
                <div key={part.id}
                  className={`flex items-center gap-3 px-4 py-3 rounded-lg border transition-colors ${checked ? "bg-blue-950/20 border-[#1d4ed8]/40" : "bg-[#0f172a] border-slate-700"}`}>
                  <button type="button"
                    onClick={() => setPpfSingleParts(p => checked ? p.filter(x => x.id !== part.id) : [...p, { id: part.id, qty: 1 }])}
                    className="flex items-center gap-3 flex-1 text-left min-w-0">
                    <div className={`w-4 h-4 rounded border-2 shrink-0 flex items-center justify-center transition-colors ${checked ? "bg-[#1d4ed8] border-[#1d4ed8]" : "border-slate-600"}`}>
                      {checked && <span className="text-white text-[10px] leading-none">✓</span>}
                    </div>
                    <span className="text-sm text-slate-200">{part.name}</span>
                  </button>
                  {isDoorCup && checked ? (
                    <div className="flex items-center gap-1.5 shrink-0">
                      <button type="button"
                        onClick={() => setPpfSingleParts(p => p.map(x => x.id === "sp-door-cup" ? { ...x, qty: Math.max(1, x.qty - 1) } : x))}
                        className="w-6 h-6 rounded border border-slate-600 text-slate-400 hover:border-slate-500 text-xs flex items-center justify-center">−</button>
                      <span className="text-sm text-slate-200 w-5 text-center">{qty}</span>
                      <button type="button"
                        onClick={() => setPpfSingleParts(p => p.map(x => x.id === "sp-door-cup" ? { ...x, qty: Math.min(part.maxQty, x.qty + 1) } : x))}
                        className="w-6 h-6 rounded border border-slate-600 text-slate-400 hover:border-slate-500 text-xs flex items-center justify-center">＋</button>
                      <span className="text-xs font-medium text-blue-400 w-16 text-right">¥{(part.price * qty).toLocaleString("ja-JP")}</span>
                    </div>
                  ) : (
                    <span className={`text-xs font-medium shrink-0 ${checked ? "text-blue-400" : "text-slate-500"}`}>¥{part.price.toLocaleString("ja-JP")}</span>
                  )}
                </div>
              );
            })}
          </div>

          {/* Running subtotal */}
          {ppfTot > 0 && (
            <div className="border border-slate-700 rounded-lg px-4 py-3 flex justify-between">
              <span className="text-xs text-slate-500">PPF 小計</span>
              <span className="text-sm font-medium text-slate-100">¥{ppfTot.toLocaleString("ja-JP")}</span>
            </div>
          )}
        </div>
      )}

      {/* ══ Placeholder screens ══ */}
      {PLACEHOLDER_SCREENS.includes(screen) && (
        <div className="border border-slate-700/50 rounded-xl p-8 text-center flex flex-col items-center gap-3">
          <span className="text-4xl">🚧</span>
          <p className="text-sm font-medium text-slate-300">{SCREEN_LABEL[screen]}</p>
          <p className="text-xs text-slate-500 leading-relaxed">
            このステップは実装予定です。<br />
            「次へ」で確認画面へ進めます。
          </p>
        </div>
      )}

      {/* ══ STEP5 Confirmation ══ */}
      {screen === "step5" && (
        <div className="flex flex-col gap-4">

          <div className="border border-slate-700 rounded-lg p-4 flex flex-col gap-1.5">
            <p className="text-xs text-slate-500 mb-1 font-medium">お客様・車両</p>
            <p className="text-sm text-slate-100">{custLabel || "（未設定）"}</p>
            <p className="text-xs text-slate-400">{vehLabel || "車両なし"}</p>
            <p className="text-xs text-slate-500 mt-1">カテゴリ: {cats.map(c => CATEGORIES.find(x => x.id === c)?.label).filter(Boolean).join("、")}</p>
            {isDealer && <span className="text-[10px] text-amber-400">業者 掛け率 {dealerRate}%</span>}
          </div>

          {subtotal > 0 && (
            <div className="border border-slate-700 rounded-lg overflow-hidden">
              <p className="px-4 py-2 text-xs font-medium text-slate-400 bg-slate-800/50">見積内訳</p>
              {has("coating") && coatId && (
                <div className="px-4 py-3 border-t border-slate-700/40 flex flex-col gap-1.5">
                  <div className="flex justify-between text-sm">
                    <span className="text-slate-300">{COATINGS.find(c => c.id === coatId)?.name}</span>
                    <span className="text-slate-100">¥{cPrice.toLocaleString("ja-JP")}</span>
                  </div>
                  <p className="text-[10px] text-slate-600">サイズ: {sizeKey}（×{BODY_SIZES.find(s => s.key === sizeKey)?.multi ?? 1.0}）</p>
                  {topcoat2 && <div className="flex justify-between text-xs text-slate-400"><span>2層目: {TOPCOAT_NAME[topcoat2]}</span><span>+¥{tc2P.toLocaleString("ja-JP")}</span></div>}
                  {topcoat3 && <div className="flex justify-between text-xs text-slate-400"><span>3層目: {TOPCOAT_NAME[topcoat3]}</span><span>+¥{tc3P.toLocaleString("ja-JP")}</span></div>}
                  {selOpts.map(id => {
                    const o = COATING_OPTIONS.find(x => x.id === id);
                    return o ? <div key={id} className="flex justify-between text-xs text-slate-400"><span>{o.name}</span><span>+¥{o.price.toLocaleString("ja-JP")}</span></div> : null;
                  })}
                </div>
              )}
              {has("ppf") && ppfTot > 0 && (
                <div className="px-4 py-3 border-t border-slate-700/40 flex flex-col gap-1.5">
                  <p className="text-xs font-medium text-slate-400">PPF</p>
                  {ppfSvc?.lineItems.map((item, i) => (
                    <div key={i} className="flex justify-between text-sm">
                      <span className="text-slate-300">{item.item_name}</span>
                      <span className="text-slate-100">¥{(item.unit_price * item.quantity).toLocaleString("ja-JP")}</span>
                    </div>
                  ))}
                </div>
              )}
              {has("window") && windowPartSel.length > 0 && (
                <div className="px-4 py-3 border-t border-slate-700/40 flex flex-col gap-1.5">
                  <p className="text-xs font-medium text-slate-400">ウィンドウフィルム</p>
                  {windowSvc?.lineItems.map((item, i) => (
                    <div key={i} className="flex justify-between text-sm">
                      <span className="text-slate-300">{item.item_name}</span>
                      <span className="text-slate-100">¥{item.unit_price.toLocaleString("ja-JP")}</span>
                    </div>
                  ))}
                </div>
              )}
              {has("maintenance") && maintenanceSel.length > 0 && (
                <div className="px-4 py-3 border-t border-slate-700/40 flex flex-col gap-1.5">
                  <p className="text-xs font-medium text-slate-400">ボディ定期メンテナンス</p>
                  {maintenanceSel.map(id => {
                    const m = MAINTENANCE_MENUS.find(x => x.id === id);
                    return m ? (
                      <div key={id} className="flex justify-between text-sm">
                        <span className="text-slate-300">{m.name}</span>
                        <span className="text-slate-100">{m.price > 0 ? `¥${m.price.toLocaleString("ja-JP")}` : "—"}</span>
                      </div>
                    ) : null;
                  })}
                </div>
              )}
              {has("carwash") && carwashSel.length > 0 && (
                <div className="px-4 py-3 border-t border-slate-700/40 flex flex-col gap-1.5">
                  <p className="text-xs font-medium text-slate-400">メンテナンス洗車</p>
                  {carwashSel.map(id => {
                    const m = CARWASH_MENUS.find(x => x.id === id);
                    return m ? (
                      <div key={id} className="flex justify-between text-sm">
                        <span className="text-slate-300">{m.name}</span>
                        <span className="text-slate-100">¥{m.price.toLocaleString("ja-JP")}</span>
                      </div>
                    ) : null;
                  })}
                </div>
              )}
              {has("roomclean") && roomCleanSel.length > 0 && (
                <div className="px-4 py-3 border-t border-slate-700/40 flex flex-col gap-1.5">
                  <p className="text-xs font-medium text-slate-400">ルームクリーニング</p>
                  {roomCleanSvc?.lineItems.map((item, i) => (
                    <div key={i} className="flex justify-between text-sm">
                      <span className="text-slate-300">{item.item_name}</span>
                      <span className="text-slate-100">¥{item.unit_price.toLocaleString("ja-JP")}</span>
                    </div>
                  ))}
                </div>
              )}
              {has("other") && otherItems.length > 0 && (
                <div className="px-4 py-3 border-t border-slate-700/40 flex flex-col gap-1.5">
                  <p className="text-xs font-medium text-slate-400">その他作業</p>
                  {otherItems.map(item => (
                    <div key={item.id} className="flex justify-between text-sm">
                      <span className="text-slate-300">{item.name}</span>
                      <span className="text-slate-100">¥{item.price.toLocaleString("ja-JP")}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          <div className="flex flex-col gap-2">
            <label className={lbl}>クーポン（複数適用可）</label>
            <div className="flex flex-col gap-1.5">
              {DEFAULT_COUPONS.map((c, i) => (
                <button key={i} type="button"
                  onClick={() => setAppliedCoupons(p => { const a = [...p]; a[i] = !a[i]; return a; })}
                  className={`flex items-center justify-between px-3 py-2.5 rounded-lg border text-sm transition-colors ${appliedCoupons[i] ? "bg-emerald-950/20 border-emerald-500/40 text-slate-100" : "bg-[#0f172a] border-slate-700 text-slate-400 hover:border-slate-600"}`}>
                  <span>{c.name}</span>
                  <span className={`text-xs font-medium ${appliedCoupons[i] ? "text-emerald-400" : "text-slate-500"}`}>-¥{c.amount.toLocaleString("ja-JP")}</span>
                </button>
              ))}
            </div>
          </div>

          <div className="flex items-center gap-3">
            <label className={`${lbl} shrink-0`}>追加値引き</label>
            <div className="flex items-center gap-1.5">
              <span className="text-slate-500 text-sm">¥</span>
              <input type="number" value={extraDisc} onChange={e => setExtraDisc(e.target.value)} min="0"
                className="w-28 bg-[#0f172a] border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-100 focus:outline-none focus:border-[#1d4ed8]" />
            </div>
          </div>

          <div className="border border-slate-700 rounded-lg overflow-hidden">
            <div className="px-4 py-3 flex flex-col gap-1.5">
              <div className="flex justify-between text-xs text-slate-400"><span>小計</span><span>¥{subtotal.toLocaleString("ja-JP")}</span></div>
              {couponDisc > 0  && <div className="flex justify-between text-xs text-emerald-400"><span>クーポン割引</span><span>-¥{couponDisc.toLocaleString("ja-JP")}</span></div>}
              {extraDiscN > 0  && <div className="flex justify-between text-xs text-red-400"><span>追加値引き</span><span>-¥{extraDiscN.toLocaleString("ja-JP")}</span></div>}
              {isDealer && dealerDisc > 0 && <div className="flex justify-between text-xs text-amber-400"><span>業販割引（{100 - dealerRate}%引）</span><span>-¥{dealerDisc.toLocaleString("ja-JP")}</span></div>}
              {overDiscounted && (
                <div className="text-[11px] text-amber-300 leading-snug pt-0.5">
                  ※ 値引きが小計を上回るため、適用値引きは小計まで（-¥{subtotal.toLocaleString("ja-JP")}）、お支払額は¥0に調整されます。
                </div>
              )}
              <div className="flex justify-between text-xs text-slate-400"><span>消費税（{taxRate}%）</span><span>¥{taxAmt.toLocaleString("ja-JP")}</span></div>
            </div>
            <div className="px-4 py-3 border-t border-slate-700 flex justify-between items-center bg-slate-800/30">
              <span className="text-sm font-bold text-slate-100">合計（税込）</span>
              <span className="text-xl font-bold text-slate-100">¥{total.toLocaleString("ja-JP")}</span>
            </div>
          </div>

          <div className="flex flex-col gap-1">
            <label className={lbl}>備考</label>
            <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={3} placeholder="特記事項・備考..." className={`${inp} resize-none`} />
          </div>

          {previewNo && <p className="text-[10px] text-slate-600">見積番号: {previewNo}（自動採番）</p>}
        </div>
      )}

      {/* ── Navigation ── */}
      <div className="sticky bottom-0 z-10 flex justify-between gap-2 pt-3 pb-2 border-t border-slate-700 bg-[#1e293b]">
        <div>
          {history.length > 1
            ? <button type="button" onClick={pop} disabled={pending} className="px-4 py-3 sm:py-2 text-sm text-slate-400 hover:text-slate-100 hover:bg-slate-700 rounded-lg transition-colors disabled:opacity-50">← 戻る</button>
            : <button type="button" onClick={onCancel} disabled={pending} className="px-4 py-3 sm:py-2 text-sm text-slate-400 hover:text-slate-100 hover:bg-slate-700 rounded-lg transition-colors disabled:opacity-50">キャンセル</button>
          }
        </div>
        <div className="flex gap-2">
          {screen !== "step5" && (
            <button type="button" disabled={pending}
              onClick={() => {
                if (screen === "category") handleCategoryNext();
                else if (screen === "step1") handleStep1Next();
                else if (screen === "step2") handleStep2Next();
                else if (screen === "step3") handleStep3Next();
                else if (screen === "step4") handleStep4Next();
                else if (screen === "step-window") {
                  if (windowPartSel.length === 0) { setError("施工箇所を1か所以上選択してください"); return; }
                  push(nextScreen(screen, cats));
                } else if (screen === "step-ppf") {
                  if (!ppfPlan) { setError("プランを選択してください"); return; }
                  push(nextScreen(screen, cats));
                } else push(nextScreen(screen, cats));
              }}
              className="px-5 py-3 sm:py-2 text-sm font-medium bg-[#1d4ed8] hover:bg-[#1e40af] text-white rounded-lg transition-colors disabled:opacity-50">
              {pending ? "処理中..." : "次へ →"}
            </button>
          )}
          {screen === "step5" && (
            <>
              <button type="button" disabled className="px-4 py-2 text-sm font-medium bg-slate-700/40 text-slate-500 rounded-lg cursor-not-allowed">LINE転送</button>
              <button type="button" disabled={pending} onClick={handleSave}
                className="px-5 py-3 sm:py-2 text-sm font-medium bg-[#1d4ed8] hover:bg-[#1e40af] text-white rounded-lg transition-colors disabled:opacity-50">
                {pending ? "保存中..." : "保存して完了"}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
