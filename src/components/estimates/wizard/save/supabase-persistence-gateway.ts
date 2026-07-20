import "server-only";

// Estimate Wizard Ver2.2 — Supabase atomic-RPC persistence gateway (Phase 11I).
//
// The REAL persistence gateway. Server-only. It (Option B) allocates + formats the estimate number via
// the existing authoritative TypeScript numbering rules, then calls the single atomic RPC
// `save_estimate_from_wizard` (migration 102). It maps the RPC's coded errors to stable codes and
// NEVER exposes raw Supabase/Postgres error text. Dealer id comes from the server context only
// (getCurrentDealer upstream); it is never read from the payload/client. No persistence logic is
// duplicated here — the transaction lives entirely in the RPC.

import { createAdminClient } from "@/lib/supabase/admin";
import type { EstimatePersistenceGateway, EstimateSaveGatewayResult } from "./estimate-persistence-gateway";

// Known RPC error-code prefixes → stable gateway codes. Anything else → SAVE_FAILED (no raw leak).
const RPC_CODE_PREFIXES = [
  "UNAUTHENTICATED", "PERMISSION_DENIED",
  "DEALER_CONTEXT_REQUIRED", "VALIDATION_ERROR", "PRICING_INCOMPLETE",
  "CUSTOMER_NOT_FOUND", "VEHICLE_NOT_FOUND", "DUPLICATE_SUBMISSION",
  "ESTIMATE_NUMBER_FAILED", "ESTIMATE_CREATE_FAILED", "ESTIMATE_ITEM_CREATE_FAILED",
] as const;

function mapRpcError(rawMessage: string | undefined): { code: string; message: string } {
  const msg = rawMessage ?? "";
  const prefix = RPC_CODE_PREFIXES.find((c) => msg.startsWith(`${c}:`) || msg === c);
  if (prefix === "DUPLICATE_SUBMISSION") return { code: "DUPLICATE_SUBMISSION", message: "同じ内容の見積が既に保存されています。" };
  if (prefix === "CUSTOMER_NOT_FOUND")   return { code: "CUSTOMER_NOT_FOUND", message: "お客様情報を確認できませんでした。" };
  if (prefix === "VEHICLE_NOT_FOUND")    return { code: "VEHICLE_NOT_FOUND", message: "車両情報を確認できませんでした。" };
  if (prefix === "PRICING_INCOMPLETE")   return { code: "PRICING_INCOMPLETE", message: "価格が未確定のため保存できません。" };
  if (prefix === "VALIDATION_ERROR")     return { code: "VALIDATION_ERROR", message: "入力内容に不備があります。" };
  if (prefix === "DEALER_CONTEXT_REQUIRED") return { code: "DEALER_CONTEXT_REQUIRED", message: "ディーラー情報の取得に失敗しました。" };
  // R56B: the hardened RPC performs its own actor/membership/role checks and raises these two.
  // Both map to fixed operator-safe text — the RPC's detail text is never forwarded.
  if (prefix === "UNAUTHENTICATED")      return { code: "UNAUTHENTICATED", message: "ログインが必要です。" };
  if (prefix === "PERMISSION_DENIED")    return { code: "PERMISSION_DENIED", message: "この操作を行う権限がありません。" };
  return { code: "SAVE_FAILED", message: "保存中にエラーが発生しました。" };
}

export const supabasePersistenceGateway: EstimatePersistenceGateway = {
  async saveEstimate(payload, ctx): Promise<EstimateSaveGatewayResult> {
    // 1. Single atomic RPC — the ONLY place the number, customer, vehicle, estimate and
    //    items are produced, and they are produced TOGETHER.
    //
    // B7-0A: the estimate number is NO LONGER allocated here. It is allocated inside the
    // RPC, after the advisory lock and after replay/conflict resolution, in the same
    // transaction as the writes. Pre-allocating in a separate committed RPC — as this
    // gateway used to — burned a document number on every exact replay, every
    // DUPLICATE_SUBMISSION and every rejected save, leaving permanent gaps in
    // document_sequences. There is deliberately no p_estimate_number parameter left to
    // supply, so a caller-chosen number is now unrepresentable rather than merely unused.
    //
    // R56B: the SERVER-ONLY principal. EXECUTE on the RPC is granted to service_role alone, because
    // the browser client and the Next.js server client share the SAME public URL + anon key: an
    // `authenticated` grant would have let any signed-in user call the RPC directly with chosen
    // prices, and the RPC never reprices. `createAdminClient()` uses SUPABASE_SERVICE_ROLE_KEY,
    // which carries no NEXT_PUBLIC_ prefix and is never shipped to the browser.
    //
    // Consequence, and why the RPC still checks everything itself: service_role BYPASSES RLS and
    // auth.uid() is NULL, so the database has no backstop here. The RPC re-verifies the actor,
    // requires exactly one active membership matching the dealer, resolves the effective role, and
    // scopes every read/write by an explicit dealer predicate.
    const supabase = createAdminClient();
    const { data, error } = await supabase.rpc("save_estimate_from_wizard", {
      p_dealer_id:     ctx.dealerId,   // server-resolved context; never from payload
      p_actor_user_id: ctx.userId,
      p_payload:       payload,
    });

    if (error) {
      // Observability (server-side, DEVELOPMENT ONLY): surface the RPC diagnostic so an unmatched error
      // does not silently collapse into SAVE_FAILED with no way to diagnose it. Logs ONLY the Postgres
      // error CODE and MESSAGE — deliberately NOT `details`/`hint`, which can echo a failing row's
      // column values (customer/vehicle PII). The CLIENT still receives only the controlled mapped
      // code/message; the raw error is NEVER exposed to the user.
      if (process.env.NODE_ENV !== "production") {
        console.error(`[estimate-save] save_estimate_from_wizard RPC error code=${error.code ?? "?"} message=${error.message}`);
      }
      return { ok: false, ...mapRpcError(error.message) };
    }

    // 2. Map the RPC jsonb result (never raw DB error text to the client).
    const r = (data ?? {}) as {
      ok?: boolean; estimate_id?: string; estimate_number?: string;
      customer_id?: string; vehicle_id?: string; idempotent_replay?: boolean;
    };
    if (!r.ok || !r.estimate_id) {
      return { ok: false, code: "SAVE_FAILED", message: "保存に失敗しました。" };
    }

    // The RPC is now the ONLY source of the estimate number — for a new save and for a
    // replay alike (a replay returns the number the original save persisted). There is no
    // local value left to fall back to, and inventing one (a blank, a timestamp, a UUID)
    // would surface a number that exists nowhere in the database. A missing, blank or
    // non-string value therefore fails closed rather than being papered over.
    if (typeof r.estimate_number !== "string" || r.estimate_number.trim() === "") {
      return { ok: false, code: "SAVE_FAILED", message: "保存に失敗しました。" };
    }

    return {
      ok: true,
      estimateId:     r.estimate_id,
      estimateNumber: r.estimate_number,   // exactly what was persisted
      customerId:     r.customer_id ?? "",
      vehicleId:      r.vehicle_id ?? "",
      replay:         !!r.idempotent_replay,
    };
  },
};
