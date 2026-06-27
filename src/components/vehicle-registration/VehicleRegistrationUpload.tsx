"use client";

// PHASE67: Vehicle Registration Upload Component
// Flow:
//   1. Show choice UI: カメラで撮影 / ファイルから選択
//   2. User picks source → file input opens
//   3. File selected → preview shown
//   4. User confirms → upload + OCR

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

const MAX_SIZE_MB = 10;

type Stage = "choice" | "selected";

export default function VehicleRegistrationUpload({
  customerId,
  vehicleId,
  estimateId,
  onComplete,
  onCancel,
}: Props) {
  // Two separate inputs: camera capture and file picker
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const fileInputRef   = useRef<HTMLInputElement>(null);

  const [isMobile,     setIsMobile]     = useState(false);
  const [stage,        setStage]        = useState<Stage>("choice");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [preview,      setPreview]      = useState<string | null>(null);
  const [fileName,     setFileName]     = useState<string>("");
  const [error,        setError]        = useState<string | null>(null);
  const [isPending,    startTransition] = useTransition();

  useEffect(() => {
    setIsMobile(/iPhone|iPad|iPod|Android/i.test(navigator.userAgent));
  }, []);

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    setError(null);
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > MAX_SIZE_MB * 1024 * 1024) {
      setError(`ファイルサイズは${MAX_SIZE_MB}MB以下にしてください`);
      return;
    }

    setSelectedFile(file);
    setFileName(file.name);
    setStage("selected");

    // Preview for images; PDF shows a placeholder
    if (file.type.startsWith("image/")) {
      const reader = new FileReader();
      reader.onload = (ev) => setPreview(ev.target?.result as string);
      reader.readAsDataURL(file);
    } else {
      setPreview(null);
    }

    // Reset input value so selecting the same file again re-fires onChange
    e.target.value = "";
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
            /* Mobile: camera + file picker */
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
            /* Desktop: file picker only */
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

          <p className="text-xs text-slate-600 text-center">JPEG・PNG・WebP・PDF / 最大10MB</p>
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

          {/* File name + re-select */}
          <div className="flex items-center justify-between gap-2">
            <p className="text-xs text-slate-500 truncate flex-1">{fileName}</p>
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

      {/* Camera input — rendered only on mobile (capture="environment" is a no-op on desktop) */}
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

      {/* File picker — images and PDF */}
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

      {/* ── AI analyzing indicator ────────────────────────────────────── */}
      {isPending && (
        <div className="flex items-center gap-2 px-3 py-2 rounded-lg border border-blue-500/20 bg-blue-500/5">
          <span className="text-blue-400 shrink-0 animate-pulse">⟳</span>
          <p className="text-xs text-blue-400">AI解析中です。しばらくお待ちください...</p>
        </div>
      )}

      {/* ── Action buttons ────────────────────────────────────────────── */}
      <div className="flex gap-2">
        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            disabled={isPending}
            className="flex-1 px-4 py-2 bg-slate-700 hover:bg-slate-600 disabled:opacity-50 text-slate-200 text-sm rounded-lg transition-colors"
          >
            キャンセル
          </button>
        )}
        {stage === "selected" && (
          <button
            type="button"
            onClick={handleAnalyze}
            disabled={!selectedFile || isPending}
            className="flex-1 px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed text-white text-sm font-medium rounded-lg transition-colors"
          >
            {isPending ? "解析中..." : "AI解析開始"}
          </button>
        )}
      </div>
    </div>
  );
}
