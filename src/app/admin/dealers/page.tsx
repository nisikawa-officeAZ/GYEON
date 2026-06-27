import { redirect } from "next/navigation";
import { getCurrentAdmin } from "@/lib/admin/get-current-admin";
import { getDealersAdmin } from "@/lib/admin/get-dealers-admin";
import DealersAdminClient from "./DealersAdminClient";

export const dynamic = "force-dynamic";
export const metadata = { title: "Dealer Approval Center | GYEON Admin" };

export default async function AdminDealersPage() {
  const caller = await getCurrentAdmin();
  if (!caller) redirect("/login");

  // logistics_admin has read-only access (no action buttons rendered in client)
  const dealers = await getDealersAdmin();
  return <DealersAdminClient dealers={dealers} callerRole={caller.role} />;
}
