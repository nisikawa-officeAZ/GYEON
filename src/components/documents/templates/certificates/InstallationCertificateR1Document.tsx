import React from "react";

import { resolveGyeonRank, gyeonRankLabel } from "@/components/documents/brand";
import { CertificateDocument } from "@/components/documents/templates/certificates/CertificateDocument";
import {
  approvedCancoatCertificateContent,
  approvedCoatingCertificateContent,
  approvedPpfCertificateContent,
} from "@/components/documents/templates/certificates/approved-certificate-content";
import type {
  AppliedProductRow,
  CertificateDocumentData,
  CertificateKind,
} from "@/components/documents/templates/certificates/certificate-data";
import type { BrandProfile, GyeonRank } from "@/components/documents/types";
import type { InstallationCertificateR1Presentation } from "@/lib/certificates/installation-certificate-r1-artifact-core";
import { gyeonRankLogo, gyeonWordmark } from "@/lib/pdf/brand-assets";

export interface InstallationCertificateR1DocumentProps {
  readonly data: InstallationCertificateR1Presentation;
  readonly logoDataUri?: string | null;
}

function normalized(value: string | undefined): string {
  return (value ?? "").normalize("NFKC").toLowerCase();
}

function includesAny(value: string, needles: readonly string[]): boolean {
  return needles.some((needle) => value.includes(needle));
}

export function resolveInstallationCertificateKind(
  items: InstallationCertificateR1Presentation["items"],
): CertificateKind {
  const joined = items.map((item) => `${normalized(item.category)} ${normalized(item.name)}`).join("\n");
  if (includesAny(joined, ["ppf", "paint protection", "protect+", "enhance phobic", "enhance philic"])) {
    return "ppf";
  }
  const hasBaseCoating = includesAny(joined, [
    "mohs", "duraflex", "pure", "syncro", "one evo", "prime", "base coating", "ベースコーティング",
  ]);
  if (!hasBaseCoating && includesAny(joined, ["cancoat", "can coat", "キャンコート"])) {
    return "cancoat";
  }
  return "coating";
}

function serialDisplay(serial: string): string {
  const tail = serial.split("/").at(-1) ?? serial;
  return `— ${tail.padStart(7, "0")}`;
}

function ppfTag(value: string): string {
  const text = normalized(value);
  if (text.includes("protect+")) return "Protect+";
  if (text.includes("enhance")) return "Enhance";
  if (text.includes("hybrid")) return "Hybrid";
  if (text.includes("matte")) return "Matte";
  if (text.includes("black")) return "Black";
  if (text.includes("tint")) return "Tint";
  if (text.includes("carbon")) return "Carbon";
  if (text.includes("color line")) return "Color Line";
  return "PPF";
}

function coatingTag(value: string, index: number): string {
  const text = normalized(value);
  if (text.includes("cancoat") || text.includes("top")) return "Top";
  return index === 0 ? "Base" : "Layer";
}

function productRows(
  kind: CertificateKind,
  items: InstallationCertificateR1Presentation["items"],
): AppliedProductRow[] {
  return items.map((item, index) => {
    if (kind === "ppf") {
      return {
        tag: ppfTag(`${item.category} ${item.name}`),
        name: item.description || "施工箇所記録なし",
        description: item.description ? undefined : "Installation area not recorded",
        appliedTo: item.name,
      };
    }
    if (kind === "cancoat") {
      return {
        tag: "CanCoat",
        name: item.name,
        description: item.description || "Semi-permanent ceramic layer",
        appliedTo: "全塗装面 / All body panels",
      };
    }
    return {
      tag: coatingTag(`${item.category} ${item.name}`, index),
      name: item.name,
      description: item.description,
      appliedTo: "全塗装面 / All body panels",
    };
  });
}

function certificateData(data: InstallationCertificateR1Presentation): CertificateDocumentData {
  const kind = data.certificateKind ?? resolveInstallationCertificateKind(data.items);
  const preset = kind === "ppf"
    ? approvedPpfCertificateContent
    : kind === "cancoat"
      ? approvedCancoatCertificateContent
      : approvedCoatingCertificateContent;
  // The visible number must always be the immutable canonical DB serial.
  // R1 remains CRT/IN; R2 is allocated as CRT/CO, CRT/PPF or CRT/CC.
  const serial = data.certificateNumber;
  const vehicleName = [data.vehicle.maker, data.vehicle.name]
    .filter(Boolean)
    .filter((value, index, values) => index === 0 || value !== values[index - 1])
    .join(" ");

  return {
    ...preset,
    kind,
    serial,
    serialDisplay: serialDisplay(serial),
    issueDate: data.issueDate,
    customer: data.customer,
    vehicle: {
      name: vehicleName || data.vehicle.name,
      year: data.vehicle.year,
      color: data.vehicle.color,
      vin: data.vehicle.vin,
      plate: data.vehicle.plate,
    },
    installation: data.installation,
    products: productRows(kind, data.items),
  };
}

function brandProfile(
  data: InstallationCertificateR1Presentation,
  kind: CertificateKind,
  logoDataUri?: string | null,
): BrandProfile {
  const configuredRank = resolveGyeonRank(data.issuer.detailerRank);
  const rank: GyeonRank = kind === "ppf" ? "ppf-installer" : configuredRank;
  return {
    brandId: "installation-certificate",
    brandNameJa: data.issuer.companyName || data.issuer.displayName,
    brandNameEn: data.issuer.displayName,
    logoUrl: logoDataUri || undefined,
    colors: { primary: "#0a2145", primaryDark: "#071832", primaryTint: "#edf2f8" },
    contact: {
      postalCode: data.issuer.postalCode,
      address: data.issuer.address,
      tel: data.issuer.tel,
      email: data.issuer.email,
    },
    business: {
      shopRank: rank,
      shopRankLabel: gyeonRankLabel(rank),
      invoiceRegistrationNumber: data.issuer.invoiceRegistrationNumber,
      responsiblePerson: data.installation.technician,
    },
    footer: { partnerBrand: "GYEON JAPAN", showPartnerLogo: true },
    qrLinks: [],
    rankLogoUrl: gyeonRankLogo(rank),
    gyeonWordmarkUrl: gyeonWordmark(),
    rank,
    partnerProgram: "gyeon",
  };
}

export function InstallationCertificateR1Document({
  data,
  logoDataUri,
}: InstallationCertificateR1DocumentProps) {
  const documentData = certificateData(data);
  return (
    <CertificateDocument
      brand={brandProfile(data, documentData.kind, logoDataUri)}
      data={documentData}
      mode="front"
    />
  );
}
