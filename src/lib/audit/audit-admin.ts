"use server";

import { requireAdmin } from "@/lib/admin/require-admin";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  AuditAction,
  AuditLogDB,
  AuditLogFilter,
  auditActionLabel,
  auditResourceTypeLabel,
} from "./audit-types";

interface AdminAuditLogFilter extends AuditLogFilter {
  dealer_id?: string;
}

export async function getAuditLogsAdmin(
  filter: AdminAuditLogFilter
): Promise<{ data: AuditLogDB[]; total: number }> {
  await requireAdmin();

  const supabase = createAdminClient();

  let query = supabase
    .from("audit_logs")
    .select("*", { count: "exact" });

  if (filter.dealer_id)     query = query.eq("dealer_id", filter.dealer_id);
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

export async function exportAuditLogsCsvAdmin(
  filter: AdminAuditLogFilter
): Promise<{ csv: string; filename: string }> {
  await requireAdmin();

  const supabase = createAdminClient();

  let query = supabase
    .from("audit_logs")
    .select("*");

  if (filter.dealer_id)     query = query.eq("dealer_id", filter.dealer_id);
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
    "ディーラーID", "日時", "ユーザー", "ロール", "アクション",
    "リソース種別", "リソースID", "変更前", "変更後", "IP",
  ].join(",");

  const csvRows = rows.map((row) => {
    const dt = new Date(row.created_at);
    const dateStr = `${dt.getFullYear()}/${String(dt.getMonth() + 1).padStart(2, "0")}/${String(dt.getDate()).padStart(2, "0")} ${String(dt.getHours()).padStart(2, "0")}:${String(dt.getMinutes()).padStart(2, "0")}`;

    return [
      escapeCsv(row.dealer_id),
      escapeCsv(dateStr),
      escapeCsv(row.actor_email ?? row.actor_user_id?.slice(0, 8) ?? ""),
      escapeCsv(row.actor_role ?? ""),
      escapeCsv(auditActionLabel(row.action as AuditAction)),
      escapeCsv(auditResourceTypeLabel(row.resource_type)),
      escapeCsv(row.resource_id ?? ""),
      escapeCsv(row.old_value ? JSON.stringify(row.old_value) : ""),
      escapeCsv(row.new_value ? JSON.stringify(row.new_value) : ""),
      escapeCsv(row.ip_address ?? ""),
    ].join(",");
  });

  const csv = [header, ...csvRows].join("\r\n");

  const now = new Date();
  const filename = `audit-log-admin-${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, "0")}${String(now.getDate()).padStart(2, "0")}.csv`;

  return { csv, filename };
}
