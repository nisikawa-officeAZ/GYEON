"use client";

import { useState, useMemo } from "react";
import { useRouter }      from "next/navigation";
import { CustomerDB, customerDisplayName, customerKanaName } from "@/lib/customers/customer-types";
import { VehicleDB }      from "@/lib/vehicles/vehicle-types";
import PageTitle          from "@/components/ui/PageTitle";
import CustomerSearch     from "@/components/customers/CustomerSearch";
import type { CustomerSearchValues } from "@/components/customers/CustomerSearch";
import CustomerFilters    from "@/components/customers/CustomerFilters";
import type { BusinessFilter, LineFilter } from "@/components/customers/CustomerFilters";
import CustomerTable      from "@/components/customers/CustomerTable";
import CustomerForm       from "@/components/customers/CustomerForm";
import CustomerActivityTimeline from "@/components/activity/CustomerActivityTimeline";
import { useCurrentStaff } from "@/contexts/StaffContext";

const EMPTY_SEARCH: CustomerSearchValues = { name: "", phone: "", lineId: "" };

function digitsOnly(s: string): string {
  return s.replace(/[^0-9]/g, "");
}

function matchesCustomer(
  c: CustomerDB,
  search: CustomerSearchValues,
  business: BusinessFilter,
  line: LineFilter,
): boolean {
  const name = search.name.trim().toLowerCase();
  if (name) {
    const hay = `${customerDisplayName(c)} ${customerKanaName(c)}`.toLowerCase();
    if (!hay.includes(name)) return false;
  }
  const phone = digitsOnly(search.phone);
  if (phone && !digitsOnly(c.phone ?? "").includes(phone)) return false;

  const lineId = search.lineId.trim().toLowerCase();
  if (lineId) {
    const hay = `${c.line_user_id ?? ""} ${c.line_display_name ?? ""}`.toLowerCase();
    if (!hay.includes(lineId)) return false;
  }

  if (business === "business"   && !c.is_business) return false;
  if (business === "individual" &&  c.is_business) return false;
  if (line === "connected"   && !c.line_connected) return false;
  if (line === "unconnected" &&  c.line_connected) return false;

  return true;
}

type ModalState =
  | { mode: "none" }
  | { mode: "create" }
  | { mode: "edit"; customer: CustomerDB };

interface CustomersClientProps {
  customers: CustomerDB[];
  vehicles:  VehicleDB[];
}

export default function CustomersClient({ customers, vehicles }: CustomersClientProps) {
  const [modal, setModal] = useState<ModalState>({ mode: "none" });
  const { canEdit } = useCurrentStaff();
  const router = useRouter();

  const [search,   setSearch]   = useState<CustomerSearchValues>(EMPTY_SEARCH);
  const [business, setBusiness] = useState<BusinessFilter>("all");
  const [line,     setLine]     = useState<LineFilter>("all");

  const filtered = useMemo(
    () => customers.filter((c) => matchesCustomer(c, search, business, line)),
    [customers, search, business, line],
  );

  const closeModal = () => setModal({ mode: "none" });

  function handleStartEstimate(customer: CustomerDB) {
    router.push(`/estimates?customer_id=${customer.id}`);
  }

  function handleView(customer: CustomerDB) {
    router.push(`/customers/${customer.id}`);
  }

  return (
    <div className="max-w-7xl mx-auto">
      {/* Header row */}
      <div className="flex items-center justify-between mb-6">
        <PageTitle title="顧客管理" />
        {canEdit && (
          <button
            onClick={() => setModal({ mode: "create" })}
            className="shrink-0 bg-[#1d4ed8] hover:bg-[#1e40af] text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors"
          >
            + 新規顧客登録
          </button>
        )}
      </div>

      {/* Search */}
      <div className="mb-4">
        <CustomerSearch
          values={search}
          onChange={(field, value) => setSearch((s) => ({ ...s, [field]: value }))}
          onClear={() => setSearch(EMPTY_SEARCH)}
        />
      </div>

      {/* Filters */}
      <div className="mb-4">
        <CustomerFilters
          business={business}
          line={line}
          onBusiness={setBusiness}
          onLine={setLine}
          total={customers.length}
          shown={filtered.length}
        />
      </div>

      {/* Table */}
      <CustomerTable
        customers={filtered}
        onView={handleView}
        onEdit={canEdit ? (c) => setModal({ mode: "edit", customer: c }) : undefined}
        onStartEstimate={handleStartEstimate}
      />

      {/* Modal */}
      {modal.mode !== "none" && (
        <div className="fixed inset-0 z-50 flex items-start justify-center p-3 sm:p-4 overflow-y-auto">
          <div
            className="fixed inset-0 bg-[#0f172a]/80 backdrop-blur-sm"
            onClick={closeModal}
          />
          <div className="relative w-full max-w-2xl bg-[#1e293b] rounded-xl shadow-lg p-5 sm:p-6 my-4">
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-base font-semibold text-slate-100">
                {modal.mode === "edit" ? "顧客情報編集" : "新規顧客登録"}
              </h2>
              <button
                onClick={closeModal}
                className="w-9 h-9 flex items-center justify-center rounded-md text-slate-500 hover:text-slate-100 hover:bg-slate-700/50 transition-colors text-lg leading-none"
              >
                ✕
              </button>
            </div>
            <CustomerForm
              customer={modal.mode === "edit" ? modal.customer : undefined}
              onCancel={closeModal}
              onSuccess={closeModal}
            />

            {/* Linked vehicles panel */}
            {modal.mode === "edit" && (() => {
              const custVehicles = vehicles.filter(v => v.customer_id === modal.customer.id);
              return custVehicles.length > 0 ? (
                <div className="mt-5 pt-4 border-t border-slate-700">
                  <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">
                    紐付き車両 ({custVehicles.length}台)
                  </h3>
                  <div className="flex flex-col gap-2">
                    {custVehicles.map(v => (
                      <div key={v.id} className="bg-[#0f172a] rounded-lg px-3 py-2 flex items-center gap-3">
                        <span className="text-slate-300 text-sm font-medium">
                          {[v.maker, v.model].filter(Boolean).join(" ") || "車両"}
                        </span>
                        {v.grade && <span className="text-slate-500 text-xs">{v.grade}</span>}
                        {v.plate_number && (
                          <span className="ml-auto text-xs font-mono text-slate-400">{v.plate_number}</span>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              ) : null;
            })()}

            {modal.mode === "edit" && (
              <div className="mt-6 pt-5 border-t border-slate-700">
                <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">
                  アクティビティ
                </h3>
                <CustomerActivityTimeline customerId={modal.customer.id} />
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
