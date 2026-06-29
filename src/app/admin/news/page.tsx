import { redirect } from "next/navigation";
import { getCurrentAdmin } from "@/lib/admin/get-current-admin";
import { getNewsForAdmin } from "@/lib/news/manage-news";
import NewsAdminClient from "@/components/admin/news/NewsAdminClient";

export const dynamic = "force-dynamic";
export const metadata = { title: "お知らせ管理 | スーパー管理者" };

const MANAGE_ROLES = ["super_admin", "gyeon_admin"];

export default async function AdminNewsPage() {
  const admin = await getCurrentAdmin();
  if (!admin) redirect("/login");
  if (!MANAGE_ROLES.includes(admin.role)) redirect("/admin/dashboard");

  const news = await getNewsForAdmin().catch(() => []);
  return <NewsAdminClient initialNews={news} />;
}
