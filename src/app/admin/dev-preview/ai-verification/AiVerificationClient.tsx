"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { testGyeonOpenAiConnection } from "@/lib/ai/gyeon-ai-center";
import type { AiVerificationSnapshot } from "@/lib/ai/dev-preview-checks";
import { formatUsd } from "@/lib/ai/ai-pricing";

function fmt(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  return Number.isNaN(d.getTime())
    ? "—"
    : d.toLocaleString("ja-JP", { year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" });
}

function Check({ ok, label, detail }: { ok: boolean; label: string; detail?: string }) {
  return (
    <div className="flex items-center justify-between gap-3 px-3 py-2 rounded border border-slate-800 bg-slate-900/40">
      <div className="flex items-center gap-2">
        <span className={`text-sm ${ok ? "text-green-400" : "text-red-400"}`}>{ok ? "✓" : "✕"}</span>
        <span className="text-xs text-slate-300">{label}</span>
      </div>
      <span className="text-[11px] text-slate-500">{detail ?? (ok ? "OK" : "未")}</span>
    </div>
  );
}

export default function AiVerificationClient({ snapshot }: { snapshot: AiVerificationSnapshot }) {
  const [snap] = useState(snapshot);
  const [testMsg, setTestMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [isTesting, startTest] = useTransition();

  const connOk = snap.connectionState === "success";

  function handleTest() {
    setTestMsg(null);
    startTest(async () => {
      const res = await testGyeonOpenAiConnection();
      if (res.success) {
        setTestMsg({
          ok: res.status === "success",
          text: res.status === "success" ? "接続成功" : "接続失敗（APIキーを確認してください）",
        });
      } else {
        setTestMsg({ ok: false, text: res.error });
      }
    });
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-lg font-semibold text-slate-100">AI検証</h1>
          <p className="text-xs text-slate-500 mt-0.5">AIキー・接続・OCR・利用ログ・概算コストを1画面で確認</p>
        </div>
        <button
          type="button"
          onClick={handleTest}
          disabled={isTesting || !snap.keyExists}
          className="rounded border border-slate-600 hover:border-slate-400 disabled:opacity-40 px-3 py-1.5 text-xs font-medium text-slate-200 transition-colors"
        >
          {isTesting ? "確認中…" : "接続テスト"}
        </button>
      </div>

      {/* Key-missing CTA — link straight to AI Center (no menu hunting) */}
      {!snap.keyExists && (
        <div className="rounded-lg border border-amber-800/40 bg-amber-900/20 px-4 py-3 flex items-center justify-between gap-3">
          <div className="text-xs text-amber-200">
            OpenAI APIキーが未登録です。AIセンターから登録してください。
          </div>
          <Link
            href="/admin/ai-center"
            className="shrink-0 rounded bg-blue-600 hover:bg-blue-500 px-3 py-1.5 text-xs font-medium text-white"
          >
            AIセンターを開く
          </Link>
        </div>
      )}

      {testMsg && (
        <div className={`text-xs rounded px-3 py-2 border ${
          testMsg.ok ? "text-green-300 bg-green-900/20 border-green-800/40" : "text-red-300 bg-red-900/20 border-red-800/40"
        }`}>
          {testMsg.text}
        </div>
      )}

      {/* One-screen checklist */}
      <section className="rounded-lg border border-slate-800 bg-[#0b1120] p-4 space-y-2">
        <Check ok={snap.keyExists}        label="AIキー登録" detail={snap.keyExists ? `${snap.maskedKey} (${snap.source === "db" ? "DB" : "env"})` : "未登録"} />
        <Check ok={connOk}                label="OpenAI接続" detail={snap.connectionState === "success" ? "接続成功" : snap.connectionState === "failed" ? "接続失敗" : "未テスト"} />
        <Check ok={snap.ocrAvailable}     label="OCR利用可能" detail={snap.ocrAvailable ? "利用可" : "キー未登録"} />
        <Check ok={snap.usageTableExists} label="利用ログテーブル" detail={snap.usageTableExists ? "適用済み" : "未適用 (migration 095)"} />
      </section>

      {/* Provider detail (Part 2) */}
      <section className="rounded-lg border border-slate-800 bg-[#0b1120] p-4">
        <h2 className="text-sm font-semibold text-slate-200 mb-3">AIプロバイダ詳細</h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-x-4 gap-y-3 text-xs">
          {[
            { l: "プロバイダ",     v: snap.provider },
            { l: "接続",          v: snap.connectionState === "success" ? "接続成功" : snap.connectionState === "failed" ? "接続失敗" : "未テスト" },
            { l: "現在モデル",     v: snap.currentModel },
            { l: "APIソース",     v: snap.source === "db" ? "DB (AIセンター)" : snap.source === "env" ? "ENV (環境変数)" : "—" },
            { l: "最終応答時間",   v: snap.lastResponseMs != null ? `${snap.lastResponseMs} ms` : "—" },
            { l: "推定レイテンシ", v: snap.avgLatencyMs != null ? `${snap.avgLatencyMs} ms` : "—" },
            { l: "本日の呼び出し", v: `${snap.dailyCalls} 件` },
            { l: "今月の呼び出し", v: `${snap.monthlyCalls} 件` },
            { l: "今月トークン",   v: snap.monthlyTokens.toLocaleString() },
            { l: "今月概算コスト", v: `${formatUsd(snap.estimatedMonthlyCostUsd)} (概算)` },
          ].map((m) => (
            <div key={m.l} className="min-w-0">
              <div className="text-slate-500 text-[10px] mb-0.5">{m.l}</div>
              <div className="text-slate-200 truncate">{m.v}</div>
            </div>
          ))}
        </div>
      </section>

      {/* Last calls */}
      <section className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
        <div className="rounded border border-slate-800 bg-slate-900/40 px-3 py-2">
          <div className="text-slate-500 text-[10px] mb-1">最終OCR</div>
          <div className="text-slate-200">{fmt(snap.lastOcr?.created_at ?? null)}</div>
          {snap.lastOcr && (
            <div className={`text-[10px] mt-0.5 ${snap.lastOcr.status === "success" ? "text-green-400" : "text-red-400"}`}>
              {snap.lastOcr.status} · {snap.lastOcr.model ?? "—"}
            </div>
          )}
        </div>
        <div className="rounded border border-slate-800 bg-slate-900/40 px-3 py-2">
          <div className="text-slate-500 text-[10px] mb-1">最終AI呼び出し</div>
          <div className="text-slate-200">{fmt(snap.lastAiCall?.created_at ?? null)}</div>
          {snap.lastAiCall && (
            <div className="text-[10px] text-slate-500 mt-0.5">{snap.lastAiCall.feature_key}</div>
          )}
        </div>
      </section>

      <div className="flex gap-3">
        <Link href="/admin/dev-preview/checklist" className="text-xs text-slate-400 hover:text-slate-200 underline">
          → Developer Preview チェックリスト
        </Link>
        <Link href="/admin/ai-center" className="text-xs text-slate-400 hover:text-slate-200 underline">
          → AIセンター
        </Link>
      </div>
    </div>
  );
}
