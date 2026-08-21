import type { AppFeature } from "@/lib/plans/plan-types";

export type GdaCategoryId =
  | "home"
  | "customers"
  | "estimates"
  | "reservations"
  | "billing"
  | "orders"
  | "social-media"
  | "messages"
  | "records"
  | "settings";

export type GdaCategoryIcon =
  | "home"
  | "customers"
  | "document"
  | "calendar"
  | "billing"
  | "orders"
  | "social"
  | "message"
  | "records"
  | "settings";

export interface GdaCategory {
  id: GdaCategoryId;
  label: string;
  labelEn: string;
  href: string | null;
  icon: GdaCategoryIcon;
  paths: readonly string[];
  feature?: AppFeature;
  badge?: "news";
}

/** Owner-approved v18 navigation constitution. */
export const GDA_CATEGORIES: readonly GdaCategory[] = [
  { id: "home", label: "ダッシュボード", labelEn: "HOME", href: "/", icon: "home", paths: ["/", "/dashboard"] },
  { id: "customers", label: "顧客・車両", labelEn: "CUSTOMERS", href: "/hub/customers", icon: "customers", paths: ["/hub/customers", "/customers", "/vehicles", "/customer-app"], feature: "customers" },
  { id: "estimates", label: "見積・作業", labelEn: "ESTIMATES", href: "/hub/estimates", icon: "document", paths: ["/hub/estimates", "/estimates", "/work-orders", "/completion-reports", "/maintenance"], feature: "estimates" },
  { id: "reservations", label: "予約", labelEn: "RESERVATIONS", href: "/hub/reservations", icon: "calendar", paths: ["/hub/reservations", "/reservations", "/calendar"], feature: "reservations" },
  { id: "billing", label: "請求・入金", labelEn: "BILLING", href: "/billing", icon: "billing", paths: ["/billing", "/invoices", "/payments", "/points", "/sales", "/monthly-statements"], feature: "invoices" },
  { id: "orders", label: "発注・在庫", labelEn: "ORDERS", href: "/hub/orders", icon: "orders", paths: ["/hub/orders", "/product-orders", "/products", "/inventory"], feature: "products" },
  { id: "social-media", label: "SNS", labelEn: "SOCIAL MEDIA", href: null, icon: "social", paths: ["/social-media"] },
  { id: "messages", label: "メッセージ", labelEn: "MESSAGES", href: "/hub/messages", icon: "message", paths: ["/hub/messages", "/line", "/news"], feature: "line", badge: "news" },
  { id: "records", label: "記録・資料", labelEn: "RECORDS", href: "/hub/records", icon: "records", paths: ["/hub/records", "/downloads", "/pdf", "/ocr-sessions"] },
  { id: "settings", label: "設定", labelEn: "SETTINGS", href: "/settings", icon: "settings", paths: ["/settings"] },
] as const;

function matchesPath(pathname: string, base: string): boolean {
  if (base === "/") return pathname === "/";
  return pathname === base || pathname.startsWith(`${base}/`);
}

export function categoryForPathname(pathname: string): GdaCategory {
  return GDA_CATEGORIES.find((category) =>
    category.paths.some((path) => matchesPath(pathname, path)),
  ) ?? GDA_CATEGORIES[0];
}
