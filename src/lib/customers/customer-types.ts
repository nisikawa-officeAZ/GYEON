// DealerOS — Customer Types (Supabase schema aligned — RC-08)
// Column names match the customers table schema (snake_case).
// Migration 073_detailer_core_missing_fields.sql adds:
//   is_business, trade_discount_pct, credit_terms

export interface CustomerDB {
  id:               string;
  dealer_id:        string | null;
  customer_code:    string | null;
  last_name:        string;
  first_name:       string | null;
  last_name_kana:   string | null;
  first_name_kana:  string | null;
  phone:            string | null;
  email:            string | null;
  postal_code:      string | null;
  prefecture:       string | null;
  city:             string | null;
  address1:         string | null;
  address2:         string | null;
  birthday:         string | null;
  gender:           string | null;
  occupation:       string | null;
  notes:            string | null;
  line_user_id:     string | null;
  line_display_name: string | null;
  line_picture_url:  string | null;
  line_connected:   boolean;
  // Business customer fields — added in migration 073
  is_business:        boolean;
  trade_discount_pct: number;
  credit_terms:       string | null;
  deleted_at:       string | null;
  created_at:       string;
  updated_at:       string;
}

// Helper — display name from split columns
export function customerDisplayName(c: Pick<CustomerDB, "last_name" | "first_name">): string {
  return [c.last_name, c.first_name].filter(Boolean).join(" ");
}

// Helper — kana display name
export function customerKanaName(c: Pick<CustomerDB, "last_name_kana" | "first_name_kana">): string {
  return [c.last_name_kana, c.first_name_kana].filter(Boolean).join(" ");
}

// Fields accepted on INSERT — dealer_id is injected server-side, never from client.
export type CustomerInsert = {
  customer_code?:     string | null;
  last_name:          string;
  first_name?:        string | null;
  last_name_kana?:    string | null;
  first_name_kana?:   string | null;
  phone?:             string | null;
  email?:             string | null;
  postal_code?:       string | null;
  prefecture?:        string | null;
  city?:              string | null;
  address1?:          string | null;
  address2?:          string | null;
  birthday?:          string | null;
  gender?:            string | null;
  occupation?:        string | null;
  notes?:             string | null;
  line_user_id?:      string | null;
  // Business customer fields
  is_business?:        boolean;
  trade_discount_pct?: number;
  credit_terms?:       string | null;
  dealer_id:          string;   // Required — always set server-side
};

// Fields accepted on UPDATE — id and dealer_id are used as scope, not changed.
export type CustomerUpdate = Partial<Omit<CustomerInsert, "dealer_id">>;

// Phase 2 Sprint 1 — query params for dealer-scoped duplicate detection.
// dealer_id is never part of this query; it is always resolved server-side.
export interface CustomerDuplicateQuery {
  last_name?:  string;
  first_name?: string;
  phone?:      string;
}
