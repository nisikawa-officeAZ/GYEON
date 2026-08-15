// PHASE59: Onboarding types
// Pure types — no "use server" directive

export const ONBOARDING_TOTAL_STEPS = 3 as const;

export type OnboardingStepNumber = 1 | 2 | 3;

/** Pseudo-step value used when user skips the wizard (> total steps) */
export const ONBOARDING_SKIPPED_STEP = 8 as const;

export interface OnboardingStatus {
  // Progress
  onboarding_completed:    boolean;
  onboarding_completed_at: string | null;
  onboarding_step:         number;
  // Step 1 — Dealer info
  business_name:           string | null;
  business_phone:          string | null;
  business_email:          string | null;
  business_address:        string | null;
  business_website:        string | null;
  logo_url:                string | null;
  // Step 4 — Estimate settings
  tax_rate:                number;
  terms_and_conditions:    string | null;
  // Step 5 — LINE
  line_enabled:            boolean;
  line_liff_id:            string | null;
  webhook_url:             string | null;
  // Step 6 — PDF/Document settings
  stamp_url:               string | null;
  pdf_footer:              string | null;
  invoice_note:            string | null;
  completion_note:         string | null;
}

export interface OnboardingSaveParams {
  step:                 number;
  business_name?:       string | null;
  business_phone?:      string | null;
  business_email?:      string | null;
  business_address?:    string | null;
  business_website?:    string | null;
  logo_url?:            string | null;
  stamp_url?:           string | null;
  pdf_footer?:          string | null;
  invoice_note?:        string | null;
  completion_note?:     string | null;
  tax_rate?:            number | null;
  terms_and_conditions?: string | null;
}

export interface OnboardingStepMeta {
  number: OnboardingStepNumber;
  title:  string;
  label:  string;
}

// Onboarding is a fast start-up flow (~1 min), NOT a full settings wizard.
// Shop info / subscription / LINE / PDF are configured later from Settings.
export const ONBOARDING_STEPS: OnboardingStepMeta[] = [
  { number: 1, title: "管理者情報", label: "Admin / Owner" },
  { number: 2, title: "見積設定",   label: "Estimates" },
  { number: 3, title: "完了",       label: "Finish" },
];
