export const dynamic = "force-dynamic";

import { notFound } from "next/navigation";
import SettingsBackControl from "@/components/settings/SettingsBackControl";
import { getEstimateWizardSettingsView } from "@/lib/wizard-catalog/get-estimate-wizard-settings-view";
import EstimateWizardSettingsClient from "../EstimateWizardSettingsClient";
import { getEstimateWizardPanelConfig } from "../panel-config";

interface PageProps {
  params: Promise<{ panel: string }>;
}

export default async function EstimateWizardPanelPage({ params }: PageProps) {
  const { panel } = await params;
  const config = getEstimateWizardPanelConfig(panel);
  if (!config) notFound();

  const result = await getEstimateWizardSettingsView();

  let panelId: string | null = config.panelId;
  if (result.ok && config.sectionId) {
    panelId = result.view.sections.find((section) => section.id === config.sectionId)?.anchorId ?? null;
  }
  if (result.ok && !panelId) notFound();

  return (
    <div className="mx-auto flex w-full max-w-[1280px] flex-col gap-6">
      <SettingsBackControl href="/settings/estimate-wizard" label="見積ウィザード設定へ戻る" />
      <div className="flex flex-col gap-3">
        <div className="flex flex-col gap-1">
          <h1 className="text-lg font-semibold text-slate-100">{config.labelJa}</h1>
          <p className="text-[10px] font-semibold tracking-[0.18em] text-[#8191ad]">{config.labelEn}</p>
        </div>
      </div>

      {result.ok ? (
        <EstimateWizardSettingsClient view={result.view} panelId={panelId!} />
      ) : (
        <div className="rounded-xl border border-red-800/60 bg-red-900/40 px-4 py-3 text-sm text-red-300">
          {result.messageJa}
        </div>
      )}
    </div>
  );
}
