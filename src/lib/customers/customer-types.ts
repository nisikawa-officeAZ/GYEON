// DealerOS — Customer Types (Supabase schema aligned)
// Column names match the Supabase customers table exactly (snake_case).

export interface CustomerDB {
  id:          string;
  name:        string;
  kana:        string | null;
  phone:       string | null;
  email:       string | null;
  postal_code: string | null;
  address:     string | null;
  line_id:     string | null;
  memo:        string | null;
  dealer_id:   string | null;
  deleted_at:  string | null;
  created_at:  string;
  updated_at:  string;
}

// Fields accepted on INSERT — dealer_id is injected server-side, never from client.
export type CustomerInsert = {
  name:        string;
  kana?:       string | null;
  phone?:      string | null;
  email?:      string | null;
  postal_code?: string | null;
  address?:    string | null;
  line_id?:    string | null;
  memo?:       string | null;
  dealer_id:   string;   // Required — always set server-side
};

// Fields accepted on UPDATE — id and dealer_id are used as scope, not changed.
export type CustomerUpdate = Partial<Omit<CustomerInsert, "dealer_id">>;
