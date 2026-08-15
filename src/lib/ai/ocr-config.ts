// Centralized Vehicle-OCR model + determinism configuration (AI config).
//
// The OCR model is defined HERE (not scattered) so the AI Center / AI config is
// the single source of truth. Default is the approved GPT-mini model.
// Determinism: temperature 0 + a fixed, versioned prompt + JSON-only response.

export const OCR_MODEL          = process.env.OCR_MODEL || "gpt-4.1-mini";
export const OCR_TEMPERATURE    = 0;               // deterministic
export const OCR_MAX_TOKENS     = 1200;
// Bump this string whenever the extraction prompt changes. Logged per OCR run.
export const OCR_PROMPT_VERSION = "vehicle-ocr-2026-07-04.1";

/** True when the configured model is a GPT-mini class model. */
export function isGptMiniModel(model: string = OCR_MODEL): boolean {
  return /mini/i.test(model);
}
