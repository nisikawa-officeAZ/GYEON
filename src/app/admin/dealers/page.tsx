import { getDealersAdmin } from "@/lib/admin/get-dealers-admin";
import DealersAdminClient from "./DealersAdminClient";

export const dynamic = "force-dynamic";
export const metadata = { title: "Dealers | Admin" };

export default async function AdminDealersPage() {
  const dealers = await getDealersAdmin();
  return <DealersAdminClient dealers={dealers} />;
}
