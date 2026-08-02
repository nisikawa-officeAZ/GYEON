// DEALEROS-ESTIMATE-INVOICE-PDF-B1-R5 — staff authorization decision core.
//
// Pure module: no server imports, no I/O, no environment. It encodes the ONE
// decision table that getCurrentStaff (application), the invoice RLS policies
// and save_invoice_draft (database) all implement, so the rule can be unit
// tested exhaustively here and asserted structurally against the SQL.
//
// Decision table
// --------------
//   dealer_staff query   dealer_staff row            fallback membership   decision
//   ------------------   -------------------------   -------------------   -----------------------
//   error                —                           anything              DENIED (fail closed)
//   ok                   active + recognized role    ignored               AUTHORIZED (canonical)
//   ok                   active + unknown role       ignored               DENIED
//   ok                   invited / disabled /        ignored — a row that  DENIED
//                        unknown status              exists BLOCKS fallback
//   ok                   none                        none                  DENIED
//   ok                   none                        active + recognized   AUTHORIZED (fallback)
//   ok                   none                        active + unknown role DENIED
//   ok                   none                        non-active status     DENIED
//
// dealer_staff is the PRIMARY authorization source. dealer_members is reached
// only when no dealer_staff row exists at all for the user in the dealer —
// never as a recovery path for a disabled, invited or unreadable row.

import type { DealerStaffRole } from "./staff-types";

export const RECOGNIZED_STAFF_ROLES: readonly DealerStaffRole[] = [
  "owner",
  "manager",
  "staff",
  "readonly",
];

// The finance write roles: invoices and invoice_items may only be mutated by
// these. Mirrors canViewFinance in staff-types and the SQL role lists.
export const FINANCE_ROLES: readonly DealerStaffRole[] = ["owner", "manager"];

export type DealerStaffQueryOutcome =
  | { kind: "row"; id: string; role: string; status: string }
  | { kind: "no-row" }
  | { kind: "error" };

export interface FallbackMembership {
  role: string;
  status: string;
}

export type StaffAuthorization =
  | {
      kind: "authorized";
      role: DealerStaffRole;
      staffId: string | null;
      source: "dealer_staff" | "dealer_members";
    }
  | { kind: "denied" };

export function isRecognizedStaffRole(role: string): role is DealerStaffRole {
  return (RECOGNIZED_STAFF_ROLES as readonly string[]).includes(role);
}

export function isFinanceRole(role: string): boolean {
  return (FINANCE_ROLES as readonly string[]).includes(role);
}

export function resolveStaffAuthorization(
  staffQuery: DealerStaffQueryOutcome,
  fallback: FallbackMembership | null
): StaffAuthorization {
  // A failed read of the canonical source is a denial, never a fallback: the
  // caller cannot prove they are not disabled.
  if (staffQuery.kind === "error") {
    return { kind: "denied" };
  }

  if (staffQuery.kind === "row") {
    // The row exists, so it is authoritative — whatever its state, the
    // dealer_members fallback is off the table from here on.
    if (staffQuery.status !== "active") return { kind: "denied" };
    if (!isRecognizedStaffRole(staffQuery.role)) return { kind: "denied" };
    return {
      kind: "authorized",
      role: staffQuery.role,
      staffId: staffQuery.id,
      source: "dealer_staff",
    };
  }

  // No dealer_staff row at all: the pre-staff-table membership may stand in,
  // but only if it is itself active with a recognized role.
  if (fallback === null) return { kind: "denied" };
  if (fallback.status !== "active") return { kind: "denied" };
  if (!isRecognizedStaffRole(fallback.role)) return { kind: "denied" };
  return {
    kind: "authorized",
    role: fallback.role,
    staffId: null,
    source: "dealer_members",
  };
}
