// Estimate Wizard Ver2.2 — PPF presentation configuration (Phase 4B).
//
// Default labels/structure ONLY — NO prices, NO coefficients, NO calculation. In
// production these are supplied by Store Settings; here they seed the preview and give
// the owner a starting point. Store Settings can add/edit/delete/reorder and mark items
// disabled — the components consume the resulting lists purely through props.

import type {
  InstallationMethodOption, PpfPartOption, PpfTypeGroup,
} from "./step-types";

/** Five installation methods (Ver2.2 — panoramic roof intentionally absent). */
export const DEFAULT_PPF_METHODS: InstallationMethodOption[] = [
  { id: "full",       label: "フル施工",      subLabel: "全ボディ全面 PPF 施工" },
  { id: "partial",    label: "部分施工",      subLabel: "部位を選択して施工" },
  { id: "windshield", label: "フロントガラス", subLabel: "ウィンドシールド専用 PPF" },
  { id: "sunroof",    label: "サンルーフ",     subLabel: "サンルーフ専用 PPF" },
  { id: "interior",   label: "室内PPF施工",    subLabel: "施工箇所・金額を手入力（行追加可）" },
];

/** Default partial-part master (store-configurable). `quantityRequired` is a per-part rule. */
export const DEFAULT_PPF_PARTS: PpfPartOption[] = [
  { id: "front-bumper", label: "フロントバンパー" },
  { id: "bonnet",       label: "ボンネット" },
  { id: "fender",       label: "フェンダー" },
  { id: "door",         label: "ドア" },
  { id: "door-edge",    label: "ドアエッジ" },
  { id: "rocker",       label: "ロッカーパネル" },
  { id: "side-step",    label: "サイドステップ", quantityRequired: true, minQty: 1, maxQty: 4 },
  { id: "a-pillar",     label: "Aピラー" },
  { id: "b-pillar",     label: "Bピラー" },
  { id: "c-pillar",     label: "Cピラー" },
  { id: "roof",         label: "ルーフ" },
  { id: "trunk",        label: "トランク" },
  { id: "door-mirror",  label: "ドアミラー" },
  { id: "headlight",    label: "ヘッドライト" },
  { id: "taillight",    label: "テールランプ" },
  { id: "other",        label: "その他" },
];

/** Default PPF product groups (store-configurable; supports non-GYEON/custom via props). */
export const DEFAULT_PPF_TYPE_GROUPS: PpfTypeGroup[] = [
  {
    id: "gloss", label: "グロス・プロテクション（光沢・透明）",
    products: [
      { id: "protect-plus", label: "PPF PROTECT+", brand: "GYEON" },
      { id: "enhance",      label: "PPF ENHANCE",  brand: "GYEON" },
      { id: "hybrid",       label: "PPF HYBRID",   brand: "GYEON" },
    ],
  },
  {
    id: "matte", label: "マット・ステルス（艶消し）",
    products: [{ id: "matte", label: "PPF MATTE", brand: "GYEON" }],
  },
  {
    id: "color", label: "カラー＆カスタム（ドレスアップ）",
    products: [
      { id: "black",     label: "PPF BLACK",      brand: "GYEON" },
      { id: "tint",      label: "TINT",           brand: "GYEON" },
      { id: "carbon",    label: "PPF CARBON",     brand: "GYEON" },
      { id: "color-line", label: "PPF COLOR LINE", brand: "GYEON" },
    ],
  },
];
