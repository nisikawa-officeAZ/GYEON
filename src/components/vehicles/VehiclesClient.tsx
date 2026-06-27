"use client";

import { useState }     from "react";
import { VehicleDB }    from "@/lib/vehicles/vehicle-types";
import { CustomerDB }   from "@/lib/customers/customer-types";
import PageTitle        from "@/components/ui/PageTitle";
import VehicleSearch    from "@/components/vehicles/VehicleSearch";
import VehicleTable     from "@/components/vehicles/VehicleTable";
import VehicleForm      from "@/components/vehicles/VehicleForm";

type ModalState =
  | { mode: "none" }
  | { mode: "create" }
  | { mode: "edit"; vehicle: VehicleDB };

interface VehiclesClientProps {
  vehicles:  VehicleDB[];
  customers: CustomerDB[];
}

export default function VehiclesClient({ vehicles, customers }: VehiclesClientProps) {
  const [modal, setModal] = useState<ModalState>({ mode: "none" });

  const closeModal = () => setModal({ mode: "none" });

  return (
    <div className="max-w-7xl mx-auto">
      {/* Header row */}
      <div className="flex items-center justify-between mb-6">
        <PageTitle title="車両管理" />
        <button
          onClick={() => setModal({ mode: "create" })}
          className="shrink-0 bg-[#1d4ed8] hover:bg-[#1e40af] text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors"
        >
          + 新規車両登録
        </button>
      </div>

      {/* Search */}
      <div className="mb-4">
        <VehicleSearch />
      </div>

      {/* Table */}
      <VehicleTable
        vehicles={vehicles}
        onEdit={(v) => setModal({ mode: "edit", vehicle: v })}
      />

      {/* Modal */}
      {modal.mode !== "none" && (
        <div className="fixed inset-0 z-50 flex items-start justify-center p-3 sm:p-4 overflow-y-auto">
          <div
            className="fixed inset-0 bg-[#0f172a]/80 backdrop-blur-sm"
            onClick={closeModal}
          />
          <div className="relative w-full max-w-lg bg-[#1e293b] rounded-xl shadow-lg p-5 sm:p-6 my-4">
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-base font-semibold text-slate-100">
                {modal.mode === "edit" ? "車両情報編集" : "新規車両登録"}
              </h2>
              <button
                onClick={closeModal}
                className="w-9 h-9 flex items-center justify-center rounded-md text-slate-500 hover:text-slate-100 hover:bg-slate-700/50 transition-colors text-lg leading-none"
              >
                ✕
              </button>
            </div>
            <VehicleForm
              vehicle={modal.mode === "edit" ? modal.vehicle : undefined}
              customers={customers}
              onCancel={closeModal}
              onSuccess={closeModal}
            />
          </div>
        </div>
      )}
    </div>
  );
}
