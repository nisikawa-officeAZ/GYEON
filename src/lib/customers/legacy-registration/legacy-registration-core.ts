import type { VehicleRegistrationOcrResult } from "@/lib/vehicle-registration/vehicle-registration-types";
import type {
  LegacyCustomerDraft,
  LegacyHistoryCategory,
  LegacyRegistrationDraft,
  LegacyVehicleDraft,
} from "./legacy-registration-types";

export const LEGACY_HISTORY_CATEGORIES: ReadonlyArray<{
  readonly value: LegacyHistoryCategory;
  readonly label: string;
}> = [
  { value: "coating", label: "コーティング施工" },
  { value: "maintenance", label: "メンテナンス" },
  { value: "car_wash", label: "洗車" },
  { value: "ppf", label: "PPF" },
  { value: "window_film", label: "ウィンドウフィルム" },
  { value: "room_cleaning", label: "ルームクリーニング" },
  { value: "other", label: "その他" },
] as const;

export const EMPTY_LEGACY_CUSTOMER: LegacyCustomerDraft = {
  lastName: "", firstName: "", lastNameKana: "", firstNameKana: "",
  phone: "", email: "", postalCode: "", prefecture: "", city: "",
  address1: "", address2: "", notes: "", isBusiness: false,
};

export const EMPTY_LEGACY_VEHICLE: LegacyVehicleDraft = {
  maker: "", model: "", grade: "", year: "", color: "", plateNumber: "",
  vin: "", bodySize: "", vehicleCode: "", firstRegistrationYearMonth: "",
  registrationDate: "", inspectionExpiryDate: "", displacement: "", fuelType: "", notes: "",
};

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const DATE = /^\d{4}-\d{2}-\d{2}$/;

function clean(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function validDate(value: string): boolean {
  if (!DATE.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(parsed.valueOf()) && parsed.toISOString().slice(0, 10) === value;
}

export function todayInJapan(now = new Date()): string {
  return new Intl.DateTimeFormat("sv-SE", {
    timeZone: "Asia/Tokyo", year: "numeric", month: "2-digit", day: "2-digit",
  }).format(now);
}

export function mapReviewedOcrToLegacyDraft(
  ocr: Partial<VehicleRegistrationOcrResult>,
): { customer: LegacyCustomerDraft; vehicle: LegacyVehicleDraft } {
  const customerName = clean(ocr.customer_candidate_name || ocr.user_name || ocr.owner_name);
  const customerKana = clean(ocr.user_name_kana || ocr.owner_name_kana);
  const customerAddress = clean(
    ocr.customer_candidate_address || ocr.user_address || ocr.owner_address,
  );
  const plate = [
    clean(ocr.license_plate_region), clean(ocr.license_plate_class),
    clean(ocr.license_plate_kana), clean(ocr.license_plate_number),
  ].filter(Boolean).join(" ");

  return {
    customer: {
      ...EMPTY_LEGACY_CUSTOMER,
      // A full name/address remains in one editable field. No unverified split is invented.
      lastName: customerName,
      lastNameKana: customerKana,
      address1: customerAddress,
      isBusiness: ocr.customer_type === "corporation",
    },
    vehicle: {
      ...EMPTY_LEGACY_VEHICLE,
      maker: clean(ocr.maker),
      model: clean(ocr.vehicle_name || ocr.model),
      grade: clean(ocr.grade),
      vehicleCode: clean(ocr.model_code),
      vin: clean(ocr.chassis_number),
      plateNumber: plate,
      firstRegistrationYearMonth: clean(ocr.first_registration_date),
      registrationDate: clean(ocr.registration_date),
      inspectionExpiryDate: clean(ocr.inspection_expiry_date),
      displacement: clean(ocr.displacement),
      fuelType: clean(ocr.fuel_type),
      year: clean(ocr.first_registration_date).slice(0, 4),
      // Body colour is deliberately never accepted from OCR.
      color: "",
    },
  };
}

export type LegacyValidationResult =
  | { readonly ok: true; readonly payload: Record<string, unknown> }
  | { readonly ok: false; readonly fieldErrors: Readonly<Record<string, string>> };

export function validateAndBuildLegacyPayload(
  input: unknown,
  today = todayInJapan(),
): LegacyValidationResult {
  const errors: Record<string, string> = {};
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    return { ok: false, fieldErrors: { form: "入力内容を確認してください。" } };
  }
  const draft = input as Partial<LegacyRegistrationDraft>;
  const idempotencyKey = clean(draft.idempotencyKey);
  if (!idempotencyKey || idempotencyKey.length > 200) errors.form = "保存キーが無効です。画面を再読み込みしてください。";

  let customer: Record<string, unknown> = {};
  if (draft.customer?.mode === "existing") {
    const customerId = clean(draft.customer.customerId);
    if (!UUID.test(customerId)) errors.customer = "登録済み顧客を選択してください。";
    customer = { mode: "existing", customerId };
  } else if (draft.customer?.mode === "new") {
    const c = draft.customer.data;
    const lastName = clean(c?.lastName);
    const firstName = clean(c?.firstName);
    const lastNameKana = clean(c?.lastNameKana);
    const firstNameKana = clean(c?.firstNameKana);
    if (!lastName) errors.lastName = c?.isBusiness ? "会社名は必須です。" : "姓は必須です。";
    if (!c?.isBusiness && !firstName) errors.firstName = "名は必須です。";
    if (!lastNameKana && !firstNameKana) errors.furigana = "フリガナは検索に使用するため必須です。";
    customer = {
      mode: "new", lastName, firstName, lastNameKana, firstNameKana,
      name: [lastName, firstName].filter(Boolean).join(" "),
      phone: clean(c?.phone), email: clean(c?.email), postalCode: clean(c?.postalCode),
      prefecture: clean(c?.prefecture), city: clean(c?.city), address1: clean(c?.address1),
      address2: clean(c?.address2), notes: clean(c?.notes), isBusiness: c?.isBusiness === true,
    };
  } else {
    errors.customer = "顧客の登録方法を選択してください。";
  }

  let vehicle: Record<string, unknown> = {};
  if (draft.vehicle?.mode === "existing") {
    if (draft.customer?.mode !== "existing") errors.vehicle = "既存車両は登録済み顧客と組み合わせてください。";
    const vehicleId = clean(draft.vehicle.vehicleId);
    if (!UUID.test(vehicleId)) errors.vehicle = "登録済み車両を選択してください。";
    vehicle = { mode: "existing", vehicleId };
  } else if (draft.vehicle?.mode === "new") {
    const v = draft.vehicle.data;
    if (!clean(v?.plateNumber)) errors.plateNumber = "ナンバープレートは必須です。";
    if (!clean(v?.maker)) errors.maker = "メーカーは必須です。";
    if (!clean(v?.model)) errors.model = "車名は必須です。";
    for (const [key, value] of [
      ["registrationDate", clean(v?.registrationDate)],
      ["inspectionExpiryDate", clean(v?.inspectionExpiryDate)],
    ] as const) {
      if (value && !validDate(value)) errors[key] = "日付の形式を確認してください。";
    }
    vehicle = {
      mode: "new", maker: clean(v?.maker), model: clean(v?.model), grade: clean(v?.grade),
      year: clean(v?.year), color: clean(v?.color), plateNumber: clean(v?.plateNumber),
      vin: clean(v?.vin), bodySize: clean(v?.bodySize), vehicleCode: clean(v?.vehicleCode),
      firstRegistrationYearMonth: clean(v?.firstRegistrationYearMonth),
      registrationDate: clean(v?.registrationDate), inspectionExpiryDate: clean(v?.inspectionExpiryDate),
      displacement: clean(v?.displacement), fuelType: clean(v?.fuelType), notes: clean(v?.notes),
    };
  } else {
    errors.vehicle = "車両の登録方法を選択してください。";
  }

  const rawHistory = Array.isArray(draft.history) ? draft.history : [];
  const history = rawHistory.map((row, index) => {
    const prefix = `history.${index}`;
    const category = clean(row?.category);
    const performedOn = clean(row?.performedOn);
    const serviceName = clean(row?.serviceName);
    const notes = clean(row?.notes);
    if (!LEGACY_HISTORY_CATEGORIES.some((item) => item.value === category)) errors[`${prefix}.category`] = "履歴種別を選択してください。";
    if (!validDate(performedOn) || performedOn > today) errors[`${prefix}.performedOn`] = "施工日は今日以前の日付を入力してください。";
    if (!serviceName || serviceName.length > 200) errors[`${prefix}.serviceName`] = "施工内容を1〜200文字で入力してください。";
    if (notes.length > 2000) errors[`${prefix}.notes`] = "備考は2000文字以内で入力してください。";
    return { category, performedOn, serviceName, notes };
  });

  if (Object.keys(errors).length > 0) return { ok: false, fieldErrors: errors };
  return { ok: true, payload: { idempotencyKey, customer, vehicle, history } };
}

