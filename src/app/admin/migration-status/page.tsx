// PHASE61: Admin migration status page.
// Read-only — displays schema-inferred migration status.
// IMPORTANT: This page must NOT contain any button that applies migrations.
// Logs a single admin_audit_log entry when a super admin views this page.

import { getMigrationReadinessStatus } from "@/lib/migrations/migration-status";
import { getCurrentAdmin }             from "@/lib/admin/get-current-admin";
import { writeAuditLog }               from "@/lib/admin/write-audit-log";
import MigrationStatusPanel            from "@/components/admin/MigrationStatusPanel";

export const dynamic  = "force-dynamic";
export const metadata = { title: "Migration Status | Admin" };

export default async function AdminMigrationStatusPage() {
  const [report, admin] = await Promise.all([
    getMigrationReadinessStatus(),
    getCurrentAdmin(),
  ]);

  // Fire-and-forget: log this page view once per visit
  if (admin) {
    void writeAuditLog({
      adminUserId: admin.id,
      action:      "migration_status_viewed",
      details:     {
        overall:        report.overall,
        checkedAt:      report.checkedAt,
        missingCount:   report.migrations.filter(m => m.status === "missing").length,
      },
    });
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold text-slate-100">Migration Status</h1>
          <p className="text-xs text-slate-500 mt-0.5">
            スキーマの状態から各マイグレーションの適用状況を推定します（読み取り専用）
          </p>
        </div>
      </div>

      <MigrationStatusPanel report={report} />
    </div>
  );
}
