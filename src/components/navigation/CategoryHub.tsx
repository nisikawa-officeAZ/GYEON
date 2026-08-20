import Link from "next/link";

export interface CategoryHubItem {
  href: string;
  label: string;
  labelEn: string;
  description: string;
  icon: "invoice" | "payment" | "points" | "sales" | "monthly-statements";
}

interface CategoryHubProps {
  label: string;
  labelEn: string;
  items: readonly CategoryHubItem[];
}

function HubIcon({ icon }: { icon: CategoryHubItem["icon"] }) {
  const common = {
    width: 28,
    height: 28,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.7,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    "aria-hidden": true,
  };

  if (icon === "invoice") {
    return <svg {...common}><rect x="6" y="3" width="12" height="18" rx="2"/><path d="M9 8h6M9 12h6M9 16h3"/></svg>;
  }
  if (icon === "payment") {
    return <svg {...common}><rect x="3" y="5" width="18" height="14" rx="2"/><path d="M3 10h18M7 15h4"/></svg>;
  }
  if (icon === "sales") {
    return <svg {...common}><path d="M4 20V4"/><path d="M4 20h16"/><path d="M8 16v-5M12 16V8M16 16v-3M20 16V6"/></svg>;
  }
  if (icon === "monthly-statements") {
    return <svg {...common}><rect x="6" y="3" width="12" height="18" rx="2"/><path d="M9 8h6M9 12h6M9 16h3"/><circle cx="15" cy="16.5" r="2.4"/></svg>;
  }
  return <svg {...common}><circle cx="12" cy="12" r="9"/><path d="M9.5 17V7h3.2a3.1 3.1 0 0 1 0 6.2H9.5M9.5 10.2h3.2"/></svg>;
}

export default function CategoryHub({ label, labelEn, items }: CategoryHubProps) {
  return (
    <section className="mx-auto w-full max-w-[1280px]">
      <div className="mb-7 flex items-center gap-5">
        <div>
          <p className="text-[11px] font-bold tracking-[0.22em] text-[#7788a4]">{labelEn} / {label}メニュー</p>
        </div>
        <span className="h-px flex-1 bg-[#20304a]" />
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {items.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className="group min-h-[250px] rounded-[18px] border border-[#263955] bg-[#111826]/90 p-7 transition-all duration-200 hover:-translate-y-0.5 hover:border-[#3b6eb4] hover:bg-[#141e2f] hover:shadow-[0_18px_45px_rgba(0,0,0,.24)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#3478ff]"
          >
            <span className="grid h-[58px] w-[58px] place-items-center rounded-2xl border border-[#31568c] bg-[#122142] text-[#91b9ff] transition-colors group-hover:border-[#4a7fc8] group-hover:text-[#b6d0ff]">
              <HubIcon icon={item.icon} />
            </span>
            <h2 className="mt-7 text-[22px] font-bold text-[#edf3fc]">{item.label}</h2>
            <p className="mt-1 text-[11px] font-semibold tracking-[0.22em] text-[#8191ad]">{item.labelEn}</p>
            <p className="mt-5 text-[14px] leading-7 text-[#95a4bc]">{item.description}</p>
            <span className="mt-6 inline-flex items-center gap-2 text-[11px] font-semibold tracking-[0.12em] text-[#5f9cff] opacity-0 transition-opacity group-hover:opacity-100">
              開く <span aria-hidden="true">→</span>
            </span>
          </Link>
        ))}
      </div>
    </section>
  );
}
