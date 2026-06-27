"use client";

// Vehicle Registration Upload Component (RC-09B)
// Flow:
//   1. Mount → pre-flight GET /api/auth/status
//   2. If not authenticated → show login banner, block file picker
//   3. User picks source (camera / file)
//   4. Image compressed client-side via Canvas API (JPEG, >1.5 MB only)
//   5. User confirms → Server Action upload + OCR (55 s timeout, 1 server-side retry)
//   6. On error → show specific message + retry button
//   7. On success → invoke onComplete

import { useEffect, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { uploadAndAnalyzeVehicleRegistration } from "@/lib/vehicle-registration/actions";
import { VehicleRegistrationOcrResult }         from "@/lib/vehicle-registration/vehicle-registration-types";
import type { OcrSessionMeta }                  from "@/lib/ocr/ocr-session-types";

interface Props {
  customerId?:  string;
  vehicleId?:   string;
  estimateId?:  string;
  onComplete:   (result: VehicleRegistrationOcrResult, meta?: OcrSessionMeta) => void;
  onCancel?:    () => void;
}

// ─── Constants ────────────────────────────────────────────────────────────────
const RAW_MAX_SIZE_MB    = 20;
const COMPRESS_THRESHOLD = 1.5 * 1024 * 1024;
const COMPRESS_MAX_PX    = 1920;
const COMPRESS_QUALITY   = 0.88;

// ─── Types ────────────────────────────────────────────────────────────────────
type Stage      = "choice" | "compressing" | "selected";
type AuthStatus = "checking" | "ok" | "no-user" | "no-dealer" | "no-key" | "check-failed";

// ─── Helpers ─────────────────────────────────────────────────────────────────
function formatBytes(bytes: number): string {
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

async function compressImage(file: File): Promise<{ file: File; compressed: boolean }> {
  if (!file.type.startsWith("image/") || file.type === "image/gif") {
    return { file, compressed: false };
  }
  if (file.size <= COMPRESS_THRESHOLD) {
    return { file, compressed: false };
  }

  return new Promise((resolve) => {
    const img = new Image();
    const url = URL.createObjectURL(file);

    img.onload = () => {
      URL.revokeObjectURL(url);
      const { naturalWidth: w, naturalHeight: h } = img;
      const scale = Math.min(1, COMPRESS_MAX_PX / Math.max(w, h));
      const cw = Math.round(w * scale);
      const ch = Math.round(h * scale);

      const canvas = document.createElement("canvas");
      canvas.width  = cw;
      canvas.height = ch;
      const ctx = canvas.getContext("2d");
      if (!ctx) { resolve({ file, compressed: false }); return; }

      ctx.drawImage(img, 0, 0, cw, ch);
      canvas.toBlob(
        (blob) => {
          if (!blob || blob.size >= file.size) {
            resolve({ file, compressed: false });
            return;
          }
          const compressed = new File(
            [blob],
            file.name.replace(/\.[^.]+$/, ".jpg"),
            { type: "image/jpeg" },
          );
          resolve({ file: compressed, compressed: true });
        },
        "image/jpeg",
        COMPRESS_QUALITY,
      );
    };

    img.onerror = () => {
      URL.revokeObjectURL(url);
      resolve({ file, compressed: false });
    };

    img.src = url;
  });
}

// ─── Component ───────────────────────────────────────────────────────────────
export default function VehicleRegistrationUpload({
  customerId,
  vehicleId,
  estimateId,
  onComplete,
  onCancel,
}: Props) {
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const fileInputRef   = useRef<HTMLInputElement>(null);

  const [isMobile,       setIsMobile]       = useState(false);
  const [authStatus,     setAuthStatus]     = useState<AuthStatus>("checking");
  const [stage,          setStage]          = useState<Stage>("choice");
  const [selectedFile,   setSelectedFile]   = useState<File | null>(null);
  const [originalSize,   setOriginalSize]   = useState(0);
  const [wasCompressed,  setWasCompressed]  = useState(false);
  const [preview,        setPreview]        = useState<string | null>(null);
  const [fileName,       setFileName]       = useState<string>("");
  const [error,          setError]          = useState<string | null>(null);
  const [elapsedSec,     setElapsedSec]     = useState(0);
  const [isPending,      startTransition]   = useTransition();

  // ── Mobile detection ───────────────────────────────────────────────────────
  useEffect(() => {
    setIsMobile(/iPhone|iPad|iPod|Android/i.test(navigator.userAgent));
  }, []);

  // ── Pre-flight auth check ──────────────────────────────────────────────────
  async function checkAuth() {
    setAuthStatus("checking");
    try {
      const res  = await fetch("/api/auth/status", { cache: "no-store" });
      if (!res.ok) { setAuthStatus("check-failed"); return; }
      const data = await res.json() as { authenticated: boolean; hasDealer: boolean; hasOcrKey: boolean };
      if (!data.authenticated) { setAuthStatus("no-user");   return; }
      if (!data.hasDealer)     { setAuthStatus("no-dealer"); return; }
      if (!data.hasOcrKey)     { setAuthStatus("no-key");    return; }
      setAuthStatus("ok");
    } catch {
      setAuthStatus("check-failed");
    }
  }

  useEffect(() => {
    void checkAuth();
  }, []);

  // Re-check when the user switches back to this tab (e.g. after login in another tab)
  useEffect(() => {
    function onFocus() {
      if (authStatus === "no-user" || authStatus === "check-failed") {
        void checkAuth();
      }
    }
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  }, [authStatus]);

  // ── Elapsed time while Server Action is running ────────────────────────────
  useEffect(() => {
    if (!isPending) { setElapsedSec(0); return; }
    const start = Date.now();
    const id    = setInterval(
      () => setElapsedSec(Math.floor((Date.now() - start) / 1000)),
      1000,
    );
    return () => clearInterval(id);
  }, [isPending]);

  // ── File selection + compression ───────────────────────────────────────────
  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    setError(null);
    const raw = e.target.files?.[0];
    if (!raw) return;
    e.target.value = "";

    if (raw.size > RAW_MAX_SIZE_MB * 1024 * 1024) {
      setError(`ファイルサイズは${RAW_MAX_SIZE_MB}MB以下にしてください`);
      return;
    }

    if (raw.type.startsWith("image/") && raw.size > COMPRESS_THRESHOLD) {
      setStage("compressing");
    }

    const { file, compressed } = await compressImage(raw);

    setSelectedFile(file);
    setFileName(raw.name);
    setOriginalSize(raw.size);
    setWasCompressed(compressed);
    setStage("selected");

    if (file.type.startsWith("image/")) {
      const reader = new FileReader();
      reader.onload = (ev) => setPreview(ev.target?.result as string);
      reader.readAsDataURL(file);
    } else {
      setPreview(null);
    }
  }

  // ── Upload + OCR ───────────────────────────────────────────────────────────
  function handleAnalyze() {
    if (!selectedFile) return;
    setError(null);

    const fd = new FormData();
    fd.append("file", selectedFile);
    if (customerId) fd.append("customer_id", customerId);
    if (vehicleId)  fd.append("vehicle_id",  vehicleId);
    if (estimateId) fd.append("estimate_id", estimateId);

    startTransition(async () => {
      const result = await uploadAndAnalyzeVehicleRegistration(fd);
      if (!result.success) {
        setError(result.error ?? "車検証を読み取れませんでした。画像を確認してください。");
        return;
      }
      const meta: OcrSessionMeta = {
        sessionId:        result.sessionId,
        sessionPersisted: result.sessionPersisted,
      };
      onComplete(result.ocrResult, meta);
    });
  }

  function resetToChoice() {
    setStage("choice");
    setSelectedFile(null);
    setOriginalSize(0);
    setWasCompressed(false);
    setPreview(null);
    setFileName("");
    setError(null);
  }

  // ── Error classification for color coding ─────────────────────────────────
  const isAuthError  = error?.includes("ログインが必要") || error?.includes("店舗情報を取得");
  const isSetupError = !isAuthError &&
    (error?.includes("未設定") || error?.includes("未作成") || error?.includes("未適用") ||
     error?.includes("AI解析キー") || error?.includes("無効"));
  // Retryable: transient errors where re-submitting makes sense
  const isRetryable = !isAuthError && !isSetupError && !!selectedFile && !isPending &&
    (error?.includes("タイムアウト") || error?.includes("接続") ||
     error?.includes("一時的") || error?.includes("再試行") ||
     error?.includes("利用制限"));

  // ── Auth gate: block the file picker for hard failures ────────────────────
  const blockUpload = authStatus === "no-user" || authStatus === "no-dealer" || authStatus === "no-key";

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="flex flex-col gap-4">

      {/* ── Auth status banners ──────────────────────────────────────────── */}
      {authStatus === "checking" && (
        <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-slate-800/60 text-slate-400 text-xs">
          <span className="animate-spin inline-block">⟳</span>
          <span>認証を確認しています...</span>
        </div>
      )}

      {authStatus === "no-user" && (
        <div className="flex flex-col gap-3 px-4 py-4 rounded-xl border border-blue-500/30 bg-blue-500/10">
          <div className="flex items-center gap-2 text-blue-300 font-semibold text-sm">
            <span>🔐</span>
            <span>ログインが必要です</span>
          </div>
          <p className="text-xs text-blue-300/75 leading-relaxed">
            このデバイスのブラウザでログインしてからOCRを使用できます。
            デスクトップの認証はスマートフォンに引き継がれません。
          </p>
          <div className="flex gap-2">
            <Link
              href="/login"
              className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white text-xs font-medium rounded-lg transition-colors"
            >
              ログインへ →
            </Link>
            <button
              type="button"
              onClick={() => void checkAuth()}
              className="px-3 py-2 bg-slate-700 hover:bg-slate-600 text-slate-300 text-xs rounded-lg transition-colors"
            >
              再確認
            </button>
          </div>
        </div>
      )}

      {authStatus === "no-dealer" && (
        <div className="flex flex-col gap-2 px-4 py-3 rounded-xl border border-amber-500/30 bg-amber-500/10">
          <div className="flex items-center gap-2 text-amber-300 font-semibold text-sm">
            <span>⚠</span>
            <span>店舗情報が取得できません</span>
          </div>
          <p className="text-xs text-amber-300/75">
            アカウントに店舗が関連付けられていません。管理者にお問い合わせください。
          </p>
        </div>
      )}

      {authStatus === "no-key" && (
        <div className="flex flex-col gap-2 px-4 py-3 rounded-xl border border-amber-500/30 bg-amber-500/10">
          <div className="flex items-center gap-2 text-amber-300 font-semibold text-sm">
            <span>⚠</span>
            <span>AI解析サービスが未設定です</span>
          </div>
          <p className="text-xs text-amber-300/75">
            OpenAI API キーが設定されていません。管理者にお問い合わせください。
          </p>
        </div>
      )}

      {authStatus === "check-failed" && (
        <div className="flex items-center justify-between gap-2 px-3 py-2 rounded-lg border border-slate-700 bg-slate-800/40">
          <p className="text-xs text-slate-400">認証状態を確認できませんでした。</p>
          <button
            type="button"
            onClick={() => void checkAuth()}
            className="text-xs text-blue-400 hover:text-blue-300 underline transition-colors"
          >
            再確認
          </button>
        </div>
      )}

      {/* ── Stage: choice ──────────────────────────────────────────────────── */}
      {stage === "choice" && !blockUpload && authStatus !== "checking" && (
        <div className="flex flex-col gap-3">
          <p className="text-xs text-slate-400 text-center">画像の取得方法を選択してください</p>

          {isMobile ? (
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => cameraInputRef.current?.click()}
                className="flex flex-col items-center justify-center gap-3 py-8 rounded-xl border border-slate-700 hover:border-blue-500/50 bg-[#0f172a] hover:bg-blue-950/20 transition-colors"
              >
                <span className="text-3xl">📷</span>
                <div className="text-center">
                  <p className="text-sm font-medium text-slate-200">カメラで撮影</p>
                  <p className="text-xs text-slate-500 mt-0.5">背面カメラで車検証を撮影</p>
                </div>
              </button>

              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="flex flex-col items-center justify-center gap-3 py-8 rounded-xl border border-slate-700 hover:border-blue-500/50 bg-[#0f172a] hover:bg-blue-950/20 transition-colors"
              >
                <span className="text-3xl">📂</span>
                <div className="text-center">
                  <p className="text-sm font-medium text-slate-200">ファイルから選択</p>
                  <p className="text-xs text-slate-500 mt-0.5">画像・PDF を選択</p>
                </div>
              </button>
            </div>
          ) : (
            <div className="flex flex-col gap-2">
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="flex flex-col items-center justify-center gap-3 py-8 rounded-xl border border-slate-700 hover:border-blue-500/50 bg-[#0f172a] hover:bg-blue-950/20 transition-colors w-full"
              >
                <span className="text-3xl">📂</span>
                <div className="text-center">
                  <p className="text-sm font-medium text-slate-200">ファイルから選択</p>
                  <p className="text-xs text-slate-500 mt-0.5">画像・PDF を選択</p>
                </div>
              </button>
              <p className="text-xs text-slate-500 text-center">
                PCではカメラ撮影ではなく画像ファイルを選択してください
              </p>
            </div>
          )}

          <p className="text-xs text-slate-600 text-center">JPEG・PNG・WebP・PDF / 最大{RAW_MAX_SIZE_MB}MB</p>
        </div>
      )}

      {/* ── Stage: compressing ─────────────────────────────────────────────── */}
      {stage === "compressing" && (
        <div className="flex flex-col items-center gap-3 py-8">
          <span className="text-2xl animate-spin">⟳</span>
          <p className="text-sm text-slate-300">画像を最適化しています...</p>
          <p className="text-xs text-slate-500">OCR品質を維持しながらファイルサイズを削減中</p>
        </div>
      )}

      {/* ── Stage: selected ────────────────────────────────────────────────── */}
      {stage === "selected" && (
        <div className="flex flex-col gap-3">
          <div className="rounded-xl border border-blue-500/30 bg-blue-950/10 overflow-hidden">
            {preview ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={preview}
                alt="車検証プレビュー"
                className="w-full max-h-56 object-contain"
              />
            ) : (
              <div className="flex flex-col items-center justify-center py-8 gap-2">
                <span className="text-3xl">📄</span>
                <p className="text-xs text-slate-400">{fileName}</p>
              </div>
            )}
          </div>

          <div className="flex items-center justify-between gap-2">
            <div className="flex flex-col gap-0.5 flex-1 min-w-0">
              <p className="text-xs text-slate-400 truncate">{fileName}</p>
              {wasCompressed && selectedFile ? (
                <p className="text-xs text-emerald-400">
                  {formatBytes(originalSize)} → {formatBytes(selectedFile.size)} に圧縮
                </p>
              ) : selectedFile ? (
                <p className="text-xs text-slate-600">{formatBytes(selectedFile.size)}</p>
              ) : null}
            </div>
            <button
              type="button"
              onClick={resetToChoice}
              disabled={isPending}
              className="text-xs text-slate-400 hover:text-slate-200 underline underline-offset-2 shrink-0 disabled:opacity-50 transition-colors"
            >
              選び直す
            </button>
          </div>
        </div>
      )}

      {/* ── Hidden inputs ──────────────────────────────────────────────────── */}
      {isMobile && (
        <input
          ref={cameraInputRef}
          type="file"
          accept="image/*"
          capture="environment"
          className="hidden"
          onChange={handleFileChange}
          disabled={isPending}
        />
      )}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*,.pdf"
        className="hidden"
        onChange={handleFileChange}
        disabled={isPending}
      />

      {/* ── Error ──────────────────────────────────────────────────────────── */}
      {error && (
        <div className={`flex flex-col gap-2 px-3 py-2 rounded-lg border text-xs ${
          isAuthError
            ? "border-blue-500/30 bg-blue-500/10 text-blue-300"
            : isSetupError
              ? "border-amber-500/30 bg-amber-500/10 text-amber-300"
              : "border-red-500/30 bg-red-500/10 text-red-400"
        }`}>
          <div className="flex items-start gap-2">
            <span className="shrink-0">{isAuthError ? "🔐" : isSetupError ? "⚠" : "✕"}</span>
            <p>{error}</p>
          </div>
          {isRetryable && (
            <button
              type="button"
              onClick={handleAnalyze}
              className="self-start px-3 py-1.5 bg-slate-700 hover:bg-slate-600 text-slate-200 rounded-md transition-colors font-medium"
            >
              再試行
            </button>
          )}
        </div>
      )}

      {/* ── Upload / analysis progress ─────────────────────────────────────── */}
      {isPending && (
        <div className="flex flex-col gap-2">
          <div className="flex items-center gap-2 px-3 py-2 rounded-lg border border-blue-500/20 bg-blue-500/5">
            <span className="text-blue-400 shrink-0 animate-pulse">⟳</span>
            <p className="text-xs text-blue-400">アップロード・AI解析中です。しばらくお待ちください...</p>
          </div>
          {elapsedSec >= 10 && (
            <p className="text-xs text-slate-500 text-center">
              {elapsedSec}秒経過...（通信環境によっては最大60秒かかります）
            </p>
          )}
        </div>
      )}

      {/* ── Action buttons ─────────────────────────────────────────────────── */}
      <div className="flex gap-2">
        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            disabled={isPending}
            className="flex-1 px-4 py-3 bg-slate-700 hover:bg-slate-600 disabled:opacity-50 text-slate-200 text-sm rounded-lg transition-colors min-h-[44px]"
          >
            キャンセル
          </button>
        )}
        {stage === "selected" && (
          <button
            type="button"
            onClick={handleAnalyze}
            disabled={!selectedFile || isPending || blockUpload}
            className="flex-1 px-4 py-3 bg-blue-600 hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed text-white text-sm font-medium rounded-lg transition-colors min-h-[44px]"
          >
            {isPending ? "解析中..." : "AI解析開始"}
          </button>
        )}
      </div>
    </div>
  );
}
