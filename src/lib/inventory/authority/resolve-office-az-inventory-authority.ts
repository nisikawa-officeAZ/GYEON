import "server-only";

import { getCurrentUser } from "@/lib/auth/get-current-user";
import { createClient } from "@/lib/supabase/server";
import { evaluateOfficeAzInventoryAuthority } from "./office-az-inventory-authority-core.js";
import {
  OFFICE_AZ_INVENTORY_CAPABILITIES,
  OFFICE_AZ_INVENTORY_OWNER,
  type OfficeAzInventoryAuthorityEvaluation,
  type OfficeAzInventoryCapability,
} from "./office-az-inventory-authority-types.js";

const AUTHORITY_RPC = "resolve_office_az_inventory_authority" as const;
const REQUEST_KEYS = new Set([
  "actorId",
  "operatorId",
  "capability",
  "requiredLocationIds",
  "expectedAuthorityVersion",
  "targetOperatorId",
]);
const MAX_ID_LENGTH = 512;

function denied(): OfficeAzInventoryAuthorityEvaluation {
  return { tag: "denied", code: "INVALID_REQUEST" };
}

function invalidRecord(): OfficeAzInventoryAuthorityEvaluation {
  return { tag: "denied", code: "INVALID_AUTHORITY_RECORD" };
}

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

function parseResolverRequest(input: unknown): {
  actorId: string;
  operatorId: string;
  capability: OfficeAzInventoryCapability;
  requiredLocationIds: readonly string[];
  expectedAuthorityVersion: number;
  targetOperatorId?: string;
} | null {
  try {
    if (!isPlainRecord(input)) return null;
    if (!Object.keys(input).every((key) => REQUEST_KEYS.has(key))) return null;
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

function hasResolverShape(value: unknown): value is {
  candidates: readonly unknown[];
  knownLocationIds: readonly unknown[];
} {
  return (
    isPlainRecord(value) &&
    Object.keys(value).length === 2 &&
    Array.isArray(value.candidates) &&
    Array.isArray(value.knownLocationIds)
  );
}

/**
 * request-scoped auth と同一RPCスナップショットだけから権限を解決する。
 * ブラウザが本人ID・role・grant・owner・時刻を注入できる入力面は持たない。
 */
export async function resolveOfficeAzInventoryAuthority(
  input: unknown,
): Promise<OfficeAzInventoryAuthorityEvaluation> {
  const parsed = parseResolverRequest(input);
  if (!parsed) return denied();

  try {
    const user = await getCurrentUser();
    if (!user || !isTrimmedNonEmptyId(user.id)) return denied();

    const supabase = await createClient();
    const { data, error } = await supabase.rpc(AUTHORITY_RPC, {
      p_actor_id: parsed.actorId,
      p_operator_id: parsed.operatorId,
    });
    if (error || !hasResolverShape(data)) return invalidRecord();

    const requestedAtIso = new Date().toISOString();
    return evaluateOfficeAzInventoryAuthority(
      data.candidates,
      {
        authenticatedUserId: user.id,
        actorId: parsed.actorId,
        operatorId: parsed.operatorId,
        owner: OFFICE_AZ_INVENTORY_OWNER,
        capability: parsed.capability,
        requiredLocationIds: parsed.requiredLocationIds,
        expectedAuthorityVersion: parsed.expectedAuthorityVersion,
        requestedAtIso,
        ...(parsed.targetOperatorId === undefined
          ? {}
          : { targetOperatorId: parsed.targetOperatorId }),
      },
      data.knownLocationIds,
    );
  } catch {
    return invalidRecord();
  }
}
