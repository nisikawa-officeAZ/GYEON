"use server";

// PHASE67: Vehicle Registration Server Actions
// Flow:
//   1. Upload image to private bucket
//   2. Insert vehicle_registration_files row (pending)
//   3. Analyze with GPT-4o-mini vision
//   4. Update row with ocr_result (completed/failed)
//   5. Return result to UI
//   6. User reviews and confirms
//   7. On confirmation, mark row as confirmed + update audit

import { createClient }     from "@/lib/supabase/server";
import { getCurrentDealer } from "@/lib/auth/get-current-dealer";
import { getCurrentUser }   from "@/lib/auth/get-current-user";
import {
  VehicleRegistrationFile,
  VehicleRegistrationOcrResult,
  ConfirmOcrResultParams,
  UploadResult,
} from "./vehicle-registration-types";
import {
  uploadVehicleRegistrationImage,
  archiveVehicleRegistrationFile,
  VEHICLE_REG_BUCKET,
} from "./storage";
import { analyzeVehicleRegistrationImage } from "./ocr";
import { createAuditLog }    from "@/lib/audit/audit";
import {
  createOcrSession,
  linkFileToOcrSession,
} from "@/lib/ocr/ocr-session-actions";

const MAX_FILE_SIZE = 20 * 1024 * 1024; // 20 MB — matches next.config.ts bodySizeLimit
const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp"];

// ─── Upload + Analyze ─────────────────────────────────────────────────────────

export async function uploadAndAnalyzeVehicleRegistration(
  formData: FormData,
): Promise<UploadResult> {
  // Step 1: verify user session (Supabase cookie must be present)
  const user = await getCurrentUser();
  if (!user) {
    console.error("[OCR] Auth step 1 failed: no authenticated user — session cookie missing or expired. " +
      "On local network (iPhone), the user must log in from the device browser; " +
      "desktop localhost cookies are not shared with the device IP.");
    return { success: false, error: "ログインが必要です。ブラウザでログインし直してください。" };
  }
  console.log("[OCR] Auth step 1 passed — user:", user.id);

  // Step 2: resolve dealer membership
  const dealer = await getCurrentDealer();
  if (!dealer) {
    console.error("[OCR] Auth step 2 failed: no active dealer_members record for user:", user.id,
      "— user exists but has no dealer association or status is not 'active'.");
    return { success: false, error: "店舗情報を取得できません。管理者にお問い合わせください。" };
  }
  console.log("[OCR] Auth step 2 passed — dealer:", dealer.dealer_id, "role:", dealer.role);

  // Step 3: verify OpenAI API key is configured before doing any file work
  if (!process.env.OPENAI_API_KEY) {
    console.error("[OCR] Config step 3 failed: OPENAI_API_KEY is not set in environment.");
    return { success: false, error: "AI解析キーが設定されていません。管理者にお問い合わせください。" };
  }
  console.log("[OCR] Config step 3 passed — OpenAI key present.");

  const file        = formData.get("file") as File | null;
  const customerId  = (formData.get("customer_id")  as string | null) || null;
  const vehicleId   = (formData.get("vehicle_id")   as string | null) || null;
  const estimateId  = (formData.get("estimate_id")  as string | null) || null;

  if (!file || file.size === 0) {
    console.error("[OCR] File validation failed: no file or empty file");
    return { success: false, error: "ファイルを選択してください" };
  }
  if (file.size > MAX_FILE_SIZE) {
    console.error("[OCR] File validation failed: size", file.size, "exceeds", MAX_FILE_SIZE);
    return { success: false, error: "ファイルサイズは20MB以下にしてください" };
  }
  if (!ALLOWED_TYPES.includes(file.type)) {
    console.error("[OCR] File validation failed: unsupported type:", file.type);
    return { success: false, error: "対応形式はJPEG、PNG、WebPのみです" };
  }
  console.log("[OCR] File validated — name:", file.name, "size:", file.size, "type:", file.type);

  const supabase = await createClient();
  const fileBuffer = await file.arrayBuffer();

  // 1. Upload to storage
  const uploadResult = await uploadVehicleRegistrationImage(
    fileBuffer,
    file.name,
    file.type,
    customerId,
    vehicleId,
  );

  if (!uploadResult.success || !uploadResult.storagePath) {
    const err = uploadResult.error ?? "アップロードに失敗しました";
    console.error("[OCR] Storage upload failed:", err);
    const isBucketMissing =
      err.includes("Bucket not found") ||
      err.includes("bucket") ||
      err.includes("does not exist");
    return {
      success: false,
      error: isBucketMissing
        ? "ストレージバケットが未作成です。管理者に VEHICLE_REGISTRATION_STORAGE_SETUP.md を確認するよう依頼してください。"
        : "OCRサーバー処理に失敗しました（ストレージエラー）",
    };
  }
  console.log("[OCR] Storage upload succeeded — path:", uploadResult.storagePath);

  const storagePath = uploadResult.storagePath;

  // 2. Insert DB row — if table doesn't exist yet, fail gracefully
  const { data: insertData, error: insertError } = await supabase
    .from("vehicle_registration_files")
    .insert({
      dealer_id:      dealer.dealer_id,
      customer_id:    customerId,
      vehicle_id:     vehicleId,
      estimate_id:    estimateId,
      storage_bucket: VEHICLE_REG_BUCKET,
      storage_path:   storagePath,
      file_name:      file.name,
      file_size:      file.size,
      mime_type:      file.type,
      ocr_status:     "processing",
      uploaded_by:    user?.id ?? null,
    })
    .select()
    .single();

  if (insertError || !insertData) {
    console.error("[actions] insert error:", insertError?.message);
    // Table not applied yet → user-friendly guidance
    const isTableMissing =
      insertError?.message?.includes("does not exist") ||
      insertError?.code === "42P01";
    // Clean up storage regardless
    const supabase2 = await createClient();
    await supabase2.storage.from(VEHICLE_REG_BUCKET).remove([storagePath]).catch(() => null);
    return {
      success: false,
      error: isTableMissing
        ? "DBテーブルが未適用です。マイグレーション 067_vehicle_registration_ocr.sql を Supabase SQL Editor で実行してください。"
        : "データベース登録に失敗しました",
    };
  }

  const fileRow = insertData as VehicleRegistrationFile;

  // Log upload event
  await createAuditLog({
    action:        "create",
    resource_type: "vehicle_registration",
    resource_id:   fileRow.id,
    new_value:     { storage_path: storagePath, customer_id: customerId, vehicle_id: vehicleId },
  } as Parameters<typeof createAuditLog>[0]);

  // 3. Analyze with GPT-4o-mini
  const imageBase64  = Buffer.from(fileBuffer).toString("base64");
  const ocrResponse  = await analyzeVehicleRegistrationImage(imageBase64, file.type);

  let ocrResult: VehicleRegistrationOcrResult  = {};
  let ocrStatus: string                         = "failed";
  let ocrProvider: string | null               = null;
  let ocrModel: string | null                  = null;
  let ocrConfidence: number | null             = null;
  let ocrError: string | null                  = null;

  if ("error" in ocrResponse) {
    ocrError = ocrResponse.error;
    console.error("[OCR] AI analysis failed:", ocrError);
  } else {
    ocrResult     = ocrResponse.result;
    ocrStatus     = "completed";
    ocrProvider   = ocrResponse.provider;
    ocrModel      = ocrResponse.model;
    ocrConfidence = ocrResult.confidence ?? null;
    console.log("[OCR] AI analysis succeeded — model:", ocrModel, "confidence:", ocrConfidence);
  }

  // 4. Update DB row with OCR result
  const { data: updatedData, error: updateError } = await supabase
    .from("vehicle_registration_files")
    .update({
      ocr_status:    ocrStatus,
      ocr_result:    ocrResult,
      ocr_provider:  ocrProvider,
      ocr_model:     ocrModel,
      ocr_confidence: ocrConfidence,
    })
    .eq("id",        fileRow.id)
    .eq("dealer_id", dealer.dealer_id)
    .select()
    .single();

  if (updateError) {
    console.error("[actions] update error:", updateError.message);
  }

  // Log OCR outcome
  await createAuditLog({
    action:        "update",
    resource_type: "vehicle_registration",
    resource_id:   fileRow.id,
    new_value:     { ocr_status: ocrStatus, ocr_model: ocrModel, confidence: ocrConfidence },
  } as Parameters<typeof createAuditLog>[0]);

  if (ocrError) {
    if (ocrError === "OPENAI_API_KEY_MISSING") {
      return { success: false, error: "AI解析キーが設定されていません。管理者にお問い合わせください。" };
    }
    return { success: false, error: "OCRサーバー処理に失敗しました。画像を確認して再試行してください。" };
  }

  const finalRow = (updatedData ?? fileRow) as VehicleRegistrationFile;

  // Non-blocking OCR session creation — doesn't affect the upload result.
  // If migration 068_ocr_sessions.sql has not been applied, these calls
  // return descriptive errors and are silently ignored here.
  let sessionId: string | undefined = undefined;
  let sessionPersisted = false;
  try {
    const sessionResult = await createOcrSession({
      customer_id: customerId ?? undefined,
      vehicle_id:  vehicleId  ?? undefined,
    });
    if (sessionResult.success) {
      sessionId = sessionResult.sessionId;
      const linkResult = await linkFileToOcrSession(sessionResult.sessionId, finalRow.id, true);
      sessionPersisted = linkResult.success;
    }
  } catch {
    // Session persistence is optional — upload flow completes regardless
  }

  return { success: true, file: finalRow, ocrResult, sessionId, sessionPersisted };
}

// ─── Confirm OCR result ───────────────────────────────────────────────────────

export async function confirmVehicleRegistrationOcr(
  params: ConfirmOcrResultParams,
): Promise<{ success: boolean; error?: string }> {
  const user = await getCurrentUser();
  if (!user) {
    console.error("[OCR:confirm] Auth failed: no authenticated user");
    return { success: false, error: "ログインが必要です。ブラウザでログインし直してください。" };
  }
  const dealer = await getCurrentDealer();
  if (!dealer) {
    console.error("[OCR:confirm] Auth failed: no dealer membership for user:", user.id);
    return { success: false, error: "店舗情報を取得できません。管理者にお問い合わせください。" };
  }

  const supabase = await createClient();

  const { error } = await supabase
    .from("vehicle_registration_files")
    .update({
      ocr_status:   "confirmed",
      confirmed:     true,
      confirmed_by:  user?.id ?? null,
      confirmed_at:  new Date().toISOString(),
    })
    .eq("id",        params.fileId)
    .eq("dealer_id", dealer.dealer_id);

  if (error) {
    console.error("[actions] confirm error:", error.message);
    return { success: false, error: "確認の保存に失敗しました" };
  }

  await createAuditLog({
    action:        "update",
    resource_type: "vehicle_registration",
    resource_id:   params.fileId,
    new_value:     {
      confirmed:    true,
      customer_id:  params.customerId ?? null,
      vehicle_id:   params.vehicleId  ?? null,
      estimate_id:  params.estimateId ?? null,
      fields_applied: params.fieldsToApply,
    },
  } as Parameters<typeof createAuditLog>[0]);

  return { success: true };
}

// ─── Query helpers ────────────────────────────────────────────────────────────

export async function getVehicleRegistrationFilesByCustomer(
  customerId: string,
): Promise<VehicleRegistrationFile[]> {
  try {
    const dealer = await getCurrentDealer();
    if (!dealer) return [];

    const supabase = await createClient();

    const { data, error } = await supabase
      .from("vehicle_registration_files")
      .select("*")
      .eq("dealer_id",   dealer.dealer_id)
      .eq("customer_id", customerId)
      .is("archived_at", null)
      .order("created_at", { ascending: false })
      .limit(20);

    if (error) {
      console.error("[actions] getByCustomer error:", error.message);
      return [];
    }

    return (data ?? []) as VehicleRegistrationFile[];
  } catch {
    return [];
  }
}

export async function getVehicleRegistrationFilesByVehicle(
  vehicleId: string,
): Promise<VehicleRegistrationFile[]> {
  try {
    const dealer = await getCurrentDealer();
    if (!dealer) return [];

    const supabase = await createClient();

    const { data, error } = await supabase
      .from("vehicle_registration_files")
      .select("*")
      .eq("dealer_id",  dealer.dealer_id)
      .eq("vehicle_id", vehicleId)
      .is("archived_at", null)
      .order("created_at", { ascending: false })
      .limit(20);

    if (error) {
      console.error("[actions] getByVehicle error:", error.message);
      return [];
    }

    return (data ?? []) as VehicleRegistrationFile[];
  } catch {
    return [];
  }
}

export async function getVehicleRegistrationFilesByEstimate(
  estimateId: string,
): Promise<VehicleRegistrationFile[]> {
  try {
    const dealer = await getCurrentDealer();
    if (!dealer) return [];

    const supabase = await createClient();

    const { data, error } = await supabase
      .from("vehicle_registration_files")
      .select("*")
      .eq("dealer_id",   dealer.dealer_id)
      .eq("estimate_id", estimateId)
      .is("archived_at", null)
      .order("created_at", { ascending: false })
      .limit(20);

    if (error) {
      console.error("[actions] getByEstimate error:", error.message);
      return [];
    }

    return (data ?? []) as VehicleRegistrationFile[];
  } catch {
    return [];
  }
}

// ─── Archive ──────────────────────────────────────────────────────────────────

export async function archiveVehicleRegistration(
  fileId: string,
): Promise<{ success: boolean; error?: string }> {
  try {
    const user = await getCurrentUser();
    if (!user) {
      console.error("[OCR:archive] Auth failed: no authenticated user");
      return { success: false, error: "ログインが必要です。ブラウザでログインし直してください。" };
    }
    const dealer = await getCurrentDealer();
    if (!dealer) {
      console.error("[OCR:archive] Auth failed: no dealer membership for user:", user.id);
      return { success: false, error: "店舗情報を取得できません。管理者にお問い合わせください。" };
    }

    const supabase = await createClient();

    // Fetch the row to get storage path
    const { data: row, error: fetchError } = await supabase
      .from("vehicle_registration_files")
      .select("storage_path")
      .eq("id",        fileId)
      .eq("dealer_id", dealer.dealer_id)
      .single();

    if (fetchError || !row) {
      return { success: false, error: "ファイルが見つかりません" };
    }

    // Archive in storage
    await archiveVehicleRegistrationFile(row.storage_path);

    // Mark as archived in DB
    await supabase
      .from("vehicle_registration_files")
      .update({ ocr_status: "archived", archived_at: new Date().toISOString() })
      .eq("id",        fileId)
      .eq("dealer_id", dealer.dealer_id);

    await createAuditLog({
      action:        "archive",
      resource_type: "vehicle_registration",
      resource_id:   fileId,
    } as Parameters<typeof createAuditLog>[0]);

    return { success: true };
  } catch (err) {
    console.error("[actions] archive error:", err);
    return { success: false, error: "アーカイブに失敗しました" };
  }
}
