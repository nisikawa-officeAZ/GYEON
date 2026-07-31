"use client";

import { useState, ReactNode } from "react";
import Header      from "@/components/Header";
import Sidebar     from "@/components/Sidebar";
import BottomNav   from "@/components/layout/BottomNav";
import TrialBanner from "@/components/trial/TrialBanner";
import { StaffProvider } from "@/contexts/StaffContext";

interface MainLayoutProps {
  children: ReactNode;
  footer?: ReactNode;
}

// Height of the fixed top Header (h-14 = 56px) plus the iPhone safe-area inset.
// Defined as the --app-header-h CSS variable in globals.css.
const HEADER_OFFSET = "var(--app-header-h)";

export default function MainLayout({ children, footer }: MainLayoutProps) {
  const [open, setOpen] = useState(false);

  return (
    <StaffProvider>
    <div className="min-h-screen flex flex-col">
      {/* Fixed top header (out of flow, height = --app-header-h) */}
      <Header open={open} onToggleSidebar={() => setOpen((prev) => !prev)} />

      {/* Sidebar — off-canvas overlay on mobile (toggled by `open`),
          permanently docked on md+ so desktop navigation is always visible. */}
      <Sidebar open={open} onClose={() => setOpen(false)} />

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
        <main className="flex-1 px-4 py-5 pb-20 md:px-6 md:py-6 md:pb-6">
          {children}
        </main>

        {/* Footer (optional) */}
        {footer && <footer>{footer}</footer>}
      </div>
    </div>
    </StaffProvider>
  );
}
