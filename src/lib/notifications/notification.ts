"use server";

import { createClient } from "@/lib/supabase/server";
import { getCurrentDealer } from "@/lib/auth/get-current-dealer";
import { getCurrentUser } from "@/lib/auth/get-current-user";
import type { NotificationType, NotificationDB } from "./notification-types";

interface CreateNotificationParams {
  type:         NotificationType;
  title:        string;
  message?:     string | null;
  entity_type?: string | null;
  entity_id?:   string | null;
  customer_id?: string | null;
}

/**
 * Creates a notification.
 * Resolves dealer_id and user_id server-side.
 * Fails silently — never blocks business flow.
 */
export async function createNotification(params: CreateNotificationParams): Promise<void> {
  try {
    const [dealer, user] = await Promise.all([
      getCurrentDealer(),
      getCurrentUser(),
    ]);
    if (!dealer) return;

    const supabase = await createClient();
    await supabase.from("notifications").insert({
      dealer_id:   dealer.dealer_id,
      user_id:     user?.id ?? null,
      type:        params.type,
      title:       params.title,
      message:     params.message ?? null,
      entity_type: params.entity_type ?? null,
      entity_id:   params.entity_id ?? null,
      customer_id: params.customer_id ?? null,
    });
  } catch {
    // Silent failure
  }
}

/**
 * Returns latest 20 notifications for current user/dealer, newest first.
 */
export async function getNotifications(): Promise<NotificationDB[]> {
  try {
    const [dealer, user] = await Promise.all([
      getCurrentDealer(),
      getCurrentUser(),
    ]);
    if (!dealer || !user) return [];

    const supabase = await createClient();
    const { data } = await supabase
      .from("notifications")
      .select("*")
      .eq("dealer_id", dealer.dealer_id)
      .or(`user_id.is.null,user_id.eq.${user.id}`)
      .order("created_at", { ascending: false })
      .limit(20);

    return (data as NotificationDB[]) ?? [];
  } catch {
    return [];
  }
}

/**
 * Returns count of unread notifications.
 * Returns 0 on error (safe fallback).
 */
export async function getUnreadNotificationCount(): Promise<number> {
  try {
    const [dealer, user] = await Promise.all([
      getCurrentDealer(),
      getCurrentUser(),
    ]);
    if (!dealer || !user) return 0;

    const supabase = await createClient();
    const { count } = await supabase
      .from("notifications")
      .select("*", { count: "exact", head: true })
      .eq("dealer_id", dealer.dealer_id)
      .eq("is_read", false)
      .or(`user_id.is.null,user_id.eq.${user.id}`);

    return count ?? 0;
  } catch {
    return 0;
  }
}

/**
 * Marks a single notification as read.
 */
export async function markNotificationAsRead(notificationId: string): Promise<void> {
  try {
    const dealer = await getCurrentDealer();
    if (!dealer) return;

    const supabase = await createClient();
    await supabase
      .from("notifications")
      .update({ is_read: true, read_at: new Date().toISOString() })
      .eq("id", notificationId)
      .eq("dealer_id", dealer.dealer_id);
  } catch {
    // Silent failure
  }
}

/**
 * Marks all unread notifications as read for current user/dealer.
 */
export async function markAllNotificationsAsRead(): Promise<void> {
  try {
    const [dealer, user] = await Promise.all([
      getCurrentDealer(),
      getCurrentUser(),
    ]);
    if (!dealer || !user) return;

    const supabase = await createClient();
    await supabase
      .from("notifications")
      .update({ is_read: true, read_at: new Date().toISOString() })
      .eq("dealer_id", dealer.dealer_id)
      .eq("is_read", false)
      .or(`user_id.is.null,user_id.eq.${user.id}`);
  } catch {
    // Silent failure
  }
}
