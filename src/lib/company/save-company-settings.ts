"use server";

import { createClient }    from "@/lib/supabase/server";
import { getCurrentDealer } from "@/lib/auth/get-current-dealer";
import { requireRole }      from "@/lib/staff/require-role";
import type { DealerSettingsDB } from "@/lib/line/line-types";

export type CompanySettingsFields = Pick<
  DealerSettingsDB,
  | "business_name"
  | "company_name"
  | "postal_code"
  | "business_address"
  | "business_phone"
  | "business_email"
  | "business_website"
  | "contact_name"
  | "qualified_invoice_number"
  | "logo_url"
  | "stamp_url"
  | "pdf_footer"
  | "invoice_note"
  | "tax_rate"
>;

export async function getCompanySettings(): Promise<CompanySettingsFields | null> {
  try {
    const dealer = await getCurrentDealer();
    if (!dealer) return null;

    const supabase = await createClient();
    const { data, error } = await supabase
      .from("dealer_settings")
      .select(
        "business_name, company_name, postal_code, business_address, business_phone, business_email, business_website, contact_name, qualified_invoice_number, logo_url, stamp_url, pdf_footer, invoice_note, tax_rate"
      )
      .eq("dealer_id", dealer.dealer_id)
      .maybeSingle();

    if (error) {
      console.error("[getCompanySettings] error:", error);
      return null;
    }

    return data as CompanySettingsFields | null;
  } catch (err) {
    console.error("[getCompanySettings] failed:", err);
    return null;
  }
}

export async function saveCompanySettings(
  fd: FormData
): Promise<{ error: string } | { success: true }> {
  try {
    // Requires owner or manager — throws if role is insufficient or unauthenticated.
    // dealer_id is resolved server-side via requireRole → getCurrentDealer(); never from client.
    const { dealerId } = await requireRole(["owner", "manager"]);

    const supabase = await createClient();

    const str = (key: string) => (fd.get(key) as string | null)?.trim() || null;
    const taxRaw = parseFloat((fd.get("tax_rate") as string) ?? "10");
    const tax = isNaN(taxRaw) || taxRaw < 0 || taxRaw > 100 ? 10 : taxRaw;

    const payload = {
      dealer_id:                dealerId,
      business_name:            str("business_name"),
      company_name:             str("company_name"),
      postal_code:              str("postal_code"),
      business_address:         str("business_address"),
      business_phone:           str("business_phone"),
      business_email:           str("business_email"),
      business_website:         str("business_website"),
      contact_name:             str("contact_name"),
      qualified_invoice_number: str("qualified_invoice_number"),
      logo_url:                 str("logo_url"),
      stamp_url:                str("stamp_url"),
      pdf_footer:               str("pdf_footer"),
      invoice_note:             str("invoice_note"),
      tax_rate:                 tax,
      updated_at:               new Date().toISOString(),
    };

    const { error } = await supabase
      .from("dealer_settings")
      .upsert(payload, { onConflict: "dealer_id" });

    if (error) {
      console.error("[saveCompanySettings] error:", error);
      return { error: error.message };
    }

    return { success: true };
  } catch (err) {
    console.error("[saveCompanySettings] failed:", err);
    const msg = err instanceof Error ? err.message : "保存に失敗しました";
    return { error: msg };
  }
}
