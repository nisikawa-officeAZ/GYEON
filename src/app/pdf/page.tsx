import MainLayout from "@/components/layout/MainLayout";
import PageTitle from "@/components/ui/PageTitle";
import PDFActions from "@/components/pdf/PDFActions";
import PDFPreview from "@/components/pdf/PDFPreview";

export default function PDFPage() {
  return (
    <MainLayout>
      <div className="max-w-4xl mx-auto">
        {/* Header row */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
          <PageTitle title="PDF" subtitle="見積書プレビュー" />
          <PDFActions />
        </div>

        {/* Preview */}
        <PDFPreview />
      </div>
    </MainLayout>
  );
}
