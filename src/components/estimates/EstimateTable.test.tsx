import { test } from "node:test";
import assert from "node:assert/strict";
import * as React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { readFileSync } from "node:fs";

import EstimateTable from "./EstimateTable";
import type { EstimateDB } from "@/lib/estimates/estimate-types";

(globalThis as { React?: typeof React }).React = React;

const TABLE_SOURCE = readFileSync(new URL("./EstimateTable.tsx", import.meta.url), "utf8");
const DETAIL_SOURCE = readFileSync(new URL("./EstimateDetail.tsx", import.meta.url), "utf8");

function estimate(id: string, status: EstimateDB["status"]): EstimateDB {
  return {
    id,
    customer_id: `customer-${id}`,
    vehicle_id: `vehicle-${id}`,
    estimate_no: `EST-${id}`,
    estimate_number: null,
    title: null,
    status,
    subtotal: 987654321,
    tax: 123456789,
    tax_rate: 10,
    tax_amount: 123456789,
    discount_amount: 0,
    total: 1111111110,
    valid_until: null,
    notes: null,
    internal_memo: null,
    dealer_id: "dealer-1",
    deleted_at: null,
    created_at: "2026-09-20T00:00:00.000Z",
    updated_at: "2026-09-20T00:00:00.000Z",
    customers: {
      last_name: "非常に長い法人顧客名称株式会社",
      first_name: "本店営業部",
      phone: null,
      email: null,
      postal_code: null,
      address1: null,
      is_business: true,
    },
    vehicles: {
      maker: "非常に長いメーカー名称",
      model: "非常に長い車両モデル名称",
      year: null,
      grade: null,
      color: null,
      mileage: null,
      plate_number: "滋賀 480 て 4938",
      body_size: null,
      registration_date: null,
      inspection_expiry_date: null,
    },
  };
}

function render() {
  return renderToStaticMarkup(
    <EstimateTable
      estimates={[estimate("0001", "approved"), estimate("0002", "draft")]}
      onViewDetail={() => {}}
      onEdit={() => {}}
      onCreateWorkOrder={() => {}}
    />
  );
}

test("estimate list omits monetary columns and values at every breakpoint", () => {
  const html = render();
  assert.doesNotMatch(html, />小計</);
  assert.doesNotMatch(html, />消費税</);
  assert.doesNotMatch(html, />合計</);
  assert.doesNotMatch(html, /987,654,321|123,456,789|1,111,111,110/);
});

test("customer and vehicle names truncate inside the fixed desktop table", () => {
  const html = render();
  assert.match(html, /table-fixed/);
  assert.equal((html.match(/class="block truncate"/g) ?? []).length, 4);
  assert.match(html, /title="非常に長い法人顧客名称株式会社 本店営業部"/);
  assert.match(html, /title="非常に長いメーカー名称 非常に長い車両モデル名称 滋賀 480 て 4938"/);
});

test("every row reserves estimate, PDF, edit and construction-instruction slots in that exact order", () => {
  const html = render();
  assert.equal((html.match(/data-testid="estimate-action-grid"/g) ?? []).length, 2);
  assert.equal((html.match(/data-testid="estimate-action-grid-mobile"/g) ?? []).length, 2);
  assert.match(html, /grid-cols-\[4\.5rem_2\.75rem_2\.75rem_4rem\]/);

  const firstDesktopGrid = html.slice(
    html.indexOf('data-testid="estimate-action-grid"'),
    html.indexOf('data-testid="estimate-action-grid"', html.indexOf('data-testid="estimate-action-grid"') + 1),
  );
  const order = [
    firstDesktopGrid.indexOf('data-action="estimate"'),
    firstDesktopGrid.indexOf('data-action="pdf"'),
    firstDesktopGrid.indexOf('data-action="edit"'),
    firstDesktopGrid.indexOf('data-action="work-order"'),
  ];
  assert.ok(order.every((index) => index >= 0));
  assert.deepEqual(order, [...order].sort((a, b) => a - b));

  assert.equal((html.match(/data-action-placeholder="work-order"/g) ?? []).length, 2);
  assert.equal((html.match(/>施工指示<\/button>/g) ?? []).length, 2);
  assert.doesNotMatch(html, />WO<\/button>/);
});

test("desktop estimate rows open details on double click without hijacking action controls", () => {
  assert.match(TABLE_SOURCE, /data-row-action="view-detail-on-double-click"/);
  assert.match(TABLE_SOURCE, /onDoubleClick=\{\(event\) => \{/);
  assert.match(TABLE_SOURCE, /target\.closest\("button, a"\)/);
  assert.match(TABLE_SOURCE, /onViewDetail\(e\)/);
  assert.match(TABLE_SOURCE, /ダブルクリックで見積詳細を表示/);
  assert.match(TABLE_SOURCE, /cursor-pointer/);
});

test("the detail reached from the row keeps the direct edit route", () => {
  assert.match(DETAIL_SOURCE, /router\.push\(`\/estimates\/\$\{estimate\.id\}\/edit`\)/);
  assert.match(DETAIL_SOURCE, />\s*編集する\s*<\/button>/);
});
