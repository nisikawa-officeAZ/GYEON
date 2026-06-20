"use client";

import { useState } from "react";
import MainLayout from "@/components/layout/MainLayout";
import PageTitle from "@/components/ui/PageTitle";
import VehicleSearch from "@/components/vehicles/VehicleSearch";
import VehicleTable from "@/components/vehicles/VehicleTable";
import VehicleForm from "@/components/vehicles/VehicleForm";

export default function VehiclesPage() {
  const [showForm, setShowForm] = useState(false);

  return (
    <MainLayout>
      <div className="max-w-7xl mx-auto">
        {/* Header row */}
        <div className="flex items-center justify-between mb-6">
          <PageTitle title="Vehicles" subtitle="車両管理" />
          <button
            onClick={() => setShowForm(true)}
            className="shrink-0 bg-[#1d4ed8] hover:bg-[#1e40af] text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors"
          >
            + New Vehicle
          </button>
        </div>

        {/* Search */}
        <div className="mb-4">
          <VehicleSearch />
        </div>

        {/* Table */}
        <VehicleTable />
      </div>

      {/* Modal */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-[#0f172a]/80 backdrop-blur-sm"
            onClick={() => setShowForm(false)}
          />

          {/* Dialog */}
          <div className="relative w-full max-w-lg bg-[#1e293b] rounded-xl shadow-lg p-6 overflow-y-auto max-h-[90vh]">
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-base font-semibold text-slate-100">New Vehicle</h2>
              <button
                onClick={() => setShowForm(false)}
                className="text-slate-500 hover:text-slate-100 transition-colors text-lg leading-none"
              >
                ✕
              </button>
            </div>
            <VehicleForm onCancel={() => setShowForm(false)} />
          </div>
        </div>
      )}
    </MainLayout>
  );
}
