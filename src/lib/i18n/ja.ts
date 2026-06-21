// PHASE66-C: Japanese UI labels
// All visible UI strings centralised here for consistency.
// Import: import { JA } from "@/lib/i18n/ja";

export const JA = {
  // ── Sidebar navigation ────────────────────────────────────────────────────
  nav: {
    dashboard:          "ダッシュボード",
    customers:          "顧客管理",
    vehicles:           "車両管理",
    estimates:          "見積管理",
    calendar:           "カレンダー",
    reservations:       "予約管理",
    workOrders:         "施工指示",
    completionReports:  "完了報告",
    invoices:           "請求管理",
    payments:           "入金管理",
    pdf:                "PDF",
    products:           "商品管理",
    productOrders:      "商品注文",
    line:               "LINE",
    maintenance:        "メンテナンス",
    settings:           "設定",
  },

  // ── Admin navigation ──────────────────────────────────────────────────────
  admin: {
    overview:             "概要",
    dealers:              "ディーラー管理",
    users:                "ユーザー管理",
    subscriptions:        "契約プラン",
    audit:                "監査ログ",
    releaseReadiness:     "リリース確認",
    migrationStatus:      "マイグレーション状態",
    stagingVerification:  "ステージング検証",
    uat:                  "受入テスト",
    billing:              "請求管理",
    releaseCandidate:     "RC確認",
    officialRelease:      "正式リリース",
  },
} as const;
