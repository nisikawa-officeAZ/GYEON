import { redirect } from "next/navigation";
import { getCurrentAdmin } from "@/lib/admin/get-current-admin";
import { getAdjustmentFormData, getRecentWarehouseAdjustments } from "@/lib/admin/logistics/warehouse-adjustment-actions";
import AdjustmentsClient from "./AdjustmentsClient";

export const dynamic = "force-dynamic";
export const metadata = { title: "Stock Adjustments | GYEON Logistics" };

export default async function AdjustmentsPage() {
  const admin = await getCurrentAdmin();
  if (!admin) redirect("/login");

  const [formData, recentAdjustments] = await Promise.all([
    getAdjustmentFormData(),
    getRecentWarehouseAdjustments(50),
  ]);

  return (
    <AdjustmentsClient
      dealers={formData.dealers}
      products={formData.products}
      initialAdjustments={recentAdjustments}
    />
  );
}
