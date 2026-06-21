"use client";

import { useState, useTransition } from "react";
import { createReservation } from "@/lib/reservations/create-reservation";
import { ReservationServiceType, serviceTypeLabel } from "@/lib/reservations/reservation-types";

const SERVICE_TYPES: ReservationServiceType[] = [
  "coating", "maintenance", "ppf", "window", "wheel", "interior", "other",
];

const TIME_OPTIONS = Array.from({ length: 25 }, (_, i) => {
  const h = Math.floor(i / 2) + 8;
  const m = i % 2 === 0 ? "00" : "30";
  if (h > 19) return null;
  return `${String(h).padStart(2, "0")}:${m}`;
}).filter(Boolean) as string[];

export default function LiffReservationPage() {
  const [isPending, startTransition] = useTransition();
  const [confirmed, setConfirmed] = useState(false);
  const [reservationNumber, setReservationNumber] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [date,        setDate]        = useState("");
  const [startTime,   setStartTime]   = useState("");
  const [serviceType, setServiceType] = useState<ReservationServiceType>("maintenance");
  const [notes,       setNotes]       = useState("");

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!date) {
      setError("ご希望日を入力してください");
      return;
    }

    startTransition(async () => {
      const result = await createReservation({
        reservation_date: date,
        start_time:       startTime || null,
        service_type:     serviceType,
        notes:            notes     || null,
        status:           "pending",
      });

      if (result.success && result.data) {
        setReservationNumber(
          result.data.reservation_number ?? `RSV-${result.data.id.slice(0, 8).toUpperCase()}`
        );
        setConfirmed(true);
      } else {
        setError(result.error ?? "予約の送信に失敗しました。もう一度お試しください。");
      }
    });
  }

  if (confirmed) {
    return (
      <div className="min-h-screen bg-[#0f172a] flex items-center justify-center p-4">
        <div className="bg-[#1e293b] border border-slate-700 rounded-2xl p-8 w-full max-w-sm text-center">
          <div className="w-16 h-16 bg-green-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
            <span className="text-3xl">✓</span>
          </div>
          <h1 className="text-xl font-bold text-slate-100 mb-2">ご予約を受け付けました</h1>
          <p className="text-sm text-slate-400 mb-4">
            担当者より確認のご連絡をお送りします。
          </p>
          {reservationNumber && (
            <div className="bg-[#0f172a] border border-slate-700 rounded-lg px-4 py-3 mb-4">
              <p className="text-xs text-slate-500 mb-1">予約番号</p>
              <p className="text-lg font-mono font-bold text-blue-400">{reservationNumber}</p>
            </div>
          )}
          <p className="text-xs text-slate-500">
            ご不明な点はお気軽にお問い合わせください。
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0f172a] flex items-center justify-center p-4">
      <div className="bg-[#1e293b] border border-slate-700 rounded-2xl w-full max-w-sm overflow-hidden">
        {/* Header */}
        <div className="bg-[#0f172a] border-b border-slate-700 px-6 py-5 text-center">
          <h1 className="text-base font-bold text-slate-100">GYEON メンテナンス予約</h1>
          <p className="text-xs text-slate-400 mt-1">ご希望の日程をお選びください</p>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="px-6 py-5 flex flex-col gap-4">
          {/* Date */}
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-medium text-slate-400">
              ご希望日 <span className="text-red-400">*</span>
            </label>
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              required
              min={new Date().toISOString().slice(0, 10)}
              className="w-full bg-[#0f172a] border border-slate-700 rounded-xl px-4 py-3 text-sm text-slate-200 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500/30"
            />
          </div>

          {/* Time */}
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-medium text-slate-400">ご希望時刻</label>
            <select
              value={startTime}
              onChange={(e) => setStartTime(e.target.value)}
              className="w-full bg-[#0f172a] border border-slate-700 rounded-xl px-4 py-3 text-sm text-slate-200 focus:outline-none focus:border-blue-500"
            >
              <option value="">時刻を選択（任意）</option>
              {TIME_OPTIONS.map((t) => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>
          </div>

          {/* Service type */}
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-medium text-slate-400">施工内容</label>
            <select
              value={serviceType}
              onChange={(e) => setServiceType(e.target.value as ReservationServiceType)}
              className="w-full bg-[#0f172a] border border-slate-700 rounded-xl px-4 py-3 text-sm text-slate-200 focus:outline-none focus:border-blue-500"
            >
              {SERVICE_TYPES.map((t) => (
                <option key={t} value={t}>{serviceTypeLabel(t)}</option>
              ))}
            </select>
          </div>

          {/* Notes */}
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-medium text-slate-400">ご要望・備考</label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
              placeholder="車の状態、ご要望など"
              className="w-full bg-[#0f172a] border border-slate-700 rounded-xl px-4 py-3 text-sm text-slate-200 placeholder-slate-600 focus:outline-none focus:border-blue-500 resize-none"
            />
          </div>

          {error && (
            <p className="text-xs text-red-400 bg-red-500/10 border border-red-500/30 rounded-xl px-4 py-3">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={isPending}
            className="w-full py-3 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-sm font-bold rounded-xl transition-colors"
          >
            {isPending ? "送信中..." : "予約を申し込む"}
          </button>

          <p className="text-[10px] text-slate-600 text-center">
            ご予約後、担当スタッフより確認のご連絡を差し上げます。
          </p>
        </form>
      </div>
    </div>
  );
}
