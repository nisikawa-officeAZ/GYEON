// PHASE63: UAT types and helpers — no "use server" directive.
// Safe to import from both server and client contexts.

// ─── Status types ─────────────────────────────────────────────────────────────

export type UatDealerStatus  = "invited" | "active" | "completed" | "withdrawn";
export type UatSessionStatus = "active"  | "completed" | "paused";
export type UatFeedbackStatus = "open" | "accepted" | "planned" | "rejected" | "implemented";
export type UatIssueSeverity = "low" | "medium" | "high" | "critical";
export type UatIssueStatus   = "open" | "investigating" | "resolved" | "wont_fix";

// ─── DB record types ──────────────────────────────────────────────────────────

export interface UatDealer {
  id:           string;
  dealer_name:  string;
  contact_name: string | null;
  email:        string | null;
  country:      string | null;
  status:       UatDealerStatus;
  notes:        string | null;
  created_at:   string;
  updated_at:   string;
}

export interface UatSession {
  id:          string;
  dealer_id:   string | null;
  started_at:  string;
  ended_at:    string | null;
  status:      UatSessionStatus;
  summary:     string | null;
  created_at:  string;
}

export interface UatFeedback {
  id:          string;
  session_id:  string | null;
  category:    string | null;
  rating:      number | null;
  title:       string;
  description: string | null;
  status:      UatFeedbackStatus;
  created_at:  string;
}

export interface UatIssue {
  id:          string;
  session_id:  string | null;
  severity:    UatIssueSeverity;
  title:       string;
  description: string | null;
  status:      UatIssueStatus;
  resolution:  string | null;
  created_at:  string;
  resolved_at: string | null;
}

// ─── Composite view ───────────────────────────────────────────────────────────

export interface UatDealerWithSessions extends UatDealer {
  sessions: UatSession[];
  feedback: UatFeedback[];
  issues:   UatIssue[];
}

// ─── Label helpers ────────────────────────────────────────────────────────────

export function uatDealerStatusLabel(s: UatDealerStatus): string {
  const map: Record<UatDealerStatus, string> = {
    invited:   "Invited",
    active:    "Active",
    completed: "Completed",
    withdrawn: "Withdrawn",
  };
  return map[s];
}

export function uatDealerStatusColor(s: UatDealerStatus): string {
  const map: Record<UatDealerStatus, string> = {
    invited:   "bg-slate-800 text-slate-300 border-slate-600",
    active:    "bg-blue-900/40 text-blue-300 border-blue-700/40",
    completed: "bg-green-900/40 text-green-300 border-green-700/40",
    withdrawn: "bg-slate-900 text-slate-600 border-slate-700",
  };
  return map[s];
}

export function uatSessionStatusLabel(s: UatSessionStatus): string {
  const map: Record<UatSessionStatus, string> = {
    active:    "Active",
    completed: "Completed",
    paused:    "Paused",
  };
  return map[s];
}

export function uatFeedbackStatusLabel(s: UatFeedbackStatus): string {
  const map: Record<UatFeedbackStatus, string> = {
    open:        "Open",
    accepted:    "Accepted",
    planned:     "Planned",
    rejected:    "Rejected",
    implemented: "Implemented",
  };
  return map[s];
}

export function uatFeedbackStatusColor(s: UatFeedbackStatus): string {
  const map: Record<UatFeedbackStatus, string> = {
    open:        "bg-slate-800 text-slate-300 border-slate-600",
    accepted:    "bg-blue-900/40 text-blue-300 border-blue-700/40",
    planned:     "bg-amber-900/40 text-amber-300 border-amber-700/40",
    rejected:    "bg-red-900/40 text-red-300 border-red-700/40",
    implemented: "bg-green-900/40 text-green-300 border-green-700/40",
  };
  return map[s];
}

export function uatIssueSeverityLabel(s: UatIssueSeverity): string {
  const map: Record<UatIssueSeverity, string> = {
    low:      "Low",
    medium:   "Medium",
    high:     "High",
    critical: "Critical",
  };
  return map[s];
}

export function uatIssueSeverityColor(s: UatIssueSeverity): string {
  const map: Record<UatIssueSeverity, string> = {
    low:      "bg-slate-800 text-slate-300 border-slate-600",
    medium:   "bg-amber-900/40 text-amber-300 border-amber-700/40",
    high:     "bg-orange-900/40 text-orange-300 border-orange-700/40",
    critical: "bg-red-900/40 text-red-300 border-red-700/40",
  };
  return map[s];
}

export function uatIssueStatusLabel(s: UatIssueStatus): string {
  const map: Record<UatIssueStatus, string> = {
    open:          "Open",
    investigating: "Investigating",
    resolved:      "Resolved",
    wont_fix:      "Won't Fix",
  };
  return map[s];
}

export const UAT_FEEDBACK_CATEGORIES = [
  "Overall UX",
  "Customer Management",
  "Vehicle Management",
  "Estimate",
  "Work Order",
  "Completion Report",
  "Invoice",
  "Payment",
  "Reservation",
  "PDF Generation",
  "LINE Integration",
  "Subscription",
  "Onboarding",
  "Notification",
  "Performance",
  "Other",
] as const;

export type UatFeedbackCategory = (typeof UAT_FEEDBACK_CATEGORIES)[number];
