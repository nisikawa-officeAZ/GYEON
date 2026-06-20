"use client";

import { useState, ReactNode } from "react";
import Header from "@/components/Header";
import Sidebar from "@/components/Sidebar";

interface MainLayoutProps {
  children: ReactNode;
  footer?: ReactNode;
}

export default function MainLayout({ children, footer }: MainLayoutProps) {
  const [open, setOpen] = useState(false);

  return (
    <div className="min-h-screen flex flex-col">
      {/* Header */}
      <Header open={open} onToggleSidebar={() => setOpen((prev) => !prev)} />

      {/* Sidebar */}
      <Sidebar open={open} />

      {/* Content */}
      <main
        className={`flex-1 pt-14 p-6 transition-all duration-300 ${
          open ? "ml-[240px]" : "ml-0"
        }`}
      >
        {children}
      </main>

      {/* Footer (optional) */}
      {footer && (
        <footer
          className={`transition-all duration-300 ${
            open ? "ml-[240px]" : "ml-0"
          }`}
        >
          {footer}
        </footer>
      )}
    </div>
  );
}
