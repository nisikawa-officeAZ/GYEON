"use client";

// DealerOS — AI Gateway Settings UI (Pro+)
// Dealer configures their own AI provider API key.
// Office AZ does NOT pay AI inference costs — keys belong to the dealer.
//
// Security:
//   - API key input is write-only: once saved, only "設定済み" is shown
//   - All mutations use server actions with server-side dealer_id enforcement
//   - Raw key is never displayed after save

import { useState, useTransition } from "react";
import type { AiSettingsView, AiConnectionTestResult } from "@/lib/ai/ai-settings-types";
import { saveAiSettings }    from "@/lib/ai/save-ai-settings";
import { testAiConnection }  from "@/lib/ai/test-ai-connection";
import { AI_PROVIDER_REGISTRY } from "@/lib/ai/provider-registry";
import { getKeyPlaceholder } from "@/lib/ai/validate-api-key";
import type { AIProviderId } from "@/lib/ai/types";
import { canUseFeature }     from "@/lib/plans/plan-types";
import type { DealerPlanInfo } from "@/lib/plans/plan-types";

// ─── Migration notice ─────────────────────────────────────────────────────────

function MigrationBanner() {
  return (
    <div className="px-4 py-3 border border-amber-500/30 bg-amber-950/20 rounded-xl">
      <p className="text-xs text-amber-400 font-semibold">データベースの更新が必要です</p>
      <p className="text-[10px] text-slate-400 mt-1.5 leading-relaxed">
        AI Gateway 設定を保存するには、以下のマイグレーションを実行する必要があります。管理者（CTO）にお問い合わせください。
      </p>
      <pre className="mt-2 text-[10px] text-slate-500 bg-slate-900 rounded px-3 py-2 overflow-x-auto">
        {`ALTER TABLE public.dealer_settings\n  ADD COLUMN IF NOT EXISTS ai_settings jsonb NOT NULL DEFAULT '{}';`}
      </pre>
    </div>
  );
}

// ─── Provider status tile ─────────────────────────────────────────────────────

function ProviderTile({
  provider,
  isPrimary,
  hasKey,
  validatedAt,
  onClick,
}: {
  provider: (typeof AI_PROVIDER_REGISTRY)[number];
  isPrimary: boolean;
  hasKey: boolean;
  validatedAt: string | null;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex items-start justify-between px-3 py-2.5 rounded-lg border transition-all text-left ${
        isPrimary
          ? "border-blue-600 bg-blue-950/30"
          : "border-slate-800 bg-slate-900/30 hover:border-slate-700"
      }`}
    >
      <div className="flex flex-col gap-0.5">
        <span className={`text-xs font-semibold ${isPrimary ? "text-blue-300" : "text-slate-300"}`}>
          {provider.nameJa}
          {isPrimary && <span className="ml-1.5 text-[9px] text-blue-400 font-normal">（メイン）</span>}
        </span>
        {hasKey && validatedAt ? (
          <span className="text-[10px] text-emerald-400">
            ✓ 設定済み · {new Date(validatedAt).toLocaleDateString("ja-JP")}
          </span>
        ) : hasKey ? (
          <span className="text-[10px] text-amber-400">✓ 設定済み（未検証）</span>
        ) : (
          <span className="text-[10px] text-slate-600">未設定</span>
        )}
      </div>
      <span className="text-[10px] text-slate-600 mt-0.5">設定 →</span>
    </button>
  );
}

// ─── Props ────────────────────────────────────────────────────────────────────

interface Props {
  initialSettings: AiSettingsView;
  planInfo:        DealerPlanInfo;
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function AIGatewaySettings({ initialSettings, planInfo }: Props) {
  const [settings, setSettings]   = useState<AiSettingsView>(initialSettings);
  const [editProvider, setEdit]   = useState<AIProviderId | null>(null);
  const [apiKey, setApiKey]       = useState("");
  const [azureEndpoint, setAzureEndpoint] = useState("");
  const [monthlyLimit, setMonthly] = useState<string>(
    String(initialSettings.monthly_limit_usd || ""),
  );
  const [hardLimit, setHardLimit] = useState(initialSettings.hard_limit);
  const [aiEnabled, setEnabled]   = useState(initialSettings.enabled);
  const [testResult, setTestResult] = useState<AiConnectionTestResult | null>(null);
  const [toast, setToast]         = useState<{ text: string; type: "ok" | "err" } | null>(null);
  const [isPending, startTx]      = useTransition();

  const isProPlus = canUseFeature(planInfo.plan, "ai_gateway");
  const editEntry = AI_PROVIDER_REGISTRY.find((p) => p.id === editProvider);

  function showToast(text: string, type: "ok" | "err") {
    setToast({ text, type });
    setTimeout(() => setToast(null), 5000);
  }

  function openEditor(id: AIProviderId) {
    setEdit(id);
    setApiKey("");
    setTestResult(null);
    const entry = AI_PROVIDER_REGISTRY.find((p) => p.id === id);
    if (entry?.requiresEndpoint) setAzureEndpoint("");
  }

  function handleSave() {
    if (!editProvider) return;
    startTx(async () => {
      const res = await saveAiSettings({
        provider:          editProvider,
        api_key:           apiKey,
        azure_endpoint:    azureEndpoint || undefined,
        monthly_limit_usd: Number(monthlyLimit) || 0,
        hard_limit:        hardLimit,
        enabled:           aiEnabled,
      });

      if (res.success) {
        setSettings((prev) => ({
          ...prev,
          enabled:           aiEnabled,
          primary_provider:  editProvider,
          monthly_limit_usd: Number(monthlyLimit) || 0,
          hard_limit:        hardLimit,
          providers: {
            ...prev.providers,
            [editProvider]: {
              has_key:      apiKey.trim().length > 0 ? true : (prev.providers[editProvider]?.has_key ?? false),
              validated_at: apiKey.trim().length > 0 ? new Date().toISOString() : (prev.providers[editProvider]?.validated_at ?? null),
            },
          },
        }));
        setApiKey("");
        setEdit(null);
        showToast("設定を保存しました", "ok");
      } else {
        showToast(res.error, "err");
      }
    });
  }

  function handleTest() {
    if (!editProvider) return;
    startTx(async () => {
      const res = await testAiConnection(editProvider);
      if ("error" in res) {
        showToast(res.error, "err");
      } else {
        setTestResult(res);
      }
    });
  }

  // ── Gate ────────────────────────────────────────────────────────────────────
  if (!isProPlus) {
    return (
      <div className="flex flex-col items-center gap-4 py-8 text-center">
        <span className="text-3xl">🤖</span>
        <p className="text-sm font-semibold text-slate-200">AI Gatewayは Pro+ プランが必要です</p>
        <p className="text-xs text-slate-500">
          プランのアップグレードは GYEON Japan へお問い合わせください
        </p>
        <span className="text-xs px-3 py-1.5 rounded-lg border border-purple-700 bg-purple-900/60 text-purple-300 font-semibold">
          Pro Plus 以上が必要です
        </span>
      </div>
    );
  }

  // ── Main ────────────────────────────────────────────────────────────────────
  return (
    <div className="flex flex-col gap-4">

      {/* Migration required */}
      {settings.migration_required && <MigrationBanner />}

      {/* Status summary */}
      <div className="flex items-center justify-between px-3 py-2 rounded-lg border border-slate-800 bg-slate-900/40">
        <div className="flex items-center gap-2">
          <div className={`w-2 h-2 rounded-full ${settings.enabled && settings.primary_provider ? "bg-green-400" : "bg-slate-600"}`} />
          <span className="text-xs text-slate-300 font-medium">
            {settings.enabled && settings.primary_provider
              ? `有効 · ${AI_PROVIDER_REGISTRY.find(p => p.id === settings.primary_provider)?.nameJa ?? settings.primary_provider}`
              : "無効 / 未設定"}
          </span>
        </div>
        <div className="flex items-center gap-2">
          {settings.monthly_limit_usd > 0 && (
            <span className="text-[10px] text-slate-500">${settings.monthly_limit_usd}/月上限</span>
          )}
          <span className="text-[10px] text-purple-400 font-semibold">Pro+</span>
        </div>
      </div>

      {/* Architecture notice */}
      <div className="px-3 py-2 border border-blue-900/40 bg-blue-950/10 rounded-lg">
        <p className="text-[10px] text-blue-400/80 leading-relaxed">
          <span className="font-semibold">ディーラー所有モデル:</span>{" "}
          AIの推論コストはディーラー自身のAPIキーで支払われます。Office AZ には一切AI推論コストが発生しません。
        </p>
      </div>

      {/* Provider list */}
      {!editProvider && (
        <div className="flex flex-col gap-2">
          <p className="text-xs text-slate-400 font-medium">プロバイダー設定</p>
          {AI_PROVIDER_REGISTRY.map((entry) => (
            <ProviderTile
              key={entry.id}
              provider={entry}
              isPrimary={settings.primary_provider === entry.id}
              hasKey={settings.providers[entry.id]?.has_key ?? false}
              validatedAt={settings.providers[entry.id]?.validated_at ?? null}
              onClick={() => openEditor(entry.id)}
            />
          ))}
        </div>
      )}

      {/* Edit panel */}
      {editProvider && editEntry && (
        <div className="flex flex-col gap-3 px-3 py-3 border border-blue-800/40 bg-blue-950/10 rounded-xl">
          {/* Header */}
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-200">{editEntry.nameJa}</span>
            <button
              type="button"
              onClick={() => { setEdit(null); setApiKey(""); setTestResult(null); }}
              className="text-[10px] text-slate-500 hover:text-slate-300"
            >
              ✕ キャンセル
            </button>
          </div>
          <p className="text-[10px] text-slate-500">{editEntry.descJa}</p>

          {/* API key input */}
          <div className="flex flex-col gap-1.5">
            <label className="text-[10px] text-slate-500">
              APIキー
              {(settings.providers[editProvider]?.has_key) && (
                <span className="ml-2 text-emerald-400">（設定済み — 再入力で更新）</span>
              )}
            </label>
            <input
              type="password"
              value={apiKey}
              onChange={(e) => { setApiKey(e.target.value); setTestResult(null); }}
              placeholder={getKeyPlaceholder(editProvider)}
              autoComplete="off"
              className="w-full px-2.5 py-1.5 rounded bg-[#0a0f1e] border border-slate-700 text-xs text-slate-200 placeholder-slate-600 focus:border-blue-600 focus:outline-none"
            />
            {editEntry.keyManagementUrl && (
              <p className="text-[10px] text-slate-600">
                キー取得:{" "}
                <a
                  href={editEntry.keyManagementUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-500 hover:text-blue-400 underline"
                >
                  {editEntry.nameJa} ダッシュボード
                </a>
              </p>
            )}
          </div>

          {/* Azure endpoint */}
          {editEntry.requiresEndpoint && (
            <div className="flex flex-col gap-1.5">
              <label className="text-[10px] text-slate-500">Azure エンドポイント URL（必須）</label>
              <input
                type="url"
                value={azureEndpoint}
                onChange={(e) => setAzureEndpoint(e.target.value)}
                placeholder="https://your-resource.openai.azure.com/"
                className="w-full px-2.5 py-1.5 rounded bg-[#0a0f1e] border border-slate-700 text-xs text-slate-200 placeholder-slate-600 focus:border-blue-600 focus:outline-none"
              />
            </div>
          )}

          {/* Connection test */}
          <button
            type="button"
            onClick={handleTest}
            disabled={isPending || (!apiKey.trim() && !settings.providers[editProvider]?.has_key)}
            className="w-full py-1.5 rounded border border-slate-700 bg-slate-800 text-xs text-slate-300 hover:bg-slate-700 transition-colors disabled:opacity-40"
          >
            {isPending ? "テスト中…" : "接続テスト（フォーマット検証）"}
          </button>

          {testResult && (
            <div className={`px-3 py-2 rounded-lg text-[10px] leading-relaxed ${
              testResult.success
                ? "bg-emerald-950/40 text-emerald-300 border border-emerald-700/40"
                : "bg-red-950/40 text-red-300 border border-red-700/40"
            }`}>
              <span>{testResult.success ? "✓" : "✗"} {testResult.message}</span>
              <span className="block text-slate-600 mt-0.5">
                検証タイプ: フォーマット検証（ネットワーク接続テストは Phase G で実装予定）
              </span>
            </div>
          )}

          {/* Global settings */}
          <div className="border-t border-slate-800 pt-3 flex flex-col gap-2.5">
            <div className="flex flex-col gap-1">
              <label className="text-[10px] text-slate-500">月間上限（USD）</label>
              <div className="flex items-center gap-2">
                <span className="text-xs text-slate-400">$</span>
                <input
                  type="number"
                  min={0}
                  step={1}
                  value={monthlyLimit}
                  onChange={(e) => setMonthly(e.target.value)}
                  placeholder="0（無制限）"
                  className="w-28 px-2.5 py-1.5 rounded bg-[#0a0f1e] border border-slate-700 text-xs text-slate-200 placeholder-slate-600 focus:border-blue-600 focus:outline-none"
                />
                <span className="text-[10px] text-slate-600">/月 （0 = 無制限）</span>
              </div>
            </div>

            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-slate-400">ハード制限</p>
                <p className="text-[10px] text-slate-600">ON: 上限超過で停止 / OFF: 超過時に警告のみ</p>
              </div>
              <button
                type="button"
                onClick={() => setHardLimit((v) => !v)}
                className={`w-10 h-5 rounded-full transition-colors relative ${hardLimit ? "bg-blue-600" : "bg-slate-700"}`}
                aria-pressed={hardLimit}
              >
                <span className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-all ${hardLimit ? "left-5.5" : "left-0.5"}`} style={{ left: hardLimit ? "1.375rem" : "0.125rem" }} />
              </button>
            </div>

            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-slate-400">AI Gateway 有効化</p>
                <p className="text-[10px] text-slate-600">無効にするとすべてのAI機能が停止します</p>
              </div>
              <button
                type="button"
                onClick={() => setEnabled((v) => !v)}
                className={`w-10 h-5 rounded-full transition-colors relative ${aiEnabled ? "bg-blue-600" : "bg-slate-700"}`}
                aria-pressed={aiEnabled}
              >
                <span className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-all`} style={{ left: aiEnabled ? "1.375rem" : "0.125rem" }} />
              </button>
            </div>
          </div>

          {/* Save */}
          <button
            type="button"
            onClick={handleSave}
            disabled={isPending || settings.migration_required}
            className="w-full py-2.5 rounded-lg bg-[#2563eb] hover:bg-[#1d4ed8] text-sm font-semibold text-white transition-colors disabled:opacity-50"
          >
            {isPending ? "保存中…" : "設定を保存"}
          </button>
        </div>
      )}

      {/* Capabilities summary */}
      {!editProvider && (
        <div className="px-3 py-2 border border-slate-800 bg-slate-900/20 rounded-lg">
          <p className="text-[10px] text-slate-500 font-medium mb-2">対応AI機能（Phase G 実装後）</p>
          <div className="flex flex-wrap gap-1.5">
            {[
              "テキスト生成", "コンテンツライティング",
              "SNSキャプション", "SEO/MEO キーワード抽出",
              "レビュー依頼文生成", "レビュー返答ドラフト",
              "評判分析",
            ].map((cap) => (
              <span key={cap} className="text-[10px] px-2 py-0.5 rounded-full bg-slate-800 text-slate-500 border border-slate-700">
                {cap}
              </span>
            ))}
          </div>
          <p className="text-[10px] text-slate-600 mt-2">
            映像生成・画像生成は各プロバイダーの対応状況に依存します。
          </p>
        </div>
      )}

      {/* Toast */}
      {toast && (
        <div className={`px-3 py-2 rounded-lg text-xs font-medium ${
          toast.type === "ok"
            ? "bg-green-900/60 text-green-300 border border-green-700/40"
            : "bg-red-900/60 text-red-300 border border-red-700/40"
        }`}>
          {toast.text}
        </div>
      )}
    </div>
  );
}
