import { redirect } from "next/navigation";
import { getCurrentAdmin } from "@/lib/admin/get-current-admin";
import { getStocktakingSessions } from "@/lib/admin/logistics/stocktaking-actions";
import StocktakingListClient from "./StocktakingListClient";

export const dynamic = "force-dynamic";
export const metadata = { title: "棚卸し | GYEON Logistics" };

export default async function StocktakingPage() {
  const caller = await getCurrentAdmin();
  if (!caller) redirect("/login");

  const sessions = await getStocktakingSessions();

  return <StocktakingListClient sessions={sessions} />;
}
