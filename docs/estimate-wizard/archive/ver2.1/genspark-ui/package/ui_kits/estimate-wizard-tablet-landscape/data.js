/* =============================================================================
   Estimate Wizard — Mock Data
   -----------------------------------------------------------------------------
   Ver2.0 依頼書 §5 の binding データ構造をそのまま反映。
   本番では src/lib/pricing/pricing-data.ts に相当する。
   ============================================================================= */

/* Ver2.0 §5 Screen3 — 7 カテゴリ確定 */
window.CATEGORIES = [
  { id: 'coating',     label: 'コーティング',           icon: 'sparkles',   sub: 'ボディコーティング全般' },
  { id: 'ppf',         label: 'PPF',                    icon: 'shield',     sub: 'ペイント プロテクション フィルム' },
  { id: 'window',      label: 'ウィンドウフィルム',       icon: 'square',     sub: 'ウィンドウフィルム施工' },
  { id: 'maintenance', label: 'ボディ定期メンテナンス',   icon: 'wrench',     sub: '定期メンテナンス' },
  { id: 'carwash',     label: '洗車',                    icon: 'droplets',   sub: 'メンテナンス洗車' },
  { id: 'roomclean',   label: 'ルームクリーニング',       icon: 'sparkle',    sub: '車内清掃' },
  { id: 'other',       label: 'その他の作業',            icon: 'clipboard',  sub: 'カスタム作業' },
];

/* Ver2.0 §5 Screen2 — ボディサイズ 7 段階（3M推定→7ボタン） */
window.BODY_SIZES = [
  { id: 'SS', label: 'SS', desc: '軽自動車 / コンパクト',        multiplier: 0.75 },
  { id: 'S',  label: 'S',  desc: 'ミニバン小 / セダン小',       multiplier: 0.85 },
  { id: 'M',  label: 'M',  desc: 'セダン標準 / SUV小',           multiplier: 1.00 },
  { id: 'ML', label: 'ML', desc: 'SUV中 / セダン大',              multiplier: 1.15 },
  { id: 'L',  label: 'L',  desc: 'ミニバン大 / SUV大',            multiplier: 1.30 },
  { id: 'LL', label: 'LL', desc: 'アルファード級 / 大型 SUV',    multiplier: 1.45 },
  { id: 'XL', label: 'XL', desc: '大型 / 特殊車',                multiplier: 1.60 },
];

/* Ver2.0 §5 Screen4 — コーティング レイヤー選択マトリクス
   ショップランクは店舗設定由来 (dealerRank)。
   ここでは 3 ランク全部の 1〜3 層構造をデータ化する。 */
window.COATING_MATRIX = {
  ranks: [
    { id: 'shop',       label: 'GYEONショップ' },
    { id: 'detailer',   label: 'GYEONディテーラー' },
    { id: 'certified',  label: 'GYEONサーティファイドディテーラー' },
  ],
  /* 1 層目の候補 (rank 別)
     グループ構造: [{ tier, items }]
     - tier 1: スタンダード系 (CANCOAT EVO / ONE EVO / PURE EVO)
     - tier 2: 高性能系 (MOHS EVO / SYNCRO EVO / MATTE EVO)
     - tier 3: 最上位系 (INFINITE BASE TYPE 1 / TYPE 2)
     ランクに応じてグループごとに含まれる項目を絞る。空グループは非表示。 */
  base: {
    shop: [
      { tier: 'standard', label: 'スタンダード', items: ['CANCOAT EVO', 'ONE EVO'] },
    ],
    detailer: [
      { tier: 'standard', label: 'スタンダード', items: ['CANCOAT EVO', 'ONE EVO', 'PURE EVO'] },
      { tier: 'high',     label: '高性能',       items: ['MOHS EVO', 'SYNCRO EVO', 'MATTE EVO'] },
    ],
    certified: [
      { tier: 'standard', label: 'スタンダード', items: ['CANCOAT EVO', 'ONE EVO', 'PURE EVO'] },
      { tier: 'high',     label: '高性能',       items: ['MOHS EVO', 'SYNCRO EVO', 'MATTE EVO'] },
      { tier: 'infinite', label: 'INFINITE (最上位)', items: ['INFINITE BASE TYPE 1', 'INFINITE BASE TYPE 2'] },
    ],
  },
  /* 2 層目 (base → 候補) */
  layer2: {
    shop: {
      'ONE EVO':    ['ONE EVO', 'CANCOAT EVO'],
    },
    detailer: {
      'ONE EVO':    ['ONE EVO', 'CANCOAT EVO'],
      'PURE EVO':   ['PURE EVO', 'CANCOAT EVO'],
      'MOHS EVO':   ['MOHS EVO', 'CANCOAT EVO'],
      'MATTE EVO':  ['MATTE EVO'],
      'SYNCRO EVO': ['MOHS EVO'],  // デフォルト2層構造のため
    },
    certified: {
      'ONE EVO':               ['ONE EVO', 'CANCOAT EVO'],
      'PURE EVO':              ['PURE EVO', 'CANCOAT EVO'],
      'MOHS EVO':              ['MOHS EVO', 'CANCOAT EVO'],
      'MATTE EVO':             ['MATTE EVO'],
      'SYNCRO EVO':            ['MOHS EVO'],
      'INFINITE BASE TYPE 1':  ['INFINITE BASE TYPE 1', 'INFINITE TOPCOAT TYPE 1', 'INFINITE TOPCOAT TYPE 2'],
      'INFINITE BASE TYPE 2':  ['INFINITE BASE TYPE 2', 'INFINITE TOPCOAT TYPE 1', 'INFINITE TOPCOAT TYPE 2'],
    },
  },
  /* 3 層目 (base → 候補) */
  layer3: {
    shop: {},
    detailer: {
      'ONE EVO':    ['CANCOAT EVO'],
      'PURE EVO':   ['CANCOAT EVO'],
      'MOHS EVO':   ['CANCOAT EVO'],
    },
    certified: {
      'ONE EVO':               ['CANCOAT EVO'],
      'PURE EVO':              ['CANCOAT EVO'],
      'MOHS EVO':              ['CANCOAT EVO'],
      'INFINITE BASE TYPE 1':  ['INFINITE TOPCOAT TYPE 1', 'INFINITE TOPCOAT TYPE 2'],
      'INFINITE BASE TYPE 2':  ['INFINITE TOPCOAT TYPE 1', 'INFINITE TOPCOAT TYPE 2'],
    },
  },
  /* 基本価格 (M サイズ・1 層基準) */
  basePrice: {
    'ONE EVO':                  60000,
    'PURE EVO':                 80000,
    'MOHS EVO':                120000,
    'SYNCRO EVO':              140000,
    'MATTE EVO':               110000,
    'CANCOAT EVO':              25000,
    'INFINITE BASE TYPE 1':    180000,
    'INFINITE BASE TYPE 2':    200000,
    'INFINITE TOPCOAT TYPE 1':  40000,
    'INFINITE TOPCOAT TYPE 2':  50000,
  },
};

/* Ver2.0 §5 Screen4 — PPF 種類 (確定) */
window.PPF_TYPES = {
  gloss: {
    label: 'グロス・プロテクション（光沢・透明）',
    items: [
      { id: 'protect+', name: 'PPF PROTECT+',  desc: 'スタンダード保護',           coef: 1.00 },
      { id: 'enhance',  name: 'PPF ENHANCE',   desc: '光沢増強タイプ',             coef: 1.15 },
      { id: 'hybrid',   name: 'PPF HYBRID',    desc: '光沢＋耐擦性',               coef: 1.30 },
    ],
  },
  matte: {
    label: 'マット・ステルス（艶消し）',
    items: [
      { id: 'matte',    name: 'PPF MATTE',     desc: '完全艶消し',                 coef: 1.20 },
    ],
  },
  color: {
    label: 'カラー＆カスタム（ドレスアップ）',
    items: [
      { id: 'black',    name: 'PPF BLACK',       desc: 'グロスブラック',           coef: 1.10 },
      { id: 'tint',     name: 'TINT',            desc: '窓・ライト用ティント',      coef: 0.60 },
      { id: 'carbon',   name: 'PPF CARBON',      desc: 'カーボン柄',               coef: 1.35 },
      { id: 'colorline',name: 'PPF COLOR LINE',  desc: '各種カラー',               coef: 1.25 },
    ],
  },
};

/* Ver2.0 §5 Screen4 — PPF 部分施工 箇所定義
   scope='partial' 選択時に表示される 6 項目。
   `positions` がある項目 (ドアカップ / ステップ) は複数箇所選択 UI が展開される。
   価格は M サイズ基準・単位あたり。ボディサイズ倍率は Screen 4 の明細生成で適用。 */
window.PPF_PARTIAL_PARTS = [
  /* 現行 6 部位 (v2.0 で確定) */
  { id: 'door-mirror',  name: 'ドアミラー',       price: 12000, positions: null },
  { id: 'door-cup',     name: 'ドアカップ',       price:  6000, positions: [
    { id: 'fr', label: '前右' },
    { id: 'fl', label: '前左' },
    { id: 'rr', label: '後右' },
    { id: 'rl', label: '後左' },
  ] },
  { id: 'pillar-b',     name: 'Bピラー',          price: 15000, positions: null },
  { id: 'pillar-c',     name: 'Cピラー',          price: 15000, positions: null },
  { id: 'step',         name: 'ステップ',         price: 10000, positions: [
    { id: 'fr', label: '前右' },
    { id: 'fl', label: '前左' },
    { id: 'rr', label: '後右' },
    { id: 'rl', label: '後左' },
  ] },
  { id: 'rear-bumper-top', name: 'リアバンパー上部', price: 18000, positions: null },

  /* v2.2 追加 7 部位 (依頼書§5-Screen4 補記 — 実装忘れの回復) */
  { id: 'roof',            name: 'ルーフ (屋根)',         price: 45000, positions: null },
  { id: 'sunroof',         name: 'サンルーフ',            price: 20000, positions: null },
  { id: 'door-edge',       name: 'ドアエッジ',            price:  8000, positions: [
    { id: 'fr', label: '前右' },
    { id: 'fl', label: '前左' },
    { id: 'rr', label: '後右' },
    { id: 'rl', label: '後左' },
  ] },
  { id: 'front-window',    name: 'フロントウィンドウ',    price: 35000, positions: null },
  { id: 'hood',            name: 'ボンネット',            price: 50000, positions: null },
  { id: 'fender',          name: 'フェンダー',            price: 22000, positions: [
    { id: 'fr', label: '前右' },
    { id: 'fl', label: '前左' },
  ] },
  { id: 'headlight',       name: 'ヘッドライト',          price: 15000, positions: [
    { id: 'r', label: '右' },
    { id: 'l', label: '左' },
  ] },
];

/* Ver2.0 §5 Screen4 — 店舗オプション (動的・デフォルト例) */
window.STORE_OPTIONS = [
  { id: 'ironx',       name: '鉄粉除去',            price: 8000  },
  { id: 'polish-hard', name: 'ハードポリッシュ',    price: 25000 },
  { id: 'scratch',     name: '傷補修',              price: 15000 },
  { id: 'headlight',   name: 'ヘッドライトリペア',  price: 12000 },
  { id: 'touchpen',    name: 'タッチペン',          price: 5000  },
];

/* Ver2.0 §5 Screen5 — クーポン (動的・デフォルト例) */
window.COUPONS = [
  { id: 'new',       name: '新規ご来店クーポン',   amount: 5000  },
  { id: 'repeat',    name: 'リピーター割引',       amount: 3000  },
  { id: 'referral',  name: '紹介特典クーポン',     amount: 5000  },
  { id: 'campaign',  name: 'キャンペーンクーポン', amount: 10000 },
  { id: 'staff',     name: 'スタッフ割引',         amount: 3000  },
];

/* Ver2.0 §5 Screen1 — 検索モーダル 既存顧客 mock */
window.MOCK_CUSTOMERS = [
  { id: 'c1', name: '田中 太郎',      kana: 'タナカ タロウ',       phone: '090-1234-5678', address: '滋賀県大津市...',     plate: '滋賀 330 に 1234' },
  { id: 'c2', name: '株式会社山田',    kana: 'ヤマダ',              phone: '077-555-0100',  address: '滋賀県草津市...',     plate: '滋賀 500 た 5678' },
  { id: 'c3', name: '佐藤 花子',      kana: 'サトウ ハナコ',       phone: '080-9876-5432', address: '大阪府大阪市...',     plate: '大阪 302 わ 9012' },
  { id: 'c4', name: '鈴木 一郎',      kana: 'スズキ イチロウ',     phone: '070-1111-2222', address: '京都府京都市...',     plate: '京都 550 と 3456' },
];

/* ═══════════════════════════════════════════════════════════════════
   Ver2.0 §5 Screen4 — ウィンドウフィルム
   -------------------------------------------------------------------
   v2.2 で大改造: 単一グレードから「部位 × グレード」マトリクスへ。
   binding:
   - 部位ごとにグレードを個別に選べる (例: フロント=ウルトラ、リア=STD)
   - 価格は WINDOW_FILM_PRICE_MATRIX[gradeId][positionId] で決定
   - 単位: 円 (M サイズ基準)。ボディサイズ倍率は Screen 4 の明細生成で適用。
   ═══════════════════════════════════════════════════════════════════ */

/* 施工可能な 6 部位。順序は運用時の視覚的な優先度 (前→後、上→下)。 */
window.WINDOW_FILM_POSITIONS = [
  { id: 'front',       name: 'フロントガラス',       shortName: 'フロント'  },
  { id: 'front-door',  name: 'フロントドアガラス',   shortName: '前ドア'    },
  { id: 'rear-door',   name: 'リアドアガラス',       shortName: '後ドア'    },
  { id: 'quarter',     name: '三角窓 (クォーター)',  shortName: '三角窓'    },
  { id: 'sunroof',     name: 'サンルーフ',           shortName: 'サンルーフ' },
  { id: 'rear',        name: 'リアガラス',           shortName: 'リア'      },
];

/* 3 グレード。id は既存互換のため 'std'/'high'/'ultra' を維持。 */
window.WINDOW_FILM_GRADES = [
  { id: 'std',    name: 'スタンダード',       short: 'STD',   desc: '断熱・UV カット基本性能' },
  { id: 'high',   name: 'ハイパフォーマンス', short: 'HIGH',  desc: '高断熱・IR カット強化' },
  { id: 'ultra',  name: 'ウルトラ',           short: 'ULTRA', desc: '最上位・断熱率+可視光透過率' },
];

/* 価格マトリクス [gradeId][positionId] = 円 (M サイズ基準)。
   フロント (内貼り) とサンルーフは大面積で高額、三角窓は小さめ。
   実運用では店舗設定で上書き可能な想定。 */
window.WINDOW_FILM_PRICE_MATRIX = {
  std:   { front: 10000, 'front-door':  6000, 'rear-door':  7000, quarter: 3000, sunroof: 12000, rear: 15000 },
  high:  { front: 15000, 'front-door':  9000, 'rear-door': 10500, quarter: 4500, sunroof: 18000, rear: 22000 },
  ultra: { front: 20000, 'front-door': 12000, 'rear-door': 14000, quarter: 6000, sunroof: 24000, rear: 30000 },
};
window.MAINTENANCE_MENUS = [
  { id: 'coat-refresh', name: 'コーティング再施工',  price: 25000 },
  { id: 'inspect',      name: '定期点検',           price: 8000  },
  { id: 'wax',          name: 'ワックス掛け',       price: 15000 },
];
window.CARWASH_MENUS = [
  { id: 'quick',   name: 'クイック洗車',    price: 3500 },
  { id: 'premium', name: 'プレミアム洗車', price: 8000 },
  { id: 'full',    name: 'フル洗車',        price: 12000 },
];
window.ROOMCLEAN_MENUS = [
  { id: 'seat',      name: 'シートクリーニング',   price: 15000 },
  { id: 'ceiling',   name: '天井クリーニング',     price: 8000 },
  { id: 'full',      name: '車内フルクリーニング', price: 30000 },
];

/* Screen7 — 通信ボタンの状態 (Ver2.0 §5-Screen7) */
window.COMM_STATE = {
  lineBusinessConfigured: false,   // 未設定 → 「LINE文章コピー」表示
  whatsappConfigured:     false,   // 未実装 (Screen7 に自動追加できる拡張)
  instagramConfigured:    false,
  xConfigured:            false,
};
