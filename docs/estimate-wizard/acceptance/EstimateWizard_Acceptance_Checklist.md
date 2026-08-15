# EstimateWizard — Acceptance Checklist

| 項目 | 値 |
|---|---|
| **Document Name** | EstimateWizard — Acceptance Checklist |
| **Version** | 1.0 |
| **Status** | 🔵 **Reference**（正本の付随文書／受入基準） |
| **Last Updated** | 2026-07-08 |
| **Architect Approval** | 基準は Architect 原案 JSON 由来（本チェックリスト自体の承認は保留中） |

> **目的**：見積ウィザード実装の**受入・検証チェックリスト**。UI デザイン仕様とは分離して管理する（Architect 指示）。
> **UI 設計の正本（当時）**：`../archive/ver2.0/specification/GenSpark_Request_EstimateWizard_Ver2.0.md`（旧 Ver2.0 Canonical／現行の最新は Ver2.2）。本書はデザイン仕様ではなく**実装フェーズの合否基準**。
> **出典**：原案 `docs/estimate-wizard-ui-spec.json` の `acceptance_criteria` / `test_requirements` を移設・整理（原 JSON は不変）。
> **注意**：本書は実装完了後の検証用。実装は Architect 承認後に開始する。

---

## A. Acceptance Criteria（合格基準）

- [ ] 現行の長スクロール Estimate Editor が、ステップ式ウィザード UI に置換されている。
- [ ] 顧客ステップが**現行の顧客ロジック**で動作する（保存・業者/掛売り・AI/OCR 確認ルール不変）。
- [ ] 車両ステップが**現行の車両/OCR ロジック**で動作する（フィールド定義・抽出ロジック不変）。
- [ ] サービスカテゴリ選択が、次ステップに表示されるサービスセクションを制御する。
- [ ] **選択したサービスセクションのみ**が見積入力に表示される。
- [ ] 値引き/クーポンステップが**現行の計算ロジック**で動作する（金額/％、店舗クーポン）。
- [ ] 備考（顧客向け）と社内メモが明確に分離されている。
- [ ] 最終確認画面が見積内容とアクションボタンを表示する。
- [ ] 右サイドの sticky 小計/合計ウィンドウが維持されている。
- [ ] **Tablet/Smartphone のナビゲーションがスワイプ＋ボタンの両方**に対応する。
- [ ] **業務ロジックの回帰（regression）がない。**
- [ ] `npm run typecheck` が通過する。
- [ ] `npm run build` が通過する。

## B. Binding 追加ゲート（Architect 既承認・回帰防止）

- [ ] **価格パリティ**：代表サービス組合せで、ウィザードの生成明細・合計が現行ロジックと**完全一致**（価格回帰ゼロ）。
- [ ] **操作数パリティ**：代表見積の committing 操作数が **新 ≤ 旧**（scroll/ステップ遷移/スワイプ/パネル開閉はカウントしない）。
- [ ] **機能欠落ゼロ**：Screen1〜7 の全フィールド・全サービスカテゴリ・PPF部分施工・クーポン・OCR・3M・予約/請求書系ボタン等が保持。
- [ ] **不変性**：pricing / OCR / save / customer・vehicle save / PDF / LINE / Server Actions 契約 / DB スキーマに変更なし。

---

## C. Test Requirements（手動テストフロー）

### 自動チェック
- [ ] `npm run typecheck`
- [ ] `npm run build`

### 見積フロー
- [ ] 新規見積作成
- [ ] 既存見積の編集
- [ ] 顧客 新規登録
- [ ] 既存顧客の選択
- [ ] 車両 OCR 適用
- [ ] 車両 手入力
- [ ] サービスカテゴリ 複数選択
- [ ] 選択カテゴリのみ表示
- [ ] 値引き（金額）
- [ ] 値引き（％）
- [ ] クーポン選択
- [ ] 備考の表示（見積内）
- [ ] 社内メモの保存
- [ ] PDF アクション
- [ ] LINE 設定済みの挙動（LINE送信）
- [ ] LINE 未設定の挙動（LINE文章コピー）
- [ ] 予約カレンダー アクション（利用可能な場合）

### レイアウト / レスポンシブ
- [ ] Desktop レイアウト
- [ ] Tablet レイアウト
- [ ] Smartphone レイアウト
- [ ] **Tablet/Smartphone スワイプ移動**（左＝次／右＝前）＋Back/Next 併存

---

## D. マージ済み Architect 決定（V2 正本で反映済み・検証観点）

- [ ] Tablet/Smartphone のスワイプ移動が動作し、Back/Next と併存する。
- [ ] 顧客登録のデフォルトが「新規顧客登録（手入力）」で、OCR・既存検索へ切替できる。
- [ ] LINE 挨拶文テンプレートが店舗設定で編集でき、見積本文は常に自動生成される。

---

> 本書は合否基準のみ。UI デザインは `../archive/ver2.0/specification/GenSpark_Request_EstimateWizard_Ver2.0.md`（旧 Ver2.0 正本／現行の最新は Ver2.2）を参照。
