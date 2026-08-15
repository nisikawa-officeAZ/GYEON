"use client";

import { useState } from "react";
import { demoCustomer } from "@/lib/customer-app/demo-data";

const card = "rounded-2xl border border-white/[.08] bg-[#0f172a]";

function Toggle({ on, set }: { on: boolean; set: (v: boolean) => void }) {
  return (
    <span onClick={() => set(!on)}
      className={`relative inline-flex h-5 w-9 items-center rounded-full cursor-pointer transition-colors ${on ? "bg-blue-600" : "bg-slate-700"}`}>
      <span className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform ${on ? "translate-x-4" : "translate-x-1"}`} />
    </span>
  );
}

export default function ProfileClient() {
  const [push, setPush] = useState(true);
  const [line, setLine] = useState(true);
  const [reminders, setReminders] = useState(true);

  const info = (k: string, v: string) => (
    <div className="flex items-center justify-between py-2.5 border-b border-white/[.05] last:border-0">
      <span className="text-[11px] text-slate-500">{k}</span>
      <span className="text-xs text-slate-200">{v}</span>
    </div>
  );
  const setting = (label: string, on: boolean, set: (v: boolean) => void) => (
    <div className="flex items-center justify-between py-2.5 border-b border-white/[.05] last:border-0">
      <span className="text-xs text-slate-300">{label}</span>
      <Toggle on={on} set={set} />
    </div>
  );

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-lg font-bold text-slate-100">プロフィール</h1>

      {/* Identity */}
      <div className={`${card} p-4 flex items-center gap-3`}>
        <span className="grid place-items-center w-12 h-12 rounded-full bg-blue-950/50 text-lg">👤</span>
        <div>
          <p className="text-sm font-semibold text-slate-100">{demoCustomer.name}</p>
          <p className="text-[11px] text-slate-500">{demoCustomer.nameKana}</p>
          <p className="text-[10px] text-slate-600 mt-0.5">会員登録: {demoCustomer.memberSince}</p>
        </div>
      </div>

      {/* Customer info */}
      <div className={`${card} p-4`}>
        <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-1">お客様情報</p>
        {info("メール", demoCustomer.email)}
        {info("電話番号", demoCustomer.phone)}
      </div>

      {/* LINE connection */}
      <div className={`${card} p-4 flex items-center justify-between`}>
        <div className="flex items-center gap-2">
          <span className="grid place-items-center w-8 h-8 rounded-lg bg-[#06C755]/20 text-[#06C755] text-sm font-bold">L</span>
          <div>
            <p className="text-xs text-slate-200">LINE連携</p>
            <p className="text-[10px] text-slate-500">{demoCustomer.lineConnected ? "連携済み" : "未連携"}</p>
          </div>
        </div>
        <span className={`text-[10px] px-2 py-0.5 rounded-full border ${demoCustomer.lineConnected ? "bg-emerald-950/50 text-emerald-300 border-emerald-600/40" : "bg-slate-800 text-slate-400 border-slate-700"}`}>
          {demoCustomer.lineConnected ? "✓ 連携中" : "連携する"}
        </span>
      </div>

      {/* Notification settings */}
      <div className={`${card} p-4`}>
        <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-1">通知設定</p>
        {setting("プッシュ通知", push, setPush)}
        {setting("LINE通知", line, setLine)}
        {setting("メンテナンスリマインダー", reminders, setReminders)}
      </div>

      <p className="text-[10px] text-slate-600 text-center">GYEON Detailer Agent — Customer App (Demo)</p>
    </div>
  );
}
