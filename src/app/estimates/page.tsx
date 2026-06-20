"use client";

import { useState } from "react";
import { Estimate } from "@/types/estimate";
import MainLayout from "@/components/layout/MainLayout";
import PageTitle from "@/components/ui/PageTitle";
import EstimateTable from "@/components/estimates/EstimateTable";
import EstimateForm from "@/components/estimates/EstimateForm";
import EstimateDetail from "@/components/estimates/EstimateDetail";
import ServiceEstimateForm from "@/components/services/ServiceEstimateForm";

export default function EstimatesPage() {
  const [showForm,        setShowForm]        = useState(false);
  const [showServiceForm, setShowServiceForm] = useState(false);
  const [detail,          setDetail]          = useState<Estimate | null>(null);

  return (
    <MainLayout>
      <div className="max-w-7xl mx-auto">
        {/* Header row */}
        <div className="flex items-center justify-between mb-6">
          <PageTitle title="Estimates" subtitle="見積管理" />
          <div className="flex gap-2">
            <button
              onClick={() => setShowServiceForm(true)}
              className="shrink-0 bg-[#0f172a] hover:bg-slate-800 text-slate-200 border border-slate-700 text-sm font-medium px-4 py-2 rounded-lg transition-colors"
            >
              Create GYEON Estimate
            </button>
            <button
              onClick={() => setShowForm(true)}
              className="shrink-0 bg-[#1d4ed8] hover:bg-[#1e40af] text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors"
            >
              + New Estimate
            </button>
          </div>
        </div>

        {/* Table */}
        <EstimateTable onViewDetail={(e) => setDetail(e)} />
      </div>

      {/* New Estimate Modal */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-[#0f172a]/80 backdrop-blur-sm"
            onClick={() => setShowForm(false)}
          />
          <div className="relative w-full max-w-lg bg-[#1e293b] rounded-xl shadow-lg p-6 overflow-y-auto max-h-[90vh]">
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-base font-semibold text-slate-100">New Estimate</h2>
              <button
                onClick={() => setShowForm(false)}
                className="text-slate-500 hover:text-slate-100 transition-colors text-lg leading-none"
              >
                ✕
              </button>
            </div>
            <EstimateForm onCancel={() => setShowForm(false)} />
          </div>
        </div>
      )}

      {/* GYEON Service Estimate Modal */}
      {showServiceForm && (
        <div className="fixed inset-0 z-50 flex items-start justify-center p-4 overflow-y-auto">
          <div
            className="fixed inset-0 bg-[#0f172a]/80 backdrop-blur-sm"
            onClick={() => setShowServiceForm(false)}
          />
          <div className="relative w-full max-w-2xl bg-[#1e293b] rounded-xl shadow-lg p-6 my-4">
            <div className="flex items-center justify-between mb-5">
              <div>
                <h2 className="text-base font-semibold text-slate-100">GYEON Estimate</h2>
                <p className="text-xs text-slate-500 mt-0.5">Detailing Service</p>
              </div>
              <button
                onClick={() => setShowServiceForm(false)}
                className="text-slate-500 hover:text-slate-100 transition-colors text-lg leading-none"
              >
                ✕
              </button>
            </div>
            <ServiceEstimateForm onCancel={() => setShowServiceForm(false)} />
          </div>
        </div>
      )}

      {/* Estimate Detail Modal */}
      {detail && (
        <EstimateDetail
          estimate={detail}
          onClose={() => setDetail(null)}
        />
      )}
    </MainLayout>
  );
}
