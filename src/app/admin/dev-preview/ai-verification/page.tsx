import { getCurrentAdmin } from "@/lib/admin/get-current-admin";
import { redirect } from "next/navigation";
import { getAiVerificationSnapshot } from "@/lib/ai/dev-preview-checks";
import AiVerificationClient from "./AiVerificationClient";

export const dynamic = "force-dynamic";
export const metadata = { title: "AI検証 | GYEON Admin" };

export default async function AiVerificationPage() {
  const admin = await getCurrentAdmin();
  if (!admin) redirect("/login");
  if (admin.role !== "super_admin") redirect("/admin/dashboard");

  const snapshot = await getAiVerificationSnapshot();
  return <AiVerificationClient snapshot={snapshot} />;
}
