// DEV-ONLY isolated fixture for Completion Report PDF visual verification (PHASE 12E).
// NOT imported by the template or any production path — sample data lives ONLY here.

import { qrPlaceholder } from "@/lib/pdf/brand-assets";
import { sampleBrand } from "../../estimate/__fixtures__/sample-estimate";
import type {
  CompletionReportDocumentData,
  CompletedWorkItem,
  InspectionItem,
  CompletionPhoto,
} from "../completion-report-data";

export const completionBrand = sampleBrand;

const photos: CompletionPhoto[] = [
  { area: "Front / フロント", beforeDate: "2026.07.16", afterDate: "2026.07.20" },
  { area: "Side / サイド", beforeDate: "2026.07.16", afterDate: "2026.07.20" },
  { area: "Rear / リア", beforeDate: "2026.07.16", afterDate: "2026.07.20" },
  { area: "Interior / 内装", beforeDate: "2026.07.16", afterDate: "2026.07.20" },
];

const works: CompletedWorkItem[] = [
  { category: "Coating", name: "MOHS EVO", description: "ボディコーティング / Body Coating (base layer)" },
  { category: "Coating", name: "トップコート：MOHS EVO", description: "トップコート施工 / top coat application" },
  { category: "PPF", name: "PPF ヘッドライト", description: "Headlight Protection Film" },
  { category: "Interior", name: "シート（重度汚れ）", description: "Seat Cleaning (heavy soil)" },
  { category: "Decon", name: "鉄粉除去", description: "Iron particle decontamination" },
  { category: "Wash", name: "プレミアム洗車", description: "Premium hand wash & finish" },
];

const inspection: InspectionItem[] = [
  { label: "ボディ全体キズ確認", result: "OK" },
  { label: "フロントバンパー", result: "OK" },
  { label: "ボンネット", result: "OK" },
  { label: "ルーフ", result: "OK" },
  { label: "左フロントフェンダー", result: "OK" },
  { label: "右フロントフェンダー", result: "obs." },
  { label: "左ドア", result: "OK" },
  { label: "右ドア", result: "OK" },
  { label: "リアバンパー", result: "OK" },
  { label: "トランク", result: "OK" },
  { label: "ホイール（4本）", result: "OK" },
  { label: "ヘッドライト", result: "OK" },
  { label: "テールランプ", result: "OK" },
  { label: "内装シート", result: "OK" },
  { label: "ダッシュボード", result: "OK" },
];

export const sampleCompletionReport: CompletionReportDocumentData = {
  serial: "RPT/2026/00004",
  issueDate: "2026-07-20",
  completedDate: "2026-07-20",
  duration: "32 h (4 日)",
  refEstimate: "EST/2026/00004",
  status: "Completed",
  chiefTechnician: "山田 太郎",
  reportQrUrl: qrPlaceholder(),
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
  photos,
  completedWorks: works,
  inspectionItems: inspection,
  inspectionSummary: "15 items · 14 OK · 1 obs.",
  technicianNote:
    "右フロントフェンダーに軽微な既存のスクラッチを確認しましたが、コーティング施工には影響ございません。全体的に良好な状態で施工を完了しております。次回メンテナンスは6ヶ月後を推奨いたします。",
  customerNotes: [
    "施工後1ヶ月間は洗車機・高圧洗浄機のご使用をお控えください。",
    "日常のお手入れは中性シャンプーでの手洗いを推奨いたします。",
    "気になる点がございましたらお気軽にご連絡ください。",
  ],
};

// Long variant (~30 works + full inspection) to force a multi-page report.
export const sampleCompletionReportLong: CompletionReportDocumentData = {
  ...sampleCompletionReport,
  serial: "RPT/2026/00005",
  completedWorks: Array.from({ length: 30 }, (_, i) => {
    const b = works[i % works.length];
    return { ...b, name: `${b.name}（${i + 1}）` };
  }),
};
