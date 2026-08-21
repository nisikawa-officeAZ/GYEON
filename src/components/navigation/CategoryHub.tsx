import Link from "next/link";

export interface CategoryHubItem {
  href: string;
  label: string;
  labelEn: string;
  description: string;
  icon:
    | "invoice" | "payment" | "points" | "sales" | "monthly-statements"
    | "customer" | "vehicle" | "customer-app"
    | "estimate" | "work-orders" | "completion" | "maintenance"
    | "reservation" | "calendar"
    | "product-orders" | "products" | "inventory"
    | "line" | "news"
    | "downloads" | "pdf" | "ocr";
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
  if (icon === "customer") {
    return <svg {...common}><circle cx="12" cy="8" r="3"/><path d="M5 20c1.3-3.5 3.7-5 7-5s5.7 1.5 7 5"/></svg>;
  }
  if (icon === "vehicle") {
    return <svg {...common}><path d="m5 16 1.5-6h11l1.5 6"/><path d="M3.5 16h17v3h-17zM7 19v2M17 19v2M7.5 13h9"/></svg>;
  }
  if (icon === "customer-app") {
    return <svg {...common}><rect x="7" y="2.5" width="10" height="19" rx="2"/><path d="M10 6h4M11 18h2"/></svg>;
  }
  if (icon === "estimate") {
    return <svg {...common}><path d="M6 3h9l3 3v15H6z"/><path d="M14 3v4h4M9 11h6M9 15h4"/></svg>;
  }
  if (icon === "work-orders") {
    return <svg {...common}><rect x="4" y="5" width="16" height="15" rx="2"/><path d="M8 3v4M16 3v4M4 10h16M8 14h3M8 17h6"/></svg>;
  }
  if (icon === "completion") {
    return <svg {...common}><path d="M6 3h12v18H6z"/><path d="m9 12 2 2 4-5M9 17h6"/></svg>;
  }
  if (icon === "maintenance") {
    return <svg {...common}><path d="m14.5 6.5 3-3a4 4 0 0 1-5 5L6 15l-3 3 3 3 3-3 6.5-6.5a4 4 0 0 1 5-5l-3 3"/><path d="M5 18h.01"/></svg>;
  }
  if (icon === "reservation") {
    return <svg {...common}><rect x="4" y="5" width="16" height="15" rx="2"/><path d="M4 9h16M8 3v4M16 3v4M9 14h6"/></svg>;
  }
  if (icon === "calendar") {
    return <svg {...common}><rect x="4" y="5" width="16" height="15" rx="2"/><path d="M4 9h16M8 3v4M16 3v4M8 13h2M12 13h2M8 17h2M12 17h2"/></svg>;
  }
  if (icon === "product-orders") {
    return <svg {...common}><circle cx="9" cy="19" r="1.3"/><circle cx="17" cy="19" r="1.3"/><path d="M3 4h2l2.2 11h10.5L20 8H6"/></svg>;
  }
  if (icon === "products") {
    return <svg {...common}><path d="m12 3 8 4.5v9L12 21l-8-4.5v-9z"/><path d="m4 7.5 8 4.5 8-4.5M12 12v9"/></svg>;
  }
  if (icon === "inventory") {
    return <svg {...common}><path d="M4 9h16v11H4zM6 4h12v5H6zM9 13h6"/></svg>;
  }
  if (icon === "line") {
    return <svg {...common}><path d="M20 12c0 4-3.6 7-8 7-1 0-2-.2-2.8-.5L5 20l1.1-3.2A6.3 6.3 0 0 1 4 12c0-4 3.6-7 8-7s8 3 8 7Z"/></svg>;
  }
  if (icon === "news") {
    return <svg {...common}><path d="M5 4h14v16H5z"/><path d="M8 8h4v4H8zM14 8h2M14 11h2M8 15h8"/></svg>;
  }
  if (icon === "downloads") {
    return <svg {...common}><path d="M12 3v11M8 10l4 4 4-4M5 18v3h14v-3"/></svg>;
  }
  if (icon === "pdf") {
    return <svg {...common}><path d="M6 3h9l3 3v15H6z"/><path d="M14 3v4h4M8.5 16v-5h2a1.5 1.5 0 0 1 0 3h-2M13 16v-5h1.5a2 2 0 0 1 0 4H13M17 16v-5h3"/></svg>;
  }
  if (icon === "ocr") {
    return <svg {...common}><path d="M8 4H4v4M16 4h4v4M8 20H4v-4M16 20h4v-4M7 10h10M7 14h10"/></svg>;
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
            className="group flex min-h-[64px] items-center gap-3 rounded-2xl border border-[#263955] bg-[#111826]/90 p-3 transition-all duration-200 hover:border-[#3b6eb4] hover:bg-[#141e2f] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#3478ff] md:min-h-0 md:flex-col md:items-stretch md:gap-0 md:rounded-[18px] md:p-5 lg:min-h-[250px] lg:p-7 lg:hover:-translate-y-0.5 lg:hover:shadow-[0_18px_45px_rgba(0,0,0,.24)]"
          >
            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-[#31568c] bg-[#122142] text-[#91b9ff] transition-colors group-hover:border-[#4a7fc8] group-hover:text-[#b6d0ff] md:h-[58px] md:w-[58px] md:rounded-2xl">
              <HubIcon icon={item.icon} />
            </span>
            <span className="min-w-0 flex-1 md:mt-4 lg:mt-7">
              <h2 className="truncate text-[14px] font-bold text-[#edf3fc] md:whitespace-normal md:text-[16px] lg:text-[22px]">{item.label}</h2>
              <p className="mt-0.5 truncate text-[9px] font-semibold tracking-[0.14em] text-[#8191ad] md:mt-1 md:whitespace-normal md:text-[10px] md:tracking-[0.22em] lg:text-[11px]">{item.labelEn}</p>
            </span>
            <p className="hidden md:mt-3 md:block md:line-clamp-2 md:text-[12.5px] md:leading-[1.6] md:text-[#95a4bc] lg:mt-5 lg:line-clamp-none lg:text-[14px] lg:leading-7">{item.description}</p>
            <span className="hidden lg:mt-6 lg:inline-flex lg:items-center lg:gap-2 lg:text-[11px] lg:font-semibold lg:tracking-[0.12em] lg:text-[#5f9cff] lg:opacity-0 lg:transition-opacity lg:group-hover:opacity-100">
              開く <span aria-hidden="true">→</span>
            </span>
          </Link>
        ))}
      </div>
    </section>
  );
}
