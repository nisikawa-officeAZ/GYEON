# Vehicle Registration AI OCR — 車検証AI自動入力

**Phase:** PHASE67  
**Version:** v1.1  
**Status:** Implementation Complete (Migration manual apply required)

---

## 目的

車検証（自動車検査証）の画像をアップロードし、GPT-4o-mini Vision APIで文字認識（OCR）を行い、顧客・車両データの入力を自動化する機能。

**重要:** AIの読み取り結果は必ず人間の確認を経てから保存される。AIが直接DBを書き換えることはない。

---

## フロー

```
1. ユーザーが車検証画像を選択（JPEG/PNG/WebP, 最大10MB）
   ↓
2. サーバーサイドで画像を private bucket にアップロード
   vehicle-registration-documents/{dealer_id}/...
   ↓
3. vehicle_registration_files テーブルに pending レコードを作成
   ↓
4. GPT-4o-mini Vision API で OCR 解析
   （OPENAI_API_KEY はサーバーサイドのみ）
   ↓
5. OCR 結果を vehicle_registration_files に保存（completed / failed）
   ↓
6. UIにOCR結果を表示（VehicleRegistrationOcrReview）
   ↓
7. ユーザーが結果を確認・編集・フィールドを選択
   ↓
8. 「フォームへ反映」でフォームに適用（confirmed に更新）
   ↓
9. 監査ログに記録
```

---

## プライバシーポリシー

車検証には以下の個人情報が含まれます：

- 所有者・使用者氏名
- 所有者・使用者住所
- 車台番号（VIN相当）
- ナンバープレート情報

**データ取扱いポリシー：**

- 画像は private bucket に保存（公開URL禁止）
- 署名付きURL（有効期限1時間）でのみアクセス可能
- ディーラーIDによる完全分離
- 削除禁止（アーカイブのみ）
- AI（OpenAI API）へ画像データを送信することに注意

> ユーザーへの開示: 「車検証画像はAI解析のためOpenAI APIに送信されます。お客様のデータは社内のみで管理されます。」

---

## ストレージバケット設定

詳細: `docs/VEHICLE_REGISTRATION_STORAGE_SETUP.md`

```
Bucket: vehicle-registration-documents
Type: Private
Path: {dealer_id}/{customer_id}/{vehicle_id}/{yyyy-mm-dd}-{uuid8}.{ext}
Signed URL expiry: 3600 seconds (1 hour)
```

---

## 環境変数設定

`.env.local` に追加:

```
OPENAI_API_KEY=sk-...
```

**注意:** APIキーはサーバーサイドのみで使用。クライアントに公開禁止。  
`NEXT_PUBLIC_` プレフィックス使用禁止。

---

## OCR 対応フィールド

| フィールド | 日本語 | 車検証上の記載 |
|-----------|--------|--------------|
| owner_name | 所有者氏名 | 所有者の氏名又は名称 |
| user_name | 使用者氏名 | 使用者の氏名又は名称 |
| owner_address | 所有者住所 | 所有者の住所 |
| user_address | 使用者住所 | 使用者の住所 |
| vehicle_name | 車名 | 車名 |
| maker | メーカー | （車名から推定） |
| model | 型式 | 型式 |
| grade | グレード | 型式指定番号等から推定 |
| model_code | 型式指定番号 | 型式指定番号 |
| chassis_number | 車台番号 | 車台番号 |
| license_plate_region | ナンバー地域 | 使用の本拠の位置（地域） |
| license_plate_class | 分類番号 | 自動車登録番号（3桁） |
| license_plate_kana | かな | 自動車登録番号（かな） |
| license_plate_number | 指定番号 | 自動車登録番号（4桁） |
| first_registration_date | 初年度登録 | 初度登録年月 |
| inspection_expiry_date | 車検有効期限 | 有効期間の満了する日 |
| vehicle_type | 車両種別 | 自動車の種別 |
| use_type | 用途 | 用途 |
| private_or_business | 自家用/事業用 | 自家用・事業用 |
| body_shape | 車体形状 | 車体の形状 |
| fuel_type | 燃料種類 | 燃料の種類 |
| color | 色 | 車体の色 |
| confidence | 信頼度 | 0〜1（AI評価） |

---

## OCR 制限事項

- 画像品質が低い場合、認識精度が低下する
- 折り目・反射・影がある画像は読み取り精度が下がる
- 旧フォーマットの車検証（古いレイアウト）は対応精度が低い
- 電子車検証（IC チップ）には非対応（画像のみ）
- AIは推測・補完を行わない（不明な項目は空文字列）
- `confidence` フィールドはAIの自己評価であり、保証ではない

---

## 監査ログ

以下のイベントが `audit_logs` テーブルに記録されます：

| イベント | AuditAction | AuditResourceType |
|---------|-------------|-------------------|
| 車検証アップロード | `create` | `vehicle_registration` |
| OCR完了/失敗 | `update` | `vehicle_registration` |
| 結果確認 | `update` | `vehicle_registration` |
| アーカイブ | `archive` | `vehicle_registration` |

---

## APIキー未設定時の動作

`OPENAI_API_KEY` が未設定の場合:

- UI: 「車検証AI解析は未設定です。管理者にお問い合わせください。」を表示
- アップロードとDB記録は実行される（OCRのみスキップ）
- アプリはクラッシュしない

---

## ファイル構成

```
src/lib/vehicle-registration/
  vehicle-registration-types.ts  # 型定義
  ocr.ts                          # GPT-4o-mini OCR サービス
  storage.ts                      # Supabase Storage 操作
  actions.ts                      # Server Actions

src/components/vehicle-registration/
  VehicleRegistrationUpload.tsx   # アップロードUI
  VehicleRegistrationOcrReview.tsx # 結果確認UI

supabase/migrations/
  067_vehicle_registration_ocr.sql # テーブル定義（手動適用）

docs/
  VEHICLE_REGISTRATION_STORAGE_SETUP.md  # ストレージ設定手順
  VEHICLE_REGISTRATION_OCR.md            # 本ドキュメント
```

---

## 統合先

### Priority 1: 新規見積フォーム ✓ 実装済み

`src/components/estimates/EstimateForm.tsx`

- 「車検証から自動入力」ボタンを顧客・車両セクションの上部に配置
- OCR結果は `internal_memo` フィールドへ参考情報として反映

### Priority 2: 車両フォーム（TODO）

`src/components/vehicles/VehicleForm.tsx`

- OCR結果から maker / model / chassis_number / plate 等を直接反映
- TODO コメント追加済み

### Priority 3: 顧客フォーム（TODO）

`src/components/customers/CustomerForm.tsx`

- OCR結果から user_name / user_address を反映
- TODO コメント追加済み

---

## 今後の改善案

1. **車両自動マッチング**: OCR結果の車台番号・ナンバーから既存車両レコードを自動検索
2. **顧客自動マッチング**: 使用者氏名から顧客候補を提示
3. **電子車検証対応**: QRコードからデータ取得
4. **信頼度閾値設定**: 信頼度が低い場合は手動入力を促す
5. **OCRプロバイダー切り替え**: Google Vision / AWS Textract 等との比較
6. **バッチ処理**: 複数枚の車検証を一括処理
7. **差分表示**: 既存車両データとOCR結果の差分をハイライト表示
