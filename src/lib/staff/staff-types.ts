// Pure type file — no "use server", safe to import anywhere including "use client" files

export type DealerStaffRole = "owner" | "manager" | "staff" | "readonly";
export type DealerStaffStatus = "invited" | "active" | "disabled";

export interface DealerStaffDB {
  id: string;
  dealer_id: string;
  user_id: string | null;
  email: string | null;
  name: string | null;
  role: DealerStaffRole;
  status: DealerStaffStatus;
  invited_at: string | null;
  joined_at: string | null;
  last_login_at: string | null;
  created_at: string;
  updated_at: string;
}

export function staffRoleLabel(role: DealerStaffRole): string {
  switch (role) {
    case "owner":    return "オーナー";
    case "manager":  return "マネージャー";
    case "staff":    return "スタッフ";
    case "readonly": return "閲覧のみ";
  }
}

export function staffStatusLabel(status: DealerStaffStatus): string {
  switch (status) {
    case "invited":  return "招待中";
    case "active":   return "有効";
    case "disabled": return "無効";
  }
}

export function staffRoleBadgeColor(role: DealerStaffRole): string {
  switch (role) {
    case "owner":    return "bg-purple-900/50 text-purple-300 border border-purple-700/50";
    case "manager":  return "bg-blue-900/50 text-blue-300 border border-blue-700/50";
    case "staff":    return "bg-slate-800 text-slate-300 border border-slate-700";
    case "readonly": return "bg-slate-900 text-slate-500 border border-slate-800";
  }
}

export function canManageStaff(role: DealerStaffRole): boolean {
  return role === "owner";
}

export function canEditBusinessData(role: DealerStaffRole): boolean {
  return ["owner", "manager", "staff"].includes(role);
}

export function canDeleteData(role: DealerStaffRole): boolean {
  return ["owner", "manager"].includes(role);
}

export function canViewFinance(role: DealerStaffRole): boolean {
  return ["owner", "manager"].includes(role);
}

export function roleOrder(role: DealerStaffRole): number {
  switch (role) {
    case "owner":    return 0;
    case "manager":  return 1;
    case "staff":    return 2;
    case "readonly": return 3;
  }
}
