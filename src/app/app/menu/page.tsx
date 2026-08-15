import Link from "next/link";
import { demoCustomer } from "@/lib/customer-app/demo-data";

export const metadata = { title: "メニュー | Detailer Agent" };
const card = "rounded-2xl border border-white/[.08] bg-[#0f172a]";

const ITEMS = [
  { href: "/app/documents",     icon: "📄", label: "書類",          sub: "見積・請求・完了報告" },
  { href: "/app/notifications", icon: "🔔", label: "お知らせ",      sub: "店舗からの通知・GYEON News" },
  { href: "/app/profile",       icon: "👤", label: "プロフィール",  sub: "お客様情報・LINE・通知設定" },
];

export default function Menu() {
  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-lg font-bold text-slate-100">メニュー</h1>

      <div className={`${card} p-4 flex items-center gap-3`}>
        <span className="grid place-items-center w-11 h-11 rounded-full bg-blue-950/50 text-lg">👤</span>
        <div>
          <p className="text-sm font-semibold text-slate-100">{demoCustomer.name} 様</p>
          <p className="text-[10px] text-slate-500">会員登録: {demoCustomer.memberSince}</p>
        </div>
      </div>

      <div className="flex flex-col gap-2">
        {ITEMS.map((it) => (
          <Link key={it.href} href={it.href} className={`${card} p-4 flex items-center gap-3`}>
            <span className="text-xl shrink-0">{it.icon}</span>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-slate-100">{it.label}</p>
              <p className="text-[10px] text-slate-500">{it.sub}</p>
            </div>
            <span className="text-slate-600 text-xs">›</span>
          </Link>
        ))}
      </div>
    </div>
  );
}
