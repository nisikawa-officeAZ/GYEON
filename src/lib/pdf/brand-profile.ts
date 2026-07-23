import "server-only";

// The ONE BrandProfile loader (server-only module — NOT a client-invocable Server Action).
//
// It composes the existing `getDealerBranding()` provider (one source of dealer identity — it already
// resolves the shop logo, inlining an uploaded asset as a data URI) and delegates the
// DealerBranding → BrandProfile transform to the pure, variant-aware `buildBrandProfile()` mapper.
// The GYEON partner layer is applied only for the gyeon-classic build; the obsidian build carries
// dealer identity with no GYEON marks. No second database query, no authorization path — the caller
// has already resolved and tenant-scoped the dealer.

import { getDealerBranding } from "./dealer-branding";
import { buildBrandProfile } from "./brand-profile-mapper";
import { BRAND_VARIANT } from "@/lib/brand/variant";
import type { BrandProfile } from "@/components/documents/types";

export async function getBrandProfile(dealerId: string): Promise<BrandProfile> {
  const branding = await getDealerBranding(dealerId);
  return buildBrandProfile(dealerId, branding, BRAND_VARIANT);
}
