import { redirect } from "next/navigation";
import { getCurrentAdmin } from "@/lib/admin/get-current-admin";
import { getLogisticsShipments } from "@/lib/admin/logistics/get-logistics-shipments";
import LogisticsShipmentsClient from "./LogisticsShipmentsClient";

export const dynamic = "force-dynamic";
export const metadata = { title: "Shipment Queue | GYEON Logistics" };

export default async function LogisticsShipmentsPage() {
  const caller = await getCurrentAdmin();
  if (!caller) redirect("/login");

  const shipments = await getLogisticsShipments();

  return <LogisticsShipmentsClient initialShipments={shipments} />;
}
