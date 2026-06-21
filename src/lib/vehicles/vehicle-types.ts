// DealerOS — Vehicle Types (Supabase schema aligned — PHASE37)
// Column names match the updated vehicles table schema (snake_case).
// Legacy columns (manufacturer, body_color, license_plate, memo) exist in DB
// but are not used by the app. Existing estimate JOINs still select those columns
// directly and are unaffected.

import { customerDisplayName } from "@/lib/customers/customer-types";

export interface VehicleDB {
  id:                     string;
  dealer_id:              string | null;
  customer_id:            string;
  vehicle_code:           string | null;
  maker:                  string | null;
  model:                  string | null;
  grade:                  string | null;
  year:                   string | null;   // text — integer conversion deferred to legacy cleanup
  color:                  string | null;
  plate_number:           string | null;
  vin:                    string | null;
  body_size:              string | null;
  mileage:                number | null;
  inspection_expiry_date: string | null;
  notes:                  string | null;
  deleted_at:             string | null;
  created_at:             string;
  updated_at:             string;

  // Joined customer data — populated when select includes customers relation
  customers?: {
    last_name:  string;
    first_name: string | null;
  } | null;
}

// Helper — display name: maker + model + plate_number
export function vehicleDisplayName(v: Pick<VehicleDB, "maker" | "model" | "plate_number">): string {
  return [v.maker, v.model, v.plate_number].filter(Boolean).join(" ");
}

// Re-export for convenience — vehicle table uses customer display name
export { customerDisplayName };

// Fields accepted on INSERT — dealer_id is injected server-side, never from client.
export type VehicleInsert = {
  customer_id:             string;          // Required — must belong to same dealer
  vehicle_code?:           string | null;
  maker?:                  string | null;
  model?:                  string | null;
  grade?:                  string | null;
  year?:                   string | null;
  color?:                  string | null;
  plate_number?:           string | null;
  vin?:                    string | null;
  body_size?:              string | null;
  mileage?:                number | null;
  inspection_expiry_date?: string | null;
  notes?:                  string | null;
  dealer_id:               string;          // Required — always set server-side
};

// Fields accepted on UPDATE — id and dealer_id are used as scope, not changed.
export type VehicleUpdate = Partial<Omit<VehicleInsert, "dealer_id">>;
