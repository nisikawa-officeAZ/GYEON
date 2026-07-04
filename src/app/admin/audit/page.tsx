import AuditLogViewer from "@/components/admin/AuditLogViewer";

export const dynamic = "force-dynamic";
export const metadata = { title: "監査ログ | 管理" };

export default function AdminAuditPage() {
  return <AuditLogViewer />;
}
