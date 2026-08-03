# TEMPLATE-B2 — estimate Chromium binding harness

Local, repository-safe validation for the accepted estimate design binding.

## Tests (host)

```
node --import tsx --test src/lib/pdf/__tests__/template-b2/*.test.ts
```

## Offline smoke render (production-like container)

The serverless Chromium binary is linux/x86_64. On Apple Silicon use the QEMU colima
profile proven in TEMPLATE-B1-R1 and run:

```
docker run --rm \
  -e AWS_LAMBDA_FUNCTION_NAME=b2-smoke -e AWS_EXECUTION_ENV=AWS_Lambda_nodejs20.x \
  -v <repo>:/repo -v <out-dir>:/out -w /repo \
  node:20-bookworm-slim \
  node --import tsx scripts/pdf/template-b2/smoke-render.mjs /out
```

Renders 1 / 8 / 15 / 25-item estimates plus a fallback-logo variant through the REAL
`renderEstimateDocumentPdf`. Expected: A4 portrait, page counts 1/1/2/2, Japanese glyphs
(`2015 年`, `名古屋 332 ひ 3830`) intact, zero outbound requests (the renderer throws otherwise).

Bundle estimate:

```
node scripts/pdf/template-b2/measure-bundle.mjs
```
