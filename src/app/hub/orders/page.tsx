import CategoryHub, { type CategoryHubItem } from "@/components/navigation/CategoryHub";
import MainLayout from "@/components/layout/MainLayout";

export const metadata = { title: "発注・在庫 | GYEON Detailer Agent" };

const ITEMS: readonly CategoryHubItem[] = [
  { href: "/product-orders", label: "商品注文", labelEn: "PRODUCT ORDERS", description: "GYEON商品の注文と履歴を確認。", icon: "product-orders" },
  { href: "/products", label: "商品管理", labelEn: "PRODUCTS", description: "取扱商品と商品情報を確認。", icon: "products" },
  { href: "/inventory", label: "在庫カウント", labelEn: "INVENTORY COUNT", description: "店舗で使用する商品の在庫数を確認。", icon: "inventory" },
] as const;

export default function OrdersHubPage() {
  return <MainLayout><CategoryHub label="発注・在庫" labelEn="ORDERS" items={ITEMS} /></MainLayout>;
}
