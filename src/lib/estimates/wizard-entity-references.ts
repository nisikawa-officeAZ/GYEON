// B7-2A — server-side projection: DB rows → minimal wizard entity references.
//
// The one place `CustomerDB` / `VehicleDB` are narrowed for the browser. It lives
// here, not in `contract/wizard-runtime-inputs.ts`, so the client contract module
// never imports a DB type — the boundary is enforced by the import graph rather
// than by review.
//
// ── WHAT THIS DELIBERATELY DROPS ────────────────────────────────────────────
// Everything a selection list does not need. A `CustomerDB` carries `dealer_id`,
// `birthday`, `notes`, `line_user_id`/`line_display_name`/`line_picture_url`,
// address parts, business terms and timestamps; a `VehicleDB` carries `dealer_id`,
// `vin`, `mileage`, `notes`, inspection dates, timestamps and a joined customer
// object. Passing whole rows would ship all of it into the browser AND serialize it
// into the RSC payload, where it is readable in page source — for every customer
// the dealer has, not just the selected one. Narrowing here is what keeps that
// from being one careless prop away.
//
// This module performs NO lookup, NO fetch and NO query. It is a pure mapping over
// rows the caller has already fetched under RLS.

import type { CustomerDB } from "@/lib/customers/customer-types";
import type { VehicleDB } from "@/lib/vehicles/vehicle-types";
import type {
  WizardExistingCustomerReference,
  WizardExistingVehicleReference,
} from "@/components/estimates/wizard/contract/wizard-runtime-inputs";

/**
 * Compose the customer label ONCE, on the server.
 *
 * Kept here rather than in the browser so every surface shows the same string and
 * the client never needs the name parts — which is the point: `last_name` and
 * `first_name` are exactly the fields a "minimal" reference is supposed to omit.
 */
function composeCustomerName(row: Pick<CustomerDB, "last_name" | "first_name">): string {
  const last = row.last_name.trim();
  const first = (row.first_name ?? "").trim();
  return first ? `${last} ${first}` : last;
}

/** Compose the vehicle label. Falls back through maker/model to the plate. */
function composeVehicleName(
  row: Pick<VehicleDB, "maker" | "model" | "plate_number">,
): string {
  const parts = [row.maker, row.model].map((p) => (p ?? "").trim()).filter((p) => p !== "");
  if (parts.length > 0) return parts.join(" ");
  const plate = (row.plate_number ?? "").trim();
  // A vehicle with neither maker nor model still has to be selectable and
  // distinguishable; an empty label would render a blank, unclickable-looking row.
  return plate !== "" ? plate : "（車両情報なし）";
}

/** Narrow one customer row. Exactly three keys leave this function. */
export function toCustomerReference(row: CustomerDB): WizardExistingCustomerReference {
  return {
    id: row.id,
    displayName: composeCustomerName(row),
    phone: row.phone,
  };
}

/** Narrow one vehicle row. Exactly five keys leave this function. */
export function toVehicleReference(row: VehicleDB): WizardExistingVehicleReference {
  return {
    id: row.id,
    customerId: row.customer_id,
    displayName: composeVehicleName(row),
    plateNumber: row.plate_number,
    // Display/orientation only. Never used to set confirmedSize/bodySizeKey.
    bodySize: row.body_size,
  };
}

export function toCustomerReferences(
  rows: readonly CustomerDB[],
): readonly WizardExistingCustomerReference[] {
  return rows.map(toCustomerReference);
}

export function toVehicleReferences(
  rows: readonly VehicleDB[],
): readonly WizardExistingVehicleReference[] {
  return rows.map(toVehicleReference);
}
