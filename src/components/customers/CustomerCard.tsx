"use client";

import { Customer } from "@/types/customer";
import Card from "@/components/ui/Card";

interface CustomerCardProps {
  customer: Customer;
  selected?: boolean;
  onClick?: () => void;
}

export default function CustomerCard({ customer, selected = false, onClick }: CustomerCardProps) {
  return (
    <Card
      className={`cursor-pointer transition-colors ${
        selected
          ? "border-[#1d4ed8] bg-[#1d4ed8]/10"
          : "hover:border-slate-600"
      }`}
    >
      <button className="w-full text-left" onClick={onClick}>
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="text-sm font-medium text-slate-100 truncate">{customer.name}</p>
            <p className="text-xs text-slate-500 truncate">{customer.kana}</p>
          </div>
          {customer.lineId && (
            <span className="shrink-0 text-[10px] px-1.5 py-0.5 rounded bg-green-500/10 text-green-400 border border-green-500/20">
              LINE
            </span>
          )}
        </div>
        <div className="mt-2 space-y-0.5">
          <p className="text-xs text-slate-400">{customer.phone}</p>
          <p className="text-xs text-slate-500 truncate">{customer.email}</p>
          <p className="text-xs text-slate-500 truncate">{customer.address}</p>
        </div>
      </button>
    </Card>
  );
}
