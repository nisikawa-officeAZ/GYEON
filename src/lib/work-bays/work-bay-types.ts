// DealerOS — Work Bay types (Batch B6b). Pure — no data access, no "use server".

export interface WorkBayDB {
  id: string;
  dealer_id: string;
  name: string;
  active: boolean;
  capacity: number;
  sort_order: number;
  legacy_ref: string | null;
  created_at: string;
  updated_at: string;
}

/** Lightweight option for selectors / calendar (dealer-safe subset). */
export interface WorkBayOption {
  id: string;
  name: string;
  active: boolean;
  capacity: number;
}

/** Editable shape used by the settings form / batch save. */
export interface WorkBayInput {
  id?: string;      // present = existing row; absent/unknown = new bay
  name: string;
  active: boolean;
  capacity: number;
}
