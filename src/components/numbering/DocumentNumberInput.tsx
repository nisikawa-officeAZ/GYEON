"use client";

import { useEffect, useState } from "react";
import { previewDocumentNumber } from "@/lib/numbering/preview-document-number";
import { DocumentSequenceType } from "@/lib/numbering/numbering-types";

interface Props {
  sequenceType: DocumentSequenceType;
  fieldName:    string;
  initialValue?: string;
  label?:        string;
}

/**
 * A text input for document numbers.
 * - Empty → auto-number will be assigned on save (placeholder shows preview)
 * - Filled → value overrides auto-number
 */
export default function DocumentNumberInput({
  sequenceType,
  fieldName,
  initialValue = "",
  label,
}: Props) {
  const [value, setValue]       = useState(initialValue);
  const [preview, setPreview]   = useState<string>("");
  const [loading, setLoading]   = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    previewDocumentNumber(sequenceType).then((p) => {
      if (!cancelled) {
        setPreview(p ?? "");
        setLoading(false);
      }
    });
    return () => { cancelled = true; };
  }, [sequenceType]);

  return (
    <div className="flex flex-col gap-1">
      {label && (
        <label className="text-xs text-slate-400">{label}</label>
      )}
      <input
        type="text"
        name={fieldName}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder={loading ? "読込中…" : `自動採番: ${preview}`}
        className="w-full rounded-md border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-600"
      />
      {!value && !loading && preview && (
        <p className="text-xs text-slate-500">空欄の場合、保存時に自動採番されます（次: {preview}）</p>
      )}
    </div>
  );
}
