import { redirect } from "next/navigation";
import { getCurrentAdmin } from "@/lib/admin/get-current-admin";
import { getResourcesForAdmin } from "@/lib/resources/manage-resources";
import ResourcesAdminClient from "@/components/admin/resources/ResourcesAdminClient";

export const dynamic = "force-dynamic";
export const metadata = { title: "Resource Management | Admin" };

const MANAGE_ROLES = ["super_admin", "gyeon_admin"];

export default async function AdminResourcesPage() {
  const admin = await getCurrentAdmin();
  if (!admin) redirect("/login");
  if (!MANAGE_ROLES.includes(admin.role)) redirect("/admin/dashboard");

  const resources = await getResourcesForAdmin().catch(() => []);
  return <ResourcesAdminClient initialResources={resources} />;
}
