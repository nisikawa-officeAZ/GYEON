import { test } from "node:test";
import assert from "node:assert/strict";

import { parseJpPostalCsv } from "./jp-postal-master-csv";

// Synthetic, non-personal rows only. Column order:
// jisCode,oldPostalCode,postalCode,prefKana,cityKana,townKana,prefKanji,cityKanji,townKanji,
// flag10,flag11,flag12,flag13,updateFlag,changeReasonCode
const ROW_A = '13101,100,1000001,ﾄｳｷﾖｳﾄ,ﾁﾖﾀﾞｸ,ﾁﾖﾀﾞ,東京都,千代田区,千代田,0,0,0,0,0,0';
const ROW_B = '13101,100,1000002,ﾄｳｷﾖｳﾄ,ﾁﾖﾀﾞｸ,ｶｽﾐｶﾞｾｷ,東京都,千代田区,霞が関,0,0,1,0,0,0';

test("parses two well-formed synthetic rows covering all 15 fields", () => {
  const result = parseJpPostalCsv(`${ROW_A}\r\n${ROW_B}\r\n`);
  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.equal(result.rows.length, 2);
  assert.deepEqual(result.rows[0], {
    jisCode: "13101",
    oldPostalCode: "100",
    postalCode: "1000001",
    prefectureKana: "ﾄｳｷﾖｳﾄ",
    cityKana: "ﾁﾖﾀﾞｸ",
    townKana: "ﾁﾖﾀﾞ",
    prefectureKanji: "東京都",
    cityKanji: "千代田区",
    townKanji: "千代田",
    flagMultiPostalPerTown: "0",
    flagKoazaBanchi: "0",
    flagHasChome: "0",
    flagMultiTownPerPostal: "0",
    updateFlag: "0",
    changeReasonCode: "0",
  });
});

test("preserves leading zeroes in the JIS code and old postal code", () => {
  const row = '01101,60,0600000,ﾎｯｶｲﾄﾞｳ,ｻｯﾎﾟﾛｼﾁｭｳｵｳｸ,ｲｶﾞｲ,北海道,札幌市中央区,以下に掲載がない場合,0,0,0,0,0,0';
  const result = parseJpPostalCsv(`${row}\n`);
  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.equal(result.rows[0].jisCode, "01101");
  assert.equal(result.rows[0].oldPostalCode, "60");
});

test("handles a quoted field containing a comma", () => {
  const row = '13101,100,1000003,ﾄｳｷﾖｳﾄ,ﾁﾖﾀﾞｸ,"ｵｵﾃﾏﾁ,1ﾁｮｳﾒ",東京都,千代田区,"大手町、1丁目",0,0,1,0,0,0';
  const result = parseJpPostalCsv(`${row}\n`);
  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.equal(result.rows[0].townKana, "ｵｵﾃﾏﾁ,1ﾁｮｳﾒ");
  assert.equal(result.rows[0].townKanji, "大手町、1丁目");
});

test("handles an escaped double-quote inside a quoted field", () => {
  const row = '13101,100,1000004,ﾄｳｷﾖｳﾄ,ﾁﾖﾀﾞｸ,"ﾃｽﾄ""ﾁｮｳ""",東京都,千代田区,"テスト""町""",0,0,0,0,0,0';
  const result = parseJpPostalCsv(`${row}\n`);
  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.equal(result.rows[0].townKanji, 'テスト"町"');
});

test("rejects a malformed unclosed quote", () => {
  const row = '13101,100,1000005,ﾄｳｷﾖｳﾄ,ﾁﾖﾀﾞｸ,"ｵｵﾃﾏﾁ,東京都,千代田区,大手町,0,0,0,0,0,0';
  const result = parseJpPostalCsv(`${row}\n`);
  assert.equal(result.ok, false);
  if (result.ok) return;
  assert.equal(result.error === "MALFORMED_QUOTE" || result.error === "EMBEDDED_RECORD_BREAK", true);
});

test("rejects a BOM-prefixed input", () => {
  const result = parseJpPostalCsv(`﻿${ROW_A}\n`);
  assert.equal(result.ok, false);
  if (result.ok) return;
  assert.equal(result.error, "BOM_PRESENT");
});

test("rejects an embedded record break (unterminated quote spanning lines)", () => {
  const text = `13101,100,1000006,ﾄｳｷﾖｳﾄ,ﾁﾖﾀﾞｸ,"ｵｵﾃﾏﾁ\n1ﾁｮｳﾒ",東京都,千代田区,大手町,0,0,0,0,0,0\n`;
  const result = parseJpPostalCsv(text);
  assert.equal(result.ok, false);
});

test("rejects empty input", () => {
  const result = parseJpPostalCsv("");
  assert.equal(result.ok, false);
  if (result.ok) return;
  assert.equal(result.error, "EMPTY_INPUT");
});

test("rejects a row with too few columns", () => {
  const row = "13101,100,1000001,ﾄｳｷﾖｳﾄ,ﾁﾖﾀﾞｸ,ﾁﾖﾀﾞ,東京都,千代田区,千代田,0,0,0,0";
  const result = parseJpPostalCsv(`${row}\n`);
  assert.equal(result.ok, false);
  if (result.ok) return;
  assert.equal(result.error, "COLUMN_COUNT_MISMATCH");
});

test("rejects a row with too many columns", () => {
  const row = `${ROW_A},extra`;
  const result = parseJpPostalCsv(`${row}\n`);
  assert.equal(result.ok, false);
  if (result.ok) return;
  assert.equal(result.error, "COLUMN_COUNT_MISMATCH");
});

test("rejects an invalid postal code length", () => {
  const row = ROW_A.replace(",1000001,", ",100001,");
  const result = parseJpPostalCsv(`${row}\n`);
  assert.equal(result.ok, false);
  if (result.ok) return;
  assert.equal(result.error, "INVALID_POSTAL_CODE");
});

test("rejects an invalid JIS municipality code", () => {
  const row = ROW_A.replace("13101,", "1310,");
  const result = parseJpPostalCsv(`${row}\n`);
  assert.equal(result.ok, false);
  if (result.ok) return;
  assert.equal(result.error, "INVALID_JIS_CODE");
});

test("rejects an out-of-range flag value", () => {
  const row = ROW_A.replace(",0,0,0,0,0,0", ",2,0,0,0,0,0");
  const result = parseJpPostalCsv(`${row}\n`);
  assert.equal(result.ok, false);
  if (result.ok) return;
  assert.equal(result.error, "INVALID_FLAG_VALUE");
});

test("rejects an invalid update flag", () => {
  const row = ROW_A.replace(",0,0", ",3,0").replace(",0,0,0,0,3,0", ",0,0,0,0,3,0");
  // Directly construct a row with updateFlag=3 to avoid ambiguous replace targeting.
  const fields = ROW_A.split(",");
  fields[13] = "3";
  const result = parseJpPostalCsv(`${fields.join(",")}\n`);
  assert.equal(result.ok, false);
  if (result.ok) return;
  assert.equal(result.error, "INVALID_UPDATE_FLAG");
});

test("rejects an invalid change-reason code", () => {
  const fields = ROW_A.split(",");
  fields[14] = "7";
  const result = parseJpPostalCsv(`${fields.join(",")}\n`);
  assert.equal(result.ok, false);
  if (result.ok) return;
  assert.equal(result.error, "INVALID_CHANGE_REASON_CODE");
});

test("all three non-specific town forms parse as ordinary rows (flag semantics only)", () => {
  const forms = [
    "以下に掲載がない場合",
    "市区町村名の次に番地がくる場合",
    "市区町村名一円",
  ];
  for (const town of forms) {
    const fields = ROW_A.split(",");
    fields[8] = town;
    const result = parseJpPostalCsv(`${fields.join(",")}\n`);
    assert.equal(result.ok, true);
    if (!result.ok) continue;
    assert.equal(result.rows[0].townKanji, town);
  }
});

test("rejects duplicate row identity", () => {
  const result = parseJpPostalCsv(`${ROW_A}\n${ROW_A}\n`);
  assert.equal(result.ok, false);
  if (result.ok) return;
  assert.equal(result.error, "DUPLICATE_ROW_IDENTITY");
});

test("accepts two distinct towns sharing one postal code (not a duplicate)", () => {
  const fields = ROW_A.split(",");
  fields[8] = "千代田別町"; // distinct town, same postal code
  const result = parseJpPostalCsv(`${ROW_A}\n${fields.join(",")}\n`);
  assert.equal(result.ok, true);
});

test("rejects a raw replacement-character sequence as invalid encoding", () => {
  const result = parseJpPostalCsv(`13101,100,1000001,�,ﾁﾖﾀﾞｸ,ﾁﾖﾀﾞ,東京都,千代田区,千代田,0,0,0,0,0,0\n`);
  assert.equal(result.ok, false);
  if (result.ok) return;
  assert.equal(result.error, "INVALID_ENCODING");
});
