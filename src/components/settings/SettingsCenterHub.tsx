"use client";

// GYEON Business Hub — Settings Center Hub (Sprint 12G / 12H, restructured UX-1B)
//
// ── WHAT UX-1B CHANGED, AND WHY ─────────────────────────────────────────────
// The hub used to render 7 groups of 20 equal-weight cards, of which 11 were
// unreachable placeholders, while the four settings an operator actually opens
// most often (営業時間 / 所要時間 / スタッフ・キャパシティ / 見積ウィザード) were a
// SEPARATE hardcoded list stacked above the hub on /settings. Two navigation
// systems described the same screen, and the working ones were not in the hub.
//
// Now there are four groups that match how a shop is actually run:
//   A 店舗運営 → B 見積・価格 → C 顧客接点・書類 → D 契約・管理
// and everything that cannot be opened yet is collected behind ONE collapsed
// “今後提供予定” disclosure instead of competing for attention as main cards.
//
// ── WHAT DID NOT CHANGE ─────────────────────────────────────────────────────
// Every href, every panel id, every `getState` rule and the whole visibility
// contract (SPOL-001…005) are carried over verbatim. Cards were regrouped and
// restyled; not one of them changed what it links to or who may see it. The
// `onOpenPanel` prop still drives the ?panel= detail view, so the coating deep
// link from the estimate-wizard settings screen keeps working.
//
// No persistence. No DB calls. No external APIs. Pure UI.
// Security: dealer_id always from server-side getCurrentDealer() in fetchers.

import Link from "next/link";
import type { ReactNode } from "react";
import type { CanonicalDealerSettings } from "@/lib/dealer-settings/dealer-settings-types";
import type { DealerPlanInfo }          from "@/lib/plans/plan-types";
import type { DealerStaffRole }         from "@/lib/staff/staff-types";
import type { AiSettingsView }          from "@/lib/ai/ai-settings-types";
import type { CategoryId }              from "./SettingsCategoryNav";
import InstallAppRow                    from "./InstallAppRow";
import {
  canViewSetting,
  resolveVisibilityFromRole,
} from "@/lib/settings";
import type { SettingsVisibilityLevel } from "@/lib/settings";

// ─── Types ────────────────────────────────────────────────────────────────────

type CardState =
  | "configured"      // Active, data present
  | "active"          // Active, navigable
  | "not_configured"  // Active, but not yet set up
  | "plan_required"   // Requires a higher plan
  | "coming_soon"     // Future implementation
  | "enterprise";     // Enterprise-only feature

type CardAction =
  | { kind: "panel"; panelId: CategoryId }     // Open in existing category nav panel
  | { kind: "route"; href: string }             // Navigate to dedicated page
  | { kind: "disabled" };                       // No action (future / locked)

/** Icon keys map to the small stroke set below. Emoji are deliberately not used. */
type IconKey =
  | "store" | "people" | "clock" | "timer" | "palette" | "bell"
  | "estimate" | "chat" | "scan" | "document" | "plan" | "spark"
  | "estimate_flow" | "coating" | "ppf" | "window_film";

interface HubCard {
  id:             string;
  icon:           IconKey;
  label:          string;
  labelEn:        string;
  description:    string;
  minVisibility:  SettingsVisibilityLevel;
  action:         CardAction;
  getState:       (ctx: StateContext) => CardState;
  /** Fixed solid badge that overrides the state-driven CardBadge; used only by the approved S8B estimate/pricing cards. */
  badge?:         "solid_active" | "solid_unset";
}

interface HubGroup {
  id:          string;
  label:       string;
  labelEn:     string;
  description: string;
  cards:       HubCard[];
}

interface StateContext {
  settings:  CanonicalDealerSettings;
  aiSettings: AiSettingsView;
  planInfo:  DealerPlanInfo;
}

// ─── Card state resolvers ─────────────────────────────────────────────────────

function resolveState(card: HubCard, ctx: StateContext): CardState {
  return card.getState(ctx);
}

// ─── A–D: the settings a dealer can actually open ─────────────────────────────

const HUB_GROUPS: HubGroup[] = [
  {
    id:          "store_ops",
    label:       "店舗運営",
    labelEn:     "STORE OPERATIONS",
    description: "店舗情報・スタッフ・営業時間・通知",
    cards: [
      {
        id:            "dealer",
        icon:          "store",
        label:         "店舗設定",
        labelEn:       "STORE PROFILE",
        description:   "店舗情報・業者設定・価格・施工メニュー",
        minVisibility: "staff",
        action:        { kind: "route", href: "/settings/dealer" },
        getState: ({ settings }) =>
          settings.business_name ? "configured" : "not_configured",
      },
      {
        id:            "staff",
        icon:          "people",
        label:         "スタッフ管理",
        labelEn:       "STAFF",
        description:   "スタッフプロフィール・招待・役割設定",
        minVisibility: "manager",
        action:        { kind: "route", href: "/settings/staff" },
        getState: () => "active",
      },
      // The next three were a hardcoded list above the hub until UX-1B. They keep
      // their exact routes, and `readonly` preserves the previous behaviour of
      // being visible to everyone who could reach /settings at all.
      {
        id:            "business_hours",
        icon:          "clock",
        label:         "営業時間・定休日",
        labelEn:       "BUSINESS HOURS",
        description:   "週の営業時間、定休日、臨時休業日／臨時営業日",
        minVisibility: "readonly",
        action:        { kind: "route", href: "/settings/business-hours" },
        getState: () => "active",
      },
      {
        id:            "service_durations",
        icon:          "timer",
        label:         "サービス所要時間",
        labelEn:       "SERVICE DURATION",
        description:   "施工内容ごとの標準所要時間と前後バッファ",
        minVisibility: "readonly",
        action:        { kind: "route", href: "/settings/service-durations" },
        getState: () => "active",
      },
      {
        id:            "staff_capacity",
        icon:          "people",
        label:         "スタッフ・キャパシティ",
        labelEn:       "STAFF CAPACITY",
        description:   "技術者・作業ベイ・同時対応・重複警告（未適用）",
        minVisibility: "readonly",
        action:        { kind: "route", href: "/settings/staff-capacity" },
        getState: () => "active",
      },
      {
        id:            "branding",
        icon:          "palette",
        label:         "ブランディング",
        labelEn:       "BRANDING",
        description:   "ショップロゴ・スタンプ・書類デザイン",
        minVisibility: "dealer_owner",
        action:        { kind: "route", href: "/settings/branding" },
        getState: ({ settings }) =>
          settings.logo_url ? "configured" : "not_configured",
      },
      {
        id:            "notifications",
        icon:          "bell",
        label:         "通知設定",
        labelEn:       "NOTIFICATIONS",
        description:   "メンテナンスリマインダー・通知テンプレート",
        minVisibility: "manager",
        action:        { kind: "route", href: "/settings/notifications" },
        getState: ({ settings }) => {
          const hasEnabled = settings.maintenance_reminder_templates.some(t => t.enabled);
          return hasEnabled ? "configured" : "active";
        },
      },
    ],
  },

  {
    id:          "estimate_pricing",
    label:       "見積・価格",
    labelEn:     "ESTIMATES & PRICING",
    description: "見積で選べるメニューと価格の登録",
    cards: [
      {
        id:            "estimate_wizard",
        icon:          "estimate_flow",
        label:         "見積ウィザード設定",
        labelEn:       "ESTIMATE WIZARD",
        description:   "見積作成フロー全体の表示・提供メニュー管理",
        minVisibility: "readonly",
        action:        { kind: "route", href: "/settings/estimate-wizard" },
        getState: () => "active",
        badge: "solid_active",
      },
      {
        id:            "coating",
        icon:          "coating",
        label:         "コーティング設定",
        labelEn:       "COATING",
        description:   "コーティングメニュー、グレード、価格、施工条件",
        minVisibility: "readonly",
        action:        { kind: "route", href: "/settings/coating" },
        getState: () => "active",
        badge: "solid_active",
      },
      {
        id:            "ppf",
        icon:          "ppf",
        label:         "PPF設定",
        labelEn:       "PPF SETTINGS",
        description:   "PPF種類、施工係数、コーティング同時施工減額",
        minVisibility: "readonly",
        action:        { kind: "route", href: "/settings/ppf" },
        getState: () => "active",
        badge: "solid_unset",
      },
      {
        id:            "window_film",
        icon:          "window_film",
        label:         "ウインドフィルム設定",
        labelEn:       "WINDOW FILM SETTINGS",
        description:   "フィルムメニュー、価格、施工条件",
        minVisibility: "readonly",
        action:        { kind: "route", href: "/settings/estimate-wizard#section-film" },
        getState: () => "active",
        badge: "solid_unset",
      },
    ],
  },

  {
    id:          "customer_docs",
    label:       "顧客接点・書類",
    labelEn:     "CUSTOMER & DOCUMENTS",
    description: "LINE連携・車検証OCR・書類フォーマット",
    cards: [
      {
        id:            "communication",
        icon:          "chat",
        label:         "コミュニケーション設定",
        labelEn:       "COMMUNICATION",
        description:   "LINE連携・メッセージテンプレート・リッチメニュー",
        minVisibility: "manager",
        action:        { kind: "route", href: "/settings/communication" },
        getState: ({ settings }) =>
          settings.line_enabled ? "configured" : "not_configured",
      },
      {
        id:            "ocr",
        icon:          "scan",
        label:         "車検証OCR",
        labelEn:       "VEHICLE OCR",
        description:   "OCR設定・処理ポリシー・フォーマット確認",
        minVisibility: "manager",
        action:        { kind: "route", href: "/settings/ocr" },
        getState: ({ settings }) =>
          settings.ocr_enabled ? "configured" : "active",
      },
      {
        id:            "pdf",
        icon:          "document",
        label:         "PDF・書類",
        labelEn:       "PDF & DOCUMENTS",
        description:   "採番設定・書類フォーマット・税率・利用規約",
        minVisibility: "manager",
        action:        { kind: "route", href: "/settings/pdf" },
        getState: () => "configured",
      },
    ],
  },

  {
    id:          "contract_admin",
    label:       "契約・管理",
    labelEn:     "PLAN & ADMIN",
    description: "利用プラン・AI基盤",
    cards: [
      {
        id:            "subscription",
        icon:          "plan",
        label:         "契約・プラン",
        labelEn:       "SUBSCRIPTION",
        description:   "利用プラン・請求情報・機能一覧",
        minVisibility: "dealer_owner",
        action:        { kind: "route", href: "/settings/subscription" },
        getState: () => "configured",
      },
      {
        id:            "ai_providers",
        icon:          "spark",
        label:         "AIプロバイダー設定",
        labelEn:       "AI PROVIDERS",
        description:   "OpenAI・Anthropic・Gemini設定・APIキー管理（Pro+）",
        minVisibility: "dealer_owner",
        action:        { kind: "route", href: "/settings/ai" },
        getState: ({ aiSettings, planInfo }) => {
          if (planInfo.plan !== "pro_plus") return "plan_required";
          return aiSettings.enabled && aiSettings.primary_provider ? "configured" : "not_configured";
        },
      },
    ],
  },
];

// ─── Not yet available: one collapsed disclosure, never main cards ────────────
// Same ids, same visibility levels, same states as before; they simply no longer
// occupy the same visual weight as settings that can be opened today.

interface PendingItem {
  id:            string;
  label:         string;
  minVisibility: SettingsVisibilityLevel;
  state:         Extract<CardState, "coming_soon" | "enterprise">;
}

const PENDING_ITEMS: PendingItem[] = [
  { id: "organization",       label: "組織設定",                     minVisibility: "company_admin", state: "coming_soon" },
  { id: "roles_permissions",  label: "役割・権限",                   minVisibility: "dealer_owner",  state: "coming_soon" },
  { id: "ai_marketplace",     label: "AIマーケットプレイス",         minVisibility: "dealer_owner",  state: "coming_soon" },
  { id: "automation",         label: "オートメーション設定",         minVisibility: "manager",       state: "coming_soon" },
  { id: "analytics",          label: "アナリティクス設定",           minVisibility: "manager",       state: "coming_soon" },
  { id: "media",              label: "メディア管理",                 minVisibility: "dealer_owner",  state: "coming_soon" },
  { id: "customer_portal",    label: "カスタマーポータル",           minVisibility: "dealer_owner",  state: "coming_soon" },
  { id: "gyeon_distribution", label: "GYEONディストリビューション",  minVisibility: "company_admin", state: "enterprise"  },
  { id: "warehouse",          label: "倉庫管理",                     minVisibility: "company_admin", state: "enterprise"  },
  { id: "crm",                label: "CRM設定",                      minVisibility: "company_admin", state: "enterprise"  },
  { id: "accounting",         label: "会計設定",                     minVisibility: "company_admin", state: "enterprise"  },
];

// ─── Icons (stroke set; no emoji) ─────────────────────────────────────────────

const LEGACY_ICON_PATHS: Record<Exclude<IconKey, "estimate_flow" | "coating" | "ppf" | "window_film">, ReactNode> = {
  store:    <><path d="M2.5 6.5 4 2.5h8l1.5 4" /><path d="M2.5 6.5v7h11v-7" /><path d="M2.5 6.5h11" /></>,
  people:   <><circle cx="6" cy="6" r="2" /><path d="M2.5 13c0-2 1.6-3.5 3.5-3.5S9.5 11 9.5 13" /><path d="M11 5.5a2 2 0 0 1 0 4" /><path d="M11.5 13c0-1.4-.5-2.5-1.3-3.2" /></>,
  clock:    <><circle cx="8" cy="8" r="5.5" /><path d="M8 5v3.2l2 1.3" /></>,
  timer:    <><circle cx="8" cy="9" r="4.8" /><path d="M6.3 2.2h3.4" /><path d="M8 2.2v2" /></>,
  palette:  <><path d="M8 2.5a5.5 5.5 0 1 0 0 11c1 0 1.3-.7 1-1.3-.4-.8.1-1.5 1-1.5h.8A2.7 2.7 0 0 0 13.5 8 5.6 5.6 0 0 0 8 2.5Z" /><circle cx="5.8" cy="7" r=".8" fill="currentColor" stroke="none" /><circle cx="9" cy="5.6" r=".8" fill="currentColor" stroke="none" /></>,
  bell:     <><path d="M4.5 11V7.2a3.5 3.5 0 0 1 7 0V11" /><path d="M3.2 11h9.6" /><path d="M6.8 13a1.4 1.4 0 0 0 2.4 0" /></>,
  estimate: <><rect x="3.2" y="2" width="9.6" height="12" rx="1.4" /><path d="M5.6 5.2h4.8" /><path d="M5.6 8h4.8" /><path d="M5.6 10.8h2.8" /></>,
  chat:     <><path d="M13.2 8.6c0 2.4-2.3 4.3-5.2 4.3-.7 0-1.3-.1-1.9-.3L3 13.5l.9-2.2A4 4 0 0 1 2.8 8.6C2.8 6.2 5.1 4.3 8 4.3s5.2 1.9 5.2 4.3Z" /></>,
  scan:     <><path d="M2.5 5.5v-2a1 1 0 0 1 1-1h2" /><path d="M13.5 5.5v-2a1 1 0 0 0-1-1h-2" /><path d="M2.5 10.5v2a1 1 0 0 0 1 1h2" /><path d="M13.5 10.5v2a1 1 0 0 1-1 1h-2" /><path d="M3.8 8h8.4" /></>,
  document: <><path d="M4 2.2h5l3 3v8.6H4z" /><path d="M9 2.2v3h3" /><path d="M6 9h4" /><path d="M6 11.2h4" /></>,
  plan:     <><rect x="2.2" y="3.5" width="11.6" height="9" rx="1.4" /><path d="M2.2 6.6h11.6" /><path d="M5 9.6h3" /></>,
  spark:    <><path d="M8 2.2 9.3 6l3.8 1.3L9.3 8.6 8 12.4 6.7 8.6 2.9 7.3 6.7 6Z" /></>,
};

/** Dedicated semantic line icons for the estimate/pricing navigation cards — exact geometry from the approved GenSpark R2 package (S8B). */
const SEMANTIC_ICON_PATHS: Record<"estimate_flow" | "coating" | "ppf" | "window_film", ReactNode> = {
  estimate_flow: <>
    <rect x="4" y="3" width="16" height="18" rx="2" />
    <path d="M8 7.5h8M8 11h8" />
    <path d="M15.5 15.5l.7 1.6 1.6.7-1.6.7-.7 1.6-.7-1.6-1.6-.7 1.6-.7z" />
  </>,
  coating: <>
    <path d="M4 15c1.5-3.5 3-5 5.5-5.5L11 8h4l2 3h2.5c.8 0 1.5.7 1.5 1.5V15" />
    <path d="M4 15h17" />
    <circle cx="8" cy="17.5" r="1.8" />
    <circle cx="16.5" cy="17.5" r="1.8" />
    <path d="M12 4.5l.6 1.4 1.4.6-1.4.6-.6 1.4-.6-1.4-1.4-.6 1.4-.6z" opacity=".7" />
  </>,
  ppf: <>
    <path d="M12 3l7 2.8v5.1c0 4.4-3 8-7 10.1-4-2.1-7-5.7-7-10.1V5.8z" />
    <path d="M12 6.2v11.6" opacity=".55" />
    <path d="M12 6.2c-2 .4-3.8.6-5 .6" opacity=".55" />
  </>,
  window_film: <>
    <path d="M3.5 16.5c2-4.5 4-7 7-8l2-2.5h6.5l2.5 4.5c.6 1 .4 2-.3 3l-1.2 1.5c-.5.7-1.2 1.5-2 1.5z" opacity=".9" />
    <path d="M3.5 16.5c2-4.5 4-7 7-8l2-2.5" />
    <path d="M12.5 8.5l-1.2 6M16 6l-.8 8.5" opacity=".55" />
    <path d="M13.5 10.5l3 3" opacity=".8" />
  </>,
};

const SEMANTIC_ICON_KEYS = new Set<IconKey>(["estimate_flow", "coating", "ppf", "window_film"]);

function CardIcon({ name, dim }: { name: IconKey; dim: boolean }) {
  const isSemantic = SEMANTIC_ICON_KEYS.has(name);
  return (
    <span className={dim ? "text-[#526079]" : "text-[#91b9ff]"} aria-hidden="true">
      {isSemantic ? (
        <svg className="block h-6 w-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
          {SEMANTIC_ICON_PATHS[name as "estimate_flow" | "coating" | "ppf" | "window_film"]}
        </svg>
      ) : (
        <svg className="block h-6 w-6" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.25" strokeLinecap="round" strokeLinejoin="round">
          {LEGACY_ICON_PATHS[name as Exclude<IconKey, "estimate_flow" | "coating" | "ppf" | "window_film">]}
        </svg>
      )}
    </span>
  );
}

// ─── Badge component ──────────────────────────────────────────────────────────

function CardBadge({ state }: { state: CardState }) {
  switch (state) {
    case "configured":
      return (
        <span className="inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full bg-emerald-950/40 text-emerald-400 border border-emerald-500/30 font-medium">
          <span className="w-1 h-1 rounded-full bg-emerald-400 inline-block" />
          設定済み
        </span>
      );
    case "active":
      return (
        <span className="inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full bg-blue-950/30 text-blue-400 border border-blue-500/20 font-medium">
          <span className="w-1 h-1 rounded-full bg-blue-400 inline-block" />
          有効
        </span>
      );
    case "not_configured":
      return (
        <span className="inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full bg-amber-950/30 text-amber-400 border border-amber-500/20 font-medium">
          <span className="w-1 h-1 rounded-full bg-amber-400 inline-block" />
          未設定
        </span>
      );
    case "plan_required":
      return (
        <span className="text-[10px] px-2 py-0.5 rounded-full bg-purple-950/30 text-purple-400 border border-purple-500/20 font-medium">
          Pro+ が必要
        </span>
      );
    case "coming_soon":
      return (
        <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-800 text-slate-500 border border-slate-700 font-medium">
          準備中
        </span>
      );
    case "enterprise":
      return (
        <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-800/80 text-slate-500 border border-slate-700 font-medium">
          エンタープライズ
        </span>
      );
  }
}

/** Solid badge variant approved for the S8B estimate/pricing parent and wizard-access cards only. */
function FixedCardBadge({ variant }: { variant: "solid_active" | "solid_unset" }) {
  if (variant === "solid_active") {
    return (
      <span className="inline-flex items-center rounded-full bg-gradient-to-br from-[#60a5fa] to-[#2563eb] px-2.5 py-1 text-[10px] font-bold tracking-wide text-white shadow-[0_2px_8px_rgba(37,99,235,.35)]">
        有効
      </span>
    );
  }
  return (
    <span className="inline-flex items-center rounded-full border border-[#94a3b8]/30 bg-[#94a3b8]/20 px-2.5 py-1 text-[10px] font-bold tracking-wide text-[#94a3b8]">
      未設定
    </span>
  );
}

// ─── Card ─────────────────────────────────────────────────────────────────────

function HubCardButton({
  card,
  state,
  onOpenPanel,
}: {
  card: HubCard;
  state: CardState;
  onOpenPanel: (panelId: CategoryId) => void;
}) {
  const isInteractive = card.action.kind !== "disabled" && state !== "plan_required";

  const inner = (
    <div className={[
      "group relative h-full min-h-[128px] rounded-2xl border p-4 transition-all duration-200 md:min-h-[190px] md:p-5 lg:min-h-[210px] lg:p-6",
      isInteractive
        ? "cursor-pointer border-[#263955] bg-[#111826]/90 hover:-translate-y-0.5 hover:border-[#3b6eb4] hover:bg-[#141e2f] hover:shadow-[0_18px_45px_rgba(0,0,0,.24)]"
        : "border-[#1d2b40] bg-[#0b111d]/80",
    ].join(" ")}
    >
      {card.badge && (
        <span className="absolute right-4 top-4">
          <FixedCardBadge variant={card.badge} />
        </span>
      )}
      <div className="flex h-full flex-col">
        <span className={[
          "grid h-[52px] w-[52px] shrink-0 place-items-center rounded-xl border md:rounded-2xl",
          isInteractive ? "border-[#31568c] bg-[#122142]" : "border-[#243149] bg-[#101827]",
        ].join(" ")}>
          <CardIcon name={card.icon} dim={!isInteractive} />
        </span>

        <div className={["mt-3 md:mt-5", card.badge ? "pr-16" : ""].join(" ")}>
          <p className={[
            "text-[15px] font-bold leading-tight md:text-[18px]",
            isInteractive ? "text-[#edf3fc]" : "text-[#66738a]",
          ].join(" ")}>
            {card.label}
          </p>
          <p className="mt-1 text-[9px] font-semibold tracking-[0.18em] text-[#8191ad] md:text-[10px] md:tracking-[0.22em]">
            {card.labelEn}
          </p>
        </div>

        <p className={[
          "mt-3 hidden text-[12px] leading-6 md:block md:flex-1",
          isInteractive ? "text-[#95a4bc]" : "text-[#58657a]",
        ].join(" ")}>
          {card.description}
        </p>

        <div className="mt-auto flex items-center pt-3 md:pt-5">
          {card.badge ? (
            isInteractive && (
              <span className="ml-auto text-[11px] font-semibold tracking-[0.08em] text-[#5f9cff]">開く →</span>
            )
          ) : (
            <div className="flex w-full items-center justify-between gap-2">
              <CardBadge state={state} />
              {isInteractive && (
                <span className="text-[11px] font-semibold tracking-[0.08em] text-[#5f9cff]">開く →</span>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );

  if (card.action.kind === "route") {
    return (
      <Link href={card.action.href} className="block h-full">
        {inner}
      </Link>
    );
  }

  if (card.action.kind === "panel") {
    const panelId = card.action.panelId;
    return (
      <button
        type="button"
        onClick={() => onOpenPanel(panelId)}
        className="block w-full h-full text-left"
      >
        {inner}
      </button>
    );
  }

  return <div className="h-full">{inner}</div>;
}

// ─── Group header ─────────────────────────────────────────────────────────────

function GroupHeader({ group }: { group: HubGroup }) {
  return (
    <div className="flex items-center gap-4">
      <div>
        <p className="text-[10px] font-bold tracking-[0.2em] text-[#5f9cff]">{group.labelEn}</p>
        <h2 className="mt-1 text-[16px] font-bold text-[#e8eef7] md:text-[18px]">{group.label}</h2>
      </div>
      <span className="hidden text-[11px] text-[#70809b] lg:inline">{group.description}</span>
      <div className="h-px flex-1 bg-[#20304a]" />
    </div>
  );
}

// ─── Props ────────────────────────────────────────────────────────────────────

interface SettingsCenterHubProps {
  staffRole:    DealerStaffRole | null;
  settings:     CanonicalDealerSettings;
  planInfo:     DealerPlanInfo;
  aiSettings:   AiSettingsView;
  onOpenPanel:  (panelId: CategoryId) => void;
}

// ─── Main export ──────────────────────────────────────────────────────────────

export default function SettingsCenterHub({
  staffRole,
  settings,
  planInfo,
  aiSettings,
  onOpenPanel,
}: SettingsCenterHubProps) {
  const userLevel = resolveVisibilityFromRole(staffRole);
  const ctx: StateContext = { settings, aiSettings, planInfo };

  // Unchanged rule: company_admin / platform_admin settings are never shown to a
  // dealer user, and everything else is gated by the shared visibility check.
  const isVisible = (min: SettingsVisibilityLevel) =>
    min !== "company_admin" && min !== "platform_admin" && canViewSetting(userLevel, min);

  // Enterprise entries stayed visible (as locked) before UX-1B, so they stay visible
  // inside the disclosure rather than disappearing from the screen.
  const pending = PENDING_ITEMS.filter(
    (i) => i.state === "enterprise" || isVisible(i.minVisibility),
  );

  return (
    <div className="flex flex-col gap-10">

      <div className="flex items-center gap-5">
        <p className="text-[11px] font-bold tracking-[0.22em] text-[#7788a4]">SETTINGS / 設定メニュー</p>
        <span className="h-px flex-1 bg-[#20304a]" />
      </div>

      {HUB_GROUPS.map((group) => {
        const visibleCards = group.cards.filter((card) => isVisible(card.minVisibility));
        if (visibleCards.length === 0) return null;

        return (
          <div key={group.id} className="flex flex-col gap-6">
            {/* The install row sits immediately before 契約・管理: an environment
                preference, adjacent to the other account-level settings, and never
                promoted anywhere an operator is trying to work. */}
            {group.id === "contract_admin" && <InstallAppRow />}

            <div className="flex flex-col gap-4">
              <GroupHeader group={group} />
              {/* 1 column below 768, 2 columns to 1279, 3 columns from 1280. */}
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
                {visibleCards.map((card) => (
                  <HubCardButton
                    key={card.id}
                    card={card}
                    state={resolveState(card, ctx)}
                    onOpenPanel={onOpenPanel}
                  />
                ))}
              </div>
            </div>
          </div>
        );
      })}

      {/* Everything that cannot be opened yet — one line, closed by default. */}
      {pending.length > 0 && (
        <details className="rounded-2xl border border-[#263955] bg-[#111826]/70">
          <summary className="flex cursor-pointer list-none items-center gap-2 px-5 py-4 text-xs text-[#95a4bc] transition-colors hover:text-[#edf3fc]">
            <span className="text-[#5f9cff]">▸</span>
            今後提供予定
            <span className="text-[10px] text-slate-600">{pending.length}件</span>
          </summary>
          <div className="px-4 pb-3 flex flex-col gap-1.5">
            {pending.map((item) => (
              <div key={item.id} className="flex items-center gap-3 py-1">
                <span className="text-[11px] text-slate-500">{item.label}</span>
                <div className="flex-1" />
                <CardBadge state={item.state} />
              </div>
            ))}
          </div>
        </details>
      )}

      {/* Footer — backup / support open in the existing panel view. */}
      <div className="flex items-center gap-3 rounded-2xl border border-[#263955] bg-[#111826]/70 px-5 py-4">
        <div className="flex flex-col gap-0.5">
          <p className="text-xs font-medium text-slate-300">バックアップ・サポート</p>
          <p className="text-[10px] text-slate-500">DRステータス確認・エクスポート・サポート問い合わせ</p>
        </div>
        <button
          type="button"
          onClick={() => onOpenPanel("backup")}
          className="ml-auto text-xs text-slate-500 hover:text-slate-300 transition-colors shrink-0"
        >
          バックアップ →
        </button>
        <button
          type="button"
          onClick={() => onOpenPanel("support")}
          className="text-xs text-slate-500 hover:text-slate-300 transition-colors shrink-0"
        >
          サポート →
        </button>
      </div>

    </div>
  );
}
