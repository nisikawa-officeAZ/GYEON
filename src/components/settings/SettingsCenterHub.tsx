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
  | "estimate" | "chat" | "scan" | "document" | "plan" | "spark";

interface HubCard {
  id:             string;
  icon:           IconKey;
  label:          string;
  description:    string;
  minVisibility:  SettingsVisibilityLevel;
  action:         CardAction;
  getState:       (ctx: StateContext) => CardState;
}

interface HubGroup {
  id:          string;
  label:       string;
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
    description: "店舗情報・スタッフ・営業時間・通知",
    cards: [
      {
        id:            "dealer",
        icon:          "store",
        label:         "店舗設定",
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
        description:   "週の営業時間、定休日、臨時休業日／臨時営業日",
        minVisibility: "readonly",
        action:        { kind: "route", href: "/settings/business-hours" },
        getState: () => "active",
      },
      {
        id:            "service_durations",
        icon:          "timer",
        label:         "サービス所要時間",
        description:   "施工内容ごとの標準所要時間と前後バッファ",
        minVisibility: "readonly",
        action:        { kind: "route", href: "/settings/service-durations" },
        getState: () => "active",
      },
      {
        id:            "staff_capacity",
        icon:          "people",
        label:         "スタッフ・キャパシティ",
        description:   "技術者・作業ベイ・同時対応・重複警告（未適用）",
        minVisibility: "readonly",
        action:        { kind: "route", href: "/settings/staff-capacity" },
        getState: () => "active",
      },
      {
        id:            "branding",
        icon:          "palette",
        label:         "ブランディング",
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
    description: "見積で選べるメニューと価格の登録",
    cards: [
      {
        id:            "estimate_wizard",
        icon:          "estimate",
        label:         "見積ウィザード設定",
        description:   "提供サービス・フィルム・メニュー・割引の登録と確認",
        minVisibility: "readonly",
        action:        { kind: "route", href: "/settings/estimate-wizard" },
        getState: () => "active",
      },
    ],
  },

  {
    id:          "customer_docs",
    label:       "顧客接点・書類",
    description: "LINE連携・車検証OCR・書類フォーマット",
    cards: [
      {
        id:            "communication",
        icon:          "chat",
        label:         "コミュニケーション設定",
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
    description: "利用プラン・AI基盤",
    cards: [
      {
        id:            "subscription",
        icon:          "plan",
        label:         "契約・プラン",
        description:   "利用プラン・請求情報・機能一覧",
        minVisibility: "dealer_owner",
        action:        { kind: "route", href: "/settings/subscription" },
        getState: () => "configured",
      },
      {
        id:            "ai_providers",
        icon:          "spark",
        label:         "AIプロバイダー設定",
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

const ICON_PATHS: Record<IconKey, ReactNode> = {
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

function CardIcon({ name, dim }: { name: IconKey; dim: boolean }) {
  return (
    <span className={dim ? "text-slate-700" : "text-slate-400"} aria-hidden="true">
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round">
        {ICON_PATHS[name]}
      </svg>
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
      "h-full flex flex-col gap-2 px-3.5 py-3 rounded-xl border transition-colors",
      isInteractive
        ? "bg-[#0f172a] border-slate-700 hover:border-slate-500 hover:bg-slate-800/30 cursor-pointer"
        : "bg-[#0a0f1a] border-slate-800/60",
    ].join(" ")}
    >
      <div className="flex items-center gap-2">
        <CardIcon name={card.icon} dim={!isInteractive} />
        <p className={[
          "text-sm font-semibold leading-tight",
          isInteractive ? "text-slate-100" : "text-slate-600",
        ].join(" ")}>
          {card.label}
        </p>
      </div>

      <p className={[
        "text-[11px] leading-relaxed flex-1",
        isInteractive ? "text-slate-500" : "text-slate-700",
      ].join(" ")}>
        {card.description}
      </p>

      {/* Status and call to action share one baseline so every card ends the same way. */}
      <div className="flex items-center justify-between gap-2">
        <CardBadge state={state} />
        {isInteractive && (
          <span className="text-[11px] text-slate-400 shrink-0">開く ›</span>
        )}
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
    <div className="flex items-baseline gap-3">
      <h2 className="text-sm font-bold text-slate-200 tracking-tight">{group.label}</h2>
      <span className="text-[11px] text-slate-600 hidden sm:inline">{group.description}</span>
      <div className="flex-1 h-px bg-slate-800" />
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
    <div className="flex flex-col gap-7">

      <div className="flex flex-col gap-1">
        <h1 className="text-base font-bold text-slate-100 tracking-tight">設定</h1>
        <p className="text-xs text-slate-500">店舗の運用に必要な設定をまとめています。</p>
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

            <div className="flex flex-col gap-3">
              <GroupHeader group={group} />
              {/* 1 column below 768, 2 columns to 1279, 3 columns from 1280. */}
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-2.5">
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
        <details className="rounded-xl border border-slate-800 bg-slate-900/30">
          <summary className="cursor-pointer list-none px-4 py-3 text-xs text-slate-400 hover:text-slate-200 transition-colors flex items-center gap-2">
            <span className="text-slate-600">▸</span>
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
      <div className="flex items-center gap-3 px-4 py-3 bg-slate-900/40 border border-slate-800 rounded-xl">
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
