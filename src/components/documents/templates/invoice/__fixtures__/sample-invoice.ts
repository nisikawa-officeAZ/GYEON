// DEV-ONLY isolated fixture for Invoice PDF visual verification (PHASE 12C). NOT a production path.

import type { BrandProfile } from "../../../types";
import { sampleBrand } from "../../estimate/__fixtures__/sample-estimate";
import type { InvoiceDocumentData, InvoiceItem } from "../invoice-data";

// Reuse the estimate sample dealer, adding bank-transfer details (invoice-only).
export const invoiceBrand: BrandProfile = {
  ...sampleBrand,
  bankAccount: {
    bankName: "サンプル銀行",
    branchName: "本店",
    accountType: "普通",
    accountNumber: "1234567",
    accountHolder: "カ)サンプルディテール",
  },
};

const items: InvoiceItem[] = [
  { category: "Coating", name: "MOHS EVO", description: "ボディコーティング / Body Coating (base layer)", unitPrice: 90000, quantity: 1, amount: 90000 },
  { category: "Coating", name: "トップコート：MOHS EVO", description: "トップコート施工 / top coat application", unitPrice: 37500, quantity: 1, amount: 37500 },
  { category: "PPF", name: "PPF ヘッドライト", description: "Headlight Protection Film", unitPrice: 25000, quantity: 1, amount: 25000 },
  { category: "Interior", name: "シート（重度汚れ）", description: "Seat Cleaning (heavy soil)", unitPrice: 24000, quantity: 1, discount: 15000, amount: 9000 },
  { category: "Decon", name: "鉄粉除去", description: "Iron particle decontamination", unitPrice: 6000, quantity: 1, amount: 6000 },
  { category: "Repair", name: "タッチペン補修（手入力）", description: "Touch-up paint — manual price", unitPrice: 5000, quantity: 1, amount: 5000 },
];

export const sampleInvoice: InvoiceDocumentData = {
  serial: "INV/2026/00087",
  issueDate: "2026-07-20",
  dueDate: "2026-07-31",
  status: "Unpaid ・ 未払い",
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
  // Realistic single-job invoice: catalog lines, a discounted line, a manual-priced line.
  items: [items[0], items[1], items[3], items[5]],
  summary: { subtotal: 156500, discount: 15000, taxRatePercent: 10, tax: 14150, grandTotal: 155650 },
  paymentNotes: [
    "お支払期限：2026年7月31日（金）までにお願いいたします。",
    "お支払方法：銀行振込 または 現金でお願いいたします。",
    "振込手数料はお客様ご負担でお願いいたします。",
  ],
};

// Long variant (~34 lines) to force a multi-page invoice.
export const sampleInvoiceLong: InvoiceDocumentData = {
  ...sampleInvoice,
  serial: "INV/2026/00088",
  items: Array.from({ length: 34 }, (_, i) => {
    const b = items[i % items.length];
    return { ...b, name: `${b.name}（${i + 1}）` };
  }),
  summary: { subtotal: 900000, discount: 15000, taxRatePercent: 10, tax: 88500, grandTotal: 973500 },
};
