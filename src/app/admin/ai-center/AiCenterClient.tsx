"use client";

import { useState, useTransition } from "react";
import {
  saveGyeonOpenAiKey,
  testGyeonOpenAiConnection,
  getGyeonAiCenterStatus,
} from "@/lib/ai/gyeon-ai-center";
import type { GyeonAiCenterStatus, GyeonConnectionState, GyeonAiUsageSummary } from "@/lib/ai/gyeon-ai-center";
import {
  GYEON_MANAGED_FEATURE_LABELS_JA,
  DEALER_MANAGED_FEATURE_LABELS_JA,
} from "@/lib/ai/ownership";
import { AI_PROVIDERS } from "@/lib/ai/ai-providers";

function formatDateTime(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString("ja-JP", {
    year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit",
  });
}

const CONNECTION_BADGE: Record<GyeonConnectionState, { label: string; className: string }> = {
  unset:   { label: "未設定",   className: "text-slate-400 bg-slate-800 border-slate-700" },
  success: { label: "接続成功", className: "text-green-300 bg-green-900/40 border-green-700/50" },
  failed:  { label: "接続失敗", className: "text-red-300 bg-red-900/40 border-red-700/50" },
};

export default function AiCenterClient({
  isSuperAdmin,
  initialStatus,
  initialUsage,
}: {
  isSuperAdmin: boolean;
  initialStatus: GyeonAiCenterStatus | null;
  initialUsage: GyeonAiUsageSummary | null;
}) {
  const [status, setStatus] = useState<GyeonAiCenterStatus | null>(initialStatus);
  const [keyInput, setKeyInput] = useState("");
  const [message, setMessage] = useState<{ kind: "ok" | "error"; text: string } | null>(null);
  const [isSaving, startSave] = useTransition();
  const [isTesting, startTest] = useTransition();

  async function refreshStatus() {
    try {
      const next = await getGyeonAiCenterStatus();
      setStatus(next);
    } catch {
      /* status refresh is best-effort */
    }
  }

  function handleSave() {
    setMessage(null);
    startSave(async () => {
      const res = await saveGyeonOpenAiKey(keyInput);
      if (res.success) {
        setKeyInput("");
        setMessage({ kind: "ok", text: "APIキーを保存しました。" });
        await refreshStatus();
      } else {
        setMessage({ kind: "error", text: res.error });
      }
    });
  }

  function handleTest() {
    setMessage(null);
    startTest(async () => {
      const res = await testGyeonOpenAiConnection();
      if (res.success) {
        setMessage({
          kind: res.status === "success" ? "ok" : "error",
          text: res.status === "success" ? "接続に成功しました。" : "接続に失敗しました。APIキーを確認してください。",
        });
        await refreshStatus();
      } else {
        setMessage({ kind: "error", text: res.error });
      }
    });
  }

  const badge = status ? CONNECTION_BADGE[status.connectionState] : CONNECTION_BADGE.unset;

  return (
    <div className="space-y-6">
      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div>
        <h1 className="text-lg font-semibold text-slate-100">AIセンター</h1>
        <p className="text-xs text-slate-500 mt-0.5">
          GYEON管理のAI設定とAPIキー管理
        </p>
      </div>

      {/* ── OpenAI key management (Super Admin only) ───────────────────────── */}
      {isSuperAdmin && status ? (
        <section className="rounded-lg border border-slate-800 bg-[#0b1120] p-5 space-y-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="text-sm font-semibold text-slate-200">OpenAI APIキー管理</h2>
              <p className="text-[11px] text-slate-500 mt-0.5">
                GYEON管理キー。OCRなどGYEON提供AIで使用します。
              </p>
            </div>
            <span className={`text-[11px] font-semibold px-2.5 py-1 rounded-full border ${badge.className}`}>
              {badge.label}
            </span>
          </div>

          {/* Current key state */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
            <div className="rounded border border-slate-800 bg-slate-900/40 px-3 py-2">
              <div className="text-slate-500 text-[10px] mb-1">登録済みキー</div>
              <div className="font-mono text-slate-200">
                {status.hasKey ? status.maskedKey : "未登録"}
              </div>
              {status.hasKey && status.source === "env" && (
                <div className="text-[10px] text-amber-400 mt-1">
                  環境変数(OPENAI_API_KEY)を使用中
                </div>
              )}
              {status.hasKey && status.source === "db" && (
                <div className="text-[10px] text-slate-500 mt-1">AIセンターに保存済み</div>
              )}
            </div>
            <div className="rounded border border-slate-800 bg-slate-900/40 px-3 py-2">
              <div className="text-slate-500 text-[10px] mb-1">最終確認日時</div>
              <div className="text-slate-200">{formatDateTime(status.lastTestedAt)}</div>
            </div>
            <div className="rounded border border-slate-800 bg-slate-900/40 px-3 py-2">
              <div className="text-slate-500 text-[10px] mb-1">接続状態</div>
              <div className={
                status.connectionState === "success" ? "text-green-300"
                : status.connectionState === "failed" ? "text-red-300"
                : "text-slate-400"
              }>
                {CONNECTION_BADGE[status.connectionState].label}
              </div>
            </div>
          </div>

          {!status.encryptionConfigured && (
            <div className="text-[11px] text-amber-300 bg-amber-900/20 border border-amber-800/40 rounded px-3 py-2">
              AIキー保存用の暗号化キーが未設定です。サーバー環境変数 DEALER_AI_KEY_SECRET を設定してください。
            </div>
          )}

          {/* Register / update form */}
          <div className="space-y-2">
            <label className="block text-[11px] font-medium text-slate-400">
              APIキー登録 / 更新
            </label>
            <div className="flex flex-col sm:flex-row gap-2">
              <input
                type="password"
                autoComplete="off"
                spellCheck={false}
                value={keyInput}
                onChange={(e) => setKeyInput(e.target.value)}
                placeholder="sk-..."
                className="flex-1 rounded border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100 font-mono placeholder:text-slate-600 focus:outline-none focus:border-slate-500"
              />
              <button
                type="button"
                onClick={handleSave}
                disabled={isSaving || keyInput.trim().length === 0}
                className="rounded bg-blue-600 hover:bg-blue-500 disabled:opacity-40 disabled:cursor-not-allowed px-4 py-2 text-sm font-medium text-white transition-colors"
              >
                {isSaving ? "保存中…" : "保存"}
              </button>
              <button
                type="button"
                onClick={handleTest}
                disabled={isTesting || !status.hasKey}
                className="rounded border border-slate-600 hover:border-slate-400 disabled:opacity-40 disabled:cursor-not-allowed px-4 py-2 text-sm font-medium text-slate-200 transition-colors"
              >
                {isTesting ? "確認中…" : "接続テスト"}
              </button>
            </div>
            <p className="text-[10px] text-slate-600">
              保存後、キーはマスク表示され、値は二度と表示されません。
            </p>
          </div>

          {message && (
            <div className={`text-xs rounded px-3 py-2 border ${
              message.kind === "ok"
                ? "text-green-300 bg-green-900/20 border-green-800/40"
                : "text-red-300 bg-red-900/20 border-red-800/40"
            }`}>
              {message.text}
            </div>
          )}
        </section>
      ) : !isSuperAdmin ? (
        <section className="rounded-lg border border-slate-800 bg-[#0b1120] p-5">
          <h2 className="text-sm font-semibold text-slate-200">OpenAI APIキー管理</h2>
          <p className="text-[11px] text-slate-500 mt-1">
            APIキーの管理はスーパー管理者のみが行えます。
          </p>
        </section>
      ) : null}

      {/* ── AI usage summary (Super Admin only) ────────────────────────────── */}
      {isSuperAdmin && initialUsage && (
        <section className="rounded-lg border border-slate-800 bg-[#0b1120] p-5 space-y-3">
          <div>
            <h2 className="text-sm font-semibold text-slate-200">AI利用状況</h2>
            <p className="text-[11px] text-slate-500 mt-0.5">車検証OCRの利用ログ集計</p>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
            <div className="rounded border border-slate-800 bg-slate-900/40 px-3 py-2">
              <div className="text-slate-500 text-[10px] mb-1">総呼び出し</div>
              <div className="text-slate-100 text-base font-semibold">{initialUsage.total}</div>
            </div>
            <div className="rounded border border-slate-800 bg-slate-900/40 px-3 py-2">
              <div className="text-slate-500 text-[10px] mb-1">成功</div>
              <div className="text-green-300 text-base font-semibold">{initialUsage.success}</div>
            </div>
            <div className="rounded border border-slate-800 bg-slate-900/40 px-3 py-2">
              <div className="text-slate-500 text-[10px] mb-1">失敗</div>
              <div className="text-red-300 text-base font-semibold">{initialUsage.failed}</div>
            </div>
            <div className="rounded border border-slate-800 bg-slate-900/40 px-3 py-2">
              <div className="text-slate-500 text-[10px] mb-1">最終利用</div>
              <div className="text-slate-200 text-xs">{formatDateTime(initialUsage.lastUsedAt)}</div>
            </div>
          </div>
        </section>
      )}

      {/* ── AI provider architecture (OpenAI active; others prepared) ──────── */}
      <section className="rounded-lg border border-slate-800 bg-[#0b1120] p-5 space-y-3">
        <div>
          <h2 className="text-sm font-semibold text-slate-200">AIプロバイダ</h2>
          <p className="text-[11px] text-slate-500 mt-0.5">
            現在はOpenAIのみ稼働。他プロバイダは将来対応（切替は未実装）。
          </p>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {AI_PROVIDERS.map((p) => {
            const active = p.status === "active";
            return (
              <div
                key={p.id}
                className={`rounded border px-3 py-2 ${active ? "border-slate-700 bg-slate-900/60" : "border-slate-800 bg-slate-900/20 opacity-60"}`}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-medium text-slate-200 truncate">{p.label}</span>
                  <span className={`text-[9px] font-semibold px-1.5 py-0.5 rounded border ${
                    active ? "text-green-300 bg-green-900/40 border-green-700/50" : "text-slate-500 bg-slate-800 border-slate-700"
                  }`}>
                    {active ? "稼働中" : "準備中"}
                  </span>
                </div>
                <div className="text-[10px] text-slate-500 mt-1">{p.note}</div>
              </div>
            );
          })}
        </div>
      </section>

      {/* ── AI API ownership policy (visible to all admins) ────────────────── */}
      <section className="rounded-lg border border-slate-800 bg-[#0b1120] p-5 space-y-3">
        <div>
          <h2 className="text-sm font-semibold text-slate-200">AI API 所有ポリシー</h2>
          <p className="text-[11px] text-slate-500 mt-0.5">
            各AI機能のAPIキーをどちらが所有・負担するかの区分です。
          </p>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="rounded border border-slate-800 bg-slate-900/40 p-3">
            <div className="flex items-center gap-2 mb-2">
              <span className="text-[10px] font-semibold px-2 py-0.5 rounded border text-purple-300 bg-purple-900/40 border-purple-700/50">
                GYEON管理
              </span>
              <span className="text-[10px] text-slate-500">GYEONがキーを提供・負担</span>
            </div>
            <ul className="space-y-1">
              {GYEON_MANAGED_FEATURE_LABELS_JA.map((f) => (
                <li key={f} className="text-xs text-slate-300 flex items-start gap-1.5">
                  <span className="text-purple-400 mt-0.5">•</span>{f}
                </li>
              ))}
            </ul>
          </div>
          <div className="rounded border border-slate-800 bg-slate-900/40 p-3">
            <div className="flex items-center gap-2 mb-2">
              <span className="text-[10px] font-semibold px-2 py-0.5 rounded border text-blue-300 bg-blue-900/40 border-blue-700/50">
                店舗管理
              </span>
              <span className="text-[10px] text-slate-500">店舗が自社キーを提供・負担</span>
            </div>
            <ul className="space-y-1">
              {DEALER_MANAGED_FEATURE_LABELS_JA.map((f) => (
                <li key={f} className="text-xs text-slate-300 flex items-start gap-1.5">
                  <span className="text-blue-400 mt-0.5">•</span>{f}
                </li>
              ))}
            </ul>
          </div>
        </div>
        <p className="text-[10px] text-slate-600">
          店舗管理AIキーは今後、店舗ごとに安全に保存する設計です（現時点では未実装）。
        </p>
      </section>
    </div>
  );
}
