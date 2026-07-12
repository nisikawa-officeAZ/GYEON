// CertificateDocument — the issuable Certificate PDF (Layer 4 root).
//
// One entry point for all three certificates and all three output modes:
//   "front"       → page 1 only (the certificate itself)
//   "maintenance" → the メンテナンス履歴 ledger only (a reprint of the back page)
//   "duplex"      → page 1 = certificate front, page 2 = メンテナンス履歴   ← default issue format
//
// Duplex is the default because a certificate is printed double-sided: the customer keeps one sheet
// whose back is the ledger their shop writes on. The maintenance page therefore carries no identity
// of its own (see MaintenanceHistoryPage) — it is physically attached to the front.
//
// No persistence, no DB, no UI. This renders what an adapter hands it.

import { Document } from "@react-pdf/renderer";
import { DocumentPage, SerialFooter, type PagePadding } from "../../components";
import { COLOR } from "../../tokens";
import type { BrandProfile } from "../../types";
import { CoatingCertificateTemplate } from "./CoatingCertificateTemplate";
import { PpfCertificateTemplate } from "./PpfCertificateTemplate";
import { CancoatCertificateTemplate } from "./CancoatCertificateTemplate";
import { MaintenanceHistoryPage } from "./MaintenanceHistoryPage";
import {
  DEFAULT_CERTIFICATE_OUTPUT_MODE,
  type CertificateDocumentData,
  type CertificateOutputMode,
} from "./certificate-data";
import { CERTIFICATE_FRONT_SCALE } from "./certificate-scale";

/** concept-b's certificate sheet: `padding: 16mm 15mm 14mm`. */
const CERT_PAGE: PagePadding = { top: "16mm", horizontal: "15mm", bottom: "14mm" };

const FRONTS = {
  coating: CoatingCertificateTemplate,
  ppf: PpfCertificateTemplate,
  cancoat: CancoatCertificateTemplate,
} as const;

export function CertificateDocument({
  brand,
  data,
  mode = DEFAULT_CERTIFICATE_OUTPUT_MODE,
}: {
  brand: BrandProfile;
  data: CertificateDocumentData;
  mode?: CertificateOutputMode;
}) {
  const accent = brand.colors.primary || COLOR.textStrong;
  const Front = FRONTS[data.kind];
  // Coating and PPF carry more approved text than an A4 sheet holds at the authored size, so they
  // render at a uniform sub-1.0 density (certificate-scale.ts). CanCoat fits as authored → 1.0.
  const scale = CERTIFICATE_FRONT_SCALE[data.kind];
  const showFront = mode === "front" || mode === "duplex";
  const showMaintenance = mode === "maintenance" || mode === "duplex";

  return (
    <Document
      title={`${data.titleJa} ${data.serial}`}
      author={brand.brandNameJa || brand.brandNameEn || "DealerOS"}
    >
      {showFront ? (
        <DocumentPage padding={CERT_PAGE}>
          <Front brand={brand} data={data} accent={accent} scale={scale} />
          {/* concept-b `.serial` — programme line + certificate serial, with the page number. */}
          <SerialFooter serial={data.serial} label={`${data.footerProgramLine} · ${data.serial}`} />
        </DocumentPage>
      ) : null}

      {showMaintenance ? (
        <DocumentPage padding={CERT_PAGE}>
          <MaintenanceHistoryPage accent={accent} />
          <SerialFooter serial={data.serial} label={`${data.footerProgramLine} · ${data.serial}`} />
        </DocumentPage>
      ) : null}
    </Document>
  );
}
