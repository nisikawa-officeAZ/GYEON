// DealerOS — Dealer Branding types (shared by the branding provider + PDF blocks).
// Pure — no imports, safe for both "use server" and render modules.

export interface DealerBranding {
  storeName: string | null;     // business_name (店舗名, optional)
  companyName: string | null;   // legal company name
  name: string | null;          // display name = storeName ?? companyName
  postalCode: string | null;
  address: string | null;
  phone: string | null;
  email: string | null;
  website: string | null;
  invoiceRegNo: string | null;  // qualified_invoice_number (適格請求書 登録番号)
  detailerRank: string | null;  // dealer_settings.detailer_rank (GYEON shop rank) — normalized by the BrandProfile loader
  businessHours: string | null; // derived from business hours settings (B1)
  footer: string | null;        // pdf_footer (footer message)
  logo: { src: string } | null;
  qrCode: { src: string } | null; // future (not rendered yet)
  lineQr: { src: string } | null; // future — friend_add_qr_url (not rendered yet)
}

export const EMPTY_DEALER_BRANDING: DealerBranding = {
  storeName: null,
  companyName: null,
  name: null,
  postalCode: null,
  address: null,
  phone: null,
  email: null,
  website: null,
  invoiceRegNo: null,
  detailerRank: null,
  businessHours: null,
  footer: null,
  logo: null,
  qrCode: null,
  lineQr: null,
};
