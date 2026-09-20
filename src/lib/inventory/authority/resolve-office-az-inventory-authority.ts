import "server-only";

import { getCurrentUser } from "@/lib/auth/get-current-user";
import { createClient } from "@/lib/supabase/server";
import { evaluateOfficeAzInventoryAuthority } from "./office-az-inventory-authority-core.js";
import {
  OFFICE_AZ_INVENTORY_OWNER,
  type OfficeAzInventoryAuthorityEvaluation,
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

function denied(): OfficeAzInventoryAuthorityEvaluation {
  return { tag: "denied", code: "INVALID_REQUEST" };
}

function invalidRecord(): OfficeAzInventoryAuthorityEvaluation {
  return { tag: "denied", code: "INVALID_AUTHORITY_RECORD" };
}

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function hasOnlyRequestKeys(value: Record<string, unknown>): boolean {
  return Object.keys(value).every((key) => REQUEST_KEYS.has(key));
}

function isNonBlank(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0 && value.length <= 512;
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
  if (!isPlainRecord(input) || !hasOnlyRequestKeys(input)) return denied();
  if (!isNonBlank(input.actorId) || !isNonBlank(input.operatorId)) return denied();

  try {
    const user = await getCurrentUser();
    if (!user || !isNonBlank(user.id)) return denied();

    const supabase = await createClient();
    const { data, error } = await supabase.rpc(AUTHORITY_RPC, {
      p_actor_id: input.actorId,
      p_operator_id: input.operatorId,
    });
    if (error || !hasResolverShape(data)) return invalidRecord();

    const requestedAtIso = new Date().toISOString();
    return evaluateOfficeAzInventoryAuthority(
      data.candidates,
      {
        authenticatedUserId: user.id,
        actorId: input.actorId,
        operatorId: input.operatorId,
        owner: OFFICE_AZ_INVENTORY_OWNER,
        capability: input.capability,
        requiredLocationIds: input.requiredLocationIds,
        expectedAuthorityVersion: input.expectedAuthorityVersion,
        requestedAtIso,
        ...(input.targetOperatorId === undefined
          ? {}
          : { targetOperatorId: input.targetOperatorId }),
      },
      data.knownLocationIds,
    );
  } catch {
    return invalidRecord();
  }
}
