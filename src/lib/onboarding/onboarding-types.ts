// PHASE59: Onboarding types
// Pure types — no "use server" directive

export const ONBOARDING_TOTAL_STEPS = 7 as const;

export type OnboardingStepNumber = 1 | 2 | 3 | 4 | 5 | 6 | 7;

/** Pseudo-step value used when user skips the wizard */
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

export const ONBOARDING_STEPS: OnboardingStepMeta[] = [
  { number: 1, title: "ショップ情報",         label: "Dealer Info" },
  { number: 2, title: "スタッフ設定",         label: "Staff" },
  { number: 3, title: "サブスクリプション",   label: "Subscription" },
  { number: 4, title: "見積設定",             label: "Estimates" },
  { number: 5, title: "LINE連携",             label: "LINE" },
  { number: 6, title: "PDF・書類設定",        label: "PDF & Docs" },
  { number: 7, title: "完了",                 label: "Finish" },
];
