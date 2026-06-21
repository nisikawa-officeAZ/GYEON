"use client";

import { useState } from "react";
import { ReservationDB, ReservationStatus, reservationStatusLabel } from "@/lib/reservations/reservation-types";
import { getReservations } from "@/lib/reservations/get-reservations";
import ReservationTable from "@/components/reservations/ReservationTable";
import ReservationForm from "@/components/reservations/ReservationForm";

type Tab = "all" | ReservationStatus;

const TABS: { value: Tab; label: string }[] = [
  { value: "all",       label: "すべて" },
  { value: "pending",   label: reservationStatusLabel("pending") },
  { value: "confirmed", label: reservationStatusLabel("confirmed") },
  { value: "completed", label: reservationStatusLabel("completed") },
  { value: "cancelled", label: reservationStatusLabel("cancelled") },
  { value: "no_show",   label: reservationStatusLabel("no_show") },
];

interface Props {
  initialReservations: ReservationDB[];
  customers: Array<{ id: string; last_name: string; first_name: string | null }>;
  vehicles: Array<{
    id: string;
    customer_id: string | null;
    maker: string | null;
    model: string | null;
    plate_number: string | null;
  }>;
}

export default function ReservationsPageClient({
  initialReservations,
  customers,
  vehicles,
}: Props) {
  const [reservations, setReservations] = useState<ReservationDB[]>(initialReservations);
  const [activeTab,  setActiveTab]  = useState<Tab>("all");
  const [dateFrom,   setDateFrom]   = useState("");
  const [dateTo,     setDateTo]     = useState("");
  const [modal, setModal] = useState<null | "new" | { reservation: ReservationDB }>(null);
  const [loading, setLoading] = useState(false);

  const modalReservation =
    modal && typeof modal === "object" && "reservation" in modal
      ? modal.reservation
      : undefined;

  async function reload() {
    setLoading(true);
    try {
      const data = await getReservations({
        status: activeTab === "all" ? undefined : (activeTab as ReservationStatus),
        from:   dateFrom || undefined,
        to:     dateTo   || undefined,
        limit:  200,
      });
      setReservations(data);
    } finally {
      setLoading(false);
    }
  }

  async function handleTabChange(tab: Tab) {
    setActiveTab(tab);
    setLoading(true);
    try {
      const data = await getReservations({
        status: tab === "all" ? undefined : (tab as ReservationStatus),
        from:   dateFrom || undefined,
        to:     dateTo   || undefined,
        limit:  200,
      });
      setReservations(data);
    } finally {
      setLoading(false);
    }
  }

  async function handleDateFilter() {
    setLoading(true);
    try {
      const data = await getReservations({
        status: activeTab === "all" ? undefined : (activeTab as ReservationStatus),
        from:   dateFrom || undefined,
        to:     dateTo   || undefined,
        limit:  200,
      });
      setReservations(data);
    } finally {
      setLoading(false);
    }
  }

  function handleFormSuccess(r: ReservationDB) {
    setModal(null);
    reload();
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h1 className="text-lg font-semibold text-slate-100">予約一覧</h1>
        <button
          onClick={() => setModal("new")}
          className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg transition-colors"
        >
          + 新規予約
        </button>
      </div>

      {/* Status tabs */}
      <div className="flex items-center gap-1 bg-[#0f172a] border border-slate-800 rounded-xl p-1 flex-wrap">
        {TABS.map((t) => (
          <button
            key={t.value}
            onClick={() => handleTabChange(t.value)}
            className={`px-3 py-1.5 text-xs rounded-lg transition-colors ${
              activeTab === t.value
                ? "bg-blue-600 text-white font-medium"
                : "text-slate-400 hover:text-slate-200"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Date range filter */}
      <div className="flex items-end gap-3 flex-wrap">
        <div className="flex flex-col gap-1">
          <label className="text-xs text-slate-400">開始日</label>
          <input
            type="date"
            value={dateFrom}
            onChange={(e) => setDateFrom(e.target.value)}
            className="bg-[#1e293b] border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-blue-500"
          />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs text-slate-400">終了日</label>
          <input
            type="date"
            value={dateTo}
            onChange={(e) => setDateTo(e.target.value)}
            className="bg-[#1e293b] border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-blue-500"
          />
        </div>
        <button
          onClick={handleDateFilter}
          className="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-slate-200 text-sm rounded-lg transition-colors"
        >
          絞り込み
        </button>
        {(dateFrom || dateTo) && (
          <button
            onClick={() => { setDateFrom(""); setDateTo(""); reload(); }}
            className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-400 text-sm rounded-lg transition-colors"
          >
            クリア
          </button>
        )}
        {loading && <span className="text-xs text-slate-500">読込中...</span>}
      </div>

      {/* Table */}
      <ReservationTable
        reservations={reservations}
        onEdit={(r) => setModal({ reservation: r })}
        onRefresh={reload}
      />

      {/* Modal */}
      {modal !== null && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
          onClick={() => setModal(null)}
        >
          <div
            className="bg-[#1e293b] border border-slate-700 rounded-xl shadow-xl w-full max-w-md max-h-[90vh] overflow-y-auto p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="text-base font-semibold text-slate-100 mb-4">
              {modalReservation ? "予約編集" : "新規予約"}
            </h2>
            <ReservationForm
              reservation={modalReservation}
              customers={customers}
              vehicles={vehicles}
              onSuccess={handleFormSuccess}
              onCancel={() => setModal(null)}
            />
          </div>
        </div>
      )}
    </div>
  );
}
