// MainLayout — async SERVER wrapper around the client dealer shell.
//
// GYEON-PARTNER-ONBOARD-F1: this is the single shared access boundary for the
// dealer shell. Every page that renders inside MainLayout (dashboard, products,
// product-orders, estimates, settings, customers, …) passes through
// requireActiveDealer() BEFORE the shell renders:
//   * unauthenticated               → /login
//   * no ACTIVE dealer membership   → /no-dealer  (invited/suspended included)
//
// The visual shell itself (client state for the sidebar toggle, StaffProvider,
// Header/Sidebar/BottomNav/TrialBanner) lives byte-identically in
// ./MainLayoutClient — import paths for all existing pages are unchanged.
//
// Non-dealer-shell surfaces (login/signup/password flows, /admin, public share
// routes /s, /liff, the customer /app shell, /no-dealer, /shop-profile) do not
// import MainLayout and are intentionally outside this guard.

import { ReactNode } from "react";
import { requireActiveDealer } from "@/lib/auth/require-active-dealer";
import { getCurrentStaff } from "@/lib/staff/get-current-staff";
import { getCurrentPlan } from "@/lib/plans/get-current-plan";
import { getNotificationBellData } from "@/lib/notifications/notification";
import MainLayoutClient from "@/components/layout/MainLayoutClient";

interface MainLayoutProps {
  children: ReactNode;
  footer?: ReactNode;
}

export default async function MainLayout({ children, footer }: MainLayoutProps) {
  await requireActiveDealer();

  // GLOBAL_NAV_PERF_C2/C5/C6: getCurrentStaff()/getCurrentPlan()/
  // getNotificationBellData() reuse the same request-memoized
  // getCurrentUser()/getCurrentDealer() that requireActiveDealer() just
  // resolved, so these only add their own query/queries each (dealer_staff,
  // dealers, notifications) — instead of StaffProvider/Sidebar/NotificationBell
  // re-deriving user/dealer from scratch on every navigation via their own
  // post-hydration client round trips.
  const [staff, planInfo, notificationData] = await Promise.all([
    getCurrentStaff(),
    getCurrentPlan(),
    getNotificationBellData(),
  ]);

  return (
    <MainLayoutClient
      footer={footer}
      initialStaff={staff}
      initialPlan={planInfo.plan}
      initialNotificationData={notificationData}
    >
      {children}
    </MainLayoutClient>
  );
}
