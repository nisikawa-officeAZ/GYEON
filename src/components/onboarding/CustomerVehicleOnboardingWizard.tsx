"use client";

// Sprint 7: Standalone Customer & Vehicle onboarding flow
// Flow: Customer Selection → (if new) OCR or Manual → Customer Form → Vehicle Form → Confirm → Create

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import dynamic from "next/dynamic";
import type { CustomerDB } from "@/lib/customers/customer-types";
import { customerDisplayName } from "@/lib/customers/customer-types";
import type { VehicleDB } from "@/lib/vehicles/vehicle-types";
import { findCustomerDuplicates }  from "@/lib/customers/find-customer-duplicates";
import { findVehicleByVinOrPlate } from "@/lib/vehicles/find-vehicle-by-vin-or-plate";
import { registerCustomerAndVehicleFromOcr } from "@/lib/ocr/register-from-ocr";
import type { VehicleRegistrationOcrResult } from "@/lib/vehicle-registration/vehicle-registration-types";
import type { OcrSessionMeta }               from "@/lib/ocr/ocr-session-types";
import {
  mapOcrToCustomer,
  EMPTY_CUSTOMER_FORM,
  type CustomerFormState,
} from "@/lib/ocr/customer-mapper";
import {
  mapOcrToVehicle,
  EMPTY_VEHICLE_FORM,
  type VehicleFormState,
} from "@/lib/ocr/vehicle-mapper";

const VehicleRegistrationUpload = dynamic(
  () => import("@/components/vehicle-registration/VehicleRegistrationUpload"),
  { ssr: false },
);
const VehicleRegistrationOcrReview = dynamic(
  () => import("@/components/vehicle-registration/VehicleRegistrationOcrReview"),
  { ssr: false },
);

// ── Types ─────────────────────────────────────────────────────────────────────

type Screen =
  | "customer-select"
  | "customer-method"
  | "ocr-upload"
  | "ocr-review"
  | "customer-form"
  | "vehicle-form"
  | "confirm";

interface Props {
  customers:  CustomerDB[];
  onComplete: (customerId: string, vehicleId: string) => void;
  onCancel:   () => void;
}

// ── Constants ─────────────────────────────────────────────────────────────────

const BODY_SIZE_OPTIONS: { key: string; label: string }[] = [
  { key: "SS",  label: "SS — 軽・コンパクト" },
  { key: "S",   label: "S — 小型" },
  { key: "M",   label: "M — 中型セダン" },
  { key: "ML",  label: "ML — 大型セダン" },
  { key: "L",   label: "L — 大型SUV" },
  { key: "LL",  label: "LL — 超大型SUV" },
  { key: "XL",  label: "XL — スーパーカー" },
  { key: "XXL", label: "XXL — 大型スーパーカー" },
];

const STEP_LABELS: Record<Screen, string> = {
  "customer-select": "顧客選択",
  "customer-method": "入力方法",
  "ocr-upload":      "車検証スキャン",
  "ocr-review":      "OCR結果確認",
  "customer-form":   "顧客情報",
  "vehicle-form":    "車両情報",
  "confirm":         "確認・登録",
};

// ── Shared styles ─────────────────────────────────────────────────────────────

const inputCls =
  "w-full bg-[#1e293b] border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-200 " +
  "focus:outline-none focus:border-blue-500 placeholder:text-slate-600";
const labelCls = "text-xs text-slate-400 font-medium";

// ── Sub-components ────────────────────────────────────────────────────────────

function ConfirmRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex gap-2 text-xs">
      <span className="text-slate-500 w-24 shrink-0">{label}</span>
      <span className="text-slate-200 break-all">{value}</span>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export default function CustomerVehicleOnboardingWizard({
  customers,
  onComplete,
  onCancel,
}: Props) {
  const [history, setHistory] = useState<Screen[]>(["customer-select"]);
  const screen = history[history.length - 1];

  const push = (s: Screen) => setHistory(h => [...h, s]);
  const pop  = () => setHistory(h => (h.length > 1 ? h.slice(0, -1) : h));

  const [existingCustomerId, setExistingCustomerId] = useState<string | null>(null);
  const [createdCustomerId,  setCreatedCustomerId]  = useState<string | null>(null);
  const [customerSearch,     setCustomerSearch]     = useState("");
  const [ocrResult,          setOcrResult]          = useState<VehicleRegistrationOcrResult | null>(null);
  const [customerForm,       setCustomerForm]       = useState<CustomerFormState>(EMPTY_CUSTOMER_FORM);
  const [vehicleForm,        setVehicleForm]        = useState<VehicleFormState>(EMPTY_VEHICLE_FORM);
  const [error,              setError]              = useState<string | null>(null);
  const [isPending,          startTransition]       = useTransition();
  const [ocrSessionId,       setOcrSessionId]       = useState<string | null>(null);
  const [ocrSessionSaved,    setOcrSessionSaved]    = useState<boolean>(false);
  const [customerDup,        setCustomerDup]        = useState<CustomerDB[]>([]);
  const [vehicleDup,         setVehicleDup]         = useState<VehicleDB[]>([]);
  // Sprint 5 — when set, the user chose to UPDATE an existing vehicle instead of
  // creating a new one (no automatic overwrite — they are routed to edit it).
  const [adoptedVehicleId,   setAdoptedVehicleId]   = useState<string | null>(null);

  const router = useRouter();

  const isNewCustomer = existingCustomerId === null;

  const selectedCustomer = existingCustomerId
    ? (customers.find(c => c.id === existingCustomerId) ?? null)
    : null;

  const filteredCustomers = customerSearch.trim()
    ? customers.filter(c => {
        const q = customerSearch.toLowerCase();
        return (
          customerDisplayName(c).toLowerCase().includes(q) ||
          (c.phone?.includes(customerSearch) ?? false)
        );
      })
    : customers;

  function setCustomerField<K extends keyof CustomerFormState>(key: K, val: CustomerFormState[K]) {
    setCustomerForm(f => ({ ...f, [key]: val }));
  }

  function setVehicleField<K extends keyof VehicleFormState>(key: K, val: VehicleFormState[K]) {
    setVehicleForm(f => ({ ...f, [key]: val }));
  }

  function applyOcrFields(selected: Partial<VehicleRegistrationOcrResult>) {
    const customerData = mapOcrToCustomer(selected);
    const vehicleData  = mapOcrToVehicle(selected);
    setCustomerForm(f => ({ ...f, ...customerData }));
    setVehicleForm(f  => ({ ...f, ...vehicleData }));
  }

  function handleOcrComplete(result: VehicleRegistrationOcrResult, meta?: OcrSessionMeta) {
    setOcrResult(result);
    setOcrSessionId(meta?.sessionId ?? null);
    setOcrSessionSaved(meta?.sessionPersisted ?? false);
    push("ocr-review");
  }

  function handleOcrApply(selected: Partial<VehicleRegistrationOcrResult>) {
    applyOcrFields(selected);
    push("customer-form");
  }

  // Phase 2 Sprint 1 — non-blocking duplicate detection before the confirm step.
  // Surfaces likely existing customers/vehicles; the user may still proceed.
  async function runDuplicateChecks() {
    try {
      if (isNewCustomer) {
        const dups = await findCustomerDuplicates({
          last_name:  customerForm.last_name.trim()  || undefined,
          first_name: customerForm.first_name.trim() || undefined,
          phone:      customerForm.phone.trim()       || undefined,
        });
        setCustomerDup(dups);
      } else {
        setCustomerDup([]);
      }

      const vdups = await findVehicleByVinOrPlate({
        vin:          vehicleForm.vin.trim()          || undefined,
        plate_number: vehicleForm.plate_number.trim() || undefined,
      });
      setVehicleDup(vdups);
    } catch {
      // Duplicate detection is advisory only — never block the flow.
    }
  }

  function goToConfirm() {
    setCustomerDup([]);
    setVehicleDup([]);
    setAdoptedVehicleId(null);
    void runDuplicateChecks();
    push("confirm");
  }

  // Sprint 5 — adopt an existing customer found by duplicate detection instead of
  // creating a new one. Reuses the existing `existingCustomerId` path.
  function useExistingCustomer(id: string) {
    setExistingCustomerId(id);
    setError(null);
  }

  function handleConfirm() {
    // Sprint 5 — "update existing vehicle" decision: never overwrite automatically;
    // route the user to the existing vehicle's page to update it manually.
    if (adoptedVehicleId) {
      router.push(`/vehicles/${adoptedVehicleId}`);
      return;
    }

    setError(null);
    startTransition(async () => {
      // New customer requires a surname; existing/retry paths skip this check.
      if (isNewCustomer && !createdCustomerId && !customerForm.last_name.trim()) {
        setError("姓は必須です");
        return;
      }

      // existingCustomerId (selected) OR createdCustomerId (retry) → reuse without
      // creating a duplicate. Otherwise the orchestration creates a new customer.
      const reuseCustomerId = existingCustomerId ?? createdCustomerId ?? null;

      const result = await registerCustomerAndVehicleFromOcr({
        existingCustomerId: reuseCustomerId,
        customer:           customerForm,
        vehicle:            vehicleForm,
        sessionId:          ocrSessionId,
        reviewedResult:     ocrResult,
      });

      if (!result.success) {
        // If a customer was created before the vehicle step failed, remember its
        // id so a retry reuses it instead of creating a duplicate.
        if (result.customerId) setCreatedCustomerId(result.customerId);
        setError(result.error);
        return;
      }

      onComplete(result.customerId, result.vehicleId);
    });
  }

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="flex flex-col gap-4">

      {/* Step label + back/cancel */}
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold text-slate-300 tracking-wide">
          {STEP_LABELS[screen]}
        </span>
        {history.length > 1 ? (
          <button
            type="button"
            onClick={pop}
            disabled={isPending}
            className="text-xs text-slate-400 hover:text-slate-200 disabled:opacity-40 transition-colors"
          >
            ← 戻る
          </button>
        ) : (
          <button
            type="button"
            onClick={onCancel}
            disabled={isPending}
            className="text-xs text-slate-400 hover:text-slate-200 disabled:opacity-40 transition-colors"
          >
            キャンセル
          </button>
        )}
      </div>

      {/* ── customer-select ─────────────────────────────────────────── */}
      {screen === "customer-select" && (
        <div className="flex flex-col gap-3">
          <input
            type="text"
            value={customerSearch}
            onChange={e => setCustomerSearch(e.target.value)}
            placeholder="氏名・電話番号で検索..."
            className={inputCls}
          />

          <div className="flex flex-col gap-1 max-h-64 overflow-y-auto">
            {filteredCustomers.length === 0 && (
              <p className="text-xs text-slate-500 text-center py-4">
                {customerSearch.trim() ? "見つかりません" : "登録済み顧客がありません"}
              </p>
            )}
            {filteredCustomers.map(c => (
              <button
                key={c.id}
                type="button"
                onClick={() => {
                  setExistingCustomerId(c.id);
                  push("vehicle-form");
                }}
                className="flex items-center justify-between px-3 py-2.5 rounded-lg border border-slate-700 hover:border-blue-500/50 hover:bg-blue-950/20 transition-colors text-left"
              >
                <div>
                  <p className="text-sm text-slate-200 font-medium">{customerDisplayName(c)}</p>
                  {c.phone && <p className="text-xs text-slate-500">{c.phone}</p>}
                </div>
                <span className="text-slate-500 text-xs">→</span>
              </button>
            ))}
          </div>

          <div className="border-t border-slate-700/50 pt-3">
            <button
              type="button"
              onClick={() => {
                setExistingCustomerId(null);
                push("customer-method");
              }}
              className="w-full px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg transition-colors"
            >
              + 新規顧客登録
            </button>
          </div>
        </div>
      )}

      {/* ── customer-method ─────────────────────────────────────────── */}
      {screen === "customer-method" && (
        <div className="flex flex-col gap-3">
          <p className="text-xs text-slate-400 text-center">顧客情報の入力方法を選択してください</p>

          <button
            type="button"
            onClick={() => push("ocr-upload")}
            className="flex items-start gap-3 px-4 py-4 rounded-xl border border-slate-700 hover:border-blue-500/50 hover:bg-blue-950/20 bg-[#0f172a] transition-colors text-left"
          >
            <span className="text-2xl shrink-0">📷</span>
            <div>
              <p className="text-sm font-medium text-slate-200">車検証をスキャン</p>
              <p className="text-xs text-slate-500 mt-0.5">AI が顧客・車両情報を自動入力</p>
            </div>
          </button>

          <button
            type="button"
            onClick={() => push("customer-form")}
            className="flex items-start gap-3 px-4 py-4 rounded-xl border border-slate-700 hover:border-slate-600 bg-[#0f172a] transition-colors text-left"
          >
            <span className="text-2xl shrink-0">✏️</span>
            <div>
              <p className="text-sm font-medium text-slate-200">手動入力</p>
              <p className="text-xs text-slate-500 mt-0.5">フォームに直接入力</p>
            </div>
          </button>
        </div>
      )}

      {/* ── ocr-upload ──────────────────────────────────────────────── */}
      {screen === "ocr-upload" && (
        <VehicleRegistrationUpload
          onComplete={handleOcrComplete}
          onCancel={pop}
        />
      )}

      {/* ── ocr-review ──────────────────────────────────────────────── */}
      {screen === "ocr-review" && ocrResult && (
        <div className="flex flex-col gap-3">
          {/* Session persistence status badge */}
          <div className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border text-[11px] ${
            ocrSessionSaved
              ? "border-green-500/30 bg-green-500/8 text-green-400"
              : "border-slate-700 bg-slate-800/40 text-slate-500"
          }`}>
            <span>{ocrSessionSaved ? "✓" : "○"}</span>
            <span>
              {ocrSessionSaved
                ? "OCRセッション保存済み"
                : ocrSessionId
                  ? "OCRセッション保存中..."
                  : "OCRセッション未保存（マイグレーション 068 未適用）"}
            </span>
          </div>

          <VehicleRegistrationOcrReview
            ocrResult={ocrResult}
            onApply={handleOcrApply}
            onCancel={pop}
          />
        </div>
      )}

      {/* ── customer-form ───────────────────────────────────────────── */}
      {screen === "customer-form" && (
        <div className="flex flex-col gap-3">
          {ocrResult && (
            <div className="flex items-start gap-2 px-3 py-2 rounded-lg border border-blue-500/30 bg-blue-500/5">
              <span className="text-blue-400 text-xs shrink-0">i</span>
              <p className="text-xs text-blue-300">車検証から読み取った情報が入力されています。内容を確認してください。</p>
            </div>
          )}

          <div className="grid grid-cols-2 gap-2">
            <div className="flex flex-col gap-1">
              <label className={labelCls}>姓 *</label>
              <input
                type="text"
                value={customerForm.last_name}
                onChange={e => setCustomerField("last_name", e.target.value)}
                placeholder="山田"
                className={inputCls}
              />
            </div>
            <div className="flex flex-col gap-1">
              <label className={labelCls}>名</label>
              <input
                type="text"
                value={customerForm.first_name}
                onChange={e => setCustomerField("first_name", e.target.value)}
                placeholder="太郎"
                className={inputCls}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div className="flex flex-col gap-1">
              <label className={labelCls}>姓（カナ）</label>
              <input
                type="text"
                value={customerForm.last_name_kana}
                onChange={e => setCustomerField("last_name_kana", e.target.value)}
                placeholder="ヤマダ"
                className={inputCls}
              />
            </div>
            <div className="flex flex-col gap-1">
              <label className={labelCls}>名（カナ）</label>
              <input
                type="text"
                value={customerForm.first_name_kana}
                onChange={e => setCustomerField("first_name_kana", e.target.value)}
                placeholder="タロウ"
                className={inputCls}
              />
            </div>
          </div>

          <div className="flex flex-col gap-1">
            <label className={labelCls}>電話番号</label>
            <input
              type="tel"
              value={customerForm.phone}
              onChange={e => setCustomerField("phone", e.target.value)}
              placeholder="090-0000-0000"
              className={inputCls}
            />
          </div>

          <div className="flex flex-col gap-1">
            <label className={labelCls}>メールアドレス</label>
            <input
              type="email"
              value={customerForm.email}
              onChange={e => setCustomerField("email", e.target.value)}
              placeholder="example@mail.com"
              className={inputCls}
            />
          </div>

          <div className="flex flex-col gap-1">
            <label className={labelCls}>郵便番号</label>
            <input
              type="text"
              value={customerForm.postal_code}
              onChange={e => setCustomerField("postal_code", e.target.value)}
              placeholder="150-0001"
              className={inputCls}
            />
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div className="flex flex-col gap-1">
              <label className={labelCls}>都道府県</label>
              <input
                type="text"
                value={customerForm.prefecture}
                onChange={e => setCustomerField("prefecture", e.target.value)}
                placeholder="東京都"
                className={inputCls}
              />
            </div>
            <div className="flex flex-col gap-1">
              <label className={labelCls}>市区町村</label>
              <input
                type="text"
                value={customerForm.city}
                onChange={e => setCustomerField("city", e.target.value)}
                placeholder="渋谷区"
                className={inputCls}
              />
            </div>
          </div>

          <div className="flex flex-col gap-1">
            <label className={labelCls}>番地・建物名</label>
            <input
              type="text"
              value={customerForm.address1}
              onChange={e => setCustomerField("address1", e.target.value)}
              placeholder="神宮前１丁目１番１号"
              className={inputCls}
            />
          </div>

          <div className="flex flex-col gap-1">
            <label className={labelCls}>LINE ID</label>
            <input
              type="text"
              value={customerForm.line_user_id}
              onChange={e => setCustomerField("line_user_id", e.target.value)}
              placeholder="@line_id"
              className={inputCls}
            />
          </div>

          <div className="flex flex-col gap-1">
            <label className={labelCls}>内部メモ</label>
            <textarea
              value={customerForm.notes}
              onChange={e => setCustomerField("notes", e.target.value)}
              rows={2}
              placeholder="内部メモ（顧客には非表示）"
              className={`${inputCls} resize-none`}
            />
          </div>

          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={customerForm.is_company}
              onChange={e => setCustomerField("is_company", e.target.checked)}
              className="accent-blue-500"
            />
            <span className="text-sm text-slate-300">法人顧客</span>
          </label>

          <button
            type="button"
            onClick={() => {
              if (!customerForm.last_name.trim()) return;
              push("vehicle-form");
            }}
            disabled={!customerForm.last_name.trim()}
            className="w-full px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed text-white text-sm font-medium rounded-lg transition-colors mt-1"
          >
            次へ → 車両情報
          </button>
        </div>
      )}

      {/* ── vehicle-form ────────────────────────────────────────────── */}
      {screen === "vehicle-form" && (
        <div className="flex flex-col gap-3">
          {selectedCustomer && (
            <div className="px-3 py-2 rounded-lg border border-blue-500/30 bg-blue-950/10">
              <p className="text-xs text-blue-300">
                顧客: {customerDisplayName(selectedCustomer)}
              </p>
            </div>
          )}

          {ocrResult && !selectedCustomer && (
            <div className="flex items-start gap-2 px-3 py-2 rounded-lg border border-blue-500/30 bg-blue-500/5">
              <span className="text-blue-400 text-xs shrink-0">i</span>
              <p className="text-xs text-blue-300">車検証から読み取った情報が入力されています。</p>
            </div>
          )}

          <div className="grid grid-cols-2 gap-2">
            <div className="flex flex-col gap-1">
              <label className={labelCls}>メーカー</label>
              <input
                type="text"
                value={vehicleForm.maker}
                onChange={e => setVehicleField("maker", e.target.value)}
                placeholder="Toyota"
                className={inputCls}
              />
            </div>
            <div className="flex flex-col gap-1">
              <label className={labelCls}>車名</label>
              <input
                type="text"
                value={vehicleForm.model}
                onChange={e => setVehicleField("model", e.target.value)}
                placeholder="クラウン"
                className={inputCls}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div className="flex flex-col gap-1">
              <label className={labelCls}>グレード</label>
              <input
                type="text"
                value={vehicleForm.grade}
                onChange={e => setVehicleField("grade", e.target.value)}
                placeholder="G"
                className={inputCls}
              />
            </div>
            <div className="flex flex-col gap-1">
              <label className={labelCls}>年式</label>
              <input
                type="text"
                value={vehicleForm.year}
                onChange={e => setVehicleField("year", e.target.value)}
                placeholder="2023"
                className={inputCls}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div className="flex flex-col gap-1">
              <label className={labelCls}>カラー</label>
              <input
                type="text"
                value={vehicleForm.color}
                onChange={e => setVehicleField("color", e.target.value)}
                placeholder="ホワイトパール"
                className={inputCls}
              />
            </div>
            <div className="flex flex-col gap-1">
              <label className={labelCls}>ナンバープレート</label>
              <input
                type="text"
                value={vehicleForm.plate_number}
                onChange={e => setVehicleField("plate_number", e.target.value)}
                placeholder="品川 500 あ 1234"
                className={inputCls}
              />
            </div>
          </div>

          <div className="flex flex-col gap-1">
            <label className={labelCls}>車台番号（VIN）</label>
            <input
              type="text"
              value={vehicleForm.vin}
              onChange={e => setVehicleField("vin", e.target.value)}
              placeholder="ABC1234567890"
              className={inputCls}
            />
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div className="flex flex-col gap-1">
              <label className={labelCls}>型式指定番号</label>
              <input
                type="text"
                value={vehicleForm.model_code}
                onChange={e => setVehicleField("model_code", e.target.value)}
                placeholder="AB1234"
                className={inputCls}
              />
            </div>
            <div className="flex flex-col gap-1">
              <label className={labelCls}>燃料種類</label>
              <input
                type="text"
                value={vehicleForm.fuel_type}
                onChange={e => setVehicleField("fuel_type", e.target.value)}
                placeholder="ガソリン"
                className={inputCls}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div className="flex flex-col gap-1">
              <label className={labelCls}>排気量</label>
              <input
                type="text"
                value={vehicleForm.displacement}
                onChange={e => setVehicleField("displacement", e.target.value)}
                placeholder="1998cc"
                className={inputCls}
              />
            </div>
            <div className="flex flex-col gap-1">
              <label className={labelCls}>初年度登録</label>
              <input
                type="text"
                value={vehicleForm.registration_date}
                onChange={e => setVehicleField("registration_date", e.target.value)}
                placeholder="2021-01"
                className={inputCls}
              />
            </div>
          </div>

          <div className="flex flex-col gap-1">
            <label className={labelCls}>ボディサイズ</label>
            <select
              value={vehicleForm.body_size}
              onChange={e => setVehicleField("body_size", e.target.value)}
              className={inputCls}
            >
              <option value="">選択してください</option>
              {BODY_SIZE_OPTIONS.map(o => (
                <option key={o.key} value={o.key}>{o.label}</option>
              ))}
            </select>
          </div>

          <div className="flex flex-col gap-1">
            <label className={labelCls}>車検有効期限</label>
            <input
              type="date"
              value={vehicleForm.inspection_expiry_date}
              onChange={e => setVehicleField("inspection_expiry_date", e.target.value)}
              className={inputCls}
            />
          </div>

          <div className="flex flex-col gap-1">
            <label className={labelCls}>内部メモ</label>
            <textarea
              value={vehicleForm.notes}
              onChange={e => setVehicleField("notes", e.target.value)}
              rows={2}
              placeholder="内部メモ（顧客には非表示）"
              className={`${inputCls} resize-none`}
            />
          </div>

          <button
            type="button"
            onClick={goToConfirm}
            className="w-full px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg transition-colors mt-1"
          >
            次へ → 確認
          </button>
        </div>
      )}

      {/* ── confirm ─────────────────────────────────────────────────── */}
      {screen === "confirm" && (
        <div className="flex flex-col gap-4">

          {/* Customer summary */}
          {isNewCustomer && (
            <div className="rounded-xl border border-slate-700 overflow-hidden">
              <div className="px-4 py-2 bg-slate-800/60 border-b border-slate-700">
                <p className="text-xs font-semibold text-slate-300">顧客情報（新規）</p>
              </div>
              <div className="px-4 py-3 flex flex-col gap-1.5">
                <ConfirmRow
                  label="氏名"
                  value={[customerForm.last_name, customerForm.first_name].filter(Boolean).join(" ")}
                />
                {customerForm.phone        && <ConfirmRow label="電話"     value={customerForm.phone} />}
                {customerForm.email        && <ConfirmRow label="Email"   value={customerForm.email} />}
                {customerForm.postal_code  && <ConfirmRow label="郵便番号" value={customerForm.postal_code} />}
                {customerForm.prefecture   && <ConfirmRow label="都道府県" value={customerForm.prefecture} />}
                {customerForm.city         && <ConfirmRow label="市区町村" value={customerForm.city} />}
                {customerForm.address1     && <ConfirmRow label="番地"     value={customerForm.address1} />}
                {customerForm.is_company   && <ConfirmRow label="法人"     value="はい" />}
              </div>
            </div>
          )}

          {!isNewCustomer && selectedCustomer && (
            <div className="px-4 py-3 rounded-xl border border-slate-700">
              <p className="text-xs font-semibold text-slate-300 mb-1.5">顧客情報（既存）</p>
              <p className="text-sm text-slate-200">{customerDisplayName(selectedCustomer)}</p>
            </div>
          )}

          {/* Vehicle summary */}
          <div className="rounded-xl border border-slate-700 overflow-hidden">
            <div className="px-4 py-2 bg-slate-800/60 border-b border-slate-700">
              <p className="text-xs font-semibold text-slate-300">車両情報（新規）</p>
            </div>
            <div className="px-4 py-3 flex flex-col gap-1.5">
              {vehicleForm.maker        && <ConfirmRow label="メーカー"     value={vehicleForm.maker} />}
              {vehicleForm.model        && <ConfirmRow label="車名"         value={vehicleForm.model} />}
              {vehicleForm.grade        && <ConfirmRow label="グレード"     value={vehicleForm.grade} />}
              {vehicleForm.year         && <ConfirmRow label="年式"         value={vehicleForm.year} />}
              {vehicleForm.color        && <ConfirmRow label="色"           value={vehicleForm.color} />}
              {vehicleForm.plate_number && <ConfirmRow label="ナンバー"     value={vehicleForm.plate_number} />}
              {vehicleForm.vin          && <ConfirmRow label="VIN"          value={vehicleForm.vin} />}
              {vehicleForm.body_size    && <ConfirmRow label="ボディサイズ" value={vehicleForm.body_size} />}
              {vehicleForm.inspection_expiry_date && (
                <ConfirmRow label="車検期限" value={vehicleForm.inspection_expiry_date} />
              )}
              {!vehicleForm.maker && !vehicleForm.model && !vehicleForm.plate_number && (
                <p className="text-xs text-slate-500">（車両情報未入力）</p>
              )}
            </div>
          </div>

          {/* Registration / Update decision summary */}
          <div className="flex flex-wrap gap-2 px-3 py-2 rounded-lg border border-slate-700 bg-[#0f172a]">
            <span className="text-[11px] text-slate-500">登録内容:</span>
            <span className="text-[11px] text-slate-300">
              顧客 = {isNewCustomer ? "新規作成" : "既存を使用"}
            </span>
            <span className="text-[11px] text-slate-300">
              車両 = {adoptedVehicleId ? "既存を更新" : "新規作成"}
            </span>
          </div>

          {/* Advisory duplicate review with selection — non-blocking; registration may
              proceed. Detection helpers are unchanged; only the review/selection UI is added. */}
          {(customerDup.length > 0 || vehicleDup.length > 0) && (
            <div className="flex flex-col gap-2 px-3 py-2.5 rounded-lg border border-amber-500/30 bg-amber-500/10">
              <p className="text-xs text-amber-300 font-medium">
                重複の可能性があります（既存の記録を使用するか、このまま新規登録できます）
              </p>

              {customerDup.length > 0 && (
                <div className="flex flex-col gap-1">
                  <p className="text-[11px] text-amber-200/90 font-medium">
                    同名・同電話番号の顧客 {customerDup.length} 件
                  </p>
                  {customerDup.slice(0, 3).map((c) => {
                    const selected = existingCustomerId === c.id;
                    return (
                      <div key={c.id} className="flex items-center justify-between gap-2 pl-2">
                        <span className="text-[11px] text-amber-200/70 truncate">
                          {customerDisplayName(c)}{c.phone ? `（${c.phone}）` : ""}
                        </span>
                        {selected ? (
                          <span className="text-[10px] text-emerald-300 shrink-0">✓ 使用中</span>
                        ) : (
                          <button
                            type="button"
                            onClick={() => useExistingCustomer(c.id)}
                            className="text-[10px] text-blue-300 hover:text-blue-200 border border-blue-500/30 px-2 py-0.5 rounded shrink-0"
                          >
                            この顧客を使用
                          </button>
                        )}
                      </div>
                    );
                  })}
                  {!isNewCustomer && (
                    <button
                      type="button"
                      onClick={() => setExistingCustomerId(null)}
                      className="self-start text-[10px] text-slate-400 hover:text-slate-200 underline mt-0.5"
                    >
                      新規顧客の作成に戻す
                    </button>
                  )}
                </div>
              )}

              {vehicleDup.length > 0 && (
                <div className="flex flex-col gap-1">
                  <p className="text-[11px] text-amber-200/90 font-medium">
                    同じVIN・ナンバーの車両 {vehicleDup.length} 件
                  </p>
                  {vehicleDup.slice(0, 3).map((v) => {
                    const selected = adoptedVehicleId === v.id;
                    return (
                      <div key={v.id} className="flex items-center justify-between gap-2 pl-2">
                        <span className="text-[11px] text-amber-200/70 truncate">
                          {[v.maker, v.model].filter(Boolean).join(" ") || "車両"}
                          {v.plate_number ? `（${v.plate_number}）` : v.vin ? `（${v.vin}）` : ""}
                        </span>
                        {selected ? (
                          <span className="text-[10px] text-emerald-300 shrink-0">✓ 更新対象</span>
                        ) : (
                          <button
                            type="button"
                            onClick={() => setAdoptedVehicleId(v.id)}
                            className="text-[10px] text-blue-300 hover:text-blue-200 border border-blue-500/30 px-2 py-0.5 rounded shrink-0"
                          >
                            この車両を更新
                          </button>
                        )}
                      </div>
                    );
                  })}
                  {adoptedVehicleId && (
                    <button
                      type="button"
                      onClick={() => setAdoptedVehicleId(null)}
                      className="self-start text-[10px] text-slate-400 hover:text-slate-200 underline mt-0.5"
                    >
                      新規車両の作成に戻す
                    </button>
                  )}
                </div>
              )}
            </div>
          )}

          {error && (
            <div className="flex items-start gap-2 px-3 py-2 rounded-lg border border-red-500/30 bg-red-500/10">
              <span className="text-red-400 shrink-0 text-xs">✕</span>
              <p className="text-xs text-red-400">{error}</p>
            </div>
          )}

          <button
            type="button"
            onClick={handleConfirm}
            disabled={isPending || (!adoptedVehicleId && isNewCustomer && !customerForm.last_name.trim())}
            className="w-full px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-40 disabled:cursor-not-allowed text-white text-sm font-semibold rounded-lg transition-colors"
          >
            {adoptedVehicleId
              ? "既存車両の更新へ"
              : isPending ? "登録中..." : "登録して見積作成へ"}
          </button>
        </div>
      )}

    </div>
  );
}
