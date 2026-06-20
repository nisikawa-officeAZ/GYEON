"use client";

import { Customer } from "@/types/customer";
import CustomerCard from "./CustomerCard";

const DUMMY_CUSTOMERS: Customer[] = [
  {
    id: "1",
    name: "山田 太郎",
    kana: "ヤマダ タロウ",
    phone: "090-1234-5678",
    email: "yamada@example.com",
    postalCode: "150-0001",
    address: "東京都渋谷区神宮前1-1-1",
    lineId: "yamada_taro",
    memo: "定期顧客",
    createdAt: "2024-01-10T00:00:00Z",
    updatedAt: "2024-01-10T00:00:00Z",
  },
  {
    id: "2",
    name: "佐藤 花子",
    kana: "サトウ ハナコ",
    phone: "080-9876-5432",
    email: "sato@example.com",
    postalCode: "160-0022",
    address: "東京都新宿区新宿2-3-4",
    createdAt: "2024-02-15T00:00:00Z",
    updatedAt: "2024-02-15T00:00:00Z",
  },
  {
    id: "3",
    name: "鈴木 一郎",
    kana: "スズキ イチロウ",
    phone: "070-1111-2222",
    email: "suzuki@example.com",
    postalCode: "530-0001",
    address: "大阪府大阪市北区梅田1-2-3",
    lineId: "suzuki_ichiro",
    createdAt: "2024-03-01T00:00:00Z",
    updatedAt: "2024-03-01T00:00:00Z",
  },
  {
    id: "4",
    name: "田中 美咲",
    kana: "タナカ ミサキ",
    phone: "090-3333-4444",
    email: "tanaka@example.com",
    postalCode: "460-0008",
    address: "愛知県名古屋市中区栄3-4-5",
    memo: "見積もり検討中",
    createdAt: "2024-03-20T00:00:00Z",
    updatedAt: "2024-03-20T00:00:00Z",
  },
];

interface CustomerListProps {
  selectedId?: string;
  onSelect?: (customer: Customer) => void;
}

export default function CustomerList({ selectedId, onSelect }: CustomerListProps) {
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between mb-1">
        <p className="text-xs text-slate-500">{DUMMY_CUSTOMERS.length} customers</p>
      </div>
      {DUMMY_CUSTOMERS.map((customer) => (
        <CustomerCard
          key={customer.id}
          customer={customer}
          selected={customer.id === selectedId}
          onClick={() => onSelect?.(customer)}
        />
      ))}
    </div>
  );
}
