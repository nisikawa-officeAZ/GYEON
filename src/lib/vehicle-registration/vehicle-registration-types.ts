// PHASE67: Vehicle Registration AI OCR — Types

export type OcrStatus =
  | "pending"
  | "processing"
  | "completed"
  | "failed"
  | "confirmed"
  | "archived";

// Extracted fields from a Japanese vehicle registration certificate (車検証)
export type VehicleRegistrationOcrResult = {
  owner_name?:             string;  // 所有者氏名
  user_name?:              string;  // 使用者氏名
  owner_address?:          string;  // 所有者住所
  user_address?:           string;  // 使用者住所
  vehicle_name?:           string;  // 車名
  maker?:                  string;  // メーカー
  model?:                  string;  // 型式
  grade?:                  string;  // グレード
  model_code?:             string;  // 型式指定番号
  chassis_number?:         string;  // 車台番号
  license_plate_region?:   string;  // ナンバープレート地域（例: 品川）
  license_plate_class?:    string;  // 分類番号（3桁）
  license_plate_kana?:     string;  // かな文字
  license_plate_number?:   string;  // 指定番号（4桁）
  first_registration_date?: string; // 初年度登録年月 YYYY-MM
  inspection_expiry_date?:  string; // 車検有効期限 YYYY-MM-DD
  vehicle_type?:           string;  // 車両種別
  use_type?:               string;  // 用途
  private_or_business?:   string;  // 自家用/事業用
  body_shape?:             string;  // 車体の形状
  fuel_type?:              string;  // 燃料の種類
  displacement?:           string;  // 排気量（例: 1998cc）
  color?:                  string;  // 色
  notes?:                  string;  // 備考・その他
  confidence?:             number;  // 0-1 overall confidence
};

// DB row for vehicle_registration_files table
export interface VehicleRegistrationFile {
  id:              string;
  dealer_id:       string;
  customer_id:     string | null;
  vehicle_id:      string | null;
  estimate_id:     string | null;
  storage_bucket:  string;
  storage_path:    string;
  file_name:       string;
  file_size:       number | null;
  mime_type:       string | null;
  ocr_provider:    string | null;
  ocr_model:       string | null;
  ocr_status:      OcrStatus;
  ocr_result:      VehicleRegistrationOcrResult;
  ocr_confidence:  number | null;
  confirmed:       boolean;
  confirmed_by:    string | null;
  confirmed_at:    string | null;
  uploaded_by:     string | null;
  archived_at:     string | null;
  created_at:      string;
  updated_at:      string;
}

// Result returned after upload + OCR analysis
export type UploadResult =
  | {
      success: true;
      file:             VehicleRegistrationFile;
      ocrResult:        VehicleRegistrationOcrResult;
      sessionId?:       string;   // Set when migration 068 is applied
      sessionPersisted?: boolean; // true = session + file link saved to DB
    }
  | { success: false; error: string };

// Params for confirming an OCR result and applying selected fields
export interface ConfirmOcrResultParams {
  fileId:      string;
  customerId?: string;
  vehicleId?:  string;
  estimateId?: string;
  // Which extracted fields the user has chosen to apply
  fieldsToApply: Partial<VehicleRegistrationOcrResult>;
}

// Mapping from OCR field → customer/vehicle DB field (used by UI)
export const OCR_TO_CUSTOMER_MAP: Partial<Record<keyof VehicleRegistrationOcrResult, string>> = {
  user_name:      "last_name",
  owner_name:     "last_name",
  user_address:   "address",
  owner_address:  "address",
};

export const OCR_TO_VEHICLE_MAP: Partial<Record<keyof VehicleRegistrationOcrResult, string>> = {
  vehicle_name:            "model",
  maker:                   "maker",
  model_code:              "model_code",
  chassis_number:          "chassis_number",
  first_registration_date: "first_registration_date",
  inspection_expiry_date:  "inspection_expiry_date",
};

// Human-readable labels for each OCR field
export const OCR_FIELD_LABELS: Record<keyof VehicleRegistrationOcrResult, string> = {
  owner_name:             "所有者氏名",
  user_name:              "使用者氏名",
  owner_address:          "所有者住所",
  user_address:           "使用者住所",
  vehicle_name:           "車名",
  maker:                  "メーカー",
  model:                  "型式",
  grade:                  "グレード",
  model_code:             "型式指定番号",
  chassis_number:         "車台番号",
  license_plate_region:   "ナンバー地域",
  license_plate_class:    "分類番号",
  license_plate_kana:     "かな",
  license_plate_number:   "指定番号",
  first_registration_date: "初年度登録",
  inspection_expiry_date:  "車検有効期限",
  vehicle_type:           "車両種別",
  use_type:               "用途",
  private_or_business:    "自家用/事業用",
  body_shape:             "車体形状",
  fuel_type:              "燃料種類",
  displacement:           "排気量",
  color:                  "色",
  notes:                  "備考",
  confidence:             "信頼度",
};
