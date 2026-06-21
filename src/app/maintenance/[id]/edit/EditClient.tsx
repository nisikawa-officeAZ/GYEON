"use client";

import { useRouter } from "next/navigation";
import MaintenanceReminderForm from "@/components/maintenance/MaintenanceReminderForm";
import { MaintenanceReminderDB, maintenanceReminderDisplayNo } from "@/lib/maintenance/maintenance-types";

export default function EditClient({ reminder }: { reminder: MaintenanceReminderDB }) {
  const router = useRouter();

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center gap-3">
        <a href={`/maintenance/${reminder.id}`} className="text-xs text-slate-400 hover:text-slate-200">
          ← 詳細に戻る
        </a>
        <h1 className="text-lg font-semibold text-slate-100">
          {maintenanceReminderDisplayNo(reminder)} を編集
        </h1>
      </div>

      <div className="bg-[#0f172a] border border-slate-800 rounded-xl p-6">
        <MaintenanceReminderForm
          reminder={reminder}
          onSaved={(saved) => router.push(`/maintenance/${saved.id}`)}
          onCancel={() => router.push(`/maintenance/${reminder.id}`)}
        />
      </div>
    </div>
  );
}
