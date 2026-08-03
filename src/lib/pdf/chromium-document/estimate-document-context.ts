// TEMPLATE-B2 — pure builder for the Chromium estimate template's injection context.
//
// Everything the accepted HTML template binds comes from here as PRE-FORMATTED display strings:
// the page scripts never compute, so document math stays exactly the persisted EstimateDB snapshot
// carried by EstimateDocumentData. Issuer identity comes ONLY from the server-resolved BrandProfile.
// Nothing in this module reads the network, the database, the filesystem, or client input.
//
// Security invariants (pinned by src/lib/pdf/__tests__/template-b2/):
//  - no dealer_id / logo URL / branding value is accepted from a caller-supplied client payload;
//    the two inputs are the server-side adapter output and the server-side brand profile.
//  - remote (http/https) logo or QR images are NEVER passed through: rendering is offline, so a
//    remote asset would either break the render or leak a fetch. Non-embeddable values are dropped
//    (logo falls back to the canonical GYEON DA UI asset supplied by the renderer).
//  - internal_memo cannot appear here: EstimateDocumentData has no field that carries it.

import type { BrandProfile } from "@/components/documents/types";
import type { EstimateDocumentData } from "@/components/documents/templates/estimate/estimate-data";

export interface EstimateChromiumDocumentData {
  issueDateDisplay: string;
  validUntilDisplay?: string;
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
}

export interface EstimateChromiumContext {
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
  documentData: EstimateChromiumDocumentData;
}

/** MINUS SIGN (U+2212) + yen, matching the accepted design's negative amounts. */
const MINUS = "−";

export function yen(amount: number): string {
  return `¥${Math.trunc(amount).toLocaleString("ja-JP")}`;
}

/**
 * Display form of a stored date. Accepts ISO timestamps and plain YYYY-MM-DD; renders the accepted
 * YYYY.MM.DD form in Asia/Tokyo. An unparseable value is returned trimmed rather than invented.
 */
export function formatDocDateDisplay(value: string): string {
  const trimmed = (value ?? "").trim();
  if (!trimmed) return "";
  const plain = /^(\d{4})-(\d{2})-(\d{2})$/.exec(trimmed);
  if (plain) return `${plain[1]}.${plain[2]}.${plain[3]}`;
  const t = Date.parse(trimmed);
  if (Number.isNaN(t)) return trimmed;
  const parts = new Intl.DateTimeFormat("ja-JP", {
    timeZone: "Asia/Tokyo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date(t));
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? "";
  return `${get("year")}.${get("month")}.${get("day")}`;
}

/** "EST/2026/00012" → "EST / 2026 / 00012" (title block) */
export function docNoDisplay(serial: string): string {
  return serial.split("/").join(" / ");
}

/** "EST/2026/00012" → "DOC · EST-2026-00012" — no fabricated check code. */
export function serialHashDisplay(serial: string): string {
  return `DOC · ${serial.split("/").join("-")}`;
}

const isDataUri = (v: string | undefined): v is string => typeof v === "string" && v.startsWith("data:");

/**
 * Build the full injection context.
 *
 * @param data  persisted-snapshot document data from toEstimateDocumentData (never recomputed)
 * @param brand server-resolved issuer profile (getBrandProfile) — never client input
 * @param resolvedStoreLogoDataUri the upper-left logo bytes already resolved by the renderer:
 *        the dealer's configured logo when embeddable, otherwise the canonical GYEON DA UI
 *        fallback asset. Always a data: URI so rendering stays offline.
 */
export function buildEstimateChromiumContext(
  data: EstimateDocumentData,
  brand: BrandProfile,
  resolvedStoreLogoDataUri: string,
): EstimateChromiumContext {
  if (!isDataUri(resolvedStoreLogoDataUri)) {
    throw new Error("estimate-document-context: store logo must be an embedded data: URI");
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
    // offline boundary holds. Missing channels are omitted entirely by doc-qr.js (no placeholders).
    qrChannels: brand.qrLinks
      .filter((q) => isDataUri(q.qrImageUrl))
      .map((q) => ({ label: q.label, dataUri: q.qrImageUrl as string })),

    documentData: {
      issueDateDisplay: formatDocDateDisplay(data.issueDate),
      validUntilDisplay: data.validUntil ? formatDocDateDisplay(data.validUntil) : undefined,
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
