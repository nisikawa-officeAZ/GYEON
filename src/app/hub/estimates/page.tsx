import CategoryHub, { type CategoryHubItem } from "@/components/navigation/CategoryHub";
import MainLayout from "@/components/layout/MainLayout";

export const metadata = { title: "見積・作業 | GYEON Detailer Agent" };

const ITEMS: readonly CategoryHubItem[] = [
  { href: "/estimates", label: "見積管理", labelEn: "ESTIMATES", description: "見積の作成・検索・進行状況を管理。", icon: "estimate" },
  { href: "/work-orders", label: "作業管理", labelEn: "WORK ORDERS", description: "施工予定・担当・作業進捗を確認。", icon: "work-orders" },
  { href: "/completion-reports", label: "完了報告", labelEn: "COMPLETION REPORTS", description: "施工完了後の報告内容と成果物を管理。", icon: "completion" },
  { href: "/maintenance", label: "メンテナンス", labelEn: "MAINTENANCE", description: "メンテナンス予定とフォロー対象を確認。", icon: "maintenance" },
] as const;

export default function EstimatesHubPage() {
  return <MainLayout><CategoryHub label="見積・作業" labelEn="ESTIMATES" items={ITEMS} /></MainLayout>;
}
