"use client";

import { createContext, useContext, useState, useEffect, ReactNode } from "react";
import { getCurrentStaff } from "@/lib/staff/get-current-staff";
import type { DealerStaffRole } from "@/lib/staff/staff-types";
import {
  canEditBusinessData,
  canDeleteData,
  canManageStaff,
  canViewFinance,
} from "@/lib/staff/staff-types";

interface StaffContextValue {
  role: DealerStaffRole;
  canEdit: boolean;
  canDelete: boolean;
  canManage: boolean;
  canFinance: boolean;
  loaded: boolean;
}

export type InitialStaff = { role: DealerStaffRole; staffId: string | null } | null;

const UNLOADED_VALUE: StaffContextValue = {
  role: "owner",
  canEdit: true,
  canDelete: true,
  canManage: true,
  canFinance: true,
  loaded: false,
};

function deriveStaffContextValue(staff: InitialStaff): StaffContextValue {
  const role = staff?.role ?? "owner";
  return {
    role,
    canEdit:    canEditBusinessData(role),
    canDelete:  canDeleteData(role),
    canManage:  canManageStaff(role),
    canFinance: canViewFinance(role),
    loaded: true,
  };
}

const StaffContext = createContext<StaffContextValue>(UNLOADED_VALUE);

// GLOBAL_NAV_PERF_C2: when the caller (MainLayout) already resolved staff
// server-side, `initialStaff` is defined (a staff record, or null for "no
// row — fail open to owner", both settled decisions) and no client refetch
// runs. `initialStaff === undefined` means the caller didn't resolve it, so
// this falls back to the original fetch-on-mount behavior.
export function StaffProvider({
  children,
  initialStaff,
}: {
  children: ReactNode;
  initialStaff?: InitialStaff;
}) {
  const hasInitialStaff = initialStaff !== undefined;
  const [value, setValue] = useState<StaffContextValue>(() =>
    hasInitialStaff ? deriveStaffContextValue(initialStaff) : UNLOADED_VALUE,
  );

  useEffect(() => {
    if (hasInitialStaff) return;
    getCurrentStaff().then((staff) => {
      setValue(deriveStaffContextValue(staff));
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <StaffContext.Provider value={value}>
      {children}
    </StaffContext.Provider>
  );
}

export function useCurrentStaff() {
  return useContext(StaffContext);
}
