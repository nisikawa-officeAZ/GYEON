"use client";

import { useState, useTransition } from "react";
import { saveCustomerAppSettings } from "@/lib/customer-app/customer-app-settings";
import {
  EMPTY_CUSTOMER_APP_SETTINGS, CUSTOMER_APP_THEMES,
  type CustomerAppSettings, type CustomerAppTheme,
} from "@/lib/customer-app/customer-app-types";

const inp = "w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-100 focus:outline-none focus:ring-1 focus:ring-blue-600 focus:border-blue-600";
const lbl = "text-xs font-medium text-slate-400";

function Toggle({ on, onChange, label }: { on: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <label className="flex items-center gap-3 cursor-pointer select-none">
      <span onClick={() => onChange(!on)}
        className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${on ? "bg-blue-600" : "bg-slate-700"}`}>
        <span className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform ${on ? "translate-x-4" : "translate-x-1"}`} />
      </span>
      <span className="text-sm text-slate-300">{label}</span>
    </label>
  );
}

export default function CustomerAppClient({ initial }: { initial: CustomerAppSettings | null }) {
  const s = initial ?? EMPTY_CUSTOMER_APP_SETTINGS;
  const [enabled, setEnabled] = useState(s.enabled);
  const [appName, setAppName] = useState(s.app_name ?? "");
  const [welcome, setWelcome] = useState(s.welcome_message ?? "");
  const [theme, setTheme] = useState<CustomerAppTheme>(s.theme);
  const [pointsEnabled, setPointsEnabled] = useState(s.points_enabled);
  const [pending, start] = useTransition();
  const [status, setStatus] = useState<"idle" | "saved" | "error">("idle");
  const [error, setError] = useState("");

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const fd = new FormData();
    fd.set("enabled", enabled ? "true" : "false");
    fd.set("app_name", appName);
    fd.set("welcome_message", welcome);
    fd.set("theme", theme);
    fd.set("points_enabled", pointsEnabled ? "true" : "false");
    start(async () => {
      const res = await saveCustomerAppSettings(fd);
      if ("error" in res) { setStatus("error"); setError(res.error); }
      else setStatus("saved");
    });
  }

  return (
    <form onSubmit={submit} className="bg-[#0f172a] border border-slate-800 rounded-xl p-5 flex flex-col gap-4">
      <div className="px-3 py-2 rounded-lg border border-slate-800 bg-slate-900/40">
        <p className="text-[10px] text-slate-500">顧客向けアプリの基盤設定です。今後の機能拡張に向けて、有効化・基本情報・テーマを保存できます。</p>
      </div>

      <Toggle on={enabled} onChange={(v) => { setEnabled(v); setStatus("idle"); }} label="顧客アプリを有効化" />

      <div className="flex flex-col gap-1">
        <label className={lbl}>アプリ名</label>
        <input value={appName} onChange={(e) => { setAppName(e.target.value); setStatus("idle"); }} placeholder="例: GYEONマイページ" className={inp} />
      </div>

      <div className="flex flex-col gap-1">
        <label className={lbl}>ウェルカムメッセージ</label>
        <textarea rows={3} value={welcome} onChange={(e) => { setWelcome(e.target.value); setStatus("idle"); }} className={`${inp} resize-none`} />
      </div>

      <div className="flex flex-col gap-1">
        <label className={lbl}>テーマ</label>
        <select value={theme} onChange={(e) => { setTheme(e.target.value as CustomerAppTheme); setStatus("idle"); }} className={`${inp} sm:w-48`}>
          <option value="system" className="bg-slate-900">システムに合わせる</option>
          <option value="light"  className="bg-slate-900">ライト</option>
          <option value="dark"   className="bg-slate-900">ダーク</option>
        </select>
      </div>

      <Toggle on={pointsEnabled} onChange={(v) => { setPointsEnabled(v); setStatus("idle"); }} label="ポイント機能を表示" />

      <div className="flex items-center gap-3 border-t border-slate-800 pt-4">
        <button type="submit" disabled={pending} className="px-4 py-2 bg-blue-700 hover:bg-blue-600 disabled:opacity-50 text-white text-sm font-semibold rounded-lg">
          {pending ? "保存中…" : "保存する"}
        </button>
        {status === "saved" && <span className="text-xs text-green-400">保存しました</span>}
        {status === "error" && <span className="text-xs text-red-400">{error || "保存に失敗しました"}</span>}
      </div>
    </form>
  );
}
