"use client";

import { useState, type Dispatch, type SetStateAction } from "react";
import styles from "./PpfSettingsClient.module.css";

const SIZES = ["SS", "S", "M", "ML", "L", "LL", "XL"] as const;
const MOCK_BASE = ["90000", "100000", "110000", "120000", "130000", "140000", "150000"];

type Row = { id: string; name: string; price: string; time: string; active: boolean; standard?: boolean; archived?: boolean };
type Film = { id: string; name: string; coefficient: string; active: boolean; standard?: boolean; archived?: boolean };

const INITIAL_FILMS: Film[] = [
  { id: "protect-plus", name: "PPF PROTECT+", coefficient: "1.20", active: true, standard: true },
  { id: "enhance", name: "PPF ENHANCE", coefficient: "1.10", active: true, standard: true },
  { id: "hybrid", name: "PPF HYBRID", coefficient: "1.00", active: true, standard: true },
  { id: "matte", name: "PPF MATTE", coefficient: "1.30", active: true, standard: true },
  { id: "black", name: "PPF BLACK", coefficient: "1.30", active: true, standard: true },
  { id: "tint", name: "PPF TINT", coefficient: "1.30", active: true, standard: true },
  { id: "carbon", name: "PPF CARBON", coefficient: "1.35", active: true, standard: true },
  { id: "color-line", name: "PPF COLOR LINE", coefficient: "1.40", active: true, standard: true },
  { id: "custom-1", name: "STEK DYNOshield", coefficient: "", active: true },
];

const INITIAL_SCOPES: Row[] = [
  "フルボディ（全周）",
  "フロントフル（バンパー＋ボンネット＋フェンダー）",
  "フロントバンパー",
  "ボンネット",
].map((name, index) => ({ id: `scope-${index}`, name, price: "", time: "", active: true }));

const INITIAL_INTERIOR: Row[] = ["ダッシュボード周辺", "センターコンソール", "ドアスイッチパネル", "その他（手入力）"]
  .map((name, index) => ({ id: `interior-${index}`, name, price: ["8000", "5000", "3000", ""][index], time: ["30", "20", "10", ""][index], active: true }));

const INITIAL_PARTS: Row[] = ["フロントバンパー", "ボンネット", "フェンダー（左右）", "ヘッドライト"]
  .map((name, index) => ({ id: `part-${index}`, name, price: ["35000", "25000", "20000", "12000"][index], time: ["90", "60", "60", "30"][index], active: true }));

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

function EditableRows({ rows, setRows, nameLabel }: { rows: Row[]; setRows: (rows: Row[]) => void; nameLabel: string }) {
  const update = (id: string, patch: Partial<Row>) => setRows(rows.map(row => row.id === id ? { ...row, ...patch } : row));
  return (
    <div className={styles.scroll}>
      <table className={styles.table}>
        <thead><tr><th>{nameLabel}</th><th>金額（円・税抜）</th><th>所要時間（分）</th><th>操作</th></tr></thead>
        <tbody>{rows.map(row => (
          <tr key={row.id} className={row.archived ? styles.archivedRow : undefined}>
            <td><input className={styles.input} value={row.name} onChange={e => update(row.id, { name: e.target.value })} /></td>
            <td><input className={`${styles.input} ${styles.price}`} inputMode="numeric" value={row.price} placeholder="金額" onChange={e => update(row.id, { price: e.target.value.replace(/\D/g, "") })} /></td>
            <td><input className={`${styles.input} ${styles.time}`} inputMode="numeric" value={row.time} placeholder="分" onChange={e => update(row.id, { time: e.target.value.replace(/\D/g, "") })} /></td>
            <td><span className={styles.rowOps}>{row.archived ? <span className={styles.archivedBadge}>アーカイブ済み</span> : <ToggleButton active={row.active} onClick={() => update(row.id, { active: !row.active })} />}<button type="button" className={`${styles.button} ${styles.small}`} onClick={() => update(row.id, { archived: !row.archived, active: row.archived ? row.active : false })}>{row.archived ? "復元" : "アーカイブ"}</button></span></td>
          </tr>
        ))}</tbody>
      </table>
    </div>
  );
}

export default function PpfSettingsClient() {
  const [basePrices, setBasePrices] = useState(MOCK_BASE);
  const [films, setFilms] = useState(INITIAL_FILMS);
  const [scopes, setScopes] = useState(INITIAL_SCOPES);
  const [interior, setInterior] = useState(INITIAL_INTERIOR);
  const [parts, setParts] = useState(INITIAL_PARTS);
  const [coating, setCoating] = useState({ price: "30000", time: "60", active: true });
  const [windshield, setWindshield] = useState<Row[]>([
    { id: "wind-gyeon", name: "GYEON ウインドフィルム PPF", price: "", time: "", active: true, standard: true },
    { id: "wind-custom", name: "", price: "", time: "", active: true },
  ]);
  const [materials, setMaterials] = useState<Record<string, "TPU" | "PET">>({ "wind-gyeon": "TPU", "wind-custom": "TPU" });
  const [archiveTarget, setArchiveTarget] = useState<string | null>(null);
  const [saveMessage, setSaveMessage] = useState("");
  const isDirty = true;

  const updateFilm = (id: string, patch: Partial<Film>) => setFilms(rows => rows.map(row => row.id === id ? { ...row, ...patch } : row));
  const addRow = (setter: Dispatch<SetStateAction<Row[]>>, prefix: string) => setter(rows => [...rows, { id: `${prefix}-${Date.now()}`, name: "", price: "", time: "", active: true }]);

  return (
    <div className={styles.root} data-testid="ppf-settings-r1" data-size-contract="SS,S,M,ML,L,LL,XL">
      <header className={styles.header}>
        <div className={styles.headerIcon}><PpfIcon /></div>
        <div><h1>PPF種類・施工係数</h1><div className={styles.en}>PPF TYPES &amp; INSTALLATION COEFFICIENTS</div></div>
      </header>
      <div className={styles.breadcrumb}>DETAILER AGENT / SETTINGS / <b>PPF / TYPES &amp; COEFFICIENTS</b></div>
      <div className={styles.notice} role="status"><span><b>この画面の金額・係数・所要時間はすべてモック用参考値です。</b><br />正式値ではありません。初期登録値・DB seed値として使用しないでください。空欄＝未設定、0円＝意図的な無料として厳密に区別されます。</span></div>

      <section className={styles.panel} data-component="price-matrix">
        <h2>基準価格（サイズ別・税抜）<span className={styles.warnChip}>要確認：表示値はモック用参考値（正式値未確定）</span></h2>
        <p>PPFの基準価格をサイズごとに設定します。種類ごとの価格は「基準価格 × 施工係数」で自動計算されます。</p>
        <div className={styles.sizeGrid}>{SIZES.map((size, index) => <label className={styles.sizeCell} key={size}><span className={styles.sizeLabel}>{size}</span><input aria-label={`基準価格 ${size}`} className={`${styles.input} ${styles.price}`} inputMode="numeric" value={basePrices[index]} onChange={e => setBasePrices(values => values.map((value, i) => i === index ? e.target.value.replace(/\D/g, "") : value))} /></label>)}</div>
        <p className={styles.subnote}>表示価格は、正式な価格計算契約に基づいて算定されます。係数・施工プラン・車両条件の適用範囲は実装仕様で確定します。</p>
      </section>

      <section className={styles.panel} data-component="ppf-type-master">
        <h2>PPF種類マスタ <span className={styles.subnote}>デフォルトはGYEONラインナップ・他メーカー種も行追加で登録可能</span></h2>
        <div className={styles.scroll}><table className={styles.table}><thead><tr><th>種類名</th><th>施工係数（×）</th><th>提供状態</th><th>操作</th></tr></thead><tbody>
          {films.map((film, index) => <tr key={film.id} className={film.archived ? styles.archivedRow : undefined}>
            <td>{index === 0 && <span className={styles.en}>GLOSS / MATTE / COLOR PROTECTION</span>}<input className={styles.input} readOnly={film.standard} value={film.name} placeholder="製品名" onChange={e => updateFilm(film.id, { name: e.target.value })} />{!film.standard && <span className={styles.customBadge}>他社製品</span>}</td>
            <td><input className={`${styles.input} ${styles.coefficient}`} inputMode="decimal" value={film.coefficient} placeholder="未設定" onChange={e => updateFilm(film.id, { coefficient: e.target.value })} /></td>
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
        <p>PPF施工と併せて選択された場合に加算されます。PPF＋コーティング減額は別画面で設定します。</p>
      </section>

      <section className={styles.panel} data-component="ppf-indoor">
        <h2>室内PPF（税抜） <span className={styles.subnote}>係数適用外・手入力金額のみ</span></h2>
        <EditableRows rows={interior} setRows={setInterior} nameLabel="項目名" />
        <button type="button" className={styles.button} onClick={() => addRow(setInterior, "interior")}>＋ 室内PPF項目を追加</button>
      </section>

      <section className={styles.panel} data-component="ppf-partial">
        <h2>部分PPF施工・単体用（税抜） <span className={styles.subnote}>コーティング付帯用とは別管理</span></h2>
        <EditableRows rows={parts} setRows={setParts} nameLabel="施工部位" />
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
        <button type="button" className={`${styles.button} ${styles.primary}`} disabled={!isDirty} onClick={() => setSaveMessage("保存契約は未接続です。入力内容はまだ登録されていません。")}>保存する</button>
      </div>

      {archiveTarget && <div className={styles.modalBackdrop} role="presentation"><div className={styles.modal} role="dialog" aria-modal="true" aria-labelledby="ppf-archive-title"><h3 id="ppf-archive-title">この項目をアーカイブしますか？</h3><p>見積ウィザードには表示されなくなりますが、過去の記録は保持され、復元できます。ハード削除は行いません。</p><div className={styles.footer}><button type="button" className={styles.button} onClick={() => setArchiveTarget(null)}>キャンセル</button><button type="button" className={`${styles.button} ${styles.primary}`} onClick={() => { updateFilm(archiveTarget, { archived: true, active: false }); setArchiveTarget(null); }}>アーカイブする</button></div></div></div>}
    </div>
  );
}
