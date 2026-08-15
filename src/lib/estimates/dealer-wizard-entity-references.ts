// B7-3 — pure dealer-bound entity-reference resolution core.
//
// PURE and fully injected: no `server-only`, no Supabase, no React, no browser
// global. Storage/DB access arrives as injected readers, so every rule below —
// tenant binding, concurrency, failure precedence, row validation — is provable
// by plain `node:test` without a database.
//
// ── WHY A SEPARATE CORE AT ALL ──────────────────────────────────────────────
// The server wrapper (`get-dealer-wizard-entity-references.ts`) imports
// `server-only` and `createClient`, so it cannot be runtime-imported by a unit
// test. Splitting the DECISIONS (this file) from the CLIENT (the wrapper) is what
// lets the tenant boundary and the failure matrix be tested honestly rather than
// asserted in comments.
//
// ── THE LOAD-BEARING TENANT INVARIANT ───────────────────────────────────────
// The dealer id is taken ONCE from the branded actor context and is the single
// value passed to both readers AND validated against on every row. A reader
// cannot be handed a different tenant, and a row belonging to another dealer is a
// hard `malformed-row`, never silently included. `getCurrentDealer`-style
// rediscovery is structurally impossible here: there is nowhere to rediscover
// from.

import type { EstimateSaveActorContext } from "@/lib/auth/estimate-save-actor-context";
import type {
  WizardExistingCustomerReference,
  WizardExistingVehicleReference,
} from "@/components/estimates/wizard/contract/wizard-runtime-inputs";
import { toCustomerReference, toVehicleReference } from "./wizard-entity-references";

// ── Injected reader contract ────────────────────────────────────────────────

/**
 * One entity read. `rows` is `unknown[]` on purpose: shape validation is THIS
 * core's job, not the DB layer's, so a wrapper cannot smuggle an unvalidated row
 * through by typing it optimistically.
 */
export type EntityReadResult =
  | { readonly ok: true; readonly rows: readonly unknown[] }
  | { readonly ok: false };

/**
 * The two reads, each receiving the BOUND tenant explicitly. There is no
 * argument-less reader: the signature makes "read for some other dealer"
 * unrepresentable.
 */
export interface DealerEntityReaders {
  readonly readCustomers: (dealerId: string) => Promise<EntityReadResult>;
  readonly readVehicles: (dealerId: string) => Promise<EntityReadResult>;
}

// ── Result contract ─────────────────────────────────────────────────────────

/**
 * Every failure is a DISTINCT reason. `malformed-row` covers both a structurally
 * broken row and a cross-dealer row — the caller treats both as "do not mount",
 * and separating them would leak whether a foreign tenant has rows at all.
 */
export type DealerWizardEntityReferencesResult =
  | {
      readonly ok: true;
      readonly customers: readonly WizardExistingCustomerReference[];
      readonly vehicles: readonly WizardExistingVehicleReference[];
    }
  | {
      readonly ok: false;
      readonly reason:
        | "customer-read-failed"
        | "vehicle-read-failed"
        | "malformed-row"
        | "dependency-threw";
    };

const fail = (
  reason: "customer-read-failed" | "vehicle-read-failed" | "malformed-row" | "dependency-threw",
): DealerWizardEntityReferencesResult => ({ ok: false, reason });

// ── Row validation ──────────────────────────────────────────────────────────

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

const isNonEmptyString = (v: unknown): v is string => typeof v === "string" && v.trim() !== "";
const isNullableString = (v: unknown): v is string | null => v === null || typeof v === "string";

/**
 * The minimal customer row this core accepts. Exactly the fields the mapper
 * reads, plus `dealer_id` for the tenant check.
 */
type ValidatedCustomerRow = {
  id: string;
  last_name: string;
  first_name: string | null;
  phone: string | null;
};

type ValidatedVehicleRow = {
  id: string;
  customer_id: string;
  maker: string | null;
  model: string | null;
  plate_number: string | null;
  body_size: string | null;
};

/** null on ANY defect, including a `dealer_id` that is not exactly the bound tenant. */
function validateCustomerRow(row: unknown, dealerId: string): ValidatedCustomerRow | null {
  if (!isRecord(row)) return null;
  if (!isNonEmptyString(row.dealer_id) || row.dealer_id !== dealerId) return null;
  if (!isNonEmptyString(row.id)) return null;
  if (typeof row.last_name !== "string") return null;
  if (!isNullableString(row.first_name)) return null;
  if (!isNullableString(row.phone)) return null;
  return {
    id: row.id,
    last_name: row.last_name,
    first_name: row.first_name,
    phone: row.phone,
  };
}

function validateVehicleRow(row: unknown, dealerId: string): ValidatedVehicleRow | null {
  if (!isRecord(row)) return null;
  if (!isNonEmptyString(row.dealer_id) || row.dealer_id !== dealerId) return null;
  if (!isNonEmptyString(row.id)) return null;
  if (!isNonEmptyString(row.customer_id)) return null;
  if (!isNullableString(row.maker)) return null;
  if (!isNullableString(row.model)) return null;
  if (!isNullableString(row.plate_number)) return null;
  if (!isNullableString(row.body_size)) return null;
  return {
    id: row.id,
    customer_id: row.customer_id,
    maker: row.maker,
    model: row.model,
    plate_number: row.plate_number,
    body_size: row.body_size,
  };
}

// ── The resolver ────────────────────────────────────────────────────────────

/**
 * Resolve both reference lists for exactly the tenant the actor context
 * authorizes.
 *
 * The reads run CONCURRENTLY; only the EVALUATION of their settled outcomes is
 * customer-first. Both readers are invoked exactly once even if one throws or
 * fails — `Promise.resolve().then(...)` turns a synchronous throw into a settled
 * rejection so neither read can prevent the other from starting.
 *
 * Precedence (fixed, deterministic):
 *   1. customer rejected/threw     → dependency-threw
 *   2. customer fulfilled ok:false → customer-read-failed
 *   3. vehicle rejected/threw      → dependency-threw
 *   4. vehicle fulfilled ok:false  → vehicle-read-failed
 *   5. malformed/cross-dealer customer row → malformed-row
 *   6. malformed/cross-dealer vehicle row  → malformed-row
 *   7. otherwise → both complete reference arrays
 *
 * No failure returns a partial array. Order and duplicate IDs are preserved.
 */
export async function resolveDealerWizardEntityReferences(
  context: EstimateSaveActorContext,
  readers: DealerEntityReaders,
): Promise<DealerWizardEntityReferencesResult> {
  const dealerId = context.dealerId; // captured ONCE

  const [customerOutcome, vehicleOutcome] = await Promise.allSettled([
    Promise.resolve().then(() => readers.readCustomers(dealerId)),
    Promise.resolve().then(() => readers.readVehicles(dealerId)),
  ]);

  // 1-2. Customer outcome first.
  if (customerOutcome.status === "rejected") return fail("dependency-threw");
  if (!customerOutcome.value.ok) return fail("customer-read-failed");

  // 3-4. Vehicle outcome.
  if (vehicleOutcome.status === "rejected") return fail("dependency-threw");
  if (!vehicleOutcome.value.ok) return fail("vehicle-read-failed");

  // 5. Validate every customer row against the bound tenant, in order.
  const customers: WizardExistingCustomerReference[] = [];
  for (const raw of customerOutcome.value.rows) {
    const valid = validateCustomerRow(raw, dealerId);
    if (valid === null) return fail("malformed-row");
    customers.push(toCustomerReference(valid));
  }

  // 6. Validate every vehicle row against the bound tenant, in order.
  const vehicles: WizardExistingVehicleReference[] = [];
  for (const raw of vehicleOutcome.value.rows) {
    const valid = validateVehicleRow(raw, dealerId);
    if (valid === null) return fail("malformed-row");
    vehicles.push(toVehicleReference(valid));
  }

  // 7. Only a fully-validated pair is ever returned.
  return { ok: true, customers, vehicles };
}
