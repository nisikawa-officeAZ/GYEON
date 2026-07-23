"use server";

// DealerOS — Dealer Branding Engine (the ONE branding provider for EVERY PDF).
//
// Dealer-scoped; loads branding from EXISTING dealer_settings only (no schema):
// store name (business_name), company name, address, phone, email, website,
// invoice registration number, business hours (from the B1 business-hours
// config), footer message (pdf_footer), logo (base64 from the dealer-branding
// bucket via logo_path, falling back to logo_url), plus QR/LINE-QR fields
// (LINE QR sourced from friend_add_qr_url; both reserved for future rendering).
//
// Every field falls back to null so the shared PDF blocks render graceful
// defaults. dealer_id is always supplied by the caller from getCurrentDealer();
// never from client input, and every read is scoped to that dealer_id.

import { createAdminClient } from "@/lib/supabase/admin";
import { BRANDING_BUCKET } from "@/lib/branding/branding-types";
import { normalizeBusinessHoursConfig } from "@/lib/dealer-settings/business-hours";
import { type DealerBranding, EMPTY_DEALER_BRANDING } from "./dealer-branding-types";

function clean(v: unknown): string | null {
  return typeof v === "string" && v.trim() !== "" ? v.trim() : null;
}

function formatBusinessHours(businessDays: unknown): string | null {
  const cfg = normalizeBusinessHoursConfig(businessDays);
  if (cfg.default_hours) return `営業時間 ${cfg.default_hours.open}–${cfg.default_hours.close}`;
  return null;
}

export async function getDealerBranding(dealerId: string): Promise<DealerBranding> {
  if (!dealerId) return { ...EMPTY_DEALER_BRANDING };
  try {
    const supabase = createAdminClient();

    const { data } = await supabase
      .from("dealer_settings")
      .select(
        "business_name, company_name, postal_code, business_address, business_phone, business_email, business_website, qualified_invoice_number, detailer_rank, pdf_footer, logo_url, business_days, friend_add_qr_url",
      )
      .eq("dealer_id", dealerId)
      .maybeSingle();

    if (!data) return { ...EMPTY_DEALER_BRANDING };
    const r = data as Record<string, unknown>;

    // Logo: prefer a base64 embed from logo_path (081) for offline-safe rendering;
    // best-effort so a missing column/file never breaks branding.
    let logo: { src: string } | null = null;
    try {
      const { data: pathRow } = await supabase
        .from("dealer_settings")
        .select("logo_path")
        .eq("dealer_id", dealerId)
        .maybeSingle();
      const logoPath = clean((pathRow as Record<string, unknown> | null)?.logo_path);
      if (logoPath) {
        const { data: file } = await supabase.storage.from(BRANDING_BUCKET).download(logoPath);
        if (file) {
          const buf = Buffer.from(await file.arrayBuffer());
          logo = { src: `data:image/png;base64,${buf.toString("base64")}` };
        }
      }
    } catch {
      // logo_path unavailable — fall through to logo_url.
    }
    if (!logo && clean(r.logo_url)) logo = { src: (r.logo_url as string).trim() };

    const storeName = clean(r.business_name);
    const companyName = clean(r.company_name);
    const lineQrUrl = clean(r.friend_add_qr_url);

    return {
      storeName,
      companyName,
      name: storeName ?? companyName,
      postalCode: clean(r.postal_code),
      address: clean(r.business_address),
      phone: clean(r.business_phone),
      email: clean(r.business_email),
      website: clean(r.business_website),
      invoiceRegNo: clean(r.qualified_invoice_number),
      detailerRank: clean(r.detailer_rank),
      businessHours: formatBusinessHours(r.business_days),
      footer: clean(r.pdf_footer),
      logo,
      qrCode: null, // future
      lineQr: lineQrUrl ? { src: lineQrUrl } : null, // future rendering
    };
  } catch (err) {
    console.error("[getDealerBranding] failed:", err);
    return { ...EMPTY_DEALER_BRANDING };
  }
}
