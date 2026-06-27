import MainLayout from "@/components/layout/MainLayout";
import { getProductsWithStock } from "@/lib/inventory/inventory-actions";
import { getGyeonProductCategories } from "@/lib/products/get-gyeon-products";
import InventoryClient from "./InventoryClient";

export const metadata = { title: "在庫カウント | GYEON Business Hub" };

export default async function InventoryPage() {
  const [items, categories] = await Promise.all([
    getProductsWithStock(),
    getGyeonProductCategories(),
  ]);

  return (
    <MainLayout>
      <div className="max-w-3xl mx-auto px-4 py-8">
        <InventoryClient initialItems={items} categories={categories} />
      </div>
    </MainLayout>
  );
}
