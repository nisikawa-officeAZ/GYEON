import type { Metadata } from "next";
import MainLayout from "@/components/layout/MainLayout";
import PpfSettingsClient from "@/components/settings/PpfSettingsClient";
import { getAuthoritativePpfR1InstallationCoefficients } from "@/lib/pricing/get-authoritative-ppf-r1-installation-coefficients";
import { getAuthoritativePpfR1PriceSettings } from "@/lib/pricing/get-authoritative-ppf-r1-price-settings";

export const metadata: Metadata = {
  title: "PPF種類・施工係数 — GYEON Detailer Agent",
  description: "PPFの基準価格、種類、施工係数、施工範囲と関連メニューを設定します。",
};

export default async function PpfSettingsPage() {
  const [resolution, coefficientResolution] = await Promise.all([
    getAuthoritativePpfR1PriceSettings(),
    getAuthoritativePpfR1InstallationCoefficients(),
  ]);

  return (
    <MainLayout>
      <PpfSettingsClient resolution={resolution} coefficientResolution={coefficientResolution} />
    </MainLayout>
  );
}
