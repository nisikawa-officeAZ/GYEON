// R92B Phase 2 — the PUBLIC estimate-share file stream.
//
// No directive: an unauthenticated Route Handler at /s/e/<token>/file. It resolves
// the token exactly as the landing page does, streams the immutable snapshot bytes
// on success, and answers a bare 404 for every failure mode (revoked, expired,
// cross-tenant, deleted, unknown, missing object) so nothing distinguishes them.
// The disposition is built with the SAME pure header helpers the download route
// uses, so a percent/quote/CR-LF in the file name can never split a header.
//
// R92B-H1 headers: the PDF is served as an ATTACHMENT (a public link should save,
// not render inline in the browser), never cached (no-store), and Referrer-Policy
// is no-referrer so the tokenized URL never leaks to a third party via Referer.

import { NextRequest } from "next/server";
import { resolveEstimateShare, downloadSharedPdfBytes } from "@/lib/estimates/resolve-estimate-share";
import { buildContentDisposition } from "@/app/pdf/estimate/pdf-response-headers";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ token: string }> },
) {
  const { token } = await params;

  const resolved = await resolveEstimateShare(token);
  if (resolved.kind !== "available") return new Response("Not found", { status: 404 });

  const bytes = await downloadSharedPdfBytes(resolved.filePath);
  if (!bytes) return new Response("Not found", { status: 404 });

  return new Response(new Uint8Array(bytes), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": buildContentDisposition("attachment", resolved.fileName),
      "Cache-Control": "no-store",
      "Referrer-Policy": "no-referrer",
    },
  });
}
