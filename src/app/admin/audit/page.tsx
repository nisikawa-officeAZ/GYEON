import AuditLogViewer from "@/components/admin/AuditLogViewer";

export const dynamic = "force-dynamic";
export const metadata = { title: "Audit Log | Admin" };

export default function AdminAuditPage() {
  return <AuditLogViewer />;
}
