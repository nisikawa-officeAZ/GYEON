"use client";

import Link from "next/link";
import { useState, useTransition, type Dispatch, type SetStateAction } from "react";
import type { AuthoritativeWindowFilmV1ReadResult } from "@/lib/pricing/get-authoritative-window-film-v1-settings";
import { saveAuthoritativeWindowFilmV1Settings } from "@/lib/pricing/save-authoritative-window-film-v1-settings";
import {
  WINDOW_FILM_V1_AREA_CODES,
  type WindowFilmAreaCode,
  type WindowFilmCustomItem,
  type WindowFilmSettingsV1,
} from "@/lib/pricing/window-film-v1-contract";
import type { WindowFilmTypeReadSetting, WindowFilmTypeSetting } from "@/lib/pricing/window-film-type-contract";
import styles from "./WindowFilmSettingsClient.module.css";
import SettingsBackControl from "./SettingsBackControl";

const AREA_LABELS: Record<WindowFilmAreaCode, string> = {
  "front-windshield": "フロントガラス",
  "front-door-glass": "フロントドアガラス",
  "rear-door-glass": "リアドアガラス",
  "triangular-window": "三角窓",
  "quarter-glass": "クォーターガラス",
  "rear-glass": "リアガラス（リアハッチ）",
  sunroof: "サンルーフ",
};

const SAMPLE_AREA: Record<WindowFilmAreaCode, { price: string; time: string }> = {
  "front-windshield": { price: "30000", time: "60" },
  "front-door-glass": { price: "20000", time: "40" },
  "rear-door-glass": { price: "20000", time: "40" },
  "triangular-window": { price: "", time: "" },
  "quarter-glass": { price: "", time: "" },
  "rear-glass": { price: "25000", time: "50" },
  sunroof: { price: "", time: "" },
};

const SAMPLE_FILMS: WindowFilmTypeSetting[] = [
  { itemId: null, code: null, name: "透明断熱フィルム（スタンダード）", installationCoefficientBp: 10_000, irCutPercent: 85, uvCutPercent: 99, isActive: true, displayOrder: 0, expectedUpdatedAt: null },
  { itemId: null, code: null, name: "透明断熱フィルム（プレミアム）", installationCoefficientBp: 13_000, irCutPercent: 95, uvCutPercent: 99, isActive: true, displayOrder: 1, expectedUpdatedAt: null },
  { itemId: null, code: null, name: "スモークフィルム（断熱タイプ）", installationCoefficientBp: 12_000, irCutPercent: 90, uvCutPercent: 99, isActive: true, displayOrder: 2, expectedUpdatedAt: null },
];

type AreaDraft = { price: string; time: string; active: boolean };
type ItemDraft = { code: string; name: string; price: string; time: string; active: boolean };
type FilmDraft = WindowFilmTypeReadSetting & { coefficient: string; ir: string; uv: string };

function numberText(value: number | null): string { return value === null ? "" : String(value); }
function parseNonNegative(value: string): number | null | undefined {
  if (value.trim() === "") return null;
  if (!/^\d+$/.test(value)) return undefined;
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) ? parsed : undefined;
}
function draftItems(items: WindowFilmCustomItem[]): ItemDraft[] {
  return items.map((item) => ({ code: item.code, name: item.name, price: numberText(item.priceYen), time: numberText(item.durationMinutes), active: item.isActive }));
}
function initialAreas(resolution: AuthoritativeWindowFilmV1ReadResult): Record<WindowFilmAreaCode, AreaDraft> {
  return Object.fromEntries(WINDOW_FILM_V1_AREA_CODES.map((code) => {
    const settings = resolution.status === "READY"
      ? resolution.settings
      : resolution.status === "LEGACY_REVIEW_REQUIRED"
        ? resolution.draft
        : null;
    if (settings) {
      const item = settings.areas[code];
      return [code, { price: numberText(item.priceYen), time: numberText(item.durationMinutes), active: item.isActive }];
    }
    return [code, { ...SAMPLE_AREA[code], active: SAMPLE_AREA[code].price !== "" && SAMPLE_AREA[code].time !== "" }];
  })) as Record<WindowFilmAreaCode, AreaDraft>;
}
function initialFilms(resolution: AuthoritativeWindowFilmV1ReadResult): FilmDraft[] {
  const source = "films" in resolution && resolution.films.length > 0 ? resolution.films : SAMPLE_FILMS;
  return source.map((film) => ({ ...film, coefficient: film.installationCoefficientBp === null ? "" : String(film.installationCoefficientBp / 10_000), ir: numberText(film.irCutPercent), uv: numberText(film.uvCutPercent) }));
}

function WindowFilmIcon() {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M3.5 16.5c2-4.5 4-7 7-8l2-2.5h6.5l2.5 4.5c.6 1 .4 2-.3 3l-1.2 1.5c-.5.7-1.2 1.5-2 1.5z" opacity=".9"/><path d="M3.5 16.5c2-4.5 4-7 7-8l2-2.5"/><path d="M12.5 8.5l-1.2 6M16 6l-.8 8.5" opacity=".55"/><path d="M13.5 10.5l3 3" opacity=".8"/></svg>;
}

export default function WindowFilmSettingsClient({ resolution }: { resolution: AuthoritativeWindowFilmV1ReadResult }) {
  const persisted = resolution.status === "READY";
  const readUnavailable = ["MALFORMED", "UNAUTHENTICATED", "READ_FAILED"].includes(resolution.status);
  const [areas, setAreas] = useState(() => initialAreas(resolution));
  const [films, setFilms] = useState(() => initialFilms(resolution));
  const [packages, setPackages] = useState<ItemDraft[]>(() => resolution.status === "READY"
    ? draftItems(resolution.settings.packages)
    : resolution.status === "LEGACY_REVIEW_REQUIRED" && resolution.draft
      ? draftItems(resolution.draft.packages)
      : []);
  const [options, setOptions] = useState<ItemDraft[]>(() => resolution.status === "READY" ? draftItems(resolution.settings.options) : [{ code: "draft-option-removal", name: "既存フィルム剥がし", price: "8000", time: "30", active: true }]);
  const [notice, setNotice] = useState<"sample" | "dirty" | "saved">(persisted ? "saved" : "sample");
  const [message, setMessage] = useState("");
  const [pending, startTransition] = useTransition();
  const revision = resolution.status === "READY" ? resolution.settings.revision : 0;
  const dirty = () => { setNotice("dirty"); setMessage(""); };

  const updateFilm = (index: number, patch: Partial<FilmDraft>) => { setFilms(rows => rows.map((row, i) => i === index ? { ...row, ...patch } : row)); dirty(); };
  const removeFilm = (index: number) => { setFilms(rows => rows.filter((_, i) => i !== index)); dirty(); };
  const updateItem = (setter: Dispatch<SetStateAction<ItemDraft[]>>, index: number, patch: Partial<ItemDraft>) => { setter(rows => rows.map((row, i) => i === index ? { ...row, ...patch } : row)); dirty(); };
  const addItem = (setter: Dispatch<SetStateAction<ItemDraft[]>>, prefix: string) => { setter(rows => [...rows, { code: `${prefix}-${Date.now()}`, name: "", price: "", time: "", active: false }]); dirty(); };

  const save = () => {
    const parsedAreas = Object.fromEntries(WINDOW_FILM_V1_AREA_CODES.map((code) => {
      const entry = areas[code];
      return [code, { priceYen: parseNonNegative(entry.price), durationMinutes: parseNonNegative(entry.time), isActive: entry.active }];
    }));
    const parseCustom = (rows: ItemDraft[]): WindowFilmCustomItem[] | null => {
      const parsed = rows.map((row, index) => ({ code: row.code, name: row.name.trim(), priceYen: parseNonNegative(row.price), durationMinutes: parseNonNegative(row.time), isActive: row.active, displayOrder: index }));
      if (parsed.some((row) => row.name === "" || row.priceYen === undefined || row.durationMinutes === undefined)) return null;
      return parsed as WindowFilmCustomItem[];
    };
    const parsedPackages = parseCustom(packages);
    const parsedOptions = parseCustom(options);
    const parsedFilms = films.map((film, index) => ({
      itemId: film.itemId,
      code: film.code,
      name: film.name.trim(),
      installationCoefficientBp: Number(film.coefficient) * 10_000,
      irCutPercent: parseNonNegative(film.ir),
      uvCutPercent: parseNonNegative(film.uv),
      isActive: film.isActive,
      displayOrder: index,
      expectedUpdatedAt: film.expectedUpdatedAt,
    }));
    if (Object.values(parsedAreas).some((row) => row.priceYen === undefined || row.durationMinutes === undefined)
      || !parsedPackages || !parsedOptions
      || parsedFilms.some((film) => film.name === "" || !Number.isInteger(film.installationCoefficientBp) || film.irCutPercent === undefined || film.uvCutPercent === undefined)) {
      setMessage("入力内容を確認してください。金額・時間・割合は0以上の整数、施工係数は小数第4位までです。"); return;
    }
    const payload: WindowFilmSettingsV1 = {
      contractVersion: "1.0", revision,
      areas: parsedAreas as WindowFilmSettingsV1["areas"],
      packages: parsedPackages,
      options: parsedOptions,
    };
    startTransition(async () => {
      const result = await saveAuthoritativeWindowFilmV1Settings(payload, parsedFilms, revision);
      if (result.status === "SAVED") {
        setNotice("saved");
        setMessage("ウインドウフィルム設定を保存しました。");
        window.location.reload();
      }
      else if (result.status === "REVISION_CONFLICT") setMessage("別の画面で設定が更新されました。再読み込みしてから入力し直してください。");
      else if (result.status === "UNAUTHORIZED") setMessage("保存権限がありません。オーナーまたはマネージャーで実行してください。");
      else setMessage("保存できませんでした。入力内容は登録されていません。");
    });
  };

  if (readUnavailable) return <div className={styles.root}><SettingsBackControl className="mb-4" href="/settings" label="設定一覧へ戻る" /><div className={styles.error}>設定を安全に読み込めなかったため、編集を停止しました。再読み込みしてください。</div></div>;
  return (
    <div className={styles.root} data-testid="window-film-settings-v1">
      <SettingsBackControl className="mb-4" href="/settings" label="設定一覧へ戻る" />
      <header className={styles.header}><div className={styles.icon}><WindowFilmIcon /></div><div><h1>ウインドウフィルム設定</h1><div className={styles.en}>WINDOW FILM SETTINGS</div></div></header>
      <div className={styles.breadcrumb}>DETAILER AGENT / SETTINGS / <b>WINDOW FILM</b></div>
      {notice === "sample" ? <div className={styles.notice}><b>画面に表示されている金額・係数・作業時間は、表示確認のためのサンプルです。実際の設定には使用されません。</b><br/>ご利用前に、店舗で使用する正しい内容を入力してください。空欄は「未設定」、0円は「無料」として登録されます。</div> : notice === "dirty" ? <div className={styles.notice}><b>入力内容はまだ保存されていません。</b><br/>登録する場合は、画面下の「保存する」を押してください。</div> : null}
      {resolution.status === "LEGACY_REVIEW_REQUIRED" && <div className={styles.notice}>旧設定から候補を確認する必要があります。保存するまで旧データは変更されません。</div>}

      <section className={styles.panel}><h2>フィルム種類マスタ</h2><p>施工係数は部位・セット価格に掛け合わせます。IR/UVカット率は見積・提案資料への表示用です。</p><div className={styles.scroll}><table><thead><tr><th>フィルム名</th><th>施工係数（×）</th><th>IRカット（%）</th><th>UVカット（%）</th><th>提供状態</th><th>操作</th></tr></thead><tbody>{films.map((film, index) => <tr key={film.itemId ?? `new-${index}`}><td data-label="フィルム名"><input value={film.name} onChange={e => updateFilm(index, { name: e.target.value })}/></td><td data-label="施工係数（×）"><input className={styles.numeric} inputMode="decimal" value={film.coefficient} onChange={e => updateFilm(index, { coefficient: e.target.value })}/></td><td data-label="IRカット（%）"><input className={styles.numeric} inputMode="numeric" value={film.ir} placeholder="任意" onChange={e => updateFilm(index, { ir: e.target.value.replace(/\D/g, "") })}/></td><td data-label="UVカット（%）"><input className={styles.numeric} inputMode="numeric" value={film.uv} placeholder="任意" onChange={e => updateFilm(index, { uv: e.target.value.replace(/\D/g, "") })}/></td><td data-label="提供状態"><button type="button" className={`${styles.button} ${film.isActive ? styles.active : ""}`} onClick={() => updateFilm(index, { isActive: !film.isActive })}>{film.isActive ? "提供中" : "提供停止"}</button></td><td data-label="操作"><button type="button" className={styles.button} onClick={() => removeFilm(index)}>{film.itemId ? "アーカイブ" : "削除"}</button></td></tr>)}</tbody></table></div><button type="button" className={styles.button} onClick={() => { setFilms(rows => [...rows, { itemId: null, code: null, name: "", installationCoefficientBp: 10_000, coefficient: "1", ir: "", uv: "", irCutPercent: null, uvCutPercent: null, isActive: false, displayOrder: rows.length, expectedUpdatedAt: null }]); dirty(); }}>＋ フィルム種類を追加</button></section>

      <section className={styles.panel}><h2>部位別価格・所要時間（税抜）</h2><p>固定7部位の名称は変更できません。金額と時間が設定された提供中の部位だけを見積で使用できます。</p><div className={styles.scroll}><table><thead><tr><th>施工部位</th><th>金額（円・税抜）</th><th>所要時間（分）</th><th>提供状態</th></tr></thead><tbody>{WINDOW_FILM_V1_AREA_CODES.map(code => <tr key={code}><td data-label="施工部位"><input readOnly value={AREA_LABELS[code]}/></td><td data-label="金額（円・税抜）"><input className={styles.numeric} inputMode="numeric" placeholder="未設定" value={areas[code].price} onChange={e => { setAreas(v => ({ ...v, [code]: { ...v[code], price: e.target.value.replace(/\D/g, "") } })); dirty(); }}/></td><td data-label="所要時間（分）"><input className={styles.numeric} inputMode="numeric" placeholder="未設定" value={areas[code].time} onChange={e => { setAreas(v => ({ ...v, [code]: { ...v[code], time: e.target.value.replace(/\D/g, "") } })); dirty(); }}/></td><td data-label="提供状態"><button type="button" className={`${styles.button} ${areas[code].active ? styles.active : ""}`} onClick={() => { setAreas(v => ({ ...v, [code]: { ...v[code], active: !v[code].active } })); dirty(); }}>{areas[code].active ? "提供中" : "提供停止"}</button></td></tr>)}</tbody></table></div></section>

      <CustomSection title="セットメニュー（税抜）" description="セットは部位選択と同時に使えません。見積ではどちらか一方を選びます。" rows={packages} setter={setPackages} update={updateItem} add={() => addItem(setPackages, "draft-package")}/>
      <CustomSection title="オプション（税抜）" description="付帯作業はフィルム係数を掛けず、選択数に応じて加算します。" rows={options} setter={setOptions} update={updateItem} add={() => addItem(setOptions, "draft-option")}/>
      <footer className={styles.footer}>{message && <span className={styles.message}>{message}</span>}<Link className={styles.button} href="/settings">キャンセル</Link><button type="button" className={`${styles.button} ${styles.primary}`} disabled={pending} onClick={save}>{pending ? "保存中…" : "保存する"}</button></footer>
    </div>
  );
}

function CustomSection({ title, description, rows, setter, update, add }: { title: string; description: string; rows: ItemDraft[]; setter: Dispatch<SetStateAction<ItemDraft[]>>; update: (setter: Dispatch<SetStateAction<ItemDraft[]>>, index: number, patch: Partial<ItemDraft>) => void; add: () => void }) {
  return <section className={styles.panel}><h2>{title}</h2><p>{description}</p><div className={styles.scroll}><table><thead><tr><th>項目名</th><th>金額（円・税抜）</th><th>所要時間（分）</th><th>提供状態</th></tr></thead><tbody>{rows.map((row, index) => <tr key={row.code}><td data-label="項目名"><input value={row.name} placeholder="名称" onChange={e => update(setter, index, { name: e.target.value })}/></td><td data-label="金額（円・税抜）"><input className={styles.numeric} inputMode="numeric" value={row.price} placeholder="未設定" onChange={e => update(setter, index, { price: e.target.value.replace(/\D/g, "") })}/></td><td data-label="所要時間（分）"><input className={styles.numeric} inputMode="numeric" value={row.time} placeholder="未設定" onChange={e => update(setter, index, { time: e.target.value.replace(/\D/g, "") })}/></td><td data-label="提供状態"><button type="button" className={`${styles.button} ${row.active ? styles.active : ""}`} onClick={() => update(setter, index, { active: !row.active })}>{row.active ? "提供中" : "提供停止"}</button></td></tr>)}</tbody></table></div><button type="button" className={styles.button} onClick={add}>＋ 項目を追加</button></section>;
}
