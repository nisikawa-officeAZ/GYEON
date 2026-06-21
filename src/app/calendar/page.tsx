export const dynamic = "force-dynamic";

import MainLayout from "@/components/layout/MainLayout";
import { getReservationsByDateRange } from "@/lib/reservations/get-reservations-by-date";
import { createClient } from "@/lib/supabase/server";
import { getCurrentDealer } from "@/lib/auth/get-current-dealer";
import CalendarPageClient from "./CalendarPageClient";

export default async function CalendarPage() {
  const now = new Date();
  const year  = now.getFullYear();
  const month = now.getMonth() + 1;

  // Fetch current month's reservations (with buffer of prev/next month for calendar grid)
  const from = `${year}-${String(month - 1 || 12).padStart(2, "0")}-01`.replace(
    /^(\d{4})-00-/,
    `${year - 1}-12-`
  );
  const lastDay = new Date(year, month, 0).getDate();
  const toMonth = month + 1 > 12 ? 1 : month + 1;
  const toYear  = month + 1 > 12 ? year + 1 : year;
  const to = `${toYear}-${String(toMonth).padStart(2, "0")}-07`;

  const reservations = await getReservationsByDateRange(
    `${year}-${String(month).padStart(2, "0")}-01`,
    `${year}-${String(month).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`
  );

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
      <CalendarPageClient
        initialReservations={reservations}
        initialYear={year}
        initialMonth={month}
        customers={customers}
        vehicles={vehicles}
      />
    </MainLayout>
  );
}
