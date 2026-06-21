// A4-style printable completion report preview.
// Accepts CompletionReportFullData — no mock values.
// Print-friendly: white background, black text, print CSS included.
// PDF file generation is deferred to a future PHASE.

import {
  CompletionReportFullData,
  completionReportDisplayNo,
  groupFilesByPhase,
} from "@/lib/completion-reports/completion-report-types";
import {
  WorkOrderFileDB,
  WorkOrderFilePhase,
  workOrderFilePhaseLabel,
} from "@/lib/work-order-files/work-order-file-types";

// ─── Constants ────────────────────────────────────────────────────────────────

const CATEGORY_LABEL: Record<string, string> = {
  coating:  "コーティング",
  ppf:      "PPF",
  window:   "ウィンドウ",
  interior: "インテリア",
  glass:    "ガラス",
  other:    "その他",
};

// Phases to show in the preview, in order
const PREVIEW_PHASES: WorkOrderFilePhase[] = [
  "before", "during", "after", "damage", "delivery", "other",
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function yen(n: number) {
  return "¥" + n.toLocaleString("ja-JP");
}

function formatDate(iso: string | null) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("ja-JP");
}

function formatDatetime(iso: string | null) {
  if (!iso) return "—";
  return iso.replace("T", " ").slice(0, 16);
}

function customerFullName(
  customers: CompletionReportFullData["work_order"] extends null ? never
    : NonNullable<CompletionReportFullData["work_order"]>["customers"]
): string {
  if (!customers) return "—";
  return [customers.last_name, customers.first_name].filter(Boolean).join(" ") || "—";
}

// ─── Photo section ────────────────────────────────────────────────────────────

interface PhotoSectionProps {
  phase:     WorkOrderFilePhase;
  files:     WorkOrderFileDB[];
  previewAll: boolean;  // true = show all files; false = is_public only
}

function PhotoSection({ phase, files, previewAll }: PhotoSectionProps) {
  const shown = previewAll
    ? files
    : files.filter((f) => f.is_public);

  if (shown.length === 0) return null;

  return (
    <div className="mb-6">
      <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">
        {workOrderFilePhaseLabel(phase)}
      </p>
      <div className="grid grid-cols-3 gap-2">
        {shown.map((file) => (
          <div key={file.id}>
            {file.file_url ? (
              <img
                src={file.file_url}
                alt={file.title ?? file.file_name ?? ""}
                className="w-full h-24 object-cover rounded border border-gray-200"
              />
            ) : (
              <div className="w-full h-24 rounded border border-gray-200 bg-gray-50 flex items-center justify-center">
                <span className="text-gray-300 text-2xl">📷</span>
              </div>
            )}
            {file.title && (
              <p className="text-[10px] text-gray-400 mt-1 truncate">{file.title}</p>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

interface CompletionReportPreviewProps {
  data:       CompletionReportFullData;
  previewAll?: boolean;  // default true (screen preview shows all files)
}

export default function CompletionReportPreview({
  data,
  previewAll = true,
}: CompletionReportPreviewProps) {
  const { report, dealer, work_order: wo, files } = data;
  const customer  = wo?.customers  ?? null;
  const vehicle   = wo?.vehicles   ?? null;
  const estimate  = wo?.estimates  ?? null;
  const items     = estimate?.estimate_items ?? [];
  const byPhase   = groupFilesByPhase(files);
  const displayNo = completionReportDisplayNo(report);

  return (
    <>
      {/* Print CSS */}
      <style>{`
        @media print {
          body * { visibility: hidden; }
          #completion-report-print-area, #completion-report-print-area * { visibility: visible; }
          #completion-report-print-area { position: fixed; inset: 0; overflow: visible; }
        }
      `}</style>

      <div id="completion-report-print-area" className="bg-[#1e293b] rounded-xl shadow-lg p-4 sm:p-6">
        {/* White A4-like paper */}
        <div className="bg-white text-gray-900 rounded-lg shadow-lg mx-auto max-w-3xl p-8 sm:p-12">

          {/* ── Document Header ── */}
          <div className="flex items-start justify-between mb-8">
            {/* Dealer info */}
            <div>
              <div className="flex items-center gap-2 mb-1">
                <div className="w-7 h-7 bg-[#1d4ed8] rounded-md flex items-center justify-center text-white font-bold text-sm">
                  D
                </div>
                <span className="font-bold text-gray-900 text-lg">
                  {dealer?.name ?? "DealerOS"}
                </span>
              </div>
              {dealer?.prefecture && dealer?.address && (
                <p className="text-xs text-gray-400">
                  {dealer.prefecture} {dealer.address}
                </p>
              )}
              {dealer?.phone && (
                <p className="text-xs text-gray-400">TEL: {dealer.phone}</p>
              )}
              {dealer?.email && (
                <p className="text-xs text-gray-400">{dealer.email}</p>
              )}
            </div>

            {/* Report info */}
            <div className="text-right">
              <h1 className="text-2xl font-bold text-gray-900 mb-1">施工完了報告書</h1>
              <p className="text-sm text-gray-500">{displayNo}</p>
              {report.title && report.title !== "施工完了報告書" && (
                <p className="text-sm text-gray-700 font-medium mt-0.5">{report.title}</p>
              )}
              <p className="text-xs text-gray-400 mt-1">
                報告日: {formatDate(report.report_date)}
              </p>
            </div>
          </div>

          {/* ── Customer & Vehicle ── */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 mb-8 pb-8 border-b border-gray-200">
            <div>
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">お客様</p>
              <p className="font-bold text-gray-900 text-lg">
                {customerFullName(customer)} 様
              </p>
              {customer?.phone && (
                <p className="text-sm text-gray-600 mt-1">TEL: {customer.phone}</p>
              )}
              {customer?.email && (
                <p className="text-sm text-gray-600">{customer.email}</p>
              )}
            </div>
            <div>
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">車両情報</p>
              <p className="font-bold text-gray-900">
                {[vehicle?.maker, vehicle?.model].filter(Boolean).join(" ") || "—"}
              </p>
              {(vehicle?.year || vehicle?.grade) && (
                <p className="text-sm text-gray-600">
                  {[vehicle?.year && `${vehicle.year}年`, vehicle?.grade].filter(Boolean).join(" / ")}
                </p>
              )}
              {vehicle?.plate_number && (
                <p className="text-sm text-gray-600 mt-1">{vehicle.plate_number}</p>
              )}
              {vehicle?.color && (
                <p className="text-sm text-gray-500">{vehicle.color}</p>
              )}
            </div>
          </div>

          {/* ── Work Order Info ── */}
          <div className="mb-8 pb-8 border-b border-gray-200">
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-4">施工情報</p>
            <div className="grid grid-cols-2 gap-x-8 gap-y-2 text-sm">
              {wo?.work_order_number && (
                <>
                  <span className="text-gray-500">作業番号</span>
                  <span className="text-gray-800 font-medium">{wo.work_order_number}</span>
                </>
              )}
              {wo?.actual_start_at && (
                <>
                  <span className="text-gray-500">施工開始</span>
                  <span className="text-gray-800">{formatDatetime(wo.actual_start_at)}</span>
                </>
              )}
              {wo?.actual_end_at && (
                <>
                  <span className="text-gray-500">施工終了</span>
                  <span className="text-gray-800">{formatDatetime(wo.actual_end_at)}</span>
                </>
              )}
              {wo?.assigned_staff && (
                <>
                  <span className="text-gray-500">担当者</span>
                  <span className="text-gray-800">{wo.assigned_staff}</span>
                </>
              )}
            </div>

            {wo?.service_summary && (
              <div className="mt-4">
                <p className="text-xs text-gray-500 mb-1">作業概要</p>
                <p className="text-sm text-gray-700 whitespace-pre-wrap">{wo.service_summary}</p>
              </div>
            )}
          </div>

          {/* ── Estimate Items ── */}
          {items.length > 0 && (
            <div className="mb-8 pb-8 border-b border-gray-200">
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-4">施工内容明細</p>
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b-2 border-gray-900">
                    <th className="text-left font-semibold text-gray-700 pb-2 pr-4">カテゴリ</th>
                    <th className="text-left font-semibold text-gray-700 pb-2 pr-4">品目</th>
                    <th className="text-right font-semibold text-gray-700 pb-2 pr-4">単価</th>
                    <th className="text-right font-semibold text-gray-700 pb-2 pr-4">数量</th>
                    <th className="text-right font-semibold text-gray-700 pb-2">小計</th>
                  </tr>
                </thead>
                <tbody>
                  {items
                    .slice()
                    .sort((a, b) => a.sort_order - b.sort_order)
                    .map((item) => (
                      <tr key={item.id} className="border-b border-gray-100">
                        <td className="py-2.5 pr-4 text-gray-500 text-xs whitespace-nowrap">
                          {CATEGORY_LABEL[item.category] ?? item.category}
                        </td>
                        <td className="py-2.5 pr-4 text-gray-800">
                          <div>{item.item_name}</div>
                          {item.description && (
                            <div className="text-xs text-gray-400 mt-0.5">{item.description}</div>
                          )}
                        </td>
                        <td className="py-2.5 pr-4 text-right text-gray-700 whitespace-nowrap">
                          {yen(item.unit_price)}
                        </td>
                        <td className="py-2.5 pr-4 text-right text-gray-700">
                          {item.quantity}
                        </td>
                        <td className="py-2.5 text-right font-medium text-gray-800 whitespace-nowrap">
                          {yen(item.line_total)}
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>

              {estimate && (
                <div className="flex justify-end mt-4">
                  <div className="w-52">
                    <div className="flex justify-between py-1 text-sm text-gray-500">
                      <span>小計</span>
                      <span>{yen(estimate.subtotal)}</span>
                    </div>
                    {estimate.discount_amount > 0 && (
                      <div className="flex justify-between py-1 text-sm text-red-600">
                        <span>値引き</span>
                        <span>−{yen(estimate.discount_amount)}</span>
                      </div>
                    )}
                    <div className="flex justify-between py-1 text-sm text-gray-500 border-b border-gray-200">
                      <span>消費税 ({estimate.tax_rate}%)</span>
                      <span>{yen(estimate.tax_amount)}</span>
                    </div>
                    <div className="flex justify-between py-2 text-base font-bold text-gray-900">
                      <span>合計</span>
                      <span>{yen(estimate.total)}</span>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ── Photos by Phase ── */}
          {files.length > 0 && (
            <div className="mb-8 pb-8 border-b border-gray-200">
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-4">施工写真</p>
              {PREVIEW_PHASES.map((phase) => {
                const phaseFiles = byPhase[phase] ?? [];
                if (phaseFiles.length === 0) return null;
                return (
                  <PhotoSection
                    key={phase}
                    phase={phase}
                    files={phaseFiles}
                    previewAll={previewAll}
                  />
                );
              })}
            </div>
          )}

          {/* ── Customer Message ── */}
          {report.customer_message && (
            <div className="mb-8 pb-8 border-b border-gray-200">
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">
                お客様へのメッセージ
              </p>
              <div className="bg-gray-50 rounded-lg p-4">
                <p className="text-sm text-gray-700 whitespace-pre-wrap leading-relaxed">
                  {report.customer_message}
                </p>
              </div>
            </div>
          )}

          {/* ── Signature ── */}
          <div className="flex justify-between items-end mt-8">
            <div>
              <p className="text-xs text-gray-400 mb-1">施工担当者</p>
              <div className="border-b border-gray-300 w-40 mb-1" />
              {wo?.assigned_staff && (
                <p className="text-sm text-gray-700">{wo.assigned_staff}</p>
              )}
            </div>
            <div className="text-right">
              {dealer?.name && (
                <p className="text-sm font-semibold text-gray-700">{dealer.name}</p>
              )}
              <div className="w-16 h-16 border-2 border-gray-200 rounded-full flex items-center justify-center mt-2 ml-auto">
                <span className="text-[10px] text-gray-300">会社印</span>
              </div>
            </div>
          </div>

          {/* ── Footer ── */}
          <div className="pt-6 mt-6 border-t border-gray-100 text-center text-xs text-gray-400">
            <p>ご不明な点がございましたら、お気軽にお問い合わせください。</p>
            {dealer?.phone && <p className="mt-1">TEL: {dealer.phone}</p>}
            <p className="mt-1">DealerOS — Dealer Management System</p>
          </div>
        </div>
      </div>
    </>
  );
}
