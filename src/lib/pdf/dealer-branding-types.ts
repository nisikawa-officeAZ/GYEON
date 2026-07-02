// DealerOS — Dealer Branding types (shared by the branding provider + PDF blocks).
// Pure — no imports, safe for both "use server" and render modules.

export interface DealerBranding {
  name: string | null;         // business_name, falling back to company_name
  companyName: string | null;  // legal company name
  postalCode: string | null;
  address: string | null;
  phone: string | null;
  email: string | null;
  website: string | null;
  invoiceRegNo: string | null; // qualified_invoice_number (適格請求書 登録番号)
  footer: string | null;       // pdf_footer (custom footer note)
  logo: { src: string } | null;
}

export const EMPTY_DEALER_BRANDING: DealerBranding = {
  name: null,
  companyName: null,
  postalCode: null,
  address: null,
  phone: null,
  email: null,
  website: null,
  invoiceRegNo: null,
  footer: null,
  logo: null,
};
