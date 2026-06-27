import { redirect, notFound } from "next/navigation";
import { getCurrentAdmin } from "@/lib/admin/get-current-admin";
import { getStocktakingSession } from "@/lib/admin/logistics/stocktaking-actions";
import StocktakingSessionClient from "./StocktakingSessionClient";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ sessionId: string }> };

export async function generateMetadata({ params }: Props) {
  const { sessionId } = await params;
  return { title: `棚卸し #${sessionId.slice(0, 8).toUpperCase()} | GYEON Logistics` };
}

export default async function StocktakingSessionPage({ params }: Props) {
  const { sessionId } = await params;

  const caller = await getCurrentAdmin();
  if (!caller) redirect("/login");

  const data = await getStocktakingSession(sessionId);
  if (!data) notFound();

  return (
    <StocktakingSessionClient
      sessionData={data}
      adminId={caller.id}
    />
  );
}
