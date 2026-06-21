// PHASE66: Admin official release dashboard page.
// Displays v1.0.0 release info, feature matrix, roadmap.
// Read-only. No deployment. No mutation.

import { getCurrentAdmin }     from "@/lib/admin/get-current-admin";
import { redirect }            from "next/navigation";
import { getOfficialReleaseInfo } from "@/lib/release/final-release";
import { writeAuditLog }       from "@/lib/admin/write-audit-log";
import OfficialReleasePanel    from "@/components/admin/OfficialReleasePanel";

export const dynamic = "force-dynamic";
export const metadata = { title: "Official Release v1.0.0 | GYEON Admin" };

export default async function AdminOfficialReleasePage() {
  const admin = await getCurrentAdmin();
  if (!admin) redirect("/login");

  const [info] = await Promise.all([
    getOfficialReleaseInfo(),
    writeAuditLog({
      adminUserId: admin.id,
      action:      "official_release_viewed",
      details:     { version: "1.0.0" },
    }).catch(() => {}),
  ]);

  return (
    <div className="flex flex-col gap-6">
      {/* Page header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-lg font-semibold text-slate-100">Official Release</h1>
          <p className="text-xs text-slate-500 mt-0.5">
            GYEON Detailer Agent v1.0.0 — Official Release Dashboard
          </p>
        </div>
        <span className="text-[10px] font-bold tracking-widest text-amber-400 uppercase px-2 py-1 border border-amber-700/50 rounded">
          v1.0.0
        </span>
      </div>

      <OfficialReleasePanel info={info} />
    </div>
  );
}
