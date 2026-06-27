import { redirect } from "next/navigation";
import { getCurrentAdmin } from "@/lib/admin/get-current-admin";
import { getPendingProductOrders } from "@/lib/admin/logistics/po-receiving-actions";
import PoReceivingClient from "./PoReceivingClient";

export const dynamic = "force-dynamic";
export const metadata = { title: "PO Receiving | GYEON Logistics" };

export default async function PoReceivingPage() {
  const admin = await getCurrentAdmin();
  if (!admin) redirect("/login");

  const orders = await getPendingProductOrders();

  return <PoReceivingClient initialOrders={orders} />;
}
