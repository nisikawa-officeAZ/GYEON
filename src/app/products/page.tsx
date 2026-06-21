import MainLayout from "@/components/layout/MainLayout";
import { getGyeonProducts, getGyeonProductCategories } from "@/lib/products/get-gyeon-products";
import type { GyeonProductDB } from "@/lib/products/product-types";
import ProductsClient from "./ProductsClient";

export default async function ProductsPage() {
  let products: GyeonProductDB[] = [];
  let categories: string[] = [];
  let loadError = false;

  try {
    [products, categories] = await Promise.all([
      getGyeonProducts({ active_only: false }),
      getGyeonProductCategories(),
    ]);
  } catch (err) {
    console.error("[ProductsPage] data fetch failed:", err);
    loadError = true;
  }

  return (
    <MainLayout>
      <div className="max-w-6xl mx-auto p-6">
        {loadError && (
          <div className="mb-4 flex items-center gap-3 px-4 py-3 rounded-xl border border-amber-700/40 bg-amber-950/20">
            <span className="text-amber-400 shrink-0">⚠</span>
            <p className="text-xs text-amber-300">
              商品データを読み込めませんでした。設定またはマイグレーションを確認してください。
            </p>
          </div>
        )}
        <ProductsClient initialProducts={products} categories={categories} />
      </div>
    </MainLayout>
  );
}
