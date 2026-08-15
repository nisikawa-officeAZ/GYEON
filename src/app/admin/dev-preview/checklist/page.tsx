import { getCurrentAdmin } from "@/lib/admin/get-current-admin";
import { redirect } from "next/navigation";
import { getAiVerificationSnapshot } from "@/lib/ai/dev-preview-checks";
import ChecklistClient from "./ChecklistClient";

export const dynamic = "force-dynamic";
export const metadata = { title: "Developer Preview チェックリスト | GYEON Admin" };

export default async function ChecklistPage() {
  const admin = await getCurrentAdmin();
  if (!admin) redirect("/login");
  if (admin.role !== "super_admin") redirect("/admin/dashboard");

  const snapshot = await getAiVerificationSnapshot();
  // Auto-derived signals used to seed a couple of items.
  const derived = {
    aiCenter: snapshot.keyExists && snapshot.connectionState === "success",
    ocr:      snapshot.ocrAvailable && snapshot.usageTableExists,
  };
  return <ChecklistClient derived={derived} />;
}
