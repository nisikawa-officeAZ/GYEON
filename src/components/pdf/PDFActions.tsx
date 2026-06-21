"use client";

import { useState } from "react";

interface PDFActionsProps {
  estimateId?: string;
}

export default function PDFActions({ estimateId }: PDFActionsProps) {
  const [status,    setStatus]    = useState<"idle" | "generating" | "done" | "error">("idle");
  const [signedUrl, setSignedUrl] = useState<string | null>(null);
  const [error,     setError]     = useState<string | null>(null);

  async function handleStorageSave() {
    if (!estimateId) return;
    setStatus("generating");
    setError(null);
    try {
      const { generateEstimatePdf } = await import("@/lib/pdf/generate-estimate-pdf");
      const result = await generateEstimatePdf(estimateId);
      if (result.success && result.signedUrl) {
        setSignedUrl(result.signedUrl);
        setStatus("done");
      } else {
        setError(result.error ?? "エラー");
        setStatus("error");
      }
    } catch (err) {
      setError(String(err));
      setStatus("error");
    }
  }

  const isGenerating = status === "generating";

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap gap-2">
        {/* Print button */}
        <button
          type="button"
          onClick={() => window.print()}
          className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors bg-[#1d4ed8] hover:bg-[#1e40af] text-white"
        >
          <span className="text-base leading-none">⊟</span>
          Print / Save PDF
        </button>

        {/* Storage save button (only when estimateId is provided) */}
        {estimateId && (
          <button
            type="button"
            onClick={handleStorageSave}
            disabled={isGenerating}
            className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors bg-indigo-700 hover:bg-indigo-600 text-white disabled:opacity-50"
          >
            {isGenerating ? (
              <>
                <span className="inline-block w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                生成中...
              </>
            ) : (
              "PDF生成 (Storage保存)"
            )}
          </button>
        )}

        {/* Download link when URL is ready */}
        {signedUrl && (
          <a
            href={signedUrl}
            download
            className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors bg-green-700 hover:bg-green-600 text-white"
          >
            PDFダウンロード
          </a>
        )}
      </div>

      {status === "done" && (
        <p className="text-xs text-green-400">Storage に保存しました</p>
      )}
      {error && (
        <p className="text-xs text-red-400">{error}</p>
      )}
    </div>
  );
}
