import "server-only";

import { getCurrentDealer } from "@/lib/auth/get-current-dealer";
import { createClient } from "@/lib/supabase/server";
import {
  PPF_R1_COEFFICIENT_CONTRACT_VERSION,
  PPF_R1_STANDARD_PRODUCT_CODES,
  parsePpfR1InstallationCoefficientSettings,
  type PpfR1InstallationCoefficientSettings,
  type PpfR1StandardProductCode,
} from "./ppf-r1-installation-coefficient-contract";

export interface PpfR1CoefficientProduct {
  id: string;
  code: PpfR1StandardProductCode;
  label: string;
  coefficientBp: number | null;
}

export interface PpfR1PartOption {
  code: string;
  label: string;
}

export type AuthoritativePpfR1CoefficientReadResult =
  | { status: "READY" | "NOT_CONFIGURED" | "INCOMPLETE"; settings: PpfR1InstallationCoefficientSettings | null; products: PpfR1CoefficientProduct[]; parts: PpfR1PartOption[] }
  | { status: "MALFORMED" | "UNAUTHENTICATED" | "READ_FAILED" };

/** Read the eight immutable GYEON PPF products and only this dealer's coefficient overrides. */
export async function getAuthoritativePpfR1InstallationCoefficients(): Promise<AuthoritativePpfR1CoefficientReadResult> {
  try {
    const dealer = await getCurrentDealer();
    if (!dealer) return { status: "UNAUTHENTICATED" };

    const supabase = await createClient();
    const { data: products, error: productError } = await supabase
      .from("wizard_catalog_items")
      .select("id, code, label_ja, install_coefficient_bp")
      .eq("market", "jp")
      .eq("product_mode", "gyeon")
      .eq("kind", "ppf_type_group")
      .eq("owner_scope", "global")
      .eq("is_active", true)
      .is("deleted_at", null)
      .not("ppf_type_group_id", "is", null)
      .in("code", [...PPF_R1_STANDARD_PRODUCT_CODES]);
    if (productError || !products) return { status: "READ_FAILED" };

    const { data: parts, error: partError } = await supabase
      .from("wizard_catalog_items")
      .select("code, label_ja, display_order")
      .eq("market", "jp")
      .eq("product_mode", "gyeon")
      .eq("kind", "ppf_part")
      .eq("owner_scope", "global")
      .eq("is_active", true)
      .is("deleted_at", null)
      .order("display_order", { ascending: true });
    if (partError || !parts) return { status: "READ_FAILED" };

    const { data: overrides, error: overrideError } = await supabase
      .from("dealer_wizard_catalog_overrides")
      .select("catalog_item_id, install_coefficient_bp")
      .eq("dealer_id", dealer.dealer_id)
      .in("catalog_item_id", products.map((product) => product.id));
    if (overrideError || !overrides) return { status: "READ_FAILED" };

    const allowedCodes = new Set<string>(PPF_R1_STANDARD_PRODUCT_CODES);
    if (products.length !== PPF_R1_STANDARD_PRODUCT_CODES.length
      || new Set(products.map((product) => product.code)).size !== PPF_R1_STANDARD_PRODUCT_CODES.length
      || products.some((product) => !allowedCodes.has(product.code))
      || parts.length !== 16
      || new Set(parts.map((part) => part.code)).size !== 16) {
      return { status: "MALFORMED" };
    }

    const resolvedParts = parts.map((part) => ({ code: part.code, label: part.label_ja ?? part.code }));

    const overrideById = new Map(overrides.map((row) => [row.catalog_item_id, row.install_coefficient_bp]));
    const resolvedProducts: PpfR1CoefficientProduct[] = products.map((product) => ({
      id: product.id,
      code: product.code as PpfR1StandardProductCode,
      label: product.label_ja ?? product.code,
      coefficientBp: overrideById.has(product.id)
        ? overrideById.get(product.id) ?? null
        : product.install_coefficient_bp ?? null,
    }));

    const configured = resolvedProducts.filter((product) => product.coefficientBp !== null);
    if (configured.length === 0) {
      return { status: "NOT_CONFIGURED", settings: null, products: resolvedProducts, parts: resolvedParts };
    }
    if (configured.length !== PPF_R1_STANDARD_PRODUCT_CODES.length) {
      return { status: "INCOMPLETE", settings: null, products: resolvedProducts, parts: resolvedParts };
    }

    try {
      const settings = parsePpfR1InstallationCoefficientSettings({
        contractVersion: PPF_R1_COEFFICIENT_CONTRACT_VERSION,
        installationCoefficientsBpByProductCode: Object.fromEntries(
          resolvedProducts.map((product) => [product.code, product.coefficientBp]),
        ),
      });
      return { status: "READY", settings, products: resolvedProducts, parts: resolvedParts };
    } catch {
      return { status: "MALFORMED" };
    }
  } catch {
    return { status: "READ_FAILED" };
  }
}
