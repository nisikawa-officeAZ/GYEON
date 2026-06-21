import MainLayout from "@/components/layout/MainLayout";
import PageTitle from "@/components/ui/PageTitle";
import { getDocumentSequences } from "@/lib/numbering/get-document-sequences";
import DocumentSequenceSettings from "@/components/settings/DocumentSequenceSettings";

export default async function SettingsPage() {
  const sequences = await getDocumentSequences();

  return (
    <MainLayout>
      <div className="max-w-3xl mx-auto p-6 flex flex-col gap-8">
        <PageTitle title="Settings" />

        {/* ── 番号設定 ──────────────────────────────────────────────── */}
        <section className="flex flex-col gap-3">
          <div>
            <h2 className="text-base font-semibold text-slate-100">番号設定</h2>
            <p className="text-xs text-slate-500 mt-0.5">
              各書類の自動採番ルールを設定します。現在の採番数はリセットできません。
            </p>
          </div>
          <DocumentSequenceSettings sequences={sequences} />
        </section>
      </div>
    </MainLayout>
  );
}
