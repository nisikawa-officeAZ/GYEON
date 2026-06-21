export const dynamic = "force-dynamic";

import MainLayout            from "@/components/layout/MainLayout";
import { getReservations }   from "@/lib/reservations/get-reservations";
import { createClient }      from "@/lib/supabase/server";
import { getCurrentDealer }  from "@/lib/auth/get-current-dealer";
import ReservationsPageClient from "./ReservationsPageClient";
import FeatureGate           from "@/components/plans/FeatureGate";

export default async function ReservationsPage() {
  const today = new Date().toISOString().slice(0, 10);

  // Fetch all upcoming reservations (from today onwards)
  const reservations = await getReservations({ from: today, limit: 200 });

  const dealer = await getCurrentDealer();
  const supabase = await createClient();

  let customers: Array<{ id: string; last_name: string; first_name: string | null }> = [];
  let vehicles: Array<{
    id: string;
    customer_id: string | null;
    maker: string | null;
    model: string | null;
    plate_number: string | null;
  }> = [];

  if (dealer) {
    const [custResult, vehResult] = await Promise.all([
      supabase
        .from("customers")
        .select("id, last_name, first_name")
        .eq("dealer_id", dealer.dealer_id)
        .order("last_name"),
      supabase
        .from("vehicles")
        .select("id, customer_id, maker, model, plate_number")
        .eq("dealer_id", dealer.dealer_id)
        .order("maker"),
    ]);
    customers = (custResult.data ?? []) as typeof customers;
    vehicles  = (vehResult.data  ?? []) as typeof vehicles;
  }

  return (
    <MainLayout>
      <FeatureGate feature="reservations">
        <ReservationsPageClient
          initialReservations={reservations}
          customers={customers}
          vehicles={vehicles}
        />
      </FeatureGate>
    </MainLayout>
  );
}
