// Phase 2 Sprint 3 — Vehicle status & tags FOUNDATION (derived, read-only).
//
// IMPORTANT: The vehicles table has no dedicated `status` or `tags` columns, and
// this sprint introduces NO schema change. Status is DERIVED from the existing
// inspection_expiry_date (車検満了日); tags are derived from existing columns.
// A future sprint can make these editable + persisted (which needs a migration).
//
// Pure functions only — safe to import from both server and client components.

import type { VehicleDB } from "./vehicle-types";

export type VehicleStatusTone = "green" | "amber" | "red" | "slate";

export interface VehicleStatus {
  key:   string;
  label: string;
  tone:  VehicleStatusTone;
}

const SOON_DAYS = 60;
const MS_PER_DAY = 86_400_000;

// Derived 車検 (inspection) status.
export function deriveVehicleStatus(v: VehicleDB): VehicleStatus {
  const exp = v.inspection_expiry_date?.trim();
  if (!exp) return { key: "unknown", label: "車検日未登録", tone: "slate" };

  const expDate = new Date(exp);
  if (isNaN(expDate.getTime())) {
    return { key: "unknown", label: "車検日未登録", tone: "slate" };
  }

  const days = Math.ceil((expDate.getTime() - Date.now()) / MS_PER_DAY);
  if (days < 0)          return { key: "expired", label: "車検切れ", tone: "red" };
  if (days <= SOON_DAYS) return { key: "soon",    label: "車検間近", tone: "amber" };
  return { key: "valid", label: "車検有効", tone: "green" };
}

// Short descriptor chips, derived from existing columns.
export function deriveVehicleTags(v: VehicleDB): string[] {
  const tags: string[] = [];

  if (v.fuel_type?.trim())    tags.push(v.fuel_type.trim());
  if (v.body_size?.trim())    tags.push(v.body_size.trim());
  if (v.displacement?.trim()) tags.push(v.displacement.trim());
  if (v.year?.trim())         tags.push(`${v.year.trim()}年`);
  if (v.color?.trim())        tags.push(v.color.trim());
  if (typeof v.mileage === "number" && v.mileage > 0) {
    tags.push(`${v.mileage.toLocaleString()}km`);
  }

  return tags;
}
