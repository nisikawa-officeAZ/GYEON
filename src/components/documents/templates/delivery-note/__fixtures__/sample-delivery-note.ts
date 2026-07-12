// DEV-ONLY isolated fixture for Delivery Note PDF visual verification (PHASE 12D). Not a production path.

import { sampleBrand } from "../../estimate/__fixtures__/sample-estimate";
import type { DeliveryNoteDocumentData, DeliveryItem } from "../delivery-note-data";

export const deliveryBrand = sampleBrand;

const items: DeliveryItem[] = [
  { category: "Coating", name: "MOHS EVO", description: "ボディコーティング / Body Coating (base layer)", unitPrice: 90000, quantity: 1, amount: 90000 },
  { category: "Coating", name: "トップコート：MOHS EVO", description: "トップコート施工 / top coat application", unitPrice: 37500, quantity: 1, amount: 37500 },
  { category: "PPF", name: "PPF ヘッドライト", description: "Headlight Protection Film", unitPrice: 25000, quantity: 1, amount: 25000 },
  { category: "Interior", name: "シート（重度汚れ）", description: "Seat Cleaning (heavy soil)", unitPrice: 24000, quantity: 1, discount: 15000, amount: 9000 },
  { category: "Decon", name: "鉄粉除去", description: "Iron particle decontamination", unitPrice: 6000, quantity: 1, amount: 6000 },
  { category: "Repair", name: "タッチペン補修（手入力）", description: "Touch-up paint — manual price", unitPrice: 5000, quantity: 1, amount: 5000 },
];

export const sampleDeliveryNote: DeliveryNoteDocumentData = {
  serial: "DLV/2026/00004",
  issueDate: "2026-07-20",
  deliveryDate: "2026-07-20",
  refEstimate: "EST/2026/00004",
  status: "Completed",
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
  items: [items[0], items[1], items[3], items[4]],
  summary: { subtotal: 157500, discount: 15000, taxRatePercent: 10, tax: 14250, grandTotal: 156750 },
  aftercareNotes: [
    "施工後1ヶ月間は洗車機・高圧洗浄機のご使用をお控えください。",
    "日常のお手入れは中性シャンプーでの手洗いを推奨いたします。",
    "気になる点がございましたらお気軽にご連絡ください。",
  ],
};

// Long variant (~32 items) to force a multi-page delivery note.
export const sampleDeliveryNoteLong: DeliveryNoteDocumentData = {
  ...sampleDeliveryNote,
  serial: "DLV/2026/00005",
  items: Array.from({ length: 32 }, (_, i) => {
    const b = items[i % items.length];
    return { ...b, name: `${b.name}（${i + 1}）` };
  }),
  summary: { subtotal: 900000, discount: 15000, taxRatePercent: 10, tax: 88500, grandTotal: 973500 },
};
