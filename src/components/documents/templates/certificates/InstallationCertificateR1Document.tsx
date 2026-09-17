import { Document, View } from "@react-pdf/renderer";
import React from "react";

import { DocumentPage, SerialFooter, type PagePadding } from "@/components/documents/components";
import type { BrandProfile, GyeonRank } from "@/components/documents/types";
import type { InstallationCertificateR1Presentation } from "@/lib/certificates/installation-certificate-r1-artifact-core";
import { gyeonRankLogo, gyeonWordmark } from "@/lib/pdf/brand-assets";
import { CertificateCustomerVehicle } from "./CertificateCustomerVehicle";
import { CertificateFooter } from "./CertificateFooter";
import { CertificateHeader } from "./CertificateHeader";
import { CertificateProductSection } from "./CertificateProductSection";
import { MaintenanceHistoryPage } from "./MaintenanceHistoryPage";
import { CERTIFICATE_FRONT_SCALE } from "./certificate-scale";
import type {
  AppliedProductRow,
  CertificateDocumentData,
  CertificateKind,
} from "./certificate-data";

export interface InstallationCertificateR1DocumentProps {
  readonly data: InstallationCertificateR1Presentation;
  readonly logoDataUri: string;
}

const PRIMARY = "#0a2145";
const PAGE: PagePadding = { top: "16mm", horizontal: "15mm", bottom: "14mm" };

type ServiceVisual = Pick<
  CertificateDocumentData,
  | "kind"
  | "titleJa"
  | "titleEn"
  | "programLabel"
  | "programSubLabel"
  | "intro"
  | "productLabelEn"
  | "productLabelJa"
  | "productColumns"
  | "footerProgramLine"
>;

const VISUALS: Record<CertificateKind, ServiceVisual> = {
  coating: {
    kind: "coating",
    titleJa: "GYEON コーティング施工証明書",
    titleEn: "Certificate of Installation / Coating",
    programLabel: "Coating · Certified Detailer",
    programSubLabel: "Japan Official Program",
    intro: "本書は、下記車両に記載の GYEON コーティング施工を実施した事実を証明するものです。",
    productLabelEn: "Applied Coating",
    productLabelJa: "施工コーティング内訳",
    productColumns: {
      tag: "Category",
      name: "Product · 施工内容",
      appliedTo: "Status · 実施状況",
    },
    footerProgramLine: "GYEON Coating Japan Certified Detailer",
  },
  ppf: {
    kind: "ppf",
    titleJa: "GYEON PPF 施工証明書",
    titleEn: "Certificate of Installation / Paint Protection Film",
    programLabel: "PPF · Installation Record",
    programSubLabel: "Japan Official Program",
    intro: "本書は、下記車両に記載の GYEON PPF 施工を実施した事実を証明するものです。",
    productLabelEn: "Applied Films",
    productLabelJa: "施工フィルム内訳",
    productColumns: {
      tag: "Category",
      name: "Applied To · 施工内容",
      appliedTo: "Film Product · 使用フィルム",
    },
    footerProgramLine: "GYEON PPF Japan Installation Record",
  },
  cancoat: {
    kind: "cancoat",
    titleJa: "GYEON コーティング施工証明書",
    titleEn: "Certificate of Installation / Coating (CanCoat)",
    programLabel: "CanCoat · Certified Detailer",
    programSubLabel: "Japan Official Program",
    intro: "本書は、下記車両に記載の GYEON CanCoat シリーズ施工を実施した事実を証明するものです。",
    productLabelEn: "Applied Coating",
    productLabelJa: "施工コーティング内訳",
    productColumns: {
      tag: "Category",
      name: "Product · 施工内容",
      appliedTo: "Status · 実施状況",
    },
    footerProgramLine: "GYEON CanCoat Japan Installation Record",
  },
};

function searchable(value: string | undefined): string {
  return (value ?? "").normalize("NFKC").toLowerCase();
}

function itemText(item: InstallationCertificateR1Presentation["items"][number]): string {
  return searchable([item.category, item.name, item.description].filter(Boolean).join(" "));
}

/**
 * The visual kind comes only from immutable performed-work rows. PPF wins over CanCoat when a
 * report contains both so the film-specific product columns remain visible.
 */
export function resolveInstallationCertificateR1Kind(
  items: InstallationCertificateR1Presentation["items"],
): CertificateKind {
  const values = items.map(itemText);
  if (values.some((value) =>
    value.includes("ppf") ||
    value.includes("paint protection film") ||
    value.includes("プロテクションフィルム")
  )) return "ppf";
  if (values.some((value) =>
    value.includes("cancoat") ||
    value.includes("can coat") ||
    value.includes("キャンコート")
  )) return "cancoat";
  return "coating";
}

function rankFromIssuer(value: string | undefined): GyeonRank {
  const normalized = searchable(value).replaceAll("_", "-").replaceAll(" ", "-");
  if (normalized.includes("ppf") && normalized.includes("installer")) return "ppf-installer";
  if (normalized.includes("certified") && normalized.includes("detailer")) return "certified-detailer";
  if (normalized === "detailer") return "detailer";
  if (normalized === "shop") return "shop";
  return "detailer";
}

function rankLabel(rank: GyeonRank): string {
  if (rank === "certified-detailer") return "Certified Detailer";
  if (rank === "ppf-installer") return "PPF Installer";
  if (rank === "shop") return "Shop";
  return "Detailer";
}

function serviceProgramLabel(kind: CertificateKind, rank: GyeonRank): string {
  if (kind === "ppf") {
    return rank === "ppf-installer" ? "PPF · Installer" : "PPF · Installation Record";
  }
  return `${kind === "cancoat" ? "CanCoat" : "Coating"} · ${rankLabel(rank)}`;
}

function serviceFooterLine(kind: CertificateKind, rank: GyeonRank): string {
  const service = kind === "ppf" ? "PPF" : kind === "cancoat" ? "CanCoat" : "Coating";
  return `GYEON ${service} Japan ${kind === "ppf" && rank !== "ppf-installer" ? "Installation Record" : rankLabel(rank)}`;
}

function toBrand(data: InstallationCertificateR1Presentation, logoDataUri: string): BrandProfile {
  const rank = rankFromIssuer(data.issuer.detailerRank);
  return {
    brandId: "installation-certificate-r1",
    brandNameJa: data.issuer.displayName,
    brandNameEn: data.issuer.companyName,
    logoUrl: logoDataUri,
    colors: { primary: PRIMARY, primaryDark: "#061532" },
    contact: {
      postalCode: data.issuer.postalCode,
      address: data.issuer.address,
      tel: data.issuer.tel,
      email: data.issuer.email,
    },
    business: {
      shopRank: rank,
      shopRankLabel: data.issuer.detailerRank,
      invoiceRegistrationNumber: data.issuer.invoiceRegistrationNumber,
      responsiblePerson: data.installation.technician,
    },
    footer: { partnerBrand: "GYEON JAPAN", showPartnerLogo: true },
    qrLinks: [],
    rank,
    rankLogoUrl: gyeonRankLogo(rank),
    gyeonWordmarkUrl: gyeonWordmark(),
    partnerProgram: "gyeon",
  };
}

function toProducts(
  kind: CertificateKind,
  items: InstallationCertificateR1Presentation["items"],
): AppliedProductRow[] {
  return items.map((item) => {
    const tag = item.category.toUpperCase();
    if (kind === "ppf") {
      return {
        tag,
        name: item.description ?? "—",
        appliedTo: item.name,
      };
    }
    return {
      tag,
      name: item.name,
      ...(item.description ? { description: item.description } : {}),
      appliedTo: "実施済み / Completed",
    };
  });
}

function toDocumentData(
  data: InstallationCertificateR1Presentation,
  kind: CertificateKind,
  rank: GyeonRank,
): CertificateDocumentData {
  const visual = VISUALS[kind];
  return {
    ...visual,
    programLabel: serviceProgramLabel(kind, rank),
    footerProgramLine: serviceFooterLine(kind, rank),
    serial: data.certificateNumber,
    issueDate: data.issueDate,
    customer: data.customer,
    vehicle: {
      name: data.vehicle.name,
      year: data.vehicle.year,
      color: data.vehicle.color,
      vin: data.vehicle.vin,
      plate: data.vehicle.plate,
    },
    installation: data.installation,
    products: toProducts(kind, data.items),
    terms: { left: [], right: [] },
    care: [],
    privacyNotice: "",
  };
}

function FrontPage({ data, logoDataUri }: InstallationCertificateR1DocumentProps) {
  const kind = resolveInstallationCertificateR1Kind(data.items);
  const brand = toBrand(data, logoDataUri);
  const documentData = toDocumentData(data, kind, brand.rank ?? "detailer");
  const scale = CERTIFICATE_FRONT_SCALE[kind];

  return (
    <DocumentPage padding={PAGE}>
      <CertificateHeader brand={brand} data={documentData} scale={scale} />
      <CertificateCustomerVehicle data={documentData} scale={scale} />
      <CertificateProductSection data={documentData} accent={PRIMARY} scale={scale} />
      <View style={{ flexGrow: 1 }} />
      <CertificateFooter brand={brand} technician={data.installation.technician} scale={scale} />
      <SerialFooter
        serial={data.certificateNumber}
        label={`${documentData.footerProgramLine} · ${data.certificateNumber}`}
      />
    </DocumentPage>
  );
}

export function InstallationCertificateR1Document({ data, logoDataUri }: InstallationCertificateR1DocumentProps) {
  const title = VISUALS[resolveInstallationCertificateR1Kind(data.items)].titleJa;
  return (
    <Document title={`${title} ${data.certificateNumber}`} author={data.issuer.displayName}>
      <FrontPage data={data} logoDataUri={logoDataUri} />
      <DocumentPage padding={PAGE}>
        <MaintenanceHistoryPage accent={PRIMARY} />
        <SerialFooter
          serial={data.certificateNumber}
          label={`GYEON DETAILER AGENT · ${data.certificateNumber}`}
        />
      </DocumentPage>
    </Document>
  );
}
