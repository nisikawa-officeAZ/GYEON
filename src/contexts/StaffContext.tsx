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

const StaffContext = createContext<StaffContextValue>({
  role: "owner",
  canEdit: true,
  canDelete: true,
  canManage: true,
  canFinance: true,
  loaded: false,
});

export function StaffProvider({ children }: { children: ReactNode }) {
  const [value, setValue] = useState<StaffContextValue>({
    role: "owner",
    canEdit: true,
    canDelete: true,
    canManage: true,
    canFinance: true,
    loaded: false,
  });

  useEffect(() => {
    getCurrentStaff().then((staff) => {
      const role = staff?.role ?? "owner";
      setValue({
        role,
        canEdit:    canEditBusinessData(role),
        canDelete:  canDeleteData(role),
        canManage:  canManageStaff(role),
        canFinance: canViewFinance(role),
        loaded: true,
      });
    });
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
