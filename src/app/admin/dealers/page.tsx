import { redirect } from "next/navigation";
import { getCurrentAdmin } from "@/lib/admin/get-current-admin";
import { getDealersAdmin, getArchivedDealersAdmin, getAdminUserIds } from "@/lib/admin/get-dealers-admin";
import { isGyeonPartnerOnboardingEnabled } from "@/lib/gyeon/partner-onboarding-enabled";
import { listGyeonProvisioning } from "@/lib/admin/gyeon-provisioning-actions";
import type { GyeonProvisioningAdminRow } from "@/lib/admin/gyeon-provisioning-csv-core";
import DealersAdminClient from "./DealersAdminClient";

export const dynamic = "force-dynamic";
export const metadata = { title: "店舗管理 | GYEON Admin" };

export default async function AdminDealersPage() {
  const caller = await getCurrentAdmin();
  if (!caller) redirect("/login");

  // logistics_admin has read-only access (no action buttons rendered in client)
  const [dealers, archived, protectedOwnerIds] = await Promise.all([
    getDealersAdmin(),
    getArchivedDealersAdmin(),
    getAdminUserIds(),
  ]);

  // GYEON partner provisioning panel: rendered ONLY when the server-only
  // feature gate is on AND the caller is super_admin. When the gate is off the
  // UI is omitted entirely and no provisioning query runs.
  const partnerOnboarding = isGyeonPartnerOnboardingEnabled() && caller.role === "super_admin";
  let provisioning: GyeonProvisioningAdminRow[] | null = null;
  if (partnerOnboarding) {
    const result = await listGyeonProvisioning().catch(() => null);
    provisioning = result?.kind === "ok" ? result.rows : [];
  }

  return (
    <DealersAdminClient
      dealers={dealers}
      archived={archived}
      protectedOwnerIds={protectedOwnerIds}
      callerRole={caller.role}
      partnerOnboarding={partnerOnboarding}
      provisioning={provisioning}
    />
  );
}
