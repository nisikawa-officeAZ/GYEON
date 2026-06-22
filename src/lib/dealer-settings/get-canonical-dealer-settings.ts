"use server";

// DealerOS — Canonical Dealer Settings Reader (PHASE71)
//
// Security rules:
//   1. dealer_id is ALWAYS sourced from getCurrentDealer() — never from forms.
//   2. LINE secrets (line_channel_secret, line_access_token) are NEVER returned.
//   3. PHASE70 migration may not be applied — all new columns are treated as
//      optional in the DB response. Missing/null columns fall back to defaults.
//   4. Never throws Internal Server Error — all DB failures return defaults with
//      a console.warn log. Callers do not need try/catch.

import { createClient }     from "@/lib/supabase/server";
import { getCurrentDealer } from "@/lib/auth/get-current-dealer";
import type {
  CanonicalDealerSettings,
  DetailerRank,
  CouponSetting,
  DiscountPreset,
  ServicePriceSettings,
  PpfPriceTables,
  ReminderTemplate,
  OcrPolicySettings,
  SnsUrls,
} from "./dealer-settings-types";
import {
  DEFAULT_COUPON_SETTINGS,
  DEFAULT_SERVICE_PRICE_SETTINGS,
  DEFAULT_PPF_PRICE_TABLES,
  DEFAULT_REMINDER_TEMPLATES,
  DEFAULT_OCR_POLICY,
  DEFAULT_DETAILER_RANK,
  DEFAULT_DEALER_RATE,
  DEFAULT_TAX_RATE,
  DEFAULT_OCR_ENABLED,
} from "./dealer-settings-defaults";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function str(v: unknown): string | null {
  return typeof v === "string" && v.trim() !== "" ? v.trim() : null;
}

function bool(v: unknown, fallback: boolean): boolean {
  return typeof v === "boolean" ? v : fallback;
}

function num(v: unknown, fallback: number): number {
  const n = Number(v);
  return isNaN(n) ? fallback : n;
}

function jsonAs<T>(v: unknown, fallback: T): T {
  if (v === null || v === undefined) return fallback;
  if (typeof v === "object") return v as T;
  return fallback;
}

function jsonArrayAs<T>(v: unknown, fallback: T[]): T[] {
  if (Array.isArray(v)) return v as T[];
  return fallback;
}

function toDetailerRank(v: unknown): DetailerRank {
  if (v === "certified") return "certified";
  return DEFAULT_DETAILER_RANK;
}

// ─── Merge raw DB row with defaults ──────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mergeWithDefaults(raw: Record<string, any>, dealerId: string): CanonicalDealerSettings {
  return {
    // Identity
    id:        str(raw.id)        ?? "",
    dealer_id: str(raw.dealer_id) ?? dealerId,

    // Store profile (pre-PHASE70 columns — always present)
    business_name:     str(raw.business_name),
    company_name:      str(raw.company_name),
    contact_name:      str(raw.contact_name),
    postal_code:       str(raw.postal_code),
    business_address:  str(raw.business_address),
    business_phone:    str(raw.business_phone),
    business_email:    str(raw.business_email),
    business_website:  str(raw.business_website),
    logo_url:          str(raw.logo_url),

    // Store profile (PHASE70 columns — may be absent)
    business_phone_alt: str(raw.business_phone_alt),
    bank_account:       str(raw.bank_account),

    // Detailer rank & business days (PHASE70)
    detailer_rank:   toDetailerRank(raw.detailer_rank),
    closed_weekdays: Array.isArray(raw.closed_weekdays) ? (raw.closed_weekdays as number[]) : null,
    temp_holidays:   Array.isArray(raw.temp_holidays)   ? (raw.temp_holidays as string[])   : null,

    // Trade defaults (PHASE70)
    default_dealer_rate_percent: num(raw.default_dealer_rate_percent, DEFAULT_DEALER_RATE),
    dealer_closing_day:          typeof raw.dealer_closing_day === "number" ? raw.dealer_closing_day : null,
    dealer_payment_day:          typeof raw.dealer_payment_day === "number" ? raw.dealer_payment_day : null,

    // OCR (PHASE70)
    ocr_enabled: bool(raw.ocr_enabled, DEFAULT_OCR_ENABLED),
    ocr_policy:  jsonAs<OcrPolicySettings>(raw.ocr_policy, DEFAULT_OCR_POLICY),

    // LINE — public fields only (secrets stripped)
    line_channel_id:            str(raw.line_channel_id),
    line_liff_id:               str(raw.line_liff_id),
    webhook_url:                str(raw.webhook_url),
    line_enabled:               bool(raw.line_enabled, false),
    friend_add_qr_url:          str(raw.friend_add_qr_url),
    line_message_header:        str(raw.line_message_header),
    line_message_footer:        str(raw.line_message_footer),
    maintenance_message_header: str(raw.maintenance_message_header),
    maintenance_message_footer: str(raw.maintenance_message_footer),
    sns_urls:                   jsonAs<SnsUrls | null>(raw.sns_urls, null),

    // PDF & document (pre-PHASE70 columns — always present)
    tax_rate:                 num(raw.tax_rate, DEFAULT_TAX_RATE),
    qualified_invoice_number: str(raw.qualified_invoice_number),
    stamp_url:                str(raw.stamp_url),
    pdf_footer:               str(raw.pdf_footer),
    invoice_note:             str(raw.invoice_note),
    completion_note:          str(raw.completion_note),
    terms_and_conditions:     str(raw.terms_and_conditions),

    // Pricing (PHASE70 — null in DB → hardcoded defaults)
    coupon_settings:  jsonArrayAs<CouponSetting>(raw.coupon_settings, DEFAULT_COUPON_SETTINGS),
    discount_presets: jsonArrayAs<DiscountPreset>(raw.discount_presets, []),

    // Service pricing (PHASE70 — null in DB → EstimateWizard hardcoded defaults)
    service_price_settings: jsonAs<ServicePriceSettings>(raw.service_price_settings, DEFAULT_SERVICE_PRICE_SETTINGS),
    ppf_price_tables:       jsonAs<PpfPriceTables>(raw.ppf_price_tables, DEFAULT_PPF_PRICE_TABLES),

    // Reminders (PHASE70 — null in DB → 3-slot defaults)
    maintenance_reminder_templates: jsonArrayAs<ReminderTemplate>(
      raw.maintenance_reminder_templates ?? raw.reminder_templates,
      DEFAULT_REMINDER_TEMPLATES,
    ),

    // Onboarding (pre-PHASE70)
    onboarding_completed:    bool(raw.onboarding_completed, false),
    onboarding_completed_at: str(raw.onboarding_completed_at),
    onboarding_step:         num(raw.onboarding_step, 0),

    // Timestamps
    created_at: str(raw.created_at) ?? new Date().toISOString(),
    updated_at: str(raw.updated_at) ?? new Date().toISOString(),
  };
}

// ─── Unauthenticated / error fallback ─────────────────────────────────────────

function buildFallback(dealerId: string): CanonicalDealerSettings {
  const now = new Date().toISOString();
  return mergeWithDefaults(
    { id: "", dealer_id: dealerId, created_at: now, updated_at: now },
    dealerId,
  );
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Returns canonical dealer settings with all PHASE70 defaults applied.
 * Safe for server components and server actions.
 * Never exposes LINE secrets.
 * Never throws — returns defaults on any error.
 */
export async function getCanonicalDealerSettings(): Promise<CanonicalDealerSettings> {
  let dealerId = "";

  try {
    const dealer = await getCurrentDealer();
    if (!dealer) {
      console.warn("[getCanonicalDealerSettings] no authenticated dealer — returning defaults");
      return buildFallback("");
    }
    dealerId = dealer.dealer_id;

    const supabase = await createClient();

    // select("*") returns only the columns that currently exist in the DB.
    // If PHASE70 migration has not been applied, new columns will simply be
    // absent from the result — mergeWithDefaults handles them with defaults.
    const { data, error } = await supabase
      .from("dealer_settings")
      .select("*")
      .eq("dealer_id", dealerId)
      .maybeSingle();

    if (error) {
      console.warn("[getCanonicalDealerSettings] DB error — using defaults:", error.message);
      return buildFallback(dealerId);
    }

    if (!data) {
      console.warn("[getCanonicalDealerSettings] no settings row found — using defaults");
      return buildFallback(dealerId);
    }

    // Strip secrets before merging — extra safety layer on top of select("*")
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { line_channel_secret, line_access_token, ...safe } = data as Record<string, unknown> & {
      line_channel_secret?: unknown;
      line_access_token?:   unknown;
    };

    return mergeWithDefaults(safe, dealerId);
  } catch (err) {
    console.warn("[getCanonicalDealerSettings] unexpected error — using defaults:", err);
    return buildFallback(dealerId);
  }
}
