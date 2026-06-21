"use client";

import { useState, useTransition } from "react";
import {
  ServiceCategory, BodySize,
  BASE_PRICES, SERVICE_OPTIONS, OptionKey,
} from "@/components/services/mockServiceEstimate";
import ServiceCategorySection  from "@/components/services/ServiceCategorySection";
import BodySizePriceSection    from "@/components/services/BodySizePriceSection";
import ServiceOptionSection, { OptionsState } from "@/components/services/ServiceOptionSection";
import ServiceSummary          from "@/components/services/ServiceSummary";
import { EstimateDB }          from "@/lib/estimates/estimate-types";
import { GyeonServiceEstimateDB } from "@/lib/gyeon/gyeon-service-types";
import { createGyeonServiceEstimate } from "@/lib/gyeon/create-gyeon-service-estimate";
import { updateGyeonServiceEstimate } from "@/lib/gyeon/update-gyeon-service-estimate";

// Pre-computed mock discounts — must match ServiceSummary.tsx
const MOCK_DISCOUNT: Record<number, number> = {
  0: 0, 5: 4000, 10: 8000, 15: 12000, 20: 16000,
};

const DEFAULT_OPTIONS: OptionsState = Object.fromEntries(
  SERVICE_OPTIONS.map((o) => [o.key, false])
) as OptionsState;

interface GyeonServiceFormProps {
  estimates:      EstimateDB[];
  gyeonEstimate?: GyeonServiceEstimateDB;   // present in edit mode
  onCancel?:      () => void;
  onSuccess?:     () => void;
}

export default function GyeonServiceForm({
  estimates,
  gyeonEstimate,
  onCancel,
  onSuccess,
}: GyeonServiceFormProps) {
  const isEdit = !!gyeonEstimate;

  const [estimateId,   setEstimateId]   = useState<string>(
    gyeonEstimate?.estimate_id ?? ""
  );
  const [category,     setCategory]     = useState<ServiceCategory>(
    gyeonEstimate?.service_category ?? "Coating"
  );
  const [bodySize,     setBodySize]     = useState<BodySize>(
    gyeonEstimate?.body_size ?? "M"
  );
  const [options,      setOptions]      = useState<OptionsState>(
    gyeonEstimate
      ? (gyeonEstimate.options_json as unknown as OptionsState)
      : DEFAULT_OPTIONS
  );
  const [discountRate, setDiscountRate] = useState<number>(0);
  const [error,        setError]        = useState<string | null>(null);
  const [isPending,    startTransition]  = useTransition();

  const basePrice    = BASE_PRICES[category][bodySize];
  const optionsTotal = SERVICE_OPTIONS
    .filter((o) => options[o.key as OptionKey])
    .reduce((sum, o) => sum + o.price, 0);

  const discount = MOCK_DISCOUNT[discountRate] ?? 0;
  const taxBase  = basePrice + optionsTotal - discount;
  const tax      = Math.floor(taxBase * 0.1);
  const subtotal = taxBase;
  const total    = taxBase + tax;

  function handleSubmit() {
    if (!estimateId) {
      setError("Estimate is required.");
      return;
    }

    const fd = new FormData();
    fd.set("estimate_id",      estimateId);
    fd.set("service_category", category);
    fd.set("body_size",        bodySize);
    fd.set("options_json",     JSON.stringify(options));
    fd.set("base_price",       String(basePrice));
    fd.set("discount",         String(discount));
    fd.set("subtotal",         String(subtotal));
    fd.set("tax",              String(tax));
    fd.set("total",            String(total));

    startTransition(async () => {
      const result = isEdit
        ? await updateGyeonServiceEstimate(gyeonEstimate!.id, fd)
        : await createGyeonServiceEstimate(fd);

      if (result.error) {
        setError(result.error);
      } else {
        onSuccess?.();
      }
    });
  }

  return (
    <div className="flex flex-col gap-6">

      {/* Estimate selector */}
      <div>
        <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2 block">
          Linked Estimate
        </label>
        <select
          value={estimateId}
          onChange={(e) => { setEstimateId(e.target.value); setError(null); }}
          className="w-full bg-[#0f172a] border border-slate-700 text-slate-100 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-[#1d4ed8]"
        >
          <option value="">— Select Estimate —</option>
          {estimates.map((est) => {
            const custName = est.customers
              ? [est.customers.last_name, est.customers.first_name].filter(Boolean).join(" ")
              : "";
            const displayNo = est.estimate_number ?? est.estimate_no ?? "";
            return (
              <option key={est.id} value={est.id}>
                {displayNo}
                {custName ? ` — ${custName}` : ""}
                {est.vehicles?.model ? ` / ${est.vehicles.model}` : ""}
              </option>
            );
          })}
        </select>
      </div>

      {/* Category */}
      <ServiceCategorySection value={category} onChange={setCategory} />

      {/* Body Size */}
      <BodySizePriceSection
        category={category}
        value={bodySize}
        onChange={setBodySize}
      />

      {/* Options */}
      <ServiceOptionSection value={options} onChange={setOptions} />

      {/* Summary + Discount */}
      <ServiceSummary
        basePrice={basePrice}
        optionsTotal={optionsTotal}
        discountRate={discountRate}
        onDiscountChange={setDiscountRate}
      />

      {/* Error */}
      {error && (
        <p className="text-sm text-red-400 bg-red-400/10 border border-red-400/30 rounded-lg px-3 py-2">
          {error}
        </p>
      )}

      {/* Buttons */}
      <div className="flex justify-end gap-2 pt-2 border-t border-slate-700">
        <button
          type="button"
          onClick={onCancel}
          disabled={isPending}
          className="px-4 py-2 text-sm font-medium text-slate-400 hover:text-slate-100 hover:bg-slate-700 rounded-lg transition-colors disabled:opacity-50"
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={handleSubmit}
          disabled={isPending}
          className="px-4 py-2 text-sm font-medium bg-[#1d4ed8] hover:bg-[#1e40af] text-white rounded-lg transition-colors disabled:opacity-50"
        >
          {isPending ? "Saving…" : "Save"}
        </button>
      </div>
    </div>
  );
}
