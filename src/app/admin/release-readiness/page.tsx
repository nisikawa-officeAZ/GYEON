// PHASE60: Admin release readiness page.
// Runs all readiness checks and displays results via ReleaseReadinessPanel.
// Read-only — does not modify any data.

import { getReleaseReadinessStatus } from "@/lib/release/readiness";
import ReleaseReadinessPanel         from "@/components/admin/ReleaseReadinessPanel";

export const dynamic  = "force-dynamic";
export const metadata = { title: "Release Readiness | Admin" };

export default async function AdminReleaseReadinessPage() {
  const report = await getReleaseReadinessStatus();

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold text-slate-100">Release Readiness</h1>
          <p className="text-xs text-slate-500 mt-0.5">
            本番デプロイ前の自動チェック — 全項目パスしてから PRODUCTION_READINESS_CHECKLIST.md の手動確認を実施してください
          </p>
        </div>
      </div>

      <ReleaseReadinessPanel report={report} />
    </div>
  );
}
