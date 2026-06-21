"use client";

// PHASE67: Vehicle Registration Upload Component
// Handles image selection, upload, OCR trigger, and passes result to parent.

import { useRef, useState, useTransition } from "react";
import { uploadAndAnalyzeVehicleRegistration } from "@/lib/vehicle-registration/actions";
import { VehicleRegistrationOcrResult }         from "@/lib/vehicle-registration/vehicle-registration-types";

interface Props {
  customerId?:  string;
  vehicleId?:   string;
  estimateId?:  string;
  onComplete:   (result: VehicleRegistrationOcrResult) => void;
  onCancel?:    () => void;
}

const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp"];
const MAX_SIZE_MB   = 10;

export default function VehicleRegistrationUpload({
  customerId,
  vehicleId,
  estimateId,
  onComplete,
  onCancel,
}: Props) {
  const inputRef             = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [fileName, setFileName] = useState<string>("");
  const [error, setError]    = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    setError(null);
    const file = e.target.files?.[0];
    if (!file) return;

    if (!ALLOWED_TYPES.includes(file.type)) {
      setError("対応形式はJPEG、PNG、WebPのみです");
      return;
    }
    if (file.size > MAX_SIZE_MB * 1024 * 1024) {
      setError(`ファイルサイズは${MAX_SIZE_MB}MB以下にしてください`);
      return;
    }

    setFileName(file.name);

    const reader = new FileReader();
    reader.onload = (ev) => setPreview(ev.target?.result as string);
    reader.readAsDataURL(file);
  }

  function handleAnalyze() {
    if (!inputRef.current?.files?.[0]) return;
    setError(null);

    const file = inputRef.current.files[0];
    const fd   = new FormData();
    fd.append("file", file);
    if (customerId)  fd.append("customer_id",  customerId);
    if (vehicleId)   fd.append("vehicle_id",   vehicleId);
    if (estimateId)  fd.append("estimate_id",  estimateId);

    startTransition(async () => {
      const result = await uploadAndAnalyzeVehicleRegistration(fd);
      if (!result.success) {
        setError(result.error ?? "車検証を読み取れませんでした。画像を確認してください。");
        return;
      }
      onComplete(result.ocrResult);
    });
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Drop / click area */}
      <div
        onClick={() => !isPending && inputRef.current?.click()}
        className={`
          flex flex-col items-center justify-center gap-3 min-h-[160px] rounded-xl border-2 border-dashed
          transition-colors cursor-pointer
          ${isPending
            ? "border-slate-700 bg-slate-800/30 cursor-not-allowed"
            : preview
            ? "border-blue-500/40 bg-blue-950/10"
            : "border-slate-700 hover:border-slate-500 bg-[#0f172a] hover:bg-slate-800/30"
          }
        `}
      >
        {preview ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={preview}
            alt="車検証プレビュー"
            className="max-h-48 max-w-full rounded-lg object-contain"
          />
        ) : (
          <>
            <div className="text-3xl text-slate-500">📄</div>
            <p className="text-sm text-slate-400 text-center px-4">
              車検証を撮影またはアップロード
            </p>
            <p className="text-xs text-slate-600">JPEG・PNG・WebP / 最大10MB</p>
          </>
        )}
      </div>

      {fileName && !isPending && (
        <p className="text-xs text-slate-500 truncate">{fileName}</p>
      )}

      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        className="hidden"
        onChange={handleFileChange}
        disabled={isPending}
      />

      {error && (
        <div className={`flex items-start gap-2 px-3 py-2 rounded-lg border text-xs ${
          error.includes("未設定") || error.includes("未作成") || error.includes("未適用")
            ? "border-amber-500/30 bg-amber-500/10 text-amber-300"
            : "border-red-500/30 bg-red-500/10 text-red-400"
        }`}>
          <span className="shrink-0">{error.includes("未設定") || error.includes("未作成") || error.includes("未適用") ? "⚠" : "✕"}</span>
          <p>{error}</p>
        </div>
      )}

      {isPending && (
        <div className="flex items-center gap-2 px-3 py-2 rounded-lg border border-blue-500/20 bg-blue-500/5">
          <span className="text-blue-400 shrink-0 animate-pulse text-sm">⟳</span>
          <p className="text-xs text-blue-400">AI解析中です。しばらくお待ちください...</p>
        </div>
      )}

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
        <button
          type="button"
          onClick={handleAnalyze}
          disabled={!preview || isPending}
          className="flex-1 px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed text-white text-sm font-medium rounded-lg transition-colors"
        >
          {isPending ? "解析中..." : "AI解析開始"}
        </button>
      </div>
    </div>
  );
}
