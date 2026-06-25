// Sprint 7: OCR adapter interfaces — provider-agnostic abstraction layer
// The concrete implementation lives in src/lib/vehicle-registration/ocr.ts

import type { VehicleRegistrationOcrResult } from "@/lib/vehicle-registration/vehicle-registration-types";

export interface OcrAdapterInput {
  imageBase64: string;
  mimeType:    string;
}

export interface OcrAdapterOutput {
  result:   VehicleRegistrationOcrResult;
  provider: string;
  model:    string;
}

export interface OcrAdapter {
  analyze(input: OcrAdapterInput): Promise<OcrAdapterOutput | { error: string }>;
}

export interface ManualCorrectionInput {
  fieldKey:       string;
  originalValue:  string;
  correctedValue: string;
}

export interface OcrParserConfig {
  splitNameOnSpace: boolean;
  normalizeDate:    boolean;
  trimWhitespace:   boolean;
}

export const DEFAULT_OCR_PARSER_CONFIG: OcrParserConfig = {
  splitNameOnSpace: true,
  normalizeDate:    true,
  trimWhitespace:   true,
};
