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

      {/* Sidebar — overlays on mobile, pushes on md+ */}
      <Sidebar open={open} onClose={() => setOpen(false)} />

      {/* Mobile bottom nav */}
      <BottomNav />

      {/* Trial period countdown banner — shown only when trial is active or ended */}
      <div className={`fixed top-14 left-0 right-0 z-30 transition-all duration-300 ${open ? "md:ml-[240px]" : "md:ml-0"}`}>
        <TrialBanner />
      </div>

      {/* Content — no horizontal shift on mobile (sidebar overlays) */}
      {/* pb-16 on mobile to clear the bottom nav bar */}
      <main
        className={`flex-1 pt-14 px-4 py-5 pb-20 md:pb-6 md:px-6 md:py-6 transition-all duration-300 ${
          open ? "md:ml-[240px]" : "md:ml-0"
        }`}
      >
        {children}
      </main>

      {/* Footer (optional) */}
      {footer && (
        <footer
          className={`transition-all duration-300 ${
            open ? "md:ml-[240px]" : "md:ml-0"
          }`}
        >
          {footer}
        </footer>
      )}
    </div>
    </StaffProvider>
  );
}
