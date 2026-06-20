"use client";

import { useState } from "react";
import { Customer } from "@/types/customer";
import Card from "@/components/ui/Card";
import Section from "@/components/ui/Section";

type FormState = Omit<Customer, "id" | "createdAt" | "updatedAt">;

const EMPTY_FORM: FormState = {
  name: "",
  kana: "",
  phone: "",
  email: "",
  postalCode: "",
  address: "",
  lineId: "",
  memo: "",
};

interface CustomerFormProps {
  initial?: FormState;
}

export default function CustomerForm({ initial = EMPTY_FORM }: CustomerFormProps) {
  const [form, setForm] = useState<FormState>(initial);

  const field = (label: string, key: keyof FormState, options?: {
    type?: string;
    placeholder?: string;
    rows?: number;
  }) => (
    <div className="flex flex-col gap-1">
      <label className="text-xs font-medium text-slate-400">{label}</label>
      {options?.rows ? (
        <textarea
          value={form[key] ?? ""}
          onChange={(e) => setForm((prev) => ({ ...prev, [key]: e.target.value }))}
          rows={options.rows}
          placeholder={options?.placeholder}
          className="bg-slate-800 border border-slate-700 rounded-md px-3 py-2 text-sm text-slate-100 placeholder-slate-600 focus:outline-none focus:border-[#1d4ed8] resize-none transition-colors"
        />
      ) : (
        <input
          type={options?.type ?? "text"}
          value={form[key] ?? ""}
          onChange={(e) => setForm((prev) => ({ ...prev, [key]: e.target.value }))}
          placeholder={options?.placeholder}
          className="bg-slate-800 border border-slate-700 rounded-md px-3 py-2 text-sm text-slate-100 placeholder-slate-600 focus:outline-none focus:border-[#1d4ed8] transition-colors"
        />
      )}
    </div>
  );

  return (
    <Card>
      <Section title="Basic Info">
        <div className="grid grid-cols-1 gap-3">
          {field("Name", "name", { placeholder: "山田 太郎" })}
          {field("Kana", "kana", { placeholder: "ヤマダ タロウ" })}
        </div>
      </Section>

      <Section title="Contact">
        <div className="grid grid-cols-1 gap-3">
          {field("Phone", "phone", { type: "tel", placeholder: "090-0000-0000" })}
          {field("Email", "email", { type: "email", placeholder: "example@email.com" })}
          {field("LINE ID", "lineId", { placeholder: "line_id" })}
        </div>
      </Section>

      <Section title="Address">
        <div className="grid grid-cols-1 gap-3">
          {field("Postal Code", "postalCode", { placeholder: "000-0000" })}
          {field("Address", "address", { placeholder: "東京都渋谷区..." })}
        </div>
      </Section>

      <Section title="Memo">
        {field("Memo", "memo", { rows: 3, placeholder: "Notes..." })}
      </Section>
    </Card>
  );
}
