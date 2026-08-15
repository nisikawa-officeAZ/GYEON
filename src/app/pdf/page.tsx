import MainLayout              from "@/components/layout/MainLayout";
import PageTitle               from "@/components/ui/PageTitle";
import PDFActions              from "@/components/pdf/PDFActions";
import PDFPreview              from "@/components/pdf/PDFPreview";
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
          <PDFActions estimateId={estimateId} />
        </div>

        {/* Preview — the real PDF, from the same renderer the download uses */}
        {estimate && estimateId ? (
          <EstimatePdfFrame estimateId={estimateId} />
        ) : gyeonEstimate ? (
          <GyeonServicePdfPreview gyeonEstimate={gyeonEstimate} />
        ) : (
          <>
            {/* Demo notice */}
            {(estimateId || gyeonId) && (
              <div className="mb-4 px-4 py-3 rounded-lg bg-amber-400/10 border border-amber-400/30 text-amber-300 text-sm">
                見積データが見つかりませんでした。デモプレビューを表示しています。
              </div>
            )}
            <PDFPreview />
          </>
        )}
      </div>
    </MainLayout>
  );
}
