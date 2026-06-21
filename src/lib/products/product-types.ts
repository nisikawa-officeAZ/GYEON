// Pure types — no "use server" directive

export interface GyeonProductDB {
  id:                   string;
  sku:                  string;
  jan_code:             string | null;
  product_name:         string;
  brand:                string;
  category:             string | null;
  size_label:           string | null;
  retail_price:         number | null;
  image_url:            string | null;
  description:          string | null;
  is_active:            boolean;
  created_at:           string;
  updated_at:           string;
}

export interface GyeonProductFilter {
  keyword?:      string;
  category?:     string;
  sku?:          string;
  active_only?:  boolean;
}

/** Snapshot stored on estimate_items / invoice_items when product is linked */
export interface ProductSnapshot {
  item_type:             'product';
  product_id:            string;
  sku:                   string;
  product_name_snapshot: string;
  retail_price_snapshot: number | null;
}
