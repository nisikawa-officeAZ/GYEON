"use client";

import { Estimate } from "@/types/estimate";
import { CUSTOMER_NAMES, VEHICLE_NAMES } from "./mockEstimates";
import WheelEstimateSection from "./WheelEstimateSection";
import TireEstimateSection from "./TireEstimateSection";
import WorkCostSection from "./WorkCostSection";
import EstimateSummary from "./EstimateSummary";

const MOCK_CUSTOMER_DETAIL: Record<string, { phone: string; email: string }> = {
  "1": { phone: "090-1234-5678", email: "yamada@example.com" },
  "2": { phone: "080-9876-5432", email: "sato@example.com" },
  "3": { phone: "070-1111-2222", email: "suzuki@example.com" },
};

const MOCK_VEHICLE_DETAIL: Record<string, { manufacturer: string; model: string; year: string; grade: string; licensePlate: string }> = {
  "1": { manufacturer: "Toyota",  model: "Alphard",   year: "2022", grade: "Executive Lounge",  licensePlate: "品川 300 あ 1234" },
  "2": { manufacturer: "Nissan",  model: "Serena",    year: "2021", grade: "e-POWER LUXION",    licensePlate: "横浜 500 い 5678" },
  "3": { manufacturer: "Honda",   model: "Stepwgn",   year: "2023", grade: "SPADA",              licensePlate: "大阪 330 う 9012" },
};

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between items-start gap-4 py-2 border-b border-slate-700/50 last:border-b-0">
      <span className="text-xs text-slate-500 shrink-0 w-32">{label}</span>
      <span className="text-xs text-slate-200 text-right">{value}</span>
    </div>
  );
}

interface EstimateDetailProps {
  estimate: Estimate;
  onClose: () => void;
}

export default function EstimateDetail({ estimate, onClose }: EstimateDetailProps) {
  const customer = MOCK_CUSTOMER_DETAIL[estimate.customerId];
  const vehicle  = MOCK_VEHICLE_DETAIL[estimate.vehicleId];

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center p-4 overflow-y-auto">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-[#0f172a]/80 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Panel */}
      <div className="relative w-full max-w-3xl bg-[#0f172a] rounded-xl shadow-lg my-4">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800">
          <div>
            <h2 className="text-base font-semibold text-slate-100">{estimate.estimateNo}</h2>
            <p className="text-xs text-slate-500 mt-0.5">Estimate Detail</p>
          </div>
          <button
            onClick={onClose}
            className="text-slate-500 hover:text-slate-100 transition-colors text-lg leading-none"
          >
            ✕
          </button>
        </div>

        {/* Body */}
        <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-4">

          {/* 1. Customer */}
          <div className="bg-[#1e293b] rounded-xl shadow-lg p-5">
            <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-4">
              Customer Information
            </h3>
            <InfoRow label="Customer Name" value={CUSTOMER_NAMES[estimate.customerId] ?? "—"} />
            <InfoRow label="Phone"         value={customer?.phone ?? "—"} />
            <InfoRow label="Email"         value={customer?.email ?? "—"} />
          </div>

          {/* 2. Vehicle */}
          <div className="bg-[#1e293b] rounded-xl shadow-lg p-5">
            <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-4">
              Vehicle Information
            </h3>
            <InfoRow label="Manufacturer"   value={vehicle?.manufacturer ?? "—"} />
            <InfoRow label="Model"          value={vehicle?.model ?? "—"} />
            <InfoRow label="Year"           value={vehicle?.year ?? "—"} />
            <InfoRow label="Grade"          value={vehicle?.grade ?? "—"} />
            <InfoRow label="License Plate"  value={vehicle?.licensePlate ?? "—"} />
          </div>

          {/* 3. Wheel */}
          <WheelEstimateSection />

          {/* 4. Tire */}
          <TireEstimateSection />

          {/* 5. Work Cost */}
          <WorkCostSection />

          {/* 6. Summary */}
          <EstimateSummary
            estimateNo={estimate.estimateNo}
            status={estimate.status}
          />
        </div>
      </div>
    </div>
  );
}
