import CategoryHub, { type CategoryHubItem } from "@/components/navigation/CategoryHub";
import MainLayout from "@/components/layout/MainLayout";

export const metadata = { title: "メッセージ | GYEON Detailer Agent" };

const ITEMS: readonly CategoryHubItem[] = [
  { href: "/line", label: "LINE", labelEn: "LINE", description: "顧客とのトーク・送信状況・連携状態を確認。", icon: "line" },
  { href: "/news", label: "お知らせ", labelEn: "NEWS", description: "GYEONからのお知らせと更新情報を確認。", icon: "news" },
] as const;

export default function MessagesHubPage() {
  return <MainLayout><CategoryHub label="メッセージ" labelEn="MESSAGES" items={ITEMS} /></MainLayout>;
}
