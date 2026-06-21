import { redirect }           from "next/navigation";
import { getOnboardingStatus } from "@/lib/onboarding/onboarding";
import { getStaffList }        from "@/lib/staff/get-staff-list";
import { getCurrentDealerSubscription } from "@/lib/subscription/subscription";
import OnboardingWizard        from "@/components/onboarding/OnboardingWizard";

export const dynamic = "force-dynamic";
export const metadata = { title: "初期セットアップ | GYEON Detailer Agent" };

export default async function OnboardingPage() {
  // If already completed, go to dashboard
  const status = await getOnboardingStatus();
  if (status?.onboarding_completed) {
    redirect("/");
  }

  // Fetch data for wizard steps in parallel
  const [staffList, sub] = await Promise.all([
    getStaffList(),
    getCurrentDealerSubscription(),
  ]);

  const defaultStatus = status ?? {
    onboarding_completed:    false,
    onboarding_completed_at: null,
    onboarding_step:         1,
    business_name:           null,
    business_phone:          null,
    business_email:          null,
    business_address:        null,
    business_website:        null,
    logo_url:                null,
    tax_rate:                10,
    terms_and_conditions:    null,
    line_enabled:            false,
    line_liff_id:            null,
    webhook_url:             null,
    stamp_url:               null,
    pdf_footer:              null,
    invoice_note:            null,
    completion_note:         null,
  };

  const subInfo = sub
    ? {
        plan_code:             sub.plan_code,
        status:                sub.status,
        trial_ends_at:         sub.trial_ends_at,
        current_period_ends_at: sub.current_period_ends_at,
      }
    : null;

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "";

  return (
    <OnboardingWizard
      initialStatus={defaultStatus}
      staffList={(staffList as Array<{
        id: string;
        name: string | null;
        email: string | null;
        role: string;
        status: string;
      }>)}
      subscription={subInfo}
      appUrl={appUrl}
    />
  );
}
