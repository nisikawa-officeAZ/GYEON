# DRAFT_DO_NOT_APPLY

このディレクトリは、DB設計をコードレビューと静的契約テストへ載せるための隔離場所です。

## 絶対禁止

- `supabase db push` の対象にしない
- `supabase migration up` で実行しない
- 本番・検証・ローカルを問わずDBへ直接流さない
- timestamp付きの正式migrationへコピーしない
- `ROLLBACK` を削除しない

`gyeon_order_v3_contract.sql` は `GYEON-ORDER-V3-C3-R1` のsource-only候補です。現在は次の外部正本が未接続であり、実行可能な正式migrationではありません。

- Office AZ在庫・予約・入荷投影
- 店舗ランク・商用プログラム所属の管理経路
- 初回登録・アップグレード資格の正本
- カード与信・再与信・取消adapter
- PayPay銀行の入金通知adapter
- 倉庫通知とメール配信adapter

## 正式migrationへ昇格する条件

1. 別フェーズで明示承認を受ける。
2. 未使用の使い捨てDBで既存migrationを先頭から再生する。
3. pgTAPでschema、constraint、RLS、grant、RPC署名を検証する。
4. 実際のrequest claimsでowner / manager / staff / readonly / 別店舗 / 無効membershipを検証する。
5. 別DB接続でidempotency、二重submit、二重倉庫受付、version競合を検証する。
6. 失敗した検証環境の識別子を再利用しない。
7. 正式migrationへの昇格、適用、commit、pushをそれぞれ別ゲートで承認する。

## C3-R1で許可される検証

- TypeScriptによるSQL文字列契約テスト
- `git diff --check`
- 対象5ファイルのallowlist確認
- 既存V1ファイルと保護対象UIが変更されていないことの確認

DB接続を伴う検証はC4まで禁止です。
