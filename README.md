# Desktop Top UI — v13

GYEON Detailer Agent ダッシュボード（デスクトップ版トップ画面）の **v13** デザイン。

> 関連 Issue: [#1 — Desktop Top UI v13 サイドバーロゴ差し替え版のアップロード](https://github.com/nisikawa-officeAZ/GYEON/issues/1)

---

## 概要

- **単一HTMLファイル**（CSS / 画像すべて inline / base64 埋め込み）
- 想定ビューポート: **1280px 以上**（1440×900 で検証済み）
- カラーシステム: ダークネイビー `#080d1a` + ブルーグラデーション + グラスモーフィズム
- フォント: システムスタック（外部依存なし）

---

## v12 → v13 差分

| 項目 | v12 | v13 |
|---|---|---|
| サイドバー上部アイコン | 青グラデ枠の "G" 文字 | 正規ブランドロゴ画像（黒地・幾何学的Gライン） |
| サイズ | 38px 角 | **40px 角** |
| 背景処理 | 青グラデ | 黒地（ロゴ意匠を加工せず保持）+ 1px枠線 + 内側ハイライト |
| HTML サイズ | 402 KB | 525 KB（ロゴ画像 base64 内包のため意図的に増加） |

---

## 変更箇所（最小侵襲・2点のみ）

1. `.brand-mark` CSS：背景・サイズ・枠線
2. `.brand-mark` HTML：`<div>G</div>` → `<div><img src="data:image/png;base64,..." /></div>`

### 変更していない箇所

- Hero 部（GYEONロゴ・店舗ロゴスロット・ウラカン画像）
- クイックアクセス（2段 × 4列：見積一覧／顧客管理／車両管理／作業管理／予約管理／LINE／商品注文／設定）
- CTAバンド（新規見積もり作成／本日の作業／リマインダー）
- メインメニュー項目
- `setStoreLogo(url)` ランタイム切替 JS

---

## ファイル構成

```
design/desktop-top/v13/
├── gyeon_desktop_top_v13.html   # 単一HTML（base64画像内包・525KB）
├── v13_fold.png                  # ファーストビュー(1440x900)
├── v13_full.png                  # フルレイアウト
└── README.md                     # このファイル
```

---

## プレビュー方法

```bash
# macOS
open gyeon_desktop_top_v13.html

# Linux
xdg-open gyeon_desktop_top_v13.html

# Windows
start gyeon_desktop_top_v13.html
```

または、ローカルWebサーバ経由（推奨）:

```bash
python3 -m http.server 8000
# → http://localhost:8000/gyeon_desktop_top_v13.html
```

---

## 受け入れテスト（チェックリスト）

- [ ] サイドバー左上にロゴ画像が表示される
- [ ] ロゴが歪まず、黒背景込みで表示される（加工禁止原則）
- [ ] ロゴサイズが 40px × 40px である
- [ ] "GYEON® / DETAILER AGENT" テキストが従来通り表示される
- [ ] Hero 部のウラカン画像が表示される（フォールバック動作）
- [ ] クイックアクセスが 2段 × 4列で表示される
- [ ] 各メニュー項目のアイコンサイズが統一されている
- [ ] レスポンシブ崩れがない（1280px / 1440px / 1920px 各幅で確認）

---

## ランタイム拡張（v13 仕様）

### 店舗ロゴの差し替え（Hero部）

```javascript
// 店舗ロゴを表示
setStoreLogo("https://example.com/store-logo.png");

// フォールバック（ウラカン画像）に戻す
setStoreLogo(null);
```

### 将来追加予定（v14 以降）

```javascript
// サイドバーのブランドロゴも同パターンで差し替え可能に
setBrandLogo("https://example.com/custom-brand.png");
```

---

## ロールバック方法

v13 と v12 はバージョン別フォルダで共存可能な構成のため、以下のいずれかでロールバック可能：

1. **PR revert**: 該当PRを GitHub UI から revert
2. **参照切替**: 旧版 `design/desktop-top/v12/` を別途配置し、そちらを利用
3. **タグ運用**: `design-v12` / `design-v13` タグで版を固定

---

## 将来の注意点

- **base64 埋め込み**: 複数画面で同じロゴを使う規模になったら、`/public/assets/brand_logo.png` への外部化を推奨（ブラウザキャッシュ効率向上）
- **ロゴ画像**: 原本は 584×1024 のため余白が縦に多い。視覚的に小さく見える場合は、正方形版を別途用意することで `object-fit: contain` の表示比率を最適化可能
- **アクセシビリティ**: `<img alt>` / `<div aria-label>` 付与済み。スクリーンリーダー対応OK

---

## 関連リソース

- AI Drive バックアップ: [/GYEON_Detailer_Agent/desktop_top_v1](https://www.genspark.ai/aidrive/files/GYEON_Detailer_Agent/desktop_top_v1)
- 関連 Issue: [#1](https://github.com/nisikawa-officeAZ/GYEON/issues/1)
