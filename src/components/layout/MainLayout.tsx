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

export default function MainLayout({ children, footer }: MainLayoutProps) {
  const [open, setOpen] = useState(false);

  return (
    <StaffProvider>
    <div className="min-h-screen flex flex-col">
      {/* Header */}
      <Header open={open} onToggleSidebar={() => setOpen((prev) => !prev)} />

      {/* Sidebar — off-canvas overlay on mobile (toggled by `open`),
          permanently docked on md+ so desktop navigation is always visible. */}
      <Sidebar open={open} onClose={() => setOpen(false)} />

      {/* Mobile bottom nav */}
      <BottomNav />

      {/* Spacer reserving the fixed Header's height (incl. iPhone safe-area).
          Keeping the offset in normal flow — instead of as padding on <main> —
          avoids Tailwind responsive padding utilities (md:py-*) overriding it. */}
      <div aria-hidden style={{ height: "var(--app-header-h)" }} />

      {/* Trial period countdown banner — in normal flow so it pushes content
          down (no overlap) and collapses to nothing when no trial is active.
          Offset right on md+ to clear the docked sidebar. */}
      <div className="transition-all duration-300 md:ml-[240px]">
        <TrialBanner />
      </div>

      {/* Content — no horizontal shift on mobile (sidebar overlays); on md+ the
          sidebar is docked so content is always offset by its 240px width.
          pb-20 on mobile to clear the bottom nav bar. */}
      <main
        className="flex-1 px-4 py-5 pb-20 md:pb-6 md:px-6 md:py-6 transition-all duration-300 md:ml-[240px]"
      >
        {children}
      </main>

      {/* Footer (optional) */}
      {footer && (
        <footer
          className="transition-all duration-300 md:ml-[240px]"
        >
          {footer}
        </footer>
      )}
    </div>
    </StaffProvider>
  );
}
