import MainLayout             from "@/components/layout/MainLayout";
import LinePageClient         from "./LinePageClient";
import { getLineMessageLogs, getLineMessageStats } from "@/lib/line/get-line-message-logs";
import { getLineNotificationQueue, getLineQueueStats } from "@/lib/line/get-line-notification-queue";
import { getLineStats }       from "@/lib/line/get-line-customers";
import FeatureGate            from "@/components/plans/FeatureGate";

export const metadata = { title: "LINE管理 | DealerOS" };

export default async function LinePage() {
  const [logs, failedLogs, queue, lineStats, msgStats, queueStats] = await Promise.all([
    getLineMessageLogs({ limit: 50 }),
    getLineMessageLogs({ status: "failed", limit: 30 }),
    getLineNotificationQueue({ status: ["scheduled", "processing", "sent", "failed"], orderByRecent: true, limit: 50 }),
    getLineStats(),
    getLineMessageStats(),
    getLineQueueStats(),
  ]);

  return (
    <MainLayout>
      <FeatureGate feature="line">
        <div className="max-w-7xl mx-auto p-6">
          <LinePageClient
            initialLogs={logs}
            initialFailedLogs={failedLogs}
            initialQueue={queue}
            lineStats={lineStats}
            msgStats={msgStats}
            queueStats={queueStats}
          />
        </div>
      </FeatureGate>
    </MainLayout>
  );
}
