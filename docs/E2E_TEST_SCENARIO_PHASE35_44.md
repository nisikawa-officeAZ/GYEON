# E2E Test Scenario — PHASE35〜44

## 前提条件

- Migration 001〜042 が適用済みであること
- Storage bucket `work-order-files` が作成済みであること
- Dealer設定（dealers / dealer_members）が登録済みであること
- テスト用ユーザーが `dealer_members` に紐付いていること

---

## シナリオ全体フロー

```
Dealer Settings
     ↓
Customer 作成
     ↓
Vehicle 作成
     ↓
Estimate 作成
     ↓
Estimate approved化
     ↓
Work Order 作成
     ↓
Work Order Files 登録
     ↓
Work Order completed化
     ↓
Completion Report 作成
     ↓
Invoice 作成
     ↓
Payment 登録
     ↓
Dashboard 反映確認
```

---

## Step 1: Dealer Settings 登録

**画面:** `/settings`

**操作:**
1. Dealer名、住所、電話番号を入力して保存
2. dealer_members に自ユーザーが紐付いていることを確認

**確認クエリ:**
```sql
SELECT d.id, d.name, dm.user_id
FROM dealers d
JOIN dealer_members dm ON d.id = dm.dealer_id
WHERE dm.user_id = auth.uid();
```

**期待値:** dealer_id が返ること

---

## Step 2: Customer 作成

**画面:** `/customers` → 新規作成

**入力値（例）:**
- 姓: 山田
- 名: 太郎
- 電話: 090-1234-5678
- メール: yamada@example.com
- 都道府県: 東京都

**確認:**
- 顧客一覧に「山田 太郎」が表示されること
- 他Dealerのユーザーには見えないこと（RLS確認）

**確認クエリ:**
```sql
SELECT id, last_name, first_name, dealer_id
FROM customers WHERE last_name = '山田' AND dealer_id = '<your_dealer_id>';
```

---

## Step 3: Vehicle 作成

**画面:** `/vehicles` → 新規作成

**入力値（例）:**
- メーカー: Toyota
- モデル: Alphard
- 年式: 2023
- ナンバー: 品川300 あ 1234
- カラー: パールホワイト
- 紐付け顧客: 山田 太郎

**確認:**
- 車両一覧に「Toyota Alphard」が表示されること

---

## Step 4: Estimate 作成

**画面:** `/estimates` → 新規作成

**入力値（例）:**
- 顧客: 山田 太郎
- 車両: Toyota Alphard 品川300 あ 1234
- ステータス: draft
- タイトル: ガラスコーティング施工見積
- 明細:
  - カテゴリ: coating / 品目: ガラスコーティング / 単価: 80,000 / 数量: 1
  - カテゴリ: ppf / 品目: PPF施工（フロント） / 単価: 50,000 / 数量: 1
- 消費税率: 10%

**確認:**
- 小計: ¥130,000
- 税額: ¥13,000
- 合計: ¥143,000
- 見積番号が自動生成されること（EST-xxxx or id先頭8桁）

---

## Step 5: Estimate approved化

**画面:** `/estimates` → 詳細 → 編集

**操作:**
- ステータスを `draft` → `approved` に変更して更新

**確認:**
- 見積一覧のステータスバッジが「承認」になること
- 「Work Order作成」ボタンが表示されること（approvedのみ表示）

---

## Step 6: Work Order 作成

**方法A: Estimate詳細から作成**
1. 見積詳細 → 「Work Order作成」ボタンをクリック
2. フォームに見積の顧客・車両・タイトルが自動入力されていることを確認
3. 施工予定日時を入力
4. 担当者を入力
5. 保存

**方法B: Work Orders画面から作成**
- `/work-orders` → 新規作成 → 見積IDを手動で入力

**入力値（例）:**
- ステータス: scheduled
- 施工予定開始: 翌日 09:00
- 施工予定終了: 翌日 17:00
- 担当者: 鈴木 一郎

**確認:**
- 作業指示書一覧に表示されること
- estimate_id が正しくリンクされていること
- Dashboard「今後7日間の施工予定」に表示されること

---

## Step 7: Work Order Files 登録

**画面:** `/work-orders` → 詳細 → 「施工写真・ファイル ▼ 開く」

**操作:**
1. セクションを展開
2. フェーズ「before」を選択
3. 画像ファイルをドラッグ&ドロップまたはクリックで選択
4. アップロード完了を確認
5. フェーズ「after」にも1枚登録

**確認:**
- ファイルがグリッドに表示されること
- サムネイルが表示されること
- Storage上のパス: `{dealer_id}/{work_order_id}/before/{uuid}_{filename}`

**確認クエリ:**
```sql
SELECT id, work_order_id, phase, file_name, storage_path
FROM work_order_files
WHERE work_order_id = '<work_order_id>'
ORDER BY phase;
```

---

## Step 8: Work Order completed化

**画面:** `/work-orders` → 詳細 → 編集

**操作:**
- ステータスを `scheduled` → `completed` に変更
- 実際の開始/終了日時を入力
- 更新

**確認:**
- 作業指示書詳細ヘッダーのバッジが「完了」（緑）に変わること

---

## Step 9: Completion Report 作成

**画面:** 作業指示書詳細 → 「完了報告書 ▼ 開く」

**操作:**
1. セクションを展開
2. 「完了報告書を作成」ボタンをクリック
3. 入力:
   - タイトル: 施工完了報告書
   - 報告日: 本日
   - 顧客向けメッセージ: デフォルトメッセージ確認
4. 「作成」ボタンをクリック

**確認:**
- 報告書プレビューが表示されること
- 施工前/後の写真がフェーズ別に表示されること
- 「印刷/PDF保存」ボタンで印刷プレビューが開くこと

---

## Step 10: Invoice 作成

**方法A: Work Order詳細から作成（自動入力）**
1. 作業指示書詳細 → 「請求書 ▼ 開く」
2. 「作業指示書から請求書を作成」ボタン → 見積明細が自動入力される

**方法B: Invoices画面から手動作成**
- `/invoices` → 新規作成

**確認:**
- 請求書一覧に表示されること
- 明細・合計・税額が正しく計算されていること
- ステータス: draft
- paid_amount: 0
- balance_due: total と同額

**確認クエリ:**
```sql
SELECT invoice_number, status, total, paid_amount, balance_due
FROM invoices WHERE work_order_id = '<work_order_id>';
```

---

## Step 11: Payment 登録

**画面:** `/invoices` → 詳細 → 「入金管理 ▼ 開く」

**操作:**
1. セクションを展開（paid_amount・残高がヘッダーに表示）
2. 「+ 入金登録」ボタン
3. 入力:
   - 入金日: 本日
   - 支払方法: 銀行振込
   - 入金額: 143,000（全額）
   - ステータス: completed
4. 「入金登録」ボタン

**確認:**
- 入金後、invoiceの`paid_amount`が更新されること
- `balance_due` が 0 になること
- invoiceの`status` が `paid` になること（自動更新）
- `/payments` 一覧に表示されること

**確認クエリ:**
```sql
-- Invoice更新確認
SELECT status, paid_amount, balance_due
FROM invoices WHERE id = '<invoice_id>';
-- 期待値: status='paid', paid_amount=143000, balance_due=0

-- Payment確認
SELECT payment_date, payment_method, amount, net_amount, status
FROM payments WHERE invoice_id = '<invoice_id>';
```

---

## Step 12: Dashboard 反映確認

**画面:** `/`（Dashboard）

**確認項目:**

| 項目 | 期待値 |
|---|---|
| 今月売上 | ¥143,000 以上（当月の場合） |
| 今月入金 | ¥143,000 以上（当月の場合） |
| 未収金 | ¥0（全額入金後） |
| 顧客数 | 1以上（山田 太郎） |
| 施工状況 > 完了 | 1以上 |
| 請求状況 > 入金済み | 1以上 |
| 最近の活動 | 見積・施工完了・請求書・入金が表示されること |
| 今後7日間 | 来週以降の施工が表示されること |

---

## 異常系テスト

### 他Dealer データアクセス拒否

1. 別ユーザー（別Dealer）でログイン
2. 上記で作成したCustomer/Vehicle/Estimate/WorkOrderが見えないことを確認
3. URLを直接入力しても403/空応答になることを確認

### 部分入金シナリオ

1. 請求額143,000円に対して70,000円のみ入金
2. Invoiceステータスが `partially_paid` になること
3. `balance_due` が 73,000円になること
4. 残額73,000円を入金後、`paid` になること

### Payment削除後の再計算

1. 入金済み（paid）のInvoiceに対してPaymentを削除
2. Invoice の `paid_amount` と `balance_due` が再計算されること
3. Invoiceステータスが適切に戻ること（`issued` または `overdue`）
