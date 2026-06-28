"use client";

// Stamp field — standardized upload + AI(procedural) generation with a
// true print-size preview. Guarantees the saved stamp is a transparent PNG at
// the standard physical size (square 20mm / round 18mm); dealers never resize.

import { useCallback, useEffect, useRef, useState } from "react";
import { processStampImage } from "@/lib/media/stamp-processing";
import { generateSealStamp, sealPreviewDataUrl } from "@/lib/media/stamp-generate";
import { SEAL_STYLES, sealStyle } from "@/lib/media/stamp-styles";
import { uploadBrandingImage } from "@/lib/branding/upload-branding-image";
import { STAMP_SPECS, mmToCssPx, type StampKind } from "@/lib/stamp/stamp-types";

interface StampFieldProps {
  value:     string | null;   // current stamp preview URL
  valueKind: StampKind | null;
  onSaved:   (path: string, url: string | null, kind: StampKind) => void;
}

function TrueSizePreview({ url, kind }: { url: string | null; kind: StampKind }) {
  const spec = STAMP_SPECS[kind];
  const cssPx = mmToCssPx(spec.mm);
  return (
    <div className="flex items-center gap-3">
      <div
        className="grid place-items-center overflow-hidden rounded-sm border border-dashed border-slate-600 bg-white"
        style={{ width: cssPx, height: cssPx }}
        title="実寸プレビュー"
      >
        {url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={url} alt="stamp" className="w-full h-full object-contain" />
        ) : (
          <span className="text-[9px] text-slate-400">未設定</span>
        )}
      </div>
      <div className="text-[10px] text-slate-500 leading-relaxed">
        <p className="text-slate-300 font-medium">{spec.label}</p>
        <p>実寸 {spec.mm}mm{kind === "square" ? ` × ${spec.mm}mm` : " 直径"}</p>
        <p>印刷時はこのサイズで出力されます</p>
      </div>
    </div>
  );
}

export default function StampField({ value, valueKind, onSaved }: StampFieldProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const lastFile = useRef<File | null>(null);

  const [tab, setTab]       = useState<"upload" | "generate">("upload");
  const [kind, setKind]     = useState<StampKind>(valueKind ?? "square");
  const [preview, setPreview] = useState<string | null>(value);
  const [busy, setBusy]     = useState(false);
  const [error, setError]   = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);
  const [genText, setGenText] = useState("");
  const [styleId, setStyleId] = useState<string>(SEAL_STYLES[0].id);
  const [stylePreviews, setStylePreviews] = useState<Record<string, string>>({});

  // Live mini-previews of all 10 styles for the current text (generate tab only).
  useEffect(() => {
    if (tab !== "generate") return;
    const map: Record<string, string> = {};
    for (const s of SEAL_STYLES) map[s.id] = sealPreviewDataUrl(s.id, genText, 72);
    setStylePreviews(map);
  }, [tab, genText]);

  const upload = useCallback(async (blob: Blob, k: StampKind) => {
    const localUrl = URL.createObjectURL(blob);
    setPreview(localUrl);
    const fd = new FormData();
    fd.set("slot", "stamp");
    fd.set("file", new File([blob], "stamp.png", { type: "image/png" }));
    const res = await uploadBrandingImage(fd);
    if ("error" in res) { setError(res.error); return; }
    setPreview(res.url ?? localUrl);
    onSaved(res.path, res.url, k);
  }, [onSaved]);

  const handleFile = useCallback(async (file: File, forced?: StampKind) => {
    setError(null);
    if (!/image\/(png|jpe?g|webp)/i.test(file.type)) {
      setError("PNG / JPG / JPEG / WEBP を選択してください");
      return;
    }
    lastFile.current = file;
    setBusy(true);
    try {
      const result = await processStampImage(file, forced);
      setKind(result.kind);
      await upload(result.blob, result.kind);
    } catch (err) {
      setError(err instanceof Error ? err.message : "処理に失敗しました");
    } finally {
      setBusy(false);
    }
  }, [upload]);

  // Re-normalize the already-chosen file when the user overrides the shape.
  const overrideKind = useCallback(async (k: StampKind) => {
    setKind(k);
    if (tab === "upload" && lastFile.current) {
      setBusy(true);
      try {
        const result = await processStampImage(lastFile.current, k);
        await upload(result.blob, k);
      } finally { setBusy(false); }
    }
  }, [tab, upload]);

  const handleGenerate = useCallback(async () => {
    setError(null);
    if (!genText.trim()) { setError("印影に入れる文字を入力してください"); return; }
    setBusy(true);
    try {
      const result = await generateSealStamp({ styleId, text: genText });
      setKind(result.kind);           // style determines square/round → correct physical size
      await upload(result.blob, result.kind);
    } catch (err) {
      setError(err instanceof Error ? err.message : "生成に失敗しました");
    } finally { setBusy(false); }
  }, [genText, styleId, upload]);

  const tabBtn = (id: "upload" | "generate", label: string) => (
    <button
      type="button"
      onClick={() => { setTab(id); setError(null); }}
      className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${
        tab === id ? "bg-blue-600/20 text-blue-300 border border-blue-700/40" : "text-slate-400 hover:text-slate-200"
      }`}
    >
      {label}
    </button>
  );

  const kindBtn = (k: StampKind, label: string) => (
    <button
      type="button"
      onClick={() => overrideKind(k)}
      disabled={busy}
      className={`px-2.5 py-1 text-[11px] rounded-full border transition-colors disabled:opacity-50 ${
        kind === k ? "bg-blue-600/20 text-blue-300 border-blue-700/40" : "bg-slate-900 text-slate-400 border-slate-700 hover:text-slate-200"
      }`}
    >
      {label}
    </button>
  );

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <label className="text-xs font-medium text-slate-400">印影スタンプ</label>
        <div className="flex gap-1">{tabBtn("upload", "アップロード")}{tabBtn("generate", "生成")}</div>
      </div>

      {/* Shape selector — upload tab only (generate derives shape from the style) */}
      {tab === "upload" && (
        <div className="flex items-center gap-2">
          <span className="text-[10px] text-slate-500">種類:</span>
          {kindBtn("square", "角印 20mm")}
          {kindBtn("round", "丸印 18mm")}
        </div>
      )}

      {tab === "upload" ? (
        <div
          role="button"
          tabIndex={0}
          onClick={() => inputRef.current?.click()}
          onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); inputRef.current?.click(); } }}
          onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
          onDragLeave={() => setDragging(false)}
          onDrop={(e) => { e.preventDefault(); setDragging(false); const f = e.dataTransfer.files?.[0]; if (f) void handleFile(f); }}
          className={`rounded-xl border border-dashed p-3 cursor-pointer transition-colors ${dragging ? "border-blue-500 bg-blue-950/20" : "border-slate-700 bg-slate-900 hover:border-slate-500"}`}
        >
          <p className="text-xs text-slate-300">{busy ? "処理中…" : "ドラッグ＆ドロップ、またはクリックして選択"}</p>
          <p className="text-[10px] text-slate-600 mt-0.5">
            PNG / JPG / JPEG / WEBP 対応。背景を自動で透過処理し、余白をトリミングして規定サイズに自動調整します。
          </p>
          <input
            ref={inputRef}
            type="file"
            accept="image/png,image/jpeg,image/jpg,image/webp"
            className="hidden"
            onChange={(e) => { const f = e.target.files?.[0]; if (f) void handleFile(f); e.target.value = ""; }}
          />
        </div>
      ) : (
        <div className="flex flex-col gap-3 rounded-xl border border-slate-700 bg-slate-900 p-3">
          <input
            value={genText}
            onChange={(e) => setGenText(e.target.value)}
            placeholder="文字を入力（会社名 例: 株式会社GYEON / 氏名 例: 山田）"
            className="w-full bg-[#0b1120] border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-100 placeholder:text-slate-600 focus:outline-none focus:ring-1 focus:ring-blue-600"
          />

          {/* 10-style selection */}
          <div>
            <p className="text-[10px] text-slate-500 mb-1.5">スタイルを選択(10種)</p>
            <div className="grid grid-cols-5 gap-2">
              {SEAL_STYLES.map((s) => {
                const selected = styleId === s.id;
                return (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => { setStyleId(s.id); setKind(sealStyle(s.id).shape); }}
                    title={s.label}
                    className={`flex flex-col items-center gap-1 rounded-lg border p-1.5 transition-colors ${
                      selected ? "border-blue-500 bg-blue-950/30" : "border-slate-700 bg-[#0b1120] hover:border-slate-500"
                    }`}
                  >
                    <span className="w-full aspect-square grid place-items-center rounded bg-white overflow-hidden">
                      {stylePreviews[s.id] && (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={stylePreviews[s.id]} alt={s.label} className="w-full h-full object-contain" />
                      )}
                    </span>
                    <span className="text-[8px] text-slate-400 leading-none text-center truncate w-full">{s.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          <button
            type="button"
            onClick={handleGenerate}
            disabled={busy}
            className="self-start px-3 py-1.5 text-xs font-semibold rounded-lg bg-blue-700 hover:bg-blue-600 disabled:opacity-50 text-white"
          >
            {busy ? "生成中…" : "この印影を生成・保存"}
          </button>
          <p className="text-[10px] text-slate-600">日本の印鑑スタイルで透過PNGを生成し、規定サイズ(角印20mm/丸印18mm)に自動調整します。</p>
        </div>
      )}

      {/* True print-size preview */}
      <TrueSizePreview url={preview} kind={kind} />

      {error && <p className="text-[10px] text-red-400">{error}</p>}
    </div>
  );
}
