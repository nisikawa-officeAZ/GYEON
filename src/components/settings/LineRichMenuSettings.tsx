"use client";

// DealerOS — LINE Rich Menu Settings UI (Pro+)
// Manages the 6-button 3×2 LINE rich menu config.
// Config stored in dealer_settings.line_public_settings.rich_menu.
// Security: all mutations use server actions with server-side dealer_id enforcement.

import { useState, useTransition } from "react";
import type {
  LineRichMenuConfig,
  RichMenuButton,
  RichMenuActionType,
} from "@/lib/line/line-rich-menu-types";
import {
  DEFAULT_RICH_MENU_BUTTONS,
  FUTURE_WORKFLOW_HINTS,
  SLOT_PURPOSE_DEFAULTS,
} from "@/lib/line/line-rich-menu-types";
import { saveLineRichMenuConfig } from "@/lib/line/save-line-rich-menu-config";
import { publishLineRichMenu }    from "@/lib/line/publish-line-rich-menu";
import { deleteLineRichMenu }     from "@/lib/line/delete-line-rich-menu";
import { canUseFeature }          from "@/lib/plans/plan-types";
import type { DealerPlanInfo }    from "@/lib/plans/plan-types";

// ─── Button colors (matches generate-rich-menu-png.ts BUTTON_COLORS) ─────────

const PREVIEW_COLORS = [
  "#1e3a8a", // slot 0 予約する
  "#064e3b", // slot 1 施工メニュー
  "#312e81", // slot 2 メンテナンス
  "#7e22ce", // slot 3 レビュー投稿
  "#0c4a6e", // slot 4 施工事例
  "#1e293b", // slot 5 お問い合わせ
] as const;

const SLOT_LABELS = ["予約する", "施工メニュー", "メンテナンス", "レビュー投稿", "施工事例", "お問い合わせ"];

const ACTION_TYPE_OPTIONS: { value: RichMenuActionType; label: string }[] = [
  { value: "uri",      label: "URLを開く" },
  { value: "liff",     label: "LIFFアプリを開く" },
  { value: "message",  label: "メッセージ送信" },
  { value: "postback", label: "ポストバック（Webhook）" },
];

// ─── Props ────────────────────────────────────────────────────────────────────

interface Props {
  initialConfig: LineRichMenuConfig;
  lineEnabled:   boolean;
  planInfo:      DealerPlanInfo;
}

// ─── ButtonRow ────────────────────────────────────────────────────────────────

function ButtonRow({
  index,
  btn,
  onChange,
}: {
  index:    number;
  btn:      RichMenuButton;
  onChange: (i: number, btn: RichMenuButton) => void;
}) {
  const color   = PREVIEW_COLORS[index];
  const purpose = btn.purpose ?? SLOT_PURPOSE_DEFAULTS[index];
  const hint    = FUTURE_WORKFLOW_HINTS[purpose];

  return (
    <div className="flex flex-col gap-2 p-3 rounded-lg border border-slate-800 bg-slate-900/40">
      {/* Slot header */}
      <div className="flex items-center gap-2">
        <span className="w-4 h-4 rounded-sm shrink-0" style={{ backgroundColor: color }} aria-hidden />
        <span className="text-[10px] text-slate-500 font-medium">ボタン {index + 1}</span>
        <span className="text-[10px] text-slate-600">（デフォルト: {SLOT_LABELS[index]}）</span>
      </div>

      {/* Label */}
      <div className="flex flex-col gap-1.5">
        <label className="text-[10px] text-slate-500">ラベル（最大12文字）</label>
        <input
          type="text"
          value={btn.label}
          maxLength={12}
          onChange={(e) => onChange(index, { ...btn, label: e.target.value })}
          className="w-full px-2.5 py-1.5 rounded bg-[#0a0f1e] border border-slate-700 text-xs text-slate-200 placeholder-slate-600 focus:border-blue-600 focus:outline-none"
          placeholder={SLOT_LABELS[index]}
        />
      </div>

      {/* Action type */}
      <div className="flex flex-col gap-1.5">
        <label className="text-[10px] text-slate-500">アクション</label>
        <select
          value={btn.action_type}
          onChange={(e) => onChange(index, { ...btn, action_type: e.target.value as RichMenuActionType })}
          className="w-full px-2.5 py-1.5 rounded bg-[#0a0f1e] border border-slate-700 text-xs text-slate-200 focus:border-blue-600 focus:outline-none"
        >
          {ACTION_TYPE_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>
      </div>

      {/* Action-specific input */}
      {btn.action_type === "uri" && (
        <div className="flex flex-col gap-1.5">
          <label className="text-[10px] text-slate-500">URL</label>
          <input
            type="url"
            value={btn.uri}
            onChange={(e) => onChange(index, { ...btn, uri: e.target.value })}
            className="w-full px-2.5 py-1.5 rounded bg-[#0a0f1e] border border-slate-700 text-xs text-slate-200 placeholder-slate-600 focus:border-blue-600 focus:outline-none"
            placeholder="https://..."
          />
          {!btn.uri && (
            <p className="text-[10px] text-amber-500/80">
              未設定 — タップ時にラベルテキストがメッセージとして送信されます
            </p>
          )}
        </div>
      )}

      {btn.action_type === "liff" && (
        <div className="flex flex-col gap-1.5">
          <label className="text-[10px] text-slate-500">LIFFパス（例: /reservation）</label>
          <input
            type="text"
            value={btn.liff_path}
            onChange={(e) => onChange(index, { ...btn, liff_path: e.target.value })}
            className="w-full px-2.5 py-1.5 rounded bg-[#0a0f1e] border border-slate-700 text-xs text-slate-200 placeholder-slate-600 focus:border-blue-600 focus:outline-none"
            placeholder="/reservation"
          />
          <p className="text-[10px] text-slate-600">
            LIFF ID は LINE設定から自動的に使用されます
          </p>
        </div>
      )}

      {btn.action_type === "message" && (
        <div className="flex flex-col gap-1.5">
          <label className="text-[10px] text-slate-500">送信テキスト</label>
          <input
            type="text"
            value={btn.message}
            onChange={(e) => onChange(index, { ...btn, message: e.target.value })}
            className="w-full px-2.5 py-1.5 rounded bg-[#0a0f1e] border border-slate-700 text-xs text-slate-200 placeholder-slate-600 focus:border-blue-600 focus:outline-none"
            placeholder="お問い合わせ"
          />
        </div>
      )}

      {btn.action_type === "postback" && (
        <div className="flex flex-col gap-1.5">
          <label className="text-[10px] text-slate-500">ポストバックデータ（最大300文字）</label>
          <input
            type="text"
            value={btn.postback_data}
            maxLength={300}
            onChange={(e) => onChange(index, { ...btn, postback_data: e.target.value })}
            className="w-full px-2.5 py-1.5 rounded bg-[#0a0f1e] border border-slate-700 text-xs text-slate-200 placeholder-slate-600 focus:border-blue-600 focus:outline-none"
            placeholder="action=inquiry"
          />
          <p className="text-[10px] text-slate-600">
            Webhook受信時に渡されるデータ（webhook_url の設定が必要です）
          </p>
        </div>
      )}

      {/* Future workflow hint */}
      {hint && (
        <p className="text-[10px] text-purple-400/70 border-t border-slate-800/60 pt-1.5 mt-0.5">
          {hint}
        </p>
      )}
    </div>
  );
}

// ─── RichMenuPreview ──────────────────────────────────────────────────────────

function RichMenuPreview({ buttons }: { buttons: LineRichMenuConfig["buttons"] }) {
  return (
    <div
      className="w-full rounded overflow-hidden border border-slate-700"
      style={{ aspectRatio: "2500 / 1686" }}
    >
      <div className="grid grid-cols-3 grid-rows-2 h-full">
        {buttons.map((btn, i) => (
          <div
            key={i}
            className="flex items-center justify-center border border-slate-700/60 p-1"
            style={{ backgroundColor: PREVIEW_COLORS[i] }}
          >
            <span className="text-[9px] sm:text-[11px] font-medium text-white/90 text-center leading-tight break-all">
              {btn.label || "（未設定）"}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function LineRichMenuSettings({
  initialConfig,
  lineEnabled,
  planInfo,
}: Props) {
  const [config, setConfig]  = useState<LineRichMenuConfig>(initialConfig);
  const [toast, setToast]    = useState<{ text: string; type: "ok" | "err" } | null>(null);
  const [isPending, startTx] = useTransition();

  const isProPlus  = canUseFeature(planInfo.plan, "line_rich_menu");
  const isDeployed = !!config.rich_menu_id;

  function showToast(text: string, type: "ok" | "err") {
    setToast({ text, type });
    setTimeout(() => setToast(null), 4000);
  }

  function updateButton(i: number, btn: RichMenuButton) {
    const next = [...config.buttons] as LineRichMenuConfig["buttons"];
    next[i] = btn;
    setConfig({ ...config, buttons: next });
  }

  function resetToDefaults() {
    setConfig({ ...config, chat_bar_text: "メニュー", buttons: DEFAULT_RICH_MENU_BUTTONS });
  }

  function handleSave() {
    startTx(async () => {
      const res = await saveLineRichMenuConfig({
        enabled:       config.enabled,
        chat_bar_text: config.chat_bar_text,
        buttons:       config.buttons,
      });
      if (res.success) showToast("設定を保存しました", "ok");
      else             showToast(res.error, "err");
    });
  }

  function handlePublish() {
    startTx(async () => {
      const res = await publishLineRichMenu(config);
      if (res.success) {
        setConfig({ ...config, rich_menu_id: res.richMenuId, enabled: true });
        showToast("リッチメニューを公開しました", "ok");
      } else {
        showToast(res.error, "err");
      }
    });
  }

  function handleDelete() {
    startTx(async () => {
      const res = await deleteLineRichMenu();
      if (res.success) {
        setConfig({ ...config, rich_menu_id: null, enabled: false });
        showToast("リッチメニューを削除しました", "ok");
      } else {
        showToast(res.error, "err");
      }
    });
  }

  // ── Gate: Pro+ required ───────────────────────────────────────────────────
  if (!isProPlus) {
    return (
      <div className="flex flex-col items-center gap-4 py-8 text-center">
        <span className="text-3xl">🔒</span>
        <p className="text-sm font-semibold text-slate-200">この機能は Pro+ プランが必要です</p>
        <p className="text-xs text-slate-500">
          プランのアップグレードは GYEON Japan へお問い合わせください
        </p>
        <span className="text-xs px-3 py-1.5 rounded-lg border border-purple-700 bg-purple-900/60 text-purple-300 font-semibold">
          Pro Plus 以上が必要です
        </span>
      </div>
    );
  }

  // ── Gate: LINE must be connected ──────────────────────────────────────────
  if (!lineEnabled) {
    return (
      <div className="px-4 py-5 border border-amber-500/20 bg-amber-950/10 rounded-xl">
        <p className="text-sm text-amber-400 font-medium">LINE連携が有効ではありません</p>
        <p className="text-xs text-slate-500 mt-2 leading-relaxed">
          リッチメニューを使用するには LINE Messaging API の連携設定が必要です。
          LINE ページで Channel Secret と Access Token を設定してください。
        </p>
      </div>
    );
  }

  // ── Main UI ───────────────────────────────────────────────────────────────
  return (
    <div className="flex flex-col gap-4">

      {/* Status bar */}
      <div className="flex items-center justify-between px-3 py-2 rounded-lg border border-slate-800 bg-slate-900/40">
        <div className="flex items-center gap-2">
          <div className={`w-2 h-2 rounded-full ${isDeployed ? "bg-green-400" : "bg-slate-600"}`} />
          <span className="text-xs text-slate-300 font-medium">
            {isDeployed ? "公開中" : "未公開"}
          </span>
          {isDeployed && config.rich_menu_id && (
            <span className="text-[10px] text-slate-600 font-mono">
              {config.rich_menu_id.slice(0, 20)}…
            </span>
          )}
        </div>
        <span className="text-[10px] text-purple-400 font-semibold">Pro+</span>
      </div>

      {/* Preview */}
      <div className="flex flex-col gap-1.5">
        <p className="text-[10px] text-slate-500">プレビュー（実際の画像は6色ゾーンで生成されます）</p>
        <RichMenuPreview buttons={config.buttons} />
      </div>

      {/* Chat bar text */}
      <div className="flex flex-col gap-1.5">
        <label className="text-xs text-slate-400 font-medium">チャットバーテキスト</label>
        <input
          type="text"
          value={config.chat_bar_text}
          maxLength={14}
          onChange={(e) => setConfig({ ...config, chat_bar_text: e.target.value })}
          className="w-full px-3 py-2 rounded bg-[#0a0f1e] border border-slate-700 text-sm text-slate-200 placeholder-slate-600 focus:border-blue-600 focus:outline-none"
          placeholder="メニュー"
        />
        <p className="text-[10px] text-slate-600">LINEトーク画面下部のテキスト（最大14文字）</p>
      </div>

      {/* Button config */}
      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <p className="text-xs text-slate-400 font-medium">ボタン設定（6ボタン固定）</p>
          <button
            type="button"
            onClick={resetToDefaults}
            className="text-[10px] text-slate-500 hover:text-slate-300 transition-colors"
          >
            デフォルトに戻す
          </button>
        </div>
        <div className="grid grid-cols-1 gap-2">
          {config.buttons.map((btn, i) => (
            <ButtonRow key={i} index={i} btn={btn} onChange={updateButton} />
          ))}
        </div>
      </div>

      {/* v1 note */}
      <div className="px-3 py-2 border border-slate-700/40 bg-slate-900/20 rounded-lg">
        <p className="text-[10px] text-slate-600 leading-relaxed">
          <span className="text-slate-500 font-medium">v1 仕様:</span>{" "}
          テンプレート画像は6色グリッドで自動生成されます。
          LIFFアクションには LINE設定の LIFF ID が必要です。
          ポストバックアクションには Webhook URL の設定が必要です。
        </p>
      </div>

      {/* Toast */}
      {toast && (
        <div
          className={`px-3 py-2 rounded-lg text-xs font-medium ${
            toast.type === "ok"
              ? "bg-green-900/60 text-green-300 border border-green-700/40"
              : "bg-red-900/60 text-red-300 border border-red-700/40"
          }`}
        >
          {toast.text}
        </div>
      )}

      {/* Action buttons */}
      <div className="flex flex-col gap-2 pt-1">
        <button
          type="button"
          onClick={handleSave}
          disabled={isPending}
          className="w-full py-2.5 rounded-lg border border-slate-700 bg-slate-800 hover:bg-slate-700 text-sm font-medium text-slate-200 transition-colors disabled:opacity-50"
        >
          {isPending ? "処理中…" : "設定を保存"}
        </button>

        <button
          type="button"
          onClick={handlePublish}
          disabled={isPending}
          className="w-full py-2.5 rounded-lg bg-[#2563eb] hover:bg-[#1d4ed8] text-sm font-semibold text-white transition-colors disabled:opacity-50"
        >
          {isPending ? "処理中…" : isDeployed ? "リッチメニューを更新・再公開" : "リッチメニューを公開"}
        </button>

        {isDeployed && (
          <button
            type="button"
            onClick={handleDelete}
            disabled={isPending}
            className="w-full py-2 rounded-lg border border-red-800/50 bg-red-950/20 text-xs font-medium text-red-400 hover:bg-red-950/40 transition-colors disabled:opacity-50"
          >
            {isPending ? "処理中…" : "リッチメニューを削除"}
          </button>
        )}
      </div>
    </div>
  );
}
