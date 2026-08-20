"use client";

import { useState, ReactNode } from "react";
import Header      from "@/components/Header";
import Sidebar     from "@/components/Sidebar";
import BottomNav   from "@/components/layout/BottomNav";
import TrialBanner from "@/components/trial/TrialBanner";
import { StaffProvider, type InitialStaff } from "@/contexts/StaffContext";
import type { DealerPlan } from "@/lib/plans/plan-types";
import type { NotificationBellData } from "@/lib/notifications/notification";

interface MainLayoutProps {
  children: ReactNode;
  footer?: ReactNode;
  initialStaff?: InitialStaff;
  initialPlan?: DealerPlan;
  initialNotificationData?: NotificationBellData;
  initialUnreadNews?: number;
}

// Height of the fixed top Header (h-14 = 56px) plus the iPhone safe-area inset.
// Defined as the --app-header-h CSS variable in globals.css.
const HEADER_OFFSET = "var(--app-header-h)";

export default function MainLayout({
  children,
  footer,
  initialStaff,
  initialPlan,
  initialNotificationData,
  initialUnreadNews,
}: MainLayoutProps) {
  const [open, setOpen] = useState(false);

  return (
    <StaffProvider initialStaff={initialStaff}>
    <div className="min-h-screen flex flex-col bg-[#070c17]">
      {/* Fixed top header (out of flow, height = --app-header-h) */}
      <Header
        open={open}
        onToggleSidebar={() => setOpen((prev) => !prev)}
        initialNotificationData={initialNotificationData}
      />

      {/* Sidebar — off-canvas overlay on mobile (toggled by `open`),
          permanently docked on md+ so desktop navigation is always visible. */}
      <Sidebar
        open={open}
        onClose={() => setOpen(false)}
        initialPlan={initialPlan}
        initialUnreadNews={initialUnreadNews}
      />

      {/* Mobile bottom nav */}
      <BottomNav />

      {/* ── Protected app content wrapper ──────────────────────────────────────
          Single shared wrapper for ALL protected pages. The fixed header is out
          of normal flow, so we reserve its height here with an explicit inline
          `padding-top`. Inline styles win over every utility class, so no
          responsive padding (e.g. md:py-*) can collapse this offset — content
          always starts below the header on every page and breakpoint.
          On md+ the wrapper is shifted right by the 240px docked sidebar. */}
      <div
        className="flex flex-col flex-1 transition-all duration-300 md:ml-[240px]"
        style={{ paddingTop: HEADER_OFFSET }}
      >
        {/* Trial countdown banner — in normal flow, directly under the header.
            Collapses to nothing when no trial is active. */}
        <TrialBanner />

        {/* Page content. pb-20 on mobile clears the fixed bottom nav bar. */}
        <main className="flex-1 bg-[radial-gradient(circle_at_85%_5%,rgba(40,92,180,0.08),transparent_30%),radial-gradient(circle_at_5%_95%,rgba(31,79,158,0.06),transparent_28%)] px-4 py-5 pb-20 md:px-8 md:py-8 md:pb-8">
          {children}
        </main>

        {/* Footer (optional) */}
        {footer && <footer>{footer}</footer>}
      </div>
    </div>
    </StaffProvider>
  );
}
