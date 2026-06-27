"use client";

import { useState, useTransition } from "react";
import { createWarehouseAdjustment } from "@/lib/admin/logistics/warehouse-adjustment-actions";
import ProductSearchInput from "@/app/admin/logistics/_components/ProductSearchInput";
import type {
  WarehouseAdjustmentRow,
  AdjustmentType,
  ReceivingFormData,
  WarehouseAdjustmentInput,
} from "@/lib/admin/logistics/logistics-types";
import { ADJUSTMENT_TYPE_LABELS } from "@/lib/admin/logistics/logistics-types";

const ADJUSTMENT_TYPES: AdjustmentType[] = ["damage", "loss", "internal_use", "sample", "correction"];

const DELTA_SIGN: Record<AdjustmentType, 1 | -1> = {
  damage:       -1,
  loss:         -1,
  internal_use: -1,
  sample:       -1,
  correction:    1, // correction can be either; user sets qty with sign via toggle
};

type Props = {
  dealers:            ReceivingFormData["dealers"];
  products:           ReceivingFormData["products"];
  initialAdjustments: WarehouseAdjustmentRow[];
};

const emptyForm = {
  dealer_id:               "",
  product_id:              "",
  adjustment_type:         "damage" as AdjustmentType,
  reason:                  "",
  abs_quantity:            0,
  is_positive:             false, // for correction type only
  case_count:              0,
  loose_count:             0,
  units_per_case_snapshot: 1,
  note:                    "",
};

export default function AdjustmentsClient({ dealers, products, initialAdjustments }: Props) {
  const [adjustments, setAdjustments] = useState(initialAdjustments);
  const [form, setForm]               = useState(emptyForm);
  const [error, setError]             = useState<string | null>(null);
  const [success, setSuccess]         = useState(false);
  const [isPending, startTransition]  = useTransition();

  const isCorrection = form.adjustment_type === "correction";
  const signedDelta  = isCorrection
    ? (form.is_positive ? 1 : -1) * form.abs_quantity
    : -form.abs_quantity; // all non-correction types reduce stock

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSuccess(false);

    if (!form.dealer_id)     { setError("ディーラーを選択してください");    return; }
    if (!form.product_id)    { setError("製品を選択してください");          return; }
    if (!form.reason.trim()) { setError("理由は必須です");                  return; }
    if (form.abs_quantity <= 0) { setError("数量は1以上を入力してください"); return; }

    const input: WarehouseAdjustmentInput = {
      dealer_id:               form.dealer_id,
      product_id:              form.product_id,
      adjustment_type:         form.adjustment_type,
      reason:                  form.reason.trim(),
      quantity_delta:          signedDelta,
      case_count:              form.case_count,
      loose_count:             form.loose_count,
      units_per_case_snapshot: form.units_per_case_snapshot,
      note:                    form.note || undefined,
    };

    startTransition(async () => {
      const result = await createWarehouseAdjustment(input);
      if (!result.success) { setError(result.error); return; }

      setSuccess(true);
      setForm(emptyForm);

      const dealer  = dealers.find((d) => d.id === form.dealer_id);
      const product = products.find((p) => p.id === form.product_id);
      setAdjustments((prev) => [{
        id:                  crypto.randomUUID(),
        dealer_id:           form.dealer_id,
        dealer_name:         dealer?.name ?? "—",
        product_id:          form.product_id,
        sku:                 product?.sku ?? "—",
        product_name:        product?.product_name ?? "—",
        adjustment_type:     form.adjustment_type,
        reason:              form.reason,
        quantity_delta:      signedDelta,
        balance_after:       0,
        performed_by_name:   null,
        note:                form.note || null,
        created_at:          new Date().toISOString(),
      }, ...prev]);
    });
  }

  return (
    <div className="max-w-5xl mx-auto">
      <div className="mb-6">
        <h1 className="text-xl font-semibold text-white">Stock Adjustments</h1>
        <p className="text-sm text-slate-400 mt-0.5">破損・紛失・社内使用・サンプル・在庫補正の記録</p>
      </div>

      {/* Form */}
      <form onSubmit={handleSubmit} className="bg-slate-800/60 border border-slate-700/50 rounded-xl p-6 mb-8">
        <h2 className="text-sm font-semibold text-slate-300 mb-4">New Adjustment</h2>

        {/* Adjustment type tabs */}
        <div className="flex flex-wrap gap-2 mb-4">
          {ADJUSTMENT_TYPES.map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setForm((f) => ({ ...f, adjustment_type: t }))}
              className={[
                "px-3 py-1.5 rounded-lg text-xs font-medium transition-colors",
                form.adjustment_type === t
                  ? "bg-rose-600 text-white"
                  : "bg-slate-700 text-slate-300 hover:bg-slate-600",
              ].join(" ")}
            >
              {ADJUSTMENT_TYPE_LABELS[t]}
            </button>
          ))}
        </div>

        {/* Row 1: Dealer + Product */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
          <div>
            <label className="block text-xs text-slate-400 mb-1">Dealer <span className="text-red-400">*</span></label>
            <select
              value={form.dealer_id}
              onChange={(e) => setForm((f) => ({ ...f, dealer_id: e.target.value }))}
              className="w-full bg-slate-700/50 border border-slate-600 focus:border-green-500 rounded-lg px-3 py-2 text-sm text-white outline-none"
            >
              <option value="">-- Dealer --</option>
              {dealers.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
            </select>
          </div>

          <div>
            <label className="block text-xs text-slate-400 mb-1">Product <span className="text-red-400">*</span></label>
            <ProductSearchInput
              products={products}
              selectedId={form.product_id}
              onSelect={(p) => setForm((f) => ({
                ...f,
                product_id:              p.id,
                units_per_case_snapshot: p.units_per_case ?? 1,
              }))}
            />
          </div>
        </div>

        {/* Row 2: Reason */}
        <div className="mb-4">
          <label className="block text-xs text-slate-400 mb-1">理由 <span className="text-red-400">*</span></label>
          <input
            type="text"
            value={form.reason}
            onChange={(e) => setForm((f) => ({ ...f, reason: e.target.value }))}
            placeholder="調整の理由を具体的に入力してください"
            className="w-full bg-slate-700/50 border border-slate-600 focus:border-green-500 rounded-lg px-3 py-2 text-sm text-white placeholder:text-slate-500 outline-none"
          />
        </div>

        {/* Row 3: Quantity */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div>
            <label className="block text-xs text-slate-400 mb-1">調整数量 <span className="text-red-400">*</span></label>
            <input
              type="number"
              min={0}
              value={form.abs_quantity}
              onChange={(e) => setForm((f) => ({ ...f, abs_quantity: parseInt(e.target.value) || 0 }))}
              className="w-full bg-slate-700/50 border border-slate-600 focus:border-green-500 rounded-lg px-3 py-2 text-sm text-white outline-none"
            />
          </div>

          {isCorrection && (
            <div>
              <label className="block text-xs text-slate-400 mb-1">方向</label>
              <div className="flex gap-2 mt-1">
                <button
                  type="button"
                  onClick={() => setForm((f) => ({ ...f, is_positive: false }))}
                  className={`flex-1 py-2 rounded-lg text-xs font-medium transition-colors ${!form.is_positive ? "bg-rose-700 text-white" : "bg-slate-700 text-slate-300"}`}
                >
                  ▼ 減少
                </button>
                <button
                  type="button"
                  onClick={() => setForm((f) => ({ ...f, is_positive: true }))}
                  className={`flex-1 py-2 rounded-lg text-xs font-medium transition-colors ${form.is_positive ? "bg-emerald-700 text-white" : "bg-slate-700 text-slate-300"}`}
                >
                  ▲ 増加
                </button>
              </div>
            </div>
          )}

          <div>
            <label className="block text-xs text-slate-400 mb-1">備考</label>
            <input
              type="text"
              value={form.note}
              onChange={(e) => setForm((f) => ({ ...f, note: e.target.value }))}
              placeholder="追加メモ"
              className="w-full bg-slate-700/50 border border-slate-600 focus:border-green-500 rounded-lg px-3 py-2 text-sm text-white placeholder:text-slate-500 outline-none"
            />
          </div>
        </div>

        {/* Delta preview */}
        {form.abs_quantity > 0 && (
          <div className="mt-4 px-4 py-3 bg-slate-900/60 rounded-lg text-sm text-slate-300">
            在庫変動:{" "}
            <span className={`font-bold ${signedDelta < 0 ? "text-rose-400" : "text-emerald-400"}`}>
              {signedDelta > 0 ? "+" : ""}{signedDelta} 個
            </span>
            <span className="ml-3 text-slate-500">{ADJUSTMENT_TYPE_LABELS[form.adjustment_type]}</span>
          </div>
        )}

        {error   && <p className="mt-3 text-sm text-red-400">{error}</p>}
        {success && <p className="mt-3 text-sm text-green-400">調整を記録しました。</p>}

        <div className="mt-5 flex justify-end">
          <button
            type="submit"
            disabled={isPending}
            className="px-6 py-2 bg-rose-700 hover:bg-rose-600 disabled:opacity-50 text-white text-sm font-medium rounded-lg transition-colors"
          >
            {isPending ? "記録中…" : "調整確定"}
          </button>
        </div>
      </form>

      {/* Recent adjustments */}
      <div>
        <h2 className="text-sm font-semibold text-slate-300 mb-3">Recent Adjustments</h2>
        {adjustments.length === 0 ? (
          <div className="text-center py-12 text-slate-500 text-sm">まだ調整記録がありません。</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-700/50">
                  {["日時", "ディーラー", "商品", "種別", "理由", "数量", "調整後在庫", "実施者"].map((h) => (
                    <th key={h} className="text-left px-3 py-2.5 text-xs font-medium text-slate-400">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {adjustments.map((a) => (
                  <tr key={a.id} className="border-b border-slate-700/20 hover:bg-slate-800/30">
                    <td className="px-3 py-3 text-slate-400 whitespace-nowrap text-xs">
                      {new Date(a.created_at).toLocaleString("ja-JP", { dateStyle: "short", timeStyle: "short" })}
                    </td>
                    <td className="px-3 py-3 text-white text-xs">{a.dealer_name}</td>
                    <td className="px-3 py-3">
                      <div className="text-white text-xs">{a.product_name}</div>
                      <div className="text-slate-500 text-xs">{a.sku}</div>
                    </td>
                    <td className="px-3 py-3">
                      <span className="px-2 py-0.5 rounded bg-slate-700 text-slate-300 text-xs">
                        {ADJUSTMENT_TYPE_LABELS[a.adjustment_type]}
                      </span>
                    </td>
                    <td className="px-3 py-3 text-slate-300 text-xs max-w-xs truncate">{a.reason}</td>
                    <td className="px-3 py-3 text-center font-medium">
                      <span className={a.quantity_delta < 0 ? "text-rose-400" : "text-emerald-400"}>
                        {a.quantity_delta > 0 ? "+" : ""}{a.quantity_delta}
                      </span>
                    </td>
                    <td className="px-3 py-3 text-slate-300 text-center text-xs">{a.balance_after}</td>
                    <td className="px-3 py-3 text-slate-500 text-xs">{a.performed_by_name ?? "—"}</td>
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
