// R92B Phase 2 — the PUBLIC estimate-share landing page.
//
// No directive: this is an unauthenticated Server Component reachable at
// /s/e/<token>. It resolves the token server-side and renders one of exactly two
// states — a "view PDF" card, or an indistinguishable "link unavailable" notice.
// It NEVER discloses which failure occurred (revoked vs. expired vs. unknown) and
// leaks no estimate, customer, or dealer data beyond the file itself.

import type { Metadata } from "next";
import { resolveEstimateShare } from "@/lib/estimates/resolve-estimate-share";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

// A public, tokenized share must never be indexed or followed by a crawler — the
// URL itself is the secret.
export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

export default async function EstimateSharePage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const resolved = await resolveEstimateShare(token);

  if (resolved.kind !== "available") {
    return (
      <main
        style={{
          minHeight: "100dvh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: "24px",
          fontFamily: "system-ui, sans-serif",
          background: "#0f172a",
          color: "#e2e8f0",
        }}
      >
        <div style={{ maxWidth: 420, textAlign: "center" }}>
          <h1 style={{ fontSize: 20, fontWeight: 700, marginBottom: 12 }}>
            リンクを表示できません
          </h1>
          <p style={{ fontSize: 14, lineHeight: 1.7, opacity: 0.8 }}>
            この共有リンクは無効か、有効期限が切れているか、取り消されています。
            お手数ですが、送信元にお問い合わせください。
          </p>
        </div>
      </main>
    );
  }

  const fileHref = `/s/e/${encodeURIComponent(token)}/file`;

  return (
    <main
      style={{
        minHeight: "100dvh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "24px",
        fontFamily: "system-ui, sans-serif",
        background: "#0f172a",
        color: "#e2e8f0",
      }}
    >
      <div style={{ maxWidth: 420, width: "100%", textAlign: "center" }}>
        <h1 style={{ fontSize: 20, fontWeight: 700, marginBottom: 8 }}>お見積書</h1>
        <p style={{ fontSize: 14, lineHeight: 1.7, opacity: 0.8, marginBottom: 24 }}>
          下のボタンからお見積書（PDF）をご確認いただけます。
        </p>
        <a
          href={fileHref}
          target="_blank"
          rel="noopener noreferrer"
          style={{
            display: "inline-block",
            padding: "12px 24px",
            borderRadius: 10,
            background: "#38bdf8",
            color: "#0f172a",
            fontWeight: 700,
            fontSize: 15,
            textDecoration: "none",
          }}
        >
          お見積書を開く
        </a>
      </div>
    </main>
  );
}
