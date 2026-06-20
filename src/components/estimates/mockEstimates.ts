import { Estimate } from "@/types/estimate";

export const MOCK_ESTIMATES: Estimate[] = [
  {
    id: "1",
    customerId: "1",
    vehicleId: "1",
    estimateNo: "EST-2024-001",
    status: "APPROVED",
    subtotal: 3200000,
    tax: 320000,
    total: 3520000,
    createdAt: "2024-01-20T00:00:00Z",
    updatedAt: "2024-01-20T00:00:00Z",
  },
  {
    id: "2",
    customerId: "2",
    vehicleId: "2",
    estimateNo: "EST-2024-002",
    status: "SENT",
    subtotal: 2450000,
    tax: 245000,
    total: 2695000,
    createdAt: "2024-02-25T00:00:00Z",
    updatedAt: "2024-02-25T00:00:00Z",
  },
  {
    id: "3",
    customerId: "3",
    vehicleId: "3",
    estimateNo: "EST-2024-003",
    status: "DRAFT",
    subtotal: 1980000,
    tax: 198000,
    total: 2178000,
    createdAt: "2024-03-10T00:00:00Z",
    updatedAt: "2024-03-10T00:00:00Z",
  },
];

export const CUSTOMER_NAMES: Record<string, string> = {
  "1": "山田 太郎",
  "2": "佐藤 花子",
  "3": "鈴木 一郎",
};

export const VEHICLE_NAMES: Record<string, string> = {
  "1": "Toyota Alphard 2022",
  "2": "Nissan Serena 2021",
  "3": "Honda Stepwgn 2023",
};
