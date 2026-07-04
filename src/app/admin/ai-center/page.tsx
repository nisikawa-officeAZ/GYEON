import { getCurrentAdmin } from "@/lib/admin/get-current-admin";
import { getGyeonAiCenterStatus, getGyeonAiUsageSummary } from "@/lib/ai/gyeon-ai-center";
import type { GyeonAiCenterStatus, GyeonAiUsageSummary } from "@/lib/ai/gyeon-ai-center";
import AiCenterClient from "./AiCenterClient";

export const dynamic = "force-dynamic";
export const metadata = { title: "AIセンター | GYEON Admin" };

export default async function AiCenterPage() {
  const admin = await getCurrentAdmin();
  const isSuperAdmin = admin?.role === "super_admin";

  // Key management status + usage summary are Super Admin only.
  let initialStatus: GyeonAiCenterStatus | null = null;
  let initialUsage: GyeonAiUsageSummary | null = null;
  if (isSuperAdmin) {
    [initialStatus, initialUsage] = await Promise.all([
      getGyeonAiCenterStatus(),
      getGyeonAiUsageSummary(),
    ]);
  }

  return (
    <AiCenterClient
      isSuperAdmin={isSuperAdmin}
      initialStatus={initialStatus}
      initialUsage={initialUsage}
    />
  );
}
