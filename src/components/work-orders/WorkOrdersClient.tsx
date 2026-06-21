"use client";

import { useState }     from "react";
import { WorkOrderDB }  from "@/lib/work-orders/work-order-types";
import { EstimateDB }   from "@/lib/estimates/estimate-types";
import { CustomerDB }   from "@/lib/customers/customer-types";
import { VehicleDB }    from "@/lib/vehicles/vehicle-types";
import PageTitle        from "@/components/ui/PageTitle";
import WorkOrderTable   from "@/components/work-orders/WorkOrderTable";
import WorkOrderForm    from "@/components/work-orders/WorkOrderForm";
import WorkOrderDetail  from "@/components/work-orders/WorkOrderDetail";

type ModalState =
  | { mode: "none" }
  | { mode: "create" }
  | { mode: "edit";   workOrder: WorkOrderDB }
  | { mode: "detail"; workOrder: WorkOrderDB };

interface WorkOrdersClientProps {
  workOrders: WorkOrderDB[];
  estimates:  EstimateDB[];
  customers:  CustomerDB[];
  vehicles:   VehicleDB[];
}

export default function WorkOrdersClient({
  workOrders,
  estimates,
  customers,
  vehicles,
}: WorkOrdersClientProps) {
  const [modal, setModal] = useState<ModalState>({ mode: "none" });

  const closeModal = () => setModal({ mode: "none" });

  return (
    <div className="max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <PageTitle title="Work Orders" subtitle="施工管理" />
        <button
          onClick={() => setModal({ mode: "create" })}
          className="shrink-0 bg-[#1d4ed8] hover:bg-[#1e40af] text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors"
        >
          + New Work Order
        </button>
      </div>

      {/* Table */}
      <WorkOrderTable
        workOrders={workOrders}
        onViewDetail={(wo) => setModal({ mode: "detail", workOrder: wo })}
        onEdit={(wo) => setModal({ mode: "edit", workOrder: wo })}
      />

      {/* Create / Edit Modal */}
      {(modal.mode === "create" || modal.mode === "edit") && (
        <div className="fixed inset-0 z-50 flex items-start justify-center p-4 overflow-y-auto">
          <div
            className="fixed inset-0 bg-[#0f172a]/80 backdrop-blur-sm"
            onClick={closeModal}
          />
          <div className="relative w-full max-w-lg bg-[#1e293b] rounded-xl shadow-lg p-6 my-4">
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-base font-semibold text-slate-100">
                {modal.mode === "edit" ? "Edit Work Order" : "New Work Order"}
              </h2>
              <button
                onClick={closeModal}
                className="text-slate-500 hover:text-slate-100 transition-colors text-lg leading-none"
              >
                ✕
              </button>
            </div>
            <WorkOrderForm
              workOrder={modal.mode === "edit" ? modal.workOrder : undefined}
              estimates={estimates}
              customers={customers}
              vehicles={vehicles}
              onCancel={closeModal}
              onSuccess={closeModal}
            />
          </div>
        </div>
      )}

      {/* Detail Modal */}
      {modal.mode === "detail" && (
        <WorkOrderDetail
          workOrder={modal.workOrder}
          onClose={closeModal}
        />
      )}
    </div>
  );
}
