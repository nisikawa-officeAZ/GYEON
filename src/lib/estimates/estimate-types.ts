// DealerOS — Estimate Types (Supabase schema aligned)
// Column names match the Supabase estimates table exactly (snake_case).

export type EstimateStatus = "DRAFT" | "SENT" | "APPROVED" | "REJECTED";

export interface EstimateDB {
  id:          string;
  customer_id: string;
  vehicle_id:  string;
  estimate_no: string;
  status:      EstimateStatus;
  subtotal:    number;
  tax:         number;
  total:       number;
  dealer_id:   string | null;
  deleted_at:  string | null;
  created_at:  string;
  updated_at:  string;

  // Joined fields — populated when select includes relations
  customers?: {
    name:  string;
    phone: string | null;
    email: string | null;
  } | null;
  vehicles?: {
    manufacturer:  string | null;
    model:         string | null;
    year:          string | null;
    grade:         string | null;
    license_plate: string | null;
  } | null;
}

// Fields accepted on INSERT — dealer_id is injected server-side, never from client.
export type EstimateInsert = {
  customer_id: string;
  vehicle_id:  string;
  estimate_no: string;
  status:      EstimateStatus;
  subtotal:    number;
  tax:         number;
  total:       number;
  dealer_id:   string;   // Required — always set server-side
};

// Fields accepted on UPDATE — id and dealer_id are used as scope, not changed.
export type EstimateUpdate = Partial<Omit<EstimateInsert, "dealer_id">>;
