"use client";

// DealerOS — Settings Category Icon Navigation (PHASE72)
// Replaces the long single-page layout with a category card grid.
// Each card navigates to a focused category view with a back button.

import { useState } from "react";
import type { CanonicalDealerSettings } from "@/lib/dealer-settings/dealer-settings-types";
import CompanySettingsForm from "./CompanySettingsForm";
import StaffManagement from "./StaffManagement";
import DocumentSequenceSettings from "./DocumentSequenceSettings";
import type { CompanySettingsFields } from "@/lib/company/save-company-settings";
import type { DocumentSequenceDB } from "@/lib/numbering/numbering-types";
import { PLAN_FEATURES, planLabel, type DealerPlanInfo } from "@/lib/plans/plan-types";
import type { DealerStaffDB, DealerStaffRole } from "@/lib/staff/staff-types";
import Link from "next/link";

// ─── Props ────────────────────────────────────────────────────────────────────

interface Props {
  settings:        CanonicalDealerSettings;
  companySettings: CompanySettingsFields | null;
  sequences:       DocumentSequenceDB[];
  planInfo:        DealerPlanInfo;
  staffList:       DealerStaffDB[];
  staffInfo:       { role: DealerStaffRole; staffId: string | null } | null;
  planSlot:        React.ReactNode;  // SubscriptionStatusCard (server component)
}

// ─── Category definitions ─────────────────────────────────────────────────────

type CategoryId =
  | "store" | "trade" | "pricing" | "service" | "ocr"
  | "line" | "pdf" | "reminder" | "plan" | "backup" | "support";

type BadgeType = "設定済み" | "表示のみ" | "準備中";

interface Category {
  id:    CategoryId;
  label: string;
  icon:  string;
  desc:  string;
}

const CATEGORIES: Category[] = [
  { id: "store",   label: "店舗・スタッフ",   icon: "🏪", desc: "基本情報・ランク・スタッフ"  },
  { id: "trade",   label: "業者・掛け売り",   icon: "🤝", desc: "掛け率・締め日・支払日"      },
  { id: "pricing", label: "価格・割引",        icon: "💰", desc: "クーポン・値引きプリセット"   },
  { id: "service", label: "施工メニュー",      icon: "🔧", desc: "各施工グループの価格設定"    },
  { id: "ocr",     label: "車検証OCR",         icon: "📄", desc: "OCR設定・ポリシー確認"       },
  { id: "line",    label: "LINE連携",           icon: "💬", desc: "接続状態・メッセージ設定"    },
  { id: "pdf",     label: "PDF・書類",          icon: "📋", desc: "採番・書類フォーマット設定"  },
  { id: "reminder",label: "リマインダー",      icon: "🔔", desc: "メンテナンス通知テンプレート" },
  { id: "plan",    label: "契約・プラン",       icon: "📊", desc: "プラン・利用機能確認"        },
  { id: "backup",  label: "バックアップ・復旧", icon: "💾", desc: "DR ステータス確認"           },
  { id: "support", label: "データ・サポート",  icon: "🛠", desc: "エクスポート・お問い合わせ"  },
];

// ─── Design tokens ────────────────────────────────────────────────────────────

const card  = "bg-[#0f172a] border border-slate-800 rounded-xl p-5 flex flex-col gap-4";
const lbl   = "text-[10px] font-semibold text-slate-500 uppercase tracking-wider";
const grid2 = "grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-3";

// ─── Atoms ────────────────────────────────────────────────────────────────────

function StatusBadge({ type }: { type: BadgeType }) {
  if (type === "設定済み") return (
    <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-950/40 text-emerald-400 border border-emerald-500/30">設定済み</span>
  );
  if (type === "準備中") return (
    <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-950/30 text-amber-400 border border-amber-500/20">準備中</span>
  );
  return (
    <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-800 text-slate-500">表示のみ</span>
  );
}

function NextPhaseBadge() {
  return <span className="text-[10px] px-2 py-0.5 rounded bg-slate-800 text-slate-500">保存機能は次フェーズ</span>;
}

function ReadField({ title, value }: { title: string; value: string | number | null | undefined }) {
  const display = (value !== null && value !== undefined && String(value).trim() !== "")
    ? String(value) : "—";
  return (
    <div className="flex flex-col gap-0.5">
      <p className="text-[10px] text-slate-500">{title}</p>
      <p className="text-sm text-slate-300">{display}</p>
    </div>
  );
}

function BoolPill({ value, trueLabel = "有効", falseLabel = "無効" }: { value: boolean; trueLabel?: string; falseLabel?: string }) {
  return value ? (
    <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-emerald-950/40 text-emerald-400 border border-emerald-500/30">{trueLabel}</span>
  ) : (
    <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-slate-800 text-slate-500">{falseLabel}</span>
  );
}

function FixedChip({ label }: { label: string }) {
  return <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-blue-950/30 text-blue-400 border border-blue-500/20">{label}</span>;
}

function LockChip({ label }: { label: string }) {
  return <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-amber-950/30 text-amber-400 border border-amber-500/20">{label}</span>;
}

// ─── Badge resolver ───────────────────────────────────────────────────────────

function getBadge(id: CategoryId, s: CanonicalDealerSettings): BadgeType {
  switch (id) {
    case "store":   return s.business_name ? "設定済み" : "表示のみ";
    case "trade":   return "表示のみ";
    case "pricing": return "表示のみ";
    case "service": return "表示のみ";
    case "ocr":     return "表示のみ";
    case "line":    return s.line_enabled ? "設定済み" : "表示のみ";
    case "pdf":     return "表示のみ";
    case "reminder":return "表示のみ";
    case "plan":    return "設定済み";
    case "backup":  return "準備中";
    case "support": return "準備中";
  }
}

// ─── Section: 店舗・スタッフ ──────────────────────────────────────────────────

function StoreContent({ s, companySettings, staffList, staffInfo }: {
  s: CanonicalDealerSettings;
  companySettings: CompanySettingsFields | null;
  staffList: DealerStaffDB[];
  staffInfo: Props["staffInfo"];
}) {
  const rankLabel = s.detailer_rank === "certified" ? "⭐ Certified Detailer" : "🔵 Detailer";
  return (
    <div className="flex flex-col gap-5">
      {/* Company settings — working save */}
      <CompanySettingsForm initialSettings={companySettings} />

      {/* PHASE70 store additions */}
      <div className={card}>
        <div className="flex items-center gap-2">
          <p className={lbl}>詳細設定（PHASE70）</p>
          <NextPhaseBadge />
        </div>
        <div className={grid2}>
          <div className="flex flex-col gap-0.5">
            <p className="text-[10px] text-slate-500">Detailerランク</p>
            <p className="text-sm text-slate-300">{rankLabel}</p>
            <p className="text-[10px] text-slate-600 mt-0.5">EstimateWizardのコーティング表示に使用</p>
          </div>
          <ReadField title="電話番号（予備）" value={s.business_phone_alt} />
        </div>
        <ReadField title="振込先口座" value={s.bank_account} />
      </div>

      {/* Staff management — working */}
      {(staffInfo?.role === "owner" || staffInfo?.role === "manager") && (
        <div className="flex flex-col gap-3">
          <p className="text-sm font-semibold text-slate-100">スタッフ管理</p>
          <StaffManagement initialStaff={staffList} currentRole={staffInfo.role} />
        </div>
      )}
    </div>
  );
}

// ─── Section: 業者・掛け売り ──────────────────────────────────────────────────

function TradeContent({ s }: { s: CanonicalDealerSettings }) {
  return (
    <div className={card}>
      <div className="flex items-center gap-2">
        <p className={lbl}>業販デフォルト</p>
        <NextPhaseBadge />
      </div>
      <div className="flex flex-col gap-1">
        <p className="text-[10px] text-slate-500">デフォルト掛け率</p>
        <p className="text-3xl font-bold text-slate-100">
          {s.default_dealer_rate_percent}
          <span className="text-sm font-normal text-slate-400 ml-1">%</span>
        </p>
        <p className="text-[10px] text-slate-600">EstimateWizard 業者設定の初期値</p>
      </div>
      <div className={grid2}>
        <ReadField title="締め日" value={s.dealer_closing_day ? `毎月 ${s.dealer_closing_day} 日` : null} />
        <ReadField title="支払日" value={s.dealer_payment_day ? `翌 ${s.dealer_payment_day} 日` : null} />
      </div>
    </div>
  );
}

// ─── Section: 価格・割引 ──────────────────────────────────────────────────────

function PricingContent({ s }: { s: CanonicalDealerSettings }) {
  return (
    <div className="flex flex-col gap-4">
      <div className={card}>
        <div className="flex items-center gap-2">
          <p className={lbl}>クーポン設定（5枠固定）</p>
          <NextPhaseBadge />
        </div>
        <div className="border border-slate-800 rounded-lg overflow-hidden">
          {s.coupon_settings.map((c, i) => (
            <div key={i} className="flex items-center justify-between px-4 py-2.5 border-b border-slate-800/60 last:border-b-0">
              <span className="text-sm text-slate-300">{c.name || "（未設定）"}</span>
              <span className="text-sm font-medium text-blue-400">−{c.amount.toLocaleString("ja-JP")}円</span>
            </div>
          ))}
        </div>
        <p className="text-[10px] text-slate-600">名称と金額のみ変更可。枠の追加・削除は不可。</p>
      </div>

      <div className={card}>
        <div className="flex items-center gap-2">
          <p className={lbl}>値引きプリセット</p>
          <NextPhaseBadge />
        </div>
        {s.discount_presets.length === 0 ? (
          <p className="text-xs text-slate-600">プリセット未設定</p>
        ) : (
          <div className="border border-slate-800 rounded-lg overflow-hidden">
            {s.discount_presets.map((d, i) => (
              <div key={i} className="flex items-center justify-between px-4 py-2.5 border-b border-slate-800/60 last:border-b-0">
                <span className="text-sm text-slate-300">{d.name}</span>
                <span className="text-sm text-slate-400">{d.discount_type === "fixed" ? `${d.value.toLocaleString()}円引` : `${d.value}%引`}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Section: 施工メニュー ────────────────────────────────────────────────────

function ServiceContent({ s }: { s: CanonicalDealerSettings }) {
  const sp  = s.service_price_settings;
  const ppf = s.ppf_price_tables;

  const serviceCards = [
    {
      id: "coating",
      label: "ボディコーティング",
      icon: "✨",
      summary: `${sp.coating.products.filter(p => p.active).length} 商品`,
      detail: (
        <div className="border border-slate-800 rounded-lg overflow-hidden mt-2">
          <div className="grid grid-cols-3 px-3 py-1.5 bg-slate-800/40 text-[10px] text-slate-500">
            <span>商品名</span><span>グレード</span><span className="text-right">M基準価格</span>
          </div>
          {sp.coating.products.filter(p => p.active).map(p => (
            <div key={p.id} className="grid grid-cols-3 px-3 py-2 border-t border-slate-800/40 text-xs">
              <span className="text-slate-300">{p.name}</span>
              <span className="text-slate-500">{p.grade}</span>
              <span className="text-right text-blue-400">¥{p.base_price_m.toLocaleString()}</span>
            </div>
          ))}
        </div>
      ),
    },
    {
      id: "ppf",
      label: "PPF施工",
      icon: "🛡",
      summary: Object.keys(sp.ppf.plan_labels).map(k => sp.ppf.plan_labels[k]).join(" / "),
      detail: (
        <div className="flex flex-wrap gap-2 mt-2">
          {Object.entries(sp.ppf.plan_labels).map(([k, v]) => (
            <span key={k} className="text-xs px-2 py-0.5 rounded bg-slate-800 text-slate-400">{v}</span>
          ))}
          <p className="w-full text-[10px] text-slate-600 mt-1">詳細価格は「PPF価格テーブル」を参照</p>
        </div>
      ),
    },
    {
      id: "window",
      label: "ウィンドウフィルム",
      icon: "🪟",
      summary: `${Object.keys(sp.window_film.base_prices).length} 部位`,
      detail: (
        <div className="border border-slate-800 rounded-lg overflow-hidden mt-2">
          {Object.entries(sp.window_film.base_prices).map(([k, v]) => (
            <div key={k} className="flex justify-between px-3 py-2 border-b border-slate-800/40 last:border-b-0 text-xs">
              <span className="text-slate-400">{k}</span>
              <span className="text-blue-400">¥{(v as number).toLocaleString()}</span>
            </div>
          ))}
        </div>
      ),
    },
    {
      id: "maintenance",
      label: "定期メンテナンス",
      icon: "🔩",
      summary: `${sp.maintenance.menus.length} 枠固定`,
      detail: (
        <div className="border border-slate-800 rounded-lg overflow-hidden mt-2">
          {sp.maintenance.menus.map(m => (
            <div key={m.id} className="flex justify-between px-3 py-2 border-b border-slate-800/40 last:border-b-0 text-xs">
              <span className="text-slate-400">[{m.id}] {m.name || "未設定"}</span>
              <span className="text-blue-400">¥{m.price.toLocaleString()}</span>
            </div>
          ))}
        </div>
      ),
    },
    {
      id: "carwash",
      label: "メンテナンス洗車",
      icon: "🚿",
      summary: `${sp.carwash.menus.length} メニュー`,
      detail: (
        <div className="border border-slate-800 rounded-lg overflow-hidden mt-2">
          {sp.carwash.menus.map(m => (
            <div key={m.id} className="flex justify-between px-3 py-2 border-b border-slate-800/40 last:border-b-0 text-xs">
              <span className="text-slate-400">{m.name}</span>
              <span className="text-blue-400">¥{m.price.toLocaleString()}</span>
            </div>
          ))}
        </div>
      ),
    },
    {
      id: "roomclean",
      label: "ルームクリーニング",
      icon: "🧹",
      summary: `${Object.keys(sp.room_cleaning.base_prices).length} 部位`,
      detail: (
        <div className="border border-slate-800 rounded-lg overflow-hidden mt-2">
          {Object.entries(sp.room_cleaning.base_prices).map(([k, v]) => (
            <div key={k} className="flex justify-between px-3 py-2 border-b border-slate-800/40 last:border-b-0 text-xs">
              <span className="text-slate-400">{k}</span>
              <span className="text-blue-400">¥{(v as number).toLocaleString()}</span>
            </div>
          ))}
        </div>
      ),
    },
  ];

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-2">
        <NextPhaseBadge />
        <span className="text-[10px] text-slate-600">PHASE70 マイグレーション適用後に編集可能になります</span>
      </div>

      {serviceCards.map(sc => (
        <details key={sc.id} className={`${card} group`}>
          <summary className="flex items-center justify-between cursor-pointer list-none">
            <div className="flex items-center gap-3">
              <span className="text-xl">{sc.icon}</span>
              <div>
                <p className="text-sm font-semibold text-slate-200">{sc.label}</p>
                <p className="text-[10px] text-slate-500 mt-0.5">{sc.summary}</p>
              </div>
            </div>
            <span className="text-slate-600 text-xs transition-transform group-open:rotate-180">▼</span>
          </summary>
          {sc.detail}
        </details>
      ))}

      {/* PPF price tables — separate card */}
      <details className={`${card} group`}>
        <summary className="flex items-center justify-between cursor-pointer list-none">
          <div className="flex items-center gap-3">
            <span className="text-xl">📐</span>
            <div>
              <p className="text-sm font-semibold text-slate-200">PPF価格テーブル</p>
              <p className="text-[10px] text-slate-500 mt-0.5">フィルム係数・車両ランク係数・フロントガラス・部位単品</p>
            </div>
          </div>
          <span className="text-slate-600 text-xs transition-transform group-open:rotate-180">▼</span>
        </summary>
        <div className="flex flex-col gap-3 mt-2">
          <div>
            <p className="text-[10px] text-slate-600 mb-1.5">フィルム係数</p>
            <div className="flex flex-wrap gap-2">
              {Object.entries(ppf.film_coeff).map(([k, v]) => (
                <span key={k} className="text-xs px-2 py-0.5 rounded bg-slate-800 text-slate-300">{k} × {v}</span>
              ))}
            </div>
          </div>
          <div>
            <p className="text-[10px] text-slate-600 mb-1.5">車両ランク係数</p>
            <div className="flex flex-wrap gap-2">
              {Object.entries(ppf.rank_coeff).map(([k, v]) => (
                <span key={k} className="text-xs px-2 py-0.5 rounded bg-slate-800 text-slate-300">{k} × {v}</span>
              ))}
            </div>
          </div>
          <div>
            <p className="text-[10px] text-slate-600 mb-1.5">フロントガラス</p>
            <div className="flex gap-4">
              {Object.entries(ppf.glass_prices).map(([k, v]) => (
                <span key={k} className="text-xs text-slate-300">{k}: <span className="text-blue-400">¥{(v as number).toLocaleString()}</span></span>
              ))}
            </div>
          </div>
          <p className="text-[10px] text-slate-600">
            プラン価格: {Object.keys(ppf.plan_prices).length} エントリ ／ 部位単品: {Object.keys(ppf.parts_prices).length} パーツ
          </p>
        </div>
      </details>
    </div>
  );
}

// ─── Section: 車検証OCR ───────────────────────────────────────────────────────

function OcrContent({ s }: { s: CanonicalDealerSettings }) {
  const rows: Array<{ label: string; node: React.ReactNode }> = [
    { label: "OCR機能",       node: <BoolPill value={s.ocr_enabled} /> },
    { label: "OCRエンジン",    node: <FixedChip label="GPT-4o mini" /> },
    { label: "ストレージ",     node: <FixedChip label="プライベートストレージ" /> },
    { label: "保存期間",       node: <FixedChip label="永久保存" /> },
    { label: "人間確認必須",  node: <LockChip label="常時必須（変更不可）" /> },
    { label: "手入力常時可能", node: <LockChip label="常時有効（変更不可）" /> },
  ];
  return (
    <div className={card}>
      <div className="flex items-center gap-2">
        <p className={lbl}>OCR設定</p>
        <NextPhaseBadge />
      </div>
      <div className="flex flex-col gap-3">
        {rows.map(({ label, node }) => (
          <div key={label} className="flex items-center justify-between">
            <p className="text-xs text-slate-400">{label}</p>
            {node}
          </div>
        ))}
      </div>
      <p className="text-[10px] text-slate-600 border-t border-slate-800 pt-3">
        「人間確認必須」と「手入力常時可能」はシステム固定値です。変更できません。
      </p>
    </div>
  );
}

// ─── Section: LINE連携 ───────────────────────────────────────────────────────
// SECURITY: line_channel_secret and line_access_token are excluded from
// CanonicalDealerSettings by getCanonicalDealerSettings() and are never
// displayed here.

function LineContent({ s }: { s: CanonicalDealerSettings }) {
  return (
    <div className="flex flex-col gap-4">
      <div className={card}>
        <div className="flex items-center justify-between">
          <p className={lbl}>接続状態</p>
          <BoolPill value={s.line_enabled} trueLabel="連携有効" falseLabel="連携無効" />
        </div>
        <div className={grid2}>
          <ReadField title="LIFF ID" value={s.line_liff_id} />
          <ReadField title="Webhook URL" value={s.webhook_url ? "設定済み" : null} />
          <ReadField title="友だち追加QRコードURL" value={s.friend_add_qr_url} />
        </div>
      </div>

      <div className={card}>
        <div className="flex items-center gap-2">
          <p className={lbl}>メッセージ設定（PHASE70）</p>
          <NextPhaseBadge />
        </div>
        <div className="flex flex-col gap-3">
          <div className="flex flex-col gap-0.5">
            <p className="text-[10px] text-slate-500">見積転送・冒頭文</p>
            <p className="text-xs text-slate-400 bg-slate-900 rounded px-2 py-2 min-h-[2.5rem]">
              {s.line_message_header ?? <span className="text-slate-600">未設定</span>}
            </p>
          </div>
          <div className="flex flex-col gap-0.5">
            <p className="text-[10px] text-slate-500">見積転送・末尾文</p>
            <p className="text-xs text-slate-400 bg-slate-900 rounded px-2 py-2 min-h-[2.5rem]">
              {s.line_message_footer ?? <span className="text-slate-600">未設定</span>}
            </p>
          </div>
          <div className="flex flex-col gap-0.5">
            <p className="text-[10px] text-slate-500">メンテ通知・冒頭文</p>
            <p className="text-xs text-slate-400 bg-slate-900 rounded px-2 py-2 min-h-[2.5rem]">
              {s.maintenance_message_header ?? <span className="text-slate-600">未設定</span>}
            </p>
          </div>
          <div className="flex flex-col gap-0.5">
            <p className="text-[10px] text-slate-500">メンテ通知・末尾文</p>
            <p className="text-xs text-slate-400 bg-slate-900 rounded px-2 py-2 min-h-[2.5rem]">
              {s.maintenance_message_footer ?? <span className="text-slate-600">未設定</span>}
            </p>
          </div>
        </div>
        <Link href="/line" className="text-xs text-blue-400 hover:text-blue-300 transition-colors mt-1">
          → Channel Secret・Access Token の管理は LINE ページで行います
        </Link>
      </div>

      <div className="px-3 py-2 border border-amber-500/20 bg-amber-950/10 rounded-lg">
        <p className="text-[10px] text-amber-400/80">
          セキュリティ: Channel Secret と Access Token はこの画面に表示されません（サーバー専用カラム）。
        </p>
      </div>
    </div>
  );
}

// ─── Section: PDF・書類 ───────────────────────────────────────────────────────

function PdfContent({ sequences, s }: { sequences: DocumentSequenceDB[]; s: CanonicalDealerSettings }) {
  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col gap-2">
        <p className="text-sm font-semibold text-slate-100">採番設定</p>
        <DocumentSequenceSettings sequences={sequences} />
      </div>

      <div className={card}>
        <div className="flex items-center gap-2">
          <p className={lbl}>書類追加設定（PHASE70）</p>
          <NextPhaseBadge />
        </div>
        <div className="flex flex-col gap-3">
          <div className="flex flex-col gap-0.5">
            <p className="text-[10px] text-slate-500">完了報告備考</p>
            <p className="text-xs text-slate-400 bg-slate-900 rounded px-2 py-2 min-h-[2.5rem]">
              {s.completion_note ?? <span className="text-slate-600">未設定</span>}
            </p>
          </div>
          <div className="flex flex-col gap-0.5">
            <p className="text-[10px] text-slate-500">利用規約テキスト</p>
            <p className="text-xs text-slate-400 bg-slate-900 rounded px-2 py-2 min-h-[2.5rem]">
              {s.terms_and_conditions
                ? s.terms_and_conditions.slice(0, 80) + (s.terms_and_conditions.length > 80 ? "…" : "")
                : <span className="text-slate-600">未設定</span>}
            </p>
          </div>
        </div>
        <p className="text-[10px] text-slate-600">
          その他書類設定（スタンプ・フッター・備考）は「店舗・スタッフ → 自社設定」で管理します。
        </p>
      </div>
    </div>
  );
}

// ─── Section: リマインダー ────────────────────────────────────────────────────

function ReminderContent({ s }: { s: CanonicalDealerSettings }) {
  return (
    <div className={card}>
      <div className="flex items-center gap-2">
        <p className={lbl}>メンテナンスリマインダー（3枠固定）</p>
        <NextPhaseBadge />
      </div>
      <div className="flex flex-col gap-2">
        {s.maintenance_reminder_templates.map((t) => (
          <div key={t.id} className="flex items-center justify-between px-4 py-3 rounded-lg border border-slate-800 bg-slate-900/40">
            <div>
              <p className="text-sm text-slate-200">{t.name}</p>
              <p className="text-[10px] text-slate-600 mt-0.5">
                施工後 {t.months_after} ヶ月 ／ {t.repeat_yearly ? "毎年繰り返し" : "1回のみ"}
              </p>
            </div>
            <BoolPill value={t.enabled} />
          </div>
        ))}
      </div>
      <p className="text-[10px] text-slate-600">
        ON/OFF・メッセージ文は次フェーズで設定できるようになります。
      </p>
    </div>
  );
}

// ─── Section: 契約・プラン ────────────────────────────────────────────────────

function PlanContent({
  planInfo,
  planSlot,
}: {
  planInfo: DealerPlanInfo;
  planSlot: React.ReactNode;
}) {
  const featureLabels: Record<string, string> = {
    customers: "顧客管理", vehicles: "車両管理", estimates: "見積作成",
    estimate_pdf: "PDF出力", products: "GYEONカタログ", product_orders: "商品注文",
    work_orders: "施工指示", calendar: "カレンダー", completion_reports: "完了報告",
    invoices: "請求書", payments: "入金管理", maintenance: "メンテナンス通知",
    line: "LINE連携", line_crm: "LINE CRM", message_logs: "メッセージログ",
    notification_queue: "通知キュー", auto_notifications: "自動通知",
    reservations: "予約管理",
  };

  const currentPlan = planInfo.plan ?? "basic";
  const planTiers: Array<{ key: "basic" | "pro" | "pro_plus"; color: string }> = [
    { key: "basic",    color: "text-slate-300" },
    { key: "pro",      color: "text-blue-300"  },
    { key: "pro_plus", color: "text-purple-300" },
  ];
  const basicOnly   = PLAN_FEATURES.basic;
  const proOnly     = PLAN_FEATURES.pro.filter(f => !PLAN_FEATURES.basic.includes(f));
  const proPlusOnly = PLAN_FEATURES.pro_plus.filter(f => !PLAN_FEATURES.pro.includes(f));

  return (
    <div className="flex flex-col gap-4">
      {planSlot}
      <div className="bg-[#0f172a] border border-slate-800 rounded-xl overflow-hidden">
        <div className="grid grid-cols-4 border-b border-slate-800">
          <div className="px-4 py-3" />
          {planTiers.map(({ key, color }) => (
            <div key={key} className={`px-4 py-3 text-xs font-bold tracking-wide text-center ${color} ${currentPlan === key ? "bg-slate-800/60" : ""}`}>
              {planLabel(key)}
              {currentPlan === key && (
                <span className="ml-1 text-[9px] font-semibold bg-slate-700 text-slate-300 px-1.5 py-0.5 rounded">現在</span>
              )}
            </div>
          ))}
        </div>
        {basicOnly.map(f => (
          <div key={f} className="grid grid-cols-4 border-b border-slate-800/50 last:border-b-0">
            <div className="px-4 py-2 text-xs text-slate-300">{featureLabels[f] ?? f}</div>
            <div className="px-4 py-2 text-xs text-center text-green-400">✓</div>
            <div className="px-4 py-2 text-xs text-center text-green-400">✓</div>
            <div className="px-4 py-2 text-xs text-center text-green-400">✓</div>
          </div>
        ))}
        {proOnly.map(f => (
          <div key={f} className="grid grid-cols-4 border-b border-slate-800/50 last:border-b-0">
            <div className="px-4 py-2 text-xs text-slate-300">{featureLabels[f] ?? f}</div>
            <div className="px-4 py-2 text-xs text-center text-slate-600">—</div>
            <div className="px-4 py-2 text-xs text-center text-green-400">✓</div>
            <div className="px-4 py-2 text-xs text-center text-green-400">✓</div>
          </div>
        ))}
        {proPlusOnly.map(f => (
          <div key={f} className="grid grid-cols-4 border-b border-slate-800/50 last:border-b-0">
            <div className="px-4 py-2 text-xs text-slate-300">{featureLabels[f] ?? f}</div>
            <div className="px-4 py-2 text-xs text-center text-slate-600">—</div>
            <div className="px-4 py-2 text-xs text-center text-slate-600">—</div>
            <div className="px-4 py-2 text-xs text-center text-green-400">✓</div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Section: バックアップ・復旧 ─────────────────────────────────────────────

function BackupContent() {
  const rows = [
    { label: "自動バックアップ",   value: "Supabase 管理（Point-in-Time Recovery）" },
    { label: "バックアップ頻度",   value: "継続的（WAL ストリーミング）" },
    { label: "保持期間",           value: "プランによる（最大 7〜30日）" },
    { label: "手動エクスポート",   value: "次フェーズ" },
    { label: "リストア",           value: "Supabase ダッシュボードから実行" },
  ];
  return (
    <div className={card}>
      <p className={lbl}>DRステータス（読み取り専用）</p>
      <div className="flex flex-col gap-2.5">
        {rows.map(({ label, value }) => (
          <div key={label} className="flex items-start justify-between gap-4">
            <p className="text-xs text-slate-500 shrink-0">{label}</p>
            <p className="text-xs text-slate-300 text-right">{value}</p>
          </div>
        ))}
      </div>
      <p className="text-[10px] text-slate-600 border-t border-slate-800 pt-3">
        復旧操作・手動エクスポートは次フェーズで実装予定です。削除・リストアボタンは表示されません。
      </p>
    </div>
  );
}

// ─── Section: データ・サポート ────────────────────────────────────────────────

function SupportContent() {
  const rows = [
    { label: "データエクスポート",  value: "準備中" },
    { label: "CSVダウンロード",     value: "準備中" },
    { label: "アカウント削除",      value: "サポートへ連絡" },
    { label: "テクニカルサポート",  value: "nisikawa@office-az.com" },
    { label: "バージョン",          value: "v1.0 Official Release" },
  ];
  return (
    <div className={card}>
      <p className={lbl}>サポート情報</p>
      <div className="flex flex-col gap-2.5">
        {rows.map(({ label, value }) => (
          <div key={label} className="flex items-start justify-between gap-4">
            <p className="text-xs text-slate-500 shrink-0">{label}</p>
            <p className="text-xs text-slate-300 text-right">{value}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Category renderer ────────────────────────────────────────────────────────

function renderCategory(
  id: CategoryId,
  props: Props,
) {
  switch (id) {
    case "store":   return <StoreContent   s={props.settings} companySettings={props.companySettings} staffList={props.staffList} staffInfo={props.staffInfo} />;
    case "trade":   return <TradeContent   s={props.settings} />;
    case "pricing": return <PricingContent s={props.settings} />;
    case "service": return <ServiceContent s={props.settings} />;
    case "ocr":     return <OcrContent     s={props.settings} />;
    case "line":    return <LineContent    s={props.settings} />;
    case "pdf":     return <PdfContent     sequences={props.sequences} s={props.settings} />;
    case "reminder":return <ReminderContent s={props.settings} />;
    case "plan":    return <PlanContent    planInfo={props.planInfo} planSlot={props.planSlot} />;
    case "backup":  return <BackupContent />;
    case "support": return <SupportContent />;
  }
}

// ─── Main export ──────────────────────────────────────────────────────────────

export default function SettingsCategoryNav(props: Props) {
  const [selected, setSelected] = useState<CategoryId | null>(null);
  const { settings } = props;

  // ── Category grid view ──────────────────────────────────────────────────
  if (!selected) {
    return (
      <div className="flex flex-col gap-4">
        <p className="text-xs text-slate-500">設定カテゴリを選択してください</p>
        <div className="grid grid-cols-2 gap-3">
          {CATEGORIES.map(cat => {
            const badge = getBadge(cat.id, settings);
            return (
              <button
                key={cat.id}
                type="button"
                onClick={() => setSelected(cat.id)}
                className="flex flex-col items-start gap-2 bg-[#0f172a] border border-slate-700 hover:border-slate-500 active:border-[#1d4ed8] rounded-xl p-4 text-left transition-all"
              >
                <span className="text-2xl">{cat.icon}</span>
                <div className="flex flex-col gap-1 w-full">
                  <p className="text-sm font-semibold text-slate-100 leading-tight">{cat.label}</p>
                  <p className="text-[10px] text-slate-500 leading-tight">{cat.desc}</p>
                </div>
                <StatusBadge type={badge} />
              </button>
            );
          })}
        </div>
      </div>
    );
  }

  // ── Category detail view ────────────────────────────────────────────────
  const cat = CATEGORIES.find(c => c.id === selected)!;
  return (
    <div className="flex flex-col gap-5">
      {/* Back button */}
      <button
        type="button"
        onClick={() => setSelected(null)}
        className="flex items-center gap-2 text-sm text-slate-400 hover:text-slate-100 transition-colors self-start"
      >
        <span>←</span>
        <span>設定カテゴリへ戻る</span>
      </button>

      {/* Category header */}
      <div className="flex items-center gap-3">
        <span className="text-2xl">{cat.icon}</span>
        <h2 className="text-base font-semibold text-slate-100">{cat.label}</h2>
        <StatusBadge type={getBadge(selected, settings)} />
      </div>

      {/* Content */}
      {renderCategory(selected, props)}
    </div>
  );
}
