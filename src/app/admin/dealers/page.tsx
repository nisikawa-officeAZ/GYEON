import { redirect } from "next/navigation";
import { getCurrentAdmin } from "@/lib/admin/get-current-admin";
import { getDealersAdmin } from "@/lib/admin/get-dealers-admin";
import DealersAdminClient from "./DealersAdminClient";

export const dynamic = "force-dynamic";
export const metadata = { title: "Dealer Approval Center | GYEON Admin" };

export default async function AdminDealersPage() {
  const caller = await getCurrentAdmin();
  if (!caller) redirect("/login");

  // Logistics Admin must not access this module
  if (caller.role === "logistics_admin") redirect("/admin/dashboard");

  const dealers = await getDealersAdmin();
  return <DealersAdminClient dealers={dealers} />;
}
