"use client";

import Link from "next/link";
import { useState, useTransition, type Dispatch, type SetStateAction } from "react";
import type { AuthoritativePpfR1CoefficientReadResult } from "@/lib/pricing/get-authoritative-ppf-r1-installation-coefficients";
import type { AuthoritativePpfR1ReadResult } from "@/lib/pricing/get-authoritative-ppf-r1-price-settings";
import {
  PPF_R1_COEFFICIENT_CONTRACT_VERSION,
  PPF_R1_STANDARD_PRODUCT_CODES,
  type PpfR1InstallationCoefficientSettings,
} from "@/lib/pricing/ppf-r1-installation-coefficient-contract";
import {
  PPF_R1_CONTRACT_VERSION,
  type PpfR1PriceSettings,
  type PpfR1SizePriceMap,
} from "@/lib/pricing/ppf-r1-price-contract";
import { saveAuthoritativePpfR1PriceSettings } from "@/lib/pricing/save-authoritative-ppf-r1-price-settings";
import styles from "./PpfSettingsClient.module.css";

const SIZES = ["SS", "S", "M", "ML", "L", "LL", "XL"] as const;

type Row = { id: string; name: string; price: string; time: string; active: boolean; standard?: boolean; archived?: boolean; matrixAuthoritative?: boolean };
type Film = { id: string; name: string; coefficient: string; active: boolean; standard?: boolean; archived?: boolean };
type DraftNoticeState = "sample" | "dirty" | "persisted";

const INITIAL_FILMS: Film[] = [
  { id: "protect-plus", name: "PPF PROTECT+", coefficient: "1.20", active: true, standard: true },
  { id: "enhance", name: "PPF ENHANCE", coefficient: "1.10", active: true, standard: true },
  { id: "hybrid", name: "PPF HYBRID", coefficient: "1.00", active: true, standard: true },
  { id: "matte", name: "PPF MATTE", coefficient: "1.30", active: true, standard: true },
  { id: "black", name: "PPF BLACK", coefficient: "1.30", active: true, standard: true },
  { id: "tint", name: "PPF TINT", coefficient: "1.30", active: true, standard: true },
  { id: "carbon", name: "PPF CARBON", coefficient: "1.35", active: true, standard: true },
  { id: "color-line", name: "PPF COLOR LINE", coefficient: "1.40", active: true, standard: true },
];

const MATRIX_AUTHORITATIVE_SCOPE_NAMES = new Set(["フルボディ（全周）", "フロントフル（バンパー＋ボンネット＋フェンダー）"]);

const INITIAL_SCOPES: Row[] = [
  "フルボディ（全周）",
  "フロントフル（バンパー＋ボンネット＋フェンダー）",
  "フロントバンパー",
  "ボンネット",
].map((name, index) => ({ id: `scope-${index}`, name, price: "", time: "", active: true, matrixAuthoritative: MATRIX_AUTHORITATIVE_SCOPE_NAMES.has(name) }));

const INITIAL_INTERIOR: Row[] = ["ダッシュボード周辺", "センターコンソール", "ドアスイッチパネル", "その他（手入力）"]
  .map((name, index) => ({ id: `interior-${index}`, name, price: ["8000", "5000", "3000", ""][index], time: ["30", "20", "10", ""][index], active: true }));

const INITIAL_PARTS: Row[] = [
  { id: "front-bumper", name: "フロントバンパー", price: "", time: "90", active: true },
  { id: "bonnet", name: "ボンネット", price: "", time: "60", active: true },
  { id: "fender", name: "フェンダー（左右）", price: "", time: "60", active: true },
  { id: "headlight", name: "ヘッドライト", price: "", time: "30", active: true },
];

function priceText(price: number | null | undefined): string {
  return price === null || price === undefined ? "" : String(price);
}

function initialSizePrices(
  resolution: AuthoritativePpfR1ReadResult,
  key: "frontFullPricesBySize" | "fullBodyPricesBySize",
): string[] {
  return SIZES.map((size) => resolution.status === "READY" ? priceText(resolution.settings[key][size]) : "");
}

function parsePrice(value: string): number | null | undefined {
  if (value.trim() === "") return null;
  if (!/^\d+$/.test(value)) return undefined;
  const price = Number(value);
  return Number.isSafeInteger(price) ? price : undefined;
}

function parseSizePrices(values: readonly string[]): PpfR1SizePriceMap | null {
  const entries = SIZES.map((size, index) => [size, parsePrice(values[index] ?? "")] as const);
  return entries.some(([, price]) => price === undefined)
    ? null
    : Object.fromEntries(entries) as PpfR1SizePriceMap;
}

function basisPointsText(value: number | null): string {
  if (value === null) return "";
  return (value / 10_000).toFixed(4).replace(/0+$/, "").replace(/\.$/, "");
}

function initialFilms(resolution: AuthoritativePpfR1CoefficientReadResult): Film[] {
  if (resolution.status !== "READY" && resolution.status !== "INCOMPLETE") return INITIAL_FILMS;
  const coefficientByCode = new Map(resolution.products.map((product) => [product.code, product.coefficientBp]));
  return INITIAL_FILMS.map((film) => PPF_R1_STANDARD_PRODUCT_CODES.includes(film.id as never)
    ? { ...film, coefficient: basisPointsText(coefficientByCode.get(film.id as never) ?? null) }
    : film);
}

function initialParts(
  priceResolution: AuthoritativePpfR1ReadResult,
  catalogResolution: AuthoritativePpfR1CoefficientReadResult,
): Row[] {
  if (catalogResolution.status !== "READY"
    && catalogResolution.status !== "INCOMPLETE"
    && catalogResolution.status !== "NOT_CONFIGURED") {
    return INITIAL_PARTS;
  }
  return catalogResolution.parts.map((part) => ({
    id: part.code,
    name: part.label,
    price: priceResolution.status === "READY"
      ? priceText(priceResolution.settings.partialPartPrices[part.code])
      : "",
    time: "",
    active: true,
    standard: true,
  }));
}

function parseCoefficientBp(value: string): number | null {
  const normalized = value.trim();
  if (!/^(?:\d+)(?:\.\d{1,4})?$/.test(normalized)) return null;
  const basisPoints = Number(normalized) * 10_000;
  return Number.isSafeInteger(basisPoints) && basisPoints > 0 && basisPoints <= 2_147_483_647
    ? basisPoints
    : null;
}

function PpfIcon() {
  return (
    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M4 14c1.5-3 3-4.5 5.5-5L11 7.5h3.5l1.8 2.5h3c.7 0 1.2.5 1.2 1.2V14" />
      <path d="M4 14h16.5" /><circle cx="8.5" cy="16.5" r="1.7" /><circle cx="16" cy="16.5" r="1.7" />
      <path d="M12 3.5V5M9 4.2l.7 1.3M15 4.2l-.7 1.3" opacity=".7" />
    </svg>
  );
}

function ToggleButton({ active, onClick }: { active: boolean; onClick: () => void }) {
  return <button type="button" className={`${styles.button} ${styles.small} ${active ? styles.primary : ""}`} aria-pressed={active} onClick={onClick}>{active ? "提供中" : "提供停止"}</button>;
}

function EditableRows({ rows, setRows, nameLabel, onPriceChange }: { rows: Row[]; setRows: (rows: Row[]) => void; nameLabel: string; onPriceChange?: () => void }) {
  const update = (id: string, patch: Partial<Row>) => setRows(rows.map(row => row.id === id ? { ...row, ...patch } : row));
  return (
    <div className={styles.scroll}>
      <table className={styles.table}>
        <thead><tr><th>{nameLabel}</th><th>金額（円・税抜）</th><th>所要時間（分）</th><th>操作</th></tr></thead>
        <tbody>{rows.map(row => (
          <tr key={row.id} className={row.archived ? styles.archivedRow : undefined}>
            <td><input className={styles.input} value={row.name} onChange={e => update(row.id, { name: e.target.value })} /></td>
            <td>{row.matrixAuthoritative
              ? <span className={styles.standard} data-matrix-authoritative-price="true">サイズ別価格表を使用</span>
              : <input className={`${styles.input} ${styles.price}`} inputMode="numeric" value={row.price} placeholder="金額" onChange={e => { update(row.id, { price: e.target.value.replace(/\D/g, "") }); onPriceChange?.(); }} />}</td>
            <td><input className={`${styles.input} ${styles.time}`} inputMode="numeric" value={row.time} placeholder="分" onChange={e => update(row.id, { time: e.target.value.replace(/\D/g, "") })} /></td>
            <td><span className={styles.rowOps}>{row.archived ? <span className={styles.archivedBadge}>アーカイブ済み</span> : <ToggleButton active={row.active} onClick={() => update(row.id, { active: !row.active })} />}<button type="button" className={`${styles.button} ${styles.small}`} onClick={() => update(row.id, { archived: !row.archived, active: row.archived ? row.active : false })}>{row.archived ? "復元" : "アーカイブ"}</button></span></td>
          </tr>
        ))}</tbody>
      </table>
    </div>
  );
}

export default function PpfSettingsClient({
  resolution,
  coefficientResolution,
}: {
  resolution: AuthoritativePpfR1ReadResult;
  coefficientResolution: AuthoritativePpfR1CoefficientReadResult;
}) {
  const [frontFullPrices, setFrontFullPrices] = useState(() => initialSizePrices(resolution, "frontFullPricesBySize"));
  const [fullBodyPrices, setFullBodyPrices] = useState(() => initialSizePrices(resolution, "fullBodyPricesBySize"));
  const [films, setFilms] = useState(() => initialFilms(coefficientResolution));
  const [scopes, setScopes] = useState(INITIAL_SCOPES);
  const [interior, setInterior] = useState(INITIAL_INTERIOR);
  const [parts, setParts] = useState(() => initialParts(resolution, coefficientResolution));
  const [coating, setCoating] = useState({ price: "30000", time: "60", active: true });
  const [windshield, setWindshield] = useState<Row[]>([
    { id: "wind-gyeon", name: "GYEON ウインドフィルム PPF", price: "", time: "", active: true, standard: true },
    { id: "wind-custom", name: "", price: "", time: "", active: true },
  ]);
  const [materials, setMaterials] = useState<Record<string, "TPU" | "PET">>({ "wind-gyeon": "TPU", "wind-custom": "TPU" });
  const [archiveTarget, setArchiveTarget] = useState<string | null>(null);
  const [saveMessage, setSaveMessage] = useState("");
  const [draftNoticeState, setDraftNoticeState] = useState<DraftNoticeState>(() =>
    resolution.status === "READY" && coefficientResolution.status === "READY" ? "persisted" : "sample",
  );
  const [isPending, startTransition] = useTransition();
  const isDirty = draftNoticeState !== "persisted";
  const readUnavailable = resolution.status === "UNAUTHENTICATED"
    || resolution.status === "READ_FAILED"
    || resolution.status === "MALFORMED"
    || coefficientResolution.status === "UNAUTHENTICATED"
    || coefficientResolution.status === "READ_FAILED"
    || coefficientResolution.status === "MALFORMED";

  const updateFilm = (id: string, patch: Partial<Film>) => setFilms(rows => rows.map(row => row.id === id ? { ...row, ...patch } : row));
  const addRow = (setter: Dispatch<SetStateAction<Row[]>>, prefix: string) => setter(rows => [...rows, { id: `${prefix}-${Date.now()}`, name: "", price: "", time: "", active: true }]);
  const markPersistentDraftDirty = () => {
    setDraftNoticeState("dirty");
    setSaveMessage("");
  };

  const savePrices = () => {
    const front = parseSizePrices(frontFullPrices);
    const full = parseSizePrices(fullBodyPrices);
    const partialEntries = parts
      .filter((row) => !row.archived)
      .map((row) => [row.id, parsePrice(row.price)] as const);
    if (!front || !full || partialEntries.some(([, price]) => price === undefined)) {
      setSaveMessage("価格には0以上の整数を入力してください。空欄は未設定として保存されます。");
      return;
    }

    const standardFilms = PPF_R1_STANDARD_PRODUCT_CODES.map((code) => films.find((film) => film.id === code));
    const coefficientEntries = standardFilms.map((film, index) => [
      PPF_R1_STANDARD_PRODUCT_CODES[index],
      film ? parseCoefficientBp(film.coefficient) : null,
    ] as const);
    if (coefficientEntries.some(([, coefficient]) => coefficient === null)) {
      setSaveMessage("8種類すべての施工係数を0より大きい数値で入力してください。例：1.20");
      return;
    }

    const payload: PpfR1PriceSettings = {
      contractVersion: PPF_R1_CONTRACT_VERSION,
      frontFullPricesBySize: front,
      fullBodyPricesBySize: full,
      partialPartPrices: Object.fromEntries(partialEntries) as Record<string, number | null>,
    };
    const coefficients: PpfR1InstallationCoefficientSettings = {
      contractVersion: PPF_R1_COEFFICIENT_CONTRACT_VERSION,
      installationCoefficientsBpByProductCode: Object.fromEntries(coefficientEntries) as PpfR1InstallationCoefficientSettings["installationCoefficientsBpByProductCode"],
    };

    startTransition(async () => {
      const result = await saveAuthoritativePpfR1PriceSettings(payload, coefficients);
      if (result.status === "SAVED") {
        setDraftNoticeState("persisted");
        setSaveMessage("PPFの正式価格と施工係数を保存しました。見積ウィザードの自動計算に反映されます。");
      } else if (result.status === "UNAUTHORIZED") {
        setSaveMessage("保存権限がありません。オーナーまたはマネージャーで実行してください。");
      } else if (result.status === "INVALID_PAYLOAD") {
        setSaveMessage("価格の入力内容が正式な7サイズ契約と一致しません。内容を確認してください。");
      } else {
        setSaveMessage("保存に失敗しました。既存の価格設定は変更されていません。");
      }
    });
  };

  return (
    <div className={styles.root} data-testid="ppf-settings-r1" data-size-contract="SS,S,M,ML,L,LL,XL">
      <header className={styles.header}>
        <div className={styles.headerIcon}><PpfIcon /></div>
        <div><h1>PPF種類・施工係数</h1><div className={styles.en}>PPF TYPES &amp; INSTALLATION COEFFICIENTS</div></div>
      </header>
      <div className={styles.breadcrumb}>DETAILER AGENT / SETTINGS / <b>PPF / TYPES &amp; COEFFICIENTS</b></div>
      {draftNoticeState === "sample" ? (
        <div className={styles.notice} role="status" data-notice-state="sample"><span><b>画面に表示されている保存対象のPPF価格と施工係数は、表示確認のためのサンプルです。実際の設定には使用されません。</b><br />ご利用前に、店舗で使用する正しい内容を入力してください。空欄は「未設定」、0円は「無料」として登録されます。</span></div>
      ) : draftNoticeState === "dirty" ? (
        <div className={styles.notice} role="status" data-notice-state="dirty"><span><b>入力内容はまだ保存されていません。</b><br />内容を確認し、登録する場合は「保存する」を押してください。</span></div>
      ) : null}

      <section className={styles.panel} data-component="price-matrix-front-full">
        <h2>フロントフル価格（サイズ別・税抜）<span className={styles.warnChip}>要確認：正式値未確定</span></h2>
        <p>フロントフル施工の価格をサイズごとに直接設定します。フルボディ価格とは独立した表です。</p>
        <div className={styles.sizeGrid}>{SIZES.map((size, index) => <label className={styles.sizeCell} key={size}><span className={styles.sizeLabel}>{size}</span><input aria-label={`フロントフル価格 ${size}`} className={`${styles.input} ${styles.price}`} inputMode="numeric" placeholder="未設定" value={frontFullPrices[index]} onChange={e => { setFrontFullPrices(values => values.map((value, i) => i === index ? e.target.value.replace(/\D/g, "") : value)); markPersistentDraftDirty(); }} /></label>)}</div>
        <p className={styles.subnote}>実際の見積計算への反映方法は正式な価格計算契約で確定します。空欄＝未設定、0円＝意図的な無料として区別されます。</p>
      </section>

      <section className={styles.panel} data-component="price-matrix-full-body">
        <h2>フルボディ価格（サイズ別・税抜）<span className={styles.warnChip}>要確認：正式値未確定</span></h2>
        <p>フルボディ施工の価格をサイズごとに直接設定します。フロントフル価格とは独立した表です。</p>
        <div className={styles.sizeGrid}>{SIZES.map((size, index) => <label className={styles.sizeCell} key={size}><span className={styles.sizeLabel}>{size}</span><input aria-label={`フルボディ価格 ${size}`} className={`${styles.input} ${styles.price}`} inputMode="numeric" placeholder="未設定" value={fullBodyPrices[index]} onChange={e => { setFullBodyPrices(values => values.map((value, i) => i === index ? e.target.value.replace(/\D/g, "") : value)); markPersistentDraftDirty(); }} /></label>)}</div>
        <p className={styles.subnote}>実際の見積計算への反映方法は正式な価格計算契約で確定します。空欄＝未設定、0円＝意図的な無料として区別されます。</p>
      </section>

      <section className={styles.panel} data-component="ppf-type-master">
        <h2>PPF種類マスタ <span className={styles.subnote}>デフォルトはGYEONラインナップ・他メーカー種も行追加で登録可能</span></h2>
        <div className={styles.scroll}><table className={styles.table}><thead><tr><th>種類名</th><th>施工係数（×）</th><th>提供状態</th><th>操作</th></tr></thead><tbody>
          {films.map((film, index) => <tr key={film.id} className={film.archived ? styles.archivedRow : undefined}>
            <td>{index === 0 && <span className={styles.en}>GLOSS / MATTE / COLOR PROTECTION</span>}<input className={styles.input} readOnly={film.standard} value={film.name} placeholder="製品名" onChange={e => updateFilm(film.id, { name: e.target.value })} />{!film.standard && <span className={styles.customBadge}>他社製品</span>}</td>
            <td><input className={`${styles.input} ${styles.coefficient}`} inputMode="decimal" value={film.coefficient} placeholder="未設定" onChange={e => { updateFilm(film.id, { coefficient: e.target.value }); if (film.standard) markPersistentDraftDirty(); }} /></td>
            <td>{film.archived ? <span className={styles.archivedBadge}>アーカイブ済み</span> : <ToggleButton active={film.active} onClick={() => updateFilm(film.id, { active: !film.active })} />}</td>
            <td>{film.standard ? <span className={styles.standard}>GYEON標準</span> : film.archived ? <button type="button" className={`${styles.button} ${styles.small}`} onClick={() => updateFilm(film.id, { archived: false })}>復元</button> : <button type="button" className={`${styles.button} ${styles.small}`} onClick={() => setArchiveTarget(film.id)}>アーカイブ</button>}</td>
          </tr>)}
        </tbody></table></div>
        <button type="button" className={styles.button} onClick={() => setFilms(rows => [...rows, { id: `custom-${Date.now()}`, name: "", coefficient: "", active: true }])}>＋ PPF種類を追加</button>
        <p>「提供中」の種類のみが見積ウィザードに表示されます。GYEON標準商品は名称変更・ハード削除不可です。店舗追加商品はアーカイブして管理します。</p>
      </section>

      <section className={styles.panel} data-component="ppf-scope-presets">
        <h2>施工範囲プリセット <span className={styles.subnote}>範囲＝時間の1対1・係数は価格のみに適用</span></h2>
        <EditableRows rows={scopes} setRows={setScopes} nameLabel="施工範囲名" />
        <button type="button" className={styles.button} onClick={() => addRow(setScopes, "scope")}>＋ 施工範囲を追加</button>
      </section>

      <section className={styles.panel}>
        <h2>PPF専用コーティング（税抜） <span className={styles.subnote}>PPF上に施工するコーティング</span></h2>
        <div className={styles.fieldRow}>
          <label className={styles.field}>金額（円）<input className={`${styles.input} ${styles.price}`} inputMode="numeric" value={coating.price} onChange={e => setCoating(v => ({ ...v, price: e.target.value.replace(/\D/g, "") }))} /></label>
          <label className={styles.field}>想定施工時間（分）<input className={`${styles.input} ${styles.time}`} inputMode="numeric" value={coating.time} onChange={e => setCoating(v => ({ ...v, time: e.target.value.replace(/\D/g, "") }))} /></label>
          <ToggleButton active={coating.active} onClick={() => setCoating(v => ({ ...v, active: !v.active }))} />
        </div>
        <p>PPF施工と併せて選択された場合に加算されます。<Link className={styles.inlineLink} href="/settings/ppf/coating-discount">PPF＋コーティング減額は別画面で設定します。→</Link></p>
      </section>

      <section className={styles.panel} data-component="ppf-indoor">
        <h2>室内PPF（税抜） <span className={styles.subnote}>係数適用外・手入力金額のみ</span></h2>
        <EditableRows rows={interior} setRows={setInterior} nameLabel="項目名" />
        <button type="button" className={styles.button} onClick={() => addRow(setInterior, "interior")}>＋ 室内PPF項目を追加</button>
      </section>

      <section className={styles.panel} data-component="ppf-partial">
        <h2>部分PPF施工・単体用（税抜） <span className={styles.subnote}>コーティング付帯用とは別管理</span></h2>
        <EditableRows rows={parts} setRows={setParts} nameLabel="施工部位" onPriceChange={markPersistentDraftDirty} />
        <button type="button" className={styles.button} onClick={() => addRow(setParts, "part")}>＋ 部分PPF部位を追加</button>
      </section>

      <section className={styles.panel} data-component="ppf-windshield">
        <h2>フロントウインドPPF（税抜） <span className={styles.subnote}>素材はTPU・PETのいずれか・他社製品も登録可</span></h2>
        <div className={styles.scroll}><table className={styles.table}><thead><tr><th>製品名</th><th>素材</th><th>金額（円・税抜）</th><th>所要時間（分）</th><th>操作</th></tr></thead><tbody>{windshield.map(row => <tr key={row.id}>
          <td><input className={styles.input} readOnly={row.standard} value={row.name} placeholder="製品名（他社製品も可）" onChange={e => setWindshield(rows => rows.map(item => item.id === row.id ? { ...item, name: e.target.value } : item))} /></td>
          <td><span className={styles.material}>{(["TPU", "PET"] as const).map(material => <button type="button" key={material} className={`${styles.button} ${styles.small} ${materials[row.id] === material ? styles.primary : ""}`} onClick={() => setMaterials(v => ({ ...v, [row.id]: material }))}>{material}</button>)}</span></td>
          <td><input className={`${styles.input} ${styles.price}`} inputMode="numeric" value={row.price} placeholder="金額" onChange={e => setWindshield(rows => rows.map(item => item.id === row.id ? { ...item, price: e.target.value.replace(/\D/g, "") } : item))} /></td>
          <td><input className={`${styles.input} ${styles.time}`} inputMode="numeric" value={row.time} placeholder="分" onChange={e => setWindshield(rows => rows.map(item => item.id === row.id ? { ...item, time: e.target.value.replace(/\D/g, "") } : item))} /></td>
          <td><ToggleButton active={row.active} onClick={() => setWindshield(rows => rows.map(item => item.id === row.id ? { ...item, active: !item.active } : item))} /></td>
        </tr>)}</tbody></table></div>
        <button type="button" className={styles.button} onClick={() => addRow(setWindshield, "wind")}>＋ ウインドPPF製品を追加</button>
      </section>

      <div className={styles.footer}>
        {saveMessage && <span className={styles.saveMessage}>{saveMessage}</span>}
        <button type="button" className={styles.button} onClick={() => window.location.reload()}>キャンセル</button>
        <button type="button" className={`${styles.button} ${styles.primary}`} disabled={!isDirty || isPending || readUnavailable} onClick={savePrices}>{isPending ? "保存中…" : "保存する"}</button>
      </div>

      {archiveTarget && <div className={styles.modalBackdrop} role="presentation"><div className={styles.modal} role="dialog" aria-modal="true" aria-labelledby="ppf-archive-title"><h3 id="ppf-archive-title">この項目をアーカイブしますか？</h3><p>見積ウィザードには表示されなくなりますが、過去の記録は保持され、復元できます。ハード削除は行いません。</p><div className={styles.footer}><button type="button" className={styles.button} onClick={() => setArchiveTarget(null)}>キャンセル</button><button type="button" className={`${styles.button} ${styles.primary}`} onClick={() => { updateFilm(archiveTarget, { archived: true, active: false }); setArchiveTarget(null); }}>アーカイブする</button></div></div></div>}
    </div>
  );
}
