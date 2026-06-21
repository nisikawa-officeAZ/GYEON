import MainLayout from "@/components/layout/MainLayout";
import { getProductOrders } from "@/lib/product-orders/get-product-orders";
import ProductOrdersClient from "./ProductOrdersClient";

export default async function ProductOrdersPage() {
  const orders = await getProductOrders();

  return (
    <MainLayout>
      <div className="max-w-5xl mx-auto p-6">
        <ProductOrdersClient initialOrders={orders} />
      </div>
    </MainLayout>
  );
}
