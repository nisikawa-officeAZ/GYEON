import { Suspense }    from "react";
import MainLayout       from "@/components/layout/MainLayout";
import NewReminderForm  from "./NewReminderForm";

export const metadata = { title: "メンテナンス予定作成 | DealerOS" };

export default function NewMaintenancePage() {
  return (
    <MainLayout>
      <div className="max-w-2xl mx-auto p-6">
        <Suspense fallback={<p className="text-xs text-slate-500">読み込み中...</p>}>
          <NewReminderForm />
        </Suspense>
      </div>
    </MainLayout>
  );
}
