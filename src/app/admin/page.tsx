import SystemHealthCard from "@/components/admin/SystemHealthCard";
import Link from "next/link";

export const dynamic = "force-dynamic";
export const metadata = { title: "Overview | Admin" };

export default function AdminPage() {
  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-semibold text-slate-100">Admin Overview</h1>
      </div>

      {/* Quick nav */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { href: "/admin/dealers", label: "Dealers",  icon: "⊙", desc: "プラン・契約管理" },
          { href: "/admin/users",   label: "Users",    icon: "⊡", desc: "ユーザー・PW管理" },
          { href: "/admin/audit",   label: "Audit Log", icon: "⊟", desc: "操作監査ログ" },
        ].map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className="bg-[#0f172a] border border-slate-800 rounded-xl p-4 hover:border-slate-600 transition-colors"
          >
            <div className="text-xl mb-1">{item.icon}</div>
            <p className="text-sm font-medium text-slate-200">{item.label}</p>
            <p className="text-[10px] text-slate-500 mt-0.5">{item.desc}</p>
          </Link>
        ))}
      </div>

      {/* System Health */}
      <div className="max-w-sm">
        <SystemHealthCard />
      </div>
    </div>
  );
}
