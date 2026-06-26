"use client";

// GYEON Business Hub — Unified Settings Center Hub (Sprint 12G / updated 12H)
//
// Premium category-based settings landing page.
// Renders 7 group sections with 20 category cards derived from the
// Sprint 12F settings registry.
//
// Sprint 12G: Active categories opened settings panels in-page.
// Sprint 12H: Active (ui_available) categories now link to dedicated /settings/[category] routes.
//             The onOpenPanel prop is retained for footer backup/support panel actions.
// Future categories display a "準備中" (Coming Soon) state.
// Enterprise categories display a lock state.
//
// Visibility rules (SPOL-001 through SPOL-005):
//   - Sensitive categories hidden from staff / readonly / unknown roles
//   - Enterprise categories locked for all dealer roles
//   - Platform-admin categories never rendered here
//
// No persistence. No DB calls. No external APIs. Pure UI.
// Security: dealer_id always from server-side getCurrentDealer() in fetchers.

import Link from "next/link";
import type { CanonicalDealerSettings } from "@/lib/dealer-settings/dealer-settings-types";
import type { DealerPlanInfo }          from "@/lib/plans/plan-types";
import type { DealerStaffRole }         from "@/lib/staff/staff-types";
import type { AiSettingsView }          from "@/lib/ai/ai-settings-types";
import type { CategoryId }              from "./SettingsCategoryNav";
import {
  canViewSetting,
  resolveVisibilityFromRole,
} from "@/lib/settings";
import type { SettingsVisibilityLevel } from "@/lib/settings";

// ─── Types ────────────────────────────────────────────────────────────────────

type CardState =
  | "configured"      // Active, data present (green badge)
  | "active"          // Active, navigable (neutral badge)
  | "not_configured"  // Active, but not yet set up (amber badge)
  | "plan_required"   // Requires a higher plan
  | "coming_soon"     // Future implementation
  | "enterprise";     // Enterprise-only feature

type CardAction =
  | { kind: "panel"; panelId: CategoryId }     // Open in existing category nav panel
  | { kind: "route"; href: string }             // Navigate to dedicated page
  | { kind: "disabled" };                       // No action (future / locked)

interface HubCard {
  id:             string;
  icon:           string;
  label:          string;
  description:    string;
  minVisibility:  SettingsVisibilityLevel;
  action:         CardAction;
  getState:       (ctx: StateContext) => CardState;
}

interface HubGroup {
  id:          string;
  label:       string;
  label_ja:    string;
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

// ─── Hub group definitions ────────────────────────────────────────────────────

const HUB_GROUPS: HubGroup[] = [
  {
    id:          "core",
    label:       "Core",
    label_ja:    "店舗・基本設定",
    description: "店舗情報・スタッフ・通知・ブランディングの設定",
    cards: [
      {
        id:            "dealer",
        icon:          "🏪",
        label:         "店舗設定",
        description:   "店舗情報・業者設定・価格・施工メニュー",
        minVisibility: "staff",
        action:        { kind: "route", href: "/settings/dealer" },
        getState: ({ settings }) =>
          settings.business_name ? "configured" : "not_configured",
      },
      {
        id:            "organization",
        icon:          "🏢",
        label:         "組織設定",
        description:   "マルチ店舗・会社階層管理",
        minVisibility: "company_admin",
        action:        { kind: "disabled" },
        getState: () => "coming_soon",
      },
      {
        id:            "staff",
        icon:          "👥",
        label:         "スタッフ管理",
        description:   "スタッフプロフィール・招待・役割設定",
        minVisibility: "manager",
        action:        { kind: "route", href: "/settings/staff" },
        getState: () => "active",
      },
      {
        id:            "roles_permissions",
        icon:          "🔐",
        label:         "役割・権限",
        description:   "権限マトリックス・詳細ロール設定",
        minVisibility: "dealer_owner",
        action:        { kind: "disabled" },
        getState: () => "coming_soon",
      },
      {
        id:            "branding",
        icon:          "🎨",
        label:         "ブランディング",
        description:   "ショップロゴ・スタンプ・書類デザイン",
        minVisibility: "dealer_owner",
        action:        { kind: "route", href: "/settings/branding" },
        getState: ({ settings }) =>
          settings.logo_url ? "configured" : "not_configured",
      },
      {
        id:            "notifications",
        icon:          "🔔",
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
    id:          "ai",
    label:       "AI Platform",
    label_ja:    "AIプラットフォーム",
    description: "AIプロバイダー設定・エージェント・エンタイトルメント",
    cards: [
      {
        id:            "ai_providers",
        icon:          "🤖",
        label:         "AIプロバイダー設定",
        description:   "OpenAI・Anthropic・Gemini設定・APIキー管理（Pro+）",
        minVisibility: "dealer_owner",
        action:        { kind: "route", href: "/settings/ai" },
        getState: ({ aiSettings, planInfo }) => {
          if (planInfo.plan !== "pro_plus") return "plan_required";
          return aiSettings.enabled && aiSettings.primary_provider ? "configured" : "not_configured";
        },
      },
      {
        id:            "ai_marketplace",
        icon:          "🧠",
        label:         "AIマーケットプレイス",
        description:   "AIエージェント設定・エンタイトルメント管理",
        minVisibility: "dealer_owner",
        action:        { kind: "disabled" },
        getState: () => "coming_soon",
      },
    ],
  },

  {
    id:          "communication",
    label:       "Communication",
    label_ja:    "コミュニケーション",
    description: "LINEチャンネル・メッセージング・チャット設定",
    cards: [
      {
        id:            "communication",
        icon:          "💬",
        label:         "コミュニケーション設定",
        description:   "LINE連携・メッセージテンプレート・リッチメニュー",
        minVisibility: "manager",
        action:        { kind: "route", href: "/settings/communication" },
        getState: ({ settings }) =>
          settings.line_enabled ? "configured" : "not_configured",
      },
    ],
  },

  {
    id:          "automation",
    label:       "Automation",
    label_ja:    "オートメーション",
    description: "ワークフロー自動化・トリガー設定",
    cards: [
      {
        id:            "automation",
        icon:          "⚙️",
        label:         "オートメーション設定",
        description:   "自動化ワークフロー・トリガー・AIアクション設定",
        minVisibility: "manager",
        action:        { kind: "disabled" },
        getState: () => "coming_soon",
      },
    ],
  },

  {
    id:          "analytics",
    label:       "Analytics",
    label_ja:    "アナリティクス",
    description: "ダッシュボード・KPI・レポート設定",
    cards: [
      {
        id:            "analytics",
        icon:          "📊",
        label:         "アナリティクス設定",
        description:   "KPI表示設定・レポート期間・エクスポート形式",
        minVisibility: "manager",
        action:        { kind: "disabled" },
        getState: () => "coming_soon",
      },
    ],
  },

  {
    id:          "business",
    label:       "Business Operations",
    label_ja:    "ビジネス設定",
    description: "契約・メディア・書類処理・ポータルの設定",
    cards: [
      {
        id:            "subscription",
        icon:          "📋",
        label:         "契約・プラン",
        description:   "利用プラン・請求情報・機能一覧",
        minVisibility: "dealer_owner",
        action:        { kind: "route", href: "/settings/subscription" },
        getState: () => "configured",
      },
      {
        id:            "media",
        icon:          "🖼️",
        label:         "メディア管理",
        description:   "ストレージポリシー・保持設定・同意管理",
        minVisibility: "dealer_owner",
        action:        { kind: "disabled" },
        getState: () => "coming_soon",
      },
      {
        id:            "ocr",
        icon:          "📄",
        label:         "車検証OCR",
        description:   "OCR設定・処理ポリシー・フォーマット確認",
        minVisibility: "manager",
        action:        { kind: "route", href: "/settings/ocr" },
        getState: ({ settings }) =>
          settings.ocr_enabled ? "configured" : "active",
      },
      {
        id:            "pdf",
        icon:          "📑",
        label:         "PDF・書類",
        description:   "採番設定・書類フォーマット・税率・利用規約",
        minVisibility: "manager",
        action:        { kind: "route", href: "/settings/pdf" },
        getState: () => "configured",
      },
      {
        id:            "customer_portal",
        icon:          "👤",
        label:         "カスタマーポータル",
        description:   "顧客向けポータル設定（Sprint 15+）",
        minVisibility: "dealer_owner",
        action:        { kind: "disabled" },
        getState: () => "coming_soon",
      },
    ],
  },

  {
    id:          "enterprise",
    label:       "Enterprise Applications",
    label_ja:    "エンタープライズアプリ",
    description: "GYEON Distribution・倉庫・CRM・会計（Enterprise限定）",
    cards: [
      {
        id:            "gyeon_distribution",
        icon:          "📦",
        label:         "GYEONディストリビューション",
        description:   "製品カタログ同期・ディーラー価格・請求集計",
        minVisibility: "company_admin",
        action:        { kind: "disabled" },
        getState: () => "enterprise",
      },
      {
        id:            "warehouse",
        icon:          "🏭",
        label:         "倉庫管理",
        description:   "在庫管理・入出庫・サプライヤー設定",
        minVisibility: "company_admin",
        action:        { kind: "disabled" },
        getState: () => "enterprise",
      },
      {
        id:            "crm",
        icon:          "🎯",
        label:         "CRM設定",
        description:   "顧客セグメント・スコアリング・パイプライン管理",
        minVisibility: "company_admin",
        action:        { kind: "disabled" },
        getState: () => "enterprise",
      },
      {
        id:            "accounting",
        icon:          "💼",
        label:         "会計設定",
        description:   "会計期間・勘定科目マッピング・エクスポート設定",
        minVisibility: "company_admin",
        action:        { kind: "disabled" },
        getState: () => "enterprise",
      },
    ],
  },
];

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
        <span className="inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full bg-purple-950/30 text-purple-400 border border-purple-500/20 font-medium">
          🔒 Pro+
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
          🏢 Enterprise
        </span>
      );
  }
}

// ─── Card component ───────────────────────────────────────────────────────────

function HubCardButton({
  card,
  state,
  onOpenPanel,
}: {
  card:         HubCard;
  state:        CardState;
  onOpenPanel:  (panelId: CategoryId) => void;
}) {
  const isInteractive = card.action.kind !== "disabled" && state !== "plan_required";

  const inner = (
    <div className={[
      "flex flex-col items-start gap-3 rounded-xl p-4 text-left border h-full",
      "transition-all duration-150",
      isInteractive
        ? "bg-[#0f172a] border-slate-700 hover:border-slate-500 hover:bg-slate-800/30 cursor-pointer"
        : state === "enterprise"
          ? "bg-[#0a0f1a] border-slate-800/60 opacity-60"
          : "bg-[#0a0f1a] border-slate-800/60",
    ].join(" ")}
    >
      {/* Icon row */}
      <div className="flex items-start justify-between w-full">
        <span className={[
          "text-xl leading-none",
          !isInteractive ? "opacity-40" : "",
        ].join(" ")}>
          {card.icon}
        </span>
        {!isInteractive && state !== "enterprise" && state !== "plan_required" && (
          <span className="text-slate-700 text-xs">→</span>
        )}
        {isInteractive && card.action.kind === "route" && (
          <span className="text-slate-600 text-[10px]">↗</span>
        )}
      </div>

      {/* Labels */}
      <div className="flex flex-col gap-0.5 flex-1">
        <p className={[
          "text-sm font-semibold leading-tight",
          isInteractive ? "text-slate-100" : "text-slate-600",
        ].join(" ")}>
          {card.label}
        </p>
        <p className={[
          "text-[10px] leading-relaxed",
          isInteractive ? "text-slate-500" : "text-slate-700",
        ].join(" ")}>
          {card.description}
        </p>
      </div>

      {/* Status badge */}
      <CardBadge state={state} />
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

  // Disabled
  return <div className="h-full">{inner}</div>;
}

// ─── Group header ─────────────────────────────────────────────────────────────

function GroupHeader({ group }: { group: HubGroup }) {
  return (
    <div className="flex items-baseline gap-3">
      <h2 className="text-xs font-bold text-slate-400 uppercase tracking-wider">
        {group.label}
      </h2>
      <span className="text-xs text-slate-600 hidden sm:inline">
        {group.label_ja}
      </span>
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

  return (
    <div className="flex flex-col gap-7">

      {/* Page header */}
      <div className="flex flex-col gap-1">
        <div className="flex items-center gap-2">
          <h1 className="text-base font-bold text-slate-100 tracking-tight">
            Settings Center
          </h1>
          <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-800 text-slate-500 font-mono">
            v0.1
          </span>
        </div>
        <p className="text-xs text-slate-500">
          設定カテゴリを選択してください
        </p>
      </div>

      {/* Groups */}
      {HUB_GROUPS.map(group => {
        // Filter cards by visibility
        const visibleCards = group.cards.filter(card => {
          // Enterprise group: always show cards (they appear as locked)
          if (group.id === "enterprise") return true;
          // "company_admin" or higher min_visibility: hide completely from dealer users
          // (company_admin is above dealer_owner, so dealer owners can't see org/enterprise settings detail)
          if (card.minVisibility === "company_admin" || card.minVisibility === "platform_admin") {
            return false;
          }
          // Check visibility — unknown roles (null) default to readonly access only (SPOL-004)
          return canViewSetting(userLevel, card.minVisibility);
        });

        if (visibleCards.length === 0) return null;

        return (
          <div key={group.id} className="flex flex-col gap-3">
            <GroupHeader group={group} />

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
              {visibleCards.map(card => {
                const state = resolveState(card, ctx);
                return (
                  <HubCardButton
                    key={card.id}
                    card={card}
                    state={state}
                    onOpenPanel={onOpenPanel}
                  />
                );
              })}
            </div>
          </div>
        );
      })}

      {/* Footer */}
      <div className="flex items-center gap-3 px-4 py-3 bg-slate-900/40 border border-slate-800 rounded-xl">
        <span className="text-lg">🔧</span>
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
