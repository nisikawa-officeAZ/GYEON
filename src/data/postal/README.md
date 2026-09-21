# Japan Post address-to-postal map

`japan-post-address-map.json` is generated from Japan Post's official one-record-per-line UTF-8
postal data. It is used server-side after vehicle-registration OCR only when the certificate did
not provide a complete seven-digit postal code.

- Source: `https://www.post.japanpost.jp/service/search/zipcode/download/utf/zip/utf_ken_all.zip`
- Dataset update: 2026-08-31
- Generator: `scripts/generate-japan-post-address-map.mjs`

Regenerate with:

```sh
node scripts/generate-japan-post-address-map.mjs utf_ken_all.csv src/data/postal/japan-post-address-map.json
```

Duplicate address prefixes with different postal codes are stored as an empty value and deliberately
resolve to no result. Municipality-wide "以下に掲載がない場合" rows are excluded so an OCR-misread
town cannot fall through to a generic postal code. The application never guesses between ambiguous
postal codes.
