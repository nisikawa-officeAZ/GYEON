"use client";

// Sprint 7: Standalone Customer & Vehicle onboarding flow
// Flow: Customer Selection → (if new) OCR or Manual → Customer Form → Vehicle Form → Confirm → Create

import { useState, useTransition } from "react";
import dynamic from "next/dynamic";
import { createCustomer } from "@/lib/customers/create-customer";
import { createVehicle }  from "@/lib/vehicles/create-vehicle";
import type { CustomerDB } from "@/lib/customers/customer-types";
import { customerDisplayName } from "@/lib/customers/customer-types";
import type { VehicleRegistrationOcrResult } from "@/lib/vehicle-registration/vehicle-registration-types";
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
  const [customerSearch,     setCustomerSearch]     = useState("");
  const [ocrResult,          setOcrResult]          = useState<VehicleRegistrationOcrResult | null>(null);
  const [customerForm,       setCustomerForm]       = useState<CustomerFormState>(EMPTY_CUSTOMER_FORM);
  const [vehicleForm,        setVehicleForm]        = useState<VehicleFormState>(EMPTY_VEHICLE_FORM);
  const [error,              setError]              = useState<string | null>(null);
  const [isPending,          startTransition]       = useTransition();

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

  function handleOcrComplete(result: VehicleRegistrationOcrResult) {
    setOcrResult(result);
    push("ocr-review");
  }

  function handleOcrApply(selected: Partial<VehicleRegistrationOcrResult>) {
    applyOcrFields(selected);
    push("customer-form");
  }

  function handleConfirm() {
    setError(null);
    startTransition(async () => {
      let customerId = existingCustomerId ?? "";

      if (isNewCustomer) {
        if (!customerForm.last_name.trim()) {
          setError("姓は必須です");
          return;
        }

        const fd = new FormData();
        fd.set("last_name",       customerForm.last_name.trim());
        fd.set("first_name",      customerForm.first_name.trim());
        fd.set("last_name_kana",  customerForm.last_name_kana.trim());
        fd.set("first_name_kana", customerForm.first_name_kana.trim());
        fd.set("phone",           customerForm.phone.trim());
        fd.set("email",           customerForm.email.trim());
        fd.set("address1",        customerForm.address1.trim());
        fd.set("notes",           customerForm.notes.trim());
        fd.set("line_user_id",    customerForm.line_user_id.trim());
        if (customerForm.is_company) fd.set("occupation", "法人");

        const customerResult = await createCustomer(fd);
        if ("error" in customerResult) {
          setError(customerResult.error ?? "顧客の作成に失敗しました");
          return;
        }
        customerId = customerResult.customerId;
      }

      if (!customerId) {
        setError("顧客IDが取得できませんでした");
        return;
      }

      const vfd = new FormData();
      vfd.set("customer_id",            customerId);
      vfd.set("maker",                  vehicleForm.maker.trim());
      vfd.set("model",                  vehicleForm.model.trim());
      vfd.set("grade",                  vehicleForm.grade.trim());
      vfd.set("year",                   vehicleForm.year.trim());
      vfd.set("color",                  vehicleForm.color.trim());
      vfd.set("plate_number",           vehicleForm.plate_number.trim());
      vfd.set("vin",                    vehicleForm.vin.trim());
      vfd.set("body_size",              vehicleForm.body_size.trim());
      vfd.set("inspection_expiry_date", vehicleForm.inspection_expiry_date.trim());
      vfd.set("notes",                  vehicleForm.notes.trim());

      const vehicleResult = await createVehicle(vfd);
      if ("error" in vehicleResult) {
        setError(vehicleResult.error ?? "車両の作成に失敗しました");
        return;
      }

      onComplete(customerId, vehicleResult.vehicleId);
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
        <VehicleRegistrationOcrReview
          ocrResult={ocrResult}
          onApply={handleOcrApply}
          onCancel={pop}
        />
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
            <label className={labelCls}>住所</label>
            <input
              type="text"
              value={customerForm.address1}
              onChange={e => setCustomerField("address1", e.target.value)}
              placeholder="東京都渋谷区..."
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
            onClick={() => push("confirm")}
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
                {customerForm.phone      && <ConfirmRow label="電話"   value={customerForm.phone} />}
                {customerForm.email      && <ConfirmRow label="Email"  value={customerForm.email} />}
                {customerForm.address1   && <ConfirmRow label="住所"   value={customerForm.address1} />}
                {customerForm.is_company && <ConfirmRow label="法人"   value="はい" />}
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

          {error && (
            <div className="flex items-start gap-2 px-3 py-2 rounded-lg border border-red-500/30 bg-red-500/10">
              <span className="text-red-400 shrink-0 text-xs">✕</span>
              <p className="text-xs text-red-400">{error}</p>
            </div>
          )}

          <button
            type="button"
            onClick={handleConfirm}
            disabled={isPending || (isNewCustomer && !customerForm.last_name.trim())}
            className="w-full px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-40 disabled:cursor-not-allowed text-white text-sm font-semibold rounded-lg transition-colors"
          >
            {isPending ? "登録中..." : "登録して見積作成へ"}
          </button>
        </div>
      )}

    </div>
  );
}
