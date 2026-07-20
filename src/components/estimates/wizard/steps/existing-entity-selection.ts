// B7-2A — pure existing-entity resolution and filtering.
//
// No React, no fetch, no storage, no DB. Every decision is exact membership in the
// arrays the server supplied, so this module can be proven exhaustively.
//
// ── WHY THERE IS NO LOOKUP BY ID ────────────────────────────────────────────
// `defaultCustomerId` / `defaultVehicleId` arrive from a query string and are
// untrusted. Resolving them by searching the already-fetched, RLS-scoped arrays
// means an id belonging to another tenant behaves EXACTLY like an id that does not
// exist: both are absent, both resolve to null. A lookup by id — even a
// server-side one — would leak existence, because "not found" and "not yours"
// would take different paths.
//
// ── WHY DUPLICATES ARE REJECTED RATHER THAN RESOLVED ────────────────────────
// If an id appears twice, the two rows may differ. Picking either one is a silent
// guess about which record the operator meant, and the wrong guess attaches the
// estimate to the wrong customer or vehicle. Ambiguity is treated as invalid.

import type {
  WizardExistingCustomerReference,
  WizardExistingVehicleReference,
} from "../contract/wizard-runtime-inputs";
// The canonical registration-method union, re-exported by wizard-types as RegMethod.
// Type-only, and never re-declared here: a second spelling of "new"|"ocr"|"search"
// could drift from the draft contract that actually governs persistence mode.
import type { RegMethod } from "../wizard-types";

/** Ids appearing more than once. Order-independent; the set is the answer. */
function duplicateIds(ids: readonly string[]): ReadonlySet<string> {
  const seen = new Set<string>();
  const dupes = new Set<string>();
  for (const id of ids) {
    if (seen.has(id)) dupes.add(id);
    else seen.add(id);
  }
  return dupes;
}

/** Exactly one entry with this id, or null. Ambiguous and absent both give null. */
function findUnique<T extends { readonly id: string }>(
  items: readonly T[],
  id: string | undefined | null,
): T | null {
  if (typeof id !== "string" || id === "") return null;
  let found: T | null = null;
  for (const item of items) {
    if (item.id !== id) continue;
    if (found !== null) return null;   // second match → ambiguous → unselectable
    found = item;
  }
  return found;
}

export function customerIsSelectable(
  customers: readonly WizardExistingCustomerReference[],
  id: string,
): boolean {
  return findUnique(customers, id) !== null;
}

export function vehicleIsSelectable(
  vehicles: readonly WizardExistingVehicleReference[],
  id: string,
): boolean {
  return findUnique(vehicles, id) !== null;
}

/**
 * The vehicles an operator may choose for a given customer.
 *
 * Empty when no customer is selected — a vehicle cannot exist without its owner,
 * and offering an unowned list would invite exactly the mismatch this phase
 * exists to prevent. Duplicated ids are removed entirely (not de-duplicated to one
 * arbitrary row).
 */
export function selectableVehiclesForCustomer(
  vehicles: readonly WizardExistingVehicleReference[],
  customerId: string | null,
): readonly WizardExistingVehicleReference[] {
  if (customerId === null || customerId === "") return [];
  const ambiguous = duplicateIds(vehicles.map((v) => v.id));
  return vehicles.filter((v) => v.customerId === customerId && !ambiguous.has(v.id));
}

/** Customers an operator may choose. Duplicated ids are removed entirely. */
export function selectableCustomers(
  customers: readonly WizardExistingCustomerReference[],
): readonly WizardExistingCustomerReference[] {
  const ambiguous = duplicateIds(customers.map((c) => c.id));
  return customers.filter((c) => !ambiguous.has(c.id));
}

/** In-memory filter. No fetch; operates only on the supplied array. */
export function filterCustomers(
  customers: readonly WizardExistingCustomerReference[],
  query: string,
): readonly WizardExistingCustomerReference[] {
  const q = query.trim().toLowerCase();
  const pool = selectableCustomers(customers);
  if (q === "") return pool;
  return pool.filter((c) =>
    c.displayName.toLowerCase().includes(q) || (c.phone ?? "").toLowerCase().includes(q),
  );
}

export type ResolvedPreselection = {
  readonly customerId: string | null;
  readonly vehicleId: string | null;
};

/**
 * Resolve untrusted preselection ids.
 *
 * An invalid customer clears BOTH — keeping a vehicle whose owner could not be
 * resolved would leave a selection with no verifiable owner. A valid customer with
 * an invalid, ambiguous or foreign-owned vehicle keeps the customer and clears only
 * the vehicle: the customer half of the handoff was verifiable, so discarding it
 * would lose real operator context for no safety gain.
 */
export function resolvePreselection(
  customers: readonly WizardExistingCustomerReference[],
  vehicles: readonly WizardExistingVehicleReference[],
  defaultCustomerId?: string,
  defaultVehicleId?: string,
): ResolvedPreselection {
  const customer = findUnique(customers, defaultCustomerId);
  if (customer === null) return { customerId: null, vehicleId: null };

  const vehicle = findUnique(vehicles, defaultVehicleId);
  if (vehicle === null || vehicle.customerId !== customer.id) {
    return { customerId: customer.id, vehicleId: null };
  }
  return { customerId: customer.id, vehicleId: vehicle.id };
}

/**
 * The initial store patch for `useEstimateWizard`.
 *
 * Returns `undefined` when nothing resolved, so the hook takes its plain canonical
 * initial draft rather than a patch full of nulls.
 *
 * Only ids and the mode are written. `displayName`, `phone`, `plateNumber` and
 * `bodySize` are NEVER copied into the new-customer/new-vehicle fields: those hold
 * the payload for CREATING a record, and filling them from an existing reference
 * would describe a new record that duplicates one already in the database.
 */
export function preselectionStorePatch(
  resolved: ResolvedPreselection,
): { customer: { regMethod: "search"; existingId: string }; vehicle?: { existingId: string } } | undefined {
  if (resolved.customerId === null) return undefined;
  const base = { customer: { regMethod: "search" as const, existingId: resolved.customerId } };
  return resolved.vehicleId === null ? base : { ...base, vehicle: { existingId: resolved.vehicleId } };
}

/**
 * An existing customer is EFFECTIVE only when the mode says so AND the id still
 * resolves uniquely. Both halves matter: an id left over from a previous mode, or
 * one whose row has become ambiguous, must not keep the CREATE fields hidden.
 */
export function effectiveExistingCustomer(
  customers: readonly WizardExistingCustomerReference[],
  regMethod: RegMethod,
  existingId: string | null,
): WizardExistingCustomerReference | null {
  if (regMethod !== "search") return null;
  return findUnique(customers, existingId);
}

/** An existing vehicle is effective only under an effective existing customer. */
export function effectiveExistingVehicle(
  vehicles: readonly WizardExistingVehicleReference[],
  customerId: string | null,
  existingId: string | null,
): WizardExistingVehicleReference | null {
  if (customerId === null) return null;
  const vehicle = findUnique(vehicles, existingId);
  return vehicle !== null && vehicle.customerId === customerId ? vehicle : null;
}

/**
 * The customer selection patch — IDS AND MODE ONLY.
 *
 * ── WHY THIS DOES NOT SPREAD THE CURRENT OBJECTS ────────────────────────────
 * Spreading `{ ...c }` / `{ ...v }` would send every new-customer and new-vehicle
 * CREATE field back through the adapter on a selection change. That is a wide
 * write for a narrow intent: it re-asserts the whole snapshot, so any field the
 * projection had normalized differently silently round-trips, and a future field
 * added to the draft joins the write without anyone deciding it should. Emitting
 * only what changed keeps the blast radius equal to the intent.
 *
 * The vehicle section is present ONLY when an incompatible vehicle must be
 * cleared, so a compatible selection is left strictly alone.
 */
export type CustomerSelectionPatch = {
  readonly customer: { readonly regMethod: RegMethod; readonly existingId: string | null };
  readonly vehicle?: { readonly existingId: null };
};

export function customerSelectionPatch(
  vehicles: readonly WizardExistingVehicleReference[],
  nextRegMethod: RegMethod,
  nextCustomerId: string | null,
  currentVehicleId: string | null,
): CustomerSelectionPatch {
  const modeIsExisting = nextRegMethod === "search";
  const effectiveCustomerId = modeIsExisting ? nextCustomerId : null;
  const customer = { regMethod: nextRegMethod, existingId: effectiveCustomerId } as const;

  const keep = existingVehicleSurvives(vehicles, effectiveCustomerId, currentVehicleId, modeIsExisting);
  if (keep || currentVehicleId === null) return { customer };
  // Cleared in the SAME patch: two sequential writes would leave a render in which
  // the new customer holds the previous customer's vehicle.
  return { customer, vehicle: { existingId: null } };
}

/** The existing-vehicle patch — one key, never a spread of the vehicle projection. */
export function vehicleSelectionPatch(
  nextVehicleId: string | null,
): { readonly vehicle: { readonly existingId: string | null } } {
  return { vehicle: { existingId: nextVehicleId } };
}

/**
 * Whether a currently-selected vehicle survives a customer or mode change.
 *
 * Leaving existing/search mode invalidates any existing vehicle: a new or
 * OCR-entered customer cannot own a record that predates them.
 */
export function existingVehicleSurvives(
  vehicles: readonly WizardExistingVehicleReference[],
  nextCustomerId: string | null,
  currentVehicleId: string | null,
  customerModeIsExisting: boolean,
): boolean {
  if (!customerModeIsExisting) return false;
  if (currentVehicleId === null || nextCustomerId === null) return false;
  const vehicle = findUnique(vehicles, currentVehicleId);
  return vehicle !== null && vehicle.customerId === nextCustomerId;
}
