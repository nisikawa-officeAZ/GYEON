# DRAFT_DO_NOT_APPLY

このディレクトリは、DB設計をコードレビューと静的契約テストへ載せるための隔離場所です。

## 絶対禁止

- `supabase db push` の対象にしない
- `supabase migration up` で実行しない
- 本番・検証・ローカルを問わずDBへ直接流さない
- このDRAFTファイル自体をtimestamp付きの正式migrationとして扱わない
- `ROLLBACK` を削除しない

`gyeon_order_v3_contract.sql` はC5-Cで受理されたimmutable provenanceです。SHA-256は `d04517f479a956ba50f7d1b7ce636f8fc57b7e02d81f47b0adf457e1e12e2e73` で、末尾の `ROLLBACK` を維持します。次の外部正本は引き続き未接続です。

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

## C5-D正式migration候補

- パス: `supabase/migrations/20260829101726_gyeon_order_v3_contract.sql`
- SHA-256: `bd1a7742725c3f2a7bb42a3dbe5889b6e86bf6d213a0a550e6dd48f460d6d91b`
- 作成方法: `supabase migration new gyeon_order_v3_contract`
- 差分契約: 許可された先頭・末尾の全行コメントと、最後の `ROLLBACK` から `COMMIT` への1回の置換だけ

この候補の作成はDB適用権限ではありません。fresh disposable検証、既存データを含むupgrade検証、Supabase CLI-native runner検証、共有・検証・本番DBへの適用は、すべて別のowner承認ゲートです。
