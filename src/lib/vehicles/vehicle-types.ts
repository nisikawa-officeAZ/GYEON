// DealerOS — Vehicle Types (Supabase schema aligned — RC-08)
// Column names match the vehicles table schema (snake_case).
// Migration 073_detailer_core_missing_fields.sql adds:
//   displacement, fuel_type, registration_date

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
  // Added in migration 073
  displacement:           string | null;
  fuel_type:              string | null;
  registration_date:      string | null;  // date (YYYY-MM-DD), from OCR first_registration_date
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
  customer_id:              string;          // Required — must belong to same dealer
  vehicle_code?:            string | null;
  maker?:                   string | null;
  model?:                   string | null;
  grade?:                   string | null;
  year?:                    string | null;
  color?:                   string | null;
  plate_number?:            string | null;
  vin?:                     string | null;
  body_size?:               string | null;
  mileage?:                 number | null;
  inspection_expiry_date?:  string | null;
  notes?:                   string | null;
  // Added in migration 073
  displacement?:            string | null;
  fuel_type?:               string | null;
  registration_date?:       string | null;
  dealer_id:                string;          // Required — always set server-side
};

// Fields accepted on UPDATE — id and dealer_id are used as scope, not changed.
export type VehicleUpdate = Partial<Omit<VehicleInsert, "dealer_id">>;
