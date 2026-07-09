export interface Estimate {
  id: string;
  customerId: string;
  vehicleId: string;
  estimateNo: string;
  status: "DRAFT" | "SENT" | "APPROVED" | "REJECTED";
  subtotal: number;
  tax: number;
  total: number;
  createdAt: string;
  updatedAt: string;
}
