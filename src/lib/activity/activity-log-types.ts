export type ActivityEntityType =
  | "customer" | "vehicle" | "estimate" | "work_order"
  | "completion_report" | "invoice" | "payment"
  | "product_order" | "reservation" | "line_message" | "document_file";

export type ActivityAction =
  | "created" | "updated" | "deleted" | "generated_pdf"
  | "archived_pdf" | "sent_line" | "scheduled"
  | "completed" | "paid" | "cancelled";

export interface ActivityLogDB {
  id:            string;
  dealer_id:     string;
  actor_user_id: string | null;
  entity_type:   ActivityEntityType;
  entity_id:     string;
  customer_id:   string | null;
  action:        ActivityAction;
  title:         string;
  description:   string | null;
  metadata:      Record<string, unknown>;
  created_at:    string;
}

export function activityEntityTypeLabel(type: ActivityEntityType): string {
  const map: Record<ActivityEntityType, string> = {
    customer:          "顧客",
    vehicle:           "車両",
    estimate:          "見積書",
    work_order:        "作業指示書",
    completion_report: "完了報告書",
    invoice:           "請求書",
    payment:           "入金",
    product_order:     "商品注文",
    reservation:       "予約",
    line_message:      "LINEメッセージ",
    document_file:     "PDFファイル",
  };
  return map[type];
}

export function activityActionLabel(action: ActivityAction): string {
  const map: Record<ActivityAction, string> = {
    created:       "作成",
    updated:       "更新",
    deleted:       "削除",
    generated_pdf: "PDF生成",
    archived_pdf:  "PDFアーカイブ",
    sent_line:     "LINE送信",
    scheduled:     "予定設定",
    completed:     "完了",
    paid:          "入金済み",
    cancelled:     "キャンセル",
  };
  return map[action];
}

export function activityActionColor(action: ActivityAction): string {
  switch (action) {
    case "created":       return "text-green-400";
    case "updated":       return "text-blue-400";
    case "deleted":       return "text-red-400";
    case "generated_pdf": return "text-purple-400";
    case "archived_pdf":  return "text-slate-400";
    case "sent_line":     return "text-green-400";
    case "scheduled":     return "text-amber-400";
    case "completed":     return "text-green-400";
    case "paid":          return "text-emerald-400";
    case "cancelled":     return "text-slate-500";
  }
}
