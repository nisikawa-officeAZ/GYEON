"use server";

import { resolveOfficeAzInventoryAuthority } from "./resolve-office-az-inventory-authority.js";
import {
  OFFICE_AZ_INVENTORY_CAPABILITIES,
  type OfficeAzInventoryAuthorityEvaluation,
  type OfficeAzInventoryCapability,
} from "./office-az-inventory-authority-types.js";

const ACTION_KEYS = new Set([
  "actorId",
  "operatorId",
  "capability",
  "requiredLocationIds",
  "expectedAuthorityVersion",
  "targetOperatorId",
]);
const MAX_ID_LENGTH = 512;

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isTrimmedNonEmptyId(value: unknown): value is string {
  return (
    typeof value === "string" &&
    value.length > 0 &&
    value.length <= MAX_ID_LENGTH &&
    value === value.trim()
  );
}

function isClosedCapability(
  value: unknown,
): value is OfficeAzInventoryCapability {
  return (
    typeof value === "string" &&
    (OFFICE_AZ_INVENTORY_CAPABILITIES as readonly string[]).includes(value)
  );
}

function isPositiveSafeInteger(value: unknown): value is number {
  return (
    typeof value === "number" &&
    Number.isSafeInteger(value) &&
    value >= 1 &&
    value <= Number.MAX_SAFE_INTEGER
  );
}

function parseRequiredLocationIds(value: unknown): readonly string[] | null {
  if (!Array.isArray(value)) return null;
  const locations: string[] = [];
  const seen = new Set<string>();
  for (const item of value) {
    if (!isTrimmedNonEmptyId(item) || seen.has(item)) return null;
    seen.add(item);
    locations.push(item);
  }
  return locations;
}

function parseActionRequest(input: unknown): {
  actorId: string;
  operatorId: string;
  capability: OfficeAzInventoryCapability;
  requiredLocationIds: readonly string[];
  expectedAuthorityVersion: number;
  targetOperatorId?: string;
} | null {
  try {
    if (!isPlainRecord(input)) return null;
    if (!Object.keys(input).every((key) => ACTION_KEYS.has(key))) return null;
    if (
      !("actorId" in input) ||
      !("operatorId" in input) ||
      !("capability" in input) ||
      !("requiredLocationIds" in input) ||
      !("expectedAuthorityVersion" in input)
    ) {
      return null;
    }
    if (!isTrimmedNonEmptyId(input.actorId) || !isTrimmedNonEmptyId(input.operatorId)) {
      return null;
    }
    if (!isClosedCapability(input.capability)) return null;
    const requiredLocationIds = parseRequiredLocationIds(input.requiredLocationIds);
    if (requiredLocationIds === null) return null;
    if (!isPositiveSafeInteger(input.expectedAuthorityVersion)) return null;
    const targetOperatorId = input.targetOperatorId;
    if ("targetOperatorId" in input && !isTrimmedNonEmptyId(targetOperatorId)) {
      return null;
    }
    return {
      actorId: input.actorId,
      operatorId: input.operatorId,
      capability: input.capability,
      requiredLocationIds,
      expectedAuthorityVersion: input.expectedAuthorityVersion,
      ...(isTrimmedNonEmptyId(targetOperatorId)
        ? { targetOperatorId }
        : {}),
    };
  } catch {
    return null;
  }
}

function browserSupplied(): OfficeAzInventoryAuthorityEvaluation {
  return { tag: "denied", code: "BROWSER_SUPPLIED_AUTHORITY" };
}

/** 読取専用の権限判定。assignment・grant・在庫を変更しない。 */
export async function evaluateOfficeAzInventoryAuthorityAction(
  input: unknown,
): Promise<OfficeAzInventoryAuthorityEvaluation> {
  const parsed = parseActionRequest(input);
  if (!parsed) return browserSupplied();
  return resolveOfficeAzInventoryAuthority(parsed);
}
