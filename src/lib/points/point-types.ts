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

/** A ledger row enriched for the history view (customer name + optional meta). */
export interface PointTransactionRow extends PointTransaction {
  customer_name:  string;
  expires_at:     string | null;
  reference_type: string | null;
  reference_id:   string | null;
}

export interface PointsSummary {
  total_active:        number; // sum of current card balances
  issued_this_month:   number; // sum of 'earn' points this calendar month
  redeemed_this_month: number; // sum of 'redeem' points this calendar month
  expiring_soon:       number; // sum of 'earn' points expiring within 30 days
}

export interface PointsFilter {
  customer_id?: string;            // "" / undefined = all customers
  type?:        PointTxnType | "all";
  from?:        string;            // YYYY-MM-DD (inclusive)
  to?:          string;            // YYYY-MM-DD (inclusive)
}

export const EMPTY_POINTS_SUMMARY: PointsSummary = {
  total_active: 0, issued_this_month: 0, redeemed_this_month: 0, expiring_soon: 0,
};

export const POINT_TXN_LABEL: Record<PointTxnType, string> = {
  earn:   "付与",
  redeem: "利用",
  adjust: "調整",
};

export const REFERENCE_LABEL: Record<string, string> = {
  estimate:   "見積",
  invoice:    "請求",
  work_order: "施工",
};

/** Signed display amount: earn/adjust add, redeem subtracts. */
export function signedPoints(type: PointTxnType, points: number): number {
  return type === "redeem" ? -points : points;
}
