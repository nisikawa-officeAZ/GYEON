"use server";

import { createClient } from "@/lib/supabase/server";

// ─── Types ────────────────────────────────────────────────────────────────────

interface CsvRow {
  sku:           string;
  jan_code?:     string;
  product_name:  string;
  brand?:        string;
  category?:     string;
  size_label?:   string;
  retail_price?: string;
  description?:  string;
  image_url?:    string;
  is_active?:    string;
}

export interface ImportResult {
  inserted: number;
  updated:  number;
  errors:   { row: number; sku: string; message: string }[];
}

// ─── CSV Parser ───────────────────────────────────────────────────────────────

function parseCsv(text: string): { headers: string[]; rows: string[][] } {
  const lines = text.replace(/\r\n/g, "\n").replace(/\r/g, "\n").split("\n");
  const headers = splitCsvLine(lines[0] ?? "").map((h) => h.trim().toLowerCase());
  const rows: string[][] = [];
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;
    rows.push(splitCsvLine(line));
  }
  return { headers, rows };
}

function splitCsvLine(line: string): string[] {
  const result: string[] = [];
  let current = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (ch === "," && !inQuotes) {
      result.push(current);
      current = "";
    } else {
      current += ch;
    }
  }
  result.push(current);
  return result;
}

function rowToObject(headers: string[], values: string[]): CsvRow {
  const obj: Record<string, string> = {};
  for (let i = 0; i < headers.length; i++) {
    obj[headers[i]] = (values[i] ?? "").trim();
  }
  return obj as unknown as CsvRow;
}

// ─── Import ───────────────────────────────────────────────────────────────────

/**
 * Parses a CSV string and upserts gyeon_products rows.
 * Duplicate SKU → UPDATE; new SKU → INSERT.
 * Uses service role (admin-only operation) via the server-side client.
 */
export async function importGyeonProductsCsv(
  csvText: string,
): Promise<ImportResult> {
  const supabase = await createClient();
  const result: ImportResult = { inserted: 0, updated: 0, errors: [] };

  const { headers, rows } = parseCsv(csvText);

  if (!headers.includes("sku") || !headers.includes("product_name")) {
    return {
      inserted: 0,
      updated:  0,
      errors:   [{ row: 0, sku: "", message: "CSV must have 'sku' and 'product_name' columns." }],
    };
  }

  // Fetch existing SKUs for insert/update tracking
  const { data: existing } = await supabase
    .from("gyeon_products")
    .select("sku");
  const existingSkus = new Set((existing ?? []).map((r: { sku: string }) => r.sku));

  for (let i = 0; i < rows.length; i++) {
    const rowNum = i + 2; // 1-indexed, row 1 is header
    const raw = rowToObject(headers, rows[i]);

    if (!raw.sku) {
      result.errors.push({ row: rowNum, sku: "", message: "SKU is required." });
      continue;
    }
    if (!raw.product_name) {
      result.errors.push({ row: rowNum, sku: raw.sku, message: "product_name is required." });
      continue;
    }

    const retailPrice = raw.retail_price ? parseFloat(raw.retail_price) : null;
    const isActive    = raw.is_active === undefined || raw.is_active === ""
      ? true
      : raw.is_active.toLowerCase() !== "false" && raw.is_active !== "0";

    const payload = {
      sku:          raw.sku,
      jan_code:     raw.jan_code     || null,
      product_name: raw.product_name,
      brand:        raw.brand        || "GYEON",
      category:     raw.category     || null,
      size_label:   raw.size_label   || null,
      retail_price: isNaN(retailPrice!) ? null : retailPrice,
      description:  raw.description  || null,
      image_url:    raw.image_url    || null,
      is_active:    isActive,
    };

    const isExisting = existingSkus.has(raw.sku);

    if (isExisting) {
      const { error } = await supabase
        .from("gyeon_products")
        .update({ ...payload, updated_at: new Date().toISOString() })
        .eq("sku", raw.sku);

      if (error) {
        result.errors.push({ row: rowNum, sku: raw.sku, message: error.message });
      } else {
        result.updated++;
      }
    } else {
      const { error } = await supabase
        .from("gyeon_products")
        .insert(payload);

      if (error) {
        result.errors.push({ row: rowNum, sku: raw.sku, message: error.message });
      } else {
        result.inserted++;
        existingSkus.add(raw.sku); // prevent duplicate within same CSV
      }
    }
  }

  return result;
}
