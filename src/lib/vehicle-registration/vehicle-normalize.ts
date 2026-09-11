// Post-OCR normalization for maker / model.
//
// The AI is NOT trusted alone to split these. In a Japanese 車検証 the 車名
// (vehicle_name) is usually the MAKER (トヨタ / フェラーリ), sometimes a combined
// "トヨタ クラウン アスリート". We deterministically:
//   - detect the MAKER against a known-maker list,
//   - strip it from the vehicle_name to recover the full MODEL remainder.
// Grade is always manual — OCR never derives or emits it.
//
// Pure module. Safe for client or server import.

// Known makers (JP + import). Order matters only for display; matching is by inclusion.
const KNOWN_MAKERS: string[] = [
  "トヨタ", "レクサス", "ホンダ", "日産", "ニッサン", "マツダ", "スバル", "三菱", "ミツビシ",
  "スズキ", "ダイハツ", "いすゞ", "ヒノ", "UD",
  "メルセデス", "ベンツ", "BMW", "アウディ", "フォルクスワーゲン", "VW", "ボルボ",
  "ポルシェ", "フェラーリ", "ランボルギーニ", "マクラーレン", "アストンマーティン",
  "マセラティ", "ベントレー", "ロールスロイス", "ジャガー", "ランドローバー", "レンジローバー",
  "プジョー", "ルノー", "シトロエン", "フィアット", "アルファロメオ", "アバルト",
  "ジープ", "テスラ", "ヒュンダイ", "現代", "キア", "フォード", "シボレー", "ダッジ",
  "キャデラック", "MINI", "ミニ", "スマート", "ロータス", "ハマー", "GMC",
];

export interface NormalizedVehicle {
  maker: string;
  model: string;
  /** true when normalization changed the raw OCR values. */
  changed: boolean;
}

function tidy(s: string | null | undefined): string {
  return (s ?? "").replace(/[　\s]+/g, " ").trim();
}

/**
 * Normalize maker/model from raw OCR fields.
 * - maker: from the OCR maker if it's a known maker, else detected inside 車名.
 * - model (車名): the COMPLETE remaining text of 車名 after the maker is stripped
 *   (e.g. "トヨタ クラウン アスリート" → model="クラウン アスリート"). Blank when only the
 *   maker was detected (e.g. "フェラーリ" → maker=フェラーリ, model=""). The remainder is
 *   never split into trailing grade tokens — grade is always manual.
 */
export function normalizeVehicleFields(input: {
  maker?:       string | null;
  vehicleName?: string | null;
}): NormalizedVehicle {
  const rawMaker = tidy(input.maker);
  const rawName  = tidy(input.vehicleName);

  let maker = "";

  // 1) Trust an OCR maker only if it's a known maker.
  const makerHit = KNOWN_MAKERS.find((m) => rawMaker === m || rawMaker.startsWith(m));
  if (makerHit) maker = makerHit;

  // 2) Otherwise, detect the maker inside 車名 (which often carries the maker).
  const nameMakerHit = KNOWN_MAKERS.find((m) => rawName.startsWith(m) || rawName.includes(m));
  if (!maker && nameMakerHit) maker = nameMakerHit;

  // 3) Fallback: keep a raw maker verbatim if nothing matched.
  if (!maker && rawMaker) maker = rawMaker;

  // 4) The 車名 remainder (maker stripped) is kept whole as the model.
  let model = "";
  if (rawName) {
    const remainder = tidy(maker ? rawName.replace(maker, "") : rawName);
    if (remainder && remainder !== maker) model = remainder;
  }

  const changed = maker !== rawMaker || model !== rawName;
  return { maker, model, changed };
}
