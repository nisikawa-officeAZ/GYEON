import Link                    from "next/link";
import MainLayout              from "@/components/layout/MainLayout";
import PageTitle               from "@/components/ui/PageTitle";
import PDFActions              from "@/components/pdf/PDFActions";
import EstimatePdfFrame        from "@/components/pdf/EstimatePdfFrame";
import GyeonServicePdfPreview  from "@/components/pdf/GyeonServicePdfPreview";
import { getEstimatePdfData }      from "@/lib/pdf/get-estimate-pdf-data";
import { getGyeonServicePdfData }  from "@/lib/pdf/get-gyeon-service-pdf-data";

interface Props {
  searchParams: Promise<{ estimateId?: string; gyeonId?: string }>;
}

export default async function PDFPage({ searchParams }: Props) {
  const { estimateId, gyeonId } = await searchParams;

  // Both loaders are tenant-scoped server-side. The estimate is fetched here only to decide what to
  // show (and to reject an id that is not this dealer's); the preview itself is rendered by
  // /pdf/estimate, which re-resolves the dealer and re-scopes the query on its own — the id in the
  // URL never grants access on either path.
  const [estimate, gyeonEstimate] = await Promise.all([
    estimateId ? getEstimatePdfData(estimateId)  : null,
    gyeonId    ? getGyeonServicePdfData(gyeonId) : null,
  ]);

  return (
    <MainLayout>
      <div className="max-w-4xl mx-auto">
        {/* Header row */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
          <PageTitle title="PDF" subtitle="見積書プレビュー" />
          {(estimate || gyeonEstimate) && <PDFActions estimateId={estimateId} />}
        </div>

        {/* Preview — the real PDF, from the same renderer the download uses */}
        {estimate && estimateId ? (
          <EstimatePdfFrame estimateId={estimateId} />
        ) : gyeonEstimate ? (
          <GyeonServicePdfPreview gyeonEstimate={gyeonEstimate} />
        ) : (
          <div className="rounded-2xl border border-[#263955] bg-[#152238] px-6 py-10 text-center shadow-lg sm:px-10 sm:py-14">
            <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-[#1c4fd6]/20 text-2xl text-[#6ea8ff]">
              ▤
            </div>
            <h2 className="text-lg font-semibold text-[#edf3fc]">
              {estimateId || gyeonId ? "PDFを表示できません" : "表示するPDFを選択してください"}
            </h2>
            <p className="mx-auto mt-2 max-w-xl text-sm leading-6 text-[#8191ad]">
              {estimateId || gyeonId
                ? "指定されたデータが見つからないか、この店舗では表示できません。対象の一覧からもう一度選択してください。"
                : "見積・請求・作業報告の各一覧から対象を選ぶと、現在の正式なPDFが表示されます。"}
            </p>
            <div className="mt-6 flex flex-col justify-center gap-3 sm:flex-row">
              <Link
                href="/estimates"
                className="rounded-xl bg-[#1c4fd6] px-5 py-3 text-sm font-semibold text-white transition-colors hover:bg-[#1a45bd]"
              >
                見積一覧を開く
              </Link>
              <Link
                href="/invoices"
                className="rounded-xl border border-[#263955] bg-[#0b1528] px-5 py-3 text-sm font-semibold text-[#c3cee2] transition-colors hover:bg-[#1a2740] hover:text-[#edf3fc]"
              >
                請求一覧を開く
              </Link>
              <Link
                href="/completion-reports"
                className="rounded-xl border border-[#263955] bg-[#0b1528] px-5 py-3 text-sm font-semibold text-[#c3cee2] transition-colors hover:bg-[#1a2740] hover:text-[#edf3fc]"
              >
                作業報告を開く
              </Link>
            </div>
          </div>
        )}
      </div>
    </MainLayout>
  );
}
