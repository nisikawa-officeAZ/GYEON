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
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-4">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-[20px] font-bold text-[#edf3fc] md:text-[22px]">予約一覧</h1>
          <p className="mt-1 text-[10px] font-semibold tracking-[0.22em] text-[#7788a4]">RESERVATIONS</p>
        </div>
        <button
          onClick={() => setModal("new")}
          className="shrink-0 rounded-xl border border-[#2f5db8] bg-[#1c4fd6] px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-[#1a45bd] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#3478ff]"
        >
          + 新規予約
        </button>
      </div>

      {/* Status tabs */}
      <div className="flex flex-wrap items-center gap-1 rounded-2xl border border-[#263955] bg-[#111826]/90 p-1 backdrop-blur-xl">
        {TABS.map((t) => (
          <button
            key={t.value}
            onClick={() => handleTabChange(t.value)}
            className={`rounded-xl px-3 py-1.5 text-xs font-medium transition-colors ${
              activeTab === t.value
                ? "bg-[#1c4fd6] text-white"
                : "text-[#7788a4] hover:text-[#c3cee2]"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Date range filter */}
      <div className="flex items-end gap-3 flex-wrap rounded-2xl border border-[#263955] bg-[#111826]/90 p-4 backdrop-blur-xl">
        <div className="flex flex-col gap-1">
          <label className="text-xs text-[#7788a4]">開始日</label>
          <input
            type="date"
            value={dateFrom}
            onChange={(e) => setDateFrom(e.target.value)}
            className="rounded-lg border border-[#263955] bg-[#0d1420] px-3 py-2 text-sm text-[#edf3fc] focus:outline-none focus:border-[#3478ff]"
          />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs text-[#7788a4]">終了日</label>
          <input
            type="date"
            value={dateTo}
            onChange={(e) => setDateTo(e.target.value)}
            className="rounded-lg border border-[#263955] bg-[#0d1420] px-3 py-2 text-sm text-[#edf3fc] focus:outline-none focus:border-[#3478ff]"
          />
        </div>
        <button
          onClick={handleDateFilter}
          className="rounded-lg border border-[#263955] bg-[#1a2740] px-4 py-2 text-sm text-[#c3cee2] transition-colors hover:bg-[#20304a] hover:text-[#edf3fc]"
        >
          絞り込み
        </button>
        {(dateFrom || dateTo) && (
          <button
            onClick={() => { setDateFrom(""); setDateTo(""); reload(); }}
            className="rounded-lg border border-[#263955] bg-[#0d1420] px-4 py-2 text-sm text-[#7788a4] transition-colors hover:bg-[#1a2740] hover:text-[#c3cee2]"
          >
            クリア
          </button>
        )}
        {loading && <span className="text-xs text-[#7788a4]">読込中...</span>}
      </div>

      {/* Table */}
      <div className="overflow-hidden rounded-2xl border border-[#263955] bg-[#111826]/90 backdrop-blur-xl">
        <ReservationTable
          reservations={reservations}
          onEdit={(r) => setModal({ reservation: r })}
          onRefresh={reload}
        />
      </div>

      {/* Modal */}
      {modal !== null && (
        <div
          className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto overscroll-contain p-3 sm:p-4"
          onClick={() => setModal(null)}
        >
          <div className="fixed inset-0 bg-[#0f172a]/80 backdrop-blur-sm" aria-hidden />
          <div
            className="relative my-4 w-full max-w-md max-h-[90vh] overflow-y-auto rounded-2xl border border-[#263955] bg-[#111826] p-6 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-base font-semibold text-[#edf3fc]">
                {modalReservation ? "予約編集" : "新規予約"}
              </h2>
              <button
                type="button"
                onClick={() => setModal(null)}
                aria-label="閉じる"
                className="flex h-9 w-9 items-center justify-center rounded-md text-[#7788a4] transition-colors hover:bg-[#1a2740] hover:text-[#edf3fc]"
              >
                ✕
              </button>
            </div>
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
