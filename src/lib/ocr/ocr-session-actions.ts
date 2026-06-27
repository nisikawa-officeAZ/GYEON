"use server";

// RC-02: OCR Session Server Actions
//
// All operations are dealer-scoped via getCurrentDealer().
// dealer_id is NEVER accepted from client input.
//
// Graceful degradation: if migration 068_ocr_sessions.sql has not been applied,
// actions return a descriptive error rather than throwing.

import { createClient }     from "@/lib/supabase/server";
import { getCurrentDealer } from "@/lib/auth/get-current-dealer";
import { getCurrentUser }   from "@/lib/auth/get-current-user";
import type {
  OcrSession,
  OcrSessionResult,
  OcrSessionMutationResult,
  CreateOcrSessionParams,
  UpdateOcrSessionParams,
  CompleteOcrSessionParams,
} from "./ocr-session-types";

// ─── Internal helpers ─────────────────────────────────────────────────────────

function tableMissingError(label: string): OcrSessionMutationResult {
  return {
    success: false,
    error: `${label}テーブルが未適用です。マイグレーション 068_ocr_sessions.sql を Supabase SQL Editor で実行してください。`,
  };
}

function columnMissingError(): OcrSessionMutationResult {
  return {
    success: false,
    error: "session_idカラムが未適用です。マイグレーション 068_ocr_sessions.sql を Supabase SQL Editor で実行してください。",
  };
}

function isTableMissing(err: { message?: string; code?: string } | null): boolean {
  return !!(
    err?.code === "42P01" ||
    (err?.message?.includes("does not exist") && !err.message.includes("column"))
  );
}

// Catches ALTER TABLE column-not-yet-added (migration 068 ALTER TABLE not applied)
function isColumnMissing(err: { message?: string; code?: string } | null): boolean {
  return !!(
    err?.code === "42703" ||
    err?.code === "PGRST204" ||
    (err?.message?.includes("does not exist") && err.message.includes("column")) ||
    (err?.message?.includes("Column") && err.message.includes("does not exist"))
  );
}

// ─── Create session ───────────────────────────────────────────────────────────

export async function createOcrSession(
  params: CreateOcrSessionParams = {},
): Promise<OcrSessionResult> {
  const dealer = await getCurrentDealer();
  if (!dealer) return { success: false, error: "認証エラー" };

  const user = await getCurrentUser();
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("vehicle_registration_ocr_sessions")
    .insert({
      dealer_id:   dealer.dealer_id,
      status:      "draft",
      customer_id: params.customer_id ?? null,
      vehicle_id:  params.vehicle_id  ?? null,
      started_by:  user?.id           ?? null,
    })
    .select("id")
    .single();

  if (error || !data) {
    if (isTableMissing(error)) return tableMissingError("OCRセッション") as OcrSessionResult;
    return { success: false, error: "OCRセッションの作成に失敗しました" };
  }

  return { success: true, sessionId: data.id };
}

// ─── Update session ───────────────────────────────────────────────────────────

export async function updateOcrSession(
  params: UpdateOcrSessionParams,
): Promise<OcrSessionMutationResult> {
  const dealer = await getCurrentDealer();
  if (!dealer) return { success: false, error: "認証エラー" };

  const supabase = await createClient();

  const updates: Record<string, unknown> = {};
  if (params.status          !== undefined) updates.status          = params.status;
  if (params.primary_file_id !== undefined) updates.primary_file_id = params.primary_file_id;
  if (params.reviewed_result !== undefined) updates.reviewed_result = params.reviewed_result;
  if (params.customer_id     !== undefined) updates.customer_id     = params.customer_id;
  if (params.vehicle_id      !== undefined) updates.vehicle_id      = params.vehicle_id;

  const { error } = await supabase
    .from("vehicle_registration_ocr_sessions")
    .update(updates)
    .eq("id",        params.session_id)
    .eq("dealer_id", dealer.dealer_id);

  if (error) {
    if (isTableMissing(error)) return tableMissingError("OCRセッション");
    return { success: false, error: "OCRセッションの更新に失敗しました" };
  }

  return { success: true };
}

// ─── Complete session ─────────────────────────────────────────────────────────

export async function completeOcrSession(
  params: CompleteOcrSessionParams,
): Promise<OcrSessionMutationResult> {
  const dealer = await getCurrentDealer();
  if (!dealer) return { success: false, error: "認証エラー" };

  const user = await getCurrentUser();
  const now  = new Date().toISOString();
  const supabase = await createClient();

  const updates: Record<string, unknown> = {
    status:          "completed",
    reviewed_result: params.reviewed_result,
    completed_by:    user?.id ?? null,
    completed_at:    now,
  };
  if (params.customer_id !== undefined) updates.customer_id = params.customer_id;
  if (params.vehicle_id  !== undefined) updates.vehicle_id  = params.vehicle_id;

  const { error } = await supabase
    .from("vehicle_registration_ocr_sessions")
    .update(updates)
    .eq("id",        params.session_id)
    .eq("dealer_id", dealer.dealer_id);

  if (error) {
    if (isTableMissing(error)) return tableMissingError("OCRセッション");
    return { success: false, error: "OCRセッションの完了に失敗しました" };
  }

  return { success: true };
}

// ─── Abandon session ──────────────────────────────────────────────────────────

export async function abandonOcrSession(
  sessionId: string,
): Promise<OcrSessionMutationResult> {
  const dealer = await getCurrentDealer();
  if (!dealer) return { success: false, error: "認証エラー" };

  const supabase = await createClient();

  const { error } = await supabase
    .from("vehicle_registration_ocr_sessions")
    .update({ status: "abandoned" })
    .eq("id",        sessionId)
    .eq("dealer_id", dealer.dealer_id);

  if (error) {
    if (isTableMissing(error)) return tableMissingError("OCRセッション");
    return { success: false, error: "OCRセッションの更新に失敗しました" };
  }

  return { success: true };
}

// ─── Link file to session ─────────────────────────────────────────────────────

export async function linkFileToOcrSession(
  sessionId: string,
  fileId:    string,
  isPrimary: boolean = true,
): Promise<OcrSessionMutationResult> {
  const dealer = await getCurrentDealer();
  if (!dealer) return { success: false, error: "認証エラー" };

  const supabase = await createClient();

  const { error: fileError } = await supabase
    .from("vehicle_registration_files")
    .update({ session_id: sessionId })
    .eq("id",        fileId)
    .eq("dealer_id", dealer.dealer_id);

  if (fileError) {
    if (isColumnMissing(fileError)) return columnMissingError();
    if (isTableMissing(fileError))  return tableMissingError("ファイル");
    return { success: false, error: "ファイルとセッションのリンクに失敗しました" };
  }

  if (isPrimary) {
    const { error: sessionError } = await supabase
      .from("vehicle_registration_ocr_sessions")
      .update({ primary_file_id: fileId, status: "reviewing" })
      .eq("id",        sessionId)
      .eq("dealer_id", dealer.dealer_id);

    if (sessionError) {
      if (isTableMissing(sessionError)) return tableMissingError("OCRセッション");
      return { success: false, error: "セッションの更新に失敗しました" };
    }
  }

  return { success: true };
}

// ─── Get session ──────────────────────────────────────────────────────────────

export async function getOcrSession(sessionId: string): Promise<OcrSession | null> {
  try {
    const dealer = await getCurrentDealer();
    if (!dealer) return null;

    const supabase = await createClient();

    const { data, error } = await supabase
      .from("vehicle_registration_ocr_sessions")
      .select("*")
      .eq("id",        sessionId)
      .eq("dealer_id", dealer.dealer_id)
      .single();

    if (error || !data) return null;
    return data as OcrSession;
  } catch {
    return null;
  }
}

// ─── Get recent sessions ──────────────────────────────────────────────────────

export async function getRecentOcrSessions(limit = 20): Promise<OcrSession[]> {
  try {
    const dealer = await getCurrentDealer();
    if (!dealer) return [];

    const supabase = await createClient();

    const { data, error } = await supabase
      .from("vehicle_registration_ocr_sessions")
      .select("*")
      .eq("dealer_id", dealer.dealer_id)
      .neq("status", "abandoned")
      .order("created_at", { ascending: false })
      .limit(limit);

    if (error) return [];
    return (data ?? []) as OcrSession[];
  } catch {
    return [];
  }
}
