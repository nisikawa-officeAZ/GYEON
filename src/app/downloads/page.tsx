import MainLayout from "@/components/layout/MainLayout";
import PageTitle from "@/components/ui/PageTitle";
import ResourcesClient from "@/components/resources/ResourcesClient";
import { getPublishedResources } from "@/lib/resources/resources";

export const dynamic = "force-dynamic";
export const metadata = { title: "ダウンロード" };

export default async function DownloadsPage() {
  const resources = await getPublishedResources();
  return (
    <MainLayout>
      <div className="max-w-4xl mx-auto p-6 flex flex-col gap-6">
        <PageTitle title="ダウンロード" subtitle="GYEON公式素材・カタログ・マニュアル" />
        <ResourcesClient initialResources={resources} />
      </div>
    </MainLayout>
  );
}
