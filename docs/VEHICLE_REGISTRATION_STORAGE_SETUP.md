# Vehicle Registration Storage Setup

## Bucket Name

```
vehicle-registration-documents
```

## Setup Steps (Manual — Supabase Dashboard)

1. Supabase Dashboard にログイン
2. **Storage** → **New bucket** をクリック
3. 以下の設定で作成:

| 項目 | 値 |
|------|-----|
| Bucket name | `vehicle-registration-documents` |
| Public bucket | **OFF（必須）** |
| File size limit | `10MB` |
| Allowed MIME types | `image/jpeg, image/png, image/webp` |

4. **Create bucket** をクリック

## Storage RLS Policies

バケット作成後、以下のRLSポリシーをStorage > Policiesで設定してください。

### SELECT (ダウンロード)

```sql
-- 自分のディーラーIDで始まるパスのみアクセス可
CREATE POLICY "vehicle_reg_select"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'vehicle-registration-documents'
  AND (storage.foldername(name))[1] IN (
    SELECT dealer_id::text FROM dealer_members
    WHERE user_id = auth.uid() AND status = 'active'
  )
);
```

### INSERT (アップロード)

```sql
CREATE POLICY "vehicle_reg_insert"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'vehicle-registration-documents'
  AND (storage.foldername(name))[1] IN (
    SELECT dealer_id::text FROM dealer_members
    WHERE user_id = auth.uid() AND status = 'active'
  )
);
```

### UPDATE

```sql
CREATE POLICY "vehicle_reg_update"
ON storage.objects FOR UPDATE
TO authenticated
USING (
  bucket_id = 'vehicle-registration-documents'
  AND (storage.foldername(name))[1] IN (
    SELECT dealer_id::text FROM dealer_members
    WHERE user_id = auth.uid() AND status = 'active'
  )
);
```

### DELETE — 禁止

DELETE ポリシーは作成しないこと。アーカイブ処理で代替する。

## Storage Path Convention

```
{dealer_id}/{customer_id}/{vehicle_id}/{yyyy-mm-dd}-{uuid8}.{ext}
```

顧客・車両が未確定の場合:
```
{dealer_id}/pending/{yyyy-mm-dd}-{uuid8}.{ext}
```

アーカイブ後:
```
{dealer_id}/archived/{customer_id}/{vehicle_id}/{yyyy-mm-dd}-{uuid8}.{ext}
```

## Important Rules

- **公開URL禁止** — `getPublicUrl()` は使用しない
- **署名付きURL必須** — `createSignedUrl()` (有効期限1時間)
- **dealer_id はサーバーサイドのみ** — クライアントから受け取らない
- **削除禁止** — アーカイブ処理のみ許可
- **パスにdealer_idを必ず含める** — ディーラー分離の追加保護層

## Security Notes

- バケットはプライベート設定必須（公開URL無効）
- 署名付きURLの有効期限は1時間（定数 `SIGNED_URL_EXPIRY_SECONDS`）
- ストレージパスレベルでもdealer_idを検証（`storage.ts` の path isolation チェック）
- 車検証には個人情報（氏名・住所・車両情報）が含まれるため、適切なアクセス制御が必須
