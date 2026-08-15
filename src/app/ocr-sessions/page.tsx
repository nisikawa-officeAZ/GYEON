import MainLayout from "@/components/layout/MainLayout";
import OcrSessionsClient from "@/components/ocr/OcrSessionsClient";
import OcrHistoryPanel from "@/components/ocr/OcrHistoryPanel";
import { getRecentOcrSessions } from "@/lib/ocr/ocr-session-actions";
import { getOcrHistory } from "@/lib/ocr/get-ocr-history";
import { getCustomers } from "@/lib/customers/get-customers";
import { getVehicles } from "@/lib/vehicles/get-vehicles";
import { getAuditLogs } from "@/lib/audit/audit";

export default async function OcrSessionsPage() {
  // All fetches are dealer-scoped via getCurrentDealer() inside each function.
  const [sessions, customers, vehicles, audit, ocrHistory] = await Promise.all([
    getRecentOcrSessions(50),
    getCustomers(),
    getVehicles(),
    getAuditLogs({ resource_type: "vehicle_registration", per_page: 50 }),
    getOcrHistory(),
  ]);

  return (
    <MainLayout>
      <OcrSessionsClient
        sessions={sessions}
        customers={customers}
        vehicles={vehicles}
        auditLogs={audit.data}
      />
      {/* E9.3: OCR history — reuses the existing getOcrHistory service (no schema) */}
      <OcrHistoryPanel entries={ocrHistory} />
    </MainLayout>
  );
}
