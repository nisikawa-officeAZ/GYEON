"use client";

// Phase 2 Sprint 5 — OCR Session & Audit viewer shell.
// Composes the session history list and the audit trail. Read-only; all data is
// dealer-scoped server-side. Builds id→record lookup maps for linkage display.

import { useMemo, useState } from "react";
import PageTitle from "@/components/ui/PageTitle";
import type { OcrSession } from "@/lib/ocr/ocr-session-types";
import type { CustomerDB } from "@/lib/customers/customer-types";
import type { VehicleDB } from "@/lib/vehicles/vehicle-types";
import type { AuditLogDB } from "@/lib/audit/audit-types";
import OcrSessionList from "./OcrSessionList";
import OcrAuditTrail from "./OcrAuditTrail";

interface Props {
  sessions:  OcrSession[];
  customers: CustomerDB[];
  vehicles:  VehicleDB[];
  auditLogs: AuditLogDB[];
}

type Tab = "sessions" | "audit";

export default function OcrSessionsClient({ sessions, customers, vehicles, auditLogs }: Props) {
  const [tab, setTab] = useState<Tab>("sessions");

  const customerMap = useMemo(
    () => Object.fromEntries(customers.map((c) => [c.id, c])) as Record<string, CustomerDB>,
    [customers],
  );
  const vehicleMap = useMemo(
    () => Object.fromEntries(vehicles.map((v) => [v.id, v])) as Record<string, VehicleDB>,
    [vehicles],
  );

  const tabBtn = (active: boolean) =>
    `px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
      active ? "bg-[#1d4ed8] text-white" : "text-slate-400 hover:text-slate-200"
    }`;

  return (
    <div className="max-w-4xl mx-auto">
      <div className="mb-6">
        <PageTitle title="OCRセッション履歴" />
      </div>

      <div className="flex gap-2 mb-4">
        <button type="button" onClick={() => setTab("sessions")} className={tabBtn(tab === "sessions")}>
          セッション履歴（{sessions.length}）
        </button>
        <button type="button" onClick={() => setTab("audit")} className={tabBtn(tab === "audit")}>
          監査ログ（{auditLogs.length}）
        </button>
      </div>

      {tab === "sessions" ? (
        <OcrSessionList sessions={sessions} customerMap={customerMap} vehicleMap={vehicleMap} />
      ) : (
        <div className="bg-[#1e293b] rounded-xl shadow-lg p-4">
          <OcrAuditTrail logs={auditLogs} />
        </div>
      )}
    </div>
  );
}
