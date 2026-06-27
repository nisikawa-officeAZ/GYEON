import MainLayout  from "@/components/layout/MainLayout";
import FeatureGate from "@/components/plans/FeatureGate";

export const metadata = { title: "完了報告 | GYEON Detailer Agent" };

export default function CompletionReportsPage() {
  return (
    <MainLayout>
      <FeatureGate feature="completion_reports">
        <div className="max-w-lg mx-auto px-4 py-10 flex flex-col gap-6">

          <div>
            <p className="text-[9px] font-bold tracking-[0.18em] text-blue-500/60 uppercase mb-0.5">
              GYEON® Detailer Agent
            </p>
            <h1 className="text-lg font-bold text-white">完了報告</h1>
          </div>

          <div
            className="rounded-2xl border p-8 flex flex-col items-center gap-4 text-center"
            style={{
              background:  "var(--gs-bg-card, #16161f)",
              borderColor: "var(--gs-line, rgba(255,255,255,0.08))",
            }}
          >
            <div
              className="w-14 h-14 rounded-full flex items-center justify-center"
              style={{ background: "rgba(79,142,247,0.10)" }}
            >
              <svg width="26" height="26" viewBox="0 0 24 24" fill="none"
                stroke="var(--gs-blue, #4f8ef7)" strokeWidth="1.8"
                strokeLinecap="round" strokeLinejoin="round">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                <polyline points="14 2 14 8 20 8"/>
                <line x1="16" y1="13" x2="8" y2="13"/>
                <line x1="16" y1="17" x2="8" y2="17"/>
                <polyline points="10 9 9 9 8 9"/>
              </svg>
            </div>

            <div className="flex flex-col gap-1">
              <p className="text-sm font-semibold text-[#f0f0f5]">PDF出力は準備中です</p>
              <p className="text-xs text-[#9999b0] leading-relaxed max-w-xs">
                完了報告のPDF出力機能は現在準備中です。<br />
                完了報告は施工指示の詳細画面から作成・確認できます。
              </p>
            </div>

            <a
              href="/work-orders"
              className="mt-2 inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors"
              style={{
                background:  "rgba(79,142,247,0.10)",
                color:       "var(--gs-blue, #4f8ef7)",
                border:      "1px solid rgba(79,142,247,0.20)",
              }}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
                stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="15 18 9 12 15 6"/>
              </svg>
              施工指示へ移動
            </a>
          </div>

        </div>
      </FeatureGate>
    </MainLayout>
  );
}
