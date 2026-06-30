"use client";

import { useState, useTransition, useEffect } from "react";
import { createEstimate } from "@/lib/estimates/create-estimate";
import { updateEstimate } from "@/lib/estimates/update-estimate";
import { calculateEstimateTotals } from "@/lib/pricing/estimate-totals";
import {
  EstimateDB,
  EstimateStatus,
  EstimateCategory,
  EstimateItemDB,
} from "@/lib/estimates/estimate-types";
import { CustomerDB } from "@/lib/customers/customer-types";
import { VehicleDB }  from "@/lib/vehicles/vehicle-types";
import { previewDocumentNumber } from "@/lib/numbering/preview-document-number";
import ProductSelector from "@/components/products/ProductSelector";
import { GyeonProductDB } from "@/lib/products/product-types";
import dynamic from "next/dynamic";
import type { VehicleRegistrationOcrResult } from "@/lib/vehicle-registration/vehicle-registration-types";

// Dynamic imports — OCR modules load lazily so EstimateForm never crashes
// even if the vehicle-registration table/bucket/API key is not yet configured.
const VehicleRegistrationUpload = dynamic(
  () => import("@/components/vehicle-registration/VehicleRegistrationUpload"),
  { ssr: false, loading: () => <div className="py-8 text-center text-xs text-slate-500">読み込み中...</div> },
);
const VehicleRegistrationOcrReview = dynamic(
  () => import("@/components/vehicle-registration/VehicleRegistrationOcrReview"),
  { ssr: false, loading: () => <div className="py-8 text-center text-xs text-slate-500">読み込み中...</div> },
);

// ─── Item form state ──────────────────────────────────────────────────────────

interface ItemRow {
  key:                   number;   // local react key
  category:              EstimateCategory;
  item_name:             string;
  description:           string;
  quantity:              string;
  unit_price:            string;
  discount_rate:         string;
  // Product link (optional)
  item_type:             "manual" | "product";
  product_id:            string | null;
  sku:                   string | null;
  product_name_snapshot: string | null;
  retail_price_snapshot: number | null;
}

let _itemKey = 0;
function nextKey() { return ++_itemKey; }

function emptyItem(): ItemRow {
  return {
    key:                   nextKey(),
    category:              "other",
    item_name:             "",
    description:           "",
    quantity:              "1",
    unit_price:            "0",
    discount_rate:         "0",
    item_type:             "manual",
    product_id:            null,
    sku:                   null,
    product_name_snapshot: null,
    retail_price_snapshot: null,
  };
}

function itemFromDB(item: EstimateItemDB): ItemRow {
  return {
    key:                   nextKey(),
    category:              item.category,
    item_name:             item.item_name,
    description:           item.description ?? "",
    quantity:              String(item.quantity),
    unit_price:            String(item.unit_price),
    discount_rate:         String(item.discount_rate),
    item_type:             (item as unknown as { item_type?: string }).item_type === "product" ? "product" : "manual",
    product_id:            (item as unknown as { product_id?: string | null }).product_id ?? null,
    sku:                   (item as unknown as { sku?: string | null }).sku ?? null,
    product_name_snapshot: (item as unknown as { product_name_snapshot?: string | null }).product_name_snapshot ?? null,
    retail_price_snapshot: (item as unknown as { retail_price_snapshot?: number | null }).retail_price_snapshot ?? null,
  };
}

function lineTotal(item: ItemRow): number {
  const qty  = Number(item.quantity)      || 0;
  const up   = Number(item.unit_price)    || 0;
  const disc = Number(item.discount_rate) || 0;
  return Math.round(qty * up * (1 - disc / 100));
}

// ─── Estimate form state ──────────────────────────────────────────────────────

interface FormFields {
  customer_id:     string;
  vehicle_id:      string;
  estimate_no:     string;
  status:          string;
  title:           string;
  tax_rate:        string;
  discount_amount: string;
  valid_until:     string;
  notes:           string;
  internal_memo:   string;
}

const EMPTY: FormFields = {
  customer_id:     "",
  vehicle_id:      "",
  estimate_no:     "",
  status:          "draft",
  title:           "",
  tax_rate:        "10",
  discount_amount: "0",
  valid_until:     "",
  notes:           "",
  internal_memo:   "",
};

function fromDB(e: EstimateDB): FormFields {
  return {
    customer_id:     e.customer_id,
    vehicle_id:      e.vehicle_id,
    estimate_no:     e.estimate_number ?? e.estimate_no ?? "",
    status:          e.status,
    title:           e.title           ?? "",
    tax_rate:        String(e.tax_rate ?? 10),
    discount_amount: String(e.discount_amount ?? 0),
    valid_until:     e.valid_until     ?? "",
    notes:           e.notes           ?? "",
    internal_memo:   e.internal_memo   ?? "",
  };
}

// ─── Constants ────────────────────────────────────────────────────────────────

const CATEGORIES: { value: EstimateCategory; label: string }[] = [
  { value: "coating",  label: "コーティング" },
  { value: "ppf",      label: "PPF" },
  { value: "window",   label: "ウィンドウ" },
  { value: "interior", label: "インテリア" },
  { value: "glass",    label: "ガラス" },
  { value: "other",    label: "その他" },
];

const STATUSES: { value: EstimateStatus; label: string }[] = [
  { value: "draft",    label: "下書き" },
  { value: "sent",     label: "送付済み" },
  { value: "approved", label: "承認済み" },
  { value: "rejected", label: "却下" },
  { value: "expired",  label: "期限切れ" },
];

interface ServiceOption { name: string; category: EstimateCategory; }
const SERVICE_OPTIONS: ServiceOption[] = [
  { name: "ボディコーティング",            category: "coating"  },
  { name: "PPF施工",                      category: "ppf"      },
  { name: "ウィンドウフィルム",             category: "window"   },
  { name: "フロントガラス撥水",             category: "glass"    },
  { name: "ホイールコーティング",           category: "coating"  },
  { name: "レザー / インテリアコーティング", category: "interior" },
  { name: "ルームクリーニング",             category: "interior" },
  { name: "ポリッシュ / 研磨",             category: "coating"  },
  { name: "メンテナンス洗車",              category: "other"    },
  { name: "鉄粉・付着物除去",              category: "other"    },
  { name: "樹脂パーツコーティング",         category: "coating"  },
  { name: "エンジンルームクリーニング",     category: "other"    },
  { name: "その他作業",                    category: "other"    },
];

const inputClass =
  "bg-[#0f172a] border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-100 placeholder-slate-600 focus:outline-none focus:border-[#1d4ed8] transition-colors";
const labelClass = "text-xs font-medium text-slate-400";

// ─── Component ────────────────────────────────────────────────────────────────

interface EstimateFormProps {
  estimate?:  EstimateDB;
  customers:  CustomerDB[];
  vehicles:   VehicleDB[];
  onCancel?:  () => void;
  onSuccess?: () => void;
}

export default function EstimateForm({
  estimate, customers, vehicles, onCancel, onSuccess,
}: EstimateFormProps) {
  const isEdit = !!estimate;

  const [form,    setForm]    = useState<FormFields>(estimate ? fromDB(estimate) : EMPTY);
  const [items,   setItems]   = useState<ItemRow[]>(
    estimate?.estimate_items?.length
      ? estimate.estimate_items
          .slice()
          .sort((a, b) => a.sort_order - b.sort_order)
          .map(itemFromDB)
      : [emptyItem()]
  );
  const [error,               setError]   = useState<string | null>(null);
  const [pending,             startTransition] = useTransition();
  const [previewNo,           setPreviewNo] = useState<string>("");
  const [showProductSelector, setShowProductSelector] = useState(false);
  const [showServicePanel,  setShowServicePanel]  = useState(false);
  const [serviceSelections, setServiceSelections] = useState<Array<ServiceOption & { checked: boolean; price: string }>>(
    () => SERVICE_OPTIONS.map((s) => ({ ...s, checked: false, price: "" }))
  );

  // Vehicle registration OCR state
  type VehicleRegStage = "closed" | "upload" | "review";
  const [vehicleRegStage, setVehicleRegStage] = useState<VehicleRegStage>("closed");
  const [pendingOcrResult, setPendingOcrResult] = useState<VehicleRegistrationOcrResult | null>(null);

  useEffect(() => {
    if (!estimate) {
      previewDocumentNumber("estimate")
        .then((p) => setPreviewNo(p ?? ""))
        .catch(() => {}); // Preview is cosmetic — never block the form on failure
    }
  }, [estimate]);

  function setField<K extends keyof FormFields>(key: K, value: FormFields[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  // Filter vehicles to only those belonging to the selected customer.
  const filteredVehicles = form.customer_id
    ? vehicles.filter((v) => v.customer_id === form.customer_id)
    : vehicles;

  // ── Computed totals ──────────────────────────────────────────────────────────
  // Calculation integrity (Estimate Completion Sprint 3): derive the final totals from
  // the SAME authoritative function the server uses on persist (calculateEstimateTotals),
  // so the edit preview, the saved estimate, and the PDF always agree — including
  // discount clamping to [0, subtotal] (the total can never go negative).
  const discountAmt   = Number(form.discount_amount) || 0;
  const taxRate       = Number(form.tax_rate)        || 10;
  const totals        = calculateEstimateTotals(
    items.map((i) => ({
      quantity:      Number(i.quantity)      || 0,
      unit_price:    Number(i.unit_price)    || 0,
      discount_rate: Number(i.discount_rate) || 0,
    })),
    discountAmt,
    taxRate,
  );
  const subtotal      = totals.subtotal;
  const taxAmount     = totals.tax_amount;
  const total         = totals.total;

  // ── Item row helpers ─────────────────────────────────────────────────────────
  function updateItem(key: number, patch: Partial<ItemRow>) {
    setItems((prev) => prev.map((r) => r.key === key ? { ...r, ...patch } : r));
  }

  function addItem() {
    setItems((prev) => [...prev, emptyItem()]);
  }

  function removeItem(key: number) {
    setItems((prev) => prev.filter((r) => r.key !== key));
  }

  function addProductItem(product: GyeonProductDB) {
    setItems((prev) => [
      ...prev,
      {
        key:                   nextKey(),
        category:              "other",
        item_name:             product.product_name + (product.size_label ? ` ${product.size_label}` : ""),
        description:           product.description ?? "",
        quantity:              "1",
        unit_price:            String(product.retail_price ?? 0),
        discount_rate:         "0",
        item_type:             "product",
        product_id:            product.id,
        sku:                   product.sku,
        product_name_snapshot: product.product_name,
        retail_price_snapshot: product.retail_price,
      },
    ]);
  }

  function addSelectedServices() {
    const toAdd = serviceSelections.filter((s) => s.checked);
    if (toAdd.length === 0) return;
    setItems((prev) => [
      ...prev,
      ...toAdd.map((s) => ({
        key:                   nextKey(),
        category:              s.category,
        item_name:             s.name,
        description:           "",
        quantity:              "1",
        unit_price:            s.price || "0",
        discount_rate:         "0",
        item_type:             "manual" as const,
        product_id:            null,
        sku:                   null,
        product_name_snapshot: null,
        retail_price_snapshot: null,
      })),
    ]);
    setServiceSelections((prev) => prev.map((s) => ({ ...s, checked: false, price: "" })));
    setShowServicePanel(false);
  }

  // ── Submit ───────────────────────────────────────────────────────────────────
  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);

    const fd = new FormData();
    (Object.keys(form) as (keyof FormFields)[]).forEach((k) => fd.set(k, form[k]));

    // Computed amounts
    fd.set("subtotal",       String(subtotal));
    fd.set("tax_amount",     String(taxAmount));
    fd.set("discount_amount", String(discountAmt));
    fd.set("total",          String(total));

    // Line items serialized as JSON
    const itemsPayload = items.map((item, i) => ({
      category:              item.category,
      item_name:             item.item_name,
      description:           item.description,
      quantity:              Number(item.quantity)      || 1,
      unit_price:            Number(item.unit_price)    || 0,
      discount_rate:         Number(item.discount_rate) || 0,
      sort_order:            i,
      item_type:             item.item_type,
      product_id:            item.product_id,
      sku:                   item.sku,
      product_name_snapshot: item.product_name_snapshot,
      retail_price_snapshot: item.retail_price_snapshot,
    }));
    fd.set("items_json", JSON.stringify(itemsPayload));

    startTransition(async () => {
      const result = isEdit && estimate
        ? await updateEstimate(estimate.id, fd)
        : await createEstimate(fd);

      if (result?.error) {
        setError(result.error);
      } else {
        onSuccess?.();
        onCancel?.();
      }
    });
  }

  // ── Render ───────────────────────────────────────────────────────────────────
  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-5">

      {error && (
        <div className="bg-red-900/30 border border-red-700 rounded-lg px-3 py-2">
          <p className="text-xs text-red-400">{error}</p>
        </div>
      )}

      {/* ── Estimate No & Title ── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div className="flex flex-col gap-1">
          <label className={labelClass}>
            見積番号 <span className="text-red-400 ml-1">*</span>
          </label>
          <input
            type="text"
            value={form.estimate_no}
            onChange={(e) => setField("estimate_no", e.target.value)}
            placeholder={previewNo ? `自動採番: ${previewNo}` : "EST-0000-00001"}
            className={inputClass}
          />
          {!form.estimate_no && previewNo && (
            <p className="text-xs text-slate-500">空欄の場合、保存時に自動採番されます（次: {previewNo}）</p>
          )}
        </div>
        <div className="flex flex-col gap-1">
          <label className={labelClass}>タイトル</label>
          <input
            type="text"
            value={form.title}
            onChange={(e) => setField("title", e.target.value)}
            placeholder="例: コーティング施工一式"
            className={inputClass}
          />
        </div>
      </div>

      {/* ── Vehicle Registration OCR button ── */}
      <div className="flex items-center justify-between">
        <span className="text-xs text-slate-500">顧客・車両情報</span>
        <button
          type="button"
          onClick={() => setVehicleRegStage("upload")}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-blue-400 hover:text-blue-300 border border-blue-500/30 hover:border-blue-400/50 rounded-lg bg-blue-500/5 hover:bg-blue-500/10 transition-colors"
        >
          <span>📄</span>
          車検証から自動入力
        </button>
      </div>

      {/* ── Customer ── */}
      <div className="flex flex-col gap-1">
        <label className={labelClass}>
          顧客 <span className="text-red-400 ml-1">*</span>
        </label>
        <select
          value={form.customer_id}
          onChange={(e) => {
            setField("customer_id", e.target.value);
            setField("vehicle_id", "");
          }}
          required
          className={inputClass}
        >
          <option value="">顧客を選択...</option>
          {customers.map((c) => (
            <option key={c.id} value={c.id}>
              {[c.last_name, c.first_name].filter(Boolean).join(" ")}
              {(c.last_name_kana || c.first_name_kana)
                ? ` (${[c.last_name_kana, c.first_name_kana].filter(Boolean).join(" ")})`
                : ""}
            </option>
          ))}
        </select>
        {customers.length === 0 && (
          <p className="text-[10px] text-slate-600">顧客が登録されていません。先に顧客を作成してください。</p>
        )}
      </div>

      {/* ── Vehicle ── */}
      <div className="flex flex-col gap-1">
        <label className={labelClass}>
          車両 <span className="text-red-400 ml-1">*</span>
        </label>
        <select
          value={form.vehicle_id}
          onChange={(e) => setField("vehicle_id", e.target.value)}
          required
          disabled={!form.customer_id}
          className={inputClass}
        >
          <option value="">車両を選択...</option>
          {filteredVehicles.map((v) => (
            <option key={v.id} value={v.id}>
              {[v.maker, v.model, v.plate_number].filter(Boolean).join(" ") || v.id}
            </option>
          ))}
        </select>
        {form.customer_id && filteredVehicles.length === 0 && (
          <p className="text-[10px] text-slate-600">この顧客の車両がありません。先に車両を登録してください。</p>
        )}
        {!form.customer_id && (
          <p className="text-[10px] text-slate-600">先に顧客を選択してください。</p>
        )}
      </div>

      {/* ── Status & Valid Until ── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div className="flex flex-col gap-1">
          <label className={labelClass}>ステータス</label>
          <select
            value={form.status}
            onChange={(e) => setField("status", e.target.value as EstimateStatus)}
            className={inputClass}
          >
            {STATUSES.map((s) => (
              <option key={s.value} value={s.value}>{s.label}</option>
            ))}
          </select>
        </div>
        <div className="flex flex-col gap-1">
          <label className={labelClass}>有効期限</label>
          <input
            type="date"
            value={form.valid_until}
            onChange={(e) => setField("valid_until", e.target.value)}
            className={inputClass}
          />
        </div>
      </div>

      {/* ── Service Selection ── */}
      <div className="flex flex-col gap-2">
        <button
          type="button"
          onClick={() => setShowServicePanel((v) => !v)}
          className="flex items-center justify-between w-full text-left group"
        >
          <span className={labelClass}>サービス選択</span>
          <span className="text-xs text-slate-500 group-hover:text-slate-300 transition-colors">
            {showServicePanel ? "▲ 閉じる" : "▼ 選択して明細に追加"}
          </span>
        </button>

        {showServicePanel && (
          <div className="border border-slate-700 rounded-lg p-3 flex flex-col gap-3 bg-slate-800/20">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-y-2 gap-x-4">
              {serviceSelections.map((svc, i) => (
                <div key={svc.name} className="flex items-center gap-2 min-w-0">
                  <input
                    type="checkbox"
                    id={`svc-${i}`}
                    checked={svc.checked}
                    onChange={(e) =>
                      setServiceSelections((prev) =>
                        prev.map((s, j) => j === i ? { ...s, checked: e.target.checked } : s)
                      )
                    }
                    className="w-4 h-4 shrink-0 accent-blue-600"
                  />
                  <label
                    htmlFor={`svc-${i}`}
                    className="text-sm text-slate-300 flex-1 cursor-pointer truncate"
                  >
                    {svc.name}
                  </label>
                  {svc.checked && (
                    <div className="flex items-center gap-1 shrink-0">
                      <span className="text-xs text-slate-500">¥</span>
                      <input
                        type="number"
                        value={svc.price}
                        onChange={(e) =>
                          setServiceSelections((prev) =>
                            prev.map((s, j) => j === i ? { ...s, price: e.target.value } : s)
                          )
                        }
                        min="0"
                        placeholder="0"
                        className="w-24 bg-[#0f172a] border border-slate-700 rounded px-2 py-1 text-xs text-slate-100 text-right focus:outline-none focus:border-[#1d4ed8]"
                      />
                    </div>
                  )}
                </div>
              ))}
            </div>
            <div className="flex justify-end border-t border-slate-700/50 pt-2">
              <button
                type="button"
                onClick={addSelectedServices}
                disabled={!serviceSelections.some((s) => s.checked)}
                className="px-4 py-2 bg-[#1d4ed8] hover:bg-[#1e40af] disabled:opacity-40 disabled:cursor-not-allowed text-white text-sm font-medium rounded-lg transition-colors"
              >
                明細に追加
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Vehicle Registration OCR modal */}
      {vehicleRegStage !== "closed" && (
        <div
          className="fixed inset-0 z-50 flex items-start justify-center p-3 sm:p-4 overflow-y-auto bg-black/60"
          onClick={() => { setVehicleRegStage("closed"); setPendingOcrResult(null); }}
        >
          <div
            className="bg-[#1e293b] border border-slate-700 rounded-xl shadow-xl w-full max-w-lg p-5 sm:p-6 my-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-semibold text-slate-100">
                {vehicleRegStage === "upload" ? "車検証を読み取る" : "読み取り結果を確認"}
              </h3>
              <button
                type="button"
                onClick={() => { setVehicleRegStage("closed"); setPendingOcrResult(null); }}
                className="text-slate-500 hover:text-slate-200 text-lg leading-none transition-colors"
              >
                ✕
              </button>
            </div>

            {vehicleRegStage === "upload" && (
              <VehicleRegistrationUpload
                customerId={form.customer_id || undefined}
                vehicleId={form.vehicle_id || undefined}
                onComplete={(result) => {
                  setPendingOcrResult(result);
                  setVehicleRegStage("review");
                }}
                onCancel={() => { setVehicleRegStage("closed"); setPendingOcrResult(null); }}
              />
            )}

            {vehicleRegStage === "review" && pendingOcrResult && (
              <VehicleRegistrationOcrReview
                ocrResult={pendingOcrResult}
                onApply={(selected) => {
                  // Apply extracted vehicle info to internal_memo as reference
                  // TODO: Phase68 — match/create vehicle record directly from OCR result
                  const lines: string[] = ["【車検証読み取り結果】"];
                  const labelMap: Record<string, string> = {
                    vehicle_name: "車名",
                    maker: "メーカー",
                    model: "型式",
                    chassis_number: "車台番号",
                    license_plate_region: "ナンバー地域",
                    license_plate_class: "分類番号",
                    license_plate_kana: "かな",
                    license_plate_number: "指定番号",
                    first_registration_date: "初年度登録",
                    inspection_expiry_date: "車検有効期限",
                    owner_name: "所有者",
                    user_name: "使用者",
                    color: "色",
                    fuel_type: "燃料",
                  };
                  for (const [key, val] of Object.entries(selected)) {
                    if (val && key !== "confidence") {
                      lines.push(`${labelMap[key] ?? key}: ${val}`);
                    }
                  }
                  const ocrText = lines.join("\n");
                  setField("internal_memo",
                    form.internal_memo
                      ? `${form.internal_memo}\n\n${ocrText}`
                      : ocrText
                  );
                  setVehicleRegStage("closed");
                  setPendingOcrResult(null);
                }}
                onCancel={() => { setVehicleRegStage("closed"); setPendingOcrResult(null); }}
              />
            )}
          </div>
        </div>
      )}

      {/* ProductSelector modal */}
      {showProductSelector && (
        <ProductSelector
          onSelect={addProductItem}
          onClose={() => setShowProductSelector(false)}
        />
      )}

      {/* ── Line Items ── */}
      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <label className={labelClass}>明細</label>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setShowProductSelector(true)}
              className="text-xs text-emerald-500 hover:text-emerald-400 font-medium transition-colors"
            >
              + GYEON商品
            </button>
            <button
              type="button"
              onClick={addItem}
              className="text-xs text-[#1d4ed8] hover:text-blue-400 font-medium transition-colors"
            >
              + 行を追加
            </button>
          </div>
        </div>

        <div className="border border-slate-700 rounded-lg overflow-hidden">
          {/* Item table header */}
          <div className="grid grid-cols-[1fr_80px_90px_70px_80px_32px] gap-1 px-3 py-2 bg-slate-800/50 text-[10px] font-medium text-slate-500">
            <span>品目</span>
            <span className="text-right">単価</span>
            <span className="text-right">数量</span>
            <span className="text-right">割引%</span>
            <span className="text-right">小計</span>
            <span />
          </div>

          {/* Item rows */}
          {items.map((item) => (
            <div key={item.key} className={`border-t border-slate-700/60 px-3 py-2 flex flex-col gap-1.5 ${item.item_type === "product" ? "bg-emerald-950/20" : ""}`}>
              {/* Product badge */}
              {item.item_type === "product" && item.sku && (
                <div className="flex items-center gap-1.5">
                  <span className="text-[10px] text-emerald-400 bg-emerald-900/40 border border-emerald-800/50 px-1.5 py-0.5 rounded font-mono">GYEON {item.sku}</span>
                </div>
              )}
              {/* Row 1: category + item_name */}
              <div className="flex gap-2">
                <select
                  value={item.category}
                  onChange={(e) => updateItem(item.key, { category: e.target.value as EstimateCategory })}
                  className="bg-[#0f172a] border border-slate-700 rounded px-2 py-1 text-[11px] text-slate-400 focus:outline-none focus:border-[#1d4ed8] shrink-0 w-28"
                >
                  {CATEGORIES.map((c) => (
                    <option key={c.value} value={c.value}>{c.label}</option>
                  ))}
                </select>
                <input
                  type="text"
                  value={item.item_name}
                  onChange={(e) => updateItem(item.key, { item_name: e.target.value })}
                  placeholder="品目名"
                  className="flex-1 bg-[#0f172a] border border-slate-700 rounded px-2 py-1 text-sm text-slate-100 placeholder-slate-600 focus:outline-none focus:border-[#1d4ed8]"
                />
              </div>
              {/* Row 2: quantities */}
              <div className="grid grid-cols-[1fr_80px_90px_70px_80px_32px] gap-1 items-center">
                <input
                  type="text"
                  value={item.description}
                  onChange={(e) => updateItem(item.key, { description: e.target.value })}
                  placeholder="説明（省略可）"
                  className="bg-[#0f172a] border border-slate-700 rounded px-2 py-1 text-xs text-slate-400 placeholder-slate-600 focus:outline-none focus:border-[#1d4ed8]"
                />
                <input
                  type="number"
                  value={item.unit_price}
                  onChange={(e) => updateItem(item.key, { unit_price: e.target.value })}
                  min="0"
                  className="bg-[#0f172a] border border-slate-700 rounded px-2 py-1 text-xs text-slate-100 text-right focus:outline-none focus:border-[#1d4ed8]"
                />
                <input
                  type="number"
                  value={item.quantity}
                  onChange={(e) => updateItem(item.key, { quantity: e.target.value })}
                  min="0"
                  step="0.01"
                  className="bg-[#0f172a] border border-slate-700 rounded px-2 py-1 text-xs text-slate-100 text-right focus:outline-none focus:border-[#1d4ed8]"
                />
                <input
                  type="number"
                  value={item.discount_rate}
                  onChange={(e) => updateItem(item.key, { discount_rate: e.target.value })}
                  min="0"
                  max="100"
                  className="bg-[#0f172a] border border-slate-700 rounded px-2 py-1 text-xs text-slate-100 text-right focus:outline-none focus:border-[#1d4ed8]"
                />
                <span className="text-xs text-slate-300 text-right font-medium">
                  ¥{lineTotal(item).toLocaleString("ja-JP")}
                </span>
                <button
                  type="button"
                  onClick={() => removeItem(item.key)}
                  className="text-slate-600 hover:text-red-400 text-sm leading-none transition-colors"
                  title="削除"
                >
                  ✕
                </button>
              </div>
            </div>
          ))}

          {items.length === 0 && (
            <div className="px-3 py-4 text-center text-xs text-slate-600">
              明細がありません。「+ 行を追加」から追加してください。
            </div>
          )}
        </div>
      </div>

      {/* ── Totals ── */}
      <div className="flex justify-end">
        <div className="w-60 flex flex-col gap-1.5">
          <div className="flex justify-between text-xs text-slate-400">
            <span>小計</span>
            <span>¥{subtotal.toLocaleString("ja-JP")}</span>
          </div>
          <div className="flex justify-between items-center gap-2">
            <span className="text-xs text-red-400 shrink-0">値引き</span>
            <div className="flex items-center gap-1">
              <span className="text-xs text-red-400">¥</span>
              <input
                type="number"
                value={form.discount_amount}
                onChange={(e) => setField("discount_amount", e.target.value)}
                min="0"
                className="w-24 bg-[#0f172a] border border-slate-700 rounded px-2 py-1 text-xs text-red-400 text-right focus:outline-none focus:border-[#1d4ed8]"
              />
            </div>
          </div>
          <div className="flex justify-between items-center gap-2">
            <div className="flex items-center gap-1">
              <span className="text-xs text-slate-400">消費税</span>
              <input
                type="number"
                value={form.tax_rate}
                onChange={(e) => setField("tax_rate", e.target.value)}
                min="0"
                max="100"
                className="w-12 bg-[#0f172a] border border-slate-700 rounded px-2 py-1 text-xs text-slate-400 text-right focus:outline-none focus:border-[#1d4ed8]"
              />
              <span className="text-xs text-slate-400">%</span>
            </div>
            <span className="text-xs text-slate-400">¥{taxAmount.toLocaleString("ja-JP")}</span>
          </div>
          <div className="flex justify-between border-t border-slate-600 pt-2 mt-1">
            <span className="text-sm font-bold text-slate-100">合計</span>
            <span className="text-base font-bold text-slate-100">¥{total.toLocaleString("ja-JP")}</span>
          </div>
        </div>
      </div>

      {/* ── Notes & Internal Memo ── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div className="flex flex-col gap-1">
          <label className={labelClass}>備考（顧客向け）</label>
          <textarea
            value={form.notes}
            onChange={(e) => setField("notes", e.target.value)}
            rows={3}
            placeholder="見積書に記載するメモ..."
            className={`${inputClass} resize-none`}
          />
        </div>
        <div className="flex flex-col gap-1">
          <label className={labelClass}>内部メモ</label>
          <textarea
            value={form.internal_memo}
            onChange={(e) => setField("internal_memo", e.target.value)}
            rows={3}
            placeholder="社内向けメモ（PDFには出力されません）..."
            className={`${inputClass} resize-none`}
          />
        </div>
      </div>

      {/* ── Buttons ── */}
      <div className="flex justify-end gap-2 pt-2 border-t border-slate-700">
        <button
          type="button"
          onClick={onCancel}
          disabled={pending}
          className="px-4 py-2 text-sm font-medium text-slate-400 hover:text-slate-100 hover:bg-slate-700 rounded-lg transition-colors disabled:opacity-50"
        >
          キャンセル
        </button>
        <button
          type="submit"
          disabled={pending}
          className="px-4 py-2 text-sm font-medium bg-[#1d4ed8] hover:bg-[#1e40af] text-white rounded-lg transition-colors disabled:opacity-50"
        >
          {pending ? "保存中..." : isEdit ? "更新" : "保存"}
        </button>
      </div>
    </form>
  );
}
