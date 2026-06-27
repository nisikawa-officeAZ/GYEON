import { redirect } from "next/navigation";
import { getCurrentAdmin } from "@/lib/admin/get-current-admin";
import { getAdminStockMovements } from "@/lib/admin/logistics/get-stock-movements";
import MovementsClient from "./MovementsClient";

export const dynamic = "force-dynamic";
export const metadata = { title: "Stock Movement History | GYEON Logistics" };

export default async function MovementsPage() {
  const admin = await getCurrentAdmin();
  if (!admin) redirect("/login");

  const movements = await getAdminStockMovements(200);

  return <MovementsClient movements={movements} />;
}
