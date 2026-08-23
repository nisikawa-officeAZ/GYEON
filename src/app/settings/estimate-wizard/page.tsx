export const dynamic = "force-dynamic";

import MainLayout from "@/components/layout/MainLayout";
import { getEstimateWizardSettingsView } from "@/lib/wizard-catalog/get-estimate-wizard-settings-view";
import EstimateWizardSettingsClient from "./EstimateWizardSettingsClient";

// C2C4 — Estimate Wizard catalog settings page (server component).
// Resolves the authoritative presentation-safe view server-side and hands it to the
// client. The Estimate Wizard itself is NOT mounted here and no estimate-save
// orchestration is wired.
export default async function EstimateWizardSettingsPage() {
  const result = await getEstimateWizardSettingsView();

  return (
    <MainLayout>
      {/* Keep the approved card UI on the same 1280px canvas as the settings hub.
          The former max-w-3xl wrapper compressed the three-column desktop grid and
          made the wizard cards look materially smaller than their parent cards. */}
      <div className="mx-auto flex w-full max-w-[1280px] flex-col gap-6">
        <div className="flex flex-col gap-1">
          <h1 className="text-lg font-semibold text-slate-100">見積ウィザード設定</h1>
          <p className="text-xs text-slate-500">
            見積ウィザードで使用する項目（フィルム・サービスメニュー・その他作業・店舗オプション）を登録し、内容を確認します。
          </p>
        </div>

        {result.ok ? (
          <EstimateWizardSettingsClient view={result.view} />
        ) : (
          <div className="px-4 py-3 bg-red-900/40 border border-red-800/60 rounded-xl text-sm text-red-300">
            {result.messageJa}
          </div>
        )}
      </div>
    </MainLayout>
  );
}
