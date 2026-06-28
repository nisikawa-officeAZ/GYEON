"use client";

// Reusable image upload field — drag & drop + file picker.
//
// Pipeline (all client-side before upload):
//   1. Accept an image via drag-drop or the file picker.
//   2. Convert JPEG/JPG (or any raster) to PNG and auto-trim uniform borders.
//   3. Upload the processed PNG through a server action that resolves dealer_id
//      server-side (never from the client) and returns the storage path + URL.
//
// The parent only ever receives an internal storage path + a preview URL — the
// user never pastes or sees a raw storage URL. Designed for reuse (logo, stamp,
// and any future dealer asset) via the `slot` + `uploadAction` props.

import { useCallback, useId, useRef, useState } from "react";
import { processImageToTrimmedPng } from "@/lib/media/image-processing";
import type { BrandingSlot } from "@/lib/branding/branding-types";

type UploadResult = { success: true; slot: BrandingSlot; path: string; url: string | null };
type UploadAction = (fd: FormData) => Promise<UploadResult | { error: string }>;

interface ImageUploadFieldProps {
  label:        string;
  slot:         BrandingSlot;
  uploadAction: UploadAction;
  /** Current preview URL (resolved public URL of the stored asset). */
  value:        string | null;
  /** Called after a successful upload with the new storage path + preview URL. */
  onUploaded:   (path: string, url: string | null) => void;
  hint?:        string;
}

export default function ImageUploadField({
  label,
  slot,
  uploadAction,
  value,
  onUploaded,
  hint,
}: ImageUploadFieldProps) {
  const inputId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const [preview, setPreview]   = useState<string | null>(value);
  const [dragging, setDragging] = useState(false);
  const [busy, setBusy]         = useState(false);
  const [error, setError]       = useState<string | null>(null);

  const handleFile = useCallback(
    async (file: File) => {
      setError(null);
      if (!file.type.startsWith("image/")) {
        setError("画像ファイルを選択してください");
        return;
      }
      setBusy(true);
      try {
        // JPEG/JPG → PNG + auto-trim (and normalise every other raster to PNG).
        const processed = await processImageToTrimmedPng(file);
        const pngFile = new File([processed.blob], `${slot}.png`, { type: "image/png" });

        // Optimistic local preview while uploading.
        const localUrl = URL.createObjectURL(processed.blob);
        setPreview(localUrl);

        const fd = new FormData();
        fd.set("slot", slot);
        fd.set("file", pngFile);

        const result = await uploadAction(fd);
        if ("error" in result) {
          setError(result.error);
          setPreview(value);
        } else {
          // Prefer the server-resolved public URL; fall back to local preview.
          setPreview(result.url ?? localUrl);
          onUploaded(result.path, result.url);
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "処理に失敗しました");
        setPreview(value);
      } finally {
        setBusy(false);
      }
    },
    [slot, uploadAction, onUploaded, value],
  );

  const onDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragging(false);
      const file = e.dataTransfer.files?.[0];
      if (file) void handleFile(file);
    },
    [handleFile],
  );

  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-xs font-medium text-slate-400">{label}</label>

      <div
        role="button"
        tabIndex={0}
        onClick={() => inputRef.current?.click()}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            inputRef.current?.click();
          }
        }}
        onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={onDrop}
        className={[
          "flex items-center gap-4 rounded-xl border border-dashed p-3 cursor-pointer transition-colors",
          dragging
            ? "border-blue-500 bg-blue-950/20"
            : "border-slate-700 bg-slate-900 hover:border-slate-500",
        ].join(" ")}
      >
        {/* Preview tile — checkerboard via CSS so transparency is visible */}
        <div
          className="w-16 h-16 rounded-lg grid place-items-center overflow-hidden flex-shrink-0 border border-slate-700"
          style={{
            backgroundColor: "#0b1120",
            backgroundImage:
              "linear-gradient(45deg, #1e293b 25%, transparent 25%), linear-gradient(-45deg, #1e293b 25%, transparent 25%), linear-gradient(45deg, transparent 75%, #1e293b 75%), linear-gradient(-45deg, transparent 75%, #1e293b 75%)",
            backgroundSize: "12px 12px",
            backgroundPosition: "0 0, 0 6px, 6px -6px, -6px 0",
          }}
        >
          {preview ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={preview} alt={label} className="w-full h-full object-contain" />
          ) : (
            <span className="text-slate-600 text-2xl">＋</span>
          )}
        </div>

        <div className="flex flex-col gap-0.5 min-w-0">
          <p className="text-xs text-slate-300">
            {busy ? "処理中…" : "ドラッグ＆ドロップ、またはクリックして選択"}
          </p>
          <p className="text-[10px] text-slate-600">
            PNG / JPEG 対応。JPEGは自動でPNGに変換し、余白を自動トリミングします。
          </p>
          {hint && <p className="text-[10px] text-slate-600">{hint}</p>}
          {error && <p className="text-[10px] text-red-400">{error}</p>}
        </div>

        <input
          ref={inputRef}
          id={inputId}
          type="file"
          accept="image/png,image/jpeg,image/jpg,image/webp"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) void handleFile(file);
            e.target.value = ""; // allow re-selecting the same file
          }}
        />
      </div>
    </div>
  );
}
