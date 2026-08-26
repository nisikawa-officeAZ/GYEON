"use client";

import Link from "next/link";
import { useMemo, useState, useTransition } from "react";
import type {
  PpfCoatingAdjustmentProduct,
  PpfCoatingAdjustmentScope,
  PpfCoatingAdjustmentSettingsResult,
} from "@/lib/pricing/get-ppf-coating-adjustment-settings";
import { saveDealerPpfCoatingAdjustment } from "@/lib/wizard-catalog/wizard-catalog-authoring-actions";
import styles from "./PpfCoatingAdjustmentClient.module.css";

type AdjustmentType = "amount" | "percent";

interface DraftRule {
  readonly ruleId: string | null;
  readonly adjustmentType: AdjustmentType;
  readonly valueText: string;
  readonly isActive: boolean;
  readonly dirty: boolean;
}

const SCOPE_LABELS: Record<PpfCoatingAdjustmentScope, { ja: string; en: string }> = {
  front_full: { ja: "フロントフル", en: "FRONT FULL" },
  full_body: { ja: "フルボディ", en: "FULL BODY" },
};

const keyOf = (scope: PpfCoatingAdjustmentScope, coatingCode: string) => `${scope}:${coatingCode}`;

function percentText(basisPoints: number): string {
  return (basisPoints / 100).toFixed(2).replace(/\.00$/, "").replace(/(\.\d)0$/, "$1");
}

function initialDrafts(result: Extract<PpfCoatingAdjustmentSettingsResult, { status: "READY" }>): Record<string, DraftRule> {
  const byIdentity = new Map(result.rules.map((rule) => [keyOf(rule.scope, rule.coatingCode), rule]));
  return Object.fromEntries(
    (["front_full", "full_body"] as const).flatMap((scope) =>
      result.products.map((product) => {
        const rule = byIdentity.get(keyOf(scope, product.code));
        return [
          keyOf(scope, product.code),
          rule
            ? {
                ruleId: rule.ruleId,
                adjustmentType: rule.adjustmentType,
                valueText: rule.adjustmentType === "amount"
                  ? String(rule.adjustmentValue)
                  : percentText(rule.adjustmentValue),
                isActive: rule.isActive,
                dirty: false,
              }
            : { ruleId: null, adjustmentType: "amount", valueText: "", isActive: false, dirty: false },
        ];
      }),
    ),
  );
}

function parseValue(type: AdjustmentType, valueText: string): number | null {
  const value = valueText.trim();
  if (type === "amount") {
    if (!/^\d+$/.test(value)) return null;
    const yen = Number(value);
    return Number.isSafeInteger(yen) ? yen : null;
  }
  if (!/^\d+(?:\.\d{1,2})?$/.test(value)) return null;
  const percent = Number(value);
  if (!Number.isFinite(percent) || percent < 0 || percent > 100) return null;
  return Math.round(percent * 100);
}

function DiscountIcon() {
  return (
    <svg width="25" height="25" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M9 4l5.5 2.2v4c0 3.4-2.3 6.3-5.5 7.9-3.2-1.6-5.5-4.5-5.5-7.9v-4z" />
      <path d="M15.5 6.5L20 8.2v3c0 2.4-1.6 4.5-3.8 5.7" opacity=".55" />
      <path d="M8 11.5h3.5" opacity=".9" />
    </svg>
  );
}

function BlockedState({ message }: { message: string }) {
  return (
    <div className={styles.root}>
      <header className={styles.header}>
        <div className={styles.headerIcon}><DiscountIcon /></div>
        <div><h1>PPF＋コーティング減額</h1><div className={styles.en}>PPF + COATING REDUCTION</div></div>
      </header>
      <div className={styles.blocked} role="alert">{message}</div>
      <Link className={styles.backLink} href="/settings/ppf">← PPF種類・施工係数へ戻る</Link>
    </div>
  );
}

export default function PpfCoatingAdjustmentClient({ result }: { result: PpfCoatingAdjustmentSettingsResult }) {
  if (result.status === "UNAUTHENTICATED") return <BlockedState message="有効な店舗権限を確認できませんでした。再度ログインしてください。" />;
  if (result.status === "RANK_UNAVAILABLE") return <BlockedState message="店舗ランクを確認できないため、減額設定を表示できません。" />;
  if (result.status === "COATING_UNAVAILABLE") return <BlockedState message="GYEON PPF Installerではコーティングを提供できないため、この設定は利用できません。" />;
  if (result.status === "READ_FAILED") return <BlockedState message="減額設定を読み込めませんでした。時間をおいて再度お試しください。" />;
  return <ReadySettings result={result} />;
}

function ReadySettings({ result }: { result: Extract<PpfCoatingAdjustmentSettingsResult, { status: "READY" }> }) {
  const [scope, setScope] = useState<PpfCoatingAdjustmentScope>("front_full");
  const [drafts, setDrafts] = useState<Record<string, DraftRule>>(() => initialDrafts(result));
  const [message, setMessage] = useState<string>("");
  const [savingKey, setSavingKey] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const rows = useMemo(() => result.products.map((product) => ({
    product,
    draft: drafts[keyOf(scope, product.code)],
  })), [drafts, result.products, scope]);

  const updateDraft = (product: PpfCoatingAdjustmentProduct, patch: Partial<DraftRule>) => {
    const key = keyOf(scope, product.code);
    setDrafts((current) => ({
      ...current,
      [key]: { ...current[key], ...patch, dirty: true },
    }));
    setMessage("");
  };

  const save = (product: PpfCoatingAdjustmentProduct) => {
    const key = keyOf(scope, product.code);
    const draft = drafts[key];
    const adjustmentValue = parseValue(draft.adjustmentType, draft.valueText);
    if (adjustmentValue === null) {
      setMessage(draft.adjustmentType === "amount"
        ? "減額金額は0以上の整数で入力してください。"
        : "減額率は0〜100％の範囲で、小数第2位まで入力してください。");
      return;
    }
    if (!result.canEdit) {
      setMessage("変更できるのはオーナーまたはマネージャーです。");
      return;
    }

    setSavingKey(key);
    startTransition(async () => {
      const saved = await saveDealerPpfCoatingAdjustment({
        ruleId: draft.ruleId,
        ppfMethodCode: scope,
        coatingCode: product.code,
        adjustmentType: draft.adjustmentType,
        adjustmentValue,
        isActive: draft.isActive,
      });
      if (saved.ok) {
        setDrafts((current) => ({
          ...current,
          [key]: { ...current[key], ruleId: saved.ruleId, dirty: false },
        }));
        setMessage(`${SCOPE_LABELS[scope].ja}・${product.label}の減額設定を保存しました。`);
      } else {
        setMessage(saved.message);
      }
      setSavingKey(null);
    });
  };

  return (
    <div className={styles.root} data-testid="ppf-coating-adjustment-settings">
      <header className={styles.header}>
        <div className={styles.headerIcon}><DiscountIcon /></div>
        <div><h1>PPF＋コーティング減額</h1><div className={styles.en}>PPF + COATING REDUCTION</div></div>
      </header>
      <div className={styles.breadcrumb}>DETAILER AGENT / SETTINGS / PPF / <b>COATING REDUCTION</b></div>

      <div className={styles.notice} role="status">
        <b>PPFとコーティングを同時施工する場合に、1層目コーティング料金から差し引く金額を設定します。</b>
        <span>クーポンではありません。PPF料金は変更されず、部分施工には自動適用されません。</span>
      </div>
      {result.obsoleteRuleCount > 0 && (
        <div className={styles.warning} role="alert">旧仕様の減額設定が{result.obsoleteRuleCount}件あります。現在の見積計算には適用されません。</div>
      )}

      <section className={styles.panel}>
        <div className={styles.scopeTabs} role="tablist" aria-label="PPF施工範囲">
          {(["front_full", "full_body"] as const).map((option) => (
            <button
              key={option}
              type="button"
              role="tab"
              aria-selected={scope === option}
              className={`${styles.scopeTab} ${scope === option ? styles.scopeTabActive : ""}`}
              onClick={() => { setScope(option); setMessage(""); }}
            >
              <span>{SCOPE_LABELS[option].ja}</span>
              <small>{SCOPE_LABELS[option].en}</small>
            </button>
          ))}
        </div>

        <div className={styles.sectionHeading}>
          <div>
            <h2>{SCOPE_LABELS[scope].ja}の減額設定</h2>
            <p>コーティング剤ごとに円引きまたは％引きを設定します。未設定の組み合わせは減額されません。</p>
          </div>
          <span className={styles.scopeBadge}>{SCOPE_LABELS[scope].en}</span>
        </div>

        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead><tr><th>1層目コーティング剤</th><th>減額方法</th><th>減額値</th><th>状態</th><th>操作</th></tr></thead>
            <tbody>
              {rows.map(({ product, draft }) => {
                const rowKey = keyOf(scope, product.code);
                const configured = draft.ruleId !== null;
                return (
                  <tr key={product.code}>
                    <td data-label="1層目コーティング剤"><strong>{product.label}</strong><span className={styles.code}>{product.code}</span></td>
                    <td data-label="減額方法">
                      <div className={styles.typeButtons}>
                        <button type="button" disabled={!result.canEdit} aria-pressed={draft.adjustmentType === "amount"} className={draft.adjustmentType === "amount" ? styles.selectedButton : styles.optionButton} onClick={() => updateDraft(product, { adjustmentType: "amount", valueText: "" })}>円引き</button>
                        <button type="button" disabled={!result.canEdit} aria-pressed={draft.adjustmentType === "percent"} className={draft.adjustmentType === "percent" ? styles.selectedButton : styles.optionButton} onClick={() => updateDraft(product, { adjustmentType: "percent", valueText: "" })}>％引き</button>
                      </div>
                    </td>
                    <td data-label="減額値">
                      <label className={styles.valueField}>
                        <input aria-label={`${SCOPE_LABELS[scope].ja} ${product.label} 減額値`} disabled={!result.canEdit} inputMode={draft.adjustmentType === "amount" ? "numeric" : "decimal"} placeholder="未設定" value={draft.valueText} onChange={(event) => updateDraft(product, { valueText: event.target.value.replace(draft.adjustmentType === "amount" ? /\D/g : /[^\d.]/g, "") })} />
                        <span>{draft.adjustmentType === "amount" ? "円" : "％"}</span>
                      </label>
                    </td>
                    <td data-label="状態">
                      <button type="button" disabled={!result.canEdit} className={`${styles.stateButton} ${draft.isActive ? styles.activeState : ""}`} onClick={() => updateDraft(product, { isActive: !draft.isActive })}>{draft.isActive ? "有効" : configured ? "停止中" : "未設定"}</button>
                    </td>
                    <td data-label="操作">
                      <button type="button" className={styles.saveButton} disabled={!result.canEdit || !draft.dirty || isPending} onClick={() => save(product)}>{savingKey === rowKey ? "保存中…" : "保存"}</button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        {result.products.length === 0 && <div className={styles.empty}>利用可能な1層目コーティング剤がありません。</div>}
      </section>

      <div className={styles.footer}>
        <Link className={styles.backLink} href="/settings/ppf">← PPF種類・施工係数へ戻る</Link>
        {message && <span className={styles.message} role="status">{message}</span>}
      </div>
    </div>
  );
}
