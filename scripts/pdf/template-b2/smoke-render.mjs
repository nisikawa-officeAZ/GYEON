/* TEMPLATE-B2 offline smoke render — drives the REAL production renderer
 * (renderEstimateDocumentPdf) with fixture data for 1 / 8 / 15 / 25 items plus a fallback-logo
 * variant, writing PDFs to a directory OUTSIDE the repository.
 *
 * Run inside the production-like linux/x86_64 container (see README.md):
 *   node --import tsx scripts/pdf/template-b2/smoke-render.mjs <output-dir>
 *
 * This script never touches the database, Storage, or the network; the renderer itself aborts and
 * fails on any outbound request attempt.
 */
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";

async function main() {
const outDir = process.argv[2];
if (!outDir) {
  console.error("usage: node --import tsx scripts/pdf/template-b2/smoke-render.mjs <output-dir>");
  process.exit(2);
}
mkdirSync(outDir, { recursive: true });

const { renderEstimateDocumentPdf } = await import("../../../src/lib/pdf/render-estimate-document.tsx");

/* 1×1 navy PNG as the configured dealer logo (embedded bytes, like getDealerBranding emits). */
const CONFIGURED_LOGO =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkqPlfDwAChwGA60e6kgAAAABJRU5ErkJggg==";

const CATEGORIES = ["coating", "coating", "ppf", "ppf", "window", "interior", "maintenance", "carwash"];
const NAMES = [
  "MOHS EVO", "トップコート：MOHS EVO", "PPF ヘッドライト", "PPF ドアミラー",
  "リアサイド", "シート（重度汚れ）", "6ヶ月メンテナンス", "プレミアム洗車",
];

function makeItems(count) {
  const items = [];
  for (let i = 0; i < count; i += 1) {
    const unit = 10000 + (i % 8) * 2500;
    const qty = (i % 3) === 2 ? 2 : 1;
    const discounted = i % 5 === 4;
    const gross = unit * qty;
    items.push({
      id: `item-${i}`,
      category: CATEGORIES[i % CATEGORIES.length],
      item_name: `${NAMES[i % NAMES.length]} #${i + 1}`,
      description: i % 2 === 0 ? `施工内容の説明 ${i + 1} / Service description ${i + 1}` : null,
      unit_price: unit,
      quantity: qty,
      discount_rate: discounted ? 10 : 0,
      line_total: discounted ? Math.round(gross * 0.9) : gross,
      sort_order: i,
    });
  }
  return items;
}

function makeEstimate(count) {
  const items = makeItems(count);
  const subtotal = items.reduce((s, it) => s + it.line_total, 0);
  const discount = 0;
  const tax = Math.floor(subtotal * 0.1);
  return {
    id: `00000000-0000-4000-8000-0000000000${String(count).padStart(2, "0")}`,
    estimate_number: `EST-2026-000${String(count).padStart(2, "0")}`,
    estimate_no: null,
    status: "approved",
    created_at: "2026-08-03T01:00:00.000Z",
    valid_until: "2026-09-02",
    subtotal,
    discount_amount: discount,
    tax_rate: 10,
    tax_amount: tax,
    total: subtotal + tax,
    notes: "表示価格はすべて税込です。\n本見積書の有効期限は発行日から30日です。",
    customers: {
      last_name: "石井", first_name: "紗也華", is_business: false,
      postal_code: "460-0002", address1: "名古屋市中区丸の内1-2-3",
      phone: "052-000-0000", email: "customer@example.jp",
    },
    vehicles: {
      maker: "フェラーリ", model: "458 Italia", year: "2015", grade: "Base",
      plate_number: "名古屋 332 ひ 3830", color: "ロッソコルサ / Red", mileage: 28400,
    },
    estimate_items: items,
  };
}

const brand = {
  brandId: "smoke-fixture",
  brandNameJa: "株式会社テストディテイラー",
  colors: { primary: "#12224c" },
  contact: { postalCode: "123-4567", address: "東京都テスト区テスト1-2-3 テストビル4F", tel: "03-1234-5678" },
  business: { shopRankLabel: "GYEON Certified Detailer", invoiceRegistrationNumber: "T1234567890123" },
  footer: {},
  qrLinks: [],
  logoUrl: CONFIGURED_LOGO,
};

const jobs = [
  ...[1, 8, 15, 25].map((n) => ({ name: `estimate_${n}items`, estimate: makeEstimate(n), brand })),
  { name: "estimate_8items_fallback", estimate: makeEstimate(8), brand: { ...brand, logoUrl: undefined } },
];

for (const job of jobs) {
  const pdf = await renderEstimateDocumentPdf(job.estimate, job.brand);
  writeFileSync(path.join(outDir, `${job.name}.pdf`), pdf);
  console.log("rendered", job.name, pdf.length, "bytes");
}
console.log("SMOKE_DONE", jobs.length);
}

main().catch((err) => { console.error(err); process.exit(1); });
