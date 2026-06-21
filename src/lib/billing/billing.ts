"use server";

// PHASE64: Billing service — async server functions.
// Super Admin only for write operations. Dealers can read own billing.
// NO Stripe. NO auto-charge. Manual operation only.

import { createAdminClient } from "@/lib/supabase/admin";
import { getCurrentAdmin }   from "@/lib/admin/get-current-admin";
import { writeAuditLog }     from "@/lib/admin/write-audit-log";
import type {
  DealerBilling,
  BillingInvoice,
  DealerBillingWithInvoices,
  ContractStatus,
  InvoiceStatus,
} from "./billing-types";

// ─── Internal guard ───────────────────────────────────────────────────────────

async function requireAdmin() {
  const admin = await getCurrentAdmin();
  if (!admin) throw new Error("Super admin access required");
  return admin;
}

// ─── Dealer Billing ───────────────────────────────────────────────────────────

export async function getDealerBilling(dealerId: string): Promise<DealerBilling | null> {
  try {
    await requireAdmin();
    const supabase = createAdminClient();
    const { data, error } = await supabase
      .from("dealer_billing")
      .select("*")
      .eq("dealer_id", dealerId)
      .maybeSingle();
    if (error) return null;
    return data as DealerBilling | null;
  } catch {
    return null;
  }
}

export async function createDealerBilling(params: {
  dealerId:       string;
  planCode:       string;
  contractStatus: ContractStatus;
  startedAt:      string | null;
  expiresAt:      string | null;
  renewalDate:    string | null;
  notes:          string;
}): Promise<{ success: boolean; billingId?: string; error?: string }> {
  try {
    const admin   = await requireAdmin();
    const supabase = createAdminClient();

    const { data, error } = await supabase
      .from("dealer_billing")
      .insert({
        dealer_id:       params.dealerId,
        plan_code:       params.planCode,
        contract_status: params.contractStatus,
        started_at:      params.startedAt   || null,
        expires_at:      params.expiresAt   || null,
        renewal_date:    params.renewalDate || null,
        notes:           params.notes.trim() || null,
      })
      .select("id")
      .single();

    if (error || !data) return { success: false, error: error?.message ?? "Failed" };

    void writeAuditLog({
      adminUserId: admin.id,
      action:      "billing_created",
      details:     { billing_id: data.id, dealer_id: params.dealerId, plan_code: params.planCode },
    });

    return { success: true, billingId: data.id };
  } catch (e) {
    return { success: false, error: String(e) };
  }
}

export async function updateDealerBilling(
  billingId: string,
  updates: {
    planCode?:       string;
    contractStatus?: ContractStatus;
    startedAt?:      string | null;
    expiresAt?:      string | null;
    renewalDate?:    string | null;
    notes?:          string;
  }
): Promise<{ success: boolean; error?: string }> {
  try {
    await requireAdmin();
    const supabase = createAdminClient();

    const patch: Record<string, unknown> = {};
    if (updates.planCode       !== undefined) patch.plan_code       = updates.planCode;
    if (updates.contractStatus !== undefined) patch.contract_status = updates.contractStatus;
    if (updates.startedAt      !== undefined) patch.started_at      = updates.startedAt;
    if (updates.expiresAt      !== undefined) patch.expires_at      = updates.expiresAt;
    if (updates.renewalDate    !== undefined) patch.renewal_date    = updates.renewalDate;
    if (updates.notes          !== undefined) patch.notes           = updates.notes.trim() || null;

    const { error } = await supabase
      .from("dealer_billing")
      .update(patch)
      .eq("id", billingId);

    if (error) return { success: false, error: error.message };
    return { success: true };
  } catch (e) {
    return { success: false, error: String(e) };
  }
}

export async function suspendDealer(
  billingId: string,
  dealerId:  string
): Promise<{ success: boolean; error?: string }> {
  try {
    const admin   = await requireAdmin();
    const supabase = createAdminClient();

    const { error } = await supabase
      .from("dealer_billing")
      .update({ contract_status: "suspended" })
      .eq("id", billingId);

    if (error) return { success: false, error: error.message };

    void writeAuditLog({
      adminUserId: admin.id,
      action:      "subscription_suspended",
      details:     { billing_id: billingId, dealer_id: dealerId },
    });

    return { success: true };
  } catch (e) {
    return { success: false, error: String(e) };
  }
}

export async function cancelSubscription(
  billingId: string,
  dealerId:  string
): Promise<{ success: boolean; error?: string }> {
  try {
    const admin   = await requireAdmin();
    const supabase = createAdminClient();

    const { error } = await supabase
      .from("dealer_billing")
      .update({
        contract_status: "cancelled",
        cancelled_at:    new Date().toISOString(),
      })
      .eq("id", billingId);

    if (error) return { success: false, error: error.message };

    void writeAuditLog({
      adminUserId: admin.id,
      action:      "subscription_cancelled",
      details:     { billing_id: billingId, dealer_id: dealerId },
    });

    return { success: true };
  } catch (e) {
    return { success: false, error: String(e) };
  }
}

export async function renewSubscription(
  billingId: string,
  dealerId:  string,
  newExpiresAt: string,
  newRenewalDate: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const admin   = await requireAdmin();
    const supabase = createAdminClient();

    const { error } = await supabase
      .from("dealer_billing")
      .update({
        contract_status: "active",
        expires_at:      newExpiresAt,
        renewal_date:    newRenewalDate,
      })
      .eq("id", billingId);

    if (error) return { success: false, error: error.message };

    void writeAuditLog({
      adminUserId: admin.id,
      action:      "subscription_renewed",
      details:     { billing_id: billingId, dealer_id: dealerId, new_expires_at: newExpiresAt },
    });

    return { success: true };
  } catch (e) {
    return { success: false, error: String(e) };
  }
}

// ─── Invoices ─────────────────────────────────────────────────────────────────

export async function createBillingInvoice(params: {
  dealerId:      string;
  invoiceNumber: string;
  planCode:      string;
  amount:        number;
  dueAt:         string | null;
  notes:         string;
}): Promise<{ success: boolean; invoiceId?: string; error?: string }> {
  try {
    const admin   = await requireAdmin();
    const supabase = createAdminClient();

    const { data, error } = await supabase
      .from("billing_invoices")
      .insert({
        dealer_id:      params.dealerId,
        invoice_number: params.invoiceNumber.trim(),
        plan_code:      params.planCode,
        amount:         params.amount,
        currency:       "JPY",
        status:         "draft",
        due_at:         params.dueAt || null,
        notes:          params.notes.trim() || null,
      })
      .select("id")
      .single();

    if (error || !data) return { success: false, error: error?.message ?? "Failed" };

    void writeAuditLog({
      adminUserId: admin.id,
      action:      "invoice_issued",
      details:     { invoice_id: data.id, dealer_id: params.dealerId, invoice_number: params.invoiceNumber, amount: params.amount },
    });

    return { success: true, invoiceId: data.id };
  } catch (e) {
    return { success: false, error: String(e) };
  }
}

export async function markInvoiceIssued(
  invoiceId: string,
  issuedAt:  string
): Promise<{ success: boolean; error?: string }> {
  try {
    await requireAdmin();
    const supabase = createAdminClient();
    const { error } = await supabase
      .from("billing_invoices")
      .update({ status: "issued", issued_at: issuedAt })
      .eq("id", invoiceId);
    if (error) return { success: false, error: error.message };
    return { success: true };
  } catch (e) {
    return { success: false, error: String(e) };
  }
}

export async function markInvoicePaid(
  invoiceId: string,
  paidAt:    string,
  dealerId:  string
): Promise<{ success: boolean; error?: string }> {
  try {
    const admin   = await requireAdmin();
    const supabase = createAdminClient();

    const { error } = await supabase
      .from("billing_invoices")
      .update({ status: "paid", paid_at: paidAt })
      .eq("id", invoiceId);

    if (error) return { success: false, error: error.message };

    void writeAuditLog({
      adminUserId: admin.id,
      action:      "invoice_paid",
      details:     { invoice_id: invoiceId, dealer_id: dealerId, paid_at: paidAt },
    });

    return { success: true };
  } catch (e) {
    return { success: false, error: String(e) };
  }
}

export async function updateInvoiceStatus(
  invoiceId: string,
  status:    InvoiceStatus
): Promise<{ success: boolean; error?: string }> {
  try {
    await requireAdmin();
    const supabase = createAdminClient();
    const patch: Record<string, unknown> = { status };
    if (status === "issued") patch.issued_at = new Date().toISOString();
    if (status === "paid")   patch.paid_at   = new Date().toISOString();
    const { error } = await supabase
      .from("billing_invoices")
      .update(patch)
      .eq("id", invoiceId);
    if (error) return { success: false, error: error.message };
    return { success: true };
  } catch (e) {
    return { success: false, error: String(e) };
  }
}

// ─── Dashboard queries ────────────────────────────────────────────────────────

export async function getBillingDashboardData(): Promise<{
  billings:          DealerBillingWithInvoices[];
  upcomingRenewals:  DealerBillingWithInvoices[];
  expiredBillings:   DealerBillingWithInvoices[];
}> {
  try {
    await requireAdmin();
    const supabase = createAdminClient();

    const [dealersRes, billingsRes, invoicesRes] = await Promise.all([
      supabase.from("dealers").select("id, name").order("name"),
      supabase.from("dealer_billing").select("*").order("created_at"),
      supabase.from("billing_invoices").select("*").order("created_at", { ascending: false }),
    ]);

    const dealers  = (dealersRes.data  ?? []) as { id: string; name: string }[];
    const billings = (billingsRes.data ?? []) as DealerBilling[];
    const invoices = (invoicesRes.data ?? []) as BillingInvoice[];

    const dealerNameMap: Record<string, string> = {};
    for (const d of dealers) dealerNameMap[d.id] = d.name;

    const now       = new Date();
    const in30Days  = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

    const billingsWithInvoices: DealerBillingWithInvoices[] = billings.map(b => ({
      ...b,
      dealer_name: dealerNameMap[b.dealer_id] ?? "Unknown",
      invoices:    invoices.filter(i => i.dealer_id === b.dealer_id),
    }));

    const upcomingRenewals = billingsWithInvoices.filter(b => {
      if (!b.renewal_date) return false;
      const rd = new Date(b.renewal_date);
      return rd >= now && rd <= in30Days && b.contract_status === "active";
    });

    const expiredBillings = billingsWithInvoices.filter(b => {
      if (!b.expires_at) return false;
      return new Date(b.expires_at) < now && b.contract_status === "active";
    });

    return { billings: billingsWithInvoices, upcomingRenewals, expiredBillings };
  } catch {
    return { billings: [], upcomingRenewals: [], expiredBillings: [] };
  }
}

export async function getUpcomingRenewals(): Promise<DealerBilling[]> {
  try {
    await requireAdmin();
    const supabase = createAdminClient();
    const in30Days = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
    const { data, error } = await supabase
      .from("dealer_billing")
      .select("*")
      .eq("contract_status", "active")
      .lte("renewal_date", in30Days)
      .order("renewal_date");
    if (error) return [];
    return (data ?? []) as DealerBilling[];
  } catch {
    return [];
  }
}

export async function getExpiredSubscriptions(): Promise<DealerBilling[]> {
  try {
    await requireAdmin();
    const supabase = createAdminClient();
    const now = new Date().toISOString();
    const { data, error } = await supabase
      .from("dealer_billing")
      .select("*")
      .eq("contract_status", "active")
      .lt("expires_at", now)
      .order("expires_at");
    if (error) return [];
    return (data ?? []) as DealerBilling[];
  } catch {
    return [];
  }
}
