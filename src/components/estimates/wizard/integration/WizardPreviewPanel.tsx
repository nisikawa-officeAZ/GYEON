"use client";

// Estimate Wizard Ver2.2 — In-editor preview panel (Phase 8).
//
// Self-contained READ-ONLY renderer of the neutral EstimateEditorPreviewData. Imports NOTHING
// from the wizard (only the neutral preview type), so EstimateEditor can render it without ever
// depending on wizard internals. Renders NO production actions (no save / PDF / send / finalize),
// performs no calculation, and shows a clear "プレビューモード" indication. `internalMemo` is
// rendered in its own isolated internal-only block — never merged with customerNotes and never
// placed in a customer-facing block.

import type { EstimateEditorPreviewData, PreviewField } from "./previewTypes";

const CARD = "bg-[#1e293b] rounded-xl shadow-lg p-5";

function FieldList({ fields }: { fields: PreviewField[] }) {
  if (fields.length === 0) return <p className="text-xs text-slate-500">未入力</p>;
  return (
    <dl className="flex flex-col">
      {fields.map((f, i) => (
        <div key={`${f.label}-${i}`} className="flex flex-col sm:flex-row sm:items-start gap-0.5 sm:gap-3 py-1.5 border-b border-slate-800/60 last:border-b-0">
          <dt className="text-[11px] text-slate-500 sm:w-40 sm:shrink-0">{f.label}</dt>
          <dd className="text-sm text-slate-200 break-words min-w-0 whitespace-pre-wrap">{f.value}</dd>
        </div>
      ))}
    </dl>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className={CARD} aria-label={title}>
      <h3 className="text-sm font-semibold text-slate-100 mb-3">{title}</h3>
      {children}
    </section>
  );
}

export function WizardPreviewPanel({ data }: { data: EstimateEditorPreviewData }) {
  return (
    <div className="min-h-screen bg-[#080d1a] text-slate-200 px-4 py-6">
      <div className="max-w-3xl mx-auto flex flex-col gap-4">
        {/* Preview Mode banner — no production actions are available in this mode. */}
        <div
          role="status"
          aria-live="polite"
          className="rounded-xl border border-amber-500/40 bg-amber-500/10 p-4"
        >
          <div className="flex items-center gap-2">
            <span aria-hidden>👁️</span>
            <h2 className="text-sm font-semibold text-amber-200">プレビューモード（読み取り専用）</h2>
          </div>
          <p className="text-[11px] text-amber-200/80 mt-1">
            ウィザードのプレビュー表示です。保存・PDF・送信・確定などの本番操作は無効です。見積の作成・更新・DB書き込みは行われません。
          </p>
        </div>

        {/* Header summary */}
        <header className={CARD}>
          <dl className="grid grid-cols-1 sm:grid-cols-3 gap-2">
            <div className="rounded-lg border border-slate-700/60 p-2.5">
              <dt className="text-[10px] text-slate-500">お客様</dt>
              <dd className="text-sm text-slate-200 break-words">{data.customerName}</dd>
            </div>
            <div className="rounded-lg border border-slate-700/60 p-2.5">
              <dt className="text-[10px] text-slate-500">車両</dt>
              <dd className="text-sm text-slate-200 break-words">{data.vehicleName}</dd>
            </div>
            <div className="rounded-lg border border-slate-700/60 p-2.5">
              <dt className="text-[10px] text-slate-500">選択カテゴリ数</dt>
              <dd className="text-sm text-slate-200 tabular-nums">{data.categoryCount} カテゴリ</dd>
            </div>
          </dl>
        </header>

        <Section title="お客様情報"><FieldList fields={data.customerFields} /></Section>
        <Section title="車両情報"><FieldList fields={data.vehicleFields} /></Section>

        <Section title="施工内容">
          {data.serviceLines.length === 0 ? (
            <p className="text-xs text-slate-500">未選択</p>
          ) : (
            <ul className="flex flex-col gap-2">
              {data.serviceLines.map((s, i) => (
                <li key={`${s.category}-${i}`} className="rounded-lg border border-slate-700/60 p-3">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[10px] text-slate-500">{s.category}</span>
                    {s.amount && <span className="text-sm text-slate-200 tabular-nums">{s.amount}</span>}
                  </div>
                  <p className="text-sm text-slate-100 mt-0.5 break-words">{s.name}</p>
                  {s.detail && <p className="text-[11px] text-slate-500 mt-0.5 whitespace-pre-wrap break-words">{s.detail}</p>}
                </li>
              ))}
            </ul>
          )}
        </Section>

        <Section title="値引き・クーポン">
          <FieldList fields={data.discountFields} />
          <div className="mt-2">
            <p className="text-[11px] text-slate-500 mb-1">クーポン</p>
            {data.couponSummaries.length === 0 ? (
              <p className="text-xs text-slate-500">なし</p>
            ) : (
              <ul className="flex flex-col gap-1">
                {data.couponSummaries.map((c, i) => (
                  <li key={i} className="text-sm text-slate-200 break-words">・{c}</li>
                ))}
              </ul>
            )}
          </div>
        </Section>

        <Section title="備考・ご案内">
          {/* Customer-facing notes */}
          <div className="rounded-lg border border-slate-700/60 p-3">
            <div className="flex items-center gap-2 mb-1">
              <span aria-hidden>💬</span>
              <span className="text-xs font-medium text-slate-200">お客様向けメモ</span>
              <span className="text-[10px] text-blue-300 border border-blue-500/30 rounded px-1.5 py-0.5">お客様に表示される場合あり</span>
            </div>
            {data.customerNotes.trim() ? (
              <p className="text-sm text-slate-200 whitespace-pre-wrap break-words">{data.customerNotes}</p>
            ) : (
              <p className="text-xs text-slate-500">未入力</p>
            )}
          </div>
          {/* Internal staff memo — isolated internal-only block (never customer-facing) */}
          <div className="rounded-lg border border-amber-500/25 bg-[#0b1220] p-3 mt-2">
            <div className="flex items-center gap-2 mb-1">
              <span aria-hidden>🔒</span>
              <span className="text-xs font-medium text-amber-200/90">社内メモ（スタッフ専用）</span>
              <span className="text-[10px] text-amber-300/90 border border-amber-500/40 rounded px-1.5 py-0.5">お客様には表示されません</span>
            </div>
            {data.internalMemo.trim() ? (
              <p className="text-sm text-slate-100 whitespace-pre-wrap break-words">{data.internalMemo}</p>
            ) : (
              <p className="text-xs text-amber-200/50">未入力</p>
            )}
          </div>
        </Section>

        {/* Price summary — preview/mock only */}
        <section className="bg-[#0f172a] border border-slate-700 rounded-xl shadow-lg p-5" aria-label="金額サマリー">
          <div className="flex items-center justify-between gap-2 mb-2">
            <h3 className="text-sm font-semibold text-slate-100">金額サマリー</h3>
            <span className="text-[10px] text-amber-300/80 border border-amber-500/30 rounded px-1.5 py-0.5">プレビュー値（モック）</span>
          </div>
          {(data.priceSummary.mockRows ?? []).length > 0 ? (
            <dl className="flex flex-col">
              {(data.priceSummary.mockRows ?? []).map((r, i) => (
                <div key={`${r.label}-${i}`} className="flex items-center justify-between py-1.5 border-b border-slate-800/60 last:border-b-0">
                  <dt className="text-xs text-slate-400">{r.label}</dt>
                  <dd className="text-sm text-slate-200 tabular-nums">{r.value}</dd>
                </div>
              ))}
            </dl>
          ) : (
            <p className="text-xs text-slate-500">未計算（プレビュー）</p>
          )}
          <p className="text-[10px] text-slate-600 mt-3">{data.priceSummary.note}</p>
        </section>
      </div>
    </div>
  );
}
