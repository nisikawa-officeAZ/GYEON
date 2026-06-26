"use client";

// GYEON Business Hub — Settings Center Wrapper (Sprint 12G)
//
// Client-side state manager for the two-level Settings Center navigation:
//   Hub view  → SettingsCenterHub (20-category grouped index)
//   Detail view → SettingsCategoryNav (existing working panel)
//
// State transition:
//   Hub → click active card → Detail (opens existing panel with defaultSelected)
//   Detail → click back button → Hub
//
// The existing SettingsCategoryNav is preserved intact with all its functionality.
// This wrapper adds the hub layer on top without modifying any working settings.
//
// No persistence. No DB calls. Pure UI state management.

import { useState } from "react";
import type { CanonicalDealerSettings } from "@/lib/dealer-settings/dealer-settings-types";
import type { CompanySettingsFields }   from "@/lib/company/save-company-settings";
import type { DocumentSequenceDB }      from "@/lib/numbering/numbering-types";
import type { DealerPlanInfo }          from "@/lib/plans/plan-types";
import type { DealerStaffDB, DealerStaffRole } from "@/lib/staff/staff-types";
import type { AiSettingsView }          from "@/lib/ai/ai-settings-types";
import SettingsCategoryNav, { type CategoryId } from "./SettingsCategoryNav";
import SettingsCenterHub                from "./SettingsCenterHub";

// ─── Props ────────────────────────────────────────────────────────────────────

export interface SettingsCenterWrapperProps {
  settings:        CanonicalDealerSettings;
  companySettings: CompanySettingsFields | null;
  sequences:       DocumentSequenceDB[];
  planInfo:        DealerPlanInfo;
  staffList:       DealerStaffDB[];
  staffInfo:       { role: DealerStaffRole; staffId: string | null } | null;
  planSlot:        React.ReactNode;
  aiSettings:      AiSettingsView;
}

// ─── View state ───────────────────────────────────────────────────────────────

type ViewState =
  | { mode: "hub" }
  | { mode: "detail"; panelId: CategoryId };

// ─── Main export ──────────────────────────────────────────────────────────────

export default function SettingsCenterWrapper(props: SettingsCenterWrapperProps) {
  const [view, setView] = useState<ViewState>({ mode: "hub" });

  const openPanel = (panelId: CategoryId) => {
    setView({ mode: "detail", panelId });
  };

  const returnToHub = () => {
    setView({ mode: "hub" });
  };

  if (view.mode === "hub") {
    return (
      <SettingsCenterHub
        staffRole={props.staffInfo?.role ?? null}
        settings={props.settings}
        planInfo={props.planInfo}
        aiSettings={props.aiSettings}
        onOpenPanel={openPanel}
      />
    );
  }

  // Detail view: open the matching panel in the existing SettingsCategoryNav
  return (
    <SettingsCategoryNav
      {...props}
      defaultSelected={view.panelId}
      onBack={returnToHub}
    />
  );
}
