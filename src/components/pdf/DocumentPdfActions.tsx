"use client";

import { useState } from "react";
import { DocumentFileDB, DocumentType } from "@/lib/documents/document-file-types";

interface DocumentPdfActionsProps {
  documentType:   DocumentType;
  documentId:     string;
  documentNumber: string;
  existingFile?:  DocumentFileDB | null;
  onGenerate:     () => Promise<{ success: boolean; signedUrl?: string; error?: string }>;
}

export default function DocumentPdfActions({
  existingFile,
  onGenerate,
}: DocumentPdfActionsProps) {
  const [status,    setStatus]    = useState<"idle" | "generating" | "done" | "error">("idle");
  const [signedUrl, setSignedUrl] = useState<string | null>(null);
  const [error,     setError]     = useState<string | null>(null);

  async function handleGenerate() {
    setStatus("generating");
    setError(null);
    try {
      const result = await onGenerate();
      if (result.success && result.signedUrl) {
        setSignedUrl(result.signedUrl);
        setStatus("done");
      } else {
        setError(result.error ?? "エラーが発生しました");
        setStatus("error");
      }
    } catch (err) {
      setError(String(err));
      setStatus("error");
    }
  }

  async function handleCopyUrl() {
    if (!signedUrl) return;
    try {
      await navigator.clipboard.writeText(signedUrl);
    } catch {
      // clipboard access may be denied
    }
  }

  const isGenerating = status === "generating";
  const hasUrl = signedUrl !== null;

  return (
    <div className="flex flex-col gap-2">
      {/* Buttons */}
      <div className="flex flex-wrap gap-2 items-center">
        <button
          type="button"
          onClick={handleGenerate}
          disabled={isGenerating}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md bg-indigo-700 hover:bg-indigo-600 text-white transition-colors disabled:opacity-50"
        >
          {isGenerating ? (
            <>
              <span className="inline-block w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              生成中...
            </>
          ) : existingFile ? (
            "PDF再生成"
          ) : (
            "PDF生成"
          )}
        </button>

        {hasUrl && (
          <>
            <a
              href={signedUrl}
              download
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md bg-green-700 hover:bg-green-600 text-white transition-colors"
            >
              PDFダウンロード
            </a>
            <button
              type="button"
              onClick={handleCopyUrl}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md border border-slate-600 text-slate-300 hover:text-slate-100 hover:border-slate-400 transition-colors"
            >
              URLコピー
            </button>
          </>
        )}
      </div>

      {/* Status info */}
      {existingFile && status === "idle" && (
        <p className="text-[10px] text-slate-500">
          最終生成: {new Date(existingFile.created_at).toLocaleString("ja-JP")}
          {existingFile.signed_url_expires_at && (
            <> / URL有効期限: {new Date(existingFile.signed_url_expires_at).toLocaleString("ja-JP")}</>
          )}
        </p>
      )}

      {status === "done" && (
        <p className="text-[10px] text-green-400">PDF生成完了 — Storage に保存しました</p>
      )}

      {/* Error */}
      {error && (
        <p className="text-[10px] text-red-400">{error}</p>
      )}
    </div>
  );
}
