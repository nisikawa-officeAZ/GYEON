import type { Metadata } from "next";
import MainLayout from "@/components/layout/MainLayout";
import CoatingV34SettingsClient from "@/components/settings/CoatingV34SettingsClient";
import { getAuthoritativeShopRank } from "@/lib/dealer-settings/get-authoritative-shop-rank";
import { getAuthoritativeCoatingV34Settings } from "@/lib/pricing/get-authoritative-coating-v34-settings";

export const metadata: Metadata = {
  title: "コーティング設定 — GYEON Detailer Agent",
  description: "1層目・2層目・3層目の車両サイズ別コーティング価格を設定します。",
};

export default async function CoatingSettingsPage() {
  const [resolution, rank] = await Promise.all([
    getAuthoritativeCoatingV34Settings(),
    getAuthoritativeShopRank(),
  ]);

  return (
    <MainLayout>
      <CoatingV34SettingsClient resolution={resolution} rank={rank} />
    </MainLayout>
  );
}
