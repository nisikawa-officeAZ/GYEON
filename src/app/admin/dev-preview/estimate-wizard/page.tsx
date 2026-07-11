// Estimate Wizard Ver2.2 — Development-only browser mount (Phase 11K).
//
// Mounts the APPROVED wizard (ScreensPreview) under the existing super-admin Developer Preview area,
// and 404s outside development so no production route serves it. It reuses the existing wizard
// implementation verbatim — NO UI redesign, NO save/pricing/RPC/DB change, and it does NOT use the
// excluded Unified Wizard draft. Production routes and the existing EstimateEditor flow are unchanged.

import { getCurrentAdmin } from "@/lib/admin/get-current-admin";
import { redirect, notFound } from "next/navigation";
import ScreensPreview from "@/components/estimates/wizard/screens/ScreensPreview";

export const dynamic = "force-dynamic";
export const metadata = { title: "見積ウィザード Ver2.2（開発プレビュー） | GYEON Admin" };

export default async function EstimateWizardDevPreviewPage() {
  // Development-only: never served in production.
  if (process.env.NODE_ENV === "production") notFound();

  // Super-admin gate (matches the existing dev-preview routes).
  const admin = await getCurrentAdmin();
  if (!admin) redirect("/login");
  if (admin.role !== "super_admin") redirect("/admin/dashboard");

  return <ScreensPreview />;
}
