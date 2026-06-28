// GYEON Business Hub — Settings Category Page View (Sprint 12I)
//
// Pure display component rendered by /settings/[category]/page.tsx.
// Accepts serialized props from the server component — no "use client" needed.
// Imports client-component panels (CompanySettingsForm, StaffManagement, etc.)
// which are hydrated on the browser; server renders the shell.
//
// Rendering branches:
//   1. canAccess=false         → SettingsAccessState (no category detail exposed)
//   2. enterprise_only status  → SettingsEnterpriseState
//   3. future/hidden status    → SettingsFutureState
//   4. visible/experimental    → full category page with embedded panel
//
// Security:
//   - Access-denied branch reveals no category names, no setting names (SPOL-004)
//   - Staff-only panels (staff management) gated by staffRole check
//   - Client-side visibility is UX only; Sprint 13 adds server enforcement
//
// Category-to-panel mapping (Sprint 12I):
//   dealer        → CompanySettingsForm (company/store settings)
//   staff         → StaffManagement (owner/manager only)
//   branding      → CompanySettingsForm (logo, stamp, colour settings)
//   notifications → ReminderContent (reminder template display)
//   communication → LineContent (LINE status + rich menu)
//   subscription  → PlanContent + SubscriptionStatusCard slot
//   ocr           → OcrContent (OCR policy read-only)
//   pdf           → PdfContent (DocumentSequenceSettings + PDF extras)
//   ai_providers  → link to dedicated /settings/ai page
//   all others    → future-state notice within the category frame
//
// No persistence. No DB calls. No "use server". Pure render.

import Link from "next/link";
import type { SettingsCategory, SettingsRegistrationEntry } from "@/lib/settings";
import {
  getSaveActionsForCategory,
  canEditWithRole,
  type SettingsSaveAction,
  type SettingsSaveActionStatus,
} from "@/lib/settings";
import type { CanonicalDealerSettings } from "@/lib/dealer-settings/dealer-settings-types";
import type { DealerStaffRole }         from "@/lib/staff/staff-types";
import type { DealerStaffDB }           from "@/lib/staff/staff-types";
import type { CompanySettingsFields }   from "@/lib/company/save-company-settings";
import type { BrandingSettings }        from "@/lib/branding/branding-types";
import type { DocumentSequenceDB }      from "@/lib/numbering/numbering-types";
import type { DealerPlanInfo }          from "@/lib/plans/plan-types";
import CompanySettingsForm              from "./CompanySettingsForm";
import BrandingSettingsForm             from "./BrandingSettingsForm";
import StaffManagement                  from "./StaffManagement";
import {
  OcrContent,
  LineContent,
  PdfContent,
  ReminderContent,
  PlanContent,
} from "./SettingsCategoryNav";

// ─── Props ────────────────────────────────────────────────────────────────────

export interface SettingsCategoryPageViewProps {
  category:        SettingsCategory;
  canAccess:       boolean;
  staffRole:       DealerStaffRole | null;
  staffId:         string | null;
  dealerSettings:  CanonicalDealerSettings | null;
  registrations:   SettingsRegistrationEntry[];
  // Category-specific data (loaded conditionally in page.tsx)
  companySettings:  CompanySettingsFields | null;
  brandingSettings: BrandingSettings | null;
  staffList:        DealerStaffDB[];
  sequences:        DocumentSequenceDB[];
  planInfo:         DealerPlanInfo | null;
  planSlot:         React.ReactNode;
}

// ─── Design tokens ────────────────────────────────────────────────────────────

const card = "bg-[#0f172a] border border-slate-800 rounded-xl p-5";

// ─── Fallback plan (used when planInfo fetch fails) ───────────────────────────

const FALLBACK_PLAN: DealerPlanInfo = {
  plan:                "basic",
  subscription_status: "active",
  started_at:          null,
  expired_at:          null,
};

// ─── Shared breadcrumb ────────────────────────────────────────────────────────

function Breadcrumb({ category }: { category?: SettingsCategory }) {
  return (
    <div className="flex items-center gap-2 text-xs">
      <Link
        href="/settings"
        className="text-slate-400 hover:text-slate-200 transition-colors"
      >
        ← 設定
      </Link>
      {category && (
        <>
          <span className="text-slate-700">/</span>
          <span className="text-slate-300">{category.display_name_ja}</span>
        </>
      )}
    </div>
  );
}

// ─── SettingsAccessState ──────────────────────────────────────────────────────

// Per SPOL-004: Access-denied state must NOT reveal the category name or
// any setting names. Only a generic message is shown.
function SettingsAccessState() {
  return (
    <div className="flex flex-col gap-5">
      <Breadcrumb />

      <div className={`${card} flex flex-col items-center gap-4 py-10 text-center`}>
        <div className="w-12 h-12 rounded-full bg-slate-800 flex items-center justify-center">
          <span className="text-2xl">🔒</span>
        </div>
        <div className="flex flex-col gap-1.5">
          <p className="text-sm font-semibold text-slate-200">
            アクセス権限がありません
          </p>
          <p className="text-xs text-slate-500 leading-relaxed max-w-xs">
            このページを表示するには適切な権限が必要です。
            店舗オーナーにご確認ください。
          </p>
        </div>
        <Link
          href="/settings"
          className="mt-2 text-xs text-blue-400 hover:text-blue-300 transition-colors"
        >
          設定トップへ戻る
        </Link>
      </div>
    </div>
  );
}

// ─── SettingsEnterpriseState ──────────────────────────────────────────────────

function SettingsEnterpriseState({ category }: { category: SettingsCategory }) {
  return (
    <div className="flex flex-col gap-5">
      <Breadcrumb category={category} />

      <div className="flex items-center gap-3">
        <span className="text-2xl">{category.icon}</span>
        <div>
          <h1 className="text-base font-bold text-slate-300">{category.display_name_ja}</h1>
          <p className="text-xs text-slate-500 mt-0.5">{category.display_name}</p>
        </div>
        <span className="ml-auto text-[10px] px-2 py-0.5 rounded-full bg-slate-800 text-slate-500 border border-slate-700">
          🏢 Enterprise
        </span>
      </div>

      <div className={`${card} flex flex-col gap-3`}>
        <p className="text-sm text-slate-400 leading-relaxed">
          {category.description}
        </p>
        <div className="pt-2 border-t border-slate-800">
          <p className="text-xs text-slate-600">
            このカテゴリはEnterprise契約でのみご利用いただけます。
            詳細はGYEON Japanまでお問い合わせください。
          </p>
        </div>
      </div>
    </div>
  );
}

// ─── SettingsFutureState ──────────────────────────────────────────────────────

function SettingsFutureState({
  category,
  registrations,
}: {
  category:      SettingsCategory;
  registrations: SettingsRegistrationEntry[];
}) {
  return (
    <div className="flex flex-col gap-5">
      <Breadcrumb category={category} />

      {/* Header */}
      <div className="flex items-center gap-3">
        <span className="text-2xl opacity-50">{category.icon}</span>
        <div>
          <h1 className="text-base font-bold text-slate-400">{category.display_name_ja}</h1>
          <p className="text-xs text-slate-600 mt-0.5">{category.display_name}</p>
        </div>
        <span className="ml-auto text-[10px] px-2 py-0.5 rounded-full bg-slate-800 text-slate-500 border border-slate-700">
          準備中
        </span>
      </div>

      {/* Coming-soon card */}
      <div className={`${card} flex flex-col gap-4`}>
        <p className="text-sm text-slate-500 leading-relaxed">
          {category.description}
        </p>
        <div className="flex items-center gap-3 px-3 py-2.5 rounded-lg bg-slate-900 border border-slate-800">
          <span className="text-base">🗓️</span>
          <div>
            <p className="text-xs font-medium text-slate-400">実装予定</p>
            <p className="text-[10px] text-slate-600 mt-0.5">{category.target_sprint}</p>
          </div>
        </div>

        {/* Registered items preview (if any) */}
        {registrations.length > 0 && (
          <div className="flex flex-col gap-2 pt-2 border-t border-slate-800">
            <p className="text-[10px] font-semibold text-slate-600 uppercase tracking-wider">
              予定している設定項目
            </p>
            <div className="flex flex-col gap-1">
              {registrations.map(reg => (
                <div
                  key={reg.item_id}
                  className="flex items-center justify-between px-3 py-2 rounded-lg bg-slate-900/40"
                >
                  <p className="text-xs text-slate-600">{reg.display_name}</p>
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-800 text-slate-600">
                    {reg.target_sprint}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Item status badge ────────────────────────────────────────────────────────

function ItemBadge({ status, requires_plan }: {
  status:        SettingsRegistrationEntry["status"];
  requires_plan: SettingsRegistrationEntry["requires_plan"];
}) {
  if (status === "visible" && !requires_plan) {
    return (
      <span className="flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded bg-emerald-950/30 text-emerald-500 border border-emerald-500/20">
        <span className="w-1 h-1 rounded-full bg-emerald-500 inline-block" />
        有効
      </span>
    );
  }
  if (status === "visible" && requires_plan) {
    return (
      <span className="text-[10px] px-1.5 py-0.5 rounded bg-purple-950/20 text-purple-500 border border-purple-500/20">
        {requires_plan === "pro_plus" ? "Pro+" : "Pro"}
      </span>
    );
  }
  if (status === "future") {
    return (
      <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-800 text-slate-600">
        準備中
      </span>
    );
  }
  if (status === "experimental") {
    return (
      <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-950/20 text-amber-500 border border-amber-500/20">
        試験中
      </span>
    );
  }
  if (status === "enterprise_only") {
    return (
      <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-800 text-slate-600">
        Enterprise
      </span>
    );
  }
  return (
    <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-800 text-slate-600">
      非表示
    </span>
  );
}

// ─── SettingsSectionList ──────────────────────────────────────────────────────

function SettingsSectionList({ registrations }: { registrations: SettingsRegistrationEntry[] }) {
  if (registrations.length === 0) {
    return (
      <p className="text-xs text-slate-600 italic px-1">
        このカテゴリには設定項目が登録されていません。
      </p>
    );
  }

  const sectionMap = new Map<string, SettingsRegistrationEntry[]>();
  for (const reg of registrations) {
    const parts  = reg.item_id.split(".");
    const secKey = parts.length >= 2 ? `${parts[0]}.${parts[1]}` : parts[0];
    if (!sectionMap.has(secKey)) sectionMap.set(secKey, []);
    sectionMap.get(secKey)!.push(reg);
  }

  const toLabel = (key: string) =>
    key.split(".").pop()!
      .replace(/_/g, " ")
      .replace(/\b\w/g, c => c.toUpperCase());

  return (
    <div className="flex flex-col gap-3">
      {Array.from(sectionMap.entries()).map(([sectionKey, items]) => (
        <div key={sectionKey} className="flex flex-col gap-1">
          <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider px-1">
            {toLabel(sectionKey)}
          </p>
          <div className="border border-slate-800 rounded-xl overflow-hidden">
            {items.map((item, idx) => (
              <div
                key={item.item_id}
                className={[
                  "flex items-center justify-between px-4 py-2.5",
                  idx < items.length - 1 ? "border-b border-slate-800/60" : "",
                ].join(" ")}
              >
                <div className="flex flex-col gap-0.5">
                  <p className="text-xs text-slate-300">{item.display_name}</p>
                  {item.db_path && (
                    <p className="text-[10px] text-slate-700 font-mono">{item.db_path}</p>
                  )}
                </div>
                <ItemBadge status={item.status} requires_plan={item.requires_plan} />
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

// ─── Status chip for category header ─────────────────────────────────────────

function CategoryStatusChip({ status }: { status: SettingsCategory["status"] }) {
  switch (status) {
    case "visible":
      return (
        <span className="flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full bg-emerald-950/30 text-emerald-400 border border-emerald-500/20">
          <span className="w-1 h-1 rounded-full bg-emerald-400" />
          有効
        </span>
      );
    case "experimental":
      return (
        <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-950/20 text-amber-400 border border-amber-500/20">
          試験中
        </span>
      );
    default:
      return (
        <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-800 text-slate-500 border border-slate-700">
          準備中
        </span>
      );
  }
}

// ─── SettingsCategoryHeader ───────────────────────────────────────────────────

function SettingsCategoryHeader({ category, staffRole }: {
  category:  SettingsCategory;
  staffRole: DealerStaffRole | null;
}) {
  const visLabel: Record<string, string> = {
    readonly:      "読み取り専用",
    staff:         "スタッフ",
    manager:       "マネージャー",
    dealer_owner:  "オーナー",
    company_admin: "会社管理者",
    platform_admin:"管理者",
  };

  return (
    <div className={`${card} flex flex-col gap-4`}>
      {/* Title row */}
      <div className="flex items-start gap-3">
        <span className="text-2xl leading-none mt-0.5">{category.icon}</span>
        <div className="flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="text-base font-bold text-slate-100">{category.display_name_ja}</h1>
            <span className="text-xs text-slate-500">{category.display_name}</span>
            <CategoryStatusChip status={category.status} />
          </div>
          <p className="text-xs text-slate-500 mt-1.5 leading-relaxed">
            {category.description.split(".")[0]}.
          </p>
        </div>
      </div>

      {/* Metadata row */}
      <div className="flex flex-wrap gap-4 pt-3 border-t border-slate-800">
        <div className="flex flex-col gap-0.5">
          <p className="text-[10px] text-slate-600 uppercase tracking-wider">最低権限</p>
          <p className="text-xs text-slate-400">{visLabel[category.min_visibility] ?? category.min_visibility}</p>
        </div>
        {category.requires_plan && (
          <div className="flex flex-col gap-0.5">
            <p className="text-[10px] text-slate-600 uppercase tracking-wider">プラン</p>
            <p className="text-xs text-purple-400 font-medium">
              {category.requires_plan === "pro_plus" ? "Pro+" : category.requires_plan === "pro" ? "Pro" : "Basic"}
            </p>
          </div>
        )}
        <div className="flex flex-col gap-0.5">
          <p className="text-[10px] text-slate-600 uppercase tracking-wider">モジュール</p>
          <p className="text-xs text-slate-400 font-mono text-[11px]">{category.module_owner}</p>
        </div>
        {staffRole && (
          <div className="flex flex-col gap-0.5">
            <p className="text-[10px] text-slate-600 uppercase tracking-wider">あなたの権限</p>
            <p className="text-xs text-blue-400">{visLabel[
              staffRole === "owner" ? "dealer_owner"
              : staffRole === "manager" ? "manager"
              : staffRole === "staff" ? "staff"
              : "readonly"
            ]}</p>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── DataLoadError ────────────────────────────────────────────────────────────

function DataLoadError() {
  return (
    <div className="px-4 py-3 rounded-xl bg-red-950/20 border border-red-500/20">
      <p className="text-xs text-red-400">
        設定データの読み込みに失敗しました。ページを更新してください。
      </p>
    </div>
  );
}

// ─── RoleRestrictedNotice ─────────────────────────────────────────────────────

// Shown when the current user's role is insufficient to edit this settings section.
// Still provides visibility into what the settings contain by prompting the user
// to contact their owner/manager. Server-side enforcement is Sprint 13+.
function RoleRestrictedNotice() {
  return (
    <div className={`${card} flex items-start gap-4`}>
      <div className="mt-0.5 w-8 h-8 rounded-full bg-slate-800 flex items-center justify-center shrink-0">
        <span className="text-base">🔐</span>
      </div>
      <div className="flex flex-col gap-1.5">
        <p className="text-sm font-medium text-slate-300">編集権限が必要です</p>
        <p className="text-xs text-slate-500 leading-relaxed">
          この設定を変更するにはマネージャー権限以上が必要です。
          店舗オーナーまたはマネージャーにご確認ください。
        </p>
        <p className="text-[10px] text-slate-700 mt-1">
          サーバー側の権限チェック: Sprint 13 実装予定
        </p>
      </div>
    </div>
  );
}

// ─── SaveActionsPanel (Phase E) ───────────────────────────────────────────────

// Displays the save action registry entries for this category — shows which
// settings sections are writable, read-only, or future, and flags any missing
// server-side role checks for transparency.
function SaveActionsPanel({ actions }: { actions: SettingsSaveAction[] }) {
  if (actions.length === 0) return null;

  const statusStyle: Record<SettingsSaveActionStatus, string> = {
    writable_now:                 "bg-emerald-950/30 text-emerald-400 border-emerald-500/20",
    read_only:                    "bg-slate-800 text-slate-500 border-slate-700",
    future:                       "bg-slate-800 text-slate-600 border-slate-700",
    requires_migration:           "bg-amber-950/20 text-amber-500 border-amber-500/20",
    requires_admin:               "bg-purple-950/20 text-purple-400 border-purple-500/20",
    external_integration_required:"bg-blue-950/20 text-blue-400 border-blue-500/20",
  };

  const statusLabel: Record<SettingsSaveActionStatus, string> = {
    writable_now:                 "保存可能",
    read_only:                    "読み取り専用",
    future:                       "準備中",
    requires_migration:           "移行作業必要",
    requires_admin:               "管理者専用",
    external_integration_required:"外部設定必要",
  };

  return (
    <div className="flex flex-col gap-2">
      <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider">
        設定保存ステータス
      </p>
      {actions.map(action => (
        <div
          key={action.action_id}
          className="flex items-center justify-between px-3 py-2 rounded-lg bg-slate-900/40 border border-slate-800/60"
        >
          <div className="flex flex-col gap-0.5">
            <p className="text-xs text-slate-300">{action.display_name}</p>
            {!action.has_server_role_check && action.status === "writable_now" && (
              <p className="text-[10px] text-amber-500/60">
                ⚠ サーバー権限チェック: Sprint 13 実装予定
              </p>
            )}
          </div>
          <span
            className={`shrink-0 text-[10px] px-2 py-0.5 rounded-full border ${statusStyle[action.status]}`}
          >
            {statusLabel[action.status]}
          </span>
        </div>
      ))}
    </div>
  );
}

// ─── AiProvidersLink ──────────────────────────────────────────────────────────

function AiProvidersLink() {
  return (
    <div className={`${card} flex items-center justify-between gap-4`}>
      <div>
        <p className="text-sm font-medium text-slate-200">AI プロバイダー設定</p>
        <p className="text-xs text-slate-500 mt-1 leading-relaxed">
          AIゲートウェイ・APIキー・プロバイダー接続の詳細設定は専用ページで管理します。
        </p>
      </div>
      <Link
        href="/settings/ai"
        className="shrink-0 px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-medium transition-colors"
      >
        AI設定を開く →
      </Link>
    </div>
  );
}

// ─── CategoryDetailPanel ──────────────────────────────────────────────────────

// Routes each active category to its appropriate settings panel.
// Applies UI-level role gating where the underlying server action lacks a role
// check (documented per-action in save-action-registry.ts — Sprint 13 enforces
// server-side for those gaps).
function CategoryDetailPanel({
  category,
  staffRole,
  registrations,
  dealerSettings,
  companySettings,
  brandingSettings,
  staffList,
  sequences,
  planInfo,
  planSlot,
}: {
  category:         SettingsCategory;
  staffRole:        DealerStaffRole | null;
  registrations:    SettingsRegistrationEntry[];
  dealerSettings:   CanonicalDealerSettings | null;
  companySettings:  CompanySettingsFields | null;
  brandingSettings: BrandingSettings | null;
  staffList:        DealerStaffDB[];
  sequences:        DocumentSequenceDB[];
  planInfo:         DealerPlanInfo | null;
  planSlot:         React.ReactNode;
}) {
  switch (category.category_id) {

    // ── 店舗設定 ─────────────────────────────────────────────────────────────
    // UI gate: manager+ required (server action lacks role check — Sprint 13)
    case "dealer":
      if (!canEditWithRole(staffRole, "manager_or_owner")) {
        return <RoleRestrictedNotice />;
      }
      return <CompanySettingsForm initialSettings={companySettings} />;

    // ── スタッフ管理 ─────────────────────────────────────────────────────────
    // Server actions (inviteStaff, updateStaffRole, disableStaff) enforce role
    // via requireRole() — no UI gate needed beyond usability.
    case "staff":
      if (staffRole !== "owner" && staffRole !== "manager") {
        return (
          <div className={`${card} flex flex-col items-center gap-3 py-8 text-center`}>
            <span className="text-2xl">👤</span>
            <p className="text-sm text-slate-400">スタッフ管理にはマネージャー権限以上が必要です</p>
          </div>
        );
      }
      return (
        <StaffManagement
          initialStaff={staffList}
          currentRole={staffRole}
        />
      );

    // ── ブランディング ────────────────────────────────────────────────────────
    // Branding manages ONLY logo / stamp / colours / customer-app theme.
    // Store-profile fields live in the separate 店舗設定 (dealer) form.
    // saveBrandingSettings enforces role via requireRole(["owner","manager"]).
    case "branding":
      if (!canEditWithRole(staffRole, "manager_or_owner")) {
        return <RoleRestrictedNotice />;
      }
      return <BrandingSettingsForm initial={brandingSettings} />;

    // ── メンテナンス通知 ──────────────────────────────────────────────────────
    // Read-only display — reminder templates are PHASE70 future-edit.
    case "notifications":
      return dealerSettings
        ? <ReminderContent s={dealerSettings} />
        : <DataLoadError />;

    // ── LINE / コミュニケーション ──────────────────────────────────────────────
    // LineContent is mostly read-only (connection status + PHASE70 message display).
    // Embedded LineRichMenuSettings has its own Pro+ gate for the editable section.
    case "communication":
      if (!dealerSettings) return <DataLoadError />;
      return (
        <LineContent
          s={dealerSettings}
          planInfo={planInfo ?? FALLBACK_PLAN}
        />
      );

    // ── 契約・プラン ──────────────────────────────────────────────────────────
    // Read-only display of plan status and feature table.
    case "subscription":
      return (
        <PlanContent
          planInfo={planInfo ?? FALLBACK_PLAN}
          planSlot={planSlot}
        />
      );

    // ── 車検証OCR ─────────────────────────────────────────────────────────────
    // Read-only policy display (OCR enable/disable is PHASE70).
    case "ocr":
      return dealerSettings
        ? <OcrContent s={dealerSettings} />
        : <DataLoadError />;

    // ── PDF・書類番号 ─────────────────────────────────────────────────────────
    // UI gate: manager+ required. updateDocumentSequence lacks server role check.
    case "pdf":
      if (!dealerSettings) return <DataLoadError />;
      if (!canEditWithRole(staffRole, "manager_or_owner")) {
        return <RoleRestrictedNotice />;
      }
      return <PdfContent sequences={sequences} s={dealerSettings} />;

    // ── AIプロバイダー ────────────────────────────────────────────────────────
    // saveAiSettings is Pro+ gated + encrypted. Managed via /settings/ai.
    case "ai_providers":
      return <AiProvidersLink />;

    // ── その他（未実装 / 将来対応）────────────────────────────────────────────
    default: {
      const hasItems = registrations.some(r => r.status === "visible");
      return (
        <div className="flex flex-col gap-4">
          {hasItems && registrations.length > 0 && (
            <SettingsSectionList registrations={registrations} />
          )}
          <div className="flex items-center gap-3 px-4 py-3 bg-slate-900/40 border border-slate-800 rounded-xl">
            <span className="text-slate-600">🗓️</span>
            <p className="text-xs text-slate-600">
              この設定カテゴリのフォーム実装は {category.target_sprint} を予定しています。
            </p>
          </div>
        </div>
      );
    }
  }
}

// ─── ActiveCategoryContent ────────────────────────────────────────────────────

function ActiveCategoryContent({
  category,
  staffRole,
  registrations,
  dealerSettings,
  companySettings,
  brandingSettings,
  staffList,
  sequences,
  planInfo,
  planSlot,
}: {
  category:         SettingsCategory;
  staffRole:        DealerStaffRole | null;
  registrations:    SettingsRegistrationEntry[];
  dealerSettings:   CanonicalDealerSettings | null;
  companySettings:  CompanySettingsFields | null;
  brandingSettings: BrandingSettings | null;
  staffList:        DealerStaffDB[];
  sequences:        DocumentSequenceDB[];
  planInfo:         DealerPlanInfo | null;
  planSlot:         React.ReactNode;
}) {
  const saveActions = getSaveActionsForCategory(category.category_id);

  return (
    <div className="flex flex-col gap-5">
      <SettingsCategoryHeader category={category} staffRole={staffRole} />

      {/* Phase E — Save action status (registry-driven) */}
      {saveActions.length > 0 && (
        <SaveActionsPanel actions={saveActions} />
      )}

      {/* Phase D — Actual panel content (role-gated where required) */}
      <CategoryDetailPanel
        category={category}
        staffRole={staffRole}
        registrations={registrations}
        dealerSettings={dealerSettings}
        companySettings={companySettings}
        brandingSettings={brandingSettings}
        staffList={staffList}
        sequences={sequences}
        planInfo={planInfo}
        planSlot={planSlot}
      />
    </div>
  );
}

// ─── Main export ──────────────────────────────────────────────────────────────

export default function SettingsCategoryPageView({
  category,
  canAccess,
  staffRole,
  staffId: _staffId,
  dealerSettings,
  registrations,
  companySettings,
  brandingSettings,
  staffList,
  sequences,
  planInfo,
  planSlot,
}: SettingsCategoryPageViewProps) {
  // SPOL-004: access-denied state reveals no category details
  if (!canAccess) {
    return <SettingsAccessState />;
  }

  // Enterprise-locked categories
  if (category.status === "enterprise_only") {
    return (
      <div className="flex flex-col gap-5">
        <Breadcrumb category={category} />
        <SettingsEnterpriseState category={category} />
      </div>
    );
  }

  // Future categories (status = "future" or ui_available = false)
  if (category.status === "future" || !category.ui_available) {
    return (
      <div className="flex flex-col gap-5">
        <Breadcrumb category={category} />
        <SettingsFutureState category={category} registrations={registrations} />
      </div>
    );
  }

  // Active / visible / experimental categories
  return (
    <div className="flex flex-col gap-5">
      <Breadcrumb category={category} />
      <ActiveCategoryContent
        category={category}
        staffRole={staffRole}
        registrations={registrations}
        dealerSettings={dealerSettings}
        companySettings={companySettings}
        brandingSettings={brandingSettings}
        staffList={staffList}
        sequences={sequences}
        planInfo={planInfo}
        planSlot={planSlot}
      />
    </div>
  );
}
