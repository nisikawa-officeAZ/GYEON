"use server";

// GYEON Resource Center — admin management (upload / CRUD / publish / archive).
//
// Security:
//   - requireAdmin() + role check (super_admin / gyeon_admin).
//   - Service-role client for writes (consistent with other admin actions).
//   - Storage paths are server-generated; created_by is the admin id.

import { revalidatePath }    from "next/cache";
import { createClient }      from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireAdmin }      from "@/lib/admin/require-admin";
import {
  RESOURCE_BUCKET, RESOURCE_CATEGORIES,
  type GyeonResource, type ResourceCategory, type ResourceStatus,
} from "./resource-types";

const MANAGE_ROLES = ["super_admin", "gyeon_admin"];
const MAX_FILE_SIZE = 100 * 1024 * 1024; // 100 MB

async function requireResourceManager() {
  const admin = await requireAdmin();
  if (!MANAGE_ROLES.includes(admin.role)) {
    throw new Error("リソース管理の権限がありません");
  }
  return admin;
}

/** All resources (incl. drafts) for the admin console. */
export async function getResourcesForAdmin(): Promise<GyeonResource[]> {
  await requireResourceManager();
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("gyeon_resources")
    .select("*")
    .order("created_at", { ascending: false });
  if (error) {
    console.error("[getResourcesForAdmin] error:", error.message);
    return [];
  }
  return (data ?? []) as GyeonResource[];
}

/** Upload a resource file to the private gyeon-resources bucket. */
export async function uploadResourceFile(
  formData: FormData,
): Promise<{ path: string; name: string; type: string; size: number } | { error: string }> {
  try {
    await requireResourceManager();

    const file = formData.get("file") as File | null;
    if (!file || file.size === 0) return { error: "ファイルが必要です" };
    if (file.size > MAX_FILE_SIZE) return { error: "ファイルサイズは100MB以下にしてください" };

    const supabase = createAdminClient();

    // Server-generated path: {category-or-misc}/{uuid}_{filename}
    const category = ((formData.get("category") as string | null)?.trim() || "misc")
      .replace(/[^a-z_]/gi, "");
    const safeName = file.name.replace(/[^\w.\-]/g, "_");
    const uid      = crypto.randomUUID().replace(/-/g, "").slice(0, 8);
    const path     = `${category}/${uid}_${safeName}`;

    const buffer = await file.arrayBuffer();
    const { error } = await supabase.storage
      .from(RESOURCE_BUCKET)
      .upload(path, buffer, {
        contentType: file.type || "application/octet-stream",
        upsert: false,
      });

    if (error) {
      console.error("[uploadResourceFile] storage error:", error.message);
      return { error: `アップロードに失敗しました: ${error.message}` };
    }

    return { path, name: file.name, type: file.type || "application/octet-stream", size: file.size };
  } catch (err) {
    return { error: err instanceof Error ? err.message : "アップロードに失敗しました" };
  }
}

export interface ResourceInput {
  category:     ResourceCategory;
  title:        string;
  description:  string | null;
  file_path:    string | null;
  file_name:    string | null;
  file_type:    string | null;
  file_size:    number | null;
  youtube_url:  string | null;
  external_url: string | null;
  product_id:   string | null;
  version:      string | null;
  status:       ResourceStatus;
}

function sanitize(input: ResourceInput) {
  const category: ResourceCategory =
    RESOURCE_CATEGORIES.includes(input.category) ? input.category : "catalog";
  const status: ResourceStatus =
    input.status === "published" || input.status === "archived" ? input.status : "draft";
  const clean = (v: string | null) => (v && v.trim() ? v.trim() : null);
  return {
    category,
    title:        input.title?.trim() || "",
    description:  clean(input.description),
    file_path:    clean(input.file_path),
    file_name:    clean(input.file_name),
    file_type:    clean(input.file_type),
    file_size:    typeof input.file_size === "number" && input.file_size > 0 ? input.file_size : null,
    youtube_url:  clean(input.youtube_url),
    external_url: clean(input.external_url),
    product_id:   clean(input.product_id),
    version:      clean(input.version),
    status,
  };
}

export async function createResource(input: ResourceInput): Promise<{ id: string } | { error: string }> {
  try {
    const admin = await requireResourceManager();
    const payload = sanitize(input);
    if (!payload.title) return { error: "タイトルは必須です" };

    const supabase = createAdminClient();
    const { data, error } = await supabase
      .from("gyeon_resources")
      .insert({ ...payload, created_by: admin.id })
      .select("id")
      .single();
    if (error) return { error: error.message };
    revalidatePath("/admin/resources");
    revalidatePath("/downloads");
    return { id: (data as { id: string }).id };
  } catch (err) {
    return { error: err instanceof Error ? err.message : "作成に失敗しました" };
  }
}

export async function updateResource(id: string, input: ResourceInput): Promise<{ success: true } | { error: string }> {
  try {
    await requireResourceManager();
    const payload = sanitize(input);
    if (!payload.title) return { error: "タイトルは必須です" };

    const supabase = createAdminClient();
    const { error } = await supabase
      .from("gyeon_resources")
      .update({ ...payload, updated_at: new Date().toISOString() })
      .eq("id", id);
    if (error) return { error: error.message };
    revalidatePath("/admin/resources");
    revalidatePath("/downloads");
    return { success: true };
  } catch (err) {
    return { error: err instanceof Error ? err.message : "更新に失敗しました" };
  }
}

export async function setResourceStatus(
  id: string, status: ResourceStatus,
): Promise<{ success: true } | { error: string }> {
  try {
    await requireResourceManager();
    const supabase = createAdminClient();
    const { error } = await supabase
      .from("gyeon_resources")
      .update({ status, updated_at: new Date().toISOString() })
      .eq("id", id);
    if (error) return { error: error.message };
    revalidatePath("/admin/resources");
    revalidatePath("/downloads");
    return { success: true };
  } catch (err) {
    return { error: err instanceof Error ? err.message : "更新に失敗しました" };
  }
}

export async function deleteResource(id: string): Promise<{ success: true } | { error: string }> {
  try {
    await requireResourceManager();
    const supabase = createAdminClient();
    // Best-effort: remove the stored file too.
    const { data: row } = await supabase
      .from("gyeon_resources").select("file_path").eq("id", id).maybeSingle();
    const path = (row as { file_path: string | null } | null)?.file_path;
    if (path) await supabase.storage.from(RESOURCE_BUCKET).remove([path]);

    const { error } = await supabase.from("gyeon_resources").delete().eq("id", id);
    if (error) return { error: error.message };
    revalidatePath("/admin/resources");
    revalidatePath("/downloads");
    return { success: true };
  } catch (err) {
    return { error: err instanceof Error ? err.message : "削除に失敗しました" };
  }
}
