import MainLayout  from "@/components/layout/MainLayout";
import FeatureGate from "@/components/plans/FeatureGate";
import { createClient }     from "@/lib/supabase/server";
import { getCurrentDealer } from "@/lib/auth/get-current-dealer";
import { getWorkReportSource } from "@/lib/completion-reports/get-completion-report";
import {
  completionReportDisplayNo,
  completionReportStatusLabel,
  type WorkReportNotReadyReason,
} from "@/lib/completion-reports/completion-report-types";

// GDA-1W (accepted contract §8): this page no longer shows the contradictory
// 「PDF出力は準備中です」 message — the authenticated work-report route exists.
// Each canonical report is judged by the SHARED fail-closed eligibility source
// (getWorkReportSource): PDF links render ONLY when it says ready, and
// otherwise the EXACT reasons are displayed. There is no estimate fallback
// anywhere on this page — performed work is the confirmed snapshot or nothing.

export const metadata = { title: "完了報告 | GYEON Detailer Agent" };
export const dynamic = "force-dynamic";

// The exact shared §8 reasons, in operator language (mirrors the section UI).
const REASON_LABELS: Record<WorkReportNotReadyReason, string> = {
  "unauthenticated":          "ログイン状態を確認してください。",
  "tenant-mismatch":          "報告書・作業指示・顧客・車両の紐付けに不整合があります。",
  "not-canonical":            "この報告書は作業指示の正規の報告書ではありません。",
  "work-order-not-completed": "作業指示が完了していません。「作業完了」操作で完了してください。",
  "missing-report-number":    "報告書番号が未採番です。",
  "missing-report-date":      "報告日が未設定です。",
  "snapshot-unconfirmed":     "実施した作業内容が未確定です。「作業完了」操作で確定してください。",
  "snapshot-empty":           "確定済みの作業内容がありません。",
  "archived":                 "アーカイブ済みの報告書は出力できません。",
};

const STATUS_BADGE: Record<string, string> = {
  draft:     "bg-slate-600 text-slate-100",
  generated: "bg-blue-600 text-white",
  shared:    "bg-green-600 text-white",
  archived:  "bg-slate-700 text-slate-400",
};

interface ReportListRow {
  id:            string;
  title:         string | null;
  report_number: string | null;
  status:        string;
  report_date:   string | null;
}

const WorkOrdersLink = () => (
  <a
    href="/work-orders"
    className="mt-2 inline-flex items-center gap-2 self-center rounded-xl border border-[#2f5db8]/50 bg-[#173463]/20 px-4 py-2 text-sm font-medium text-[#5f9cff] transition-colors hover:bg-[#173463]/40"
  >
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="15 18 9 12 15 6"/>
    </svg>
    施工指示へ移動
  </a>
);

const PageHeader = () => (
  <div>
    <p className="text-[9px] font-bold tracking-[0.18em] text-[#5f9cff]/70 uppercase mb-0.5">
      GYEON® Detailer Agent
    </p>
    <h1 className="text-[20px] font-bold text-[#edf3fc] md:text-[22px]">完了報告</h1>
    <p className="mt-1 text-[10px] font-semibold tracking-[0.22em] text-[#7788a4]">COMPLETION REPORTS</p>
  </div>
);

export default async function CompletionReportsPage() {
  // ── Authenticated same-tenant gate, fail-closed. ──
  const dealer = await getCurrentDealer();

  if (!dealer) {
    return (
      <MainLayout>
        <FeatureGate feature="completion_reports">
          <div className="max-w-lg mx-auto px-4 py-10 flex flex-col gap-6">
            <PageHeader />
            <div className="flex flex-col items-center gap-3 rounded-2xl border border-[#263955] bg-[#111826]/90 p-8 text-center backdrop-blur-xl">
              <p className="text-sm font-semibold text-[#edf3fc]">ログインが必要です</p>
              <p className="text-xs text-[#8191ad] leading-relaxed max-w-xs">
                完了報告を表示するには、有効な店舗メンバーとしてログインしてください。
              </p>
            </div>
          </div>
        </FeatureGate>
      </MainLayout>
    );
  }

  // ── Canonical reports for THIS dealer (one per work order; RLS-backed). ──
  const supabase = await createClient();
  const { data } = await supabase
    .from("completion_reports")
    .select("id, title, report_number, status, report_date")
    .eq("dealer_id", dealer.dealer_id)
    .order("created_at", { ascending: false })
    .limit(20);
  const reports: ReportListRow[] = (data as ReportListRow[]) ?? [];

  // ── One shared fail-closed judgment per report; the PDF route re-judges. ──
  const judged = await Promise.all(
    reports.map(async (report) => ({
      report,
      source: await getWorkReportSource(report.id),
    })),
  );

  return (
    <MainLayout>
      <FeatureGate feature="completion_reports">
        <div className="max-w-lg mx-auto px-4 py-10 flex flex-col gap-6">
          <PageHeader />

          {judged.length === 0 ? (
            <div className="flex flex-col items-center gap-4 rounded-2xl border border-[#263955] bg-[#111826]/90 p-8 text-center backdrop-blur-xl">
              <p className="text-sm font-semibold text-[#edf3fc]">完了報告書がまだありません</p>
              <p className="text-xs text-[#8191ad] leading-relaxed max-w-xs">
                完了報告書は施工指示の「作業完了」操作で自動的に作成されます。<br />
                実際の終了日時と実施した作業を確認して完了してください。
              </p>
              <WorkOrdersLink />
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              {judged.map(({ report, source }) => (
                <div
                  key={report.id}
                  className="flex flex-col gap-2 rounded-2xl border border-[#263955] bg-[#0d1420] p-4"
                >
                  <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-medium text-[#edf3fc] truncate">
                          {report.title ?? "施工完了報告書"}
                        </p>
                        <span
                          className={`text-[10px] font-medium px-1.5 py-0.5 rounded shrink-0 ${
                            STATUS_BADGE[report.status] ?? "bg-slate-700 text-slate-300"
                          }`}
                        >
                          {completionReportStatusLabel(report.status)}
                        </span>
                      </div>
                      <p className="text-[10px] text-[#7788a4] mt-0.5">
                        {completionReportDisplayNo(report)}
                        {report.report_date && ` · ${report.report_date}`}
                      </p>
                    </div>

                    {/* PDF links ONLY when the shared eligibility says ready. */}
                    {source.ready && (
                      <div className="flex gap-1.5 shrink-0">
                        <a
                          href={`/pdf/work-report?reportId=${encodeURIComponent(report.id)}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-xs rounded-lg border border-[#2f5db8] bg-[#1c4fd6] text-white px-3 py-1.5 transition-colors hover:bg-[#1a45bd]"
                        >
                          作業内容書を表示
                        </a>
                        <a
                          href={`/pdf/work-report?reportId=${encodeURIComponent(report.id)}&download=1`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-xs rounded-lg border border-[#263955] text-[#c3cee2] px-3 py-1.5 transition-colors hover:bg-[#1a2740] hover:text-[#edf3fc]"
                        >
                          ダウンロード
                        </a>
                      </div>
                    )}
                  </div>

                  {/* Exact shared reasons — never a vague "preparing" message. */}
                  {!source.ready && (
                    <div className="bg-amber-900/20 border border-amber-800 rounded-lg px-3 py-2">
                      <p className="text-[11px] font-medium text-amber-300 mb-1">
                        作業内容書はまだ出力できません:
                      </p>
                      <ul className="list-disc list-inside flex flex-col gap-0.5">
                        {source.reasons.map((reason) => (
                          <li key={reason} className="text-[11px] text-amber-300/90">
                            {REASON_LABELS[reason]}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              ))}
              <WorkOrdersLink />
            </div>
          )}
        </div>
      </FeatureGate>
    </MainLayout>
  );
}
