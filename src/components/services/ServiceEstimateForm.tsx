"use client";

import { useState } from "react";
import {
  ServiceCategory, BodySize,
  BASE_PRICES, SERVICE_OPTIONS, OptionKey,
} from "./mockServiceEstimate";
import ServiceCategorySection from "./ServiceCategorySection";
import BodySizePriceSection from "./BodySizePriceSection";
import ServiceOptionSection, { OptionsState } from "./ServiceOptionSection";
import ServiceSummary from "./ServiceSummary";

const DEFAULT_OPTIONS: OptionsState = Object.fromEntries(
  SERVICE_OPTIONS.map((o) => [o.key, false])
) as OptionsState;

interface ServiceEstimateFormProps {
  onCancel?: () => void;
}

export default function ServiceEstimateForm({ onCancel }: ServiceEstimateFormProps) {
  const [category,     setCategory]     = useState<ServiceCategory>("Coating");
  const [bodySize,     setBodySize]     = useState<BodySize>("M");
  const [options,      setOptions]      = useState<OptionsState>(DEFAULT_OPTIONS);
  const [discountRate, setDiscountRate] = useState<number>(0);

  const basePrice    = BASE_PRICES[category][bodySize];
  const optionsTotal = SERVICE_OPTIONS
    .filter((o) => options[o.key as OptionKey])
    .reduce((sum, o) => sum + o.price, 0);

  return (
    <div className="flex flex-col gap-6">

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

      {/* Buttons */}
      <div className="flex justify-end gap-2 pt-2 border-t border-slate-700">
        <button
          type="button"
          onClick={onCancel}
          className="px-4 py-2 text-sm font-medium text-slate-400 hover:text-slate-100 hover:bg-slate-700 rounded-lg transition-colors"
        >
          Cancel
        </button>
        <button
          type="button"
          className="px-4 py-2 text-sm font-medium bg-[#1d4ed8] hover:bg-[#1e40af] text-white rounded-lg transition-colors"
        >
          Save
        </button>
      </div>
    </div>
  );
}
