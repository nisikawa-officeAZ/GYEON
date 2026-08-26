"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import type { PpfCoatingAdjustmentSettingsResult } from "@/lib/pricing/get-ppf-coating-adjustment-settings";
import {
  GLOBAL_PPF_COATING_ADJUSTMENT_COATING_CODE,
  GLOBAL_PPF_COATING_ADJUSTMENT_METHOD_CODE,
} from "@/lib/wizard-catalog/ppf-coating-adjustment-core";
import { saveDealerPpfCoatingAdjustment } from "@/lib/wizard-catalog/wizard-catalog-authoring-actions";
import styles from "./PpfCoatingAdjustmentClient.module.css";
import SettingsBackControl from "./SettingsBackControl";

type AdjustmentType = "amount" | "percent";

const SAMPLE_PPF_YEN = 90_000;
const SAMPLE_COATING_YEN = 80_000;
const SAMPLE_ADJUSTMENT_YEN = 10_000;

function percentText(basisPoints: number): string {
  return (basisPoints / 100).toFixed(2).replace(/\.00$/, "").replace(/(\.\d)0$/, "$1");
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

function formatYen(value: number): string {
  return `${value.toLocaleString("ja-JP")}円`;
}

function DiscountIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M19 5 5 19" />
      <circle cx="6.5" cy="6.5" r="2.5" />
      <circle cx="17.5" cy="17.5" r="2.5" />
    </svg>
  );
}

function BlockedState({ message }: { message: string }) {
  return (
    <div className={styles.root}>
      <SettingsBackControl className="mb-4" href="/settings/ppf" label="PPF設定へ戻る" />
      <header className={styles.header}>
        <div className={styles.headerIcon}><DiscountIcon /></div>
        <div><h1>PPF＋コーティング減額</h1><div className={styles.en}>PPF &amp; COATING COMBINATION DISCOUNT</div></div>
      </header>
      <div className={styles.blocked} role="alert">{message}</div>
    </div>
  );
}

export default function PpfCoatingAdjustmentClient({ result }: { result: PpfCoatingAdjustmentSettingsResult }) {
  if (result.status === "UNAUTHENTICATED") return <BlockedState message="有効な店舗権限を確認できませんでした。再度ログインしてください。" />;
  if (result.status === "RANK_UNAVAILABLE") return <BlockedState message="店舗ランクを確認できないため、減額設定を表示できません。" />;
  if (result.status === "COATING_UNAVAILABLE") return <BlockedState message="GYEON PPF Installerではボディコーティングを提供できないため、この設定は利用できません。" />;
  if (result.status === "READ_FAILED") return <BlockedState message="減額設定を読み込めませんでした。時間をおいて再度お試しください。" />;
  return <ReadySettings result={result} />;
}

function ReadySettings({ result }: { result: Extract<PpfCoatingAdjustmentSettingsResult, { status: "READY" }> }) {
  const initialType: AdjustmentType = result.rule?.adjustmentType ?? "amount";
  const initialText = result.rule
    ? (initialType === "amount" ? String(result.rule.adjustmentValue) : percentText(result.rule.adjustmentValue))
    : String(SAMPLE_ADJUSTMENT_YEN);
  const [ruleId, setRuleId] = useState<string | null>(result.rule?.ruleId ?? null);
  const [adjustmentType, setAdjustmentType] = useState<AdjustmentType>(initialType);
  const [valueText, setValueText] = useState(initialText);
  const [message, setMessage] = useState("");
  const [isPending, startTransition] = useTransition();

  const parsedValue = parseValue(adjustmentType, valueText);
  const previewReduction = parsedValue === null
    ? 0
    : adjustmentType === "amount"
      ? Math.min(parsedValue, SAMPLE_COATING_YEN)
      : Math.round((SAMPLE_COATING_YEN * parsedValue) / 10_000);
  const previewTotal = SAMPLE_PPF_YEN + SAMPLE_COATING_YEN - previewReduction;
  const amountExceedsPreview = adjustmentType === "amount" && parsedValue !== null && parsedValue > SAMPLE_COATING_YEN;

  const selectType = (type: AdjustmentType) => {
    setAdjustmentType(type);
    setValueText("");
    setMessage("");
  };

  const save = () => {
    if (parsedValue === null) {
      setMessage(adjustmentType === "amount"
        ? "減額値は0以上の整数で入力してください。"
        : "減額率は0〜100％の範囲で、小数第2位まで入力してください。");
      return;
    }
    if (!result.canEdit) {
      setMessage("変更できるのはオーナーまたはマネージャーです。");
      return;
    }
    startTransition(async () => {
      const saved = await saveDealerPpfCoatingAdjustment({
        ruleId,
        ppfMethodCode: GLOBAL_PPF_COATING_ADJUSTMENT_METHOD_CODE,
        coatingCode: GLOBAL_PPF_COATING_ADJUSTMENT_COATING_CODE,
        adjustmentType,
        adjustmentValue: parsedValue,
        isActive: true,
      });
      if (saved.ok) {
        setRuleId(saved.ruleId);
        setMessage("減額設定を保存しました。以後の見積に自動で適用されます。");
      } else {
        setMessage(saved.message);
      }
    });
  };

  return (
    <div className={styles.root} data-testid="ppf-coating-adjustment-settings">
      <SettingsBackControl className="mb-4" href="/settings/ppf" label="PPF設定へ戻る" />
      <header className={styles.header}>
        <div className={styles.headerIcon}><DiscountIcon /></div>
        <div><h1>PPF＋コーティング減額</h1><div className={styles.en}>PPF &amp; COATING COMBINATION DISCOUNT</div></div>
      </header>
      <div className={styles.breadcrumb}>DETAILER AGENT / SETTINGS / <b>PPF / COMBINATION DISCOUNT</b></div>

      <section className={styles.panel}>
        <h2>減額ルール設定 <small>全組み合わせ一律・コーティング価格から減額</small></h2>
        <p className={styles.description}>PPF施工とボディコーティングを併用する場合に、コーティング価格から自動で減額します。減額方法は「円（固定額）」または「％（割合）」をボタンで切り替えて設定します。</p>
        <div className={styles.controlRow}>
          <span className={styles.controlLabel}>減額方法</span>
          <div className={styles.typeButtons}>
            <button type="button" disabled={!result.canEdit || isPending} aria-pressed={adjustmentType === "amount"} className={adjustmentType === "amount" ? styles.primaryButton : styles.button} onClick={() => selectType("amount")}>円（固定額）</button>
            <button type="button" disabled={!result.canEdit || isPending} aria-pressed={adjustmentType === "percent"} className={adjustmentType === "percent" ? styles.primaryButton : styles.button} onClick={() => selectType("percent")}>％（割合）</button>
          </div>
        </div>
        <label className={styles.valueRow}>
          <span className={styles.controlLabel}>減額値</span>
          <input
            aria-label="減額値"
            disabled={!result.canEdit || isPending}
            inputMode={adjustmentType === "amount" ? "numeric" : "decimal"}
            value={valueText}
            onChange={(event) => {
              setValueText(event.target.value.replace(adjustmentType === "amount" ? /\D/g : /[^\d.]/g, ""));
              setMessage("");
            }}
          />
          <strong>{adjustmentType === "amount" ? "円" : "％"}</strong>
        </label>
        <p className={styles.note}>※「％」選択時はコーティング価格（税抜）に対する割合で減額します。単位表示は選択中の減額方法に連動します。</p>
        {!result.rule && <p className={styles.sampleNote}>10,000円は画面確認用のサンプルです。「保存する」を押すまでは登録されません。</p>}
        {amountExceedsPreview && <p className={styles.validation} role="alert">入力額が計算例のコーティング価格を超えるため、計算例では0円を下限として補正しています。</p>}
      </section>

      <section className={styles.panel}>
        <h2>適用条件 <small>併用時のみ自動適用</small></h2>
        <div className={styles.tableWrap}>
          <table className={styles.conditions}><tbody>
            <tr><th>適用対象</th><td>ボディコーティングとPPF（全体・範囲プリセット・部分PPF単体）を同一見積で選択した場合</td></tr>
            <tr><th>減額の基準</th><td>コーティング価格（サイズ別価格＋2層目・3層目価格の合計・税抜）から減額</td></tr>
            <tr><th>対象外</th><td>室内PPF・フロントウインドPPF・PPF専用コーティング・その他作業は減額対象外</td></tr>
            <tr><th>下限ガード</th><td>減額後のコーティング価格が0円を下回る場合は0円（システム側で自動補正）</td></tr>
          </tbody></table>
        </div>
      </section>

      <section className={styles.panel}>
        <h2>計算例 <small>見積での反映イメージ</small></h2>
        <div className={styles.tableWrap}>
          <table className={styles.preview}>
            <thead><tr><th>項目</th><th>金額（税抜）</th></tr></thead>
            <tbody>
              <tr><td>PPF：フロントフル（PPF PROTECT+）</td><td>{formatYen(SAMPLE_PPF_YEN)}</td></tr>
              <tr><td>コーティング：Q² PURE EVO（Mサイズ・2層）</td><td>{formatYen(SAMPLE_COATING_YEN)}</td></tr>
              <tr className={styles.reduction}><td>併用減額（一律）</td><td>−{formatYen(previewReduction)}</td></tr>
              <tr className={styles.total}><td>合計</td><td>{formatYen(previewTotal)}</td></tr>
            </tbody>
          </table>
        </div>
        <p className={styles.note}>※計算例は仮の金額です。実際の見積では選択されたサイズ・範囲・コーティング剤の価格に対して減額が適用されます。</p>
      </section>

      <div className={styles.actions}>
        {message && <span className={styles.message} role="status">{message}</span>}
        <Link className={styles.button} href="/settings/ppf">キャンセル</Link>
        <button type="button" className={styles.primaryButton} disabled={!result.canEdit || isPending || parsedValue === null} onClick={save}>{isPending ? "保存中…" : "保存する"}</button>
      </div>
    </div>
  );
}
