import { ReactNode } from "react";
import { getCurrentStaff } from "@/lib/staff/get-current-staff";
import type { DealerStaffRole } from "@/lib/staff/staff-types";

interface RoleGateProps {
  allowedRoles: DealerStaffRole[];
  children: ReactNode;
  fallback?: ReactNode;
}

export default async function RoleGate({ allowedRoles, children, fallback }: RoleGateProps) {
  const staff = await getCurrentStaff();
  const role: DealerStaffRole = staff?.role ?? "owner";

  if (!allowedRoles.includes(role)) {
    return fallback ?? null;
  }

  return <>{children}</>;
}
