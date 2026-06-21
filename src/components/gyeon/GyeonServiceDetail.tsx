"use client";

import { GyeonServiceEstimateDB } from "@/lib/gyeon/gyeon-service-types";
import { SERVICE_OPTIONS }        from "@/components/services/mockServiceEstimate";

interface GyeonServiceDetailProps {
  gyeonEstimate: GyeonServiceEstimateDB;
  onClose?:      () => void;
}

export default function GyeonServiceDetail({ gyeonEstimate, onClose }: GyeonServiceDetailProps) {
  const est = gyeonEstimate;
  const options = est.options_json ?? {};

  const selectedOptions = SERVICE_OPTIONS.filter((o) => options[o.key]);

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center p-4 overflow-y-auto">
      <div
        className="fixed inset-0 bg-[#0f172a]/80 backdrop-blur-sm"
        onClick={onClose}
      />
      <div className="relative w-full max-w-lg bg-[#1e293b] rounded-xl shadow-lg p-6 my-4">

        {/* Header */}
        <div className="flex items-center justify-between mb-5">
          <div>
            <h2 className="text-base font-semibold text-slate-100">GYEON Estimate Detail</h2>
            <p className="text-xs text-slate-500 mt-0.5">
              {est.estimates?.estimate_no ?? "—"}
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-slate-500 hover:text-slate-100 transition-colors text-lg leading-none"
          >
            ✕
          </button>
        </div>

        <div className="space-y-5">

          {/* Customer / Vehicle */}
          {est.estimates && (
            <section className="bg-[#0f172a] rounded-lg p-4 space-y-1.5">
              <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
                Customer / Vehicle
              </p>
              {(est.estimates.customers?.last_name || est.estimates.customers?.first_name) && (
                <Row
                  label="Customer"
                  value={[est.estimates.customers.last_name, est.estimates.customers.first_name]
                    .filter(Boolean).join(" ")}
                />
              )}
              {est.estimates.customers?.phone && (
                <Row label="Phone" value={est.estimates.customers.phone} />
              )}
              {est.estimates.vehicles && (
                <Row
                  label="Vehicle"
                  value={[
                    est.estimates.vehicles.maker,
                    est.estimates.vehicles.model,
                    est.estimates.vehicles.year,
                    est.estimates.vehicles.grade,
                  ].filter(Boolean).join(" ")}
                />
              )}
              {est.estimates.vehicles?.plate_number && (
                <Row label="Plate" value={est.estimates.vehicles.plate_number} />
              )}
            </section>
          )}

          {/* Service */}
          <section className="bg-[#0f172a] rounded-lg p-4 space-y-1.5">
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
              Service
            </p>
            <Row label="Category"  value={est.service_category} />
            <Row label="Body Size" value={est.body_size} />
          </section>

          {/* Options */}
          {selectedOptions.length > 0 && (
            <section className="bg-[#0f172a] rounded-lg p-4">
              <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
                Options
              </p>
              <div className="space-y-1.5">
                {selectedOptions.map((o) => (
                  <Row
                    key={o.key}
                    label={o.label}
                    value={`+¥${o.price.toLocaleString("ja-JP")}`}
                  />
                ))}
              </div>
            </section>
          )}

          {/* Pricing */}
          <section className="bg-[#0f172a] rounded-lg p-4 space-y-1.5">
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
              Pricing
            </p>
            <Row label="Base Price" value={`¥${est.base_price.toLocaleString("ja-JP")}`} />
            {est.discount > 0 && (
              <Row label="Discount"  value={`−¥${est.discount.toLocaleString("ja-JP")}`} accent="text-red-400" />
            )}
            <Row label="Subtotal"   value={`¥${est.subtotal.toLocaleString("ja-JP")}`} />
            <Row label="Tax (10%)"  value={`¥${est.tax.toLocaleString("ja-JP")}`} muted />
            <div className="border-t border-slate-700 pt-2.5 mt-2">
              <div className="flex justify-between items-center">
                <span className="text-sm font-bold text-slate-100">Total</span>
                <span className="text-xl font-bold text-slate-100">
                  ¥{est.total.toLocaleString("ja-JP")}
                </span>
              </div>
            </div>
          </section>

        </div>

        {/* Footer */}
        <div className="flex justify-end pt-5 border-t border-slate-700 mt-5">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-slate-400 hover:text-slate-100 hover:bg-slate-700 rounded-lg transition-colors"
          >
            Close
          </button>
        </div>

      </div>
    </div>
  );
}

function Row({
  label, value, muted, accent,
}: {
  label: string;
  value: string;
  muted?: boolean;
  accent?: string;
}) {
  const colorClass = accent ?? (muted ? "text-slate-500" : "text-slate-300");
  return (
    <div className="flex justify-between items-center">
      <span className="text-xs text-slate-500">{label}</span>
      <span className={`text-sm font-medium ${colorClass}`}>{value}</span>
    </div>
  );
}
