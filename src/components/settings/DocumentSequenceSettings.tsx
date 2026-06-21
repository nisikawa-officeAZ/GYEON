"use client";

import { useState, useTransition } from "react";
import { updateDocumentSequence } from "@/lib/numbering/update-document-sequence";
import {
  DocumentSequenceDB,
  DocumentSequenceType,
  DocumentResetPolicy,
  sequenceTypeLabel,
  resetPolicyLabel,
  formatDocumentNumber,
  computeFiscalYear,
} from "@/lib/numbering/numbering-types";

const RESET_POLICIES: DocumentResetPolicy[] = ["never", "yearly", "monthly"];

interface RowState {
  prefix:       string;
  padding:      number;
  reset_policy: DocumentResetPolicy;
  dirty:        boolean;
  saved:        boolean;
  error:        string | null;
}

function toRowState(seq: DocumentSequenceDB): RowState {
  return {
    prefix:       seq.prefix,
    padding:      seq.padding,
    reset_policy: seq.reset_policy,
    dirty:        false,
    saved:        false,
    error:        null,
  };
}

interface Props {
  sequences: DocumentSequenceDB[];
}

export default function DocumentSequenceSettings({ sequences }: Props) {
  const [rows, setRows] = useState<Record<DocumentSequenceType, RowState>>(
    () => Object.fromEntries(sequences.map((s) => [s.sequence_type, toRowState(s)])) as Record<DocumentSequenceType, RowState>,
  );
  const [pending, startTransition] = useTransition();

  function update<K extends keyof RowState>(type: DocumentSequenceType, key: K, value: RowState[K]) {
    setRows((prev) => ({
      ...prev,
      [type]: { ...prev[type], [key]: value, dirty: true, saved: false, error: null },
    }));
  }

  function handleSave(type: DocumentSequenceType) {
    const row = rows[type];
    startTransition(async () => {
      const result = await updateDocumentSequence({
        sequence_type: type,
        prefix:        row.prefix,
        padding:       row.padding,
        reset_policy:  row.reset_policy,
      });
      setRows((prev) => ({
        ...prev,
        [type]: {
          ...prev[type],
          dirty: result.success ? false : prev[type].dirty,
          saved: result.success,
          error: result.error ?? null,
        },
      }));
    });
  }

  const orderedTypes = sequences.map((s) => s.sequence_type);

  return (
    <div className="flex flex-col gap-3">
      {orderedTypes.map((type) => {
        const seq = sequences.find((s) => s.sequence_type === type)!;
        const row = rows[type];
        if (!row) return null;

        const previewNum = (seq.current_number ?? 0) + 1;
        const fiscalYear  = computeFiscalYear(row.reset_policy);
        const preview     = formatDocumentNumber(row.prefix, previewNum, row.padding, fiscalYear);

        return (
          <div key={type} className="bg-[#0f172a] border border-slate-800 rounded-xl p-4">
            <div className="flex items-center justify-between mb-3">
              <div>
                <h3 className="text-sm font-semibold text-slate-100">{sequenceTypeLabel(type)}</h3>
                <p className="text-xs text-slate-500 mt-0.5">現在の採番数: {seq.current_number}</p>
              </div>
              <span className="text-xs text-slate-400 font-mono bg-slate-800 px-2 py-1 rounded">
                次番号プレビュー: {preview}
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {/* Prefix */}
              <div className="flex flex-col gap-1">
                <label className="text-xs text-slate-400">プレフィックス</label>
                <input
                  type="text"
                  value={row.prefix}
                  onChange={(e) => update(type, "prefix", e.target.value)}
                  className="rounded-md border border-slate-700 bg-slate-800 px-3 py-1.5 text-sm text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-600"
                  maxLength={10}
                />
              </div>

              {/* Padding */}
              <div className="flex flex-col gap-1">
                <label className="text-xs text-slate-400">桁数</label>
                <input
                  type="number"
                  value={row.padding}
                  min={1}
                  max={10}
                  onChange={(e) => update(type, "padding", parseInt(e.target.value, 10) || 5)}
                  className="rounded-md border border-slate-700 bg-slate-800 px-3 py-1.5 text-sm text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-600"
                />
              </div>

              {/* Reset policy */}
              <div className="flex flex-col gap-1">
                <label className="text-xs text-slate-400">リセット方式</label>
                <select
                  value={row.reset_policy}
                  onChange={(e) => update(type, "reset_policy", e.target.value as DocumentResetPolicy)}
                  className="rounded-md border border-slate-700 bg-slate-800 px-3 py-1.5 text-sm text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-600"
                >
                  {RESET_POLICIES.map((p) => (
                    <option key={p} value={p}>{resetPolicyLabel(p)}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* Save row */}
            <div className="flex items-center gap-3 mt-3">
              <button
                type="button"
                onClick={() => handleSave(type)}
                disabled={!row.dirty || pending}
                className="px-3 py-1.5 text-xs font-medium rounded-md bg-blue-700 text-white hover:bg-blue-600 disabled:opacity-40 transition-colors"
              >
                {pending ? "保存中…" : "保存"}
              </button>
              {row.saved && !row.dirty && (
                <span className="text-xs text-green-400">保存しました</span>
              )}
              {row.error && (
                <span className="text-xs text-red-400">{row.error}</span>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
