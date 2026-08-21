import CategoryHub, { type CategoryHubItem } from "@/components/navigation/CategoryHub";
import MainLayout from "@/components/layout/MainLayout";

export const metadata = { title: "顧客・車両 | GYEON Detailer Agent" };

const ITEMS: readonly CategoryHubItem[] = [
  { href: "/customers", label: "顧客管理", labelEn: "CUSTOMERS", description: "顧客情報・施工履歴・LINE連携状態を管理。", icon: "customer" },
  { href: "/vehicles", label: "車両管理", labelEn: "VEHICLES", description: "顧客車両・登録情報・施工対象車両を管理。", icon: "vehicle" },
  { href: "/customer-app", label: "顧客アプリ", labelEn: "CUSTOMER APP", description: "顧客向けアプリ画面と提供情報を確認。", icon: "customer-app" },
] as const;

export default function CustomersHubPage() {
  return <MainLayout><CategoryHub label="顧客・車両" labelEn="CUSTOMERS" items={ITEMS} /></MainLayout>;
}
