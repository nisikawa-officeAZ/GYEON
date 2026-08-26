import type { Metadata } from "next";
import MainLayout from "@/components/layout/MainLayout";
import WindowFilmSettingsClient from "@/components/settings/WindowFilmSettingsClient";
import { getAuthoritativeWindowFilmV1Settings } from "@/lib/pricing/get-authoritative-window-film-v1-settings";

export const metadata: Metadata = {
  title: "ウインドウフィルム設定 — GYEON Detailer Agent",
  description: "フィルム種類、施工部位、セット、オプションの価格と所要時間を設定します。",
};

export default async function WindowFilmSettingsPage() {
  const resolution = await getAuthoritativeWindowFilmV1Settings();
  return (
    <MainLayout>
      <WindowFilmSettingsClient resolution={resolution} />
    </MainLayout>
  );
}
