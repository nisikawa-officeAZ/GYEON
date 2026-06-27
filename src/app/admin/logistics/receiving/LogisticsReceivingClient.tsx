"use client";

import { useState, useTransition } from "react";
import { createAdminReceiptRecord } from "@/lib/admin/logistics/logistics-receiving-actions";
import type {
  LogisticsReceivingRecord,
  ReceivingFormData,
} from "@/lib/admin/logistics/logistics-types";

type Props = {
  dealers:        ReceivingFormData["dealers"];
  products:       ReceivingFormData["products"];
  initialReceipts: LogisticsReceivingRecord[];
};

const emptyForm = {
  dealer_id:               "",
  product_id:              "",
  case_count:              0,
  loose_count:             0,
  damaged_count:           0,
  units_per_case_snapshot: 1,
  note:                    "",
};

export default function LogisticsReceivingClient({ dealers, products, initialReceipts }: Props) {
  const [receipts, setReceipts] = useState(initialReceipts);
  const [form, setForm]         = useState(emptyForm);
  const [error, setError]       = useState<string | null>(null);
  const [success, setSuccess]   = useState(false);
  const [isPending, startTransition] = useTransition();

  const selectedProduct = products.find((p) => p.id === form.product_id);

  function handleProductChange(productId: string) {
    const product = products.find((p) => p.id === productId);
    setForm((f) => ({
      ...f,
      product_id:              productId,
      units_per_case_snapshot: product?.units_per_case ?? 1,
    }));
  }

  const totalUnits =
    form.case_count * Math.max(1, form.units_per_case_snapshot) + form.loose_count;

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSuccess(false);

    if (!form.dealer_id)  { setError("ディーラーを選択してください");  return; }
    if (!form.product_id) { setError("製品を選択してください");        return; }
    if (totalUnits <= 0)  { setError("入荷数量は1以上を入力してください"); return; }

    startTransition(async () => {
      const result = await createAdminReceiptRecord({
        dealer_id:               form.dealer_id,
        product_id:              form.product_id,
        case_count:              form.case_count,
        loose_count:             form.loose_count,
        damaged_count:           form.damaged_count,
        units_per_case_snapshot: form.units_per_case_snapshot,
        note:                    form.note || undefined,
      });

      if (!result.success) {
        setError(result.error);
        return;
      }

      setSuccess(true);
      setForm(emptyForm);
      // Refresh would need router.refresh() — for simplicity add placeholder to top
      const dealer  = dealers.find((d) => d.id === form.dealer_id);
      const product = products.find((p) => p.id === form.product_id);
      const newRow: LogisticsReceivingRecord = {
        id:                      crypto.randomUUID(),
        dealer_id:               form.dealer_id,
        dealer_name:             dealer?.name ?? "—",
        product_id:              form.product_id,
        sku:                     product?.sku ?? "—",
        product_name:            product?.product_name ?? "—",
        case_count:              form.case_count,
        loose_count:             form.loose_count,
        damaged_count:           form.damaged_count,
        total_quantity:          totalUnits,
        units_per_case_snapshot: form.units_per_case_snapshot,
        received_at:             new Date().toISOString(),
        note:                    form.note || null,
      };
      setReceipts((r) => [newRow, ...r]);
    });
  }

  return (
    <div className="max-w-5xl mx-auto">
      <div className="mb-6">
        <h1 className="text-xl font-semibold text-white">Receiving Workflow</h1>
        <p className="text-sm text-slate-400 mt-0.5">Record stock receipt for a dealer</p>
      </div>

      {/* Form */}
      <form onSubmit={handleSubmit} className="bg-slate-800/60 border border-slate-700/50 rounded-xl p-6 mb-8">
        <h2 className="text-sm font-semibold text-slate-300 mb-4">New Receipt</h2>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs text-slate-400 mb-1">Dealer</label>
            <select
              value={form.dealer_id}
              onChange={(e) => setForm((f) => ({ ...f, dealer_id: e.target.value }))}
              className="w-full bg-slate-900 border border-slate-600 rounded-lg px-3 py-2 text-sm text-white"
            >
              <option value="">-- Select dealer --</option>
              {dealers.map((d) => (
                <option key={d.id} value={d.id}>{d.name}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs text-slate-400 mb-1">Product</label>
            <select
              value={form.product_id}
              onChange={(e) => handleProductChange(e.target.value)}
              className="w-full bg-slate-900 border border-slate-600 rounded-lg px-3 py-2 text-sm text-white"
            >
              <option value="">-- Select product --</option>
              {products.map((p) => (
                <option key={p.id} value={p.id}>[{p.sku}] {p.product_name}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Units per case info */}
        {selectedProduct && (
          <p className="mt-2 text-xs text-slate-500">
            Default units/case: {selectedProduct.units_per_case ?? "N/A"}
          </p>
        )}

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-4">
          <div>
            <label className="block text-xs text-slate-400 mb-1">Units/Case</label>
            <input
              type="number"
              min={1}
              value={form.units_per_case_snapshot}
              onChange={(e) => setForm((f) => ({ ...f, units_per_case_snapshot: parseInt(e.target.value) || 1 }))}
              className="w-full bg-slate-900 border border-slate-600 rounded-lg px-3 py-2 text-sm text-white"
            />
          </div>
          <div>
            <label className="block text-xs text-slate-400 mb-1">Box Qty</label>
            <input
              type="number"
              min={0}
              value={form.case_count}
              onChange={(e) => setForm((f) => ({ ...f, case_count: parseInt(e.target.value) || 0 }))}
              className="w-full bg-slate-900 border border-slate-600 rounded-lg px-3 py-2 text-sm text-white"
            />
          </div>
          <div>
            <label className="block text-xs text-slate-400 mb-1">Loose Units</label>
            <input
              type="number"
              min={0}
              value={form.loose_count}
              onChange={(e) => setForm((f) => ({ ...f, loose_count: parseInt(e.target.value) || 0 }))}
              className="w-full bg-slate-900 border border-slate-600 rounded-lg px-3 py-2 text-sm text-white"
            />
          </div>
          <div>
            <label className="block text-xs text-slate-400 mb-1">Damaged</label>
            <input
              type="number"
              min={0}
              value={form.damaged_count}
              onChange={(e) => setForm((f) => ({ ...f, damaged_count: parseInt(e.target.value) || 0 }))}
              className="w-full bg-slate-900 border border-slate-600 rounded-lg px-3 py-2 text-sm text-white"
            />
          </div>
        </div>

        <div className="mt-4">
          <label className="block text-xs text-slate-400 mb-1">Note (optional)</label>
          <input
            type="text"
            value={form.note}
            onChange={(e) => setForm((f) => ({ ...f, note: e.target.value }))}
            placeholder="e.g. PO-2024-001, special handling"
            className="w-full bg-slate-900 border border-slate-600 rounded-lg px-3 py-2 text-sm text-white placeholder-slate-600"
          />
        </div>

        {/* Total calculation */}
        <div className="mt-4 px-4 py-3 bg-slate-900/60 rounded-lg text-sm text-slate-300">
          Total units: <span className="font-bold text-white">{totalUnits}</span>
          {form.damaged_count > 0 && (
            <span className="ml-3 text-amber-400">({form.damaged_count} damaged)</span>
          )}
        </div>

        {error && (
          <p className="mt-3 text-sm text-red-400">{error}</p>
        )}
        {success && (
          <p className="mt-3 text-sm text-green-400">入荷を記録しました。</p>
        )}

        <div className="mt-5 flex justify-end">
          <button
            type="submit"
            disabled={isPending}
            className="px-6 py-2 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white text-sm font-medium rounded-lg transition-colors"
          >
            {isPending ? "Recording…" : "Confirm Receipt"}
          </button>
        </div>
      </form>

      {/* Recent receipts */}
      <div>
        <h2 className="text-sm font-semibold text-slate-300 mb-3">Recent Receipts</h2>
        {receipts.length === 0 ? (
          <div className="text-center py-12 text-slate-500 text-sm">No receipts recorded yet.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-700/50">
                  {["Date", "Dealer", "Product", "Boxes", "Loose", "Damaged", "Total", "Note"].map((h) => (
                    <th key={h} className="text-left px-3 py-2.5 text-xs font-medium text-slate-400 uppercase">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {receipts.map((r) => (
                  <tr key={r.id} className="border-b border-slate-700/20 hover:bg-slate-800/30">
                    <td className="px-3 py-3 text-slate-400 whitespace-nowrap">
                      {new Date(r.received_at).toLocaleString("ja-JP", { dateStyle: "short", timeStyle: "short" })}
                    </td>
                    <td className="px-3 py-3 text-white">{r.dealer_name}</td>
                    <td className="px-3 py-3">
                      <div className="text-white">{r.product_name}</div>
                      <div className="text-xs text-slate-500">{r.sku}</div>
                    </td>
                    <td className="px-3 py-3 text-slate-300 text-center">{r.case_count}</td>
                    <td className="px-3 py-3 text-slate-300 text-center">{r.loose_count}</td>
                    <td className="px-3 py-3 text-center">
                      {r.damaged_count > 0
                        ? <span className="text-amber-400">{r.damaged_count}</span>
                        : <span className="text-slate-600">—</span>}
                    </td>
                    <td className="px-3 py-3 font-semibold text-white text-center">{r.total_quantity}</td>
                    <td className="px-3 py-3 text-slate-500 text-xs max-w-xs truncate">{r.note ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
