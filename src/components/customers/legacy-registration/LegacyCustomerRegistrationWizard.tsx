"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { useMemo, useState, useTransition } from "react";
import type { VehicleRegistrationOcrResult } from "@/lib/vehicle-registration/vehicle-registration-types";
import type { OcrSessionMeta } from "@/lib/ocr/ocr-session-types";
import type {
  WizardExistingCustomerReference,
  WizardExistingVehicleReference,
} from "@/components/estimates/wizard/contract/wizard-runtime-inputs";
import {
  EMPTY_LEGACY_CUSTOMER,
  EMPTY_LEGACY_VEHICLE,
  LEGACY_HISTORY_CATEGORIES,
  mapReviewedOcrToLegacyDraft,
  todayInJapan,
} from "@/lib/customers/legacy-registration/legacy-registration-core";
import type {
  LegacyCustomerDraft,
  LegacyCustomerSearchInvoker,
  LegacyDuplicateInvoker,
  LegacyDuplicateResult,
  LegacyHistoryDraft,
  LegacyRegistrationSaveInvoker,
  LegacyVehicleDraft,
  LegacyVehicleLoader,
} from "@/lib/customers/legacy-registration/legacy-registration-types";
import { useCurrentStaff } from "@/contexts/StaffContext";

const VehicleRegistrationUpload = dynamic(
  () => import("@/components/vehicle-registration/VehicleRegistrationUpload"),
  { ssr: false },
);
const VehicleRegistrationOcrReview = dynamic(
  () => import("@/components/vehicle-registration/VehicleRegistrationOcrReview"),
  { ssr: false },
);

type Step = 1 | 2 | 3 | 4 | "done";
type CustomerView = "choose" | "search" | "form" | "ocr-upload" | "ocr-review";
type CustomerSelection =
  | { mode: "new" }
  | { mode: "existing"; reference: WizardExistingCustomerReference }
  | null;
type VehicleSelection =
  | { mode: "new" }
  | { mode: "existing"; reference: WizardExistingVehicleReference };

interface Props {
  searchCustomers: LegacyCustomerSearchInvoker;
  loadCustomerVehicles: LegacyVehicleLoader;
  findDuplicates: LegacyDuplicateInvoker;
  saveRegistration: LegacyRegistrationSaveInvoker;
}

const inputClass =
  "min-h-11 w-full rounded-xl border border-[#30415d] bg-[#0c1423] px-3 py-2 text-sm text-[#edf3fc] outline-none placeholder:text-[#52627c] focus:border-[#4f8ef7] focus:ring-2 focus:ring-[#4f8ef7]/25";
const labelClass = "mb-1.5 block text-xs font-semibold text-[#a8b5c9]";

function newId(): string {
  return globalThis.crypto?.randomUUID?.() ?? `legacy-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function Field({
  label, required, value, onChange, error, type = "text", placeholder, maxLength,
}: {
  label: string; required?: boolean; value: string; onChange: (value: string) => void;
  error?: string; type?: string; placeholder?: string; maxLength?: number;
}) {
  return (
    <label className="block">
      <span className={labelClass}>
        {label} {required && <span className="ml-1 text-[#ff8a8a]">必須</span>}
      </span>
      <input
        type={type}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        maxLength={maxLength}
        aria-invalid={Boolean(error)}
        className={`${inputClass} ${error ? "border-red-500" : ""}`}
      />
      {error && <span className="mt-1 block text-xs text-red-300">{error}</span>}
    </label>
  );
}

function ChoiceButton({ title, description, badge, onClick }: {
  title: string; description: string; badge?: string; onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="min-h-[92px] rounded-2xl border border-[#30415d] bg-[#101a2b] p-4 text-left transition hover:border-[#4f8ef7] hover:bg-[#14213a] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#4f8ef7]"
    >
      <span className="flex items-center gap-2 text-sm font-bold text-[#edf3fc]">
        {title}
        {badge && <span className="rounded-full bg-[#1c4fd6] px-2 py-0.5 text-[10px] text-white">{badge}</span>}
      </span>
      <span className="mt-1.5 block text-xs leading-5 text-[#8e9db5]">{description}</span>
    </button>
  );
}

function SummaryRow({ label, value }: { label: string; value: string | null | undefined }) {
  return (
    <div className="grid grid-cols-[112px_1fr] gap-3 border-b border-[#263955]/70 py-2 last:border-0">
      <dt className="text-xs text-[#7788a4]">{label}</dt>
      <dd className="break-words text-sm text-[#dce6f5]">{value?.trim() || "—"}</dd>
    </div>
  );
}

export default function LegacyCustomerRegistrationWizard({
  searchCustomers, loadCustomerVehicles, findDuplicates, saveRegistration,
}: Props) {
  const { canEdit, loaded } = useCurrentStaff();
  const [step, setStep] = useState<Step>(1);
  const [customerView, setCustomerView] = useState<CustomerView>("choose");
  const [customerSelection, setCustomerSelection] = useState<CustomerSelection>(null);
  const [vehicleSelection, setVehicleSelection] = useState<VehicleSelection>({ mode: "new" });
  const [customer, setCustomer] = useState<LegacyCustomerDraft>(EMPTY_LEGACY_CUSTOMER);
  const [vehicle, setVehicle] = useState<LegacyVehicleDraft>(EMPTY_LEGACY_VEHICLE);
  const [history, setHistory] = useState<LegacyHistoryDraft[]>([]);
  const [customerVehicles, setCustomerVehicles] = useState<readonly WizardExistingVehicleReference[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [searchResults, setSearchResults] = useState<readonly WizardExistingCustomerReference[]>([]);
  const [searchMessage, setSearchMessage] = useState<string | null>(null);
  const [duplicates, setDuplicates] = useState<LegacyDuplicateResult | null>(null);
  const [errors, setErrors] = useState<Readonly<Record<string, string>>>({});
  const [banner, setBanner] = useState<string | null>(null);
  const [ocrResult, setOcrResult] = useState<VehicleRegistrationOcrResult | null>(null);
  const [ocrSessionId, setOcrSessionId] = useState<string | null>(null);
  const [savedIds, setSavedIds] = useState<{ customerId: string; vehicleId: string } | null>(null);
  const [idempotencyKey] = useState(newId);
  const [isPending, startTransition] = useTransition();
  const today = useMemo(() => todayInJapan(), []);

  const selectedCustomerName = customerSelection?.mode === "existing"
    ? customerSelection.reference.displayName
    : customer.lastName;
  const selectedVehicleName = vehicleSelection.mode === "existing"
    ? vehicleSelection.reference.displayName
    : [vehicle.maker, vehicle.model].filter(Boolean).join(" ");

  function updateCustomer<K extends keyof LegacyCustomerDraft>(key: K, value: LegacyCustomerDraft[K]) {
    setCustomer((current) => ({ ...current, [key]: value }));
    setErrors((current) => ({ ...current, [key]: "", furigana: "" }));
  }

  function updateVehicle<K extends keyof LegacyVehicleDraft>(key: K, value: LegacyVehicleDraft[K]) {
    setVehicle((current) => ({ ...current, [key]: value }));
    setErrors((current) => ({ ...current, [key]: "" }));
  }

  function resetBanner() {
    setBanner(null);
    setErrors({});
  }

  function chooseNewCustomer() {
    resetBanner();
    setCustomerSelection({ mode: "new" });
    setCustomerView("form");
  }

  function loadVehiclesFor(reference: WizardExistingCustomerReference) {
    setCustomerSelection({ mode: "existing", reference });
    setCustomerVehicles([]);
    setVehicleSelection({ mode: "new" });
    setDuplicates(null);
    resetBanner();
    startTransition(async () => {
      const result = await loadCustomerVehicles(reference.id);
      if (result.ok) setCustomerVehicles(result.vehicles);
      else setBanner("登録済み車両を取得できませんでした。新規車両の入力は続けられます。");
      setStep(2);
    });
  }

  function runSearch() {
    setSearchMessage(null);
    setSearchResults([]);
    startTransition(async () => {
      const result = await searchCustomers(searchTerm);
      if (result.ok) {
        setSearchResults(result.results);
        setSearchMessage(result.results.length === 0
          ? "一致する顧客は見つかりませんでした。"
          : result.truncated ? "50件まで表示しています。検索語を追加してください。" : null);
      } else {
        setSearchMessage(result.code === "QUERY_TOO_SHORT"
          ? "2文字以上で検索してください。"
          : "顧客検索に失敗しました。もう一度お試しください。");
      }
    });
  }

  function handleOcrComplete(result: VehicleRegistrationOcrResult, meta?: OcrSessionMeta) {
    setOcrResult(result);
    setOcrSessionId(meta?.sessionId ?? null);
    setCustomerView("ocr-review");
  }

  function applyOcr(selected: Partial<VehicleRegistrationOcrResult>) {
    const reviewed = selected as VehicleRegistrationOcrResult;
    const mapped = mapReviewedOcrToLegacyDraft(reviewed);
    setOcrResult(reviewed);
    setCustomer(mapped.customer);
    setVehicle(mapped.vehicle);
    setCustomerSelection({ mode: "new" });
    setVehicleSelection({ mode: "new" });
    setCustomerView("form");
    setBanner("OCRの値を反映しました。空欄を補い、すべての内容を確認してください。");
  }

  function goToVehicle() {
    resetBanner();
    if (!customerSelection) {
      setBanner("顧客の登録方法を選択してください。");
      return;
    }
    if (customerSelection.mode === "new") {
      const nextErrors: Record<string, string> = {};
      if (!customer.lastName.trim()) nextErrors.lastName = customer.isBusiness ? "会社名は必須です。" : "氏名は必須です。";
      if (!customer.lastNameKana.trim()) nextErrors.furigana = "フリガナは必須です。";
      if (Object.keys(nextErrors).length) {
        setErrors(nextErrors);
        setBanner("入力が必要な項目があります。");
        return;
      }
    }
    setStep(2);
  }

  function checkVehicleAndDuplicates() {
    resetBanner();
    setDuplicates(null);
    if (vehicleSelection.mode === "new") {
      const nextErrors: Record<string, string> = {};
      if (!vehicle.plateNumber.trim()) nextErrors.plateNumber = "ナンバープレートは必須です。";
      if (!vehicle.maker.trim()) nextErrors.maker = "メーカーは必須です。";
      if (!vehicle.model.trim()) nextErrors.model = "車名は必須です。";
      if (Object.keys(nextErrors).length) {
        setErrors(nextErrors);
        setBanner("入力が必要な項目があります。");
        return;
      }
      startTransition(async () => {
        const result = await findDuplicates({
          customer: customerSelection?.mode === "new" ? customer : null,
          vehicle,
        });
        if (!result.ok) {
          setBanner("重複確認に失敗しました。安全のため保存へ進めません。もう一度お試しください。");
          return;
        }
        if (result.customers.length || result.vehicles.length) {
          setDuplicates(result);
          return;
        }
        setStep(3);
      });
      return;
    }
    setStep(3);
  }

  function addHistory() {
    setHistory((rows) => [...rows, {
      clientId: newId(), category: "coating", performedOn: today, serviceName: "", notes: "",
    }]);
  }

  function updateHistory<K extends keyof LegacyHistoryDraft>(index: number, key: K, value: LegacyHistoryDraft[K]) {
    setHistory((rows) => rows.map((row, current) => current === index ? { ...row, [key]: value } : row));
    setErrors((current) => ({ ...current, [`history.${index}.${key}`]: "" }));
  }

  function removeHistory(index: number) {
    const row = history[index];
    if ((row.serviceName || row.notes) && !window.confirm("入力済みの履歴を削除しますか？")) return;
    setHistory((rows) => rows.filter((_, current) => current !== index));
  }

  function goToConfirm() {
    resetBanner();
    const nextErrors: Record<string, string> = {};
    history.forEach((row, index) => {
      if (!row.performedOn || row.performedOn > today) nextErrors[`history.${index}.performedOn`] = "施工日は今日以前の日付を入力してください。";
      if (!row.serviceName.trim()) nextErrors[`history.${index}.serviceName`] = "施工内容は必須です。";
    });
    if (Object.keys(nextErrors).length) {
      setErrors(nextErrors);
      setBanner("過去履歴の入力内容を確認してください。");
      return;
    }
    setStep(4);
  }

  function save() {
    resetBanner();
    if (!customerSelection) return;
    startTransition(async () => {
      const result = await saveRegistration({
        idempotencyKey,
        customer: customerSelection.mode === "existing"
          ? { mode: "existing", customerId: customerSelection.reference.id }
          : { mode: "new", data: customer },
        vehicle: vehicleSelection.mode === "existing"
          ? { mode: "existing", vehicleId: vehicleSelection.reference.id }
          : { mode: "new", data: vehicle },
        history,
        ocrSessionId,
        reviewedOcr: ocrResult,
      });
      if (!result.ok) {
        setErrors(result.fieldErrors ?? {});
        setBanner(result.message);
        return;
      }
      setSavedIds({ customerId: result.customerId, vehicleId: result.vehicleId });
      setStep("done");
    });
  }

  const steps = [
    { number: 1, label: "顧客" }, { number: 2, label: "車両" },
    { number: 3, label: "過去履歴" }, { number: 4, label: "確認" },
  ] as const;
  const activeStep = step === "done" ? 4 : step;

  if (loaded && !canEdit) {
    return (
      <section className="mx-auto w-full max-w-3xl rounded-2xl border border-[#263955] bg-[#111826]/95 p-8 text-center">
        <h1 className="text-xl font-bold text-[#edf3fc]">既存顧客登録</h1>
        <p className="mt-3 text-sm text-[#a8b5c9]">閲覧権限では顧客・車両・履歴を登録できません。</p>
        <Link href="/hub/customers" className="mt-5 inline-flex rounded-xl border border-[#30415d] px-4 py-2 text-sm text-[#cbd6e7]">顧客・車両へ戻る</Link>
      </section>
    );
  }

  return (
    <section className="mx-auto w-full max-w-6xl pb-10">
      <header className="mb-5 flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-[10px] font-bold tracking-[0.24em] text-[#6f82a1]">LEGACY CUSTOMER REGISTRATION</p>
          <h1 className="mt-1 text-2xl font-bold text-[#edf3fc]">既存顧客登録</h1>
          <p className="mt-2 text-sm text-[#94a4bd]">導入前の顧客・車両・施工履歴を登録します。見積・請求・施工指示は作成されません。</p>
        </div>
        <Link href="/hub/customers" className="rounded-xl border border-[#30415d] px-4 py-2 text-sm text-[#a8b5c9] hover:bg-[#14213a]">顧客・車両へ戻る</Link>
      </header>

      <ol className="mb-5 grid grid-cols-4 overflow-hidden rounded-2xl border border-[#263955] bg-[#0e1726]">
        {steps.map((item) => {
          const active = activeStep === item.number;
          const complete = activeStep > item.number || step === "done";
          return (
            <li key={item.number} className={`flex min-h-14 items-center justify-center gap-2 border-r border-[#263955] px-2 last:border-r-0 ${active ? "bg-[#17346f]" : ""}`}>
              <span className={`grid h-6 w-6 place-items-center rounded-full text-xs font-bold ${complete ? "bg-emerald-500 text-[#07130d]" : active ? "bg-[#4f8ef7] text-white" : "bg-[#1b2940] text-[#7184a4]"}`}>
                {complete ? "✓" : item.number}
              </span>
              <span className={`hidden text-xs font-semibold sm:inline ${active ? "text-white" : "text-[#8798b3]"}`}>{item.label}</span>
            </li>
          );
        })}
      </ol>

      {banner && (
        <div role="alert" className="mb-4 rounded-xl border border-amber-500/40 bg-amber-950/30 px-4 py-3 text-sm text-amber-200">{banner}</div>
      )}

      <div className="rounded-2xl border border-[#263955] bg-[#111826]/95 p-4 shadow-2xl sm:p-6">
        {step === 1 && customerView === "choose" && (
          <div>
            <h2 className="text-lg font-bold text-[#edf3fc]">顧客の登録方法</h2>
            <p className="mt-1 text-sm text-[#8e9db5]">最初に方法を選んでください。</p>
            <div className="mt-5 grid gap-3 lg:grid-cols-3">
              <ChoiceButton title="車検証を読み取って登録" badge="推奨" description="所有者・使用者と車両情報を読み取り、確認後に反映します。" onClick={() => setCustomerView("ocr-upload")} />
              <ChoiceButton title="登録済み顧客を検索" description="氏名・フリガナ・電話・住所・ナンバー下4桁で検索します。" onClick={() => setCustomerView("search")} />
              <ChoiceButton title="顧客情報を新しく入力" description="導入前の顧客情報を手入力します。" onClick={chooseNewCustomer} />
            </div>
          </div>
        )}

        {step === 1 && customerView === "search" && (
          <div>
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-lg font-bold text-[#edf3fc]">登録済み顧客を検索</h2>
              <button type="button" onClick={() => setCustomerView("choose")} className="text-sm text-[#8fb0e8]">← 方法を選び直す</button>
            </div>
            <div className="mt-5 flex gap-2">
              <input value={searchTerm} onChange={(event) => setSearchTerm(event.target.value)} onKeyDown={(event) => event.key === "Enter" && runSearch()} className={inputClass} placeholder="氏名・フリガナ・電話・住所・ナンバー下4桁" />
              <button type="button" disabled={isPending} onClick={runSearch} className="shrink-0 rounded-xl bg-[#1c4fd6] px-5 text-sm font-bold text-white disabled:opacity-50">検索</button>
            </div>
            {searchMessage && <p className="mt-3 text-sm text-[#a8b5c9]">{searchMessage}</p>}
            <div className="mt-4 grid gap-2">
              {searchResults.map((result) => (
                <button key={result.id} type="button" onClick={() => loadVehiclesFor(result)} className="flex items-center justify-between rounded-xl border border-[#30415d] bg-[#0c1423] p-4 text-left hover:border-[#4f8ef7]">
                  <span><strong className="block text-sm text-[#edf3fc]">{result.displayName}</strong><span className="mt-1 block text-xs text-[#7f90aa]">{result.phone || "電話番号未登録"}</span></span>
                  <span className="text-sm text-[#70a2ff]">この顧客を選択 →</span>
                </button>
              ))}
            </div>
            <button type="button" onClick={chooseNewCustomer} className="mt-5 text-sm text-[#70a2ff]">見つからない場合は新しく入力</button>
          </div>
        )}

        {step === 1 && customerView === "ocr-upload" && (
          <div>
            <button type="button" onClick={() => setCustomerView("choose")} className="mb-4 text-sm text-[#8fb0e8]">← 方法を選び直す</button>
            <VehicleRegistrationUpload onComplete={handleOcrComplete} onCancel={() => setCustomerView("choose")} />
          </div>
        )}

        {step === 1 && customerView === "ocr-review" && ocrResult && (
          <div>
            <VehicleRegistrationOcrReview ocrResult={ocrResult} onApply={applyOcr} onCancel={() => setCustomerView("ocr-upload")} />
          </div>
        )}

        {step === 1 && customerView === "form" && (
          <div>
            <div className="flex items-center justify-between gap-3">
              <div><h2 className="text-lg font-bold text-[#edf3fc]">顧客情報</h2><p className="mt-1 text-xs text-[#8e9db5]">フリガナは検索用です。表記形式は問いません。</p></div>
              <button type="button" onClick={() => setCustomerView("choose")} className="text-sm text-[#8fb0e8]">方法を選び直す</button>
            </div>
            <label className="mt-5 flex items-center gap-3 rounded-xl border border-[#30415d] bg-[#0c1423] p-3 text-sm text-[#c9d5e6]">
              <input type="checkbox" checked={customer.isBusiness} onChange={(event) => updateCustomer("isBusiness", event.target.checked)} className="h-4 w-4" /> 法人顧客として登録
            </label>
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <div className="sm:col-span-2"><Field label={customer.isBusiness ? "会社名" : "氏名"} required value={customer.lastName} onChange={(v) => updateCustomer("lastName", v)} error={errors.lastName} /></div>
              <div className="sm:col-span-2"><Field label="フリガナ" required value={customer.lastNameKana} onChange={(v) => updateCustomer("lastNameKana", v)} error={errors.furigana} /></div>
              <Field label="電話番号" value={customer.phone} onChange={(v) => updateCustomer("phone", v)} type="tel" />
              <Field label="メールアドレス" value={customer.email} onChange={(v) => updateCustomer("email", v)} type="email" />
              <Field label="郵便番号" value={customer.postalCode} onChange={(v) => updateCustomer("postalCode", v)} />
              <Field label="都道府県" value={customer.prefecture} onChange={(v) => updateCustomer("prefecture", v)} />
              <Field label="市区町村" value={customer.city} onChange={(v) => updateCustomer("city", v)} />
              <Field label="住所" value={customer.address1} onChange={(v) => updateCustomer("address1", v)} />
              <div className="sm:col-span-2"><Field label="建物名・部屋番号" value={customer.address2} onChange={(v) => updateCustomer("address2", v)} /></div>
              <div className="sm:col-span-2"><Field label="備考" value={customer.notes} onChange={(v) => updateCustomer("notes", v)} maxLength={2000} /></div>
            </div>
            <div className="mt-6 flex justify-end"><button type="button" onClick={goToVehicle} className="rounded-xl bg-[#1c4fd6] px-6 py-3 text-sm font-bold text-white">車両情報へ →</button></div>
          </div>
        )}

        {step === 2 && (
          <div>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div><h2 className="text-lg font-bold text-[#edf3fc]">車両情報</h2><p className="mt-1 text-xs text-[#8e9db5]">ナンバー・メーカー・車名は必須です。</p></div>
              <button type="button" onClick={() => { setStep(1); setCustomerView(customerSelection?.mode === "existing" ? "search" : "form"); setDuplicates(null); }} className="text-sm text-[#8fb0e8]">← 顧客情報へ</button>
            </div>

            {customerSelection?.mode === "existing" && customerVehicles.length > 0 && (
              <div className="mt-5 rounded-xl border border-[#30415d] bg-[#0c1423] p-4">
                <p className="text-xs font-bold text-[#a8b5c9]">{customerSelection.reference.displayName}様の登録済み車両</p>
                <div className="mt-3 grid gap-2 sm:grid-cols-2">
                  {customerVehicles.map((item) => (
                    <button key={item.id} type="button" onClick={() => { setVehicleSelection({ mode: "existing", reference: item }); setDuplicates(null); }} className={`rounded-xl border p-3 text-left ${vehicleSelection.mode === "existing" && vehicleSelection.reference.id === item.id ? "border-[#4f8ef7] bg-[#17346f]" : "border-[#30415d] bg-[#101a2b]"}`}>
                      <strong className="block text-sm text-[#edf3fc]">{item.displayName}</strong><span className="mt-1 block text-xs text-[#8e9db5]">{item.plateNumber || "ナンバー未登録"}</span>
                    </button>
                  ))}
                  <button type="button" onClick={() => { setVehicleSelection({ mode: "new" }); setDuplicates(null); }} className={`rounded-xl border p-3 text-left ${vehicleSelection.mode === "new" ? "border-[#4f8ef7] bg-[#17346f]" : "border-[#30415d] bg-[#101a2b]"}`}>
                    <strong className="block text-sm text-[#edf3fc]">別の車両を新規登録</strong><span className="mt-1 block text-xs text-[#8e9db5]">既存顧客へ新しい車両を追加</span>
                  </button>
                </div>
              </div>
            )}

            {vehicleSelection.mode === "new" && (
              <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                <Field label="ナンバープレート" required value={vehicle.plateNumber} onChange={(v) => updateVehicle("plateNumber", v)} error={errors.plateNumber} />
                <Field label="メーカー" required value={vehicle.maker} onChange={(v) => updateVehicle("maker", v)} error={errors.maker} />
                <Field label="車名" required value={vehicle.model} onChange={(v) => updateVehicle("model", v)} error={errors.model} />
                <Field label="グレード" value={vehicle.grade} onChange={(v) => updateVehicle("grade", v)} />
                <Field label="型式" value={vehicle.vehicleCode} onChange={(v) => updateVehicle("vehicleCode", v)} />
                <Field label="車台番号 / VIN" value={vehicle.vin} onChange={(v) => updateVehicle("vin", v)} />
                <Field label="初度登録年月" value={vehicle.firstRegistrationYearMonth} onChange={(v) => updateVehicle("firstRegistrationYearMonth", v)} type="month" />
                <Field label="登録年月日" value={vehicle.registrationDate} onChange={(v) => updateVehicle("registrationDate", v)} type="date" error={errors.registrationDate} />
                <Field label="車検満了日" value={vehicle.inspectionExpiryDate} onChange={(v) => updateVehicle("inspectionExpiryDate", v)} type="date" error={errors.inspectionExpiryDate} />
                <Field label="ボディカラー" value={vehicle.color} onChange={(v) => updateVehicle("color", v)} />
                <label className="block"><span className={labelClass}>ボディサイズ</span><select value={vehicle.bodySize} onChange={(event) => updateVehicle("bodySize", event.target.value)} className={inputClass}><option value="">未選択</option>{["SS", "S", "M", "ML", "L", "LL", "XL"].map((size) => <option key={size}>{size}</option>)}</select></label>
                <Field label="排気量" value={vehicle.displacement} onChange={(v) => updateVehicle("displacement", v)} />
                <Field label="燃料" value={vehicle.fuelType} onChange={(v) => updateVehicle("fuelType", v)} />
                <div className="sm:col-span-2 lg:col-span-3"><Field label="車両備考" value={vehicle.notes} onChange={(v) => updateVehicle("notes", v)} maxLength={2000} /></div>
              </div>
            )}

            {duplicates?.ok && (duplicates.customers.length > 0 || duplicates.vehicles.length > 0) && (
              <div className="mt-5 rounded-2xl border border-amber-500/50 bg-amber-950/25 p-4">
                <h3 className="font-bold text-amber-200">重複候補を確認してください</h3>
                {duplicates.customers.length > 0 && (
                  <div className="mt-3"><p className="text-xs text-amber-100/80">似ている顧客</p>{duplicates.customers.map((item) => <button key={item.id} type="button" onClick={() => loadVehiclesFor(item)} className="mt-2 flex w-full justify-between rounded-xl border border-amber-500/30 bg-[#111826] p-3 text-left text-sm text-[#edf3fc]"><span>{item.displayName}<small className="ml-2 text-[#8e9db5]">{item.phone}</small></span><span className="text-[#70a2ff]">この顧客を使用</span></button>)}</div>
                )}
                {duplicates.vehicles.length > 0 && (
                  <div className="mt-4"><p className="text-xs font-bold text-red-200">ナンバーまたはVINが一致する車両</p>{duplicates.vehicles.map((item) => {
                    const canUse = customerSelection?.mode === "existing" && item.customerId === customerSelection.reference.id;
                    return <div key={item.id} className="mt-2 rounded-xl border border-red-500/30 bg-[#111826] p-3"><strong className="text-sm text-[#edf3fc]">{item.displayName}</strong><span className="ml-2 text-xs text-[#8e9db5]">{item.plateNumber}</span>{canUse ? <button type="button" onClick={() => { setVehicleSelection({ mode: "existing", reference: item }); setDuplicates(null); setStep(3); }} className="mt-2 block text-sm text-[#70a2ff]">この既存車両を使用して続ける</button> : <p className="mt-2 text-xs text-red-200">別顧客の車両として登録済みです。顧客検索から正しい顧客を選択してください。</p>}</div>;
                  })}</div>
                )}
                <div className="mt-4 flex flex-wrap gap-2">
                  {duplicates.vehicles.length === 0 && <button type="button" onClick={() => { setDuplicates(null); setStep(3); }} className="rounded-xl bg-amber-500 px-4 py-2 text-sm font-bold text-[#241500]">別の顧客として続ける</button>}
                  <button type="button" onClick={() => setDuplicates(null)} className="rounded-xl border border-[#455a79] px-4 py-2 text-sm text-[#cbd6e7]">入力内容を見直す</button>
                  {duplicates.vehicles.length > 0 && <button type="button" onClick={() => { setStep(1); setCustomerView("search"); setDuplicates(null); }} className="rounded-xl border border-[#455a79] px-4 py-2 text-sm text-[#cbd6e7]">顧客検索へ戻る</button>}
                </div>
              </div>
            )}

            <div className="mt-6 flex justify-end"><button type="button" disabled={isPending} onClick={checkVehicleAndDuplicates} className="rounded-xl bg-[#1c4fd6] px-6 py-3 text-sm font-bold text-white disabled:opacity-50">{isPending ? "確認中…" : "過去履歴へ →"}</button></div>
          </div>
        )}

        {step === 3 && (
          <div>
            <div className="flex flex-wrap items-center justify-between gap-3"><div><h2 className="text-lg font-bold text-[#edf3fc]">過去の施工・メンテナンス履歴</h2><p className="mt-1 text-xs text-[#8e9db5]">履歴がない場合は、追加せず次へ進めます。</p></div><button type="button" onClick={() => setStep(2)} className="text-sm text-[#8fb0e8]">← 車両情報へ</button></div>
            <div className="mt-5 space-y-4">
              {history.map((row, index) => (
                <article key={row.clientId} className="rounded-2xl border border-[#30415d] bg-[#0c1423] p-4">
                  <div className="flex items-center justify-between"><h3 className="text-sm font-bold text-[#dce6f5]">履歴 {index + 1}</h3><button type="button" onClick={() => removeHistory(index)} className="text-xs text-red-300">削除</button></div>
                  <div className="mt-3 grid gap-4 sm:grid-cols-2">
                    <label className="block"><span className={labelClass}>履歴種別 <span className="text-[#ff8a8a]">必須</span></span><select value={row.category} onChange={(event) => updateHistory(index, "category", event.target.value as LegacyHistoryDraft["category"])} className={inputClass}>{LEGACY_HISTORY_CATEGORIES.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}</select></label>
                    <Field label="施工日" required type="date" value={row.performedOn} onChange={(v) => updateHistory(index, "performedOn", v)} error={errors[`history.${index}.performedOn`]} />
                    <div className="sm:col-span-2"><Field label="施工内容" required value={row.serviceName} onChange={(v) => updateHistory(index, "serviceName", v)} error={errors[`history.${index}.serviceName`]} maxLength={200} placeholder="例：Q² MOHS EVO施工" /></div>
                    <div className="sm:col-span-2"><Field label="備考" value={row.notes} onChange={(v) => updateHistory(index, "notes", v)} maxLength={2000} /></div>
                  </div>
                </article>
              ))}
              {history.length === 0 && <div className="rounded-2xl border border-dashed border-[#30415d] px-5 py-10 text-center text-sm text-[#7788a4]">過去履歴はまだ追加されていません。</div>}
            </div>
            <button type="button" onClick={addHistory} className="mt-4 rounded-xl border border-[#3d65a1] px-4 py-2.5 text-sm font-bold text-[#8fb8ff]">＋ 過去の履歴を追加</button>
            <div className="mt-6 flex justify-end"><button type="button" onClick={goToConfirm} className="rounded-xl bg-[#1c4fd6] px-6 py-3 text-sm font-bold text-white">最終確認へ →</button></div>
          </div>
        )}

        {step === 4 && (
          <div>
            <div className="flex items-center justify-between gap-3"><div><h2 className="text-lg font-bold text-[#edf3fc]">登録内容の最終確認</h2><p className="mt-1 text-xs text-[#8e9db5]">登録後も見積・請求・施工指示は作成されません。</p></div><button type="button" onClick={() => setStep(3)} className="text-sm text-[#8fb0e8]">← 履歴へ</button></div>
            <div className="mt-5 grid gap-4 lg:grid-cols-2">
              <article className="rounded-2xl border border-[#30415d] bg-[#0c1423] p-4"><h3 className="mb-2 text-sm font-bold text-[#8fb8ff]">01 顧客</h3><dl><SummaryRow label="登録方法" value={customerSelection?.mode === "existing" ? "登録済み顧客を使用" : "新規登録"} /><SummaryRow label="顧客名" value={selectedCustomerName} />{customerSelection?.mode === "new" && <><SummaryRow label="フリガナ" value={customer.lastNameKana} /><SummaryRow label="電話番号" value={customer.phone} /><SummaryRow label="住所" value={[customer.prefecture, customer.city, customer.address1, customer.address2].filter(Boolean).join(" ")} /></>}</dl></article>
              <article className="rounded-2xl border border-[#30415d] bg-[#0c1423] p-4"><h3 className="mb-2 text-sm font-bold text-[#8fb8ff]">02 車両</h3><dl><SummaryRow label="登録方法" value={vehicleSelection.mode === "existing" ? "登録済み車両を使用" : "新規登録"} /><SummaryRow label="車両" value={selectedVehicleName} /><SummaryRow label="ナンバー" value={vehicleSelection.mode === "existing" ? vehicleSelection.reference.plateNumber : vehicle.plateNumber} />{vehicleSelection.mode === "new" && <SummaryRow label="VIN" value={vehicle.vin} />}</dl></article>
              <article className="rounded-2xl border border-[#30415d] bg-[#0c1423] p-4 lg:col-span-2"><h3 className="mb-2 text-sm font-bold text-[#8fb8ff]">03 過去履歴</h3>{history.length === 0 ? <p className="text-sm text-[#8e9db5]">履歴なし</p> : <div className="space-y-2">{history.map((row) => <div key={row.clientId} className="rounded-xl bg-[#111b2d] p-3 text-sm text-[#dce6f5]"><strong>{LEGACY_HISTORY_CATEGORIES.find((item) => item.value === row.category)?.label}</strong><span className="ml-3 text-[#8e9db5]">{row.performedOn}</span><span className="mt-1 block">{row.serviceName}</span></div>)}</div>}</article>
            </div>
            <div className="mt-5 rounded-xl border border-blue-500/30 bg-blue-950/25 p-4 text-sm text-blue-200">顧客・車両・履歴を1回の処理で保存します。途中で失敗した場合は一件も登録されません。</div>
            <div className="mt-6 flex justify-end"><button type="button" disabled={isPending} onClick={save} className="rounded-xl bg-[#1c4fd6] px-7 py-3 text-sm font-bold text-white disabled:cursor-not-allowed disabled:opacity-50">{isPending ? "保存中…" : "登録を確定"}</button></div>
          </div>
        )}

        {step === "done" && savedIds && (
          <div className="py-8 text-center">
            <div className="mx-auto grid h-16 w-16 place-items-center rounded-full bg-emerald-500 text-3xl font-bold text-[#062015]">✓</div>
            <h2 className="mt-5 text-2xl font-bold text-[#edf3fc]">登録が完了しました</h2>
            <p className="mt-2 text-sm text-[#8e9db5]">見積・請求・施工指示は作成されていません。</p>
            <div className="mt-6 flex flex-wrap justify-center gap-3">
              <Link href={`/vehicles/${savedIds.vehicleId}`} className="rounded-xl bg-[#1c4fd6] px-5 py-3 text-sm font-bold text-white">車両詳細を確認</Link>
              <Link href={`/customers/${savedIds.customerId}`} className="rounded-xl border border-[#3d65a1] px-5 py-3 text-sm font-bold text-[#8fb8ff]">顧客詳細を確認</Link>
              <Link href="/hub/customers" className="rounded-xl border border-[#30415d] px-5 py-3 text-sm text-[#cbd6e7]">一覧へ戻る</Link>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
