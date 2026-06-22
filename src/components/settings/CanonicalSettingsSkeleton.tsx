// DealerOS — Canonical Settings Skeleton (PHASE72)
// Server component — read-only display of all PHASE70/71 setting groups.
// No save actions. No LINE secrets. No form submissions.

import Link from "next/link";
import type { CanonicalDealerSettings } from "@/lib/dealer-settings/dealer-settings-types";

// ─── Design tokens (aligned with existing settings page) ─────────────────────

const card   = "bg-[#0f172a] border border-slate-800 rounded-xl p-5 flex flex-col gap-4";
const label  = "text-[10px] font-semibold text-slate-500 uppercase tracking-wider";
const grid2  = "grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-3";

// ─── Atom components ──────────────────────────────────────────────────────────

function ReadField({ title, value }: { title: string; value: string | number | null | undefined }) {
  const display = (value !== null && value !== undefined && String(value).trim() !== "")
    ? String(value)
    : "—";
  return (
    <div className="flex flex-col gap-0.5">
      <p className="text-[10px] text-slate-500">{title}</p>
      <p className="text-sm text-slate-300">{display}</p>
    </div>
  );
}

function NextPhaseBadge() {
  return (
    <span className="text-[10px] px-2 py-0.5 rounded bg-slate-800/80 text-slate-500 shrink-0">
      保存機能は次フェーズ
    </span>
  );
}

function ComingSoonBadge() {
  return (
    <span className="text-[10px] px-2 py-0.5 rounded bg-slate-800/80 text-slate-500 shrink-0">
      準備中
    </span>
  );
}

function SectionHeader({ title, children }: { title: string; children?: React.ReactNode }) {
  return (
    <div className="flex items-center gap-2 flex-wrap">
      <h2 className="text-base font-semibold text-slate-100">{title}</h2>
      {children}
    </div>
  );
}

function BoolPill({ value, trueLabel = "有効", falseLabel = "無効" }: { value: boolean; trueLabel?: string; falseLabel?: string }) {
  return value ? (
    <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-emerald-950/40 text-emerald-400 border border-emerald-500/30">
      {trueLabel}
    </span>
  ) : (
    <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-slate-800 text-slate-500">
      {falseLabel}
    </span>
  );
}

function FixedChip({ label: chipLabel }: { label: string }) {
  return (
    <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-blue-950/30 text-blue-400 border border-blue-500/20">
      {chipLabel}
    </span>
  );
}

function LockChip({ label: chipLabel }: { label: string }) {
  return (
    <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-amber-950/30 text-amber-400 border border-amber-500/20">
      {chipLabel}
    </span>
  );
}

// ─── Section 1: 店舗・スタッフ追加設定 ───────────────────────────────────────
// Shows PHASE70 additions. Core store info is in CompanySettingsForm above.

function StoreExtSection({ s }: { s: CanonicalDealerSettings }) {
  const rankLabel = s.detailer_rank === "certified" ? "⭐ Certified Detailer" : "🔵 Detailer";
  return (
    <section className="flex flex-col gap-3">
      <SectionHeader title="店舗・スタッフ追加設定">
        <NextPhaseBadge />
      </SectionHeader>
      <div className={card}>
        <p className={label}>ランク・追加連絡先</p>
        <div className={grid2}>
          <div className="flex flex-col gap-0.5">
            <p className="text-[10px] text-slate-500">Detailerランク</p>
            <div className="flex items-center gap-2 mt-0.5">
              <span className="text-sm text-slate-300">{rankLabel}</span>
            </div>
          </div>
          <ReadField title="電話番号（予備）" value={s.business_phone_alt} />
        </div>
        <div className={grid2}>
          <ReadField title="振込先口座" value={s.bank_account} />
        </div>
        <p className="text-[10px] text-slate-600 mt-1">
          Detailerランクは EstimateWizard のコーティング商品表示に使用されます。
          PHASE70 マイグレーション適用後、ここから変更できるようになります。
        </p>
      </div>
    </section>
  );
}

// ─── Section 2: 業者・掛け売り設定 ───────────────────────────────────────────

function TradeSection({ s }: { s: CanonicalDealerSettings }) {
  const closing = s.dealer_closing_day ? `${s.dealer_closing_day}日締め` : "—";
  const payment = s.dealer_payment_day ? `翌${s.dealer_payment_day}日払い` : "—";
  return (
    <section className="flex flex-col gap-3">
      <SectionHeader title="業者・掛け売り設定">
        <NextPhaseBadge />
      </SectionHeader>
      <div className={card}>
        <p className={label}>業販デフォルト</p>
        <div className={grid2}>
          <div className="flex flex-col gap-0.5">
            <p className="text-[10px] text-slate-500">デフォルト掛け率</p>
            <p className="text-2xl font-bold text-slate-100">
              {s.default_dealer_rate_percent}
              <span className="text-sm font-normal text-slate-400 ml-1">%</span>
            </p>
            <p className="text-[10px] text-slate-600">EstimateWizard の業者設定デフォルト値</p>
          </div>
          <div className="flex flex-col gap-3">
            <ReadField title="締め日" value={closing} />
            <ReadField title="支払日" value={payment} />
          </div>
        </div>
      </div>
    </section>
  );
}

// ─── Section 3: 価格・割引設定 ────────────────────────────────────────────────

function PricingSection({ s }: { s: CanonicalDealerSettings }) {
  return (
    <section className="flex flex-col gap-3">
      <SectionHeader title="価格・割引設定">
        <NextPhaseBadge />
      </SectionHeader>
      <div className={card}>
        {/* Coupon slots */}
        <div className="flex flex-col gap-2">
          <p className={label}>クーポン設定（5枠固定）</p>
          <div className="border border-slate-800 rounded-lg overflow-hidden">
            {s.coupon_settings.map((c, i) => (
              <div key={i} className="flex items-center justify-between px-4 py-2.5 border-b border-slate-800/60 last:border-b-0">
                <span className="text-sm text-slate-300">{c.name || "（未設定）"}</span>
                <span className="text-sm font-medium text-blue-400">
                  -{c.amount.toLocaleString("ja-JP")}円
                </span>
              </div>
            ))}
          </div>
          <p className="text-[10px] text-slate-600">名称と金額のみ変更可。枠の追加・削除は不可。</p>
        </div>

        {/* Discount presets */}
        <div className="flex flex-col gap-2 border-t border-slate-800 pt-4">
          <p className={label}>値引きプリセット</p>
          {s.discount_presets.length === 0 ? (
            <p className="text-xs text-slate-600 px-1">プリセットは未設定です。</p>
          ) : (
            <div className="border border-slate-800 rounded-lg overflow-hidden">
              {s.discount_presets.map((d, i) => (
                <div key={i} className="flex items-center justify-between px-4 py-2.5 border-b border-slate-800/60 last:border-b-0">
                  <span className="text-sm text-slate-300">{d.name}</span>
                  <span className="text-sm text-slate-400">
                    {d.discount_type === "fixed"
                      ? `${d.value.toLocaleString("ja-JP")}円引`
                      : `${d.value}%引`}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </section>
  );
}

// ─── Section 4: 施工メニュー・価格 ───────────────────────────────────────────

function ServiceMenuSection({ s }: { s: CanonicalDealerSettings }) {
  const sp = s.service_price_settings;
  const ppf = s.ppf_price_tables;

  return (
    <section className="flex flex-col gap-3">
      <SectionHeader title="施工メニュー・価格">
        <NextPhaseBadge />
      </SectionHeader>

      <div className={card}>
        {/* Coating */}
        <details className="group">
          <summary className="flex items-center justify-between cursor-pointer list-none">
            <p className={label}>コーティング</p>
            <span className="text-slate-600 text-xs group-open:rotate-180 transition-transform">▼</span>
          </summary>
          <div className="mt-3 flex flex-col gap-2">
            <div className="border border-slate-800 rounded-lg overflow-hidden">
              <div className="grid grid-cols-3 px-3 py-1.5 bg-slate-800/40 text-[10px] text-slate-500">
                <span>商品名</span><span>グレード</span><span className="text-right">Mサイズ基準</span>
              </div>
              {sp.coating.products.filter(p => p.active).map(p => (
                <div key={p.id} className="grid grid-cols-3 px-3 py-2 border-t border-slate-800/40 text-xs">
                  <span className="text-slate-300">{p.name}</span>
                  <span className="text-slate-500">{p.grade}</span>
                  <span className="text-right text-blue-400">¥{p.base_price_m.toLocaleString("ja-JP")}</span>
                </div>
              ))}
            </div>
            <p className="text-[10px] text-slate-600">
              サイズ係数: SS×{sp.coating.size_multipliers.SS} / M×{sp.coating.size_multipliers.M} / XXL×{sp.coating.size_multipliers.XXL}
            </p>
          </div>
        </details>

        <div className="border-t border-slate-800/60" />

        {/* PPF overview */}
        <details className="group">
          <summary className="flex items-center justify-between cursor-pointer list-none">
            <p className={label}>PPF施工</p>
            <span className="text-slate-600 text-xs group-open:rotate-180 transition-transform">▼</span>
          </summary>
          <div className="mt-3 flex flex-col gap-2">
            <div className="flex items-center gap-2">
              <BoolPill value={sp.ppf.active} />
              <span className="text-xs text-slate-500">PPF詳細価格は「PPF価格テーブル」セクションを参照</span>
            </div>
            <div className="flex flex-wrap gap-2">
              {Object.entries(sp.ppf.plan_labels).map(([k, v]) => (
                <span key={k} className="text-xs px-2 py-0.5 rounded bg-slate-800 text-slate-400">{v}</span>
              ))}
            </div>
          </div>
        </details>

        <div className="border-t border-slate-800/60" />

        {/* Window film */}
        <details className="group">
          <summary className="flex items-center justify-between cursor-pointer list-none">
            <p className={label}>ウィンドウフィルム</p>
            <span className="text-slate-600 text-xs group-open:rotate-180 transition-transform">▼</span>
          </summary>
          <div className="mt-3 flex flex-col gap-2">
            <div className="border border-slate-800 rounded-lg overflow-hidden">
              {Object.entries(sp.window_film.base_prices).map(([k, v]) => (
                <div key={k} className="flex justify-between px-3 py-2 border-b border-slate-800/40 last:border-b-0 text-xs">
                  <span className="text-slate-400">{k}</span>
                  <span className="text-blue-400">¥{(v as number).toLocaleString("ja-JP")}</span>
                </div>
              ))}
            </div>
          </div>
        </details>

        <div className="border-t border-slate-800/60" />

        {/* Maintenance */}
        <details className="group">
          <summary className="flex items-center justify-between cursor-pointer list-none">
            <p className={label}>ボディ定期メンテナンス（5枠固定）</p>
            <span className="text-slate-600 text-xs group-open:rotate-180 transition-transform">▼</span>
          </summary>
          <div className="mt-3">
            <div className="border border-slate-800 rounded-lg overflow-hidden">
              {sp.maintenance.menus.map(m => (
                <div key={m.id} className="flex justify-between px-3 py-2 border-b border-slate-800/40 last:border-b-0 text-xs">
                  <span className="text-slate-400">[{m.id}] {m.name || "（未設定）"}</span>
                  <span className="text-blue-400">¥{m.price.toLocaleString("ja-JP")}</span>
                </div>
              ))}
            </div>
          </div>
        </details>

        <div className="border-t border-slate-800/60" />

        {/* Carwash */}
        <details className="group">
          <summary className="flex items-center justify-between cursor-pointer list-none">
            <p className={label}>メンテナンス洗車</p>
            <span className="text-slate-600 text-xs group-open:rotate-180 transition-transform">▼</span>
          </summary>
          <div className="mt-3">
            <div className="border border-slate-800 rounded-lg overflow-hidden">
              {sp.carwash.menus.map(m => (
                <div key={m.id} className="flex justify-between px-3 py-2 border-b border-slate-800/40 last:border-b-0 text-xs">
                  <span className="text-slate-400">{m.name}</span>
                  <span className="text-blue-400">¥{m.price.toLocaleString("ja-JP")}</span>
                </div>
              ))}
            </div>
          </div>
        </details>

        <div className="border-t border-slate-800/60" />

        {/* Room cleaning */}
        <details className="group">
          <summary className="flex items-center justify-between cursor-pointer list-none">
            <p className={label}>ルームクリーニング</p>
            <span className="text-slate-600 text-xs group-open:rotate-180 transition-transform">▼</span>
          </summary>
          <div className="mt-3 flex flex-col gap-2">
            <div className="border border-slate-800 rounded-lg overflow-hidden">
              {Object.entries(sp.room_cleaning.base_prices).map(([k, v]) => (
                <div key={k} className="flex justify-between px-3 py-2 border-b border-slate-800/40 last:border-b-0 text-xs">
                  <span className="text-slate-400">{k}</span>
                  <span className="text-blue-400">¥{(v as number).toLocaleString("ja-JP")}</span>
                </div>
              ))}
            </div>
          </div>
        </details>
      </div>

      {/* PPF price tables — separate card */}
      <div className={card}>
        <details className="group">
          <summary className="flex items-center justify-between cursor-pointer list-none">
            <p className={label}>PPF価格テーブル（詳細）</p>
            <span className="text-slate-600 text-xs group-open:rotate-180 transition-transform">▼</span>
          </summary>
          <div className="mt-3 flex flex-col gap-3">
            {/* Film coefficients */}
            <div>
              <p className="text-[10px] text-slate-600 mb-1.5">フィルム係数</p>
              <div className="flex flex-wrap gap-2">
                {Object.entries(ppf.film_coeff).map(([k, v]) => (
                  <span key={k} className="text-xs px-2 py-0.5 rounded bg-slate-800 text-slate-300">
                    {k} × {v}
                  </span>
                ))}
              </div>
            </div>
            {/* Rank coefficients */}
            <div>
              <p className="text-[10px] text-slate-600 mb-1.5">車両ランク係数</p>
              <div className="flex flex-wrap gap-2">
                {Object.entries(ppf.rank_coeff).map(([k, v]) => (
                  <span key={k} className="text-xs px-2 py-0.5 rounded bg-slate-800 text-slate-300">
                    {k} × {v}
                  </span>
                ))}
              </div>
            </div>
            {/* Glass prices */}
            <div>
              <p className="text-[10px] text-slate-600 mb-1.5">フロントガラス価格</p>
              <div className="flex gap-3">
                {Object.entries(ppf.glass_prices).map(([k, v]) => (
                  <span key={k} className="text-xs text-slate-300">
                    {k}: <span className="text-blue-400">¥{(v as number).toLocaleString("ja-JP")}</span>
                  </span>
                ))}
              </div>
            </div>
            {/* Plan price count */}
            <p className="text-[10px] text-slate-600">
              プラン×サイズ価格表: {Object.keys(ppf.plan_prices).length}エントリ /
              部位単品: {Object.keys(ppf.parts_prices).length}パーツ
            </p>
          </div>
        </details>
      </div>
    </section>
  );
}

// ─── Section 5: 車検証OCR設定 ────────────────────────────────────────────────

function OcrSection({ s }: { s: CanonicalDealerSettings }) {
  const rows: Array<{ label: string; value: React.ReactNode }> = [
    { label: "OCR機能",         value: <BoolPill value={s.ocr_enabled} /> },
    { label: "OCRエンジン",      value: <FixedChip label="GPT-4o mini" /> },
    { label: "ストレージ",        value: <FixedChip label="プライベートストレージ" /> },
    { label: "保存期間",          value: <FixedChip label="永久保存" /> },
    { label: "人間確認必須",      value: <LockChip label="常時必須（変更不可）" /> },
    { label: "手入力常時可能",    value: <LockChip label="常時有効（変更不可）" /> },
  ];
  return (
    <section className="flex flex-col gap-3">
      <SectionHeader title="車検証OCR設定">
        <NextPhaseBadge />
      </SectionHeader>
      <div className={card}>
        <p className={label}>OCR設定</p>
        <div className="flex flex-col gap-3">
          {rows.map(({ label: rowLabel, value }) => (
            <div key={rowLabel} className="flex items-center justify-between">
              <p className="text-xs text-slate-400">{rowLabel}</p>
              <div>{value}</div>
            </div>
          ))}
        </div>
        <p className="text-[10px] text-slate-600 mt-1 border-t border-slate-800 pt-3">
          「人間確認必須」と「手入力常時可能」はシステム固定値です。設定変更できません。
        </p>
      </div>
    </section>
  );
}

// ─── Section 6: LINE連携（読み取り専用サマリー） ──────────────────────────────

function LineSection({ s }: { s: CanonicalDealerSettings }) {
  return (
    <section className="flex flex-col gap-3">
      <SectionHeader title="LINE連携">
        <span className="text-[10px] px-2 py-0.5 rounded bg-slate-800/80 text-slate-500 shrink-0">
          詳細設定は LINE ページ
        </span>
      </SectionHeader>
      <div className={card}>
        <div className="flex items-center justify-between">
          <p className={label}>LINE設定サマリー</p>
          <BoolPill value={s.line_enabled} trueLabel="連携有効" falseLabel="連携無効" />
        </div>

        <div className={grid2}>
          <ReadField title="LIFF ID" value={s.line_liff_id} />
          <ReadField title="Webhook URL" value={s.webhook_url ? "設定済み" : null} />
        </div>

        {/* PHASE70 additions */}
        <div className="flex flex-col gap-3 border-t border-slate-800 pt-3">
          <p className={label}>追加設定（PHASE70）</p>
          <div className={grid2}>
            <ReadField title="友だち追加QRコードURL" value={s.friend_add_qr_url} />
          </div>
          <div className={grid2}>
            <div className="flex flex-col gap-0.5">
              <p className="text-[10px] text-slate-500">見積転送・冒頭文</p>
              <p className="text-xs text-slate-400 bg-slate-900 rounded px-2 py-1.5 min-h-[2rem]">
                {s.line_message_header ?? <span className="text-slate-600">未設定</span>}
              </p>
            </div>
            <div className="flex flex-col gap-0.5">
              <p className="text-[10px] text-slate-500">見積転送・末尾文</p>
              <p className="text-xs text-slate-400 bg-slate-900 rounded px-2 py-1.5 min-h-[2rem]">
                {s.line_message_footer ?? <span className="text-slate-600">未設定</span>}
              </p>
            </div>
          </div>
          <div className={grid2}>
            <div className="flex flex-col gap-0.5">
              <p className="text-[10px] text-slate-500">メンテ通知・冒頭文</p>
              <p className="text-xs text-slate-400 bg-slate-900 rounded px-2 py-1.5 min-h-[2rem]">
                {s.maintenance_message_header ?? <span className="text-slate-600">未設定</span>}
              </p>
            </div>
            <div className="flex flex-col gap-0.5">
              <p className="text-[10px] text-slate-500">メンテ通知・末尾文</p>
              <p className="text-xs text-slate-400 bg-slate-900 rounded px-2 py-1.5 min-h-[2rem]">
                {s.maintenance_message_footer ?? <span className="text-slate-600">未設定</span>}
              </p>
            </div>
          </div>

          {/* SNS URLs */}
          {s.sns_urls && (
            <div>
              <p className="text-[10px] text-slate-600 mb-1.5">SNS連携</p>
              <div className="flex flex-wrap gap-2">
                {Object.entries(s.sns_urls).map(([k, v]) =>
                  v ? (
                    <span key={k} className="text-xs px-2 py-0.5 rounded bg-slate-800 text-slate-300">
                      {k}: 設定済み
                    </span>
                  ) : null,
                )}
              </div>
            </div>
          )}
        </div>

        <div className="border-t border-slate-800 pt-3">
          <Link
            href="/line"
            className="text-xs text-blue-400 hover:text-blue-300 transition-colors"
          >
            → LINE詳細設定・シークレット管理はこちら
          </Link>
        </div>

        <p className="text-[10px] text-slate-600">
          LINE Channel Secret / Access Token はこの画面には表示されません（サーバー専用）。
        </p>
      </div>
    </section>
  );
}

// ─── Section 7: PDF・書類設定（追加項目） ─────────────────────────────────────
// CompanySettingsForm already handles tax_rate, pdf_footer, invoice_note, etc.
// This section shows the fields NOT yet shown in CompanySettingsForm.

function PdfExtSection({ s }: { s: CanonicalDealerSettings }) {
  return (
    <section className="flex flex-col gap-3">
      <SectionHeader title="PDF・書類設定（追加）">
        <NextPhaseBadge />
      </SectionHeader>
      <div className={card}>
        <p className={label}>追加書類設定</p>
        <div className={grid2}>
          <div className="flex flex-col gap-0.5">
            <p className="text-[10px] text-slate-500">完了報告備考</p>
            <p className="text-xs text-slate-400 bg-slate-900 rounded px-2 py-1.5 min-h-[2.5rem]">
              {s.completion_note ?? <span className="text-slate-600">未設定</span>}
            </p>
          </div>
          <div className="flex flex-col gap-0.5">
            <p className="text-[10px] text-slate-500">利用規約テキスト</p>
            <p className="text-xs text-slate-400 bg-slate-900 rounded px-2 py-1.5 min-h-[2.5rem]">
              {s.terms_and_conditions
                ? s.terms_and_conditions.substring(0, 60) + (s.terms_and_conditions.length > 60 ? "…" : "")
                : <span className="text-slate-600">未設定</span>
              }
            </p>
          </div>
        </div>
        <p className="text-[10px] text-slate-600">
          これらのフィールドは DB に存在しますが、自社設定フォームには未表示です。次フェーズで追加します。
        </p>
      </div>
    </section>
  );
}

// ─── Section 8: リマインダー設定 ─────────────────────────────────────────────

function ReminderSection({ s }: { s: CanonicalDealerSettings }) {
  return (
    <section className="flex flex-col gap-3">
      <SectionHeader title="リマインダー設定">
        <NextPhaseBadge />
      </SectionHeader>
      <div className={card}>
        <p className={label}>メンテナンスリマインダー（3枠固定）</p>
        <div className="flex flex-col gap-2">
          {s.maintenance_reminder_templates.map((t) => (
            <div
              key={t.id}
              className="flex items-center justify-between px-4 py-3 rounded-lg border border-slate-800 bg-slate-900/40"
            >
              <div className="flex flex-col gap-0.5">
                <p className="text-sm text-slate-200">{t.name}</p>
                <p className="text-[10px] text-slate-600">
                  施工後 {t.months_after} ヶ月 /{" "}
                  {t.repeat_yearly ? "毎年繰り返し" : "1回のみ"}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <BoolPill value={t.enabled} trueLabel="有効" falseLabel="無効" />
              </div>
            </div>
          ))}
        </div>
        <p className="text-[10px] text-slate-600">
          リマインダーのON/OFF・メッセージ文は次フェーズで設定できるようになります。
        </p>
      </div>
    </section>
  );
}

// ─── Section 9: バックアップ・復旧 ───────────────────────────────────────────

function BackupSection() {
  const rows = [
    { label: "自動バックアップ",   value: "Supabase 管理 (Point-in-Time Recovery)" },
    { label: "バックアップ頻度",   value: "継続的 (WAL ストリーミング)" },
    { label: "保持期間",           value: "プランによる (最大 7〜30日)" },
    { label: "手動エクスポート",   value: "次フェーズ" },
    { label: "リストア",           value: "Supabase ダッシュボードから実行" },
  ];
  return (
    <section className="flex flex-col gap-3">
      <SectionHeader title="バックアップ・復旧">
        <ComingSoonBadge />
      </SectionHeader>
      <div className={card}>
        <p className={label}>DR ステータス（読み取り専用）</p>
        <div className="flex flex-col gap-2">
          {rows.map(({ label: rowLabel, value }) => (
            <div key={rowLabel} className="flex items-start justify-between gap-4">
              <p className="text-xs text-slate-500 shrink-0">{rowLabel}</p>
              <p className="text-xs text-slate-300 text-right">{value}</p>
            </div>
          ))}
        </div>
        <p className="text-[10px] text-slate-600 border-t border-slate-800 pt-3">
          復旧操作・手動エクスポートは次フェーズで実装予定です。
        </p>
      </div>
    </section>
  );
}

// ─── Section 10: データ・サポート ─────────────────────────────────────────────

function DataSupportSection() {
  const rows = [
    { label: "データエクスポート",     value: "準備中" },
    { label: "CSVダウンロード",        value: "準備中" },
    { label: "アカウント削除",         value: "サポートへ連絡" },
    { label: "テクニカルサポート",     value: "nisikawa@office-az.com" },
    { label: "バージョン",             value: "v1.0 Official Release" },
  ];
  return (
    <section className="flex flex-col gap-3">
      <SectionHeader title="データ・サポート">
        <ComingSoonBadge />
      </SectionHeader>
      <div className={card}>
        <p className={label}>サポート情報</p>
        <div className="flex flex-col gap-2">
          {rows.map(({ label: rowLabel, value }) => (
            <div key={rowLabel} className="flex items-start justify-between gap-4">
              <p className="text-xs text-slate-500 shrink-0">{rowLabel}</p>
              <p className="text-xs text-slate-300 text-right">{value}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

// ─── Main export ──────────────────────────────────────────────────────────────

interface Props {
  settings: CanonicalDealerSettings;
}

export default function CanonicalSettingsSkeleton({ settings: s }: Props) {
  return (
    <>
      <StoreExtSection    s={s} />
      <TradeSection       s={s} />
      <PricingSection     s={s} />
      <ServiceMenuSection s={s} />
      <OcrSection         s={s} />
      <LineSection        s={s} />
      <PdfExtSection      s={s} />
      <ReminderSection    s={s} />
      <BackupSection />
      <DataSupportSection />
    </>
  );
}
