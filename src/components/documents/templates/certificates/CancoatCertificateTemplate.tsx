// CancoatCertificateTemplate — the CanCoat certificate FRONT (concept-b certificate-cancoat-a4).
//   Masthead/Title/Intro → Vehicle card → Applied Coating → PROOF OF INSTALLATION callout →
//   Purpose / Handling Notice → From GYEON · Recommendation → Privacy → [Signatures] → Footer
//
// This is the single unified CanCoat certificate: EVO and EVO PRO share one document and differ only
// in the product named in the Applied Coating table. The deprecated per-grade variants are not
// recreated. The certificate warrants nothing — the grey PROOF OF INSTALLATION callout says so
// explicitly, and the wording comes from the data rather than this component.

import { Fragment } from "react";
import { CertificateHeader } from "./CertificateHeader";
import { CertificateCustomerVehicle } from "./CertificateCustomerVehicle";
import { CertificateProductSection } from "./CertificateProductSection";
import { CertificateCalloutPanel, CertificateTermsSection } from "./CertificateTermsSection";
import { CertificateCareSection } from "./CertificateCareSection";
import { CertificateSignature } from "./CertificateSignature";
import { CertificateFooter } from "./CertificateFooter";
import type { BrandProfile } from "../../types";
import type { CertificateDocumentData } from "./certificate-data";
import type { CertificateScale } from "./certificate-scale";

export function CancoatCertificateTemplate({
  brand,
  data,
  accent,
  scale = 1,
}: {
  brand: BrandProfile;
  data: CertificateDocumentData;
  accent: string;
  scale?: CertificateScale;
}) {
  return (
    <Fragment>
      <CertificateHeader brand={brand} data={data} scale={scale} />
      <CertificateCustomerVehicle data={data} scale={scale} />
      <CertificateProductSection data={data} accent={accent} scale={scale} />
      {data.callout ? <CertificateCalloutPanel callout={data.callout} accent={accent} scale={scale} /> : null}
      <CertificateTermsSection left={data.terms.left} right={data.terms.right} accent={accent} scale={scale} />
      <CertificateCareSection care={data.care} privacyNotice={data.privacyNotice} accent={accent} scale={scale} />
      {data.signatures ? <CertificateSignature signatures={data.signatures} accent={accent} scale={scale} /> : null}
      <CertificateFooter brand={brand} technician={data.installation.technician} scale={scale} />
    </Fragment>
  );
}
