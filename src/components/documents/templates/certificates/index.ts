// Certificates (Layer 4) — Coating / PPF / CanCoat fronts + the shared メンテナンス履歴 back page.
// `CertificateDocument` is the only entry point a caller needs; the pieces are exported for tests
// and for any future document that reuses them.

export { CertificateDocument } from "./CertificateDocument";

export { CoatingCertificateTemplate } from "./CoatingCertificateTemplate";
export { PpfCertificateTemplate } from "./PpfCertificateTemplate";
export { CancoatCertificateTemplate } from "./CancoatCertificateTemplate";
export { MaintenanceHistoryPage } from "./MaintenanceHistoryPage";

export { CertificateHeader, CertificateSectionLabel } from "./CertificateHeader";
export { CertificateCustomerVehicle } from "./CertificateCustomerVehicle";
export { CertificateProductSection, FilmWarrantySection } from "./CertificateProductSection";
export { CertificateCalloutPanel, CertificateTermsSection, TermsColumn } from "./CertificateTermsSection";
export { CertificateCareSection } from "./CertificateCareSection";
export { CertificateSignature } from "./CertificateSignature";
export { CertificateFooter } from "./CertificateFooter";

export {
  CERTIFICATE_DOCUMENT_TYPE,
  DEFAULT_CERTIFICATE_OUTPUT_MODE,
  MAINTENANCE_COLUMNS,
  MAINTENANCE_HISTORY_NOTE,
  MAINTENANCE_HISTORY_TITLE,
  MAINTENANCE_ROW_COUNT,
} from "./certificate-data";

export type {
  AppliedProductRow,
  CertificateBaseData,
  CertificateCallout,
  CertificateCustomer,
  CertificateDocumentData,
  CertificateInstallation,
  CertificateKind,
  CertificateOutputMode,
  CertificateSignatures,
  CertificateVehicle,
  FilmWarrantyItem,
  PpfCertificateExtras,
  TermsBlock,
} from "./certificate-data";
