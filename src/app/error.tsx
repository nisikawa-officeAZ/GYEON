"use client";

// OBS-1B — root application error boundary.
//
// Covers every segment that does not declare its own boundary. Unlike
// global-error.tsx this renders INSIDE the root layout, so the document shell,
// globals.css and the app palette are available and Tailwind classes are used.
//
// Nothing here reads or renders the thrown value: no message, no stack, no
// digest. The operator gets fixed Japanese copy plus a correlation code.

import { useEffect, useRef, useState } from "react";
import { createObservabilityRequestId } from "@/lib/observability/create-observability-request-id";
import { reportUiErrorOnce } from "@/lib/observability/ui-error-report";

/**
 * `error` is declared because Next supplies it, and is deliberately NOT
 * destructured — only `reset` is bound.
 */
export default function AppError({
  reset,
}: {
  error: Error & { digest?: string };
  reset?: () => void;
}) {
  const [supportCode] = useState(() => createObservabilityRequestId());
  const reported = useRef<string | null>(null);

  useEffect(() => {
    reportUiErrorOnce(reported, supportCode, "app-boundary");
  }, [supportCode]);

  return (
    <div className="min-h-[60vh] flex items-center justify-center px-4 py-10">
      <div role="alert" className="w-full max-w-lg text-center">
        <h1 className="text-xl font-bold mb-3">ページを表示できませんでした</h1>
        <p className="text-sm leading-7 text-slate-300 mb-5">
          一時的な問題が発生しました。再試行しても解決しない場合は、サポート番号をお知らせください。
        </p>
        <p className="inline-block rounded-md bg-slate-800 px-3 py-2 mb-5 font-mono text-xs text-slate-300">
          サポート番号: {supportCode}
        </p>
        <div className="flex flex-wrap gap-3 justify-center">
          {reset ? (
            <button
              type="button"
              onClick={reset}
              className="rounded-md border border-slate-600 bg-slate-800 px-5 py-2.5 text-sm hover:bg-slate-700"
            >
              もう一度試す
            </button>
          ) : null}
          <a
            href="/"
            className="rounded-md border border-slate-600 bg-slate-800 px-5 py-2.5 text-sm hover:bg-slate-700"
          >
            ホームへ戻る
          </a>
        </div>
      </div>
    </div>
  );
}
