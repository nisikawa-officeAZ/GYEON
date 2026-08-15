export interface Estimate {
  id: string;
  customerId: string;
  vehicleId: string;
  estimateNo: string;
  // Workflow statuses (SENT is legacy — transmission, not workflow).
  status:
    | "DRAFT" | "PROPOSAL" | "APPROVED" | "LOST"
    | "ACCEPTED" | "IN_PROGRESS" | "COMPLETED" | "INVOICED"
    | "SENT" | "REJECTED"; // legacy
  subtotal: number;
  tax: number;
  total: number;
  createdAt: string;
  updatedAt: string;
}
