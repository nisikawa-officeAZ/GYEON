import { redirect } from "next/navigation";
import { getCurrentAdmin } from "@/lib/admin/get-current-admin";
import { getLogisticsInventory } from "@/lib/admin/logistics/get-logistics-inventory";
import LogisticsInventoryClient from "./LogisticsInventoryClient";

export const dynamic = "force-dynamic";
export const metadata = { title: "Inventory Overview | GYEON Logistics" };

export default async function LogisticsInventoryPage() {
  const caller = await getCurrentAdmin();
  if (!caller) redirect("/login");

  const inventory = await getLogisticsInventory();

  return <LogisticsInventoryClient initialInventory={inventory} />;
}
