import { redirect } from "next/navigation";
import { getCurrentAdmin } from "@/lib/admin/get-current-admin";
import {
  getReceivingFormData,
  getRecentAdminReceipts,
} from "@/lib/admin/logistics/logistics-receiving-actions";
import LogisticsReceivingClient from "./LogisticsReceivingClient";

export const dynamic = "force-dynamic";
export const metadata = { title: "Receiving | GYEON Logistics" };

export default async function LogisticsReceivingPage() {
  const caller = await getCurrentAdmin();
  if (!caller) redirect("/login");

  const [formData, recentReceipts] = await Promise.all([
    getReceivingFormData(),
    getRecentAdminReceipts(50),
  ]);

  return (
    <LogisticsReceivingClient
      dealers={formData.dealers}
      products={formData.products}
      initialReceipts={recentReceipts}
    />
  );
}
