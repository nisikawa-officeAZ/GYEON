import { notFound }  from "next/navigation";
import MainLayout   from "@/components/layout/MainLayout";
import EditClient   from "./EditClient";
import { getMaintenanceReminder } from "@/lib/maintenance/get-maintenance-reminder";

interface Props {
  params: Promise<{ id: string }>;
}

export default async function EditMaintenancePage({ params }: Props) {
  const { id } = await params;
  const reminder = await getMaintenanceReminder(id);
  if (!reminder) notFound();

  return (
    <MainLayout>
      <div className="max-w-2xl mx-auto p-6">
        <EditClient reminder={reminder} />
      </div>
    </MainLayout>
  );
}
