// PpfCertificateTemplate — the PPF certificate FRONT (concept-b certificate-ppf-a4).
//   Masthead/Title/Intro → Vehicle card → Applied Films → Film Warranty →
//   Coverage / Exclusions → Care · From GYEON → Privacy → [Signatures] → Footer
//
// The PPF front has no callout: its warranty is stated product-by-product in the Film Warranty
// panel, which also names the films that carry no warranty at all. Installed areas come from typed
// rows — the certificate never infers an area from a product label.

import { Fragment } from "react";
import { CertificateHeader } from "./CertificateHeader";
import { CertificateCustomerVehicle } from "./CertificateCustomerVehicle";
import { CertificateProductSection, FilmWarrantySection } from "./CertificateProductSection";
import { CertificateTermsSection } from "./CertificateTermsSection";
import { CertificateCareSection } from "./CertificateCareSection";
import { CertificateSignature } from "./CertificateSignature";
import { CertificateFooter } from "./CertificateFooter";
import type { BrandProfile } from "../../types";
import type { CertificateDocumentData } from "./certificate-data";
import type { CertificateScale } from "./certificate-scale";

export function PpfCertificateTemplate({
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
      {data.filmWarranty ? <FilmWarrantySection warranty={data.filmWarranty} accent={accent} scale={scale} /> : null}
      <CertificateTermsSection left={data.terms.left} right={data.terms.right} accent={accent} scale={scale} />
      <CertificateCareSection care={data.care} privacyNotice={data.privacyNotice} accent={accent} scale={scale} />
      {data.signatures ? <CertificateSignature signatures={data.signatures} accent={accent} scale={scale} /> : null}
      <CertificateFooter brand={brand} technician={data.installation.technician} scale={scale} />
    </Fragment>
  );
}
