// DealerOS — GYEON Service Estimate Types (Supabase schema aligned)
// Column names match the Supabase gyeon_service_estimates table exactly (snake_case).

import { ServiceCategory, BodySize, OptionKey } from "@/components/services/mockServiceEstimate";

export type GyeonOptionsJson = Record<OptionKey, boolean>;

export interface GyeonServiceEstimateDB {
  id:               string;
  estimate_id:      string;
  service_category: ServiceCategory;
  body_size:        BodySize;
  base_price:       number;
  options_json:     GyeonOptionsJson;
  discount:         number;
  subtotal:         number;
  tax:              number;
  total:            number;
  dealer_id:        string | null;
  deleted_at:       string | null;
  created_at:       string;
  updated_at:       string;

  // Joined data — populated when select includes relations (PDF-friendly)
  estimates?: {
    estimate_no:     string;
    estimate_number: string | null;
    status:          string;
    customers?:  {
      last_name:  string | null;
      first_name: string | null;
      phone:      string | null;
      email:      string | null;
    } | null;
    vehicles?:   {
      maker:        string | null;
      model:        string | null;
      year:         string | null;
      grade:        string | null;
      plate_number: string | null;
    } | null;
  } | null;
}

export type GyeonServiceEstimateInsert = {
  estimate_id:      string;
  service_category: ServiceCategory;
  body_size:        BodySize;
  base_price:       number;
  options_json:     GyeonOptionsJson;
  discount:         number;
  subtotal:         number;
  tax:              number;
  total:            number;
  dealer_id:        string;   // Required — always set server-side
};

export type GyeonServiceEstimateUpdate = Partial<Omit<GyeonServiceEstimateInsert, "dealer_id">>;
