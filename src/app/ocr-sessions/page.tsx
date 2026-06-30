import MainLayout from "@/components/layout/MainLayout";
import OcrSessionsClient from "@/components/ocr/OcrSessionsClient";
import { getRecentOcrSessions } from "@/lib/ocr/ocr-session-actions";
import { getCustomers } from "@/lib/customers/get-customers";
import { getVehicles } from "@/lib/vehicles/get-vehicles";
import { getAuditLogs } from "@/lib/audit/audit";

export default async function OcrSessionsPage() {
  // All fetches are dealer-scoped via getCurrentDealer() inside each function.
  const [sessions, customers, vehicles, audit] = await Promise.all([
    getRecentOcrSessions(50),
    getCustomers(),
    getVehicles(),
    getAuditLogs({ resource_type: "vehicle_registration", per_page: 50 }),
  ]);

  return (
    <MainLayout>
      <OcrSessionsClient
        sessions={sessions}
        customers={customers}
        vehicles={vehicles}
        auditLogs={audit.data}
      />
    </MainLayout>
  );
}
