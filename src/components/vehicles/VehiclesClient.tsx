"use client";

import { useState, useMemo } from "react";
import { useRouter }    from "next/navigation";
import { VehicleDB }    from "@/lib/vehicles/vehicle-types";
import { CustomerDB }   from "@/lib/customers/customer-types";
import PageTitle        from "@/components/ui/PageTitle";
import VehicleSearch    from "@/components/vehicles/VehicleSearch";
import type { VehicleSearchValues } from "@/components/vehicles/VehicleSearch";
import VehicleFilters   from "@/components/vehicles/VehicleFilters";
import type { InspectionFilter, LinkFilter } from "@/components/vehicles/VehicleFilters";
import VehicleTable     from "@/components/vehicles/VehicleTable";
import VehicleForm      from "@/components/vehicles/VehicleForm";
import { deriveVehicleStatus } from "@/lib/vehicles/vehicle-status";

const EMPTY_SEARCH: VehicleSearchValues = { maker: "", model: "", plate: "" };

function norm(s: string): string {
  return s.replace(/[\s　]+/g, "").toLowerCase();
}

function matchesVehicle(
  v: VehicleDB,
  search: VehicleSearchValues,
  inspection: InspectionFilter,
  link: LinkFilter,
): boolean {
  const maker = search.maker.trim().toLowerCase();
  if (maker && !(v.maker ?? "").toLowerCase().includes(maker)) return false;

  const model = search.model.trim().toLowerCase();
  if (model && !(v.model ?? "").toLowerCase().includes(model)) return false;

  const plate = norm(search.plate);
  if (plate && !norm(v.plate_number ?? "").includes(plate)) return false;

  if (inspection !== "all") {
    const key = deriveVehicleStatus(v).key;
    const matchKey = inspection === "none" ? "unknown" : inspection;
    if (key !== matchKey) return false;
  }

  if (link === "linked"   && !v.customer_id) return false;
  if (link === "unlinked" &&  v.customer_id) return false;

  return true;
}

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
  const router = useRouter();

  const [search,     setSearch]     = useState<VehicleSearchValues>(EMPTY_SEARCH);
  const [inspection, setInspection] = useState<InspectionFilter>("all");
  const [link,       setLink]       = useState<LinkFilter>("all");

  const filtered = useMemo(
    () => vehicles.filter((v) => matchesVehicle(v, search, inspection, link)),
    [vehicles, search, inspection, link],
  );

  const closeModal = () => setModal({ mode: "none" });

  function handleView(vehicle: VehicleDB) {
    router.push(`/vehicles/${vehicle.id}`);
  }

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
        <VehicleSearch
          values={search}
          onChange={(field, value) => setSearch((s) => ({ ...s, [field]: value }))}
          onClear={() => setSearch(EMPTY_SEARCH)}
        />
      </div>

      {/* Filters */}
      <div className="mb-4">
        <VehicleFilters
          inspection={inspection}
          link={link}
          onInspection={setInspection}
          onLink={setLink}
          total={vehicles.length}
          shown={filtered.length}
        />
      </div>

      {/* Table */}
      <VehicleTable
        vehicles={filtered}
        onView={handleView}
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
