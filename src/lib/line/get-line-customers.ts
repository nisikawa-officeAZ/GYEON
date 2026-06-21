"use server";

import { createClient } from "@/lib/supabase/server";
import { getCurrentDealer } from "@/lib/auth/get-current-dealer";
import { LineCustomerDB } from "./line-types";

export async function getLineCustomers(): Promise<LineCustomerDB[]> {
  const dealer = await getCurrentDealer();
  if (!dealer) return [];

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("line_customers")
    .select(`
      id, dealer_id, customer_id, line_user_id, display_name,
      picture_url, status_message, is_friend, linked_at,
      last_message_at, created_at, updated_at,
      customers ( last_name, first_name, phone, email )
    `)
    .eq("dealer_id", dealer.dealer_id)
    .eq("is_friend", true)
    .order("last_message_at", { ascending: false, nullsFirst: false })
    .order("created_at", { ascending: false });

  if (error) {
    console.error("getLineCustomers error:", error);
    return [];
  }

  return (data ?? []) as unknown as LineCustomerDB[];
}

export async function getLineCustomerByUserId(
  lineUserId: string
): Promise<LineCustomerDB | null> {
  const dealer = await getCurrentDealer();
  if (!dealer) return null;

  const supabase = await createClient();
  const { data } = await supabase
    .from("line_customers")
    .select("*")
    .eq("dealer_id", dealer.dealer_id)
    .eq("line_user_id", lineUserId)
    .maybeSingle();

  return data as LineCustomerDB | null;
}

export async function getLineCustomerByCustomerId(
  customerId: string
): Promise<LineCustomerDB | null> {
  const dealer = await getCurrentDealer();
  if (!dealer) return null;

  const supabase = await createClient();
  const { data } = await supabase
    .from("line_customers")
    .select("*")
    .eq("dealer_id", dealer.dealer_id)
    .eq("customer_id", customerId)
    .eq("is_friend", true)
    .maybeSingle();

  return data as LineCustomerDB | null;
}

export interface LineStats {
  friends_count:   number;
  linked_count:    number;
  this_month_new:  number;
}

export async function getLineStats(): Promise<LineStats> {
  const dealer = await getCurrentDealer();
  if (!dealer) return { friends_count: 0, linked_count: 0, this_month_new: 0 };

  const supabase = await createClient();
  const monthStart = new Date();
  monthStart.setDate(1);
  monthStart.setHours(0, 0, 0, 0);

  const [totalResult, linkedResult, newResult] = await Promise.all([
    supabase
      .from("line_customers")
      .select("*", { count: "exact", head: true })
      .eq("dealer_id", dealer.dealer_id)
      .eq("is_friend", true),
    supabase
      .from("line_customers")
      .select("*", { count: "exact", head: true })
      .eq("dealer_id", dealer.dealer_id)
      .eq("is_friend", true)
      .not("customer_id", "is", null),
    supabase
      .from("line_customers")
      .select("*", { count: "exact", head: true })
      .eq("dealer_id", dealer.dealer_id)
      .eq("is_friend", true)
      .gte("created_at", monthStart.toISOString()),
  ]);

  return {
    friends_count:  totalResult.count  ?? 0,
    linked_count:   linkedResult.count ?? 0,
    this_month_new: newResult.count    ?? 0,
  };
}
