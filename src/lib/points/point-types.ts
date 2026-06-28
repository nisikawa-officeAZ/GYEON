// Point Card — shared types. Pure module (no DB / no "use server").

export type PointTxnType = "earn" | "redeem" | "adjust";

export interface PointCard {
  id:             string;
  dealer_id:      string;
  customer_id:    string;
  points_balance: number;
  created_at:     string;
  updated_at:     string;
}

export interface PointTransaction {
  id:            string;
  dealer_id:     string;
  customer_id:   string;
  point_card_id: string | null;
  type:          PointTxnType;
  points:        number;
  reason:        string | null;
  created_by:    string | null;
  created_at:    string;
}

/** Point card joined with its customer's display name (for list views). */
export interface PointCardWithCustomer extends PointCard {
  customer_name: string;
}

export const POINT_TXN_LABEL: Record<PointTxnType, string> = {
  earn:   "付与",
  redeem: "利用",
  adjust: "調整",
};
