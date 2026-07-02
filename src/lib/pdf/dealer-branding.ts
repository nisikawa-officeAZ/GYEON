"use server";

// DealerOS — Dealer Branding Engine (reusable across all PDF generators).
//
// ONE dealer-scoped provider loading branding from EXISTING dealer_settings:
// name, address, phone, email, website, invoice registration number, footer,
// and logo (mirrors the stamp loader — base64 from the dealer-branding bucket,
// falling back to the public logo_url). Every field falls back to null so the
// PDF blocks can render a graceful default when anything is missing.
//
// Security: dealer_id is always supplied by the caller from getCurrentDealer();
// never from client input. All reads are explicitly scoped to that dealer_id.

import { createAdminClient } from "@/lib/supabase/admin";
import { BRANDING_BUCKET } from "@/lib/branding/branding-types";
import { type DealerBranding, EMPTY_DEALER_BRANDING } from "./dealer-branding-types";

function clean(v: unknown): string | null {
  return typeof v === "string" && v.trim() !== "" ? v.trim() : null;
}

export async function getDealerBranding(dealerId: string): Promise<DealerBranding> {
  if (!dealerId) return { ...EMPTY_DEALER_BRANDING };
  try {
    const supabase = createAdminClient();

    // Always-present branding columns (pre-081); dealer-scoped.
    const { data } = await supabase
      .from("dealer_settings")
      .select(
        "business_name, company_name, postal_code, business_address, business_phone, business_email, business_website, qualified_invoice_number, pdf_footer, logo_url",
      )
      .eq("dealer_id", dealerId)
      .maybeSingle();

    if (!data) return { ...EMPTY_DEALER_BRANDING };
    const r = data as Record<string, unknown>;

    // Logo: prefer a base64 embed from logo_path (migration 081) for offline-safe
    // rendering; best-effort so a missing column/file never breaks branding.
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

    return {
      name: clean(r.business_name) ?? clean(r.company_name),
      companyName: clean(r.company_name),
      postalCode: clean(r.postal_code),
      address: clean(r.business_address),
      phone: clean(r.business_phone),
      email: clean(r.business_email),
      website: clean(r.business_website),
      invoiceRegNo: clean(r.qualified_invoice_number),
      footer: clean(r.pdf_footer),
      logo,
    };
  } catch (err) {
    console.error("[getDealerBranding] failed:", err);
    return { ...EMPTY_DEALER_BRANDING };
  }
}
