"use server";

import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";

import { requireStaffCapability } from "@/lib/auth/require-staff-capability";
import { BRANDING_BUCKET, brandingStoragePath } from "@/lib/branding/branding-types";
import { parseLegacyBrandingLogoUrl } from "@/lib/pdf/chromium-document/legacy-branding-logo";
import { renderInstallationCertificateR1DocumentPdf } from "@/lib/pdf/render-installation-certificate-r1-document";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import {
  INSTALLATION_CERTIFICATE_R1_DOCUMENT_BUCKET,
  INSTALLATION_CERTIFICATE_R1_DOCUMENT_MIME_TYPE,
  INSTALLATION_CERTIFICATE_R1_DOCUMENT_TEMPLATE_VERSION,
  buildInstallationCertificateR1DocumentPath,
  isCanonicalUuid,
  isFinalizeInstallationCertificateR1DocumentRpcRow,
  mapFinalizeInstallationCertificateR1DocumentRpcError,
} from "./installation-certificate-r1-document-contract";
import {
  isCanonicalInstallationCertificateR1Pdf,
  parseInstallationCertificateR1Snapshot,
  sha256InstallationCertificateR1Pdf,
  snapshotMatchesIssuance,
  validateStoredInstallationCertificateR1Artifact,
  validateStoredInstallationCertificateR1Metadata,
  type InstallationCertificateR1ArtifactFailure,
  type InstallationCertificateR1DocumentRow,
  type InstallationCertificateR1Snapshot,
} from "./installation-certificate-r1-artifact-core";

type Admin = ReturnType<typeof createAdminClient>;

export type EnsureInstallationCertificateR1DocumentResult =
  | { readonly kind: "ready"; readonly issuanceId: string; readonly documentId: string }
  | { readonly kind: InstallationCertificateR1ArtifactFailure };

const DOCUMENT_SELECT =
  "id, dealer_id, issuance_id, revision, storage_bucket, storage_path, mime_type, byte_size, sha256, template_version";
const MAX_LOGO_BYTES = 5 * 1024 * 1024;
const DEFAULT_LOGO_PATH = ["public", "brand", "obsidian", "logos", "combination.svg"] as const;

async function blobBytes(blob: Blob): Promise<Buffer> {
  return Buffer.from(await blob.arrayBuffer());
}

function imageDataUri(bytes: Buffer): string | null {
  if (bytes.byteLength < 8 || bytes.byteLength > MAX_LOGO_BYTES) return null;
  const isPng = bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
  const isJpeg = bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[bytes.length - 2] === 0xff && bytes[bytes.length - 1] === 0xd9;
  if (!isPng && !isJpeg) return null;
  return `data:${isPng ? "image/png" : "image/jpeg"};base64,${bytes.toString("base64")}`;
}

async function resolveLogoDataUri(
  admin: Admin,
  dealerId: string,
  snapshot: InstallationCertificateR1Snapshot,
): Promise<string | null> {
  if (snapshot.issuer.logoMode === "da-default") {
    try {
      const svg = await readFile(path.join(process.cwd(), ...DEFAULT_LOGO_PATH));
      return `data:image/svg+xml;base64,${svg.toString("base64")}`;
    } catch {
      return null;
    }
  }

  const { data: settings, error } = await admin
    .from("dealer_settings")
    .select("logo_path, logo_url")
    .eq("dealer_id", dealerId)
    .maybeSingle();
  if (error || !settings) return null;

  const canonicalPath = brandingStoragePath(dealerId, "logo");
  const configuredPath = typeof settings.logo_path === "string" ? settings.logo_path.trim() : "";
  const legacyPath = parseLegacyBrandingLogoUrl(
    typeof settings.logo_url === "string" ? settings.logo_url : null,
    dealerId,
    process.env.NEXT_PUBLIC_SUPABASE_URL,
  );
  const logoPath = configuredPath === canonicalPath ? canonicalPath : legacyPath;
  if (logoPath !== canonicalPath) return null;

  const { data: logo, error: downloadError } = await admin.storage.from(BRANDING_BUCKET).download(logoPath);
  if (downloadError || !logo) return null;
  return imageDataUri(await blobBytes(logo));
}

async function downloadAndVerify(
  admin: Admin,
  row: InstallationCertificateR1DocumentRow,
  dealerId: string,
  issuanceId: string,
): Promise<boolean> {
  if (!validateStoredInstallationCertificateR1Metadata(row, dealerId, issuanceId)) return false;
  const { data, error } = await admin.storage.from(INSTALLATION_CERTIFICATE_R1_DOCUMENT_BUCKET)
    .download(row.storage_path);
  if (error || !data) return false;
  const bytes = await blobBytes(data);
  return validateStoredInstallationCertificateR1Artifact(row, bytes, dealerId, issuanceId);
}

async function cleanupOwnObject(admin: Admin, storagePath: string): Promise<boolean> {
  const { error } = await admin.storage.from(INSTALLATION_CERTIFICATE_R1_DOCUMENT_BUCKET)
    .remove([storagePath]);
  return !error;
}

async function resolveWinnerOnce(
  supabase: Awaited<ReturnType<typeof createClient>>,
  admin: Admin,
  dealerId: string,
  issuanceId: string,
): Promise<EnsureInstallationCertificateR1DocumentResult> {
  const { data, error } = await supabase
    .from("certificate_documents")
    .select(DOCUMENT_SELECT)
    .eq("dealer_id", dealerId)
    .eq("issuance_id", issuanceId)
    .eq("revision", 1)
    .maybeSingle();
  if (error) return { kind: "persistence_error" };
  if (!data) return { kind: "artifact_conflict" };
  const row = data as unknown as InstallationCertificateR1DocumentRow;
  if (!(await downloadAndVerify(admin, row, dealerId, issuanceId))) {
    return { kind: "artifact_integrity_error" };
  }
  return { kind: "ready", issuanceId, documentId: row.id };
}

export async function ensureInstallationCertificateR1Document(
  issuanceId: string,
): Promise<EnsureInstallationCertificateR1DocumentResult> {
  if (typeof issuanceId !== "string" || !isCanonicalUuid(issuanceId)) {
    return { kind: "invalid_request" };
  }

  try {
    // Genuine request authority and edit capability are established before admin authority exists.
    const auth = await requireStaffCapability("edit");
    if ("error" in auth) return { kind: "permission_denied" };
    const supabase = await createClient();
    const { data: userData, error: userError } = await supabase.auth.getUser();
    const actorUserId = userData.user?.id;
    if (userError || !actorUserId || !isCanonicalUuid(actorUserId)) return { kind: "permission_denied" };

    const { data: issuance, error: issuanceError } = await supabase
      .from("certificate_issuances")
      .select("id, dealer_id, document_class, certificate_number, source_contract_version, snapshot, issued_on")
      .eq("id", issuanceId)
      .eq("dealer_id", auth.dealerId)
      .maybeSingle();
    if (issuanceError) return { kind: "persistence_error" };
    if (!issuance) return { kind: "not_found" };

    const { data: existing, error: existingError } = await supabase
      .from("certificate_documents")
      .select(DOCUMENT_SELECT)
      .eq("dealer_id", auth.dealerId)
      .eq("issuance_id", issuanceId)
      .eq("revision", 1)
      .maybeSingle();
    if (existingError) return { kind: "persistence_error" };

    const admin = createAdminClient();
    if (existing) {
      const row = existing as unknown as InstallationCertificateR1DocumentRow;
      if (!(await downloadAndVerify(admin, row, auth.dealerId, issuanceId))) {
        return { kind: "artifact_integrity_error" };
      }
      return { kind: "ready", issuanceId, documentId: row.id };
    }

    const parsed = parseInstallationCertificateR1Snapshot(issuance.snapshot);
    if (!parsed.ok || !snapshotMatchesIssuance(parsed.snapshot, issuance)) {
      return { kind: "snapshot_invalid" };
    }

    const logoDataUri = await resolveLogoDataUri(admin, auth.dealerId, parsed.snapshot);
    if (!logoDataUri) return { kind: "branding_error" };

    let pdfBytes: Buffer;
    try {
      pdfBytes = await renderInstallationCertificateR1DocumentPdf(parsed.snapshot, logoDataUri);
    } catch {
      return { kind: "render_error" };
    }
    if (!isCanonicalInstallationCertificateR1Pdf(pdfBytes)) return { kind: "render_error" };

    const documentId = randomUUID();
    const storagePath = buildInstallationCertificateR1DocumentPath(auth.dealerId, issuanceId, documentId);
    const sha256 = sha256InstallationCertificateR1Pdf(pdfBytes);
    const { error: uploadError } = await admin.storage
      .from(INSTALLATION_CERTIFICATE_R1_DOCUMENT_BUCKET)
      .upload(storagePath, pdfBytes, {
        contentType: INSTALLATION_CERTIFICATE_R1_DOCUMENT_MIME_TYPE,
        upsert: false,
      });
    if (uploadError) return { kind: "storage_error" };

    const { data: finalized, error: finalizeError } = await admin.rpc(
      "finalize_installation_certificate_r1_document_v1",
      {
        p_dealer_id: auth.dealerId,
        p_issuance_id: issuanceId,
        p_document_id: documentId,
        p_storage_bucket: INSTALLATION_CERTIFICATE_R1_DOCUMENT_BUCKET,
        p_storage_path: storagePath,
        p_mime_type: INSTALLATION_CERTIFICATE_R1_DOCUMENT_MIME_TYPE,
        p_byte_size: pdfBytes.byteLength,
        p_sha256: sha256,
        p_template_version: INSTALLATION_CERTIFICATE_R1_DOCUMENT_TEMPLATE_VERSION,
        p_actor_user_id: actorUserId,
      },
    );

    if (finalizeError) {
      const mapped = mapFinalizeInstallationCertificateR1DocumentRpcError(finalizeError.message);
      if (mapped.kind === "unavailable") {
        // A transport failure may arrive after the RPC committed. Reconcile once
        // and never delete bytes that may already be the canonical document.
        const recovered = await resolveWinnerOnce(
          supabase,
          admin,
          auth.dealerId,
          issuanceId,
        );
        return recovered.kind === "ready" ? recovered : { kind: "persistence_error" };
      }
      if (!(await cleanupOwnObject(admin, storagePath))) return { kind: "cleanup_failed" };
      if (mapped.kind === "artifact_conflict") {
        return resolveWinnerOnce(supabase, admin, auth.dealerId, issuanceId);
      }
      if (mapped.kind === "not_found") return { kind: "not_found" };
      if (mapped.kind === "permission_denied") return { kind: "permission_denied" };
      if (mapped.kind === "artifact_integrity_error") return { kind: "artifact_integrity_error" };
      if (mapped.kind === "artifact_missing") return { kind: "storage_error" };
      if (mapped.kind === "invalid_request") return { kind: "invalid_request" };
      return { kind: "persistence_error" };
    }

    const finalizedRow: unknown = Array.isArray(finalized) ? finalized[0] : finalized;
    if (!isFinalizeInstallationCertificateR1DocumentRpcRow(finalizedRow) ||
        finalizedRow.document_id !== documentId || finalizedRow.issuance_id !== issuanceId ||
        finalizedRow.storage_path !== storagePath || finalizedRow.byte_size !== pdfBytes.byteLength ||
        finalizedRow.sha256 !== sha256) {
      // The RPC committed or replayed before its result crossed the network. Never delete bytes here.
      return { kind: "persistence_error" };
    }

    return { kind: "ready", issuanceId, documentId };
  } catch {
    return { kind: "persistence_error" };
  }
}
