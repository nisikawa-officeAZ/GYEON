import type { Metadata } from "next";
import MainLayout from "@/components/layout/MainLayout";
import PpfSettingsClient from "@/components/settings/PpfSettingsClient";

export const metadata: Metadata = {
  title: "PPF種類・施工係数 — GYEON Detailer Agent",
  description: "PPFの基準価格、種類、施工係数、施工範囲と関連メニューを設定します。",
};

export default function PpfSettingsPage() {
  return (
    <MainLayout>
      <PpfSettingsClient />
    </MainLayout>
  );
}
