"use server";

import { createClient } from "@/lib/supabase/server";
import { getCurrentDealer } from "@/lib/auth/get-current-dealer";
import { getCurrentUser } from "@/lib/auth/get-current-user";
import {
  AuditAction,
  AuditLogDB,
  AuditLogFilter,
  AuditResourceType,
  auditActionLabel,
  auditResourceTypeLabel,
} from "./audit-types";

interface CreateAuditLogParams {
  action:        AuditAction;
  resource_type: AuditResourceType;
  resource_id?:  string | null;
  old_value?:    Record<string, unknown> | null;
  new_value?:    Record<string, unknown> | null;
}

export async function createAuditLog(params: CreateAuditLogParams): Promise<void> {
  try {
    const dealer = await getCurrentDealer();
    if (!dealer) return;

    const user = await getCurrentUser();
    if (!user) return;

    const supabase = await createClient();

    await supabase.from("audit_logs").insert({
      dealer_id:     dealer.dealer_id,
      actor_user_id: user.id,
      actor_email:   user.email ?? null,
      actor_role:    dealer.role,
      action:        params.action,
      resource_type: params.resource_type,
      resource_id:   params.resource_id ?? null,
      old_value:     params.old_value ?? null,
      new_value:     params.new_value ?? null,
      ip_address:    null,
      user_agent:    null,
    });
  } catch {
    // Audit log failure must NEVER block business flow
  }
}

export async function getAuditLogs(
  filter: AuditLogFilter
): Promise<{ data: AuditLogDB[]; total: number }> {
  const dealer = await getCurrentDealer();
  if (!dealer) return { data: [], total: 0 };

  const supabase = await createClient();

  let query = supabase
    .from("audit_logs")
    .select("*", { count: "exact" })
    .eq("dealer_id", dealer.dealer_id);

  if (filter.action)        query = query.eq("action", filter.action);
  if (filter.resource_type) query = query.eq("resource_type", filter.resource_type);
  if (filter.actor_user_id) query = query.eq("actor_user_id", filter.actor_user_id);
  if (filter.from)          query = query.gte("created_at", filter.from);
  if (filter.to)            query = query.lte("created_at", filter.to + "T23:59:59Z");

  const page    = filter.page ?? 1;
  const perPage = filter.per_page ?? 20;

  query = query
    .order("created_at", { ascending: false })
    .range((page - 1) * perPage, page * perPage - 1);

  const { data, error, count } = await query;

  if (error || !data) return { data: [], total: 0 };

  return { data: data as AuditLogDB[], total: count ?? 0 };
}

export async function getAuditByResource(
  resourceType: AuditResourceType,
  resourceId: string
): Promise<AuditLogDB[]> {
  const dealer = await getCurrentDealer();
  if (!dealer) return [];

  const supabase = await createClient();

  const { data, error } = await supabase
    .from("audit_logs")
    .select("*")
    .eq("dealer_id", dealer.dealer_id)
    .eq("resource_type", resourceType)
    .eq("resource_id", resourceId)
    .order("created_at", { ascending: false })
    .limit(30);

  if (error || !data) return [];

  return data as AuditLogDB[];
}

export async function exportAuditLogsCsv(
  filter: AuditLogFilter
): Promise<{ csv: string; filename: string }> {
  const dealer = await getCurrentDealer();
  if (!dealer) return { csv: "", filename: "" };

  const supabase = await createClient();

  let query = supabase
    .from("audit_logs")
    .select("*")
    .eq("dealer_id", dealer.dealer_id);

  if (filter.action)        query = query.eq("action", filter.action);
  if (filter.resource_type) query = query.eq("resource_type", filter.resource_type);
  if (filter.actor_user_id) query = query.eq("actor_user_id", filter.actor_user_id);
  if (filter.from)          query = query.gte("created_at", filter.from);
  if (filter.to)            query = query.lte("created_at", filter.to + "T23:59:59Z");

  query = query
    .order("created_at", { ascending: false })
    .limit(1000);

  const { data, error } = await query;

  if (error || !data) return { csv: "", filename: "" };

  const rows = data as AuditLogDB[];

  function escapeCsv(value: unknown): string {
    if (value === null || value === undefined) return "";
    const str = String(value);
    if (str.includes(",") || str.includes('"') || str.includes("\n")) {
      return `"${str.replace(/"/g, '""')}"`;
    }
    return str;
  }

  const header = [
    "日時", "ユーザー", "ロール", "アクション",
    "リソース種別", "リソースID", "変更前", "変更後", "IP",
  ].join(",");

  const csvRows = rows.map((row) => {
    const dt = new Date(row.created_at);
    const dateStr = `${dt.getFullYear()}/${String(dt.getMonth() + 1).padStart(2, "0")}/${String(dt.getDate()).padStart(2, "0")} ${String(dt.getHours()).padStart(2, "0")}:${String(dt.getMinutes()).padStart(2, "0")}`;

    return [
      escapeCsv(dateStr),
      escapeCsv(row.actor_email ?? row.actor_user_id?.slice(0, 8) ?? ""),
      escapeCsv(row.actor_role ?? ""),
      escapeCsv(auditActionLabel(row.action)),
      escapeCsv(auditResourceTypeLabel(row.resource_type)),
      escapeCsv(row.resource_id ?? ""),
      escapeCsv(row.old_value ? JSON.stringify(row.old_value) : ""),
      escapeCsv(row.new_value ? JSON.stringify(row.new_value) : ""),
      escapeCsv(row.ip_address ?? ""),
    ].join(",");
  });

  const csv = [header, ...csvRows].join("\r\n");

  const now = new Date();
  const filename = `audit-log-${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, "0")}${String(now.getDate()).padStart(2, "0")}.csv`;

  return { csv, filename };
}
