"use client";

// OBS-1B — root global error boundary.
//
// This replaces Next's built-in fallback, which renders English technical text
// and PRINTS `error.digest` on screen. A digest is a server-log correlation hash
// the operator cannot resolve and must never be shown.
//
// ── WHY THIS FILE RENDERS ITS OWN DOCUMENT ──────────────────────────────────
// A global error means the root layout itself failed, so `src/app/layout.tsx` is
// NOT rendered and its `<html>`/`<body>`, `globals.css` and font variables do not
// exist. This component must therefore supply the document shell itself, and
// styling is INLINE for the same reason: a stylesheet the failed layout was
// responsible for loading cannot be relied upon here.

import { useEffect, useRef, useState } from "react";
import { createObservabilityRequestId } from "@/lib/observability/create-observability-request-id";
import { reportUiErrorOnce } from "@/lib/observability/ui-error-report";

const page: React.CSSProperties = {
  minHeight: "100vh", margin: 0, display: "flex", alignItems: "center",
  justifyContent: "center", padding: "24px",
  backgroundColor: "#080d1a", color: "#e2e8f0",
  fontFamily: 'system-ui,-apple-system,"Segoe UI",Roboto,"Helvetica Neue",Arial,sans-serif',
};
const card: React.CSSProperties = { maxWidth: "32rem", width: "100%", textAlign: "center" };
const title: React.CSSProperties = { fontSize: "1.25rem", fontWeight: 700, margin: "0 0 12px" };
const body: React.CSSProperties = { fontSize: "0.9375rem", lineHeight: 1.8, margin: "0 0 20px" };
const codeBox: React.CSSProperties = {
  display: "inline-block", padding: "8px 12px", marginBottom: "20px",
  borderRadius: "6px", backgroundColor: "#111a2e", color: "#cbd5e1",
  fontFamily: "ui-monospace,SFMono-Regular,Menlo,monospace", fontSize: "0.8125rem",
};
const actions: React.CSSProperties = { display: "flex", gap: "12px", justifyContent: "center", flexWrap: "wrap" };
const button: React.CSSProperties = {
  padding: "10px 20px", borderRadius: "6px", border: "1px solid #334155",
  backgroundColor: "#1e293b", color: "#e2e8f0", fontSize: "0.875rem", cursor: "pointer",
};
const link: React.CSSProperties = { ...button, textDecoration: "none", display: "inline-block" };

/**
 * `error` is declared because Next supplies it, and is deliberately NOT
 * destructured: nothing in this component may read its message, stack or digest.
 * Only `reset` is bound.
 */
export default function GlobalError({
  reset,
}: {
  error: Error & { digest?: string };
  reset?: () => void;
}) {
  const [supportCode] = useState(() => createObservabilityRequestId());
  const reported = useRef<string | null>(null);

  useEffect(() => {
    reportUiErrorOnce(reported, supportCode, "global-boundary");
  }, [supportCode]);

  return (
    <html lang="ja">
      <body style={page}>
        <div role="alert" style={card}>
          <h1 style={title}>システムエラーが発生しました</h1>
          <p style={body}>
            処理を続けられませんでした。再試行しても解決しない場合は、サポート番号をお知らせください。
          </p>
          <p style={codeBox}>サポート番号: {supportCode}</p>
          <div style={actions}>
            {reset ? (
              <button type="button" onClick={reset} style={button}>
                もう一度試す
              </button>
            ) : null}
            <a href="/" style={link}>
              ホームへ戻る
            </a>
          </div>
        </div>
      </body>
    </html>
  );
}
