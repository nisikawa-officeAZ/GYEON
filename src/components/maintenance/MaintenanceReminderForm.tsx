"use client";

import { useState, useTransition, useEffect } from "react";
import {
  MaintenanceReminderDB,
  MaintenanceReminderInput,
  MaintenanceReminderUpdateInput,
  MAINTENANCE_REMINDER_TYPES,
  MAINTENANCE_REMINDER_STATUSES,
  maintenanceReminderTypeLabel,
  maintenanceReminderStatusLabel,
  defaultMaintenanceMessage,
} from "@/lib/maintenance/maintenance-types";
import { createMaintenanceReminderFromFormData } from "@/lib/maintenance/create-maintenance-reminder";
import { updateMaintenanceReminderFromFormData } from "@/lib/maintenance/update-maintenance-reminder";
import { previewDocumentNumber } from "@/lib/numbering/preview-document-number";

interface Props {
  // For create: pass prefill values
  prefill?: Partial<MaintenanceReminderInput>;
  // For edit: pass existing reminder
  reminder?: MaintenanceReminderDB;
  onSaved:  (saved: MaintenanceReminderDB) => void;
  onCancel: () => void;
}

function Label({ children }: { children: React.ReactNode }) {
  return <label className="block text-xs text-slate-400 mb-1">{children}</label>;
}

function Input({ ...props }: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...props}
      className="w-full bg-[#0f172a] border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-100 focus:outline-none focus:border-slate-500 placeholder:text-slate-600"
    />
  );
}

function Select({ children, ...props }: React.SelectHTMLAttributes<HTMLSelectElement> & { children: React.ReactNode }) {
  return (
    <select
      {...props}
      className="w-full bg-[#0f172a] border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-100 focus:outline-none focus:border-slate-500"
    >
      {children}
    </select>
  );
}

function Textarea({ ...props }: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      {...props}
      className="w-full bg-[#0f172a] border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-100 focus:outline-none focus:border-slate-500 placeholder:text-slate-600 resize-none"
    />
  );
}

export default function MaintenanceReminderForm({ prefill, reminder, onSaved, onCancel }: Props) {
  const isEdit = !!reminder;
  const [isPending,  startTransition] = useTransition();
  const [error,      setError]        = useState<string | null>(null);
  const [previewNo,  setPreviewNo]    = useState<string>("");

  useEffect(() => {
    if (!isEdit) {
      previewDocumentNumber("maintenance_reminder").then((p) => setPreviewNo(p ?? ""));
    }
  }, [isEdit]);

  const [reminderType, setReminderType] = useState(
    reminder?.reminder_type ?? prefill?.reminder_type ?? "maintenance"
  );
  const [dueDate, setDueDate] = useState(reminder?.due_date ?? "");
  const [msgTitle, setMsgTitle] = useState(reminder?.message_title ?? "");
  const [msgBody,  setMsgBody]  = useState(reminder?.message_body  ?? "");

  function setDueDateMonthsFromNow(months: number) {
    const d = new Date();
    d.setMonth(d.getMonth() + months);
    setDueDate(d.toISOString().slice(0, 10));
  }

  function fillDefaultMessage(type: typeof reminderType) {
    const def = defaultMaintenanceMessage(type as import("@/lib/maintenance/maintenance-types").MaintenanceReminderType);
    if (!msgTitle) setMsgTitle(def.title);
    if (!msgBody)  setMsgBody(def.body);
  }

  function handleTypeChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const t = e.target.value as typeof reminderType;
    setReminderType(t);
    fillDefaultMessage(t);
  }

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const fd = new FormData(e.currentTarget);

    startTransition(async () => {
      const result = isEdit
        ? await updateMaintenanceReminderFromFormData(reminder!.id, fd)
        : await createMaintenanceReminderFromFormData(fd);

      if ("error" in result) {
        setError(result.error);
        return;
      }
      onSaved(result.data);
    });
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      {/* Hidden fields for FK values (set by prefill, cannot be changed) */}
      {!isEdit && (
        <>
          {prefill?.customer_id   && <input type="hidden" name="customer_id"   value={prefill.customer_id} />}
          {prefill?.vehicle_id    && <input type="hidden" name="vehicle_id"    value={prefill.vehicle_id ?? ""} />}
          {prefill?.work_order_id && <input type="hidden" name="work_order_id" value={prefill.work_order_id ?? ""} />}
        </>
      )}

      {/* Show linked entities (read-only) */}
      {!isEdit && (prefill?.customer_id || prefill?.vehicle_id) && (
        <div className="bg-[#0f172a] border border-slate-700 rounded-lg p-3 text-xs text-slate-400">
          {prefill?.customer_id   && <p>顧客ID: {prefill.customer_id}</p>}
          {prefill?.vehicle_id    && <p>車両ID: {prefill.vehicle_id}</p>}
          {prefill?.work_order_id && <p>作業指示書ID: {prefill.work_order_id}</p>}
        </div>
      )}

      {/* Reminder number */}
      {!isEdit && (
        <div>
          <Label>リマインダー番号（空欄で自動採番）</Label>
          <Input
            name="reminder_number"
            placeholder={previewNo ? `自動採番: ${previewNo}` : "MNT-0000-00001"}
          />
          {previewNo && (
            <p className="text-xs text-slate-500 mt-1">空欄の場合、保存時に自動採番されます（次: {previewNo}）</p>
          )}
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Title */}
        <div>
          <Label>タイトル</Label>
          <Input
            name="title"
            defaultValue={reminder?.title ?? ""}
            placeholder="例: コーティングメンテナンス通知"
          />
        </div>

        {/* Type */}
        <div>
          <Label>種別 *</Label>
          <Select
            name="reminder_type"
            value={reminderType}
            onChange={handleTypeChange}
            required
          >
            {MAINTENANCE_REMINDER_TYPES.map((t) => (
              <option key={t} value={t}>{maintenanceReminderTypeLabel(t)}</option>
            ))}
          </Select>
        </div>

        {/* Status */}
        <div>
          <Label>ステータス</Label>
          <Select name="status" defaultValue={reminder?.status ?? "scheduled"}>
            {MAINTENANCE_REMINDER_STATUSES.map((s) => (
              <option key={s} value={s}>{maintenanceReminderStatusLabel(s)}</option>
            ))}
          </Select>
        </div>

        {/* Due date */}
        <div>
          <Label>メンテナンス予定日</Label>
          <Input
            type="date"
            name="due_date"
            value={dueDate}
            onChange={e => setDueDate(e.target.value)}
          />
          <div className="flex gap-2 mt-1.5">
            <button type="button" onClick={() => setDueDateMonthsFromNow(6)}
              className="text-[10px] px-2 py-1 rounded bg-slate-800 border border-slate-700 text-slate-400 hover:text-slate-200 hover:border-slate-500 transition-colors">
              6ヶ月後
            </button>
            <button type="button" onClick={() => setDueDateMonthsFromNow(12)}
              className="text-[10px] px-2 py-1 rounded bg-slate-800 border border-slate-700 text-slate-400 hover:text-slate-200 hover:border-slate-500 transition-colors">
              12ヶ月後
            </button>
            <button type="button" onClick={() => setDueDateMonthsFromNow(3)}
              className="text-[10px] px-2 py-1 rounded bg-slate-800 border border-slate-700 text-slate-400 hover:text-slate-200 hover:border-slate-500 transition-colors">
              3ヶ月後
            </button>
          </div>
        </div>

        {/* Scheduled send at */}
        <div>
          <Label>LINE送信予定日時</Label>
          <Input
            type="datetime-local"
            name="scheduled_send_at"
            defaultValue={reminder?.scheduled_send_at
              ? reminder.scheduled_send_at.slice(0, 16)
              : ""}
          />
        </div>
      </div>

      {/* Message */}
      <div className="bg-[#0f172a] border border-slate-700 rounded-xl p-4 flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">LINEメッセージ</p>
          <button
            type="button"
            onClick={() => {
              const def = defaultMaintenanceMessage(reminderType as import("@/lib/maintenance/maintenance-types").MaintenanceReminderType);
              setMsgTitle(def.title);
              setMsgBody(def.body);
            }}
            className="text-[10px] text-slate-500 hover:text-slate-300 underline"
          >
            デフォルト文章を設定
          </button>
        </div>

        <div>
          <Label>メッセージタイトル</Label>
          <Input
            name="message_title"
            value={msgTitle}
            onChange={(e) => setMsgTitle(e.target.value)}
            placeholder="例: メンテナンスのご案内"
          />
        </div>

        <div>
          <Label>メッセージ本文 *</Label>
          <Textarea
            name="message_body"
            value={msgBody}
            onChange={(e) => setMsgBody(e.target.value)}
            rows={5}
            placeholder="LINEで送信するメッセージ本文"
            required
          />
        </div>
      </div>

      {/* Notes / Internal memo */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <Label>備考</Label>
          <Textarea
            name="notes"
            defaultValue={reminder?.notes ?? ""}
            rows={3}
            placeholder="顧客向け備考"
          />
        </div>
        <div>
          <Label>内部メモ（社内のみ）</Label>
          <Textarea
            name="internal_memo"
            defaultValue={reminder?.internal_memo ?? ""}
            rows={3}
            placeholder="社内共有メモ"
          />
        </div>
      </div>

      {error && (
        <p className="text-xs text-red-400 bg-red-900/20 rounded-lg px-4 py-2">{error}</p>
      )}

      <div className="flex gap-3 justify-end pt-2">
        <button
          type="button"
          onClick={onCancel}
          className="text-sm px-4 py-2 rounded-lg border border-slate-700 text-slate-300 hover:bg-slate-800 transition-colors"
        >
          キャンセル
        </button>
        <button
          type="submit"
          disabled={isPending}
          className="text-sm px-6 py-2 rounded-lg bg-[#1d4ed8] hover:bg-[#1e40af] text-white transition-colors disabled:opacity-40"
        >
          {isPending ? "保存中..." : isEdit ? "更新する" : "作成する"}
        </button>
      </div>
    </form>
  );
}
