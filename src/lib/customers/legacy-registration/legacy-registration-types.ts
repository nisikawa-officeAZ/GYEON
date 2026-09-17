import type { VehicleRegistrationOcrResult } from "@/lib/vehicle-registration/vehicle-registration-types";
import type {
  WizardExistingCustomerReference,
  WizardExistingVehicleReference,
} from "@/components/estimates/wizard/contract/wizard-runtime-inputs";

export type LegacyHistoryCategory =
  | "coating"
  | "maintenance"
  | "car_wash"
  | "ppf"
  | "window_film"
  | "room_cleaning"
  | "other";

export interface LegacyCustomerDraft {
  readonly lastName: string;
  readonly firstName: string;
  readonly lastNameKana: string;
  readonly firstNameKana: string;
  readonly phone: string;
  readonly email: string;
  readonly postalCode: string;
  readonly prefecture: string;
  readonly city: string;
  readonly address1: string;
  readonly address2: string;
  readonly notes: string;
  readonly isBusiness: boolean;
}

export interface LegacyVehicleDraft {
  readonly maker: string;
  readonly model: string;
  readonly grade: string;
  readonly year: string;
  readonly color: string;
  readonly plateNumber: string;
  readonly vin: string;
  readonly bodySize: string;
  readonly vehicleCode: string;
  readonly firstRegistrationYearMonth: string;
  readonly registrationDate: string;
  readonly inspectionExpiryDate: string;
  readonly displacement: string;
  readonly fuelType: string;
  readonly notes: string;
}

export interface LegacyHistoryDraft {
  readonly clientId: string;
  readonly category: LegacyHistoryCategory;
  readonly performedOn: string;
  readonly serviceName: string;
  readonly notes: string;
}

export type LegacyCustomerSelection =
  | { readonly mode: "new"; readonly data: LegacyCustomerDraft }
  | { readonly mode: "existing"; readonly customerId: string };

export type LegacyVehicleSelection =
  | { readonly mode: "new"; readonly data: LegacyVehicleDraft }
  | { readonly mode: "existing"; readonly vehicleId: string };

export interface LegacyRegistrationDraft {
  readonly idempotencyKey: string;
  readonly customer: LegacyCustomerSelection;
  readonly vehicle: LegacyVehicleSelection;
  readonly history: readonly LegacyHistoryDraft[];
  readonly ocrSessionId?: string | null;
  readonly reviewedOcr?: VehicleRegistrationOcrResult | null;
}

export type LegacyRegistrationFailureCode =
  | "INVALID_INPUT"
  | "UNAUTHENTICATED"
  | "FORBIDDEN"
  | "CUSTOMER_NOT_FOUND"
  | "VEHICLE_NOT_FOUND"
  | "VEHICLE_CUSTOMER_MISMATCH"
  | "IDEMPOTENCY_CONFLICT"
  | "SAVE_FAILED";

export type LegacyRegistrationSaveResult =
  | {
      readonly ok: true;
      readonly customerId: string;
      readonly vehicleId: string;
      readonly receiptId: string | null;
      readonly idempotentReplay: boolean;
    }
  | {
      readonly ok: false;
      readonly code: LegacyRegistrationFailureCode;
      readonly message: string;
      readonly fieldErrors?: Readonly<Record<string, string>>;
    };

export type LegacyRegistrationVehicleResult =
  | { readonly ok: true; readonly vehicles: readonly WizardExistingVehicleReference[] }
  | { readonly ok: false; readonly code: "INVALID_INPUT" | "UNAUTHENTICATED" | "FORBIDDEN" | "SEARCH_FAILED" };

export interface LegacyDuplicateInput {
  readonly customer: LegacyCustomerDraft | null;
  readonly vehicle: LegacyVehicleDraft;
}

export type LegacyDuplicateResult =
  | {
      readonly ok: true;
      readonly customers: readonly WizardExistingCustomerReference[];
      readonly vehicles: readonly WizardExistingVehicleReference[];
    }
  | { readonly ok: false; readonly code: "UNAUTHENTICATED" | "FORBIDDEN" | "SEARCH_FAILED" };

export type LegacyCustomerSearchInvoker = (
  term: unknown,
) => Promise<
  | { readonly ok: true; readonly results: readonly WizardExistingCustomerReference[]; readonly truncated: boolean }
  | { readonly ok: false; readonly code: "UNAUTHENTICATED" | "DEALER_CONTEXT_REQUIRED" | "QUERY_TOO_SHORT" | "SEARCH_FAILED" }
>;

export type LegacyVehicleLoader = (customerId: unknown) => Promise<LegacyRegistrationVehicleResult>;
export type LegacyDuplicateInvoker = (input: unknown) => Promise<LegacyDuplicateResult>;
export type LegacyRegistrationSaveInvoker = (input: unknown) => Promise<LegacyRegistrationSaveResult>;
