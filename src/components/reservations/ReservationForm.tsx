"use client";

import { useState, useTransition } from "react";
import { createReservation } from "@/lib/reservations/create-reservation";
import { updateReservation } from "@/lib/reservations/update-reservation";
import {
  ReservationDB,
  ReservationStatus,
  ReservationServiceType,
  reservationStatusLabel,
  serviceTypeLabel,
} from "@/lib/reservations/reservation-types";

interface Props {
  reservation?: ReservationDB;
  customers: Array<{ id: string; last_name: string; first_name: string | null }>;
  vehicles: Array<{
    id: string;
    customer_id: string | null;
    maker: string | null;
    model: string | null;
    plate_number: string | null;
  }>;
  defaultDate?: string;
  onSuccess?: (r: ReservationDB) => void;
  onCancel?: () => void;
}

const SERVICE_TYPES: ReservationServiceType[] = [
  "coating", "maintenance", "ppf", "window", "wheel", "interior", "other",
];

const STATUSES: ReservationStatus[] = [
  "pending", "confirmed", "completed", "cancelled", "no_show",
];

export default function ReservationForm({
  reservation,
  customers,
  vehicles,
  defaultDate,
  onSuccess,
  onCancel,
}: Props) {
  const isEdit = !!reservation;
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const [customerId, setCustomerId] = useState<string>(reservation?.customer_id ?? "");
  const [vehicleId,  setVehicleId]  = useState<string>(reservation?.vehicle_id  ?? "");
  const [serviceType, setServiceType] = useState<ReservationServiceType>(
    reservation?.service_type ?? "other"
  );
  const [date,      setDate]      = useState(reservation?.reservation_date ?? defaultDate ?? "");
  const [startTime, setStartTime] = useState(reservation?.start_time?.slice(0, 5) ?? "");
  const [endTime,   setEndTime]   = useState(reservation?.end_time?.slice(0, 5)   ?? "");
  const [notes,     setNotes]     = useState(reservation?.notes ?? "");
  const [status,    setStatus]    = useState<ReservationStatus>(reservation?.status ?? "pending");

  // Customer search filter
  const [custSearch, setCustSearch] = useState("");

  const filteredCustomers = custSearch
    ? customers.filter((c) => {
        const name = [c.last_name, c.first_name].filter(Boolean).join(" ");
        return name.includes(custSearch);
      })
    : customers;

  // Filter vehicles by selected customer
  const filteredVehicles = customerId
    ? vehicles.filter((v) => v.customer_id === customerId)
    : vehicles;

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!date) {
      setError("予約日を入力してください");
      return;
    }

    startTransition(async () => {
      if (isEdit) {
        const result = await updateReservation(reservation!.id, {
          customer_id:      customerId   || null,
          vehicle_id:       vehicleId    || null,
          service_type:     serviceType,
          reservation_date: date,
          start_time:       startTime    || null,
          end_time:         endTime      || null,
          notes:            notes        || null,
          status,
        });
        if (result.success && result.data) {
          onSuccess?.(result.data);
        } else {
          setError(result.error ?? "更新に失敗しました");
        }
      } else {
        const result = await createReservation({
          customer_id:      customerId   || null,
          vehicle_id:       vehicleId    || null,
          service_type:     serviceType,
          reservation_date: date,
          start_time:       startTime    || null,
          end_time:         endTime      || null,
          notes:            notes        || null,
          status,
        });
        if (result.success && result.data) {
          onSuccess?.(result.data);
        } else {
          setError(result.error ?? "作成に失敗しました");
        }
      }
    });
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      {/* Customer select */}
      <div className="flex flex-col gap-1">
        <label className="text-xs text-slate-400">顧客</label>
        <input
          type="text"
          placeholder="顧客を検索..."
          value={custSearch}
          onChange={(e) => setCustSearch(e.target.value)}
          className="w-full bg-[#1e293b] border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:border-blue-500"
        />
        <select
          value={customerId}
          onChange={(e) => {
            setCustomerId(e.target.value);
            setVehicleId("");
          }}
          className="w-full bg-[#1e293b] border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-blue-500"
        >
          <option value="">顧客を選択</option>
          {filteredCustomers.map((c) => (
            <option key={c.id} value={c.id}>
              {[c.last_name, c.first_name].filter(Boolean).join(" ")}
            </option>
          ))}
        </select>
      </div>

      {/* Vehicle select */}
      <div className="flex flex-col gap-1">
        <label className="text-xs text-slate-400">車両</label>
        <select
          value={vehicleId}
          onChange={(e) => setVehicleId(e.target.value)}
          className="w-full bg-[#1e293b] border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-blue-500"
        >
          <option value="">車両を選択</option>
          {filteredVehicles.map((v) => (
            <option key={v.id} value={v.id}>
              {[v.maker, v.model, v.plate_number].filter(Boolean).join(" ")}
            </option>
          ))}
        </select>
      </div>

      {/* Service type */}
      <div className="flex flex-col gap-1">
        <label className="text-xs text-slate-400">施工内容 <span className="text-red-400">*</span></label>
        <select
          value={serviceType}
          onChange={(e) => setServiceType(e.target.value as ReservationServiceType)}
          className="w-full bg-[#1e293b] border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-blue-500"
          required
        >
          {SERVICE_TYPES.map((t) => (
            <option key={t} value={t}>{serviceTypeLabel(t)}</option>
          ))}
        </select>
      </div>

      {/* Date */}
      <div className="flex flex-col gap-1">
        <label className="text-xs text-slate-400">予約日 <span className="text-red-400">*</span></label>
        <input
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          required
          className="w-full bg-[#1e293b] border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-blue-500"
        />
      </div>

      {/* Time */}
      <div className="grid grid-cols-2 gap-3">
        <div className="flex flex-col gap-1">
          <label className="text-xs text-slate-400">開始時刻</label>
          <input
            type="time"
            value={startTime}
            onChange={(e) => setStartTime(e.target.value)}
            className="w-full bg-[#1e293b] border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-blue-500"
          />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs text-slate-400">終了時刻</label>
          <input
            type="time"
            value={endTime}
            onChange={(e) => setEndTime(e.target.value)}
            className="w-full bg-[#1e293b] border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-blue-500"
          />
        </div>
      </div>

      {/* Status (edit only) */}
      {isEdit && (
        <div className="flex flex-col gap-1">
          <label className="text-xs text-slate-400">ステータス</label>
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value as ReservationStatus)}
            className="w-full bg-[#1e293b] border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-blue-500"
          >
            {STATUSES.map((s) => (
              <option key={s} value={s}>{reservationStatusLabel(s)}</option>
            ))}
          </select>
        </div>
      )}

      {/* Notes */}
      <div className="flex flex-col gap-1">
        <label className="text-xs text-slate-400">メモ</label>
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={3}
          className="w-full bg-[#1e293b] border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:border-blue-500 resize-none"
          placeholder="備考・要望など"
        />
      </div>

      {error && (
        <p className="text-xs text-red-400 bg-red-500/10 border border-red-500/30 rounded-lg px-3 py-2">
          {error}
        </p>
      )}

      <div className="flex gap-2 pt-1">
        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            className="flex-1 px-4 py-2 bg-slate-700 hover:bg-slate-600 text-slate-200 text-sm rounded-lg transition-colors"
          >
            キャンセル
          </button>
        )}
        <button
          type="submit"
          disabled={isPending}
          className="flex-1 px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-sm font-medium rounded-lg transition-colors"
        >
          {isPending ? "処理中..." : isEdit ? "更新" : "予約作成"}
        </button>
      </div>
    </form>
  );
}
