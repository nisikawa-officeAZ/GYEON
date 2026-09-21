import { readFileSync, writeFileSync } from "node:fs";

const [inputPath, outputPath] = process.argv.slice(2);
if (!inputPath || !outputPath) {
  throw new Error("usage: node scripts/generate-japan-post-address-map.mjs INPUT.csv OUTPUT.json");
}

function parseCsvLine(line) {
  const fields = [];
  let field = "";
  let quoted = false;
  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];
    if (char === '"') {
      if (quoted && line[index + 1] === '"') {
        field += '"';
        index += 1;
      } else {
        quoted = !quoted;
      }
    } else if (char === "," && !quoted) {
      fields.push(field);
      field = "";
    } else {
      field += char;
    }
  }
  fields.push(field);
  return fields;
}

function normalizedAddressKey(value) {
  return value.normalize("NFKC").replace(/[\s　]/gu, "");
}

const values = new Map();
const lines = readFileSync(inputPath, "utf8").split(/\r?\n/u);
for (const line of lines) {
  if (!line) continue;
  const fields = parseCsvLine(line);
  if (fields.length < 9) throw new Error(`invalid CSV row: ${line.slice(0, 80)}`);

  const postal = fields[2];
  const prefecture = fields[6];
  const municipality = fields[7];
  const rawTown = fields[8];
  // A municipality fallback must not match an OCR-misread or unknown town. Only a concrete
  // Japan Post town prefix is safe for automatic reflection.
  if (/以下に掲載がない場合/u.test(rawTown)) continue;
  const town = rawTown.replace(/（.*）$/u, "");
  const key = normalizedAddressKey(`${prefecture}${municipality}${town}`);
  if (!/^\d{7}$/u.test(postal) || key === "") continue;

  const previous = values.get(key);
  if (previous === undefined) values.set(key, postal);
  else if (previous !== postal) values.set(key, "");
}

const entries = Object.fromEntries([...values.entries()].sort(([left], [right]) => left.localeCompare(right, "ja")));
writeFileSync(outputPath, `${JSON.stringify({
  source: "Japan Post utf_ken_all.csv",
  sourceUrl: "https://www.post.japanpost.jp/service/search/zipcode/download/utf/zip/utf_ken_all.zip",
  updated: "2026-08-31",
  entries,
})}\n`);
