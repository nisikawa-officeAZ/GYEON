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
  OcrRunMeta,
} from "./vehicle-registration-types";
import { estimateCostUsd } from "@/lib/ai/ai-pricing";
import {
  uploadVehicleRegistrationImage,
  archiveVehicleRegistrationFile,
  VEHICLE_REG_BUCKET,
} from "./storage";
import { analyzeVehicleRegistrationImage } from "./ocr";
import { isGyeonManagedKeyConfigured } from "@/lib/ai/gyeon-managed-key";
import { logAiUsage } from "@/lib/ai/log-ai-usage";
import sharp from "sharp";
import heicConvert from "heic-convert";
import { createAuditLog }    from "@/lib/audit/audit";
import {
  createOcrSession,
  linkFileToOcrSession,
} from "@/lib/ocr/ocr-session-actions";

const MAX_FILE_SIZE = 20 * 1024 * 1024; // 20 MB — matches next.config.ts bodySizeLimit
const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp", "application/pdf"]; // E9.1: PDF support

// HEIC/HEIF (iPhone default). Accepted then converted server-side to JPEG via sharp.
// iOS often reports an empty or "image/heic" MIME, so we also match by extension.
const HEIC_RE = /\.(heic|heif)$/i;
function isHeicFile(name: string, type: string): boolean {
  return HEIC_RE.test(name) || /image\/(heic|heif)/i.test(type);
}
function isAcceptedFile(name: string, type: string): boolean {
  return ALLOWED_TYPES.includes(type) || isHeicFile(name, type);
}

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

  // Step 3: verify the GYEON-managed OpenAI key is configured before any file work.
  // OCR is a GYEON-managed feature — the key is resolved server-side (AI Center DB
  // key first, OPENAI_API_KEY env fallback), never from the dealer.
  // See docs/AI_API_OWNERSHIP_POLICY.md.
  if (!(await isGyeonManagedKeyConfigured())) {
    console.error("[OCR] Config step 3 failed: no GYEON-managed OpenAI key (AI Center DB nor env).");
    return { success: false, error: "OpenAI APIキーが登録されていません。Super AdminのAIセンターから設定してください。" };
  }
  console.log("[OCR] Config step 3 passed — GYEON-managed OpenAI key present.");

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
  if (!isAcceptedFile(file.name, file.type)) {
    console.error("[OCR] File validation failed: unsupported type:", file.type, file.name);
    return { success: false, error: "対応形式は JPEG / PNG / WebP / HEIC / PDF です。" };
  }
  console.log("[OCR] File validated — name:", file.name, "size:", file.size, "type:", file.type);

  const supabase = await createClient();

  // Effective buffer/type/name. Images are ALWAYS preprocessed before OCR (never
  // the raw camera frame): HEIC/HEIF is decoded, EXIF-rotated, contrast-normalized,
  // brightness-lifted and sharpened → JPEG. PDFs pass through untouched.
  let fileBuffer: ArrayBuffer = await file.arrayBuffer();
  let effectiveType = file.type || "application/octet-stream";
  let effectiveName = file.name;

  const heic        = isHeicFile(file.name, file.type);
  const isImageInput = heic || effectiveType.startsWith("image/");

  if (isImageInput) {
    // HEIC/HEIF: the installed sharp/libvips build cannot decode HEVC-HEIC (its
    // libheif exposes AVIF input only), and non-Safari browsers upload HEIC
    // unchanged. So decode HEIC → JPEG server-side with heic-convert (pure-JS /
    // libheif-js WASM — no system HEVC codec required) FIRST, then feed the JPEG
    // into the SAME sharp enhancement pipeline. JPEG / PNG / WebP skip this step
    // and go straight into sharp exactly as before (behavior unchanged).
    let sharpInput: Buffer = Buffer.from(fileBuffer);
    if (heic) {
      try {
        const decoded = await heicConvert({
          buffer: new Uint8Array(fileBuffer),
          format: "JPEG",
          quality: 0.92,
        });
        sharpInput = Buffer.from(decoded);
        console.log("[OCR] HEIC→JPEG decoded via heic-convert →", decoded.length, "bytes");
      } catch (err) {
        // Log technical details server-side only; return a clear, safe message.
        console.error("[OCR] HEIC→JPEG conversion (heic-convert) failed:", err);
        return {
          success: false,
          error: "HEIC画像の変換に失敗しました。再度お試しいただくか、別の形式（JPEG等）で撮影してください。",
        };
      }
    }

    try {
      const out = await sharp(sharpInput)
        .rotate()                        // auto-orient from EXIF
        .normalize()                     // stretch contrast (document legibility)
        .modulate({ brightness: 1.05 })  // slight brightness lift
        .sharpen()                       // crisp text edges
        .jpeg({ quality: 90 })
        .toBuffer();
      fileBuffer    = new Uint8Array(out).buffer; // fresh ArrayBuffer of exact length
      effectiveType = "image/jpeg";
      effectiveName = file.name.replace(/\.[^.]+$/i, ".jpg");
      console.log("[OCR] Image preprocessed for OCR",
        heic ? "(HEIC→JPEG + enhance)" : "(enhance)", `→ ${out.length} bytes`);
    } catch (err) {
      console.error("[OCR] Image enhancement (sharp) failed:", err);
      if (heic) {
        // HEIC is already a valid JPEG from heic-convert — enhancement is optional,
        // so fall back to the un-enhanced JPEG rather than failing the upload.
        fileBuffer    = new Uint8Array(sharpInput).buffer;
        effectiveType = "image/jpeg";
        effectiveName = file.name.replace(/\.[^.]+$/i, ".jpg");
        console.warn("[OCR] Using un-enhanced HEIC-decoded JPEG (sharp enhance skipped).");
      }
      // Non-HEIC image: fall back to the original buffer (still a valid JPEG/PNG/WebP).
    }
  }
  const effectiveSize = fileBuffer.byteLength;

  // 1. Upload to storage (converted JPEG for HEIC; original otherwise)
  const uploadResult = await uploadVehicleRegistrationImage(
    fileBuffer,
    effectiveName,
    effectiveType,
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
      file_name:      effectiveName,
      file_size:      effectiveSize,
      mime_type:      effectiveType,
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
  const ocrStartedAt = Date.now();
  const ocrResponse  = await analyzeVehicleRegistrationImage(imageBase64, effectiveType);
  const ocrResponseMs = Date.now() - ocrStartedAt;

  let ocrResult: VehicleRegistrationOcrResult  = {};
  let ocrStatus: string                         = "failed";
  let ocrProvider: string | null               = null;
  let ocrModel: string | null                  = null;
  let ocrConfidence: number | null             = null;
  let ocrError: string | null                  = null;
  let ocrInputTokens:  number | null           = null;
  let ocrOutputTokens: number | null           = null;
  let ocrTotalTokens:  number | null           = null;
  let ocrPromptVersion: string | null          = null;
  let ocrQuality: OcrRunMeta["quality"]        = null;

  if ("error" in ocrResponse) {
    ocrError = ocrResponse.error;
    console.error("[OCR] AI analysis failed:", ocrError);
  } else {
    ocrResult       = ocrResponse.result;
    ocrStatus       = "completed";
    ocrProvider     = ocrResponse.provider;
    ocrModel        = ocrResponse.model;
    ocrConfidence   = ocrResult.confidence ?? null;
    ocrInputTokens  = ocrResponse.usage.input;
    ocrOutputTokens = ocrResponse.usage.output;
    ocrTotalTokens  = ocrResponse.usage.total;
    ocrPromptVersion = ocrResponse.promptVersion;
    ocrQuality       = ocrResponse.quality;
    console.log("[OCR] AI analysis succeeded — model:", ocrModel, "promptVersion:", ocrPromptVersion,
      "confidence:", ocrConfidence, "needsManual:", ocrQuality?.needsManualCorrection);
  }

  // Estimated cost (USD) for this run — best-effort; null when model/tokens unknown
  const ocrEstimatedCost = estimateCostUsd(ocrModel, ocrInputTokens, ocrOutputTokens);

  // Execution metadata (additive; surfaced to operators so they don't run SQL)
  const ocrMeta: OcrRunMeta = {
    provider:         ocrProvider ?? "openai",
    model:            ocrModel,
    inputTokens:      ocrInputTokens,
    outputTokens:     ocrOutputTokens,
    totalTokens:      ocrTotalTokens,
    responseMs:       ocrResponseMs,
    estimatedCostUsd: ocrEstimatedCost,
    promptVersion:    ocrPromptVersion,
    quality:          ocrQuality,
  };

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

  // AI usage log — one row per OCR attempt (success or failure). Best-effort.
  // Log label is "vehicle_ocr" (the AI Center usage summary filters on this).
  await logAiUsage({
    featureKey:   "vehicle_ocr",
    dealerId:     dealer.dealer_id,
    usedBy:       user.id,
    model:        ocrModel,
    inputTokens:  ocrInputTokens,
    outputTokens: ocrOutputTokens,
    totalTokens:  ocrTotalTokens,
    status:       ocrError ? "failed" : "success",
    errorCode:    ocrError,
    estimatedCost: ocrEstimatedCost,
    responseMs:   ocrResponseMs,
  });

  if (ocrError) {
    const OCR_ERROR_MESSAGES: Record<string, string> = {
      OPENAI_API_KEY_MISSING: "OpenAI APIキーが登録されていません。Super AdminのAIセンターから設定してください。",
      TIMEOUT:                "AI解析がタイムアウトしました。再試行してください。",
      CONNECT_ERROR:          "AI解析サービスに接続できませんでした。通信環境を確認してください。",
      OPENAI_AUTH_ERROR:      "AI解析キーが無効です。管理者にお問い合わせください。",
      OPENAI_RATE_LIMIT:      "AI解析の利用制限に達しました。しばらく待ってから再試行してください。",
      OPENAI_SERVER_ERROR:    "AI解析サービスが一時的に利用できません。再試行してください。",
      EMPTY_RESPONSE:         "車検証画像を読み取れませんでした。鮮明な画像で再試行してください。",
      PARSE_ERROR:            "OCR解析に失敗しました。画像が鮮明かどうか確認してください。",
    };
    const msg = OCR_ERROR_MESSAGES[ocrError] ?? "OCR解析に失敗しました。再試行してください。";
    return { success: false, error: msg, errorCode: ocrError };
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

  return { success: true, file: finalRow, ocrResult, sessionId, sessionPersisted, ocrMeta };
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
