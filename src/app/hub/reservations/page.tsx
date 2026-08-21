import CategoryHub, { type CategoryHubItem } from "@/components/navigation/CategoryHub";
import MainLayout from "@/components/layout/MainLayout";

export const metadata = { title: "予約 | GYEON Detailer Agent" };

const ITEMS: readonly CategoryHubItem[] = [
  { href: "/reservations", label: "予約管理", labelEn: "RESERVATIONS", description: "予約一覧・入庫予定・引渡予定を管理。", icon: "reservation" },
  { href: "/calendar", label: "カレンダー", labelEn: "CALENDAR", description: "日程・担当者・作業枠をカレンダーで確認。", icon: "calendar" },
] as const;

export default function ReservationsHubPage() {
  return <MainLayout><CategoryHub label="予約" labelEn="RESERVATIONS" items={ITEMS} /></MainLayout>;
}
