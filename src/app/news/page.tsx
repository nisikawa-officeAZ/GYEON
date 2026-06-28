import MainLayout from "@/components/layout/MainLayout";
import PageTitle from "@/components/ui/PageTitle";
import NewsClient from "@/components/news/NewsClient";
import { getPublishedNews } from "@/lib/news/news";

export const dynamic = "force-dynamic";
export const metadata = { title: "お知らせ" };

export default async function NewsPage() {
  const news = await getPublishedNews();
  return (
    <MainLayout>
      <div className="max-w-3xl mx-auto p-6 flex flex-col gap-6">
        <PageTitle title="お知らせ" subtitle="GYEONからのお知らせ・新製品・入荷情報" />
        <NewsClient initialNews={news} />
      </div>
    </MainLayout>
  );
}
