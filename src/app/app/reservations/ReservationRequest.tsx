"use client";

import { useState } from "react";
import { demoVehicles } from "@/lib/customer-app/demo-data";

const inp = "w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-100 focus:outline-none focus:ring-1 focus:ring-blue-600";

export default function ReservationRequest() {
  const [open, setOpen] = useState(false);
  const [done, setDone] = useState(false);

  if (done) {
    return (
      <div className="rounded-2xl border border-emerald-700/40 bg-emerald-950/20 p-4 text-center">
        <p className="text-2xl mb-1">✅</p>
        <p className="text-sm text-emerald-300 font-medium">予約リクエストを送信しました</p>
        <p className="text-[11px] text-slate-500 mt-1">店舗からの確定連絡をお待ちください(デモ)</p>
        <button onClick={() => { setDone(false); setOpen(false); }} className="mt-3 text-[11px] text-slate-400">閉じる</button>
      </div>
    );
  }

  if (!open) {
    return (
      <button onClick={() => setOpen(true)}
        className="w-full py-3 rounded-2xl bg-blue-700 hover:bg-blue-600 text-white text-sm font-semibold transition-colors">
        ＋ 新規予約をリクエスト
      </button>
    );
  }

  return (
    <form onSubmit={(e) => { e.preventDefault(); setDone(true); }} className="rounded-2xl border border-white/[.08] bg-[#0f172a] p-4 flex flex-col gap-3">
      <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider">新規予約リクエスト</p>
      <select className={inp} required defaultValue="">
        <option value="" className="bg-slate-900">車両を選択</option>
        {demoVehicles.map((v) => <option key={v.id} value={v.id} className="bg-slate-900">{v.maker} {v.model}</option>)}
      </select>
      <select className={inp} required defaultValue="">
        <option value="" className="bg-slate-900">メニューを選択</option>
        <option className="bg-slate-900">メンテナンス洗車</option>
        <option className="bg-slate-900">トップコート再施工</option>
        <option className="bg-slate-900">点検・相談</option>
      </select>
      <div className="grid grid-cols-2 gap-2">
        <input type="date" className={inp} required />
        <input type="time" className={inp} required />
      </div>
      <textarea rows={2} placeholder="ご要望(任意)" className={`${inp} resize-none`} />
      <div className="flex gap-2">
        <button type="button" onClick={() => setOpen(false)} className="px-3 py-2 text-xs text-slate-400 rounded-lg border border-slate-700">キャンセル</button>
        <button type="submit" className="flex-1 px-3 py-2 text-xs font-semibold rounded-lg bg-blue-700 hover:bg-blue-600 text-white">リクエスト送信</button>
      </div>
      <p className="text-[10px] text-slate-600">※ UIデモです。実際の予約は確定されません。</p>
    </form>
  );
}
