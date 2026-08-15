// TEMPLATE-C2-DN — pure builder for the Chromium DELIVERY-NOTE template's injection context.
//
// Mirrors the accepted estimate/invoice context contract exactly: every value the native
// delivery-note HTML binds arrives as a PRE-FORMATTED display string computed here from the
// issued-invoice-sourced DeliveryNoteDocumentData; the page scripts never calculate. Issuer
// identity comes ONLY from the server-resolved BrandProfile. No network, no filesystem, no client
// input. The delivery note renders zero QR channels (valid). internal_memo has no path in.

import type { BrandProfile } from "@/components/documents/types";
import type { DeliveryNoteDocumentData } from "../delivery-note-document-data";
import { yen, formatDocDateDisplay, docNoDisplay, serialHashDisplay } from "./estimate-document-context";

const MINUS = "−"; // U+2212, matching the adopted design's negative amounts

export interface DeliveryNoteChromiumContext {
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
    issueDateDisplay?: string;
    deliveryDateDisplay: string;
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
    items: Array<{
      category?: string;
      name: string;
      description?: string;
      unitPriceDisplay: string;
      quantityDisplay: string;
      discountDisplay?: string;
      amountDisplay: string;
    }>;
    summary: {
      subtotalDisplay: string;
      discountDisplay?: string;
      taxLabelEn: string;
      taxDisplay: string;
      grandTotalDisplay: string;
    };
    notes: string[];
  };
}

const isDataUri = (v: string | undefined): v is string => typeof v === "string" && v.startsWith("data:");

export function buildDeliveryNoteChromiumContext(
  data: DeliveryNoteDocumentData,
  brand: BrandProfile,
  resolvedStoreLogoDataUri: string,
): DeliveryNoteChromiumContext {
  if (!isDataUri(resolvedStoreLogoDataUri)) {
    throw new Error("delivery-note-document-context: store logo must be an embedded data: URI");
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

    // Only channels whose QR image is already embedded may render; remote URLs are dropped so the
    // offline boundary holds. With no configured channels this is [] and the row renders empty.
    qrChannels: brand.qrLinks
      .filter((q) => isDataUri(q.qrImageUrl))
      .map((q) => ({ label: q.label, dataUri: q.qrImageUrl as string })),

    documentData: {
      issueDateDisplay: data.issueDate ? formatDocDateDisplay(data.issueDate) : undefined,
      deliveryDateDisplay: formatDocDateDisplay(data.deliveryDate),
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
        unitPriceDisplay: item.unitPrice != null ? yen(item.unitPrice) : "—",
        quantityDisplay: item.quantity != null ? String(item.quantity) : "—",
        discountDisplay: item.discount != null && item.discount > 0 ? `${MINUS}${yen(item.discount)}` : undefined,
        amountDisplay: item.amount != null ? yen(item.amount) : "—",
      })),
      summary: {
        subtotalDisplay: yen(data.summary.subtotal),
        discountDisplay: data.summary.discount > 0 ? `${MINUS}${yen(data.summary.discount)}` : undefined,
        taxLabelEn: `Tax ${data.summary.taxRatePercent}%`,
        taxDisplay: yen(data.summary.tax),
        grandTotalDisplay: yen(data.summary.grandTotal),
      },
      notes: data.notes,
    },
  };
}
