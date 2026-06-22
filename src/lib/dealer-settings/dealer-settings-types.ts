// DealerOS — Canonical Dealer Settings Types (PHASE71)
// Covers all columns defined in PHASE70 migration draft.
// Safe for server-side use. Never include LINE secrets here.

// ─── Primitives ───────────────────────────────────────────────────────────────

export type DetailerRank = "detailer" | "certified";

export type BodySizeKey = "SS" | "S" | "M" | "ML" | "L" | "LL" | "XL" | "XXL";

export type DiscountType = "fixed" | "percent";

// ─── Coupon & Discount ────────────────────────────────────────────────────────

export interface CouponSetting {
  name:   string;
  amount: number;
}

export interface DiscountPreset {
  id:            string;
  name:          string;
  discount_type: DiscountType;
  value:         number;
}

// ─── Tax ─────────────────────────────────────────────────────────────────────

export interface TaxSettings {
  standard_rate:  number;            // default: 10
  reduced_rate?:  number;            // e.g. 8 for food
  rounding_mode?: "floor" | "round" | "ceil";
}

// ─── Trade Defaults ───────────────────────────────────────────────────────────

export interface DealerTradeDefaults {
  notes?: string;
  [key: string]: unknown;
}

// ─── OCR ─────────────────────────────────────────────────────────────────────

export interface OcrPolicySettings {
  human_confirmation_required: boolean;
  allowed_formats?:            string[];
  max_file_size_mb?:           number;
}

// ─── PDF & Document ───────────────────────────────────────────────────────────

export interface PdfSettings {
  page_size?:       "A4" | "A5";
  header?:          string;
  footer?:          string;
  show_watermark?:  boolean;
  [key: string]:    unknown;
}

export interface DocumentSettings {
  estimate_validity_days?: number;
  auto_expire?:            boolean;
  [key: string]:           unknown;
}

// ─── SNS ─────────────────────────────────────────────────────────────────────

export interface SnsUrls {
  instagram?: string;
  x?:         string;
  google?:    string;
  line?:      string;
}

// ─── Reminder Templates ───────────────────────────────────────────────────────

export interface ReminderTemplate {
  id:            1 | 2 | 3;
  name:          string;
  months_after:  number;
  message:       string;
  menus:         string[];
  enabled:       boolean;
  repeat_yearly: boolean;
}

// ─── Service Price Settings ───────────────────────────────────────────────────

export interface CoatingProduct {
  id:             string;
  name:           string;
  grade:          string;
  base_price_m:   number;
  certified_only: boolean;
  active:         boolean;
}

export interface CoatingSettings {
  products:         CoatingProduct[];
  size_multipliers: Record<BodySizeKey, number>;
  topcoat_prices:   Record<string, number>;
  option_prices:    Record<string, number>;
  option_names:     Record<string, string>;
}

export interface PpfServiceOverview {
  active:       boolean;
  plan_labels:  Record<string, string>;
}

export interface WindowFilmSettings {
  base_prices: Record<string, number>;
  grade_coeff: Record<string, number>;
}

export interface ServiceMenuItem {
  id:    string;
  name:  string;
  price: number;
}

export interface MaintenanceSettings {
  menus: ServiceMenuItem[];
}

export interface CarwashSettings {
  menus: ServiceMenuItem[];
}

export interface RoomCleaningSettings {
  base_prices:     Record<string, number>;
  condition_coeff: Record<string, number>;
}

export interface ServicePriceSettings {
  coating:      CoatingSettings;
  ppf:          PpfServiceOverview;
  window_film:  WindowFilmSettings;
  maintenance:  MaintenanceSettings;
  carwash:      CarwashSettings;
  room_cleaning: RoomCleaningSettings;
}

// ─── PPF Price Tables ─────────────────────────────────────────────────────────

export interface PpfPriceTables {
  plan_prices:  Record<string, number>;
  film_coeff:   Record<string, number>;
  rank_coeff:   Record<string, number>;
  glass_prices: Record<string, number>;
  parts_prices: Record<string, number>;
}

// ─── Canonical Dealer Settings (server-side, no secrets) ─────────────────────
// This is the resolved type returned by getCanonicalDealerSettings().
// All nullable PHASE70 columns have defaults applied — nothing is undefined here.
// LINE secrets (line_channel_secret, line_access_token) are excluded.

export interface CanonicalDealerSettings {
  // Identity
  id:        string;
  dealer_id: string;

  // Store profile
  business_name:     string | null;
  company_name:      string | null;
  contact_name:      string | null;
  postal_code:       string | null;
  business_address:  string | null;
  business_phone:    string | null;
  business_phone_alt: string | null;  // PHASE70
  business_email:    string | null;
  business_website:  string | null;
  logo_url:          string | null;
  bank_account:      string | null;   // PHASE70

  // Detailer rank & business days
  detailer_rank:   DetailerRank;      // PHASE70, default: "detailer"
  closed_weekdays: number[] | null;   // PHASE70, 0=Sun..6=Sat
  temp_holidays:   string[] | null;   // PHASE70, YYYY-MM-DD[]

  // Trade defaults
  default_dealer_rate_percent: number;          // PHASE70, default: 70
  dealer_closing_day:          number | null;   // PHASE70
  dealer_payment_day:          number | null;   // PHASE70

  // OCR
  ocr_enabled: boolean;              // PHASE70, default: true
  ocr_policy:  OcrPolicySettings;   // PHASE70, with safe defaults

  // LINE — public fields only (no secrets)
  line_channel_id:            string | null;
  line_liff_id:               string | null;
  webhook_url:                string | null;
  line_enabled:               boolean;
  friend_add_qr_url:          string | null;   // PHASE70
  line_message_header:        string | null;   // PHASE70
  line_message_footer:        string | null;   // PHASE70
  maintenance_message_header: string | null;   // PHASE70
  maintenance_message_footer: string | null;   // PHASE70
  sns_urls:                   SnsUrls | null;  // PHASE70

  // PDF & document
  tax_rate:                  number;           // default: 10
  qualified_invoice_number:  string | null;
  stamp_url:                 string | null;
  pdf_footer:                string | null;
  invoice_note:              string | null;
  completion_note:           string | null;
  terms_and_conditions:      string | null;

  // Pricing — always arrays (defaults applied if DB is null)
  coupon_settings:   CouponSetting[];    // PHASE70, 5 fixed slots
  discount_presets:  DiscountPreset[];   // PHASE70

  // Service pricing — always set (defaults applied if DB is null)
  service_price_settings: ServicePriceSettings;  // PHASE70
  ppf_price_tables:       PpfPriceTables;        // PHASE70

  // Reminders — always array (defaults applied if DB is null)
  maintenance_reminder_templates: ReminderTemplate[];  // PHASE70, 3 fixed slots

  // Onboarding
  onboarding_completed:    boolean;
  onboarding_completed_at: string | null;
  onboarding_step:         number;

  // Timestamps
  created_at: string;
  updated_at: string;
}
