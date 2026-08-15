"use client";

// Phase 2 Sprint 3 — Derived vehicle tag chips (read-only foundation).

import type { VehicleDB } from "@/lib/vehicles/vehicle-types";
import { deriveVehicleTags } from "@/lib/vehicles/vehicle-status";

export default function VehicleTagList({ vehicle }: { vehicle: VehicleDB }) {
  const tags = deriveVehicleTags(vehicle);
  if (tags.length === 0) return null;

  return (
    <div className="flex flex-wrap gap-1.5">
      {tags.map((t) => (
        <span
          key={t}
          className="inline-flex items-center px-2 py-0.5 rounded-md border border-white/[.08] bg-[#1a2236] text-[11px] text-slate-300"
        >
          {t}
        </span>
      ))}
    </div>
  );
}
