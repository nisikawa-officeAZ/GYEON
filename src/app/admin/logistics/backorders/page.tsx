import { redirect } from "next/navigation";
import { getCurrentAdmin } from "@/lib/admin/get-current-admin";
import { getLogisticsBackorders } from "@/lib/admin/logistics/get-logistics-backorders";
import LogisticsBackordersClient from "./LogisticsBackordersClient";

export const dynamic = "force-dynamic";
export const metadata = { title: "Backorder Center | GYEON Logistics" };

export default async function LogisticsBackordersPage() {
  const caller = await getCurrentAdmin();
  if (!caller) redirect("/login");

  const backorders = await getLogisticsBackorders();

  return <LogisticsBackordersClient initialBackorders={backorders} />;
}
