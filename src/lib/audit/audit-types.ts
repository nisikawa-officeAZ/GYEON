export type AuditAction =
  | "create" | "update" | "delete" | "archive" | "restore"
  | "export" | "login" | "logout" | "change_role"
  | "generate_pdf" | "download_pdf" | "send_line"
  | "create_staff" | "delete_staff"
  // PHASE58
  | "feature_access_denied";

export type AuditResourceType =
  | "customer" | "vehicle" | "estimate" | "work_order"
  | "completion_report" | "invoice" | "payment"
  | "product_order" | "reservation" | "staff" | "role"
  | "dealer_setting" | "document" | "super_admin";

export interface AuditLogDB {
  id:            string;
  dealer_id:     string;
  actor_user_id: string | null;
  actor_email:   string | null;
  actor_role:    string | null;
  action:        AuditAction;
  resource_type: AuditResourceType;
  resource_id:   string | null;
  old_value:     Record<string, unknown> | null;
  new_value:     Record<string, unknown> | null;
  ip_address:    string | null;
  user_agent:    string | null;
  created_at:    string;
}

export interface AuditLogFilter {
  action?:        AuditAction;
  resource_type?: AuditResourceType;
  actor_user_id?: string;
  from?:          string; // ISO date
  to?:            string; // ISO date
  page?:          number;
  per_page?:      number;
}

export function auditActionLabel(action: AuditAction): string {
  const map: Record<AuditAction, string> = {
    create:       "作成",
    update:       "更新",
    delete:       "削除",
    archive:      "アーカイブ",
    restore:      "復元",
    export:       "エクスポート",
    login:        "ログイン",
    logout:       "ログアウト",
    change_role:  "役割変更",
    generate_pdf: "PDF生成",
    download_pdf: "PDFダウンロード",
    send_line:    "LINE送信",
    create_staff:          "スタッフ招待",
    delete_staff:          "スタッフ削除",
    feature_access_denied: "機能アクセス拒否",
  };
  return map[action];
}

export function auditResourceTypeLabel(type: AuditResourceType): string {
  const map: Record<AuditResourceType, string> = {
    customer:          "顧客",
    vehicle:           "車両",
    estimate:          "見積書",
    work_order:        "作業指示書",
    completion_report: "完了報告書",
    invoice:           "請求書",
    payment:           "入金",
    product_order:     "商品注文",
    reservation:       "予約",
    staff:             "スタッフ",
    role:              "役割",
    dealer_setting:    "ディーラー設定",
    document:          "ドキュメント",
    super_admin:       "スーパーアドミン",
  };
  return map[type];
}

export function auditActionBadgeColor(action: AuditAction): string {
  switch (action) {
    case "create":
    case "create_staff":  return "bg-green-500/10 text-green-400 border-green-500/30";
    case "update":
    case "change_role":   return "bg-blue-500/10 text-blue-400 border-blue-500/30";
    case "delete":
    case "delete_staff":  return "bg-red-500/10 text-red-400 border-red-500/30";
    case "generate_pdf":
    case "download_pdf":  return "bg-purple-500/10 text-purple-400 border-purple-500/30";
    case "send_line":     return "bg-green-500/10 text-green-400 border-green-500/30";
    case "export":               return "bg-amber-500/10 text-amber-400 border-amber-500/30";
    case "feature_access_denied": return "bg-red-500/10 text-red-400 border-red-500/30";
    default:                     return "bg-slate-500/10 text-slate-400 border-slate-500/30";
  }
}
