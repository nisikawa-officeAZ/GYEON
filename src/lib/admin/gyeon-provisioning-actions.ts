"use server";

// GYEON partner provisioning — superAdmin-only server actions
// (GYEON-PARTNER-ONBOARD-F1).
//
// Every entry point:
//   1. checks the server-only feature gate BEFORE any provisioning-table
//      access (SaaS deployments: typed "disabled", zero queries), then
//   2. requires super_admin (requireSuperAdmin throws otherwise).
//
// Invitation contract (locked):
//   * the provisioning record is persisted/transitioned BEFORE the Auth
//     invitation API is called (record-first ordering);
//   * an uncertain external result leaves invitation_state = 'pending' and is
//     NEVER retried automatically — reconcile and resend are separate explicit
//     superAdmin operations;
//   * a definite failure sets 'failed'; an already-registered email sets
//     'awaiting_claim' WITHOUT creating another Auth user;
//   * the returned Auth user id is stored when available;
//   * none of this ever gates the claim (claim eligibility reads
//     provisioning_status + claimed_at only).

import { requireSuperAdmin } from "./require-admin";
import { isGyeonPartnerOnboardingEnabled } from "@/lib/gyeon/partner-onboarding-enabled";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  classifyGyeonInviteError,
  isGyeonProvisioningRank,
  isValidGyeonProvisioningEmail,
  normalizeGyeonProvisioningEmail,
  projectGyeonProvisioningRow,
  type GyeonProvisioningAdminRow,
} from "./gyeon-provisioning-csv-core";

const LIST_LIMIT = 500;
const RECONCILE_MAX_PAGES = 10;
const RECONCILE_PAGE_SIZE = 200;

// F2-07: invite_last_error only ever stores a bounded, stable classification —
// never raw provider messages (they can embed URLs, tokens, or addresses).
const ERROR_CODE_SHAPE = /^[a-z0-9_]{1,64}$/;
function sanitizeInviteErrorCode(code: string | undefined, fallback: string): string {
  return code !== undefined && ERROR_CODE_SHAPE.test(code) ? code : fallback;
}

type AdminDb = ReturnType<typeof createAdminClient>;

async function auditProvisioning(
  supabase: AdminDb,
  adminUserId: string,
  action: string,
  details: Record<string, unknown>,
) {
  // F2-07: the insert result IS inspected. Audit failure never rolls back an
  // already-completed provider action — the provisioning states remain the
  // source of truth — but it is reported loudly server-side.
  try {
    const { error } = await supabase.from("admin_audit_logs").insert({
      admin_user_id: adminUserId,
      action,
      details,
    });
    if (error) {
      console.error("[gyeon-provisioning] AUDIT WRITE FAILED:", action, error.code ?? "unknown");
    }
  } catch (err) {
    console.error("[gyeon-provisioning] AUDIT WRITE THREW:", action, err instanceof Error ? err.name : "unknown");
  }
}

// F2-05: a state settlement counts ONLY when the database proved it — no
// error AND exactly the targeted row affected. Everything else is unsettled.
async function settleInvitationState(
  supabase: AdminDb,
  id: string,
  patch: Record<string, unknown>,
): Promise<boolean> {
  try {
    const { data, error } = await supabase
      .from("gyeon_dealer_provisioning")
      .update({ ...patch, updated_at: new Date().toISOString() })
      .eq("id", id)
      .select("id");
    return !error && Array.isArray(data) && data.length === 1;
  } catch {
    return false;
  }
}

// F2-05: reconciliation settlements additionally stay winner-gated on the
// 'pending' state — a row that moved on is never silently overwritten.
async function settleReconciliation(
  supabase: AdminDb,
  id: string,
  patch: Record<string, unknown>,
): Promise<boolean> {
  try {
    const { data, error } = await supabase
      .from("gyeon_dealer_provisioning")
      .update({ ...patch, updated_at: new Date().toISOString() })
      .eq("id", id)
      .eq("invitation_state", "pending")
      .select("id");
    return !error && Array.isArray(data) && data.length === 1;
  } catch {
    return false;
  }
}

// ── List ─────────────────────────────────────────────────────────────────────

export type ListGyeonProvisioningResult =
  | { kind: "disabled" }
  | { kind: "ok"; rows: GyeonProvisioningAdminRow[] }
  | { kind: "error" };

export async function listGyeonProvisioning(): Promise<ListGyeonProvisioningResult> {
  if (!isGyeonPartnerOnboardingEnabled()) return { kind: "disabled" };
  await requireSuperAdmin();

  try {
    const supabase = createAdminClient();
    const { data, error } = await supabase
      .from("gyeon_dealer_provisioning")
      .select("id, email_normalized, shop_name, detailer_rank, dealer_code, provisioning_status, invitation_state, invite_sent_at, claimed_at, revoked_at, created_at")
      .order("created_at", { ascending: false })
      .limit(LIST_LIMIT);
    if (error) return { kind: "error" };
    const rows = (data ?? [])
      .map(projectGyeonProvisioningRow)
      .filter((r): r is GyeonProvisioningAdminRow => r !== null);
    return { kind: "ok", rows };
  } catch {
    return { kind: "error" };
  }
}

// ── Single create ────────────────────────────────────────────────────────────

export type CreateGyeonProvisioningResult =
  | { kind: "disabled" }
  | { kind: "invalid-input"; reasonJa: string }
  | { kind: "conflict" }
  | { kind: "created"; row: GyeonProvisioningAdminRow }
  | { kind: "error" };

export async function createGyeonProvisioning(input: {
  email: string;
  shopName: string;
  detailerRank: string;
  dealerCode?: string;
}): Promise<CreateGyeonProvisioningResult> {
  if (!isGyeonPartnerOnboardingEnabled()) return { kind: "disabled" };
  const admin = await requireSuperAdmin();

  const emailRaw = (input?.email ?? "").trim();
  const shopName = (input?.shopName ?? "").trim();
  const rank = (input?.detailerRank ?? "").trim();
  const dealerCode = (input?.dealerCode ?? "").trim();

  if (!isValidGyeonProvisioningEmail(emailRaw)) {
    return { kind: "invalid-input", reasonJa: "メールアドレスの形式が正しくありません。" };
  }
  if (shopName === "") {
    return { kind: "invalid-input", reasonJa: "店舗名が未入力です。" };
  }
  if (!isGyeonProvisioningRank(rank)) {
    return { kind: "invalid-input", reasonJa: "ランクの指定が正しくありません。" };
  }

  try {
    const supabase = createAdminClient();
    const { data, error } = await supabase
      .from("gyeon_dealer_provisioning")
      .insert({
        email_normalized: normalizeGyeonProvisioningEmail(emailRaw),
        shop_name: shopName,
        detailer_rank: rank,
        dealer_code: dealerCode === "" ? null : dealerCode,
        created_by_admin_id: admin.id,
      })
      .select()
      .single();
    if (error) {
      if (error.code === "23505") return { kind: "conflict" };
      return { kind: "error" };
    }
    const row = projectGyeonProvisioningRow(data);
    if (!row) return { kind: "error" };

    await auditProvisioning(supabase, admin.id, "gyeon_provisioning_created", {
      provisioning_id: row.id,
      email: row.emailNormalized,
      detailer_rank: row.detailerRank,
    });
    return { kind: "created", row };
  } catch {
    return { kind: "error" };
  }
}

// ── Invitation send / resend ─────────────────────────────────────────────────
// send   : first delivery, allowed from invitation_state 'none'
// resend : explicit re-delivery, allowed from 'failed' (retry) or 'sent'
//          (lost email). 'pending' requires reconcile FIRST — after an
//          uncertain result nothing may re-send until the truth is known.

export type SendGyeonInviteResult =
  | { kind: "disabled" }
  | { kind: "not-found" }
  | { kind: "not-sendable"; state: string }
  | { kind: "reconcile-required" }
  | { kind: "sent" }
  | { kind: "awaiting-claim" }
  | { kind: "failed" }
  | { kind: "uncertain" }
  | { kind: "error" };

async function runInviteDelivery(
  id: string,
  allowedFrom: string[],
  auditAction: string,
): Promise<SendGyeonInviteResult> {
  if (!isGyeonPartnerOnboardingEnabled()) return { kind: "disabled" };
  const admin = await requireSuperAdmin();

  try {
    const supabase = createAdminClient();

    const { data: existing, error: readError } = await supabase
      .from("gyeon_dealer_provisioning")
      .select("id, email_normalized, provisioning_status, invitation_state")
      .eq("id", id)
      .maybeSingle();
    if (readError) return { kind: "error" };
    if (!existing) return { kind: "not-found" };
    if (existing.provisioning_status !== "registered") {
      return { kind: "not-sendable", state: existing.provisioning_status };
    }
    if (existing.invitation_state === "pending" && !allowedFrom.includes("pending")) {
      return { kind: "reconcile-required" };
    }
    if (!allowedFrom.includes(existing.invitation_state)) {
      return { kind: "not-sendable", state: existing.invitation_state };
    }

    // 1. Record-first: commit 'pending' BEFORE any Auth call. The state
    //    predicate makes this a winner gate against concurrent operators.
    const { data: pendingRow, error: pendingError } = await supabase
      .from("gyeon_dealer_provisioning")
      .update({ invitation_state: "pending", updated_at: new Date().toISOString() })
      .eq("id", id)
      .eq("provisioning_status", "registered")
      .in("invitation_state", allowedFrom)
      .select("id, email_normalized")
      .single();
    if (pendingError || !pendingRow) return { kind: "error" };

    // 2. The external call — the ONLY invitation API call site in this app.
    let inviteError: { name?: string; code?: string; status?: number; message?: string } | null = null;
    let invitedUserId: string | null = null;
    let threw = false;
    try {
      const { data: inviteData, error } = await supabase.auth.admin.inviteUserByEmail(
        pendingRow.email_normalized,
      );
      inviteError = error;
      invitedUserId = inviteData?.user?.id ?? null;
    } catch (err) {
      threw = true;
      inviteError = { name: err instanceof Error ? err.name : undefined, message: String(err) };
    }

    // 3. Settle. An uncertain result LEAVES 'pending' — never auto-resend.
    // F2-05: 'sent' (and every other settlement) is returned ONLY when the
    // local database provably persisted it — error-free AND exactly one row
    // affected. If the external invite may have succeeded but settlement
    // failed, the caller gets 'uncertain' and the durable state remains
    // 'pending', recoverable via reconcile.
    if (!inviteError && !threw) {
      const settled = await settleInvitationState(supabase, id, {
        invitation_state: "sent",
        invite_sent_at: new Date().toISOString(),
        invited_auth_user_id: invitedUserId,
        invite_last_error: null,
      });
      if (!settled) return { kind: "uncertain" };
      await auditProvisioning(supabase, admin.id, auditAction, {
        provisioning_id: id, result: "sent",
      });
      return { kind: "sent" };
    }

    const errClass = threw
      ? "uncertain"
      : classifyGyeonInviteError({
          name: inviteError?.name,
          code: inviteError?.code,
          status: inviteError?.status,
        });

    if (errClass === "email-exists") {
      // The address already has an Auth user: no second user is ever created.
      // The claim converges at that user's next verified login.
      const settled = await settleInvitationState(supabase, id, {
        invitation_state: "awaiting_claim",
        invite_last_error: sanitizeInviteErrorCode(inviteError?.code, "email_exists"),
      });
      if (!settled) return { kind: "uncertain" };
      await auditProvisioning(supabase, admin.id, auditAction, {
        provisioning_id: id, result: "awaiting_claim",
      });
      return { kind: "awaiting-claim" };
    }

    if (errClass === "definite-failure") {
      const settled = await settleInvitationState(supabase, id, {
        invitation_state: "failed",
        invite_last_error: sanitizeInviteErrorCode(inviteError?.code, "invite_failed"),
      });
      if (!settled) return { kind: "uncertain" };
      await auditProvisioning(supabase, admin.id, auditAction, {
        provisioning_id: id, result: "failed",
      });
      return { kind: "failed" };
    }

    // Uncertain: keep 'pending'; record only a bounded classification (F2-07 —
    // never the raw provider message).
    await settleInvitationState(supabase, id, {
      invite_last_error: "uncertain_transport",
    });
    return { kind: "uncertain" };
  } catch {
    return { kind: "error" };
  }
}

export async function sendGyeonProvisioningInvite(id: string): Promise<SendGyeonInviteResult> {
  return runInviteDelivery(id, ["none"], "gyeon_provisioning_invite_sent");
}

export async function resendGyeonProvisioningInvite(id: string): Promise<SendGyeonInviteResult> {
  return runInviteDelivery(id, ["failed", "sent"], "gyeon_provisioning_invite_resent");
}

// ── Reconcile — settle an uncertain 'pending' WITHOUT sending anything ───────

export type ReconcileGyeonInviteResult =
  | { kind: "disabled" }
  | { kind: "not-found" }
  | { kind: "not-reconcilable"; state: string }
  | { kind: "settled-sent" }
  // F3-02: an Auth user EXISTS but carries no invited_at — the account
  // predates any invite, so the record becomes awaiting_claim (successful
  // reconciliation; the claim converges at that user's next verified login).
  | { kind: "settled-awaiting-claim" }
  | { kind: "settled-failed" }
  // F2-06: the Auth search hit the page cap without proving the final page —
  // nothing is settled and the row stays 'pending'.
  | { kind: "incomplete" }
  // F2-05: the truth was learned but the local settlement update failed or
  // matched no row — nothing is claimed settled; the row stays 'pending'.
  | { kind: "unsettled" }
  | { kind: "error" };

export async function reconcileGyeonProvisioningInvite(id: string): Promise<ReconcileGyeonInviteResult> {
  if (!isGyeonPartnerOnboardingEnabled()) return { kind: "disabled" };
  const admin = await requireSuperAdmin();

  try {
    const supabase = createAdminClient();
    const { data: row, error: readError } = await supabase
      .from("gyeon_dealer_provisioning")
      .select("id, email_normalized, invitation_state, invited_auth_user_id, invite_sent_at")
      .eq("id", id)
      .maybeSingle();
    if (readError) return { kind: "error" };
    if (!row) return { kind: "not-found" };
    if (row.invitation_state !== "pending") {
      return { kind: "not-reconcilable", state: row.invitation_state };
    }

    // Read-only truth check against Auth — never a send.
    // F2-06: 'failed' may be concluded ONLY from an authoritative COMPLETE
    // search (a definite user_not_found, or pagination that provably reached
    // the final page). A capped search settles nothing.
    // F3-02: BOTH the discovered user id AND its invited_at are retained —
    // existence alone is never delivery truth.
    let found: { id: string; invitedAt: string | null } | null = null;
    let searchComplete = false;
    if (row.invited_auth_user_id) {
      const { data, error } = await supabase.auth.admin.getUserById(row.invited_auth_user_id);
      if (error && error.code !== "user_not_found") return { kind: "error" };
      found = data?.user ? { id: data.user.id, invitedAt: data.user.invited_at ?? null } : null;
      searchComplete = true;
    } else {
      const target = row.email_normalized;
      for (let page = 1; page <= RECONCILE_MAX_PAGES; page += 1) {
        const { data, error } = await supabase.auth.admin.listUsers({
          page,
          perPage: RECONCILE_PAGE_SIZE,
        });
        if (error) return { kind: "error" };
        const users = data?.users ?? [];
        const hit = users.find(
          (u) => (u.email ?? "").trim().toLowerCase() === target,
        );
        if (hit) { found = { id: hit.id, invitedAt: hit.invited_at ?? null }; searchComplete = true; break; }
        if (users.length < RECONCILE_PAGE_SIZE) { searchComplete = true; break; }
      }
    }

    if (!found && !searchComplete) {
      // Page cap reached without proving the final page: stay 'pending'.
      return { kind: "incomplete" };
    }

    if (found) {
      // F3-02: settle to 'sent' ONLY when the Auth user was provably invited
      // (non-empty invited_at). F2-05: every settlement additionally demands
      // the winner-gated database proof.
      if (found.invitedAt !== null && found.invitedAt.trim() !== "") {
        const settled = await settleReconciliation(supabase, id, {
          invitation_state: "sent",
          invited_auth_user_id: found.id,
          invite_sent_at: row.invite_sent_at ?? found.invitedAt,
          invite_last_error: null,
        });
        if (!settled) return { kind: "unsettled" };
        await auditProvisioning(supabase, admin.id, "gyeon_provisioning_invite_reconciled", {
          provisioning_id: id, result: "sent",
        });
        return { kind: "settled-sent" };
      }

      // The Auth user exists but was never invited (a pre-existing account):
      // awaiting_claim, with the discovered id persisted and only the stable
      // email_exists classification stored.
      const settled = await settleReconciliation(supabase, id, {
        invitation_state: "awaiting_claim",
        invited_auth_user_id: found.id,
        invite_last_error: "email_exists",
      });
      if (!settled) return { kind: "unsettled" };
      await auditProvisioning(supabase, admin.id, "gyeon_provisioning_invite_reconciled", {
        provisioning_id: id, result: "awaiting_claim",
      });
      return { kind: "settled-awaiting-claim" };
    }

    // Authoritative complete search proved NO Auth user exists: the send
    // never happened.
    const settled = await settleReconciliation(supabase, id, {
      invitation_state: "failed",
      invite_last_error: "reconcile_no_auth_user",
    });
    if (!settled) return { kind: "unsettled" };
    await auditProvisioning(supabase, admin.id, "gyeon_provisioning_invite_reconciled", {
      provisioning_id: id, result: "failed",
    });
    return { kind: "settled-failed" };
  } catch {
    return { kind: "error" };
  }
}

// ── Revoke ───────────────────────────────────────────────────────────────────

export type RevokeGyeonProvisioningResult =
  | { kind: "disabled" }
  | { kind: "revoked" }
  | { kind: "not-revocable" }
  | { kind: "error" };

export async function revokeGyeonProvisioning(id: string): Promise<RevokeGyeonProvisioningResult> {
  if (!isGyeonPartnerOnboardingEnabled()) return { kind: "disabled" };
  const admin = await requireSuperAdmin();

  try {
    const supabase = createAdminClient();
    // Winner-gated: only a still-registered record can be revoked; a claimed
    // record never can (typed refusal), and a racing claim wins cleanly.
    const { data, error } = await supabase
      .from("gyeon_dealer_provisioning")
      .update({
        provisioning_status: "revoked",
        revoked_at: new Date().toISOString(),
        revoked_by_admin_id: admin.id,
        updated_at: new Date().toISOString(),
      })
      .eq("id", id)
      .eq("provisioning_status", "registered")
      .is("claimed_at", null)
      .select("id");
    if (error) return { kind: "error" };
    if (!data || data.length === 0) return { kind: "not-revocable" };

    await auditProvisioning(supabase, admin.id, "gyeon_provisioning_revoked", {
      provisioning_id: id,
    });
    return { kind: "revoked" };
  } catch {
    return { kind: "error" };
  }
}
