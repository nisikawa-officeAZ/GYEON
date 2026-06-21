"use client";

import { useState }     from "react";
import { EstimateDB }   from "@/lib/estimates/estimate-types";
import { CustomerDB }   from "@/lib/customers/customer-types";
import { VehicleDB }    from "@/lib/vehicles/vehicle-types";
import PageTitle        from "@/components/ui/PageTitle";
import EstimateTable    from "@/components/estimates/EstimateTable";
import EstimateForm     from "@/components/estimates/EstimateForm";
import EstimateDetail   from "@/components/estimates/EstimateDetail";
import GyeonServiceForm from "@/components/gyeon/GyeonServiceForm";
import WorkOrderForm    from "@/components/work-orders/WorkOrderForm";

type ModalState =
  | { mode: "none" }
  | { mode: "create" }
  | { mode: "edit";        estimate: EstimateDB }
  | { mode: "detail";      estimate: EstimateDB }
  | { mode: "gyeon" }
  | { mode: "work-order";  estimate: EstimateDB };

interface EstimatesClientProps {
  estimates: EstimateDB[];
  customers: CustomerDB[];
  vehicles:  VehicleDB[];
}

export default function EstimatesClient({ estimates, customers, vehicles }: EstimatesClientProps) {
  const [modal, setModal] = useState<ModalState>({ mode: "none" });

  const closeModal = () => setModal({ mode: "none" });

  return (
    <div className="max-w-7xl mx-auto">
      {/* Header row */}
      <div className="flex items-center justify-between mb-6">
        <PageTitle title="Estimates" subtitle="見積管理" />
        <div className="flex gap-2">
          <button
            onClick={() => setModal({ mode: "gyeon" })}
            className="shrink-0 bg-[#0f172a] hover:bg-slate-800 text-slate-200 border border-slate-700 text-sm font-medium px-4 py-2 rounded-lg transition-colors"
          >
            Create GYEON Estimate
          </button>
          <button
            onClick={() => setModal({ mode: "create" })}
            className="shrink-0 bg-[#1d4ed8] hover:bg-[#1e40af] text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors"
          >
            + New Estimate
          </button>
        </div>
      </div>

      {/* Table */}
      <EstimateTable
        estimates={estimates}
        onViewDetail={(e) => setModal({ mode: "detail", estimate: e })}
        onEdit={(e) => setModal({ mode: "edit", estimate: e })}
        onCreateWorkOrder={(e) => setModal({ mode: "work-order", estimate: e })}
      />

      {/* New / Edit Estimate Modal */}
      {(modal.mode === "create" || modal.mode === "edit") && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-[#0f172a]/80 backdrop-blur-sm"
            onClick={closeModal}
          />
          <div className="relative w-full max-w-lg bg-[#1e293b] rounded-xl shadow-lg p-6 overflow-y-auto max-h-[90vh]">
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-base font-semibold text-slate-100">
                {modal.mode === "edit" ? "Edit Estimate" : "New Estimate"}
              </h2>
              <button
                onClick={closeModal}
                className="text-slate-500 hover:text-slate-100 transition-colors text-lg leading-none"
              >
                ✕
              </button>
            </div>
            <EstimateForm
              estimate={modal.mode === "edit" ? modal.estimate : undefined}
              customers={customers}
              vehicles={vehicles}
              onCancel={closeModal}
              onSuccess={closeModal}
            />
          </div>
        </div>
      )}

      {/* GYEON Service Estimate Modal */}
      {modal.mode === "gyeon" && (
        <div className="fixed inset-0 z-50 flex items-start justify-center p-4 overflow-y-auto">
          <div
            className="fixed inset-0 bg-[#0f172a]/80 backdrop-blur-sm"
            onClick={closeModal}
          />
          <div className="relative w-full max-w-2xl bg-[#1e293b] rounded-xl shadow-lg p-6 my-4">
            <div className="flex items-center justify-between mb-5">
              <div>
                <h2 className="text-base font-semibold text-slate-100">GYEON Estimate</h2>
                <p className="text-xs text-slate-500 mt-0.5">Detailing Service</p>
              </div>
              <button
                onClick={closeModal}
                className="text-slate-500 hover:text-slate-100 transition-colors text-lg leading-none"
              >
                ✕
              </button>
            </div>
            <GyeonServiceForm estimates={estimates} onCancel={closeModal} onSuccess={closeModal} />
          </div>
        </div>
      )}

      {/* Estimate Detail Modal */}
      {modal.mode === "detail" && (
        <EstimateDetail
          estimate={modal.estimate}
          onClose={closeModal}
          onCreateWorkOrder={
            (modal.estimate.status === "approved" || modal.estimate.status === "APPROVED")
              ? () => setModal({ mode: "work-order", estimate: modal.estimate })
              : undefined
          }
        />
      )}

      {/* Work Order Creation Modal (from approved Estimate) */}
      {modal.mode === "work-order" && (
        <div className="fixed inset-0 z-50 flex items-start justify-center p-4 overflow-y-auto">
          <div
            className="fixed inset-0 bg-[#0f172a]/80 backdrop-blur-sm"
            onClick={closeModal}
          />
          <div className="relative w-full max-w-lg bg-[#1e293b] rounded-xl shadow-lg p-6 my-4">
            <div className="flex items-center justify-between mb-5">
              <div>
                <h2 className="text-base font-semibold text-slate-100">New Work Order</h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  見積 {modal.estimate.estimate_number ?? modal.estimate.estimate_no} から作成
                </p>
              </div>
              <button
                onClick={closeModal}
                className="text-slate-500 hover:text-slate-100 transition-colors text-lg leading-none"
              >
                ✕
              </button>
            </div>
            <WorkOrderForm
              estimates={estimates}
              customers={customers}
              vehicles={vehicles}
              initialEstimateId={modal.estimate.id}
              onCancel={closeModal}
              onSuccess={closeModal}
            />
          </div>
        </div>
      )}
    </div>
  );
}
