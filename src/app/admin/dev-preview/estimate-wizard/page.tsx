// Estimate Wizard Ver2.2 — Development-only browser mount (Phase 11K).
//
// Mounts the APPROVED wizard (ScreensPreview) under the existing super-admin Developer Preview area,
// and 404s outside development so no production route serves it. It reuses the existing wizard
// implementation verbatim — NO UI redesign, NO save/pricing/RPC/DB change, and it does NOT use the
// excluded Unified Wizard draft. Production routes and the existing EstimateEditor flow are unchanged.

import { getCurrentAdmin } from "@/lib/admin/get-current-admin";
import { getCurrentUser } from "@/lib/auth/get-current-user";
import { requireStaffCapability } from "@/lib/auth/require-staff-capability";
import { redirect, notFound } from "next/navigation";
import { headers } from "next/headers";
import { loginRedirectTarget } from "@/lib/auth/login-redirect";
import ScreensPreview from "@/components/estimates/wizard/screens/ScreensPreview";

export const dynamic = "force-dynamic";
export const metadata = { title: "見積ウィザード Ver2.2（開発プレビュー） | GYEON Admin" };

// Access model (DEVELOPMENT-ONLY route — production notFound()s below):
//   (a) super_admin              → view-only preview (existing behavior; no dealer context → save
//                                   fails with DEALER_CONTEXT_REQUIRED, unchanged).
//   (b) dealer staff with EDIT   → view AND save. Gated by requireStaffCapability("edit"), the SAME
//       capability                 authoritative gate the save action uses (getCurrentStaff +
//                                   getCurrentDealer + edit capability, fail-closed). This keeps page
//                                   access and save authorization consistent; dealer_id stays
//                                   server-resolved (never from the client).
//   (c) other authenticated user → denied → controlled fallback "/".
//   (d) unauthenticated          → /login, preserving the destination as ?next=.
export default async function EstimateWizardDevPreviewPage() {
  // Development-only: never served in production.
  if (process.env.NODE_ENV === "production") notFound();

  const admin = await getCurrentAdmin();
  if (admin) {
    if (admin.role !== "super_admin") redirect("/admin/dashboard");
    return <ScreensPreview />;
  }

  const user = await getCurrentUser();
  if (!user) {
    redirect(loginRedirectTarget((await headers()).get("x-pathname") ?? "/admin/dev-preview/estimate-wizard"));
  }

  const staffAuth = await requireStaffCapability("edit");
  if ("error" in staffAuth) redirect("/"); // authenticated but not an edit-capable dealer staff

  return <ScreensPreview />;
}
