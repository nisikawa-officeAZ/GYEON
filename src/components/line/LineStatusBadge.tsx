"use client";

// Shows LINE connection status for a customer.
// Used in CustomerTable and CustomerDetail.
//
// GYEON-LINE-SETUP-F2: the link is no longer built in the browser. Pressing
// 「LINE連携」 asks the server to mint a single-use, expiring, dealer-scoped token
// and returns the finished LIFF URL. The component never sees a LIFF ID, a
// dealer id, or an environment fallback — a customer id alone can no longer
// produce a link.
//
// F2-F1-04: the minted URL is held in state and surfaced as an explicit anchor
// plus a copy button. Opening a window straight out of the awaited action would
// be an asynchronous popup, which browsers block — the operator would burn a
// token and never see the link.

import { useState, useTransition } from "react";

import { createLineLinkToken } from "@/lib/line/create-line-link-token";

interface LineStatusBadgeProps {
  connected: boolean;
  displayName?: string | null;
  customerId: string;
}

export default function LineStatusBadge({
  connected,
  displayName,
  customerId,
}: LineStatusBadgeProps) {
  const [pending, startTransition] = useTransition();
  const [liffUrl, setLiffUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  if (connected) {
    return (
      <span className="inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded bg-green-500/10 text-green-400 border border-green-500/20">
        <span>●</span>
        <span>{displayName ?? "Connected"}</span>
      </span>
    );
  }

  function handleMint(e: React.MouseEvent) {
    e.stopPropagation();
    setError(null);
    setCopied(false);

    startTransition(async () => {
      const result = await createLineLinkToken(customerId);

      if (result.kind === "created") {
        // Held in state only. The operator opens or copies it with a second,
        // deliberate gesture — see the note at the top of this file.
        setLiffUrl(result.liffUrl);
        return;
      }

      setError(result.kind === "liff-not-configured" ? "LIFF未設定" : "発行できません");
    });
  }

  function handleCopy(e: React.MouseEvent) {
    e.stopPropagation();
    if (!liffUrl) return;
    // The link is never logged; it only moves to the clipboard.
    void navigator.clipboard.writeText(liffUrl).then(
      () => setCopied(true),
      () => setCopied(false)
    );
  }

  if (liffUrl) {
    return (
      <span className="inline-flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
        <a
          href={liffUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded bg-[#06C755]/10 text-[#06C755] border border-[#06C755]/20 hover:bg-[#06C755]/20 transition-colors"
        >
          連携リンクを開く
        </a>
        <button
          type="button"
          onClick={handleCopy}
          className="text-[10px] px-1.5 py-0.5 rounded border border-slate-600 text-slate-300 hover:bg-slate-700/40 transition-colors"
        >
          {copied ? "コピー済み" : "コピー"}
        </button>
      </span>
    );
  }

  if (error) {
    return <span className="text-[10px] text-red-400">{error}</span>;
  }

  return (
    <button
      type="button"
      onClick={handleMint}
      disabled={pending}
      className="inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded bg-[#06C755]/10 text-[#06C755] border border-[#06C755]/20 hover:bg-[#06C755]/20 transition-colors disabled:opacity-50"
    >
      {pending ? "発行中..." : "LINE連携"}
    </button>
  );
}
