"use server";

import { getCurrentDealer } from "@/lib/auth/get-current-dealer";
import { createClient } from "@/lib/supabase/server";
import {
  INSTALLATION_CERTIFICATE_PAGE_SIZE,
  escapeCertificateLikePattern,
  normalizeCertificatePage,
  normalizeCertificateSearch,
  projectInstallationCertificateListItem,
  type InstallationCertificateListItem,
  type InstallationCertificateListRow,
} from "./installation-certificate-list-contract";

export interface InstallationCertificateFilters {
  readonly customer: string;
  readonly vehicle: string;
  readonly page: number;
}

export type GetInstallationCertificatesResult =
  | { readonly kind: "unauthenticated"; readonly filters: InstallationCertificateFilters }
  | { readonly kind: "unavailable"; readonly filters: InstallationCertificateFilters }
  | {
      readonly kind: "ok";
      readonly filters: InstallationCertificateFilters;
      readonly items: readonly InstallationCertificateListItem[];
      readonly total: number;
      readonly pageCount: number;
    };

export async function getInstallationCertificates(input: {
  customer?: unknown;
  vehicle?: unknown;
  page?: unknown;
}): Promise<GetInstallationCertificatesResult> {
  const filters: InstallationCertificateFilters = {
    customer: normalizeCertificateSearch(input.customer),
    vehicle: normalizeCertificateSearch(input.vehicle),
    page: normalizeCertificatePage(input.page),
  };

  const dealer = await getCurrentDealer();
  if (!dealer) return { kind: "unauthenticated", filters };

  try {
    const supabase = await createClient();
    let query = supabase
      .from("certificate_issuances")
      .select("id, certificate_number, issued_on, issued_at, snapshot", { count: "exact" })
      .eq("dealer_id", dealer.dealer_id)
      .in("document_class", [
        "installation-certificate-r1",
        "installation-certificate-coating-r2",
        "installation-certificate-ppf-r2",
        "installation-certificate-cancoat-r2",
      ]);

    if (filters.customer !== "") {
      query = query.ilike(
        "snapshot->customer->>name",
        `%${escapeCertificateLikePattern(filters.customer)}%`,
      );
    }
    if (filters.vehicle !== "") {
      query = query.ilike(
        "snapshot->vehicle->>name",
        `%${escapeCertificateLikePattern(filters.vehicle)}%`,
      );
    }

    const from = (filters.page - 1) * INSTALLATION_CERTIFICATE_PAGE_SIZE;
    const to = from + INSTALLATION_CERTIFICATE_PAGE_SIZE - 1;
    const { data, error, count } = await query
      .order("issued_at", { ascending: false })
      .range(from, to);
    if (error) return { kind: "unavailable", filters };

    const rows = (data ?? []) as unknown as InstallationCertificateListRow[];
    const issuanceIds = rows.map((row) => row.id);
    const documentIds = new Set<string>();
    if (issuanceIds.length > 0) {
      const { data: documents, error: documentError } = await supabase
        .from("certificate_documents")
        .select("issuance_id")
        .eq("dealer_id", dealer.dealer_id)
        .eq("revision", 1)
        .in("issuance_id", issuanceIds);
      if (documentError) return { kind: "unavailable", filters };
      for (const row of documents ?? []) documentIds.add(row.issuance_id as string);
    }

    const total = count ?? 0;
    return {
      kind: "ok",
      filters,
      items: rows.map((row) => projectInstallationCertificateListItem(row, documentIds.has(row.id))),
      total,
      pageCount: Math.max(1, Math.ceil(total / INSTALLATION_CERTIFICATE_PAGE_SIZE)),
    };
  } catch {
    return { kind: "unavailable", filters };
  }
}
