# Storage Setup: work-order-files Bucket

> **自動適用禁止**: このドキュメントに記載されたSQL/手順は手動で実行すること。
> migration SQLには含まれていない。

---

## バケット仕様

| 項目 | 値 |
|---|---|
| バケット名 | `work-order-files` |
| 公開設定 | **private**（非公開） |
| 理由 | 施工写真・顧客情報を含むため署名付きURLで配信 |

---

## 保存パス規則

```
{dealer_id}/{work_order_id}/{phase}/{uuid_prefix}_{sanitized_filename}
```

**例:**
```
a1b2c3d4-xxxx/e5f6g7h8-xxxx/before/9f8e7d6c_front_bumper.jpg
a1b2c3d4-xxxx/e5f6g7h8-xxxx/after/1a2b3c4d_door_panel.jpg
a1b2c3d4-xxxx/e5f6g7h8-xxxx/damage/5e6f7a8b_scratch_detail.jpg
```

**phase 一覧:**
| 値 | 用途 |
|---|---|
| `before` | 施工前 |
| `during` | 施工中 |
| `after` | 施工後 |
| `damage` | 損傷記録 |
| `delivery` | 納車時 |
| `other` | その他 |

---

## 手動作成手順

### 方法1: Supabase Dashboard

1. Supabase Dashboard → Storage → New Bucket
2. Name: `work-order-files`
3. Public bucket: **OFF**（非公開）
4. 「Create bucket」ボタンをクリック

### 方法2: SQL Editor（pg_storage extension が有効な場合）

```sql
INSERT INTO storage.buckets (id, name, public)
VALUES ('work-order-files', 'work-order-files', false)
ON CONFLICT DO NOTHING;
```

---

## Storage RLS ポリシー

バケット作成後、以下のポリシーをSQL Editorで実行する:

### INSERT（アップロード）

```sql
CREATE POLICY "Dealer members can upload work order files"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'work-order-files'
  AND (storage.foldername(name))[1] IN (
    SELECT dealer_id::text
    FROM public.dealer_members
    WHERE user_id = auth.uid()
  )
);
```

### SELECT（閲覧）

```sql
CREATE POLICY "Dealer members can read their work order files"
ON storage.objects FOR SELECT
USING (
  bucket_id = 'work-order-files'
  AND (storage.foldername(name))[1] IN (
    SELECT dealer_id::text
    FROM public.dealer_members
    WHERE user_id = auth.uid()
  )
);
```

### UPDATE（更新 — ファイルメタデータ用）

```sql
CREATE POLICY "Dealer members can update their work order files"
ON storage.objects FOR UPDATE
USING (
  bucket_id = 'work-order-files'
  AND (storage.foldername(name))[1] IN (
    SELECT dealer_id::text
    FROM public.dealer_members
    WHERE user_id = auth.uid()
  )
);
```

### DELETE（削除）

```sql
CREATE POLICY "Dealer members can delete their work order files"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'work-order-files'
  AND (storage.foldername(name))[1] IN (
    SELECT dealer_id::text
    FROM public.dealer_members
    WHERE user_id = auth.uid()
  )
);
```

---

## ポリシー設定後の検証

```sql
-- バケット確認
SELECT id, name, public FROM storage.buckets WHERE id = 'work-order-files';

-- ポリシー確認
SELECT policyname, cmd, qual
FROM pg_policies
WHERE tablename = 'objects' AND schemaname = 'storage'
ORDER BY policyname;
```

---

## アプリケーション側の実装

ファイルパスは `src/lib/work-order-files/work-order-file-types.ts` の `workOrderFileStoragePath()` で生成:

```typescript
// server-side only — dealer_id は getCurrentDealer() から取得
export function workOrderFileStoragePath(
  dealerId: string,
  workOrderId: string,
  phase: WorkOrderFilePhase,
  fileName: string,
  uniquePrefix: string
): string {
  const sanitized = fileName.replace(/[^a-zA-Z0-9._-]/g, "_");
  return `${dealerId}/${workOrderId}/${phase}/${uniquePrefix}_${sanitized}`;
}
```

> **重要**: ストレージパスの `dealer_id` セグメントが RLS の `(storage.foldername(name))[1]` と一致することで、他Dealerのファイルへのアクセスを防ぐ。

---

## 注意事項

- バケットが存在しない状態でアップロードを試みると `StorageError: Bucket not found` が発生する
- ポリシーなしの状態では全ユーザーがアクセス不可（anon も service_role 以外は不可）
- `public: false` のバケットのファイルは署名付きURL（`createSignedUrl`）で配信する
- ファイル削除は Storage と `work_order_files` テーブルの両方から行う（`delete-work-order-file.ts` で実装済み）
