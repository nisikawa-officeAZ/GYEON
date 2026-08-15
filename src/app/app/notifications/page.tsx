import { demoNotifications, NOTIF_CATEGORY_LABEL, NOTIF_CATEGORY_ICON } from "@/lib/customer-app/demo-data";

export const metadata = { title: "お知らせ | Detailer Agent" };
const card = "rounded-2xl border border-white/[.08] bg-[#0f172a]";

export default function Notifications() {
  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-lg font-bold text-slate-100">お知らせ</h1>
      <div className="flex flex-col gap-2">
        {demoNotifications.map((n) => (
          <div key={n.id} className={`${card} p-4 flex items-start gap-3 ${n.unread ? "ring-1 ring-blue-700/30" : ""}`}>
            <span className="text-lg leading-none mt-0.5 shrink-0">{NOTIF_CATEGORY_ICON[n.category]}</span>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-slate-800 text-slate-400 border border-slate-700">{NOTIF_CATEGORY_LABEL[n.category]}</span>
                {n.unread && <span className="w-1.5 h-1.5 rounded-full bg-blue-400" />}
                <span className="ml-auto text-[9px] text-slate-600">{n.date}</span>
              </div>
              <p className="text-sm font-medium text-slate-100 mt-1">{n.title}</p>
              <p className="text-[11px] text-slate-500 mt-0.5 leading-relaxed">{n.body}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
