import type { Metadata } from "next";
import MainLayout from "@/components/layout/MainLayout";
import PpfCoatingAdjustmentClient from "@/components/settings/PpfCoatingAdjustmentClient";
import { getPpfCoatingAdjustmentSettings } from "@/lib/pricing/get-ppf-coating-adjustment-settings";

export const metadata: Metadata = {
  title: "PPF＋コーティング減額 — GYEON Detailer Agent",
  description: "PPFとボディコーティングを同時施工する場合の店舗共通減額を設定します。",
};

export default async function PpfCoatingDiscountSettingsPage() {
  const result = await getPpfCoatingAdjustmentSettings();
  return (
    <MainLayout>
      <PpfCoatingAdjustmentClient result={result} />
    </MainLayout>
  );
}
