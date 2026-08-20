import CategoryHub, { type CategoryHubItem } from "@/components/navigation/CategoryHub";
import MainLayout from "@/components/layout/MainLayout";

export const metadata = { title: "請求・入金 | GYEON Detailer Agent" };

const BILLING_ITEMS: readonly CategoryHubItem[] = [
  {
    href: "/invoices",
    label: "請求管理",
    labelEn: "INVOICES",
    description: "請求書発行・売上管理。締め請求の確認と再発行。",
    icon: "invoice",
  },
  {
    href: "/payments",
    label: "入金管理",
    labelEn: "PAYMENTS",
    description: "入金確認・消込管理。未入金のフォロー。",
    icon: "payment",
  },
  {
    href: "/points",
    label: "ポイント",
    labelEn: "POINTS",
    description: "ポイント付与・利用履歴の管理。",
    icon: "points",
  },
  {
    href: "/sales",
    label: "売上",
    labelEn: "SALES",
    description: "売上の集計・推移を確認。",
    icon: "sales",
  },
  {
    href: "/monthly-statements",
    label: "月次明細",
    labelEn: "MONTHLY STATEMENTS",
    description: "締め請求・月次明細の発行。",
    icon: "monthly-statements",
  },
] as const;

export default function BillingHubPage() {
  return (
    <MainLayout>
      <CategoryHub label="請求・入金" labelEn="BILLING" items={BILLING_ITEMS} />
    </MainLayout>
  );
}
