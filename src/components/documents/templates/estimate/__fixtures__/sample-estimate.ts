// DEV-ONLY isolated fixture for Estimate PDF visual verification (PHASE 12B-A).
// NOT imported by the template or any production path — sample data lives ONLY here.

import type { BrandProfile } from "../../../types";
import { demoShopLogo, qrPlaceholder, snsIcon } from "@/lib/pdf/brand-assets";
import type { EstimateDocumentData, EstimateItem } from "../estimate-data";

export const sampleBrand: BrandProfile = {
  brandId: "sample-dealer",
  brandNameJa: "株式会社サンプルディテール",
  brandNameEn: "Sample Detail Co., Ltd.",
  brandTaglineEn: "TOTAL CAR PRODUCE",
  logoUrl: demoShopLogo(), // stands in for the dealer logo the tenant uploads in Dealer Settings
  colors: { primary: "#0a2145", primaryDark: "#061532", primaryTint: "rgba(10, 33, 69, 0.06)" },
  contact: {
    postalCode: "524-0101",
    address: "滋賀県守山市今浜町0-0-0",
    tel: "077-000-0000",
    fax: "077-000-0001",
    email: "info@sample.example",
    website: "https://sample.example",
  },
  business: {
    shopRank: "certified-detailer",
    shopRankLabel: "GYEON Certified Detailer",
    invoiceRegistrationNumber: "T0000000000000",
    responsiblePerson: "山田 太郎",
  },
  footer: { tagline: "I love my car", partnerBrand: "GYEON JAPAN", showPartnerLogo: true },
  sealImageUrl: undefined,
  // QR artwork is still the approved placeholder (generation deferred, README §10) — the concept-b
  // mock uses the same placeholder, so the footer matches it exactly.
  qrLinks: [
    { label: "Instagram", url: "https://instagram.com/sample", icon: "instagram", iconUrl: snsIcon("instagram"), qrImageUrl: qrPlaceholder() },
    { label: "LINE", url: "https://lin.ee/sample", icon: "line", iconUrl: snsIcon("line"), qrImageUrl: qrPlaceholder() },
    { label: "YouTube", url: "https://youtube.com/@sample", icon: "youtube", iconUrl: snsIcon("youtube"), qrImageUrl: qrPlaceholder() },
    { label: "TikTok", url: "https://tiktok.com/@sample", icon: "tiktok", iconUrl: snsIcon("tiktok"), qrImageUrl: qrPlaceholder() },
  ],
  rankLogoUrl: undefined, // concept-b draws the GYEON mark as a text lockup on these four documents
  rank: "certified-detailer",
};

const baseItems: EstimateItem[] = [
  { category: "Coating", name: "MOHS EVO", description: "ボディコーティング / Body Coating (base layer)", unitPrice: 90000, quantity: 1, amount: 90000 },
  { category: "Coating", name: "トップコート：MOHS EVO", description: "トップコート施工 / top coat application", unitPrice: 37500, quantity: 1, amount: 37500 },
  { category: "PPF", name: "PPF ヘッドライト", description: "Headlight Protection Film", unitPrice: 25000, quantity: 1, amount: 25000 },
  { category: "PPF", name: "PPF ドアカップ（1枚）", description: "Door Cup Protection Film", unitPrice: 8000, quantity: 2, amount: 16000 },
  { category: "Window", name: "リアサイド", description: "Rear Side Window Film", unitPrice: 20000, quantity: 1, amount: 20000 },
  { category: "Interior", name: "シート（重度汚れ）", description: "Seat Cleaning (heavy soil)", unitPrice: 24000, quantity: 1, discount: 4000, amount: 20000 },
  { category: "Care", name: "6ヶ月メンテナンス", description: "6-month coating maintenance", unitPrice: 15000, quantity: 1, amount: 15000 },
  { category: "Wash", name: "プレミアム洗車", description: "Premium hand wash & finish", unitPrice: 8000, quantity: 1, amount: 8000 },
  { category: "Decon", name: "鉄粉除去", description: "Iron particle decontamination", unitPrice: 6000, quantity: 1, amount: 6000 },
  { category: "Repair", name: "タッチペン補修（手入力）", description: "Touch-up paint — manual price", unitPrice: 5000, quantity: 1, amount: 5000 },
];

export const sampleEstimate: EstimateDocumentData = {
  serial: "EST/2026/00012",
  issueDate: "2026-07-11",
  validUntil: "2026-08-10",
  status: "Sent",
  preparedBy: "山田 太郎",
  customer: {
    name: "石井 紗也華",
    kind: "individual",
    postalCode: "460-0002",
    address: "名古屋市中区丸の内0-1-2-3",
    tel: "052-000-0000",
    email: "sample@example.com",
  },
  vehicle: {
    name: "Ferrari 458 Italia",
    maker: "フェラーリ",
    year: "2015 年",
    grade: "Base",
    plate: "名古屋 332 ひ 3830",
    color: "ロッソコルサ / Red",
    mileage: "28,400 km",
  },
  // A realistic single-page estimate: catalog lines, a discounted line, and a manual-priced line.
  items: [baseItems[0], baseItems[1], baseItems[2], baseItems[5], baseItems[8], baseItems[9]],
  summary: { subtotal: 187500, discount: 4000, taxRatePercent: 10, tax: 18350, grandTotal: 201850 },
  notes: [
    "表示価格はすべて税込です。",
    "作業内容・価格は予告なく変更する場合がございます。",
    "施工後のメンテナンスについては別途ご案内いたします。",
    "本見積書の有効期限は発行日から30日です。",
  ],
};

// Long variant (~36 lines) to force a natural page break for the multi-page test.
export const sampleEstimateLong: EstimateDocumentData = {
  ...sampleEstimate,
  serial: "EST/2026/00013",
  items: Array.from({ length: 36 }, (_, i) => {
    const b = baseItems[i % baseItems.length];
    return { ...b, name: `${b.name}（${i + 1}）` };
  }),
  summary: { subtotal: 900000, discount: 14400, taxRatePercent: 10, tax: 88560, grandTotal: 974160 },
};
