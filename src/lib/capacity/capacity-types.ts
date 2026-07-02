// DealerOS — Workshop Capacity Engine types (Phase C1.1). Pure — no I/O.

export type RecommendationLevel = "available" | "limited" | "warning" | "high_load";

/** Utilization for one resource dimension. peak/avg are fractions (0..∞);
 *  cap is the resource capacity (null = unknown/unbounded → dimension excluded). */
export interface DimensionUtil {
  peak: number;
  avg: number;
  cap: number | null;
}

/** One occupancy interval on a single date, produced by the expander. */
export interface OccupancyInterval {
  reservationId: string;
  date: string;                 // "YYYY-MM-DD"
  startMin: number | null;      // null = all-day (calculator resolves to the operating window)
  endMin: number | null;
  needsStaff: boolean;          // active work only (false on drying/buffer)
  needsBay: boolean;            // bay held (true on active AND drying/buffer)
  staffId: string | null;
  bayId: string | null;
  dayType: "active" | "buffer" | "drying";
}

export interface CapacityResult {
  date: string;
  closed: boolean;
  operatingMinutes: number;     // 0 when closed
  workshop: { peak: number; avg: number };   // weighted composite
  staff: DimensionUtil;
  bay: DimensionUtil;
  vehicle: DimensionUtil;
  bottleneck: "staff" | "bay" | "vehicle" | null;  // drives the recommendation
  level: RecommendationLevel;
  confidence: "measured" | "estimated";      // estimated when any cap is unknown
  reservationCount: number;                  // distinct reservations occupying the date
}
