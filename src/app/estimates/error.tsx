"use client";

// OBS-1B — estimates segment error boundary.
//
// Exists for its COPY, not for coverage: the root boundary would already catch
// these failures. The estimate wizard holds unsaved operator input, so a crash
// here has a consequence the generic message cannot convey, and the operator
// needs to be told plainly that input may be lost before they retry.
//
// Nothing here reads or renders the thrown value: no message, no stack, no digest.

import { useEffect, useRef, useState } from "react";
import { createObservabilityRequestId } from "@/lib/observability/create-observability-request-id";
import { reportUiErrorOnce } from "@/lib/observability/ui-error-report";

/**
 * `error` is declared because Next supplies it, and is deliberately NOT
 * destructured — only `reset` is bound.
 */
export default function EstimatesError({
  reset,
}: {
  error: Error & { digest?: string };
  reset?: () => void;
}) {
  const [supportCode] = useState(() => createObservabilityRequestId());
  const reported = useRef<string | null>(null);

  useEffect(() => {
    reportUiErrorOnce(reported, supportCode, "estimates-boundary");
  }, [supportCode]);

  return (
    <div className="min-h-[60vh] flex items-center justify-center px-4 py-10">
      <div role="alert" className="w-full max-w-lg text-center">
        <h1 className="text-xl font-bold mb-3">見積画面でエラーが発生しました</h1>
        <p className="text-sm leading-7 text-slate-300 mb-5">
          入力内容は保存されていない可能性があります。再試行しても解決しない場合は、サポート番号をお知らせください。
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
