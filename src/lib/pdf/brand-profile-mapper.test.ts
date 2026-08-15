import { test } from "node:test";
import assert from "node:assert/strict";

import { buildBrandProfile } from "./brand-profile-mapper";
import type { DealerBranding } from "./dealer-branding-types";

// A fully-configured dealer, so both variants can be compared on identical input.
const branding: DealerBranding = {
  storeName: "サンプル店",
  companyName: "株式会社サンプル",
  name: "サンプル店",
  postalCode: "100-0001",
  address: "東京都千代田区0-0-0",
  phone: "03-0000-0000",
  email: "info@sample.example",
  website: "https://sample.example",
  invoiceRegNo: "T0000000000000",
  detailerRank: "certified-detailer",
  businessHours: null,
  footer: "I love my car",
  logo: { src: "data:image/png;base64,AAAA" },
  qrCode: null,
  lineQr: { src: "data:image/png;base64,BBBB" },
};

test("gyeon-classic includes the explicit GYEON partner layer", () => {
  const p = buildBrandProfile("dealer-1", branding, "gyeon-classic");
  assert.equal(p.partnerProgram, "gyeon");
  assert.ok(p.rank, "GYEON rank is resolved");
  assert.ok(p.business.shopRankLabel, "GYEON rank label is set");
  assert.equal(p.business.shopRank, p.rank);
  assert.equal(p.footer.partnerBrand, "GYEON JAPAN");
  assert.equal(p.footer.showPartnerLogo, true);
  // dealer identity is still present
  assert.equal(p.brandNameJa, "サンプル店");
  assert.equal(p.business.invoiceRegistrationNumber, "T0000000000000");
});

test("obsidian carries dealer identity but no GYEON partner fields/assets/rank", () => {
  const p = buildBrandProfile("dealer-1", branding, "obsidian");
  assert.equal(p.partnerProgram, "none");
  // no GYEON layer at all
  assert.equal(p.rank, undefined);
  assert.equal(p.rankLogoUrl, undefined);
  assert.equal(p.gyeonWordmarkUrl, undefined);
  assert.equal(p.business.shopRank, undefined);
  assert.equal(p.business.shopRankLabel, undefined);
  assert.equal(p.footer.partnerBrand, undefined);
  assert.equal(p.footer.showPartnerLogo, false);
  // dealer identity preserved
  assert.equal(p.brandNameJa, "サンプル店");
  assert.equal(p.logoUrl, "data:image/png;base64,AAAA");
  assert.equal(p.contact.tel, "03-0000-0000");
  assert.equal(p.contact.address, "東京都千代田区0-0-0");
  assert.equal(p.business.invoiceRegistrationNumber, "T0000000000000");
  assert.equal(p.footer.tagline, "I love my car");
  assert.equal(p.qrLinks.length, 1); // configured LINE QR still rendered
});
