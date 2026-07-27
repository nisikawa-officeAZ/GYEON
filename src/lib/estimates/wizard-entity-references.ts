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
 * The fields the label composer reads.
 *
 * Declared locally rather than as a `Pick<CustomerDB, …>` because the DB columns are nullable and
 * `CustomerDB` does not say so. `name` is OPTIONAL so a caller that does not select it — every
 * current reader — still satisfies the type without its column list changing.
 */
type CustomerNameParts = {
  readonly last_name: string | null;
  readonly first_name: string | null;
  readonly name?: string | null;
};

/**
 * Compose the customer label ONCE, on the server.
 *
 * Kept here rather than in the browser so every surface shows the same string and
 * the client never needs the name parts — which is the point: `last_name` and
 * `first_name` are exactly the fields a "minimal" reference is supposed to omit.
 */
function composeCustomerName(row: CustomerNameParts): string {
  // Canonical parts first. Both are read defensively: `customers.last_name` is a NULLABLE column
  // (added by migration 035) even though CustomerDB types it as `string`, so the previous
  // `row.last_name.trim()` was a TypeError waiting for the first row that never got a canonical
  // value written — exactly what the wizard writer produced before B2-B.3.
  const canonical = [row.last_name, row.first_name]
    .map((p) => (p ?? "").trim())
    .filter((p) => p !== "");
  if (canonical.length > 0) return canonical.join(" ");

  // Legacy fallback. `customers.name` is NOT NULL and holds the full name, so a row predating the
  // canonical backfill still labels correctly — provided the caller selected it. Neither current
  // reader does; widening their column lists is deliberately out of scope here, so this is a
  // forward-looking safety net rather than a repair of the existing readers.
  const legacy = (row.name ?? "").trim();
  if (legacy !== "") return legacy;

  // Same reasoning as composeVehicleName's fallback below: an empty label renders a blank,
  // unclickable-looking row that the operator cannot select or distinguish.
  return "（名前未登録）";
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

// ── Exact minimal mapper inputs (B7-3) ───────────────────────────────────────
// The mappers accept exactly the fields they read — no more. Widening the inputs
// from the full `CustomerDB`/`VehicleDB` to these `Pick<>` aliases lets a
// minimal-column dealer-bound loader supply rows without over-fetching, while a
// full row still satisfies the `Pick<>` (so every existing caller is unchanged).
// Runtime behavior, output shape, labels and fallbacks are identical.
type CustomerReferenceInput = Pick<CustomerDB, "id" | "last_name" | "first_name" | "phone">;
type VehicleReferenceInput = Pick<
  VehicleDB,
  "id" | "customer_id" | "maker" | "model" | "plate_number" | "body_size"
>;

/** Narrow one customer row. Exactly three keys leave this function. */
export function toCustomerReference(row: CustomerReferenceInput): WizardExistingCustomerReference {
  return {
    id: row.id,
    displayName: composeCustomerName(row),
    phone: row.phone,
  };
}

/** Narrow one vehicle row. Exactly five keys leave this function. */
export function toVehicleReference(row: VehicleReferenceInput): WizardExistingVehicleReference {
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
  rows: readonly CustomerReferenceInput[],
): readonly WizardExistingCustomerReference[] {
  return rows.map(toCustomerReference);
}

export function toVehicleReferences(
  rows: readonly VehicleReferenceInput[],
): readonly WizardExistingVehicleReference[] {
  return rows.map(toVehicleReference);
}
