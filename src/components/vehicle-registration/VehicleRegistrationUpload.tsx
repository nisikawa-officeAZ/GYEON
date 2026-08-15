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
import type { OcrRunMeta }                       from "@/lib/vehicle-registration/vehicle-registration-types";
import { formatUsd }                             from "@/lib/ai/ai-pricing";
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

// Document-scan A4 portrait guide (height / width = √2).
const A4_RATIO             = 1.41421356;
const A4_GUIDE_HEIGHT_RATIO = 0.9; // guide occupies 90% of the frame height

// ─── Types ────────────────────────────────────────────────────────────────────
type Stage      = "choice" | "camera" | "compressing" | "selected";
type AuthStatus = "checking" | "ok" | "no-user" | "no-dealer" | "no-key" | "check-failed";

// ─── Root Cause / Suggested Fix mapping (operator diagnostics) ────────────────
const OCR_ERROR_DIAGNOSIS: Record<string, { cause: string; fix: string }> = {
  OPENAI_API_KEY_MISSING: { cause: "OpenAI APIキーが未登録", fix: "Super AdminのAIセンターからキーを登録してください。" },
  OPENAI_AUTH_ERROR:      { cause: "APIキーが無効",           fix: "AIセンターで正しいキーを再登録してください。" },
  OPENAI_RATE_LIMIT:      { cause: "OpenAIのレート制限",       fix: "数分待って再試行してください。" },
  OPENAI_SERVER_ERROR:    { cause: "OpenAI側の一時的な障害",   fix: "時間をおいて再試行してください。" },
  TIMEOUT:                { cause: "応答がタイムアウト",       fix: "画像サイズを小さくするか通信環境を確認して再試行してください。" },
  CONNECT_ERROR:          { cause: "OpenAIに接続できません",   fix: "サーバーの通信環境を確認してください。" },
  EMPTY_RESPONSE:         { cause: "車検証を読み取れませんでした", fix: "鮮明な画像で撮影し直してください。" },
  PARSE_ERROR:            { cause: "応答の解析に失敗",         fix: "再試行してください。改善しない場合は管理者に連絡してください。" },
};
const OCR_ERROR_DIAGNOSIS_UNKNOWN = { cause: "不明なエラー", fix: "再試行し、続く場合は管理者に連絡してください。" };

function diagnoseOcrError(code: string): { cause: string; fix: string } {
  return OCR_ERROR_DIAGNOSIS[code] ?? OCR_ERROR_DIAGNOSIS_UNKNOWN;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────
function formatBytes(bytes: number): string {
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

// Join detected sub-fields into a single display string, or "—" when all empty.
function joinDetected(parts: Array<string | null | undefined>): string {
  const joined = parts.filter(Boolean).join(" ").trim();
  return joined.length > 0 ? joined : "—";
}

// HEIC/HEIF detection (iPhone default). iOS may report an empty MIME, so match
// by extension too.
function isHeicClient(file: File): boolean {
  return /\.(heic|heif)$/i.test(file.name) || /image\/(heic|heif)/i.test(file.type);
}

// When `force` is true (HEIC/HEIF), always run through the canvas to re-encode as
// JPEG regardless of size — this converts the format on browsers that can decode
// HEIC (e.g. iPhone Safari). On browsers that cannot, the image fails to load and
// the original file is returned unchanged (the server then converts it via sharp).
async function compressImage(file: File, force = false): Promise<{ file: File; compressed: boolean }> {
  if (!force && (!file.type.startsWith("image/") || file.type === "image/gif")) {
    return { file, compressed: false };
  }
  if (!force && file.size <= COMPRESS_THRESHOLD) {
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
          // For a forced HEIC conversion we keep the JPEG even if it isn't smaller —
          // the point is the format change, not size reduction.
          if (!blob || (!force && blob.size >= file.size)) {
            resolve({ file, compressed: false });
            return;
          }
          const out = new File(
            [blob],
            file.name.replace(/\.[^.]+$/, ".jpg"),
            { type: "image/jpeg" },
          );
          resolve({ file: out, compressed: blob.size < file.size });
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
  const videoRef       = useRef<HTMLVideoElement>(null);
  const streamRef      = useRef<MediaStream | null>(null);

  const [isMobile,       setIsMobile]       = useState(false);
  const [authStatus,     setAuthStatus]     = useState<AuthStatus>("checking");
  const [stage,          setStage]          = useState<Stage>("choice");
  const [selectedFile,   setSelectedFile]   = useState<File | null>(null);
  const [originalSize,   setOriginalSize]   = useState(0);
  const [wasCompressed,  setWasCompressed]  = useState(false);
  const [preview,        setPreview]        = useState<string | null>(null);
  const [heicPending,    setHeicPending]    = useState(false);
  const [fileName,       setFileName]       = useState<string>("");
  const [error,          setError]          = useState<string | null>(null);
  const [errorCode,      setErrorCode]      = useState<string | null>(null);
  const [ocrMeta,        setOcrMeta]        = useState<OcrRunMeta | null>(null);
  const [ocrResult,      setOcrResult]      = useState<VehicleRegistrationOcrResult | null>(null);
  const [elapsedSec,     setElapsedSec]     = useState(0);
  const [cameraTried,    setCameraTried]    = useState(false);
  const [cameraFallback, setCameraFallback] = useState(false);
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

  // ── Attach the webcam stream once the <video> element is mounted ───────────
  useEffect(() => {
    if (stage === "camera" && videoRef.current && streamRef.current) {
      videoRef.current.srcObject = streamRef.current;
      videoRef.current.play().catch(() => {});
    }
  }, [stage]);

  // ── Desktop: attempt the webcam immediately; fall back to file on failure ──
  useEffect(() => {
    if (authStatus === "ok" && !isMobile && stage === "choice" && !cameraTried) {
      setCameraTried(true);
      void startWebcam();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authStatus, isMobile, stage, cameraTried]);

  // ── Stop the camera on unmount ─────────────────────────────────────────────
  useEffect(() => () => stopWebcam(), []);

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
  // Shared pipeline for any acquired file (file picker, native camera, or webcam).
  async function processFile(raw: File) {
    setError(null);
    setErrorCode(null);
    setOcrMeta(null);
    setOcrResult(null);
    setHeicPending(false);

    if (raw.size > RAW_MAX_SIZE_MB * 1024 * 1024) {
      setError(`ファイルサイズは${RAW_MAX_SIZE_MB}MB以下にしてください`);
      setStage("choice");
      return;
    }

    // HEIC/HEIF: convert to JPEG (forced) so it previews and uploads as JPEG on
    // browsers that can decode it. Where it can't, the server converts on upload.
    const heic = isHeicClient(raw);
    if (heic || (raw.type.startsWith("image/") && raw.size > COMPRESS_THRESHOLD)) {
      setStage("compressing");
    }

    const { file, compressed } = await compressImage(raw, heic);

    setSelectedFile(file);
    setFileName(file.name);
    setOriginalSize(raw.size);
    setWasCompressed(compressed);
    setStage("selected");

    const renderable = /^image\/(jpeg|png|webp|gif)$/i.test(file.type);
    if (renderable) {
      const reader = new FileReader();
      reader.onload = (ev) => setPreview(ev.target?.result as string);
      reader.readAsDataURL(file);
    } else if (isHeicClient(file)) {
      // HEIC not convertible in this browser — will be converted server-side.
      setPreview(null);
      setHeicPending(true);
    } else {
      setPreview(null);
    }
  }

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const raw = e.target.files?.[0];
    e.target.value = "";
    if (!raw) return;
    stopWebcam();
    await processFile(raw);
  }

  // ── Desktop webcam ───────────────────────────────────────────────────────────
  function stopWebcam() {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
  }

  // Try to open the webcam. On denial / no camera, gracefully fall back to file.
  async function startWebcam() {
    setError(null);
    setCameraFallback(false);
    if (!navigator.mediaDevices?.getUserMedia) {
      setCameraFallback(true);
      setStage("choice");
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "environment" },
        audio: false,
      });
      streamRef.current = stream;
      setStage("camera");
    } catch {
      // NotAllowedError (denied) / NotFoundError (no camera) / etc.
      stopWebcam();
      setCameraFallback(true);
      setStage("choice");
    }
  }

  function capturePhoto() {
    const v = videoRef.current;
    if (!v || !v.videoWidth) return;

    // Crop to the centered A4-portrait region (matches the on-screen guide) — we
    // never send the raw full frame to OCR. The server then enhances the crop.
    const vw = v.videoWidth;
    const vh = v.videoHeight;
    // A4 portrait: height / width = √2 ≈ 1.414. Fit the guide inside the frame.
    let cropH = Math.round(vh * A4_GUIDE_HEIGHT_RATIO);
    let cropW = Math.round(cropH / A4_RATIO);
    if (cropW > vw * 0.98) {
      cropW = Math.round(vw * 0.98);
      cropH = Math.round(cropW * A4_RATIO);
    }
    const sx = Math.round((vw - cropW) / 2);
    const sy = Math.round((vh - cropH) / 2);

    const canvas = document.createElement("canvas");
    canvas.width  = cropW;
    canvas.height = cropH;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.drawImage(v, sx, sy, cropW, cropH, 0, 0, cropW, cropH);
    canvas.toBlob(
      async (blob) => {
        if (!blob) { setError("撮影に失敗しました。もう一度お試しください。"); return; }
        stopWebcam();
        const captured = new File([blob], `scan-${cropW}x${cropH}.jpg`, { type: "image/jpeg" });
        await processFile(captured);
      },
      "image/jpeg",
      0.92,
    );
  }

  // ── Upload + OCR ───────────────────────────────────────────────────────────
  function handleAnalyze() {
    if (!selectedFile) return;
    setError(null);
    setErrorCode(null);
    setOcrMeta(null);
    setOcrResult(null);

    const fd = new FormData();
    fd.append("file", selectedFile);
    if (customerId) fd.append("customer_id", customerId);
    if (vehicleId)  fd.append("vehicle_id",  vehicleId);
    if (estimateId) fd.append("estimate_id", estimateId);

    startTransition(async () => {
      const result = await uploadAndAnalyzeVehicleRegistration(fd);
      if (!result.success) {
        setError(result.error ?? "車検証を読み取れませんでした。画像を確認してください。");
        setErrorCode(result.errorCode ?? null);
        return;
      }
      // Surface AI execution metadata to operators (additive; does not affect fields)
      setOcrMeta(result.ocrMeta ?? null);
      setOcrResult(result.ocrResult ?? null);
      const meta: OcrSessionMeta = {
        sessionId:        result.sessionId,
        sessionPersisted: result.sessionPersisted,
      };
      onComplete(result.ocrResult, meta);
    });
  }

  function resetToChoice() {
    stopWebcam();
    setCameraFallback(false);
    setStage("choice");
    setSelectedFile(null);
    setOriginalSize(0);
    setWasCompressed(false);
    setPreview(null);
    setHeicPending(false);
    setFileName("");
    setError(null);
    setErrorCode(null);
    setOcrMeta(null);
    setOcrResult(null);
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
            // Mobile: camera capture is the PRIMARY action; file select is secondary.
            <div className="flex flex-col gap-3">
              <button
                type="button"
                onClick={() => void startWebcam()}
                className="flex flex-col items-center justify-center gap-3 py-10 rounded-xl border-2 border-blue-500/50 bg-blue-950/20 hover:bg-blue-900/30 transition-colors w-full"
              >
                <span className="text-4xl">📷</span>
                <div className="text-center">
                  <p className="text-base font-semibold text-blue-200">カメラで撮影</p>
                  <p className="text-xs text-blue-300/70 mt-0.5">背面カメラ・A4ガイドで車検証をスキャン</p>
                </div>
              </button>

              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="flex items-center justify-center gap-2 py-3 rounded-xl border border-slate-700 hover:border-blue-500/50 bg-[#0f172a] hover:bg-blue-950/20 transition-colors w-full"
              >
                <span className="text-lg">📂</span>
                <p className="text-sm text-slate-300">写真から選択（画像・PDF）</p>
              </button>

              {cameraFallback && (
                <button
                  type="button"
                  onClick={() => cameraInputRef.current?.click()}
                  className="flex items-center justify-center gap-2 py-2 rounded-lg border border-slate-700 hover:border-slate-500 text-slate-400 text-xs transition-colors w-full"
                >
                  端末の標準カメラで撮影
                </button>
              )}
            </div>
          ) : (
            // Desktop: the webcam is attempted automatically on open. This view is
            // the fallback / manual re-try, with file upload always available.
            <div className="flex flex-col gap-2">
              <button
                type="button"
                onClick={() => void startWebcam()}
                className="flex flex-col items-center justify-center gap-3 py-8 rounded-xl border-2 border-blue-500/50 bg-blue-950/20 hover:bg-blue-900/30 transition-colors w-full"
              >
                <span className="text-3xl">📷</span>
                <div className="text-center">
                  <p className="text-sm font-semibold text-blue-200">カメラで撮影</p>
                  <p className="text-xs text-blue-300/70 mt-0.5">Webカメラで車検証を撮影</p>
                </div>
              </button>
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="flex items-center justify-center gap-2 py-3 rounded-xl border border-slate-700 hover:border-blue-500/50 bg-[#0f172a] hover:bg-blue-950/20 transition-colors w-full"
              >
                <span className="text-lg">📂</span>
                <p className="text-sm text-slate-300">画像・PDFをアップロード</p>
              </button>
              {cameraFallback && (
                <p className="text-xs text-amber-400/80 text-center">
                  カメラを利用できませんでした。ファイルを選択してください。
                </p>
              )}
            </div>
          )}

          <p className="text-xs text-slate-600 text-center">JPEG・PNG・WebP・HEIC・PDF / 最大{RAW_MAX_SIZE_MB}MB</p>
        </div>
      )}

      {/* ── Stage: camera (live webcam, desktop) ───────────────────────────── */}
      {stage === "camera" && (
        <div className="flex flex-col gap-3">
          <div className="relative rounded-xl border border-blue-500/30 bg-black overflow-hidden">
            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted
              className="w-full max-h-[70vh] object-contain bg-black"
            />
            {/* A4 portrait document guide overlay (mobile + desktop) */}
            <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
              <div
                className="relative border-2 border-blue-400/80 rounded-lg shadow-[0_0_0_9999px_rgba(0,0,0,0.45)]"
                style={{ height: `${A4_GUIDE_HEIGHT_RATIO * 100}%`, aspectRatio: `1 / ${A4_RATIO}` }}
              >
                {/* corner ticks */}
                <span className="absolute -top-px -left-px w-5 h-5 border-t-2 border-l-2 border-blue-300 rounded-tl-lg" />
                <span className="absolute -top-px -right-px w-5 h-5 border-t-2 border-r-2 border-blue-300 rounded-tr-lg" />
                <span className="absolute -bottom-px -left-px w-5 h-5 border-b-2 border-l-2 border-blue-300 rounded-bl-lg" />
                <span className="absolute -bottom-px -right-px w-5 h-5 border-b-2 border-r-2 border-blue-300 rounded-br-lg" />
                <span className="absolute -top-6 left-1/2 -translate-x-1/2 whitespace-nowrap text-[10px] font-medium text-blue-200">
                  A4縦 · 枠に車検証を合わせてください
                </span>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={capturePhoto}
              className="flex-1 h-12 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-base font-semibold transition-colors flex items-center justify-center gap-2"
            >
              <span className="text-lg">📸</span> 撮影する
            </button>
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="h-12 px-4 rounded-xl border border-slate-700 hover:border-blue-500/50 text-slate-300 text-sm transition-colors shrink-0"
            >
              写真から選択
            </button>
            <button
              type="button"
              onClick={resetToChoice}
              className="h-12 px-4 rounded-xl border border-slate-700 hover:border-slate-500 text-slate-400 text-sm transition-colors shrink-0"
            >
              キャンセル
            </button>
          </div>
          <p className="text-xs text-slate-500 text-center">車検証全体が枠に収まるように撮影してください</p>
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
                <span className="text-3xl">{heicPending ? "🖼️" : "📄"}</span>
                <p className="text-xs text-slate-400">{fileName}</p>
                {heicPending && (
                  <p className="text-[10px] text-slate-500">HEIC画像 · アップロード時にJPEGへ変換されます</p>
                )}
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
          accept="image/*,.heic,.heif"
          capture="environment"
          className="hidden"
          onChange={handleFileChange}
          disabled={isPending}
        />
      )}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*,.heic,.heif,.pdf"
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
          {errorCode && (
            <div className="flex flex-col gap-0.5 pl-6 text-[11px] opacity-90">
              <p>原因 (Root Cause): {diagnoseOcrError(errorCode).cause}</p>
              <p>対処 (Suggested Fix): {diagnoseOcrError(errorCode).fix}</p>
            </div>
          )}
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

      {/* ── 検出結果サマリ (detected-fields summary) ───────────────────────── */}
      {ocrResult && (
        <div className="flex flex-col gap-1 px-3 py-2 rounded-lg border border-slate-800 bg-slate-900/40 text-xs text-slate-400">
          <p className="text-slate-300 font-medium">検出結果サマリ</p>
          <div className="flex justify-between gap-2">
            <span>検出顧客</span>
            <span className="text-slate-300 text-right">
              {ocrResult.customer_candidate_name || ocrResult.user_name || ocrResult.owner_name || "—"}
              {ocrResult.customer_type === "corporation" && <span className="ml-1 text-[10px] text-purple-300">(法人)</span>}
            </span>
          </div>
          <div className="flex justify-between gap-2">
            <span>検出車両</span>
            <span className="text-slate-300 text-right">
              {joinDetected([ocrResult.maker, ocrResult.vehicle_name || ocrResult.model, ocrResult.grade])}
            </span>
          </div>
          <div className="flex justify-between gap-2">
            <span>ナンバー</span>
            <span className="text-slate-300 text-right">
              {joinDetected([
                ocrResult.license_plate_region,
                ocrResult.license_plate_class,
                ocrResult.license_plate_kana,
                ocrResult.license_plate_number,
              ])}
            </span>
          </div>
          <div className="flex justify-between gap-2">
            <span>車台番号(VIN)</span>
            <span className="text-slate-300 text-right">{ocrResult.chassis_number || "—"}</span>
          </div>
          <div className="flex justify-between gap-2">
            <span>車検満了日</span>
            <span className="text-slate-300 text-right">{ocrResult.inspection_expiry_date || "—"}</span>
          </div>
          <div className="flex justify-between gap-2">
            <span>信頼度</span>
            <span className="text-slate-300 text-right">
              {ocrResult.confidence != null ? `${Math.round(ocrResult.confidence * 100)}%` : "—"}
            </span>
          </div>
        </div>
      )}

      {/* ── AI 実行情報 (operator diagnostics) ─────────────────────────────── */}
      {ocrMeta && (
        <div className="flex flex-col gap-1 px-3 py-2 rounded-lg border border-slate-700 bg-slate-800/40 text-[11px] text-slate-400">
          <p className="text-slate-300 font-medium">AI実行情報</p>
          <div className="flex justify-between gap-2">
            <span>API</span>
            <span className="text-slate-300">OpenAI（{ocrMeta.provider}）</span>
          </div>
          <div className="flex justify-between gap-2">
            <span>モデル</span>
            <span className="text-slate-300">{ocrMeta.model ?? "—"}</span>
          </div>
          <div className="flex justify-between gap-2">
            <span>応答時間</span>
            <span className="text-slate-300">{ocrMeta.responseMs} ms</span>
          </div>
          <div className="flex justify-between gap-2">
            <span>トークン</span>
            <span className="text-slate-300">
              入力 {ocrMeta.inputTokens ?? "—"} / 出力 {ocrMeta.outputTokens ?? "—"} / 合計 {ocrMeta.totalTokens ?? "—"}
            </span>
          </div>
          <div className="flex justify-between gap-2">
            <span>概算コスト</span>
            <span className="text-slate-300">{formatUsd(ocrMeta.estimatedCostUsd)}</span>
          </div>
          {ocrMeta.promptVersion && (
            <div className="flex justify-between gap-2">
              <span>プロンプト版</span>
              <span className="text-slate-300">{ocrMeta.promptVersion}</span>
            </div>
          )}
          {ocrMeta.quality && (
            <div className="mt-1 pt-1 border-t border-slate-700/60 flex flex-col gap-0.5">
              <p className="text-slate-300 font-medium">OCR品質レポート</p>
              <div className="flex justify-between gap-2">
                <span>信頼度</span>
                <span className="text-slate-300">
                  {ocrMeta.quality.confidence != null ? `${Math.round(ocrMeta.quality.confidence * 100)}%` : "—"}
                </span>
              </div>
              <div className="flex justify-between gap-2">
                <span>手入力補正</span>
                <span className={ocrMeta.quality.needsManualCorrection ? "text-amber-400" : "text-emerald-400"}>
                  {ocrMeta.quality.needsManualCorrection ? "必要" : "不要"}
                </span>
              </div>
              {ocrMeta.quality.missingRequired.length > 0 && (
                <div className="text-[10px] text-amber-400/90">未取得の必須項目: {ocrMeta.quality.missingRequired.join("、")}</div>
              )}
              {ocrMeta.quality.warnings.map((w, i) => (
                <div key={i} className="text-[10px] text-slate-500">⚠ {w}</div>
              ))}
              <div className="text-[10px] text-slate-600">手入力必須: {ocrMeta.quality.manualRequired.join("、")}</div>
            </div>
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
