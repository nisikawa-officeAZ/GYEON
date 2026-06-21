// PHASE65: Admin RC status dashboard page.
// Displays RC1 version, release score, and 10-category checklist.
// Read-only. Does NOT deploy or modify anything.

import { getCurrentAdmin }        from "@/lib/admin/get-current-admin";
import { redirect }               from "next/navigation";
import { getRcStatus }            from "@/lib/release/rc-status";
import { writeAuditLog }          from "@/lib/admin/write-audit-log";
import ReleaseCandidatePanel      from "@/components/admin/ReleaseCandidatePanel";

export const dynamic = "force-dynamic";
export const metadata = { title: "RC1 Status | GYEON Admin" };

export default async function AdminReleaseCandidatePage() {
  const admin = await getCurrentAdmin();
  if (!admin) redirect("/login");

  const [report] = await Promise.all([
    getRcStatus(),
    writeAuditLog({
      adminUserId: admin.id,
      action:      "release_candidate_viewed",
      details:     { version: "1.0.0-RC1" },
    }).catch(() => {}),
  ]);

  return (
    <div className="flex flex-col gap-6">
      {/* Page header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-lg font-semibold text-slate-100">Release Candidate</h1>
          <p className="text-xs text-slate-500 mt-0.5">
            RC1 ステータス — 本番デプロイは行いません。リリース前最終確認専用ページです。
          </p>
        </div>
        <div className="text-[10px] px-2 py-1 rounded border border-slate-700 text-slate-500">
          Read-only
        </div>
      </div>

      {/* Safety notice */}
      <div className="flex items-start gap-3 px-4 py-3 rounded-xl border border-blue-700/40 bg-blue-950/20">
        <span className="text-blue-400 shrink-0">ℹ</span>
        <p className="text-xs text-blue-300">
          このページはリリース候補 (RC1) のステータスを表示します。本番デプロイ・マイグレーション実行・データ変更は行いません。
          本番デプロイ前に RELEASE_CHECKLIST.md の全項目をチェックし、署名を取得してください。
        </p>
      </div>

      {/* RC Panel */}
      <ReleaseCandidatePanel report={report} />
    </div>
  );
}
