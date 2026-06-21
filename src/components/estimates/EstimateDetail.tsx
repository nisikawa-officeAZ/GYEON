"use client";

import { EstimateDB } from "@/lib/estimates/estimate-types";
import WheelEstimateSection from "./WheelEstimateSection";
import TireEstimateSection  from "./TireEstimateSection";
import WorkCostSection      from "./WorkCostSection";
import EstimateSummary      from "./EstimateSummary";

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between items-start gap-4 py-2 border-b border-slate-700/50 last:border-b-0">
      <span className="text-xs text-slate-500 shrink-0 w-32">{label}</span>
      <span className="text-xs text-slate-200 text-right">{value}</span>
    </div>
  );
}

interface EstimateDetailProps {
  estimate: EstimateDB;
  onClose:  () => void;
}

export default function EstimateDetail({ estimate, onClose }: EstimateDetailProps) {
  const customer = estimate.customers;
  const vehicle  = estimate.vehicles;

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
            <h2 className="text-base font-semibold text-slate-100">{estimate.estimate_no}</h2>
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
            <InfoRow label="Customer Name" value={customer?.name  ?? "—"} />
            <InfoRow label="Phone"         value={customer?.phone ?? "—"} />
            <InfoRow label="Email"         value={customer?.email ?? "—"} />
          </div>

          {/* 2. Vehicle */}
          <div className="bg-[#1e293b] rounded-xl shadow-lg p-5">
            <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-4">
              Vehicle Information
            </h3>
            <InfoRow label="Manufacturer"  value={vehicle?.manufacturer  ?? "—"} />
            <InfoRow label="Model"         value={vehicle?.model         ?? "—"} />
            <InfoRow label="Year"          value={vehicle?.year          ?? "—"} />
            <InfoRow label="Grade"         value={vehicle?.grade         ?? "—"} />
            <InfoRow label="License Plate" value={vehicle?.license_plate ?? "—"} />
          </div>

          {/* 3. Wheel */}
          <WheelEstimateSection />

          {/* 4. Tire */}
          <TireEstimateSection />

          {/* 5. Work Cost */}
          <WorkCostSection />

          {/* 6. Summary */}
          <EstimateSummary
            estimateNo={estimate.estimate_no}
            status={estimate.status}
          />
        </div>
      </div>
    </div>
  );
}
