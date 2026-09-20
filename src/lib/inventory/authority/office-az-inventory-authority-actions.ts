"use server";

import { resolveOfficeAzInventoryAuthority } from "./resolve-office-az-inventory-authority.js";
import type { OfficeAzInventoryAuthorityEvaluation } from "./office-az-inventory-authority-types.js";

const ACTION_KEYS = new Set([
  "actorId",
  "operatorId",
  "capability",
  "requiredLocationIds",
  "expectedAuthorityVersion",
  "targetOperatorId",
]);

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** 読取専用の権限判定。assignment・grant・在庫を変更しない。 */
export async function evaluateOfficeAzInventoryAuthorityAction(
  input: unknown,
): Promise<OfficeAzInventoryAuthorityEvaluation> {
  if (
    !isPlainRecord(input) ||
    !Object.keys(input).every((key) => ACTION_KEYS.has(key))
  ) {
    return { tag: "denied", code: "BROWSER_SUPPLIED_AUTHORITY" };
  }
  return resolveOfficeAzInventoryAuthority(input);
}
