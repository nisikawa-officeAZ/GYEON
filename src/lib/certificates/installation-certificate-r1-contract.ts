import type { WorkReportNotReadyReason } from "@/lib/completion-reports/completion-report-types";

export type InstallationCertificateR1SpecificReason =
  | "missing-customer-name"
  | "missing-vehicle-name"
  | "missing-applied-date"
  | "missing-technician"
  | "invalid-snapshot-item";

export type InstallationCertificateR1NotReadyReason =
  | WorkReportNotReadyReason
  | InstallationCertificateR1SpecificReason;

export interface InstallationCertificateR1Source {
  readonly customer: {
    readonly lastName: string | null;
    readonly firstName: string | null;
    readonly isBusiness: boolean | null;
  };
  readonly vehicle: {
    readonly maker: string | null;
    readonly model: string | null;
    readonly year: string | null;
    readonly grade: string | null;
    readonly vin: string | null;
    readonly plate: string | null;
    readonly color: string | null;
  };
  readonly appliedAt: string | null;
  readonly technicianName: string | null;
  readonly items: readonly {
    readonly category: string;
    readonly itemName: string;
    readonly description: string | null;
    readonly sortOrder: number;
  }[];
}

export interface InstallationCertificateR1Projection {
  readonly documentClass: "installation-certificate-r1";
  readonly customer: {
    readonly name: string;
    readonly honorific: "様" | "御中";
  };
  readonly vehicle: {
    readonly name: string;
    readonly maker?: string;
    readonly model?: string;
    readonly year?: string;
    readonly grade?: string;
    readonly vin?: string;
    readonly plate?: string;
    readonly color?: string;
  };
  readonly installation: {
    readonly appliedDate: string;
    readonly technician: string;
  };
  readonly items: readonly {
    readonly category: string;
    readonly name: string;
    readonly description?: string;
  }[];
}

export type InstallationCertificateR1ProjectionResult =
  | { readonly ready: true; readonly projection: InstallationCertificateR1Projection }
  | { readonly ready: false; readonly reasons: readonly InstallationCertificateR1SpecificReason[] };

const trim = (value: string | null | undefined): string => value?.trim() ?? "";

const optional = (value: string | null): string | undefined => {
  const normalized = trim(value);
  return normalized === "" ? undefined : normalized;
};

function japanCalendarDate(value: string | null): string | null {
  const normalized = trim(value);
  if (normalized === "") return null;

  const instant = new Date(normalized);
  if (Number.isNaN(instant.getTime())) return null;

  return new Intl.DateTimeFormat("sv-SE", {
    timeZone: "Asia/Tokyo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(instant);
}

export function projectInstallationCertificateR1(
  source: InstallationCertificateR1Source,
): InstallationCertificateR1ProjectionResult {
  const lastName = trim(source.customer.lastName);
  const firstName = trim(source.customer.firstName);
  const customerName = [lastName, firstName].filter(Boolean).join(" ");

  const maker = optional(source.vehicle.maker);
  const model = optional(source.vehicle.model);
  const vehicleName = [maker, model].filter((value): value is string => Boolean(value)).join(" ");

  const appliedDate = japanCalendarDate(source.appliedAt);
  const technician = trim(source.technicianName);

  const normalizedItems = source.items.map((item, sourceIndex) => ({
    sourceIndex,
    sortOrder: item.sortOrder,
    category: trim(item.category),
    name: trim(item.itemName),
    description: optional(item.description),
  }));
  const invalidItem = normalizedItems.some(
    (item) => !Number.isSafeInteger(item.sortOrder) || item.category === "" || item.name === "",
  );

  const reasons: InstallationCertificateR1SpecificReason[] = [];
  if (customerName === "") reasons.push("missing-customer-name");
  if (vehicleName === "") reasons.push("missing-vehicle-name");
  if (appliedDate === null) reasons.push("missing-applied-date");
  if (technician === "") reasons.push("missing-technician");
  if (invalidItem) reasons.push("invalid-snapshot-item");

  if (reasons.length > 0) return { ready: false, reasons };

  const vehicle: InstallationCertificateR1Projection["vehicle"] = {
    name: vehicleName,
    ...(maker ? { maker } : {}),
    ...(model ? { model } : {}),
    ...(optional(source.vehicle.year) ? { year: optional(source.vehicle.year) } : {}),
    ...(optional(source.vehicle.grade) ? { grade: optional(source.vehicle.grade) } : {}),
    ...(optional(source.vehicle.vin) ? { vin: optional(source.vehicle.vin) } : {}),
    ...(optional(source.vehicle.plate) ? { plate: optional(source.vehicle.plate) } : {}),
    ...(optional(source.vehicle.color) ? { color: optional(source.vehicle.color) } : {}),
  };

  return {
    ready: true,
    projection: {
      documentClass: "installation-certificate-r1",
      customer: {
        name: customerName,
        honorific: source.customer.isBusiness === true ? "御中" : "様",
      },
      vehicle,
      installation: {
        appliedDate: appliedDate!,
        technician,
      },
      items: normalizedItems
        .sort((a, b) => a.sortOrder - b.sortOrder || a.sourceIndex - b.sourceIndex)
        .map(({ category, name, description }) => ({
          category,
          name,
          ...(description ? { description } : {}),
        })),
    },
  };
}
