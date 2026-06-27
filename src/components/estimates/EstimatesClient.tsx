"use client";

import { useState }      from "react";
import { useRouter }     from "next/navigation";
import { EstimateDB }    from "@/lib/estimates/estimate-types";
import { CustomerDB }    from "@/lib/customers/customer-types";
import { VehicleDB }     from "@/lib/vehicles/vehicle-types";
import type { DetailerRank } from "@/lib/dealer-settings/dealer-settings-types";
import PageTitle         from "@/components/ui/PageTitle";
import EstimateTable     from "@/components/estimates/EstimateTable";
import EstimateForm      from "@/components/estimates/EstimateForm";
import EstimateWizard    from "@/components/estimates/EstimateWizard";
import EstimateDetail    from "@/components/estimates/EstimateDetail";
import GyeonServiceForm  from "@/components/gyeon/GyeonServiceForm";
import WorkOrderForm     from "@/components/work-orders/WorkOrderForm";
import CustomerVehicleOnboardingWizard from "@/components/onboarding/CustomerVehicleOnboardingWizard";

type ModalState =
  | { mode: "none" }
  | { mode: "create" }
  | { mode: "onboarding" }
  | { mode: "edit";        estimate: EstimateDB }
  | { mode: "detail";      estimate: EstimateDB }
  | { mode: "gyeon" }
  | { mode: "work-order";  estimate: EstimateDB };

interface EstimatesClientProps {
  estimates:         EstimateDB[];
  customers:         CustomerDB[];
  vehicles:          VehicleDB[];
  dealerRank:        DetailerRank;
  defaultCustomerId?: string;
}

export default function EstimatesClient({ estimates, customers, vehicles, dealerRank, defaultCustomerId }: EstimatesClientProps) {
  const router = useRouter();
  // Auto-open wizard when navigated from customer page with a customer pre-selected
  const [modal, setModal] = useState<ModalState>(
    defaultCustomerId ? { mode: "create" } : { mode: "none" }
  );

  const closeModal = () => setModal({ mode: "none" });

  return (
    <div className="max-w-7xl mx-auto">
      {/* Header row */}
      <div className="flex items-center justify-between mb-6">
        <PageTitle title="見積管理" />
        <div className="flex gap-2">
          <button
            onClick={() => setModal({ mode: "onboarding" })}
            className="shrink-0 bg-[#0f172a] hover:bg-slate-800 text-slate-200 border border-slate-700 text-sm font-medium px-4 py-2 rounded-lg transition-colors"
          >
            顧客・車両登録
          </button>
          <button
            onClick={() => setModal({ mode: "gyeon" })}
            className="shrink-0 bg-[#0f172a] hover:bg-slate-800 text-slate-200 border border-slate-700 text-sm font-medium px-4 py-2 rounded-lg transition-colors"
          >
            GYEON見積作成
          </button>
          <button
            onClick={() => setModal({ mode: "create" })}
            className="shrink-0 bg-[#1d4ed8] hover:bg-[#1e40af] text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors"
          >
            + 新規見積
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

      {/* Customer & Vehicle Onboarding Modal */}
      {modal.mode === "onboarding" && (
        <div className="fixed inset-0 z-50 flex items-start justify-center p-3 sm:p-4 overflow-y-auto overscroll-contain">
          <div
            className="fixed inset-0 bg-[#0f172a]/80 backdrop-blur-sm"
            onClick={closeModal}
          />
          <div className="relative w-full max-w-xl bg-[#1e293b] rounded-xl shadow-lg p-6 my-4">
            <div className="flex items-center justify-between mb-5">
              <div>
                <h2 className="text-base font-semibold text-slate-100">顧客・車両登録</h2>
                <p className="text-xs text-slate-500 mt-0.5">登録後に見積作成画面が開きます</p>
              </div>
              <button
                onClick={closeModal}
                className="w-9 h-9 flex items-center justify-center rounded-md text-slate-500 hover:text-slate-100 hover:bg-slate-700/50 transition-colors text-lg leading-none"
              >
                ✕
              </button>
            </div>
            <CustomerVehicleOnboardingWizard
              customers={customers}
              onComplete={() => {
                router.refresh();
                setModal({ mode: "create" });
              }}
              onCancel={closeModal}
            />
          </div>
        </div>
      )}

      {/* New Estimate Wizard Modal */}
      {modal.mode === "create" && (
        <div className="fixed inset-0 z-50 flex items-start justify-center p-2 sm:p-4 overflow-y-auto overscroll-contain">
          <div
            className="fixed inset-0 bg-[#0f172a]/80 backdrop-blur-sm"
            onClick={closeModal}
          />
          <div className="relative w-full max-w-xl bg-[#1e293b] rounded-xl shadow-lg p-4 sm:p-6 my-2 sm:my-4">
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-base font-semibold text-slate-100">新規見積</h2>
              <button
                onClick={closeModal}
                className="w-9 h-9 flex items-center justify-center rounded-md text-slate-500 hover:text-slate-100 hover:bg-slate-700/50 transition-colors text-lg leading-none"
              >
                ✕
              </button>
            </div>
            <EstimateWizard
              customers={customers}
              vehicles={vehicles}
              dealerRank={dealerRank}
              defaultCustomerId={defaultCustomerId}
              onCancel={closeModal}
              onSuccess={closeModal}
            />
          </div>
        </div>
      )}

      {/* Edit Estimate Modal */}
      {modal.mode === "edit" && (
        <div className="fixed inset-0 z-50 flex items-start justify-center p-3 sm:p-4 overflow-y-auto">
          <div
            className="fixed inset-0 bg-[#0f172a]/80 backdrop-blur-sm"
            onClick={closeModal}
          />
          <div className="relative w-full max-w-lg bg-[#1e293b] rounded-xl shadow-lg p-5 my-4">
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-base font-semibold text-slate-100">見積編集</h2>
              <button
                onClick={closeModal}
                className="w-9 h-9 flex items-center justify-center rounded-md text-slate-500 hover:text-slate-100 hover:bg-slate-700/50 transition-colors text-lg leading-none"
              >
                ✕
              </button>
            </div>
            <EstimateForm
              estimate={modal.estimate}
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
                <h2 className="text-base font-semibold text-slate-100">GYEON見積</h2>
                <p className="text-xs text-slate-500 mt-0.5">施工内容見積</p>
              </div>
              <button
                onClick={closeModal}
                className="w-9 h-9 flex items-center justify-center rounded-md text-slate-500 hover:text-slate-100 hover:bg-slate-700/50 transition-colors text-lg leading-none"
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
                <h2 className="text-base font-semibold text-slate-100">新規施工指示</h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  見積 {modal.estimate.estimate_number ?? modal.estimate.estimate_no} から作成
                </p>
              </div>
              <button
                onClick={closeModal}
                className="w-9 h-9 flex items-center justify-center rounded-md text-slate-500 hover:text-slate-100 hover:bg-slate-700/50 transition-colors text-lg leading-none"
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
