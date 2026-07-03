import { redirect } from "next/navigation";
import { getCurrentAdmin } from "@/lib/admin/get-current-admin";
import { getDealersAdmin, getArchivedDealersAdmin } from "@/lib/admin/get-dealers-admin";
import DealersAdminClient from "./DealersAdminClient";

export const dynamic = "force-dynamic";
export const metadata = { title: "Dealer Approval Center | GYEON Admin" };

export default async function AdminDealersPage() {
  const caller = await getCurrentAdmin();
  if (!caller) redirect("/login");

  // logistics_admin has read-only access (no action buttons rendered in client)
  const [dealers, archived] = await Promise.all([
    getDealersAdmin(),
    getArchivedDealersAdmin(),
  ]);
  return <DealersAdminClient dealers={dealers} archived={archived} callerRole={caller.role} />;
}
