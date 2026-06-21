"use server";

import { createClient } from "@/lib/supabase/server";
import { GyeonProductDB, GyeonProductFilter } from "./product-types";

export async function getGyeonProducts(
  filter: GyeonProductFilter = {},
): Promise<GyeonProductDB[]> {
  const supabase = await createClient();

  let query = supabase
    .from("gyeon_products")
    .select("*")
    .order("category", { ascending: true })
    .order("product_name", { ascending: true });

  if (filter.active_only !== false) {
    // Default: show only active products
    query = query.eq("is_active", true);
  }

  if (filter.sku) {
    query = query.ilike("sku", `%${filter.sku}%`);
  }

  if (filter.category) {
    query = query.eq("category", filter.category);
  }

  if (filter.keyword) {
    query = query.or(
      `product_name.ilike.%${filter.keyword}%,sku.ilike.%${filter.keyword}%,description.ilike.%${filter.keyword}%`,
    );
  }

  const { data } = await query.limit(200);
  return (data ?? []) as GyeonProductDB[];
}

export async function getGyeonProductCategories(): Promise<string[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("gyeon_products")
    .select("category")
    .eq("is_active", true)
    .not("category", "is", null);

  const cats = [...new Set((data ?? []).map((r: { category: string | null }) => r.category).filter(Boolean))] as string[];
  return cats.sort();
}

export async function searchGyeonProducts(
  keyword: string,
  category?: string,
): Promise<GyeonProductDB[]> {
  return getGyeonProducts({ keyword, category, active_only: true });
}
