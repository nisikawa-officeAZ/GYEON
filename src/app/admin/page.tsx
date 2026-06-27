import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

// /admin → redirect to the main dashboard
export default function AdminPage() {
  redirect("/admin/dashboard");
}
