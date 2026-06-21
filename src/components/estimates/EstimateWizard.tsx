"use client";

import { useState, useTransition, useEffect, useRef } from "react";
import { createCustomer } from "@/lib/customers/create-customer";
import { createVehicle }  from "@/lib/vehicles/create-vehicle";
import { createEstimate } from "@/lib/estimates/create-estimate";
import { previewDocumentNumber } from "@/lib/numbering/preview-document-number";
import { EstimateCategory } from "@/lib/estimates/estimate-types";
import { CustomerDB } from "@/lib/customers/customer-types";
import { VehicleDB }  from "@/lib/vehicles/vehicle-types";
import dynamic from "next/dynamic";
import type { VehicleRegistrationOcrResult } from "@/lib/vehicle-registration/vehicle-registration-types";

const VehicleRegistrationUpload = dynamic(
  () => import("@/components/vehicle-registration/VehicleRegistrationUpload"),
  { ssr: false, loading: () => <div className="py-4 text-center text-xs text-slate-500">読み込み中...</div> },
);
const VehicleRegistrationOcrReview = dynamic(
  () => import("@/components/vehicle-registration/VehicleRegistrationOcrReview"),
  { ssr: false, loading: () => <div className="py-4 text-center text-xs text-slate-500">読み込み中...</div> },
);

// ── Item row ─────────────────────────────────────────────────────────────────

interface ItemRow {
  key:          number;
  category:     EstimateCategory;
  item_name:    string;
  description:  string;
  quantity:     string;
  unit_price:   string;
  discount_rate: string;
}

let _key = 0;
function nextKey() { return ++_key; }
function emptyItem(): ItemRow {
  return { key: nextKey(), category: "other", item_name: "", description: "", quantity: "1", unit_price: "0", discount_rate: "0" };
}
function lineTotal(i: ItemRow) {
  return Math.round((Number(i.quantity)||0) * (Number(i.unit_price)||0) * (1 - (Number(i.discount_rate)||0)/100));
}

// ── Constants ────────────────────────────────────────────────────────────────

const BODY_SIZES = ["SS", "S", "M", "ML", "L", "LL", "XL"];

const POPULAR_COLORS = [
  "ホワイト", "パールホワイト", "ブラック", "シルバー",
  "グレー", "レッド", "ブルー", "ゴールド",
];

const CATEGORIES: { value: EstimateCategory; label: string }[] = [
  { value: "coating",  label: "コーティング" },
  { value: "ppf",      label: "PPF"          },
  { value: "window",   label: "ウィンドウ"   },
  { value: "interior", label: "インテリア"   },
  { value: "glass",    label: "ガラス"       },
  { value: "other",    label: "その他"       },
];

interface ServiceOption { name: string; category: EstimateCategory; }
const SERVICE_OPTIONS: ServiceOption[] = [
  { name: "ボディコーティング",      category: "coating"  },
  { name: "PPF施工",                category: "ppf"      },
  { name: "ウィンドウフィルム",       category: "window"   },
  { name: "ボディ定期メンテナンス",   category: "coating"  },
  { name: "メンテナンス洗車",        category: "other"    },
  { name: "ルームクリーニング",       category: "interior" },
  { name: "その他作業",             category: "other"    },
];

const CLOSE_DATES   = ["月末", "15日", "20日"];
const PAYMENT_DATES = ["翌月末", "翌々月末"];
const INVOICE_RATES = ["70", "75", "80"];

const inp  = "bg-[#0f172a] border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-100 placeholder-slate-600 focus:outline-none focus:border-[#1d4ed8] transition-colors w-full";
const lbl  = "text-xs font-medium text-slate-400";
const tabA = "px-4 py-2 text-sm font-medium rounded-lg text-white bg-[#1d4ed8] transition-colors shrink-0";
const tabI = "px-4 py-2 text-sm font-medium rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-700/50 transition-colors shrink-0";

// ── Component ────────────────────────────────────────────────────────────────

export interface EstimateWizardProps {
  customers:  CustomerDB[];
  vehicles:   VehicleDB[];
  onCancel?:  () => void;
  onSuccess?: () => void;
}

export default function EstimateWizard({ customers, vehicles, onCancel, onSuccess }: EstimateWizardProps) {
  const [step, setStep]    = useState<1|2|3|4|5>(1);
  const [error, setError]  = useState<string | null>(null);
  const [pending, startTx] = useTransition();

  // ── STEP 1 ── Customer ────────────────────────────────────────────────────

  // Mode: select existing | create new
  const [cMode,         setCMode]         = useState<"select" | "create">("select");
  const [customerId,    setCustomerId]    = useState("");
  const [customerLabel, setCustomerLabel] = useState("");

  // Search (existing customer)
  const [searchQuery, setSearchQuery] = useState("");
  const searchInputRef = useRef<HTMLInputElement>(null);

  // New customer form
  const [nc, setNc] = useState({
    last_name: "", first_name: "", last_name_kana: "", first_name_kana: "",
    phone: "", email: "", postal_code: "", prefecture: "", city: "",
    address1: "", address2: "", line_user_id: "", notes: "", occupation: "",
  });

  // OCR input mode toggle (manual vs OCR)
  const [ncInputMode, setNcInputMode] = useState<"manual" | "ocr">("manual");

  // OCR state (shared between Step 1 customer OCR and Step 2 vehicle pre-fill)
  type OcrStage = "idle" | "upload" | "review";
  const [ocrStage,       setOcrStage]       = useState<OcrStage>("idle");
  const [pendingOcr,     setPendingOcr]     = useState<VehicleRegistrationOcrResult | null>(null);
  const [ocrVehicleData, setOcrVehicleData] = useState<Partial<VehicleRegistrationOcrResult> | null>(null);

  // 業者 (business customer) settings
  const [isBusiness,   setIsBusiness]   = useState(false);
  const [invoiceRate,  setInvoiceRate]  = useState("70");
  const [customRate,   setCustomRate]   = useState("");
  const [closeDate,    setCloseDate]    = useState("月末");
  const [payDate,      setPayDate]      = useState("翌月末");
  const [customPayDate,setCustomPayDate]= useState("");

  // LINE QR modal
  const [showLineModal, setShowLineModal] = useState(false);

  // ── STEP 2 ── Vehicle ─────────────────────────────────────────────────────

  const [vMode,        setVMode]        = useState<"select" | "create">("select");
  const [vehicleId,    setVehicleId]    = useState("");
  const [vehicleLabel, setVehicleLabel] = useState("");

  const [nv, setNv] = useState({
    maker: "", model: "", grade: "", vehicle_code: "", year: "",
    color: "", plate_number: "", vin: "", body_size: "",
  });

  // Body size recommendation
  const [recommendedSize, setRecommendedSize] = useState("ML");

  // Pre-fill vehicle from OCR when entering step 2
  useEffect(() => {
    if (step === 2 && ocrVehicleData && vMode === "create") {
      setNv(prev => {
        const u = { ...prev };
        if (ocrVehicleData.maker)                   u.maker        = ocrVehicleData.maker;
        if (ocrVehicleData.vehicle_name)            u.model        = ocrVehicleData.vehicle_name;
        if (ocrVehicleData.model)                   u.vehicle_code = ocrVehicleData.model;
        if (ocrVehicleData.chassis_number)          u.vin          = ocrVehicleData.chassis_number;
        if (ocrVehicleData.color)                   u.color        = ocrVehicleData.color;
        if (ocrVehicleData.first_registration_date) u.year         = ocrVehicleData.first_registration_date.slice(0, 4);
        const plate = [
          ocrVehicleData.license_plate_region,
          ocrVehicleData.license_plate_class,
          ocrVehicleData.license_plate_kana,
          ocrVehicleData.license_plate_number,
        ].filter(Boolean).join(" ");
        if (plate) u.plate_number = plate;
        return u;
      });
    }
  // Run only when entering step 2
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step]);

  // ── STEP 3 ── Services ────────────────────────────────────────────────────

  const [services, setServices] = useState<Array<ServiceOption & { checked: boolean; price: string }>>(
    () => SERVICE_OPTIONS.map(s => ({ ...s, checked: false, price: "" }))
  );
  const [servicesApplied, setServicesApplied] = useState(false);

  // ── STEP 4 ── Line Items ──────────────────────────────────────────────────

  const [items, setItems] = useState<ItemRow[]>([emptyItem()]);

  // ── STEP 5 ── Review + Save ───────────────────────────────────────────────

  const [previewNo,      setPreviewNo]      = useState("");
  const [estimateNo,     setEstimateNo]     = useState("");
  const [title,          setTitle]          = useState("");
  const [validUntil,     setValidUntil]     = useState("");
  const [taxRate,        setTaxRate]        = useState("10");
  const [discountAmount, setDiscountAmount] = useState("0");
  const [reviewNotes,    setReviewNotes]    = useState("");
  const [internalMemo,   setInternalMemo]   = useState("");

  useEffect(() => {
    if (step === 5) {
      previewDocumentNumber("estimate")
        .then(p => setPreviewNo(p ?? ""))
        .catch(() => {});
    }
  }, [step]);

  // ── Derived ───────────────────────────────────────────────────────────────

  const filteredVehicles = vehicles.filter(v => v.customer_id === customerId);

  const matchedCustomers = customers.filter(c => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    const custVehicles = vehicles.filter(v => v.customer_id === c.id);
    return (
      [c.last_name, c.first_name, c.last_name_kana, c.first_name_kana].filter(Boolean).join(" ").toLowerCase().includes(q) ||
      (c.phone?.toLowerCase().includes(q) ?? false) ||
      (c.line_user_id?.toLowerCase().includes(q) ?? false) ||
      (c.occupation?.toLowerCase().includes(q) ?? false) ||
      custVehicles.some(v => [v.maker, v.model, v.plate_number].filter(Boolean).join(" ").toLowerCase().includes(q))
    );
  });

  const subtotal  = items.reduce((s, i) => s + lineTotal(i), 0);
  const discAmt   = Number(discountAmount) || 0;
  const tax       = Number(taxRate) || 10;
  const taxAmount = Math.floor((subtotal - discAmt) * tax / 100);
  const total     = subtotal - discAmt + taxAmount;

  // Body size candidates (±1 from recommended)
  const recIdx   = BODY_SIZES.indexOf(recommendedSize);
  const sizeCandidates = BODY_SIZES.slice(
    Math.max(0, recIdx - 1),
    Math.min(BODY_SIZES.length, recIdx + 2)
  );

  // ── Item helpers ──────────────────────────────────────────────────────────

  function updateItem(key: number, patch: Partial<ItemRow>) {
    setItems(prev => prev.map(r => r.key === key ? { ...r, ...patch } : r));
  }

  // ── OCR apply (STEP1) ─────────────────────────────────────────────────────

  function applyOcrToCustomer(selected: Partial<VehicleRegistrationOcrResult>) {
    // Customer fields
    const rawName = selected.owner_name || selected.user_name || "";
    if (rawName) {
      const parts = rawName.trim().split(/\s+/);
      setNc(prev => ({
        ...prev,
        last_name:  parts[0] ?? prev.last_name,
        first_name: parts.slice(1).join(" ") || prev.first_name,
      }));
    }
    const addr = selected.owner_address || selected.user_address || "";
    if (addr) setNc(prev => ({ ...prev, address1: addr }));

    // Save vehicle data for STEP2 pre-population
    setOcrVehicleData(selected);

    setOcrStage("idle");
    setPendingOcr(null);
    setNcInputMode("manual"); // show the filled-in form
  }

  // ── Navigation ─────────────────────────────────────────────────────────────

  function buildCustomerNotes(): string {
    const base = nc.notes.trim();
    if (!isBusiness) return base;
    const rate = customRate || invoiceRate;
    const pay  = customPayDate || payDate;
    const biz  = `[業者情報]\n仕切率: ${rate}%\n締日: ${closeDate}\n支払日: ${pay}`;
    return base ? `${base}\n\n${biz}` : biz;
  }

  function handleStep1Next() {
    setError(null);
    if (cMode === "select") {
      if (!customerId) { setError("顧客を選択してください"); return; }
      if (filteredVehicles.length === 0) setVMode("create");
      setStep(2);
      return;
    }
    // create new customer
    if (!nc.last_name) { setError("姓は必須です"); return; }
    startTx(async () => {
      const fd = new FormData();
      fd.set("last_name",       nc.last_name);
      fd.set("first_name",      nc.first_name);
      fd.set("last_name_kana",  nc.last_name_kana);
      fd.set("first_name_kana", nc.first_name_kana);
      fd.set("phone",           nc.phone);
      fd.set("email",           nc.email);
      fd.set("postal_code",     nc.postal_code);
      fd.set("prefecture",      nc.prefecture);
      fd.set("city",            nc.city);
      fd.set("address1",        nc.address1);
      fd.set("address2",        nc.address2);
      fd.set("line_user_id",    nc.line_user_id);
      fd.set("occupation",      isBusiness ? (nc.occupation || "業者") : nc.occupation);
      fd.set("notes",           buildCustomerNotes());
      const result = await createCustomer(fd);
      if ("error" in result) { setError(result.error ?? null); return; }
      const cid = "customerId" in result ? result.customerId : undefined;
      if (!cid) { setError("顧客IDの取得に失敗しました"); return; }
      setCustomerId(cid);
      setCustomerLabel(`${nc.last_name} ${nc.first_name}`.trim());
      setVMode("create");
      setStep(2);
    });
  }

  function handleStep2Next() {
    setError(null);
    if (vMode === "select") {
      if (!vehicleId) { setError("車両を選択してください"); return; }
      setStep(3);
      return;
    }
    startTx(async () => {
      const fd = new FormData();
      fd.set("customer_id",  customerId);
      fd.set("maker",        nv.maker);
      fd.set("model",        nv.model);
      fd.set("grade",        nv.grade);
      fd.set("vehicle_code", nv.vehicle_code);
      fd.set("year",         nv.year);
      fd.set("color",        nv.color);
      fd.set("plate_number", nv.plate_number);
      fd.set("vin",          nv.vin);
      fd.set("body_size",    nv.body_size);
      const result = await createVehicle(fd);
      if ("error" in result) { setError(result.error ?? null); return; }
      const vid = "vehicleId" in result ? result.vehicleId : undefined;
      if (!vid) { setError("車両IDの取得に失敗しました"); return; }
      setVehicleId(vid);
      setVehicleLabel([nv.maker, nv.model, nv.plate_number].filter(Boolean).join(" ") || "新規車両");
      setStep(3);
    });
  }

  function handleStep3Next() {
    if (!servicesApplied) {
      const toAdd = services.filter(s => s.checked);
      if (toAdd.length > 0) {
        setItems(prev => {
          const base = prev.filter(i => i.item_name.trim());
          return [
            ...base,
            ...toAdd.map(s => ({
              key: nextKey(), category: s.category, item_name: s.name,
              description: "", quantity: "1", unit_price: s.price || "0", discount_rate: "0",
            })),
          ];
        });
      }
      setServicesApplied(true);
    }
    setStep(4);
  }

  function handleSave(saveStatus: "draft" | "sent") {
    setError(null);
    if (!customerId) { setError("顧客が未設定です"); return; }
    if (!vehicleId)  { setError("車両が未設定です");  return; }
    startTx(async () => {
      const fd = new FormData();
      fd.set("customer_id",     customerId);
      fd.set("vehicle_id",      vehicleId);
      fd.set("estimate_no",     estimateNo);
      fd.set("status",          saveStatus);
      fd.set("title",           title);
      fd.set("tax_rate",        taxRate);
      fd.set("discount_amount", String(discAmt));
      fd.set("valid_until",     validUntil);
      fd.set("notes",           reviewNotes);
      fd.set("internal_memo",   internalMemo);
      fd.set("subtotal",        String(subtotal));
      fd.set("tax_amount",      String(taxAmount));
      fd.set("total",           String(total));
      fd.set("items_json", JSON.stringify(
        items.map((item, i) => ({
          category: item.category, item_name: item.item_name, description: item.description,
          quantity: Number(item.quantity)||1, unit_price: Number(item.unit_price)||0,
          discount_rate: Number(item.discount_rate)||0, sort_order: i,
          item_type: "manual", product_id: null, sku: null,
          product_name_snapshot: null, retail_price_snapshot: null,
        }))
      ));
      const result = await createEstimate(fd);
      if (result?.error) { setError(result.error); return; }
      onSuccess?.();
      onCancel?.();
    });
  }

  function goBack() {
    setError(null);
    setStep(s => (s - 1) as typeof step);
  }

  // ── Step indicator ───────────────────────────────────────────────────────

  const STEP_LABELS = ["顧客", "車両", "サービス", "明細", "確認・保存"];

  // ─────────────────────────────────────────────────────────────────────────
  return (
    <div className="flex flex-col gap-5">

      {/* Progress */}
      <div className="flex items-start gap-0">
        {STEP_LABELS.map((label, i) => {
          const n = i + 1; const isActive = step === n; const isDone = step > n;
          return (
            <div key={n} className="flex items-center flex-1 min-w-0">
              <div className="flex flex-col items-center gap-1 flex-1 min-w-0">
                <div className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0 ${isDone ? "bg-emerald-600 text-white" : isActive ? "bg-[#1d4ed8] text-white" : "bg-slate-700 text-slate-500"}`}>{isDone ? "✓" : n}</div>
                <span className={`text-[10px] text-center leading-tight ${isActive ? "text-slate-200" : isDone ? "text-emerald-500" : "text-slate-600"}`}>{label}</span>
              </div>
              {n < STEP_LABELS.length && <div className={`h-px w-4 mb-4 shrink-0 ${step > n ? "bg-emerald-600" : "bg-slate-700"}`} />}
            </div>
          );
        })}
      </div>

      {/* Error */}
      {error && (
        <div className="bg-red-900/30 border border-red-700 rounded-lg px-3 py-2">
          <p className="text-xs text-red-400">{error}</p>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════
          STEP 1: Customer
      ══════════════════════════════════════════════════════════════════ */}
      {step === 1 && (
        <div className="flex flex-col gap-4">

          {/* Mode tabs */}
          <div className="flex gap-2">
            <button type="button" onClick={() => setCMode("select")} className={cMode === "select" ? tabA : tabI}>既存顧客から選択</button>
            <button type="button" onClick={() => setCMode("create")} className={cMode === "create" ? tabA : tabI}>新規顧客登録</button>
          </div>

          {/* ── Select existing customer ── */}
          {cMode === "select" && (
            <div className="flex flex-col gap-3">
              <div className="relative">
                <input
                  ref={searchInputRef}
                  type="text"
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  placeholder="氏名・電話番号・LINE・車両・業者名で検索..."
                  className={inp}
                />
                {searchQuery && (
                  <button type="button" onClick={() => setSearchQuery("")} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 text-xs transition-colors">✕</button>
                )}
              </div>

              <div className="flex flex-col gap-0 max-h-60 overflow-y-auto border border-slate-700 rounded-lg">
                {matchedCustomers.length === 0 ? (
                  <div className="px-4 py-6 text-center text-xs text-slate-600">
                    {searchQuery ? "一致する顧客が見つかりません" : "顧客が登録されていません"}
                  </div>
                ) : (
                  matchedCustomers.map(c => {
                    const name = [c.last_name, c.first_name].filter(Boolean).join(" ");
                    const kana = [c.last_name_kana, c.first_name_kana].filter(Boolean).join(" ");
                    const custVehicles = vehicles.filter(v => v.customer_id === c.id);
                    const isSelected = customerId === c.id;
                    return (
                      <button
                        key={c.id}
                        type="button"
                        onClick={() => {
                          setCustomerId(c.id);
                          setCustomerLabel(name);
                          setVehicleId("");
                          setVehicleLabel("");
                        }}
                        className={`w-full text-left px-4 py-3 border-t border-slate-700/50 first:border-t-0 transition-colors ${isSelected ? "bg-blue-950/40 border-l-2 border-l-[#1d4ed8]" : "hover:bg-slate-800/40"}`}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <div>
                            <p className="text-sm font-medium text-slate-200">{name}</p>
                            {kana && <p className="text-xs text-slate-500">{kana}</p>}
                            <div className="flex gap-3 mt-0.5">
                              {c.phone && <span className="text-xs text-slate-500">{c.phone}</span>}
                              {c.occupation && <span className="text-xs text-slate-600 italic">{c.occupation}</span>}
                            </div>
                            {custVehicles.length > 0 && (
                              <p className="text-[10px] text-slate-600 mt-0.5">
                                {custVehicles.map(v => [v.maker, v.model, v.plate_number].filter(Boolean).join(" ")).join(" / ")}
                              </p>
                            )}
                          </div>
                          {isSelected && <span className="text-[#1d4ed8] text-xs font-medium shrink-0">✓ 選択中</span>}
                        </div>
                      </button>
                    );
                  })
                )}
              </div>
            </div>
          )}

          {/* ── Create new customer ── */}
          {cMode === "create" && (
            <div className="flex flex-col gap-4">

              {/* Input method */}
              <div className="flex items-center gap-3">
                <button type="button" onClick={() => setNcInputMode("manual")} className={ncInputMode === "manual" ? "text-xs px-3 py-1.5 rounded-lg bg-slate-700 text-slate-100 font-medium" : "text-xs px-3 py-1.5 rounded-lg text-slate-500 hover:text-slate-300 hover:bg-slate-800 transition-colors"}>
                  ① 手入力
                </button>
                <button
                  type="button"
                  onClick={() => { setNcInputMode("ocr"); setOcrStage("upload"); }}
                  className={ncInputMode === "ocr" ? "text-xs px-3 py-1.5 rounded-lg bg-slate-700 text-slate-100 font-medium flex items-center gap-1.5" : "text-xs px-3 py-1.5 rounded-lg text-blue-400 hover:text-blue-300 border border-blue-500/30 hover:border-blue-400/50 bg-blue-500/5 hover:bg-blue-500/10 transition-colors flex items-center gap-1.5"}
                >
                  <span>📄</span>② 車検証から自動入力
                </button>
              </div>

              {/* Customer fields */}
              <div className="grid grid-cols-2 gap-3">
                <div className="flex flex-col gap-1">
                  <label className={lbl}>姓 <span className="text-red-400">*</span></label>
                  <input type="text" value={nc.last_name} onChange={e => setNc(p => ({ ...p, last_name: e.target.value }))} placeholder="山田" className={inp} />
                </div>
                <div className="flex flex-col gap-1">
                  <label className={lbl}>名</label>
                  <input type="text" value={nc.first_name} onChange={e => setNc(p => ({ ...p, first_name: e.target.value }))} placeholder="太郎" className={inp} />
                </div>
                <div className="flex flex-col gap-1">
                  <label className={lbl}>フリガナ（姓）</label>
                  <input type="text" value={nc.last_name_kana} onChange={e => setNc(p => ({ ...p, last_name_kana: e.target.value }))} placeholder="ヤマダ" className={inp} />
                </div>
                <div className="flex flex-col gap-1">
                  <label className={lbl}>フリガナ（名）</label>
                  <input type="text" value={nc.first_name_kana} onChange={e => setNc(p => ({ ...p, first_name_kana: e.target.value }))} placeholder="タロウ" className={inp} />
                </div>
                <div className="flex flex-col gap-1">
                  <label className={lbl}>電話番号</label>
                  <input type="tel" value={nc.phone} onChange={e => setNc(p => ({ ...p, phone: e.target.value }))} placeholder="090-0000-0000" className={inp} />
                </div>
                <div className="flex flex-col gap-1">
                  <label className={lbl}>メールアドレス</label>
                  <input type="email" value={nc.email} onChange={e => setNc(p => ({ ...p, email: e.target.value }))} placeholder="example@email.com" className={inp} />
                </div>
                <div className="flex flex-col gap-1">
                  <label className={lbl}>郵便番号</label>
                  <input type="text" value={nc.postal_code} onChange={e => setNc(p => ({ ...p, postal_code: e.target.value }))} placeholder="000-0000" className={inp} />
                </div>
                <div className="flex flex-col gap-1">
                  <label className={lbl}>都道府県</label>
                  <input type="text" value={nc.prefecture} onChange={e => setNc(p => ({ ...p, prefecture: e.target.value }))} placeholder="東京都" className={inp} />
                </div>
                <div className="col-span-2 flex flex-col gap-1">
                  <label className={lbl}>住所</label>
                  <input type="text" value={nc.address1} onChange={e => setNc(p => ({ ...p, address1: e.target.value }))} placeholder="市区町村・番地" className={inp} />
                </div>

                {/* LINE ID */}
                <div className="col-span-2 flex flex-col gap-1">
                  <label className={lbl}>LINE ID</label>
                  <div className="flex gap-2">
                    <input type="text" value={nc.line_user_id} onChange={e => setNc(p => ({ ...p, line_user_id: e.target.value }))} placeholder="LINE IDを入力" className={inp} />
                    <button
                      type="button"
                      onClick={() => setShowLineModal(true)}
                      className="shrink-0 flex items-center gap-1.5 px-3 py-2 text-xs font-medium rounded-lg bg-[#06C755] hover:bg-[#05b84c] text-white transition-colors"
                    >
                      <span>👥</span>友だち追加
                    </button>
                  </div>
                </div>

                <div className="col-span-2 flex flex-col gap-1">
                  <label className={lbl}>備考</label>
                  <textarea value={nc.notes} onChange={e => setNc(p => ({ ...p, notes: e.target.value }))} rows={2} placeholder="メモ..." className={`${inp} resize-none`} />
                </div>
              </div>

              {/* 業者設定 */}
              <div className="border border-slate-700 rounded-lg overflow-hidden">
                <button
                  type="button"
                  onClick={() => setIsBusiness(v => !v)}
                  className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-slate-800/30 transition-colors"
                >
                  <div className={`w-4 h-4 rounded border-2 flex items-center justify-center shrink-0 transition-colors ${isBusiness ? "bg-[#1d4ed8] border-[#1d4ed8]" : "border-slate-600"}`}>
                    {isBusiness && <span className="text-white text-[10px] leading-none">✓</span>}
                  </div>
                  <span className="text-sm text-slate-300">業者として登録</span>
                </button>

                {isBusiness && (
                  <div className="border-t border-slate-700 px-4 py-4 flex flex-col gap-4 bg-slate-800/20">
                    {/* 仕切率 */}
                    <div className="flex flex-col gap-2">
                      <label className={lbl}>仕切率</label>
                      <div className="flex gap-2 flex-wrap items-center">
                        {INVOICE_RATES.map(r => (
                          <button key={r} type="button" onClick={() => { setInvoiceRate(r); setCustomRate(""); }}
                            className={`px-3 py-1.5 text-sm rounded-lg border transition-colors ${invoiceRate === r && !customRate ? "bg-[#1d4ed8] border-[#1d4ed8] text-white" : "bg-[#0f172a] border-slate-700 text-slate-400 hover:border-slate-500"}`}>
                            {r}%
                          </button>
                        ))}
                        <div className="flex items-center gap-1">
                          <input type="number" value={customRate} onChange={e => { setCustomRate(e.target.value); setInvoiceRate(""); }} min="0" max="100" placeholder="自由入力" className="w-24 bg-[#0f172a] border border-slate-700 rounded-lg px-3 py-1.5 text-sm text-slate-100 focus:outline-none focus:border-[#1d4ed8]" />
                          <span className="text-slate-500 text-sm">%</span>
                        </div>
                      </div>
                    </div>

                    {/* 締日 */}
                    <div className="flex flex-col gap-2">
                      <label className={lbl}>締日</label>
                      <div className="flex gap-2">
                        {CLOSE_DATES.map(d => (
                          <button key={d} type="button" onClick={() => setCloseDate(d)}
                            className={`px-3 py-1.5 text-sm rounded-lg border transition-colors ${closeDate === d ? "bg-[#1d4ed8] border-[#1d4ed8] text-white" : "bg-[#0f172a] border-slate-700 text-slate-400 hover:border-slate-500"}`}>
                            {d}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* 支払日 */}
                    <div className="flex flex-col gap-2">
                      <label className={lbl}>支払日</label>
                      <div className="flex gap-2 items-center flex-wrap">
                        {PAYMENT_DATES.map(d => (
                          <button key={d} type="button" onClick={() => { setPayDate(d); setCustomPayDate(""); }}
                            className={`px-3 py-1.5 text-sm rounded-lg border transition-colors ${payDate === d && !customPayDate ? "bg-[#1d4ed8] border-[#1d4ed8] text-white" : "bg-[#0f172a] border-slate-700 text-slate-400 hover:border-slate-500"}`}>
                            {d}
                          </button>
                        ))}
                        <input type="text" value={customPayDate} onChange={e => { setCustomPayDate(e.target.value); setPayDate(""); }} placeholder="自由入力" className="w-28 bg-[#0f172a] border border-slate-700 rounded-lg px-3 py-1.5 text-sm text-slate-100 focus:outline-none focus:border-[#1d4ed8]" />
                      </div>
                    </div>
                  </div>
                )}
              </div>

            </div>
          )}

          {/* OCR modal (for STEP1 new customer) */}
          {ocrStage !== "idle" && cMode === "create" && (
            <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 p-4" onClick={() => { setOcrStage("idle"); setPendingOcr(null); }}>
              <div className="bg-[#1e293b] border border-slate-700 rounded-xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto p-6" onClick={e => e.stopPropagation()}>
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-sm font-semibold text-slate-100">{ocrStage === "upload" ? "車検証を読み取る" : "読み取り結果を確認"}</h3>
                  <button type="button" onClick={() => { setOcrStage("idle"); setPendingOcr(null); }} className="text-slate-500 hover:text-slate-200 text-lg leading-none transition-colors">✕</button>
                </div>
                {ocrStage === "upload" && (
                  <>
                    <p className="text-xs text-slate-500 mb-4">車検証から顧客情報（氏名・住所）と車両情報を読み取ります</p>
                    <VehicleRegistrationUpload
                      onComplete={result => { setPendingOcr(result); setOcrStage("review"); }}
                      onCancel={() => { setOcrStage("idle"); setPendingOcr(null); }}
                    />
                  </>
                )}
                {ocrStage === "review" && pendingOcr && (
                  <>
                    <p className="text-xs text-slate-500 mb-4">反映する項目を選択してください。顧客情報と車両情報の両方を引用できます。</p>
                    <VehicleRegistrationOcrReview
                      ocrResult={pendingOcr}
                      onApply={applyOcrToCustomer}
                      onCancel={() => { setOcrStage("idle"); setPendingOcr(null); }}
                    />
                  </>
                )}
              </div>
            </div>
          )}

          {/* LINE 友だち追加モーダル */}
          {showLineModal && (
            <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 p-4" onClick={() => setShowLineModal(false)}>
              <div className="bg-[#1e293b] border border-slate-700 rounded-xl shadow-xl w-full max-w-sm p-6" onClick={e => e.stopPropagation()}>
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-sm font-semibold text-slate-100">LINE 友だち追加</h3>
                  <button type="button" onClick={() => setShowLineModal(false)} className="text-slate-500 hover:text-slate-200 text-lg leading-none transition-colors">✕</button>
                </div>
                <div className="flex flex-col items-center gap-4 py-4">
                  {/* QR code placeholder */}
                  <div className="w-40 h-40 bg-slate-800 border border-slate-700 rounded-xl flex flex-col items-center justify-center gap-2">
                    <span className="text-3xl">📱</span>
                    <p className="text-xs text-slate-500 text-center">LINEチャンネルQRコード</p>
                  </div>
                  <p className="text-xs text-slate-400 text-center leading-relaxed">
                    お客様にQRコードをスキャンしていただき、LINEで友だち追加してください。<br />
                    友だち追加後、LINE IDを入力欄に入力してください。
                  </p>
                  <p className="text-[10px] text-slate-600 text-center">※ QRコードの表示にはLINE公式アカウントの設定が必要です</p>
                </div>
                <button type="button" onClick={() => setShowLineModal(false)} className="w-full py-2 text-sm text-slate-400 hover:text-slate-200 hover:bg-slate-700 rounded-lg transition-colors">閉じる</button>
              </div>
            </div>
          )}

        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════
          STEP 2: Vehicle
      ══════════════════════════════════════════════════════════════════ */}
      {step === 2 && (
        <div className="flex flex-col gap-4">
          <div className="flex gap-2">
            <button type="button" onClick={() => setVMode("select")} className={vMode === "select" ? tabA : tabI}>登録済み車両を選択</button>
            <button type="button" onClick={() => setVMode("create")} className={vMode === "create" ? tabA : tabI}>新規車両登録</button>
          </div>

          {vMode === "select" && (
            <div className="flex flex-col gap-1">
              <label className={lbl}>車両 <span className="text-red-400">*</span></label>
              <select value={vehicleId} onChange={e => {
                setVehicleId(e.target.value);
                const v = filteredVehicles.find(v => v.id === e.target.value);
                setVehicleLabel(v ? [v.maker, v.model, v.plate_number].filter(Boolean).join(" ") || v.id : "");
              }} className={inp}>
                <option value="">車両を選択...</option>
                {filteredVehicles.map(v => (
                  <option key={v.id} value={v.id}>{[v.maker, v.model, v.plate_number].filter(Boolean).join(" ") || v.id}</option>
                ))}
              </select>
              {filteredVehicles.length === 0 && (
                <p className="text-xs text-slate-500">この顧客の登録済み車両がありません。「新規車両登録」から追加してください</p>
              )}
            </div>
          )}

          {vMode === "create" && (
            <div className="flex flex-col gap-4">
              {ocrVehicleData && (
                <div className="flex items-center gap-2 px-3 py-2 rounded-lg border border-emerald-500/30 bg-emerald-500/5 text-xs text-emerald-400">
                  <span>✓</span> 車検証OCR結果から車両情報を引用しました。内容を確認・修正してください。
                </div>
              )}

              <div className="grid grid-cols-2 gap-3">
                <div className="flex flex-col gap-1">
                  <label className={lbl}>メーカー</label>
                  <input type="text" value={nv.maker} onChange={e => setNv(p => ({ ...p, maker: e.target.value }))} placeholder="Toyota" className={inp} />
                </div>
                <div className="flex flex-col gap-1">
                  <label className={lbl}>車名</label>
                  <input type="text" value={nv.model} onChange={e => setNv(p => ({ ...p, model: e.target.value }))} placeholder="Prius" className={inp} />
                </div>
                <div className="flex flex-col gap-1">
                  <label className={lbl}>グレード</label>
                  <input type="text" value={nv.grade} onChange={e => setNv(p => ({ ...p, grade: e.target.value }))} placeholder="G" className={inp} />
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
                  <label className={lbl}>ナンバー</label>
                  <input type="text" value={nv.plate_number} onChange={e => setNv(p => ({ ...p, plate_number: e.target.value }))} placeholder="品川 300 あ 1234" className={inp} />
                </div>
                <div className="col-span-2 flex flex-col gap-1">
                  <label className={lbl}>車台番号</label>
                  <input type="text" value={nv.vin} onChange={e => setNv(p => ({ ...p, vin: e.target.value }))} placeholder="ZVW50-XXXXXXX" className={inp} />
                </div>

                {/* ボディカラー */}
                <div className="col-span-2 flex flex-col gap-2">
                  <label className={lbl}>ボディカラー</label>
                  <div className="flex flex-wrap gap-2">
                    {POPULAR_COLORS.map(c => (
                      <button key={c} type="button" onClick={() => setNv(p => ({ ...p, color: c }))}
                        className={`px-3 py-1.5 text-xs rounded-lg border transition-colors ${nv.color === c ? "bg-[#1d4ed8] border-[#1d4ed8] text-white" : "bg-[#0f172a] border-slate-700 text-slate-400 hover:border-slate-500"}`}>
                        {c}
                      </button>
                    ))}
                  </div>
                  <input type="text" value={nv.color} onChange={e => setNv(p => ({ ...p, color: e.target.value }))} placeholder="手動入力..." className={inp} />
                </div>

                {/* ボディサイズ */}
                <div className="col-span-2 flex flex-col gap-2">
                  <div className="flex items-center justify-between">
                    <label className={lbl}>ボディサイズ</label>
                    <span className="text-[10px] text-slate-600">推奨: {recommendedSize}（緑）</span>
                  </div>

                  {/* 3-size recommendation strip */}
                  <div className="flex items-center gap-2">
                    <div className="flex gap-2">
                      {sizeCandidates.map(s => {
                        const isRec = s === recommendedSize;
                        const isSel = nv.body_size === s;
                        return (
                          <button key={s} type="button"
                            onClick={() => setNv(p => ({ ...p, body_size: s }))}
                            className={`relative px-4 py-2 text-sm font-medium rounded-lg border transition-colors ${
                              isSel
                                ? "bg-[#1d4ed8] border-[#1d4ed8] text-white"
                                : isRec
                                  ? "border-emerald-500/50 text-emerald-400 bg-emerald-950/30 hover:bg-emerald-950/50"
                                  : "bg-[#0f172a] border-slate-700 text-slate-400 hover:border-slate-500"
                            }`}
                          >
                            {s}
                            {isRec && !isSel && <span className="absolute -top-1.5 left-1/2 -translate-x-1/2 text-[9px] text-emerald-400 whitespace-nowrap">推奨</span>}
                          </button>
                        );
                      })}
                    </div>
                    <span className="text-slate-600 text-xs">/ 全サイズ:</span>
                    <div className="flex gap-1 flex-wrap">
                      {BODY_SIZES.filter(s => !sizeCandidates.includes(s)).map(s => (
                        <button key={s} type="button"
                          onClick={() => { setNv(p => ({ ...p, body_size: s })); setRecommendedSize(s); }}
                          className={`px-2 py-1 text-xs rounded border transition-colors ${nv.body_size === s ? "bg-[#1d4ed8] border-[#1d4ed8] text-white" : "bg-[#0f172a] border-slate-700/50 text-slate-600 hover:border-slate-600 hover:text-slate-400"}`}>
                          {s}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════
          STEP 3: Service Selection
      ══════════════════════════════════════════════════════════════════ */}
      {step === 3 && (
        <div className="flex flex-col gap-3">
          <p className={lbl}>施工サービスを選択（複数可・スキップ可）</p>
          <div className="flex flex-col gap-2">
            {services.map((svc, i) => (
              <div key={svc.name} className={`flex items-center gap-3 px-4 py-3 rounded-lg border transition-colors cursor-pointer ${svc.checked ? "border-[#1d4ed8]/50 bg-blue-950/20" : "border-slate-700 hover:border-slate-600 bg-slate-800/10"}`}
                onClick={() => setServices(prev => prev.map((s, j) => j === i ? { ...s, checked: !s.checked } : s))}>
                <div className={`w-5 h-5 rounded border-2 flex items-center justify-center shrink-0 transition-colors ${svc.checked ? "bg-[#1d4ed8] border-[#1d4ed8]" : "border-slate-600"}`}>
                  {svc.checked && <span className="text-white text-[11px] leading-none">✓</span>}
                </div>
                <span className="text-sm text-slate-200 flex-1">{svc.name}</span>
                {svc.checked && (
                  <div className="flex items-center gap-1" onClick={e => e.stopPropagation()}>
                    <span className="text-xs text-slate-500">¥</span>
                    <input
                      type="number"
                      value={svc.price}
                      onChange={e => setServices(prev => prev.map((s, j) => j === i ? { ...s, price: e.target.value } : s))}
                      min="0" placeholder="0"
                      className="w-28 bg-[#0f172a] border border-slate-700 rounded px-2 py-1 text-sm text-slate-100 text-right focus:outline-none focus:border-[#1d4ed8]"
                    />
                  </div>
                )}
              </div>
            ))}
          </div>
          <p className="text-xs text-slate-600">選択したサービスは次のステップで明細として展開されます</p>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════
          STEP 4: Line Items
      ══════════════════════════════════════════════════════════════════ */}
      {step === 4 && (
        <div className="flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <label className={lbl}>施工内容・明細</label>
            <button type="button" onClick={() => setItems(prev => [...prev, emptyItem()])} className="text-xs text-[#1d4ed8] hover:text-blue-400 font-medium transition-colors">+ 行を追加</button>
          </div>
          <div className="border border-slate-700 rounded-lg overflow-hidden">
            <div className="grid grid-cols-[1fr_80px_60px_56px_76px_28px] gap-1 px-3 py-2 bg-slate-800/50 text-[10px] font-medium text-slate-500">
              <span>品目</span><span className="text-right">単価</span><span className="text-right">数量</span><span className="text-right">割引%</span><span className="text-right">小計</span><span />
            </div>
            {items.map(item => (
              <div key={item.key} className="border-t border-slate-700/60 px-3 py-2 flex flex-col gap-1.5">
                <div className="flex gap-2">
                  <select value={item.category} onChange={e => updateItem(item.key, { category: e.target.value as EstimateCategory })}
                    className="bg-[#0f172a] border border-slate-700 rounded px-2 py-1 text-[11px] text-slate-400 focus:outline-none focus:border-[#1d4ed8] shrink-0 w-28">
                    {CATEGORIES.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
                  </select>
                  <input type="text" value={item.item_name} onChange={e => updateItem(item.key, { item_name: e.target.value })} placeholder="品目名"
                    className="flex-1 bg-[#0f172a] border border-slate-700 rounded px-2 py-1 text-sm text-slate-100 placeholder-slate-600 focus:outline-none focus:border-[#1d4ed8]" />
                </div>
                <div className="grid grid-cols-[1fr_80px_60px_56px_76px_28px] gap-1 items-center">
                  <input type="text" value={item.description} onChange={e => updateItem(item.key, { description: e.target.value })} placeholder="説明（省略可）"
                    className="bg-[#0f172a] border border-slate-700 rounded px-2 py-1 text-xs text-slate-400 placeholder-slate-600 focus:outline-none focus:border-[#1d4ed8]" />
                  <input type="number" value={item.unit_price}    onChange={e => updateItem(item.key, { unit_price:    e.target.value })} min="0"       className="bg-[#0f172a] border border-slate-700 rounded px-2 py-1 text-xs text-slate-100 text-right focus:outline-none focus:border-[#1d4ed8]" />
                  <input type="number" value={item.quantity}      onChange={e => updateItem(item.key, { quantity:      e.target.value })} min="0" step="0.01" className="bg-[#0f172a] border border-slate-700 rounded px-2 py-1 text-xs text-slate-100 text-right focus:outline-none focus:border-[#1d4ed8]" />
                  <input type="number" value={item.discount_rate} onChange={e => updateItem(item.key, { discount_rate: e.target.value })} min="0" max="100" className="bg-[#0f172a] border border-slate-700 rounded px-2 py-1 text-xs text-slate-100 text-right focus:outline-none focus:border-[#1d4ed8]" />
                  <span className="text-xs text-slate-300 text-right font-medium">¥{lineTotal(item).toLocaleString("ja-JP")}</span>
                  <button type="button" onClick={() => setItems(p => p.filter(r => r.key !== item.key))} className="text-slate-600 hover:text-red-400 text-sm leading-none transition-colors">✕</button>
                </div>
              </div>
            ))}
            {items.length === 0 && (
              <div className="px-3 py-4 text-center text-xs text-slate-600">明細がありません。「+ 行を追加」から手動で追加できます</div>
            )}
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════
          STEP 5: Review + Save
      ══════════════════════════════════════════════════════════════════ */}
      {step === 5 && (
        <div className="flex flex-col gap-4">
          {/* Summary */}
          <div className="bg-slate-800/30 border border-slate-700 rounded-lg p-4 flex flex-col gap-2">
            {[
              ["顧客",     customerLabel],
              ["車両",     vehicleLabel],
              ["サービス", services.filter(s => s.checked).map(s => s.name).join("、") || "—"],
              ["明細",     `${items.filter(i => i.item_name.trim()).length} 件`],
            ].map(([k, v]) => (
              <div key={k} className="flex gap-3 text-sm">
                <span className="text-slate-500 w-16 shrink-0">{k}</span>
                <span className="text-slate-200 text-xs leading-relaxed">{v || "—"}</span>
              </div>
            ))}
          </div>

          {/* Metadata */}
          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1">
              <label className={lbl}>見積番号（省略可）</label>
              <input type="text" value={estimateNo} onChange={e => setEstimateNo(e.target.value)} placeholder={previewNo ? `次: ${previewNo}` : "EST-0000-00001"} className={inp} />
              {!estimateNo && previewNo && <p className="text-[10px] text-slate-600">空欄で自動採番（{previewNo}）</p>}
            </div>
            <div className="flex flex-col gap-1">
              <label className={lbl}>タイトル</label>
              <input type="text" value={title} onChange={e => setTitle(e.target.value)} placeholder="例: コーティング施工一式" className={inp} />
            </div>
            <div className="flex flex-col gap-1">
              <label className={lbl}>有効期限</label>
              <input type="date" value={validUntil} onChange={e => setValidUntil(e.target.value)} className={inp} />
            </div>
            <div className="flex flex-col gap-1">
              <label className={lbl}>消費税率</label>
              <div className="flex items-center gap-2">
                <input type="number" value={taxRate} onChange={e => setTaxRate(e.target.value)} min="0" max="100" className="bg-[#0f172a] border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-100 focus:outline-none focus:border-[#1d4ed8] transition-colors w-20" />
                <span className="text-slate-400 text-sm">%</span>
              </div>
            </div>
          </div>

          {/* Totals */}
          <div className="flex justify-end">
            <div className="w-60 flex flex-col gap-1.5">
              <div className="flex justify-between text-xs text-slate-400"><span>小計</span><span>¥{subtotal.toLocaleString("ja-JP")}</span></div>
              <div className="flex justify-between items-center gap-2">
                <span className="text-xs text-red-400 shrink-0">値引き</span>
                <div className="flex items-center gap-1">
                  <span className="text-xs text-red-400">¥</span>
                  <input type="number" value={discountAmount} onChange={e => setDiscountAmount(e.target.value)} min="0"
                    className="w-24 bg-[#0f172a] border border-slate-700 rounded px-2 py-1 text-xs text-red-400 text-right focus:outline-none focus:border-[#1d4ed8]" />
                </div>
              </div>
              <div className="flex justify-between text-xs text-slate-400"><span>消費税 ({taxRate}%)</span><span>¥{taxAmount.toLocaleString("ja-JP")}</span></div>
              <div className="flex justify-between border-t border-slate-600 pt-2 mt-1">
                <span className="text-sm font-bold text-slate-100">合計</span>
                <span className="text-base font-bold text-slate-100">¥{total.toLocaleString("ja-JP")}</span>
              </div>
            </div>
          </div>

          {/* Notes */}
          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1">
              <label className={lbl}>備考（顧客向け）</label>
              <textarea value={reviewNotes} onChange={e => setReviewNotes(e.target.value)} rows={3} placeholder="見積書に記載するメモ..." className={`${inp} resize-none`} />
            </div>
            <div className="flex flex-col gap-1">
              <label className={lbl}>内部メモ</label>
              <textarea value={internalMemo} onChange={e => setInternalMemo(e.target.value)} rows={3} placeholder="社内向けメモ..." className={`${inp} resize-none`} />
            </div>
          </div>
        </div>
      )}

      {/* ── Navigation ─────────────────────────────────────────────────── */}
      <div className="flex justify-between gap-2 pt-3 border-t border-slate-700">
        <div>
          {step > 1 ? (
            <button type="button" onClick={goBack} disabled={pending}
              className="px-4 py-2 text-sm text-slate-400 hover:text-slate-100 hover:bg-slate-700 rounded-lg transition-colors disabled:opacity-50">
              ← 戻る
            </button>
          ) : (
            <button type="button" onClick={onCancel} disabled={pending}
              className="px-4 py-2 text-sm text-slate-400 hover:text-slate-100 hover:bg-slate-700 rounded-lg transition-colors disabled:opacity-50">
              キャンセル
            </button>
          )}
        </div>

        <div className="flex gap-2">
          {step < 5 && (
            <button type="button" disabled={pending}
              onClick={() => {
                if      (step === 1) handleStep1Next();
                else if (step === 2) handleStep2Next();
                else if (step === 3) handleStep3Next();
                else                 setStep(5);
              }}
              className="px-5 py-2 text-sm font-medium bg-[#1d4ed8] hover:bg-[#1e40af] text-white rounded-lg transition-colors disabled:opacity-50">
              {pending ? "処理中..." : "次へ →"}
            </button>
          )}
          {step === 5 && (
            <>
              <button type="button" disabled={pending} onClick={() => handleSave("draft")}
                className="px-4 py-2 text-sm font-medium bg-slate-700 hover:bg-slate-600 text-white rounded-lg transition-colors disabled:opacity-50">
                {pending ? "保存中..." : "下書き保存"}
              </button>
              <button type="button" disabled={pending} onClick={() => handleSave("sent")}
                className="px-4 py-2 text-sm font-medium bg-[#1d4ed8] hover:bg-[#1e40af] text-white rounded-lg transition-colors disabled:opacity-50">
                {pending ? "保存中..." : "見積保存"}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
