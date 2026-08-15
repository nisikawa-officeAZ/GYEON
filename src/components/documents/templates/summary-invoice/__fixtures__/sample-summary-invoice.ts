// DEV-ONLY isolated fixture for Summary Invoice PDF visual verification (PHASE 12F).
// NOT imported by the template or any production path. Numbers mirror concept-b v3.0.1 exactly.
// The brand is the neutral sample dealer (NOT Office AZ) + a sample bank account, to prove that all
// issuer/bank values are injected from BrandProfile and nothing is hardcoded.

import { sampleBrand } from "../../estimate/__fixtures__/sample-estimate";
import type { BrandProfile } from "../../../types";
import { gyeonRankLogo, gyeonWordmark } from "@/lib/pdf/brand-assets";
import type { SummaryInvoiceDocumentData, SummaryInvoiceLine } from "../summary-invoice-data";

export const summaryBrand: BrandProfile = {
  ...sampleBrand,
  // The Summary Invoice masthead carries the GYEON wordmark and its footer the rank mark, unlike the
  // other four documents, which use text lockups (concept-b `.m-head__wordmark` / `.footer__rank`).
  gyeonWordmarkUrl: gyeonWordmark(),
  rankLogoUrl: gyeonRankLogo("certified-detailer"),
  bankAccount: {
    bankName: "滋賀銀行",
    branchName: "守山支店",
    accountType: "普通",
    accountNumber: "1234567",
    accountHolder: "カ）サンプルディテール",
  },
};

const customer: SummaryInvoiceDocumentData["customer"] = {
  name: "株式会社 藤田自動車工業",
  kind: "corporation",
  tradeName: "藤田モータース守山店",
  contactPerson: "藤田 康介 様（部品仕入部）",
  postalCode: "525-0072",
  address: "滋賀県草津市草津町5-6-7",
  tel: "077-566-1234",
  customerCode: "C-BIZ-00087",
  closingDate: "毎月末日",
  paymentTerms: "翌月末日振込 / Net 30",
  dealClass: "掛売 · 業者",
};

const page1: SummaryInvoiceLine[] = [
  { date: "2026-07-03", invoiceNo: "INV/2026/00203", estimateNo: "EST/2026/00198", vehicle: "Alphard 30 系", customer: "田中様", workSummary: "MOHS EVO Base + Top", gross: 162800, paid: 162800, remaining: 0, status: "paid", included: false },
  { date: "2026-07-08", invoiceNo: "INV/2026/00207", estimateNo: "EST/2026/00202", vehicle: "Prius 60 系", customer: "山田様", workSummary: "CanCoat EVO 全塗装面", gross: 68200, paid: 0, remaining: 68200, status: "unpaid", included: true },
  { date: "2026-07-12", invoiceNo: "INV/2026/00211", estimateNo: "EST/2026/00206", vehicle: "Land Cruiser 300", customer: "佐藤様", workSummary: "PPF PROTECT+ ボンネット + ヘッドライト", gross: 173800, paid: 0, remaining: 173800, status: "unpaid", included: true },
  { date: "2026-07-17", invoiceNo: "INV/2026/00215", estimateNo: "EST/2026/00210", vehicle: "Vellfire 30 系", customer: "鈴木様", workSummary: "窓ガラス撥水 + プレミアム洗車", gross: 46200, paid: 20000, remaining: 26200, status: "partial", included: true },
  { date: "2026-07-21", invoiceNo: "INV/2026/00219", estimateNo: "EST/2026/00214", vehicle: "Harrier 80 系", customer: "高橋様", workSummary: "MOHS EVO Base + Top + PPF ヘッドライト", gross: 107800, paid: 0, remaining: 107800, status: "unpaid", included: true },
];

const page2: SummaryInvoiceLine[] = [
  { date: "2026-07-24", invoiceNo: "INV/2026/00222", estimateNo: "EST/2026/00217", vehicle: "C-HR", customer: "伊藤様", workSummary: "CanCoat EVO PRO 全塗装面", reason: "取消 · 施工前キャンセル", gross: 85800, paid: 0, remaining: 0, status: "void", included: false },
  { date: "2026-07-27", invoiceNo: "INV/2026/00225", estimateNo: "EST/2026/00220", vehicle: "Corolla Cross", customer: "中村様", workSummary: "MOHS EVO Base + 鉄粉除去", gross: 101200, paid: 0, remaining: 101200, status: "unpaid", included: true },
  { date: "2026-07-29", invoiceNo: "INV/2026/00228", estimateNo: "EST/2026/00223", vehicle: "Yaris Cross", customer: "小林様", workSummary: "プレミアム洗車 + タッチペン補修", reason: "次月請求へ繰入", gross: 14300, paid: 0, remaining: 14300, status: "excluded", included: false },
  { date: "2026-07-31", invoiceNo: "INV/2026/00231", estimateNo: "EST/2026/00226", vehicle: "RAV4", customer: "加藤様", workSummary: "CanCoat EVO + 窓ガラス撥水", gross: 51700, paid: 0, remaining: 51700, status: "unpaid", included: true },
];

// Full 2-page statement (9 invoices) — mirrors concept-b exactly.
export const sampleSummaryInvoice: SummaryInvoiceDocumentData = {
  serial: "SIN/2026/00001",
  issueDate: "2026-08-01",
  billingPeriodStart: "2026-07-01",
  billingPeriodEnd: "2026-07-31",
  closingLabel: "毎月末日締め",
  paymentDueDate: "2026-08-31",
  paymentMethod: "銀行振込",
  customer,
  responsibleSalesPerson: "西川 篤史",
  pages: [
    { invoices: page1, subtotal: { gross: 558800, paid: 182800, remaining: 376000 } },
    { invoices: page2, subtotal: { gross: 253000, paid: 0, remaining: 167200 } },
  ],
  grandTotal: { gross: 811800, paid: 182800, remaining: 543200 },
  totalCount: 9,
  reconciliation: [
    { key: "A", labelEn: "Displayed Gross Total", labelJa: "表示総額 (9 件)", amount: 811800 },
    { key: "B", op: "−", labelEn: "Fully Paid", labelJa: "期間内入金済み (#1)", amount: -162800, tone: "danger" },
    { key: "C", op: "−", labelEn: "Partial Payments Received", labelJa: "一部入金済 (#4 内金)", amount: -20000, tone: "danger" },
    { key: "D", op: "−", labelEn: "Excluded", labelJa: "次月繰入 (#8)", amount: -14300, tone: "danger" },
    { key: "E", op: "−", labelEn: "Void", labelJa: "取消 (#6)", amount: -85800, tone: "danger" },
    { key: "F", op: "+", labelEn: "Adjustment", labelJa: "業者様調整値引", amount: -5000, tone: "danger" },
    { key: "G", op: "+", labelEn: "Carried Forward", labelJa: "前月繰越 (前月完済)", amount: 0 },
  ],
  currentAmountDue: 523900,
  currentAmountDueNote: "Billing Target Total · 支払期限 2026.08.31",
  traceability: [
    "B (Paid): 行 #1 INV/2026/00203 ¥162,800（期間内に全額入金済み → 今回請求対象外）",
    "C (Partial): 行 #4 INV/2026/00215 のうち内金 ¥20,000 が既収（残額 ¥26,200 を今回請求に含む）",
    "D (Excluded): 行 #8 INV/2026/00228 ¥14,300（次月請求へ繰入）",
    "E (Void): 行 #6 INV/2026/00222 ¥85,800（施工前キャンセル · 取消済 → 対象外）",
    "F (Adjustment): 業者様への月次調整値引 ¥5,000（別途合意 · 明示調整）",
    "参考: 前回請求額 ¥428,900 は期間内に全額入金済のため繰越 0",
  ],
  paymentNotice: [
    "支払期限: 2026 年 8 月 31 日",
    "振込手数料はお客様ご負担にてお願いいたします。分割入金・繰越が発生する場合は、事前にご連絡ください。",
    "本合計請求書に含まれる個別請求書番号は上記一覧「今回請求対象 = Yes」をご参照ください。",
  ],
};

// Long variant (three page-groups, 11 invoices) — verifies 3-page pagination: per-page subtotals,
// repeated "Page k of 3" continuation headers, grand total + reconciliation ONLY on the last page.
// The final group is intentionally short so the closing block settles cleanly on the last page.
const page3: SummaryInvoiceLine[] = [page1[0], page1[1]].map((l, i) => ({
  ...l,
  invoiceNo: `INV/2026/0030${i}`,
  estimateNo: `EST/2026/0028${i}`,
  date: `2026-07-${String(11 + i).padStart(2, "0")}`,
}));

export const sampleSummaryInvoiceLong: SummaryInvoiceDocumentData = {
  ...sampleSummaryInvoice,
  serial: "SIN/2026/00003",
  pages: [
    { invoices: page1, subtotal: { gross: 558800, paid: 182800, remaining: 376000 } },
    { invoices: page2, subtotal: { gross: 253000, paid: 0, remaining: 167200 } },
    { invoices: page3, subtotal: { gross: 231000, paid: 162800, remaining: 68200 } },
  ],
  grandTotal: { gross: 1042800, paid: 345600, remaining: 611400 },
  totalCount: 11,
  reconciliation: [
    { key: "A", labelEn: "Displayed Gross Total", labelJa: "表示総額 (11 件)", amount: 1042800 },
    { key: "B", op: "−", labelEn: "Fully Paid", labelJa: "期間内入金済み", amount: -162800, tone: "danger" },
    { key: "C", op: "−", labelEn: "Partial Payments Received", labelJa: "一部入金済", amount: -20000, tone: "danger" },
    { key: "D", op: "−", labelEn: "Excluded", labelJa: "次月繰入", amount: -14300, tone: "danger" },
    { key: "E", op: "−", labelEn: "Void", labelJa: "取消", amount: -85800, tone: "danger" },
    { key: "F", op: "+", labelEn: "Adjustment", labelJa: "業者様調整値引", amount: -5000, tone: "danger" },
    { key: "G", op: "+", labelEn: "Carried Forward", labelJa: "前月繰越", amount: 0 },
  ],
  currentAmountDue: 754900,
};
