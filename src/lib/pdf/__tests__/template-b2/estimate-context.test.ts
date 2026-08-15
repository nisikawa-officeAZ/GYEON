// TEMPLATE-B2 unit tests for the pure Chromium context builder.
//
// Pins: persisted totals pass through untouched, the exact Japanese probe strings survive the
// mapping, logo resolution accepts only embedded bytes, remote QR entries are dropped (missing
// channels omitted; zero channels possible), and internal_memo has no path into the context.
//
// Run: node --import tsx --test src/lib/pdf/__tests__/template-b2/*.test.ts

import { test } from "node:test";
import assert from "node:assert/strict";
import {
  buildEstimateChromiumContext,
  formatDocDateDisplay,
  docNoDisplay,
  serialHashDisplay,
  yen,
} from "../../chromium-document/estimate-document-context";
import type { EstimateDocumentData } from "@/components/documents/templates/estimate/estimate-data";
import type { BrandProfile } from "@/components/documents/types";

const LOGO = "data:image/png;base64,AAAA";

const data: EstimateDocumentData = {
  serial: "EST/2026/00012",
  issueDate: "2026-08-03T01:00:00.000Z",
  validUntil: "2026-09-02",
  customer: { name: "石井 紗也華", kind: "individual", postalCode: "460-0002", address: "名古屋市中区丸の内1-2-3", tel: "052-000-0000", email: "customer@example.jp" },
  vehicle: { name: "Ferrari 458 Italia", maker: "フェラーリ", year: "2015", grade: "Base", plate: "名古屋 332 ひ 3830", color: "ロッソコルサ / Red", mileage: "28,400 km" },
  items: [
    { category: "Coating", name: "MOHS EVO", description: "ボディコーティング", unitPrice: 90000, quantity: 1, discount: null, amount: 90000 },
    { category: "PPF", name: "PPF ヘッドライト", unitPrice: 25000, quantity: 2, discount: 5000, amount: 45000 },
  ],
  summary: { subtotal: 135000, discount: 10000, taxRatePercent: 10, tax: 12500, grandTotal: 137500 },
  notes: ["表示価格はすべて税込です。"],
};

const brand: BrandProfile = {
  brandId: "b",
  brandNameJa: "株式会社テストディテイラー",
  colors: { primary: "#000" },
  contact: { postalCode: "123-4567", address: "東京都テスト区1-2-3", tel: "03-1234-5678" },
  business: { shopRankLabel: "GYEON Certified Detailer", invoiceRegistrationNumber: "T1234567890123" },
  footer: {},
  qrLinks: [
    { label: "LINE", url: "https://line.example", icon: "line", qrImageUrl: "https://remote.example/qr.png" },
    { label: "Instagram", url: "https://ig.example", icon: "instagram", qrImageUrl: "data:image/png;base64,QQ==" },
  ],
};

test("persisted totals and amounts pass through with no recomputation", () => {
  const ctx = buildEstimateChromiumContext(data, brand, LOGO);
  assert.equal(ctx.documentData.summary.subtotalDisplay, "¥135,000");
  assert.equal(ctx.documentData.summary.discountDisplay, "−¥10,000");
  assert.equal(ctx.documentData.summary.taxLabelEn, "Tax 10%");
  assert.equal(ctx.documentData.summary.taxDisplay, "¥12,500");
  assert.equal(ctx.documentData.summary.grandTotalDisplay, "¥137,500");
  assert.equal(ctx.documentData.items[0].amountDisplay, "¥90,000");
  assert.equal(ctx.documentData.items[0].discountDisplay, undefined);
  assert.equal(ctx.documentData.items[1].discountDisplay, "−¥5,000");
});

test("exact Japanese probe strings survive the mapping (year display + plate)", () => {
  const ctx = buildEstimateChromiumContext(data, brand, LOGO);
  assert.equal(ctx.documentData.vehicle.yearDisplay, "2015 年");
  assert.equal(ctx.documentData.vehicle.plate, "名古屋 332 ひ 3830");
});

test("logo: embedded dealer bytes are used as-is; non-data URIs are rejected by the builder", () => {
  const ctx = buildEstimateChromiumContext(data, brand, LOGO);
  assert.equal(ctx.storeSettings.storeLogoSrc, LOGO);
  assert.throws(() => buildEstimateChromiumContext(data, brand, "https://remote.example/logo.png"));
  assert.throws(() => buildEstimateChromiumContext(data, brand, "" as string));
});

test("QR channels: remote images are dropped, embedded ones kept, zero channels possible", () => {
  const ctx = buildEstimateChromiumContext(data, brand, LOGO);
  assert.deepEqual(ctx.qrChannels.map((q) => q.label), ["Instagram"]);
  const none = buildEstimateChromiumContext(data, { ...brand, qrLinks: [] }, LOGO);
  assert.deepEqual(none.qrChannels, []);
});

test("issuer identity comes only from BrandProfile", () => {
  const ctx = buildEstimateChromiumContext(data, brand, LOGO);
  assert.equal(ctx.storeSettings.companyName, "株式会社テストディテイラー");
  assert.equal(ctx.storeSettings.invoiceRegistrationNumber, "T1234567890123");
  assert.equal(ctx.storeSettings.rank, "GYEON Certified Detailer");
  assert.equal(ctx.storeSettings.fax, undefined);
});

test("honorific derives from party kind (corporation → 御中, individual → 様)", () => {
  const ctx = buildEstimateChromiumContext(data, brand, LOGO);
  assert.equal(ctx.documentData.customer.honorific, "様");
  const corp = buildEstimateChromiumContext({ ...data, customer: { ...data.customer, kind: "corporation" } }, brand, LOGO);
  assert.equal(corp.documentData.customer.honorific, "御中");
});

test("context JSON never contains internal memo or cost fields", () => {
  const ctx = buildEstimateChromiumContext(data, brand, LOGO);
  const json = JSON.stringify(ctx).toLowerCase();
  for (const forbidden of ["internal_memo", "internalmemo", "dealer_cost", "margin"]) {
    assert.ok(!json.includes(forbidden), `context leaked ${forbidden}`);
  }
});

test("display helpers: dates (JST), doc number, serial hash, yen", () => {
  assert.equal(formatDocDateDisplay("2026-08-03T01:00:00.000Z"), "2026.08.03");
  assert.equal(formatDocDateDisplay("2026-09-02"), "2026.09.02");
  assert.equal(docNoDisplay("EST/2026/00012"), "EST / 2026 / 00012");
  assert.equal(serialHashDisplay("EST/2026/00012"), "DOC · EST-2026-00012");
  assert.equal(yen(1234567), "¥1,234,567");
});

test("valid-until is optional and omitted, never invented", () => {
  const ctx = buildEstimateChromiumContext({ ...data, validUntil: undefined }, brand, LOGO);
  assert.equal(ctx.documentData.validUntilDisplay, undefined);
});
