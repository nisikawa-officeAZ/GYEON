// TEMPLATE-C2-WR — pure builder for the Chromium WORK-REPORT template's injection context.
//
// Everything the native work-report HTML binds arrives as a PRE-FORMATTED display string computed
// here from the STRUCTURALLY monetary-free WorkReportDocumentData. There is no summary, no grand
// total, and no per-item price/quantity: the completed-work rows carry category / name / description
// ONLY. Issuer identity comes ONLY from the server-resolved BrandProfile. No network, no filesystem,
// no client input. internal_memo has no path in.

import type { BrandProfile } from "@/components/documents/types";
import type { WorkReportDocumentData } from "../work-report-document-data";
import { formatDocDateDisplay, docNoDisplay, serialHashDisplay } from "./estimate-document-context";

export interface WorkReportChromiumContext {
  storeSettings: {
    brandId?: string;
    storeLogoSrc: string;
    companyName: string;
    postalCode?: string;
    address?: string;
    tel?: string;
    fax?: string;
    rank?: string;
    invoiceRegistrationNumber?: string;
  };
  qrChannels: Array<{ label: string; dataUri: string }>;
  documentData: {
    issueDateDisplay: string;
    workDateDisplay: string;
    docNoDisplay: string;
    serialHashDisplay: string;
    customer: {
      name: string;
      honorific: string;
      postalCode?: string;
      address?: string;
      tel?: string;
      email?: string;
    };
    vehicle: {
      name?: string;
      maker?: string;
      yearDisplay?: string;
      grade?: string;
      plate?: string;
      color?: string;
      mileage?: string;
    };
    items: Array<{ category?: string; name: string; description?: string }>;
    notes: string[];
  };
}

const isDataUri = (v: string | undefined): v is string => typeof v === "string" && v.startsWith("data:");

export function buildWorkReportChromiumContext(
  data: WorkReportDocumentData,
  brand: BrandProfile,
  resolvedStoreLogoDataUri: string,
): WorkReportChromiumContext {
  if (!isDataUri(resolvedStoreLogoDataUri)) {
    throw new Error("work-report-document-context: store logo must be an embedded data: URI");
  }

  return {
    storeSettings: {
      brandId: brand.brandId,
      storeLogoSrc: resolvedStoreLogoDataUri,
      companyName: brand.brandNameJa,
      postalCode: brand.contact.postalCode,
      address: brand.contact.address,
      tel: brand.contact.tel,
      fax: brand.contact.fax,
      rank: brand.business.shopRankLabel,
      invoiceRegistrationNumber: brand.business.invoiceRegistrationNumber,
    },

    qrChannels: brand.qrLinks
      .filter((q) => isDataUri(q.qrImageUrl))
      .map((q) => ({ label: q.label, dataUri: q.qrImageUrl as string })),

    documentData: {
      issueDateDisplay: formatDocDateDisplay(data.issueDate),
      workDateDisplay: formatDocDateDisplay(data.workDate),
      docNoDisplay: docNoDisplay(data.serial),
      serialHashDisplay: serialHashDisplay(data.serial),
      customer: {
        name: data.customer.name,
        honorific: data.customer.kind === "corporation" ? "御中" : "様",
        postalCode: data.customer.postalCode,
        address: data.customer.address,
        tel: data.customer.tel,
        email: data.customer.email,
      },
      vehicle: {
        name: data.vehicle.name,
        maker: data.vehicle.maker,
        yearDisplay: data.vehicle.year ? `${data.vehicle.year} 年` : undefined,
        grade: data.vehicle.grade,
        plate: data.vehicle.plate,
        color: data.vehicle.color,
        mileage: data.vehicle.mileage,
      },
      items: data.items.map((item) => ({
        category: item.category,
        name: item.name,
        description: item.description,
      })),
      notes: data.notes,
    },
  };
}
