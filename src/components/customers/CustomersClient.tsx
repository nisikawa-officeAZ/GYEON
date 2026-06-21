"use client";

import { useState }       from "react";
import { CustomerDB }     from "@/lib/customers/customer-types";
import PageTitle          from "@/components/ui/PageTitle";
import CustomerSearch     from "@/components/customers/CustomerSearch";
import CustomerTable      from "@/components/customers/CustomerTable";
import CustomerForm       from "@/components/customers/CustomerForm";
import { useCurrentStaff } from "@/contexts/StaffContext";

type ModalState =
  | { mode: "none" }
  | { mode: "create" }
  | { mode: "edit"; customer: CustomerDB };

interface CustomersClientProps {
  customers: CustomerDB[];
}

export default function CustomersClient({ customers }: CustomersClientProps) {
  const [modal, setModal] = useState<ModalState>({ mode: "none" });
  const { canEdit } = useCurrentStaff();

  const closeModal = () => setModal({ mode: "none" });

  return (
    <div className="max-w-7xl mx-auto">
      {/* Header row */}
      <div className="flex items-center justify-between mb-6">
        <PageTitle title="Customers" subtitle="顧客管理" />
        {canEdit && (
          <button
            onClick={() => setModal({ mode: "create" })}
            className="shrink-0 bg-[#1d4ed8] hover:bg-[#1e40af] text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors"
          >
            + New Customer
          </button>
        )}
      </div>

      {/* Search */}
      <div className="mb-4">
        <CustomerSearch />
      </div>

      {/* Table */}
      <CustomerTable
        customers={customers}
        onEdit={canEdit ? (c) => setModal({ mode: "edit", customer: c }) : undefined}
      />

      {/* Modal */}
      {modal.mode !== "none" && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-[#0f172a]/80 backdrop-blur-sm"
            onClick={closeModal}
          />
          <div className="relative w-full max-w-lg bg-[#1e293b] rounded-xl shadow-lg p-6 overflow-y-auto max-h-[90vh]">
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-base font-semibold text-slate-100">
                {modal.mode === "edit" ? "Edit Customer" : "New Customer"}
              </h2>
              <button
                onClick={closeModal}
                className="text-slate-500 hover:text-slate-100 transition-colors text-lg leading-none"
              >
                ✕
              </button>
            </div>
            <CustomerForm
              customer={modal.mode === "edit" ? modal.customer : undefined}
              onCancel={closeModal}
              onSuccess={closeModal}
            />
          </div>
        </div>
      )}
    </div>
  );
}
