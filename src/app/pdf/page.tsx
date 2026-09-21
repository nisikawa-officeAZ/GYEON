import Link                    from "next/link";
import MainLayout              from "@/components/layout/MainLayout";
import PageTitle               from "@/components/ui/PageTitle";
import PDFActions              from "@/components/pdf/PDFActions";
import EstimatePdfFrame        from "@/components/pdf/EstimatePdfFrame";
import { getEstimatePdfData }      from "@/lib/pdf/get-estimate-pdf-data";
import { getEstimates } from "@/lib/estimates/get-estimates";
import {
  estimateCustomerName,
  estimateDisplayNo,
  estimateStatusLabel,
  estimateVehicleLabel,
} from "@/lib/estimates/estimate-types";

export const dynamic = "force-dynamic";

interface Props {
  searchParams: Promise<{ estimateId?: string }>;
}

export default async function PDFPage({ searchParams }: Props) {
  const { estimateId } = await searchParams;

  // Both loaders are tenant-scoped server-side. The estimate is fetched here only to decide what to
  // show (and to reject an id that is not this dealer's); the preview itself is rendered by
  // /pdf/estimate, which re-resolves the dealer and re-scopes the query on its own — the id in the
  // URL never grants access on either path.
  const [estimate, estimates] = await Promise.all([
    estimateId ? getEstimatePdfData(estimateId)  : null,
    getEstimates(),
  ]);

  const invalidSelection = Boolean(estimateId && !estimate);

  return (
    <MainLayout>
      <div className="max-w-4xl mx-auto">
        {/* Header row */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
          <PageTitle title="PDF" subtitle="見積書プレビュー" />
          {estimate && estimateId ? <PDFActions estimateId={estimateId} /> : null}
        </div>

        {/* Preview — the real PDF, from the same renderer the download uses */}
        {estimate && estimateId ? (
          <EstimatePdfFrame estimateId={estimateId} />
        ) : (
          <section className="bg-[#1e293b] rounded-xl shadow-lg p-4 sm:p-6">
            {invalidSelection ? (
              <div role="alert" className="mb-4 px-4 py-3 rounded-lg bg-amber-400/10 border border-amber-400/30 text-amber-300 text-sm">
                指定された見積書が見つかりません。保存済み見積書から選び直してください。
              </div>
            ) : null}
            <div className="flex items-center justify-between gap-3 mb-4">
              <div>
                <h2 className="text-base font-semibold text-slate-100">保存済み見積書</h2>
                <p className="text-xs text-slate-400 mt-1">正規の見積書PDFを表示する見積を選択してください。</p>
              </div>
              <Link href="/estimates" className="text-xs text-blue-400 hover:text-blue-300 whitespace-nowrap">見積管理へ</Link>
            </div>
            {estimates.length === 0 ? (
              <p className="text-sm text-slate-400 py-8 text-center">表示できる保存済み見積書がありません。</p>
            ) : (
              <div className="divide-y divide-slate-700/60 border border-slate-700 rounded-lg overflow-hidden">
                {estimates.map((row) => (
                  <div key={row.id} className="grid grid-cols-1 sm:grid-cols-[8rem_minmax(0,1fr)_minmax(0,1fr)_5rem_auto] items-center gap-2 px-3 py-3 bg-[#0f172a]/50">
                    <span className="text-sm text-slate-200">{estimateDisplayNo(row)}</span>
                    <span className="text-sm text-slate-300 truncate" title={estimateCustomerName(row.customers)}>{estimateCustomerName(row.customers)}</span>
                    <span className="text-sm text-slate-400 truncate" title={estimateVehicleLabel(row.vehicles)}>{estimateVehicleLabel(row.vehicles)}</span>
                    <span className="text-xs text-slate-400">{estimateStatusLabel(row.status)}</span>
                    <Link
                      href={`/pdf?estimateId=${encodeURIComponent(row.id)}`}
                      className="inline-flex justify-center rounded-lg border border-blue-500/50 px-3 py-2 text-xs font-medium text-blue-300 hover:bg-blue-500/10"
                    >PDFを開く</Link>
                  </div>
                ))}
              </div>
            )}
          </section>
        )}
      </div>
    </MainLayout>
  );
}
