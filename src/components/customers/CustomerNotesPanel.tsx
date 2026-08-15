"use client";

// Phase 2 Sprint 2 — Customer notes panel. Reads/edits the existing `notes`
// column via the dealer-scoped updateCustomerNotes action. No schema change.

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { updateCustomerNotes } from "@/lib/customers/update-customer-notes";
import { useCurrentStaff } from "@/contexts/StaffContext";

interface Props {
  customerId:   string;
  initialNotes: string;
}

export default function CustomerNotesPanel({ customerId, initialNotes }: Props) {
  const { canEdit } = useCurrentStaff();
  const router = useRouter();

  const [notes,   setNotes]   = useState(initialNotes);
  const [draft,   setDraft]   = useState(initialNotes);
  const [editing, setEditing] = useState(false);
  const [error,   setError]   = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function handleSave() {
    setError(null);
    startTransition(async () => {
      const result = await updateCustomerNotes(customerId, draft);
      if (result?.error) {
        setError(result.error);
        return;
      }
      setNotes(draft.trim());
      setEditing(false);
      router.refresh();
    });
  }

  function handleCancel() {
    setDraft(notes);
    setEditing(false);
    setError(null);
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider">メモ</h3>
        {canEdit && !editing && (
          <button
            type="button"
            onClick={() => { setDraft(notes); setEditing(true); }}
            className="text-xs text-slate-400 hover:text-slate-100 transition-colors"
          >
            編集
          </button>
        )}
      </div>

      {error && (
        <div className="bg-red-900/20 border border-red-700/50 rounded-lg px-3 py-2">
          <p className="text-xs text-red-400">{error}</p>
        </div>
      )}

      {editing ? (
        <div className="flex flex-col gap-2">
          <textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            rows={4}
            placeholder="顧客に関する内部メモ..."
            className="w-full bg-[#1a2236] border border-white/[.08] rounded-xl px-3 py-2.5 text-sm text-slate-100 placeholder:text-slate-600 focus:outline-none focus:border-blue-500/50 resize-none"
          />
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={handleCancel}
              disabled={pending}
              className="px-4 py-2 text-xs font-medium text-slate-400 rounded-lg border border-white/[.08] hover:text-slate-200 transition-colors disabled:opacity-50"
            >
              キャンセル
            </button>
            <button
              type="button"
              onClick={handleSave}
              disabled={pending}
              className="px-5 py-2 text-xs font-bold text-white rounded-lg bg-emerald-600 hover:bg-emerald-500 transition-colors disabled:opacity-40"
            >
              {pending ? "保存中..." : "保存"}
            </button>
          </div>
        </div>
      ) : (
        <p className="text-sm text-slate-300 whitespace-pre-wrap break-words">
          {notes.trim() ? notes : <span className="text-slate-600">メモはありません</span>}
        </p>
      )}
    </div>
  );
}
