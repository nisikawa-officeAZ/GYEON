// Customer App — placeholder/demo data only. No DB, no branding schema.
// Used to render the customer-facing mobile app foundation.

export interface DemoVehicle {
  id:        string;
  maker:     string;
  model:     string;
  year:      number;
  plate:     string;
  color:     string;
  coating:   { product: string; appliedAt: string; status: string; warrantyUntil: string };
  next:      { label: string; dueDate: string };
  coatingHistory:     { date: string; item: string; staff: string }[];
  maintenanceHistory: { date: string; item: string; note: string }[];
}

export const demoCustomer = {
  name:        "山田 太郎",
  nameKana:    "ヤマダ タロウ",
  memberSince: "2024年3月",
  email:       "taro.yamada@example.com",
  phone:       "090-1234-5678",
  lineConnected: true,
};

export const demoVehicles: DemoVehicle[] = [
  {
    id: "v1", maker: "トヨタ", model: "ランドクルーザー", year: 2023,
    plate: "品川 300 あ 12-34", color: "ブラック",
    coating: { product: "GYEON Q² Mohs+", appliedAt: "2025年4月12日", status: "良好", warrantyUntil: "2028年4月" },
    next: { label: "メンテナンス洗車", dueDate: "2026年7月10日" },
    coatingHistory: [
      { date: "2025/04/12", item: "Q² Mohs+ 新規施工", staff: "佐藤" },
      { date: "2025/10/05", item: "トップコート再施工", staff: "鈴木" },
    ],
    maintenanceHistory: [
      { date: "2025/10/05", item: "メンテナンス洗車", note: "撥水良好" },
      { date: "2026/01/20", item: "鉄粉除去・点検", note: "問題なし" },
    ],
  },
  {
    id: "v2", maker: "BMW", model: "M3 Competition", year: 2024,
    plate: "横浜 330 さ 56-78", color: "サンマリノブルー",
    coating: { product: "GYEON Q² One", appliedAt: "2025年8月1日", status: "良好", warrantyUntil: "2027年8月" },
    next: { label: "12ヶ月点検", dueDate: "2026年8月1日" },
    coatingHistory: [{ date: "2025/08/01", item: "Q² One 新規施工", staff: "田中" }],
    maintenanceHistory: [{ date: "2026/02/14", item: "メンテナンス洗車", note: "良好" }],
  },
];

export const demoReservations = {
  upcoming: [
    { id: "r1", date: "2026/07/10", time: "10:00", menu: "メンテナンス洗車", vehicle: "ランドクルーザー", status: "確定" },
  ],
  history: [
    { id: "r2", date: "2026/02/14", time: "13:00", menu: "メンテナンス洗車", vehicle: "M3 Competition", status: "完了" },
    { id: "r3", date: "2025/10/05", time: "09:30", menu: "トップコート再施工", vehicle: "ランドクルーザー", status: "完了" },
  ],
};

export const demoPoints = {
  balance: 3200,
  expiringSoon: 500,
  expiringDate: "2026年12月31日",
  transactions: [
    { id: "p1", date: "2026/06/20", type: "earn",   points: 500, reason: "施工特典" },
    { id: "p2", date: "2026/05/02", type: "redeem", points: 200, reason: "メンテ割引" },
    { id: "p3", date: "2026/04/12", type: "earn",   points: 1200, reason: "新規施工" },
  ],
};

export type DemoDocType = "estimate" | "invoice" | "completion";
export const demoDocuments: { id: string; type: DemoDocType; number: string; date: string; total: number }[] = [
  { id: "d1", type: "completion", number: "CR-2026-0042", date: "2026/02/14", total: 0 },
  { id: "d2", type: "invoice",    number: "INV-2026-0098", date: "2026/02/14", total: 38500 },
  { id: "d3", type: "estimate",   number: "EST-2026-0210", date: "2026/06/01", total: 165000 },
];

export type DemoNotifCategory = "announcement" | "news" | "reminder";
export const demoNotifications: { id: string; category: DemoNotifCategory; title: string; body: string; date: string; unread: boolean }[] = [
  { id: "n1", category: "reminder",     title: "メンテナンス時期のお知らせ", body: "ランドクルーザーのメンテナンス洗車をおすすめします。", date: "2026/06/25", unread: true },
  { id: "n2", category: "news",         title: "新製品 GYEON Q² Mohs+ 入荷", body: "最上位コーティングが入荷しました。", date: "2026/06/20", unread: true },
  { id: "n3", category: "announcement", title: "夏季休業のお知らせ", body: "8/13〜8/16は休業いたします。", date: "2026/06/10", unread: false },
];

export const DOC_TYPE_LABEL: Record<DemoDocType, string> = {
  estimate: "見積書", invoice: "請求書", completion: "完了報告書",
};
export const NOTIF_CATEGORY_LABEL: Record<DemoNotifCategory, string> = {
  announcement: "お知らせ", news: "GYEON News", reminder: "リマインダー",
};
export const NOTIF_CATEGORY_ICON: Record<DemoNotifCategory, string> = {
  announcement: "📢", news: "✨", reminder: "🔔",
};

export function demoVehicle(id: string): DemoVehicle | undefined {
  return demoVehicles.find((v) => v.id === id);
}
