"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getCurrentDealer } from "@/lib/auth/get-current-dealer";
import { getNextDocumentNumber } from "@/lib/numbering/get-next-document-number";
import { ReservationDB, ReservationStatus, ReservationServiceType } from "./reservation-types";
import { createActivityLog } from "@/lib/activity/activity-log";
import { createNotification } from "@/lib/notifications/notification";
import { requireStaffCapability } from "@/lib/auth/require-staff-capability";
import { resolveBookingNotificationOptIn } from "./booking-notification";

interface CreateReservationInput {
  customer_id?: string | null;
  vehicle_id?: string | null;
  work_order_id?: string | null;
  assigned_staff_id?: string | null;
  reservation_date: string;
  start_time?: string | null;
  end_time?: string | null;
  service_type: ReservationServiceType;
  notes?: string | null;
  status?: ReservationStatus;
}

export async function createReservation(
  input: CreateReservationInput
): Promise<{ success: boolean; data?: ReservationDB; error?: string }> {
  const auth = await requireStaffCapability("edit");
  if ("error" in auth) return { success: false, error: auth.error };

  const dealer = await getCurrentDealer();
  if (!dealer) return { success: false, error: "No active dealer membership." };

  const supabase = await createClient();
  const did = dealer.dealer_id;

  // Validate customer ownership
  if (input.customer_id) {
    const { data: customer } = await supabase
      .from("customers")
      .select("id")
      .eq("id", input.customer_id)
      .eq("dealer_id", did)
      .maybeSingle();
    if (!customer) return { success: false, error: "顧客が見つかりません" };
  }

  // Validate vehicle ownership
  if (input.vehicle_id) {
    const { data: vehicle } = await supabase
      .from("vehicles")
      .select("id")
      .eq("id", input.vehicle_id)
      .eq("dealer_id", did)
      .maybeSingle();
    if (!vehicle) return { success: false, error: "車両が見つかりません" };
  }

  // Validate work_order ownership (optional — used for reminder/work-order linkage)
  if (input.work_order_id) {
    const { data: wo } = await supabase
      .from("work_orders")
      .select("id")
      .eq("id", input.work_order_id)
      .eq("dealer_id", did)
      .maybeSingle();
    if (!wo) return { success: false, error: "作業指示書が見つかりません" };
  }

  // Validate assigned staff ownership (optional — staff assignment readiness)
  if (input.assigned_staff_id) {
    const { data: staff } = await supabase
      .from("dealer_staff")
      .select("id")
      .eq("id", input.assigned_staff_id)
      .eq("dealer_id", did)
      .maybeSingle();
    if (!staff) return { success: false, error: "担当スタッフが見つかりません" };
  }

  const reservation_number = await getNextDocumentNumber("reservation");

  const { data, error } = await supabase
    .from("reservations")
    .insert({
      dealer_id:          did,
      reservation_number: reservation_number ?? null,
      customer_id:        input.customer_id       ?? null,
      vehicle_id:         input.vehicle_id        ?? null,
      work_order_id:      input.work_order_id     ?? null,
      assigned_staff_id:  input.assigned_staff_id ?? null,
      reservation_date:   input.reservation_date,
      start_time:         input.start_time   ?? null,
      end_time:           input.end_time     ?? null,
      service_type:       input.service_type,
      notes:              input.notes        ?? null,
      status:             input.status       ?? "pending",
    })
    .select(`
      *,
      customers ( last_name, first_name, phone ),
      vehicles  ( maker, model, plate_number )
    `)
    .single();

  if (error || !data) {
    console.error("[createReservation] error:", error?.message);
    return { success: false, error: error?.message ?? "Insert failed" };
  }

  revalidatePath("/reservations");
  revalidatePath("/calendar");

  void createActivityLog({
    entity_type: "reservation",
    entity_id:   data.id,
    customer_id: input.customer_id ?? null,
    action:      "created",
    title:       `予約を作成: ${reservation_number ?? data.id.slice(0, 8)}`,
  });

  void createNotification({
    type:        "info",
    title:       "予約を作成しました",
    message:     `${input.reservation_date} ${input.service_type}`,
    entity_type: "reservation",
    entity_id:   data.id,
  });

  // Booking notification opt-in (prepared gate only — no LINE/email send this sprint).
  // Default is OFF, so this block is intentionally inert; a future sprint enqueues the
  // booking notification here when the dealer has opted in.
  const notifyOptIn = await resolveBookingNotificationOptIn();
  if (notifyOptIn) {
    // Future sprint: enqueue a booking notification. Inert this sprint by design.
  }

  return { success: true, data: data as unknown as ReservationDB };
}
