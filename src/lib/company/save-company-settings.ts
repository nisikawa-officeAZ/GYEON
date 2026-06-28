"use server";

import { createClient }    from "@/lib/supabase/server";
import { getCurrentDealer } from "@/lib/auth/get-current-dealer";
import { requireRole }      from "@/lib/staff/require-role";
import type { DealerSettingsDB } from "@/lib/line/line-types";
import { BRANDING_SCHEMA_READY } from "@/lib/flags";

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
  | "pdf_footer"
  | "invoice_note"
  | "tax_rate"
  // Bank information (migration 081)
  | "bank_name"
  | "bank_branch_name"
  | "bank_branch_code"
  | "account_type"
  | "account_number"
  | "account_holder_kana"
>;

export async function getCompanySettings(): Promise<CompanySettingsFields | null> {
  try {
    const dealer = await getCurrentDealer();
    if (!dealer) return null;

    const baseCols =
      "business_name, company_name, postal_code, business_address, business_phone, business_email, business_website, contact_name, qualified_invoice_number, pdf_footer, invoice_note, tax_rate";
    const bankCols =
      ", bank_name, bank_branch_name, bank_branch_code, account_type, account_number, account_holder_kana";

    const supabase = await createClient();
    const { data, error } = await supabase
      .from("dealer_settings")
      // Bank columns are only selected once REST exposes them (migration 081);
      // otherwise the whole select would 42703 and store settings wouldn't load.
      .select(BRANDING_SCHEMA_READY ? baseCols + bankCols : baseCols)
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

    const payload: Record<string, unknown> = {
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
      pdf_footer:               str("pdf_footer"),
      invoice_note:             str("invoice_note"),
      tax_rate:                 tax,
      updated_at:               new Date().toISOString(),
    };

    // Bank information (migration 081) — only written once REST exposes the
    // columns; otherwise the entire upsert would fail with PGRST204, blocking
    // even the pre-existing store-profile fields.
    if (BRANDING_SCHEMA_READY) {
      payload.bank_name           = str("bank_name");
      payload.bank_branch_name    = str("bank_branch_name");
      payload.bank_branch_code    = str("bank_branch_code");
      payload.account_type        = str("account_type");
      payload.account_number      = str("account_number");
      payload.account_holder_kana = str("account_holder_kana");
    }

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
