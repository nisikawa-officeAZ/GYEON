// The pure DealerBranding → BrandProfile mapper.
//
// Deterministic transform with NO "server-only" / Supabase / auth / database imports, so it can be
// unit-tested directly. `getBrandProfile` (the server-only loader) fetches the DealerBranding and
// delegates the mapping here.
//
// Dealer identity is preserved in BOTH variants (name, logo, contact, invoice registration number,
// footer tagline, configured QR links, document colours). The GYEON partner layer — rank, rank label,
// rank logo, wordmark, "GYEON JAPAN" footer, partner logo — is applied ONLY for the gyeon-classic
// build. The obsidian build never calls the GYEON rank/asset helpers and carries no GYEON marks.
//
// Anything the dealer has not configured is left OUT rather than invented; the only defaults are the
// visual brand tokens (the approved DealerOS navy).

import { gyeonRankLogo, gyeonWordmark } from "./brand-assets";
import { resolveGyeonRank, gyeonRankLabel } from "@/components/documents/brand";
import { BRAND_DEFAULT } from "@/components/documents/tokens";
import type { DealerBranding } from "./dealer-branding-types";
import type { BrandVariant } from "@/lib/brand/variant";
import type {
  BrandProfile,
  BrandQrLink,
  BrandBusiness,
  BrandFooter,
  GyeonRank,
} from "@/components/documents/types";

/** Empty string / whitespace is "not configured", not a value to print. */
function value(v: string | null | undefined): string | undefined {
  const s = (v ?? "").trim();
  return s ? s : undefined;
}

export function buildBrandProfile(
  dealerId: string,
  branding: DealerBranding,
  variant: BrandVariant,
): BrandProfile {
  const b = branding;
  const isGyeon = variant === "gyeon-classic";

  // Only real, configured SNS links are rendered — LINE appears only when the dealer uploaded its QR.
  const qrLinks: BrandQrLink[] = [];
  if (b.lineQr?.src) {
    qrLinks.push({ label: "LINE", url: "", icon: "line", qrImageUrl: b.lineQr.src });
  }

  // Dealer identity — present in both variants. "Prepared By"/responsible-person has no column.
  const business: BrandBusiness = {
    invoiceRegistrationNumber: value(b.invoiceRegNo),
  };
  const footer: BrandFooter = {
    tagline: value(b.footer),
    showPartnerLogo: false,
  };

  // GYEON partner layer — gyeon-classic only. The obsidian build never reaches the GYEON helpers.
  let rankLogoUrl: string | undefined;
  let gyeonWordmarkUrl: string | undefined;
  let rank: GyeonRank | undefined;
  if (isGyeon) {
    rank = resolveGyeonRank(b.detailerRank);
    business.shopRank = rank;
    business.shopRankLabel = gyeonRankLabel(rank);
    rankLogoUrl = gyeonRankLogo(rank);
    gyeonWordmarkUrl = gyeonWordmark();
    footer.partnerBrand = "GYEON JAPAN";
    footer.showPartnerLogo = true;
  }

  return {
    brandId: dealerId,
    brandNameJa: b.name ?? b.companyName ?? b.storeName ?? "",
    brandNameEn: undefined,
    logoUrl: b.logo?.src,
    // Visual token only — every dealer renders in the approved DealerOS navy; no tenant colour baked in.
    colors: { ...BRAND_DEFAULT },
    contact: {
      postalCode: value(b.postalCode),
      address: value(b.address),
      tel: value(b.phone),
      email: value(b.email),
      website: value(b.website),
    },
    business,
    footer,
    qrLinks,
    rankLogoUrl,
    gyeonWordmarkUrl,
    rank,
    partnerProgram: isGyeon ? "gyeon" : "none",
  };
}
