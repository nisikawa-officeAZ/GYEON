"use client";

import { useState, useTransition } from "react";
import { ProductOrderDB, OrderStatus, orderStatusLabel } from "@/lib/product-orders/product-order-types";
import { getProductOrders } from "@/lib/product-orders/get-product-orders";
import ProductOrderForm  from "@/components/product-orders/ProductOrderForm";
import ProductOrderTable from "@/components/product-orders/ProductOrderTable";

const STATUS_TABS: { value: "all" | OrderStatus; label: string }[] = [
  { value: "all",       label: "すべて" },
  { value: "draft",     label: orderStatusLabel("draft") },
  { value: "submitted", label: orderStatusLabel("submitted") },
  { value: "approved",  label: orderStatusLabel("approved") },
  { value: "cancelled", label: orderStatusLabel("cancelled") },
];

interface Props {
  initialOrders: ProductOrderDB[];
}

export default function ProductOrdersClient({ initialOrders }: Props) {
  const [orders,      setOrders]      = useState<ProductOrderDB[]>(initialOrders);
  const [activeTab,   setActiveTab]   = useState<"all" | OrderStatus>("all");
  const [showForm,    setShowForm]    = useState(false);
  const [isRefreshing, startTransition] = useTransition();

  function refresh() {
    startTransition(async () => {
      const updated = await getProductOrders();
      setOrders(updated);
    });
  }

  function handleSaved(order: ProductOrderDB) {
    setOrders((prev) => [order, ...prev]);
    setShowForm(false);
  }

  const filtered = activeTab === "all"
    ? orders
    : orders.filter((o) => o.status === activeTab);

  // Count per status for tabs
  const counts: Record<string, number> = {};
  for (const o of orders) {
    counts[o.status] = (counts[o.status] ?? 0) + 1;
  }

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-100">商品注文</h1>
          <p className="text-xs text-slate-500 mt-0.5">GYEON商品の発注管理</p>
        </div>
        <button
          type="button"
          onClick={() => setShowForm((v) => !v)}
          className="px-4 py-2 text-sm font-medium bg-blue-700 hover:bg-blue-600 text-white rounded-lg transition-colors"
        >
          {showForm ? "キャンセル" : "+ 新規注文"}
        </button>
      </div>

      {/* New order form */}
      {showForm && (
        <div className="bg-[#0f172a] border border-slate-700 rounded-xl p-5">
          <h2 className="text-sm font-semibold text-slate-100 mb-4">新規注文作成</h2>
          <ProductOrderForm
            onSaved={handleSaved}
            onCancel={() => setShowForm(false)}
          />
        </div>
      )}

      {/* Status tabs */}
      <div className="flex gap-1 border-b border-slate-800">
        {STATUS_TABS.map((tab) => {
          const count = tab.value === "all" ? orders.length : (counts[tab.value] ?? 0);
          const isActive = activeTab === tab.value;
          return (
            <button
              key={tab.value}
              type="button"
              onClick={() => setActiveTab(tab.value)}
              className={`px-3 py-2 text-xs font-medium border-b-2 transition-colors ${
                isActive
                  ? "border-blue-500 text-blue-400"
                  : "border-transparent text-slate-500 hover:text-slate-300"
              }`}
            >
              {tab.label}
              {count > 0 && (
                <span className={`ml-1.5 px-1.5 py-0.5 rounded-full text-[9px] ${isActive ? "bg-blue-900 text-blue-300" : "bg-slate-800 text-slate-400"}`}>
                  {count}
                </span>
              )}
            </button>
          );
        })}
        {isRefreshing && (
          <div className="ml-auto self-center pr-2">
            <div className="w-3 h-3 border border-blue-500 border-t-transparent rounded-full animate-spin" />
          </div>
        )}
      </div>

      {/* Orders list */}
      <ProductOrderTable orders={filtered} onRefresh={refresh} />
    </div>
  );
}
