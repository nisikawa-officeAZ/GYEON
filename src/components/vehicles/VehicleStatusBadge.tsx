"use client";

// Phase 2 Sprint 3 — Derived vehicle (車検) status badge (read-only foundation).

import type { VehicleDB } from "@/lib/vehicles/vehicle-types";
import { deriveVehicleStatus, type VehicleStatusTone } from "@/lib/vehicles/vehicle-status";

const TONE_CLASS: Record<VehicleStatusTone, string> = {
  green: "text-green-400 border-green-500/30 bg-green-500/10",
  amber: "text-amber-400 border-amber-500/30 bg-amber-500/10",
  red:   "text-red-400 border-red-500/30 bg-red-500/10",
  slate: "text-slate-400 border-slate-600/40 bg-slate-700/30",
};

export default function VehicleStatusBadge({ vehicle }: { vehicle: VehicleDB }) {
  const status = deriveVehicleStatus(vehicle);
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded border text-[11px] font-semibold ${TONE_CLASS[status.tone]}`}>
      {status.label}
    </span>
  );
}
