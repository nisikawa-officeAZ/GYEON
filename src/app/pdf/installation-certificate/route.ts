import { NextRequest } from "next/server";

import { buildContentDisposition } from "@/app/pdf/estimate/pdf-response-headers";
import {
  validateStoredInstallationCertificateR1Artifact,
  validateStoredInstallationCertificateR1Metadata,
  installationCertificateDocumentProfileForSnapshot,
  parseInstallationCertificateR1Snapshot,
  snapshotMatchesIssuance,
  type InstallationCertificateR1DocumentRow,
} from "@/lib/certificates/installation-certificate-r1-artifact-core";
import {
  INSTALLATION_CERTIFICATE_R1_DOCUMENT_BUCKET,
  isCanonicalUuid,
} from "@/lib/certificates/installation-certificate-r1-document-contract";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const DOCUMENT_SELECT =
  "id, dealer_id, issuance_id, revision, storage_bucket, storage_path, mime_type, byte_size, sha256, template_version";

function hasOnlyAcceptedQuery(req: NextRequest): boolean {
  const keys = [...new Set(req.nextUrl.searchParams.keys())];
  return keys.every((key) => key === "issuanceId" || key === "download") &&
    req.nextUrl.searchParams.getAll("issuanceId").length === 1 &&
    req.nextUrl.searchParams.getAll("download").length <= 1;
}

export async function GET(req: NextRequest) {
  if (!hasOnlyAcceptedQuery(req)) return new Response("Invalid request", { status: 400 });
  const issuanceId = req.nextUrl.searchParams.get("issuanceId") ?? "";
  const download = req.nextUrl.searchParams.get("download");
  if (!isCanonicalUuid(issuanceId) || (download !== null && download !== "1")) {
    return new Response("Invalid request", { status: 400 });
  }

  try {
    const supabase = await createClient();
    const { data: userData, error: userError } = await supabase.auth.getUser();
    if (userError || !userData.user) return new Response("Unauthorized", { status: 401 });

    // RLS establishes the same-dealer pair before service-role Storage access exists.
    const { data: issuance, error: issuanceError } = await supabase
      .from("certificate_issuances")
      .select("id, dealer_id, certificate_number, document_class, source_contract_version, snapshot, issued_on")
      .eq("id", issuanceId)
      .maybeSingle();
    if (issuanceError) return new Response("Unavailable", { status: 503 });
    if (!issuance) return new Response("Not found", { status: 404 });
    const parsed = parseInstallationCertificateR1Snapshot(issuance.snapshot);
    if (!parsed.ok || !snapshotMatchesIssuance(parsed.snapshot, issuance)) {
      return new Response("Document integrity failure", { status: 500 });
    }
    const profile = installationCertificateDocumentProfileForSnapshot(parsed.snapshot);

    const { data: documentRow, error: documentError } = await supabase
      .from("certificate_documents")
      .select(DOCUMENT_SELECT)
      .eq("dealer_id", issuance.dealer_id)
      .eq("issuance_id", issuanceId)
      .eq("revision", 1)
      .maybeSingle();
    if (documentError) return new Response("Unavailable", { status: 503 });
    if (!documentRow) return new Response("Not stored", { status: 409 });

    const row = documentRow as unknown as InstallationCertificateR1DocumentRow;
    if (!validateStoredInstallationCertificateR1Metadata(row, issuance.dealer_id, issuanceId, profile)) {
      return new Response("Document integrity failure", { status: 500 });
    }
    const admin = createAdminClient();
    const { data: stored, error: storageError } = await admin.storage
      .from(INSTALLATION_CERTIFICATE_R1_DOCUMENT_BUCKET)
      .download(row.storage_path);
    if (storageError || !stored) return new Response("Unavailable", { status: 503 });

    const bytes = Buffer.from(await stored.arrayBuffer());
    if (!validateStoredInstallationCertificateR1Artifact(
      row,
      bytes,
      issuance.dealer_id,
      issuanceId,
      profile,
    )) {
      return new Response("Document integrity failure", { status: 500 });
    }

    const disposition = download === "1" ? "attachment" : "inline";
    return new Response(new Uint8Array(bytes), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": buildContentDisposition(disposition, issuance.certificate_number),
        "Cache-Control": "private, no-store",
      },
    });
  } catch {
    return new Response("Unavailable", { status: 503 });
  }
}
