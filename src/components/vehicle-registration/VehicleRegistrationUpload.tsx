"use client";

// Vehicle Registration Upload Component
// Flow:
//   1. User picks source (camera / file)
//   2. Image is compressed client-side via Canvas API (JPEG, PNG, WebP only)
//   3. Compressed file is previewed with before/after size info
//   4. User confirms → Server Action upload + OCR

import { useEffect, useRef, useState, useTransition } from "react";
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

// Hard limit shown to user before compression even runs
const RAW_MAX_SIZE_MB    = 20;
// Compress if image exceeds this size (iPhone photos are typically 4-8 MB)
const COMPRESS_THRESHOLD = 1.5 * 1024 * 1024;
// Max pixel dimension after compression (longer edge)
const COMPRESS_MAX_PX    = 1920;
// JPEG quality — high enough for OCR text accuracy
const COMPRESS_QUALITY   = 0.88;

type Stage = "choice" | "compressing" | "selected";

function formatBytes(bytes: number): string {
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

// Compress an image File via Canvas. Returns a new File (JPEG) or the
// original file if compression is not applicable / not beneficial.
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
            // Compression didn't help — send original
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
  const [stage,          setStage]          = useState<Stage>("choice");
  const [selectedFile,   setSelectedFile]   = useState<File | null>(null);
  const [originalSize,   setOriginalSize]   = useState(0);
  const [wasCompressed,  setWasCompressed]  = useState(false);
  const [preview,        setPreview]        = useState<string | null>(null);
  const [fileName,       setFileName]       = useState<string>("");
  const [error,          setError]          = useState<string | null>(null);
  const [isPending,      startTransition]   = useTransition();

  useEffect(() => {
    setIsMobile(/iPhone|iPad|iPod|Android/i.test(navigator.userAgent));
  }, []);

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    setError(null);
    const raw = e.target.files?.[0];
    if (!raw) return;
    e.target.value = "";

    if (raw.size > RAW_MAX_SIZE_MB * 1024 * 1024) {
      setError(`ファイルサイズは${RAW_MAX_SIZE_MB}MB以下にしてください`);
      return;
    }

    // Show compressing indicator immediately for large images
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

  const isSetupError =
    error?.includes("未設定") || error?.includes("未作成") || error?.includes("未適用");

  return (
    <div className="flex flex-col gap-4">

      {/* ── Stage: choice ──────────────────────────────────────────────── */}
      {stage === "choice" && (
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

      {/* ── Stage: compressing ─────────────────────────────────────────── */}
      {stage === "compressing" && (
        <div className="flex flex-col items-center gap-3 py-8">
          <span className="text-2xl animate-spin">⟳</span>
          <p className="text-sm text-slate-300">画像を最適化しています...</p>
          <p className="text-xs text-slate-500">OCR品質を維持しながらファイルサイズを削減中</p>
        </div>
      )}

      {/* ── Stage: selected (preview + analyze) ──────────────────────── */}
      {stage === "selected" && (
        <div className="flex flex-col gap-3">
          {/* Preview */}
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

          {/* File name + size info + re-select */}
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

      {/* ── Hidden inputs ─────────────────────────────────────────────── */}
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

      {/* ── Error ─────────────────────────────────────────────────────── */}
      {error && (
        <div className={`flex items-start gap-2 px-3 py-2 rounded-lg border text-xs ${
          isSetupError
            ? "border-amber-500/30 bg-amber-500/10 text-amber-300"
            : "border-red-500/30 bg-red-500/10 text-red-400"
        }`}>
          <span className="shrink-0">{isSetupError ? "⚠" : "✕"}</span>
          <p>{error}</p>
        </div>
      )}

      {/* ── Upload progress indicator ─────────────────────────────────── */}
      {isPending && (
        <div className="flex flex-col gap-2">
          <div className="flex items-center gap-2 px-3 py-2 rounded-lg border border-blue-500/20 bg-blue-500/5">
            <span className="text-blue-400 shrink-0 animate-pulse">⟳</span>
            <p className="text-xs text-blue-400">アップロード・AI解析中です。しばらくお待ちください...</p>
          </div>
          <p className="text-xs text-slate-600 text-center">
            通信環境によっては30秒ほどかかる場合があります
          </p>
        </div>
      )}

      {/* ── Action buttons ────────────────────────────────────────────── */}
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
            disabled={!selectedFile || isPending}
            className="flex-1 px-4 py-3 bg-blue-600 hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed text-white text-sm font-medium rounded-lg transition-colors min-h-[44px]"
          >
            {isPending ? "解析中..." : "AI解析開始"}
          </button>
        )}
      </div>
    </div>
  );
}
