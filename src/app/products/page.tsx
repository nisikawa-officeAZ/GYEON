import MainLayout from "@/components/layout/MainLayout";
import { getGyeonProducts, getGyeonProductCategories } from "@/lib/products/get-gyeon-products";
import ProductsClient from "./ProductsClient";

export default async function ProductsPage() {
  const [products, categories] = await Promise.all([
    getGyeonProducts({ active_only: false }),
    getGyeonProductCategories(),
  ]);

  return (
    <MainLayout>
      <div className="max-w-6xl mx-auto p-6">
        <ProductsClient initialProducts={products} categories={categories} />
      </div>
    </MainLayout>
  );
}
