# DealerOS 開発プレビュー 起動ガイド（オペレーター向け・E10.4）

> 明日の実機テスト用の起動手順です。開発（Development）環境でのみ実施してください。本番環境では実施しないこと。

---

## 0. 事前確認
- **ブランチ**: `fix/branding-schema-block`
- **最新コミット**: `d00ac8d`（作業ツリーはクリーン）
- **PC**: 開発用 Mac（テスト端末と同じ Wi‑Fi に接続）

---

## 1. 必要な環境変数（Mac の `.env.local`）
以下が設定されていることを確認してください（値はここには記載しません）。

**必須**
- `NEXT_PUBLIC_SUPABASE_URL` … Supabase プロジェクトURL
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` … Supabase anon キー
- `SUPABASE_SERVICE_ROLE_KEY` … サーバー処理（ロゴ取得・OCR保存等）用
- `OPENAI_API_KEY` … OCR（車検証AI抽出）用

**任意 / 推奨**
- `OCR_MODEL` … 既定は `gpt-4.1-mini`。アカウントで未対応なら `gpt-4o-mini` を設定
- `NEXT_PUBLIC_ESTIMATE_TAXONOMY_READY=true` … 見積カテゴリ拡張（093適用済みのDevのみ）
- `NEXT_PUBLIC_WORK_BAYS_SCHEMA_READY` … 作業ベイ機能（092適用済みのDevのみ）
- `NEXT_PUBLIC_BRANDING_SCHEMA_READY` … ブランディング拡張
- `NEXT_PUBLIC_APP_URL` … 明示URLが必要な場合

> ⚠️ `.env.local` は Git 管理外。値は共有せず、Dev のものだけを使用してください。

---

## 2. ストレージバケット確認（Supabase）
以下のバケットが Dev の Supabase に存在すること:
- `vehicle-registration-documents` … 車検証OCRの原本（画像/PDF）
- `dealer-branding` … 店舗ロゴ・印

（他: `work-order-files`, `gyeon-resources`）

---

## 3. 開発サーバーの起動（Mac）
```bash
cd ~/DealerOS
npm run dev
```
- 使用ポート: **3000**
- 起動後、ターミナルに `Local:` と `Network:` のURLが表示されます。
- 端末からアクセスできない場合は、全ネットワーク公開で起動:
  ```bash
  npx next dev --turbopack -H 0.0.0.0
  ```
- 初回は macOS ファイアウォールが「node の受信接続を許可しますか？」と尋ねる場合があります → **許可**してください。

---

## 4. アクセスURL
| 端末 | URL |
|---|---|
| Mac（本体） | `http://localhost:3000` |
| iPhone（同じWi‑Fi） | `http://192.168.1.148:3000` |
| Android（同じWi‑Fi） | `http://192.168.1.148:3000` |

> IP `192.168.1.148` は現在の Mac の LAN アドレスです。Wi‑Fi を変えると変わります。変わった場合は Mac で `ipconfig getifaddr en0` を実行して新しいIPを確認してください。
> iPhone/Android は Mac と**同じ Wi‑Fi** に接続していること。

---

## 5. OCR テスト準備
- `OPENAI_API_KEY` が設定済みであること。
- 実物の**車検証**（画像 or PDF）を用意。
- モバイルではカメラ撮影も可能。
- 入口: ログイン → 見積管理 →「顧客・車両登録」→ OCRアップロード。
- OCR履歴は `/ocr-sessions` で確認できます。

---

## 6. テストチェックリスト
- 場所: `docs/developer-preview-test-pack.md`（本リポジトリ内）
- 16項目（ログイン〜モバイル）を上から順に実施し、各「失敗メモ」に事象・端末・時刻を記録してください。

---

## 7. 当日の流れ（推奨）
1. Mac で `npm run dev` を起動。
2. Mac の `http://localhost:3000` でログイン確認。
3. iPhone/Android で `http://192.168.1.148:3000` を開いてログイン。
4. チェックリスト（`developer-preview-test-pack.md`）を順に実施。
5. 不具合は失敗メモ＋スクリーンショットで記録。
6. OCRは実物の車検証（画像・PDF・カメラ）で検証。

---

## 8. うまくいかない時
- **端末からページが開かない** → 同じWi‑Fiか確認 / ファイアウォール許可 / `-H 0.0.0.0` で再起動 / IP再確認。
- **OCRが失敗する** → `OPENAI_API_KEY` 設定確認。`gpt-4.1-mini` 未対応なら `OCR_MODEL=gpt-4o-mini` に変更して再起動。
- **画像/PDFがはじかれる** → 対応形式は JPEG / PNG / WebP / PDF。サイズ上限に注意。
- **他店舗のデータが見える等** → 直ちに記録して報告（ディーラー分離の重大事象）。
