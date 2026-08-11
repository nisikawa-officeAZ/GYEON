"use client";

// GDA-1W completion boundary (accepted contract §3, §7.1):
//   * The GENERIC save path can no longer express completion. 「完了」 is not a
//     selectable status, and `actual_end_at` is neither a form field nor part
//     of the submitted payload — the server action and the database both
//     reject them independently; this form simply cannot produce them.
//   * Completion is ONE deliberate action in the dedicated panel below: the
//     operator confirms the actual end time AND the monetary-free performed
//     work, then presses the completion button, which calls the atomic
//     `completeWorkOrder` command. A linked estimate only PREFILLS the
//     editable candidate; the confirmed snapshot is the authority.
//   * One idempotency key per INTENT: generated when the panel's inputs
//     change, retained across retries of the unchanged intent.

import { useState, useTransition, useEffect } from "react";
import { createWorkOrder } from "@/lib/work-orders/create-work-order";
import { updateWorkOrder } from "@/lib/work-orders/update-work-order";
import { completeWorkOrder } from "@/lib/work-orders/complete-work-order";
import {
  WorkOrderDB,
  WorkOrderStatus,
  workOrderStatusLabel,
  type PerformedWorkItemInput,
} from "@/lib/work-orders/work-order-types";
import { EstimateDB, estimateDisplayNo, estimateCustomerName } from "@/lib/estimates/estimate-types";
import { CustomerDB } from "@/lib/customers/customer-types";
import { VehicleDB }  from "@/lib/vehicles/vehicle-types";
import { previewDocumentNumber } from "@/lib/numbering/preview-document-number";

// ─── Form state ───────────────────────────────────────────────────────────────
// `actual_end_at` is intentionally ABSENT: it is owned by the completion
// authority and never travels with the generic save.

interface FormFields {
  estimate_id:        string;
  customer_id:        string;
  vehicle_id:         string;
  work_order_number:  string;
  status:             WorkOrderStatus;
  title:              string;
  scheduled_start_at: string;
  scheduled_end_at:   string;
  actual_start_at:    string;
  assigned_staff:     string;
  service_summary:    string;
  notes:              string;
  internal_memo:      string;
}

const EMPTY: FormFields = {
  estimate_id:        "",
  customer_id:        "",
  vehicle_id:         "",
  work_order_number:  "",
  status:             "scheduled",
  title:              "",
  scheduled_start_at: "",
  scheduled_end_at:   "",
  actual_start_at:    "",
  assigned_staff:     "",
  service_summary:    "",
  notes:              "",
  internal_memo:      "",
};

function fromDB(wo: WorkOrderDB): FormFields {
  return {
    estimate_id:        wo.estimate_id        ?? "",
    customer_id:        wo.customer_id        ?? "",
    vehicle_id:         wo.vehicle_id         ?? "",
    work_order_number:  wo.work_order_number  ?? "",
    status:             wo.status,
    title:              wo.title              ?? "",
    scheduled_start_at: wo.scheduled_start_at ? wo.scheduled_start_at.slice(0, 16) : "",
    scheduled_end_at:   wo.scheduled_end_at   ? wo.scheduled_end_at.slice(0, 16)   : "",
    actual_start_at:    wo.actual_start_at    ? wo.actual_start_at.slice(0, 16)    : "",
    assigned_staff:     wo.assigned_staff     ?? "",
    service_summary:    wo.service_summary    ?? "",
    notes:              wo.notes              ?? "",
    internal_memo:      wo.internal_memo      ?? "",
  };
}

// ─── Constants ────────────────────────────────────────────────────────────────

// 「完了」 is deliberately NOT selectable: completion happens only through the
// dedicated completion action below.
const SELECTABLE_STATUSES: Exclude<WorkOrderStatus, "completed">[] = [
  'scheduled', 'in_progress', 'cancelled', 'on_hold',
];

const COMPLETABLE_STATUSES: WorkOrderStatus[] = ['scheduled', 'in_progress', 'on_hold'];

const inputClass =
  "bg-[#0f172a] border border-slate-700 rounded-lg px-3 py-2.5 text-sm text-slate-100 placeholder-slate-600 focus:outline-none focus:border-[#1d4ed8] transition-colors min-h-[44px]";
const labelClass = "text-xs font-medium text-slate-400";

// Stable domain codes from the completion adapter, in operator language.
// Raw SQL/server text never reaches this component by construction.
const COMPLETION_ERROR_MESSAGES: Record<string, string> = {
  UNAUTHENTICATED:               "ログインが必要です。再度ログインしてください。",
  NOT_FOUND:                     "作業指示が見つかりません。",
  PERMISSION_DENIED:             "完了操作の権限がありません。",
  VALIDATION_ERROR:              "入力内容を確認してください（終了日時と、実施した作業 1〜100 件が必要です）。",
  INVALID_STATE:                 "この状態の作業指示は完了できません。",
  IDEMPOTENCY_CONFLICT:          "内容が変更されています。もう一度内容を確認して完了してください。",
  ALREADY_COMPLETED_CONFLICT:    "この作業指示は既に別の内容で完了しています。",
  RECOVERY_REQUIRED:             "過去データの復旧確認が必要です。管理者に連絡してください。",
  COMPLETION_STATE_INCONSISTENT: "データ状態に不整合があります。管理者に連絡してください。",
  REPORT_NUMBER_FAILED:          "報告書番号の採番に失敗しました。もう一度お試しください。",
  STALE_VERSION:                 "他の更新が先に行われました。最新の内容を確認してください。",
  UNEXPECTED_ERROR:              "完了処理に失敗しました。同じ内容のままもう一度お試しください。",
};

/** One key per intent: generated client-side, 16-128 chars, retained for retries. */
function newIntentKey(): string {
  return `wo-complete-${crypto.randomUUID()}`;
}

interface CompletionItemDraft {
  category:    string;
  itemName:    string;
  description: string;
}

const EMPTY_ITEM: CompletionItemDraft = { category: "", itemName: "", description: "" };

/** Monetary-free prefill candidate from the linked estimate (§3.4): prefill ONLY. */
function prefillItems(wo: WorkOrderDB | undefined): CompletionItemDraft[] {
  const items = wo?.estimates?.estimate_items;
  if (!items || items.length === 0) return [{ ...EMPTY_ITEM }];
  return [...items]
    .sort((a, b) => a.sort_order - b.sort_order)
    .map((i) => ({ category: i.category, itemName: i.item_name, description: i.description ?? "" }));
}

// ─── Props ────────────────────────────────────────────────────────────────────

interface WorkOrderFormProps {
  workOrder?:       WorkOrderDB;
  estimates:        EstimateDB[];
  customers:        CustomerDB[];
  vehicles:         VehicleDB[];
  initialEstimateId?: string;   // pre-filled when launched from Estimate detail
  onCancel?:        () => void;
  onSuccess?:       () => void;
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function WorkOrderForm({
  workOrder,
  estimates,
  customers,
  vehicles,
  initialEstimateId,
  onCancel,
  onSuccess,
}: WorkOrderFormProps) {
  const isEdit = !!workOrder;
  const isCompleted = workOrder?.status === "completed";
  const canComplete = isEdit && !!workOrder && COMPLETABLE_STATUSES.includes(workOrder.status);

  const [form, setForm] = useState<FormFields>(() => {
    if (workOrder) return fromDB(workOrder);
    if (initialEstimateId) {
      // Find the estimate and pre-fill customer/vehicle/title
      const est = estimates.find((e) => e.id === initialEstimateId);
      return {
        ...EMPTY,
        estimate_id: initialEstimateId,
        customer_id: est?.customer_id ?? "",
        vehicle_id:  est?.vehicle_id  ?? "",
        title:       est?.title ?? (est ? estimateDisplayNo(est) : ""),
      };
    }
    return EMPTY;
  });

  const [error,     setError]   = useState<string | null>(null);
  const [pending,   startTransition] = useTransition();
  const [previewNo, setPreviewNo] = useState<string>("");

  // ── Completion panel state ──
  const [completionEndAt, setCompletionEndAt] = useState<string>("");
  const [completionItems, setCompletionItems] = useState<CompletionItemDraft[]>(() => prefillItems(workOrder));
  const [completionKey,   setCompletionKey]   = useState<string>(() => newIntentKey());
  const [completionError, setCompletionError] = useState<string | null>(null);
  const [completionDone,  setCompletionDone]  = useState<string | null>(null);
  const [completing, startCompleting] = useTransition();

  useEffect(() => {
    if (!workOrder) {
      previewDocumentNumber("work_order").then((p) => setPreviewNo(p ?? ""));
    }
  }, [workOrder]);

  function set<K extends keyof FormFields>(key: K, value: FormFields[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  // Any change to the completion inputs is a NEW intent: it gets a new key.
  // Retrying the SAME inputs (after e.g. a network failure) reuses the key.
  function touchCompletionIntent() {
    setCompletionKey(newIntentKey());
    setCompletionError(null);
  }

  function setCompletionItem(index: number, patch: Partial<CompletionItemDraft>) {
    setCompletionItems((prev) => prev.map((it, i) => (i === index ? { ...it, ...patch } : it)));
    touchCompletionIntent();
  }

  function addCompletionItem() {
    setCompletionItems((prev) => (prev.length >= 100 ? prev : [...prev, { ...EMPTY_ITEM }]));
    touchCompletionIntent();
  }

  function removeCompletionItem(index: number) {
    setCompletionItems((prev) => (prev.length <= 1 ? prev : prev.filter((_, i) => i !== index)));
    touchCompletionIntent();
  }

  // When estimate changes, auto-fill customer/vehicle/title.
  function handleEstimateChange(estimateId: string) {
    const est = estimates.find((e) => e.id === estimateId);
    set("estimate_id", estimateId);
    if (est) {
      set("customer_id", est.customer_id ?? "");
      set("vehicle_id",  est.vehicle_id  ?? "");
      if (!form.title) set("title", est.title ?? estimateDisplayNo(est));
    }
  }

  // Filter vehicles to those belonging to selected customer.
  const filteredVehicles = form.customer_id
    ? vehicles.filter((v) => v.customer_id === form.customer_id)
    : vehicles;

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);

    const fd = new FormData();
    (Object.keys(form) as (keyof FormFields)[]).forEach((k) => fd.set(k, form[k]));

    startTransition(async () => {
      const result = isEdit && workOrder
        ? await updateWorkOrder(workOrder.id, fd)
        : await createWorkOrder(fd);

      if (result?.error) {
        setError(result.error);
      } else {
        onSuccess?.();
        onCancel?.();
      }
    });
  }

  function handleComplete() {
    if (!workOrder) return;
    setCompletionError(null);

    if (!completionEndAt) {
      setCompletionError("実際の終了日時を入力してください。");
      return;
    }

    // Exactly the three monetary-free fields (§3.2); blank description -> null.
    const performedItems: PerformedWorkItemInput[] = completionItems.map((it) => ({
      category:    it.category,
      itemName:    it.itemName,
      description: it.description.trim() === "" ? null : it.description,
    }));

    startCompleting(async () => {
      const result = await completeWorkOrder({
        workOrderId:    workOrder.id,
        idempotencyKey: completionKey,   // retained for retries of this intent
        actualEndAt:    new Date(completionEndAt).toISOString(),
        performedItems,
      });

      if (!result.ok) {
        setCompletionError(
          COMPLETION_ERROR_MESSAGES[result.code] ?? COMPLETION_ERROR_MESSAGES.UNEXPECTED_ERROR,
        );
        return;
      }

      setCompletionDone(
        result.result.outcome === "created"
          ? `完了しました（報告書番号: ${result.result.report_number}）`
          : `既に完了済みです（報告書番号: ${result.result.report_number}）`,
      );
      onSuccess?.();
    });
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-5">

      {error && (
        <div className="bg-red-900/30 border border-red-700 rounded-lg px-3 py-2">
          <p className="text-xs text-red-400">{error}</p>
        </div>
      )}

      {/* ── No & Status ── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div className="flex flex-col gap-1">
          <label className={labelClass}>作業番号</label>
          <input
            type="text"
            value={form.work_order_number}
            onChange={(e) => set("work_order_number", e.target.value)}
            placeholder={previewNo ? `自動採番: ${previewNo}` : "WO-0000-00001"}
            className={inputClass}
          />
          {!form.work_order_number && previewNo && (
            <p className="text-xs text-slate-500">空欄の場合、保存時に自動採番されます（次: {previewNo}）</p>
          )}
        </div>
        <div className="flex flex-col gap-1">
          <label className={labelClass}>ステータス</label>
          {isCompleted ? (
            <>
              {/* A completed order shows its terminal status read-only; leaving
                  'completed' requires a future correction/recovery operation. */}
              <input type="text" value={workOrderStatusLabel("completed")} disabled className={inputClass} />
              <p className="text-[10px] text-slate-500">完了済みの作業指示のステータスはここでは変更できません。</p>
            </>
          ) : (
            <>
              <select
                value={form.status}
                onChange={(e) => set("status", e.target.value as WorkOrderStatus)}
                className={inputClass}
              >
                {SELECTABLE_STATUSES.map((s) => (
                  <option key={s} value={s}>{workOrderStatusLabel(s)}</option>
                ))}
              </select>
              {canComplete && (
                <p className="text-[10px] text-slate-500">完了は下の「作業完了」で行います。</p>
              )}
            </>
          )}
        </div>
      </div>

      {/* ── Linked Estimate ── */}
      <div className="flex flex-col gap-1">
        <label className={labelClass}>見積（紐付け）</label>
        <select
          value={form.estimate_id}
          onChange={(e) => handleEstimateChange(e.target.value)}
          className={inputClass}
        >
          <option value="">— 紐付けなし —</option>
          {estimates.map((est) => (
            <option key={est.id} value={est.id}>
              {estimateDisplayNo(est)}
              {est.customers ? ` — ${estimateCustomerName(est.customers)}` : ""}
              {est.vehicles?.model ? ` / ${est.vehicles.model}` : ""}
            </option>
          ))}
        </select>
      </div>

      {/* ── Title ── */}
      <div className="flex flex-col gap-1">
        <label className={labelClass}>タイトル</label>
        <input
          type="text"
          value={form.title}
          onChange={(e) => set("title", e.target.value)}
          placeholder="例: コーティング施工 山田様"
          className={inputClass}
        />
      </div>

      {/* ── Customer ── */}
      <div className="flex flex-col gap-1">
        <label className={labelClass}>顧客</label>
        <select
          value={form.customer_id}
          onChange={(e) => {
            set("customer_id", e.target.value);
            set("vehicle_id", "");
          }}
          className={inputClass}
        >
          <option value="">— 顧客を選択 —</option>
          {customers.map((c) => (
            <option key={c.id} value={c.id}>
              {[c.last_name, c.first_name].filter(Boolean).join(" ")}
              {(c.last_name_kana || c.first_name_kana)
                ? ` (${[c.last_name_kana, c.first_name_kana].filter(Boolean).join(" ")})`
                : ""}
            </option>
          ))}
        </select>
      </div>

      {/* ── Vehicle ── */}
      <div className="flex flex-col gap-1">
        <label className={labelClass}>車両</label>
        <select
          value={form.vehicle_id}
          onChange={(e) => set("vehicle_id", e.target.value)}
          disabled={!form.customer_id}
          className={inputClass}
        >
          <option value="">— 車両を選択 —</option>
          {filteredVehicles.map((v) => (
            <option key={v.id} value={v.id}>
              {[v.maker, v.model, v.plate_number].filter(Boolean).join(" ") || v.id}
            </option>
          ))}
        </select>
        {!form.customer_id && (
          <p className="text-[10px] text-slate-600">先に顧客を選択してください。</p>
        )}
      </div>

      {/* ── Scheduled ── */}
      <div className="flex flex-col gap-1">
        <label className={labelClass}>施工予定</label>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="flex flex-col gap-1">
            <span className="text-[10px] text-slate-500">開始</span>
            <input
              type="datetime-local"
              value={form.scheduled_start_at}
              onChange={(e) => set("scheduled_start_at", e.target.value)}
              className={inputClass}
            />
          </div>
          <div className="flex flex-col gap-1">
            <span className="text-[10px] text-slate-500">終了</span>
            <input
              type="datetime-local"
              value={form.scheduled_end_at}
              onChange={(e) => set("scheduled_end_at", e.target.value)}
              className={inputClass}
            />
          </div>
        </div>
      </div>

      {/* ── Actual start (actual END belongs to the completion action) ── */}
      <div className="flex flex-col gap-1">
        <label className={labelClass}>実施工</label>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="flex flex-col gap-1">
            <span className="text-[10px] text-slate-500">開始</span>
            <input
              type="datetime-local"
              value={form.actual_start_at}
              onChange={(e) => set("actual_start_at", e.target.value)}
              className={inputClass}
            />
          </div>
          <div className="flex flex-col gap-1">
            <span className="text-[10px] text-slate-500">終了</span>
            {isCompleted && workOrder?.actual_end_at ? (
              <input
                type="text"
                value={workOrder.actual_end_at.slice(0, 16).replace("T", " ")}
                disabled
                className={inputClass}
              />
            ) : (
              <p className="text-xs text-slate-500 px-1 py-2.5">
                終了日時は「作業完了」で確定します。
              </p>
            )}
          </div>
        </div>
      </div>

      {/* ── Assigned Staff ── */}
      <div className="flex flex-col gap-1">
        <label className={labelClass}>担当者</label>
        <input
          type="text"
          value={form.assigned_staff}
          onChange={(e) => set("assigned_staff", e.target.value)}
          placeholder="担当者名"
          className={inputClass}
        />
      </div>

      {/* ── Service Summary ── */}
      <div className="flex flex-col gap-1">
        <label className={labelClass}>作業概要</label>
        <textarea
          value={form.service_summary}
          onChange={(e) => set("service_summary", e.target.value)}
          rows={3}
          placeholder="施工内容の概要..."
          className={`${inputClass} resize-none`}
        />
      </div>

      {/* ── Notes & Internal Memo ── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div className="flex flex-col gap-1">
          <label className={labelClass}>備考（顧客向け）</label>
          <textarea
            value={form.notes}
            onChange={(e) => set("notes", e.target.value)}
            rows={3}
            placeholder="備考・メモ..."
            className={`${inputClass} resize-none`}
          />
        </div>
        <div className="flex flex-col gap-1">
          <label className={labelClass}>内部メモ</label>
          <textarea
            value={form.internal_memo}
            onChange={(e) => set("internal_memo", e.target.value)}
            rows={3}
            placeholder="社内向けメモ..."
            className={`${inputClass} resize-none`}
          />
        </div>
      </div>

      {/* ── Buttons (generic save) ── */}
      <div className="flex justify-end gap-2 pt-2 border-t border-slate-700">
        <button
          type="button"
          onClick={onCancel}
          disabled={pending}
          className="px-4 py-2 text-sm font-medium text-slate-400 hover:text-slate-100 hover:bg-slate-700 rounded-lg transition-colors disabled:opacity-50"
        >
          キャンセル
        </button>
        <button
          type="submit"
          disabled={pending}
          className="px-4 py-2 text-sm font-medium bg-[#1d4ed8] hover:bg-[#1e40af] text-white rounded-lg transition-colors disabled:opacity-50"
        >
          {pending ? "保存中..." : isEdit ? "更新" : "保存"}
        </button>
      </div>

      {/* ── Completion panel: the ONE deliberate completion action ── */}
      {canComplete && !completionDone && (
        <div className="flex flex-col gap-4 mt-2 p-4 rounded-lg border border-emerald-800 bg-emerald-950/20">
          <div>
            <h3 className="text-sm font-semibold text-emerald-300">作業完了</h3>
            <p className="text-[11px] text-slate-400 mt-1">
              実際の終了日時と、実際に行った作業内容を確認して完了してください。
              見積からの転記は下書きです — 実施内容と異なる場合は修正してください。金額はここでは扱いません。
            </p>
          </div>

          {completionError && (
            <div className="bg-red-900/30 border border-red-700 rounded-lg px-3 py-2">
              <p className="text-xs text-red-400">{completionError}</p>
            </div>
          )}

          <div className="flex flex-col gap-1">
            <label className={labelClass}>実際の終了日時</label>
            <input
              type="datetime-local"
              value={completionEndAt}
              onChange={(e) => { setCompletionEndAt(e.target.value); touchCompletionIntent(); }}
              className={inputClass}
            />
          </div>

          <div className="flex flex-col gap-2">
            <label className={labelClass}>実施した作業（1〜100件）</label>
            {completionItems.map((item, index) => (
              <div key={index} className="grid grid-cols-1 sm:grid-cols-[1fr_1.5fr_1.5fr_auto] gap-2">
                <input
                  type="text"
                  value={item.category}
                  onChange={(e) => setCompletionItem(index, { category: e.target.value })}
                  placeholder="カテゴリ"
                  className={inputClass}
                />
                <input
                  type="text"
                  value={item.itemName}
                  onChange={(e) => setCompletionItem(index, { itemName: e.target.value })}
                  placeholder="作業名"
                  className={inputClass}
                />
                <input
                  type="text"
                  value={item.description}
                  onChange={(e) => setCompletionItem(index, { description: e.target.value })}
                  placeholder="補足（任意）"
                  className={inputClass}
                />
                <button
                  type="button"
                  onClick={() => removeCompletionItem(index)}
                  disabled={completionItems.length <= 1 || completing}
                  className="px-3 py-2 text-xs text-slate-400 hover:text-red-400 hover:bg-slate-800 rounded-lg transition-colors disabled:opacity-40"
                  aria-label="この作業を削除"
                >
                  削除
                </button>
              </div>
            ))}
            <button
              type="button"
              onClick={addCompletionItem}
              disabled={completionItems.length >= 100 || completing}
              className="self-start px-3 py-1.5 text-xs text-emerald-300 hover:bg-emerald-900/30 border border-emerald-800 rounded-lg transition-colors disabled:opacity-40"
            >
              ＋ 作業を追加
            </button>
          </div>

          <div className="flex justify-end pt-2 border-t border-emerald-900/50">
            <button
              type="button"
              onClick={handleComplete}
              disabled={completing}
              className="px-4 py-2 text-sm font-medium bg-emerald-700 hover:bg-emerald-600 text-white rounded-lg transition-colors disabled:opacity-50"
            >
              {completing ? "完了処理中..." : "この内容で作業を完了する"}
            </button>
          </div>
        </div>
      )}

      {completionDone && (
        <div className="bg-emerald-900/30 border border-emerald-700 rounded-lg px-3 py-2">
          <p className="text-xs text-emerald-300">{completionDone}</p>
        </div>
      )}
    </form>
  );
}
