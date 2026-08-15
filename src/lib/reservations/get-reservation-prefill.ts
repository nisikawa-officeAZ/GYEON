import type { WizardReservationPrefill } from "@/components/estimates/wizard/contract/wizard-runtime-inputs";
import { requireStaffCapability } from "@/lib/auth/require-staff-capability";
import { createClient } from "@/lib/supabase/server";

type PrefillCategory = "coating" | "maintenance" | "ppf" | "window" | "other" | null;

const RESERVATION_PREFILL_COLUMNS = "customer_id, vehicle_id, service_type, status, notes";

const ALLOWED_STATUSES: ReadonlySet<string> = new Set(["pending", "confirmed"]);

// wheel/interior are recognized reservation types with no wizard category (null).
// A service_type absent from this map is unrecognized and fails the ENTIRE prefill closed.
const CATEGORY_BY_SERVICE_TYPE: Readonly<Record<string, PrefillCategory>> = {
  coating: "coating",
  maintenance: "maintenance",
  ppf: "ppf",
  window: "window",
  wheel: null,
  interior: null,
  other: "other",
};

interface ReservationPrefillRow {
  customer_id: string | null;
  vehicle_id: string | null;
  service_type: string;
  status: string;
  notes: string | null;
}

interface ReservationPrefillQueryResult {
  data: ReservationPrefillRow | null;
  error: { message: string } | null;
}

interface ReservationPrefillClient {
  from(table: "reservations"): {
    select(columns: typeof RESERVATION_PREFILL_COLUMNS): {
      eq(
        column: "id",
        value: string,
      ): {
        eq(
          column: "dealer_id",
          value: string,
        ): {
          maybeSingle(): Promise<ReservationPrefillQueryResult>;
        };
      };
    };
  };
}

interface ReservationPrefillDeps {
  requireStaffCapability(
    capability: "edit",
  ): Promise<{ dealerId: string; role: unknown } | { error: string }>;
  createClient(): Promise<ReservationPrefillClient>;
}

export function createReservationPrefillLoader(deps: ReservationPrefillDeps) {
  return async function getReservationPrefill(
    reservationId: string,
  ): Promise<WizardReservationPrefill | null> {
    if (typeof reservationId !== "string" || reservationId.trim() === "") {
      return null;
    }

    const auth = await deps.requireStaffCapability("edit");
    if ("error" in auth) {
      return null;
    }

    let client: ReservationPrefillClient;
    try {
      client = await deps.createClient();
    } catch {
      return null;
    }

    let result: ReservationPrefillQueryResult;
    try {
      result = await client
        .from("reservations")
        .select(RESERVATION_PREFILL_COLUMNS)
        .eq("id", reservationId)
        .eq("dealer_id", auth.dealerId)
        .maybeSingle();
    } catch {
      return null;
    }

    if (result.error || !result.data) {
      return null;
    }

    const row = result.data;
    if (!ALLOWED_STATUSES.has(row.status)) {
      return null;
    }

    if (
      !Object.prototype.hasOwnProperty.call(CATEGORY_BY_SERVICE_TYPE, row.service_type)
    ) {
      return null;
    }
    const category = CATEGORY_BY_SERVICE_TYPE[row.service_type];

    const prefill: WizardReservationPrefill = {
      customerId: row.customer_id,
      vehicleId: row.vehicle_id,
      category,
      notesInternal: row.notes,
    };
    return prefill;
  };
}

async function createReservationPrefillClient(): Promise<ReservationPrefillClient> {
  const supabase = await createClient();
  return {
    from(table) {
      return {
        select(columns) {
          return {
            eq(column, value) {
              return {
                eq(innerColumn, innerValue) {
                  return {
                    async maybeSingle(): Promise<ReservationPrefillQueryResult> {
                      const { data, error } = await supabase
                        .from(table)
                        .select(columns)
                        .eq(column, value)
                        .eq(innerColumn, innerValue)
                        .maybeSingle();
                      return { data, error };
                    },
                  };
                },
              };
            },
          };
        },
      };
    },
  };
}

export const getReservationPrefill = createReservationPrefillLoader({
  requireStaffCapability,
  createClient: createReservationPrefillClient,
});
