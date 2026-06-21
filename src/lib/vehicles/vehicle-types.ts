// DealerOS — Vehicle Types (Supabase schema aligned)
// Column names match the Supabase vehicles table exactly (snake_case).

export interface VehicleDB {
  id:            string;
  customer_id:   string;
  manufacturer:  string | null;
  model:         string | null;
  year:          string | null;
  grade:         string | null;
  body_color:    string | null;
  license_plate: string | null;
  vin:           string | null;
  memo:          string | null;
  dealer_id:     string | null;
  deleted_at:    string | null;
  created_at:    string;
  updated_at:    string;
}

// Fields accepted on INSERT — dealer_id is injected server-side, never from client.
export type VehicleInsert = {
  customer_id:   string;   // Required — must belong to same dealer
  manufacturer?: string | null;
  model?:        string | null;
  year?:         string | null;
  grade?:        string | null;
  body_color?:   string | null;
  license_plate?: string | null;
  vin?:          string | null;
  memo?:         string | null;
  dealer_id:     string;   // Required — always set server-side
};

// Fields accepted on UPDATE — id and dealer_id are used as scope, not changed.
export type VehicleUpdate = Partial<Omit<VehicleInsert, "dealer_id">>;
