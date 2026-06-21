"use client";

// Shows LINE connection status for a customer.
// Used in CustomerTable and CustomerDetail.

interface LineStatusBadgeProps {
  connected:    boolean;
  displayName?: string | null;
  customerId:   string;
  liffId?:      string | null;
}

export default function LineStatusBadge({
  connected,
  displayName,
  customerId,
  liffId,
}: LineStatusBadgeProps) {
  const resolvedLiffId = liffId ?? process.env.NEXT_PUBLIC_LINE_LIFF_ID ?? "";

  if (connected) {
    return (
      <span className="inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded bg-green-500/10 text-green-400 border border-green-500/20">
        <span>●</span>
        <span>{displayName ?? "Connected"}</span>
      </span>
    );
  }

  if (!resolvedLiffId) {
    return <span className="text-[10px] text-slate-600">未連携</span>;
  }

  const liffUrl = `https://liff.line.me/${resolvedLiffId}?customer_id=${customerId}`;

  return (
    <a
      href={liffUrl}
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded bg-[#06C755]/10 text-[#06C755] border border-[#06C755]/20 hover:bg-[#06C755]/20 transition-colors"
      onClick={(e) => e.stopPropagation()}
    >
      LINE連携
    </a>
  );
}
