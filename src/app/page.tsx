import { redirect }         from "next/navigation";
import Image                 from "next/image";
import Link                  from "next/link";
import MainLayout            from "@/components/layout/MainLayout";
import { getCurrentDealer }  from "@/lib/auth/get-current-dealer";
import { createClient }      from "@/lib/supabase/server";
import OnboardingCard        from "@/components/onboarding/OnboardingCard";

export const metadata = { title: "ホーム | GYEON Detailer Agent" };

export default async function HomePage() {

  // ── Onboarding redirect ──────────────────────────────────────────────────
  let shouldRedirectToOnboarding = false;
  try {
    const dealer = await getCurrentDealer();
    if (dealer) {
      const supabase = await createClient();
      const { data: settings, error } = await supabase
        .from("dealer_settings")
        .select("onboarding_completed, onboarding_step")
        .eq("dealer_id", dealer.dealer_id)
        .maybeSingle();
      if (!error) {
        const completed = settings?.onboarding_completed ?? false;
        const step      = settings?.onboarding_step      ?? 1;
        if (!settings || (!completed && step === 1)) shouldRedirectToOnboarding = true;
      }
    }
  } catch { /* column missing — skip */ }

  if (shouldRedirectToOnboarding) redirect("/onboarding");

  // ─────────────────────────────────────────────────────────────────────────

  return (
    <MainLayout>
      <div className="max-w-lg mx-auto flex flex-col pb-safe" style={{ position: "relative" }}>

        {/* Ambient glow — top center */}
        <div
          aria-hidden
          style={{
            position:     "absolute",
            top:          "-120px",
            left:         "50%",
            transform:    "translateX(-50%)",
            width:        "480px",
            height:       "480px",
            borderRadius: "50%",
            pointerEvents: "none",
            background:   "radial-gradient(ellipse, rgba(37,99,235,0.20) 0%, transparent 65%)",
            zIndex:       0,
          }}
        />

        {/* ══ GYEON® BRAND HEADER ════════════════════════════════════════════ */}
        <div className="relative z-10 text-center px-6 pt-6 pb-2">
          {/* GYEON® wordmark */}
          <div
            className="text-[32px] font-black text-white leading-none select-none"
            style={{
              letterSpacing: "8px",
              textShadow:    "0 0 30px rgba(37,99,235,0.40)",
            }}
          >
            GYEON
            <sup
              style={{
                fontSize:      "12px",
                color:         "#60a5fa",
                fontWeight:    400,
                verticalAlign: "super",
                letterSpacing: "0px",
              }}
            >
              ®
            </sup>
          </div>

          {/* Sub-label */}
          <div
            className="mt-2 text-[10px] font-bold uppercase select-none"
            style={{ letterSpacing: "4px", color: "#60a5fa" }}
          >
            DETAILING ESTIMATE PRO
          </div>

          {/* Tagline */}
          <div
            className="mt-1.5 text-[11px] uppercase select-none"
            style={{ letterSpacing: "2.5px", color: "rgba(255,255,255,0.28)" }}
          >
            PROFESSIONAL CERAMIC COATING
          </div>
        </div>

        {/* ══ CAR HERO ════════════════════════════════════════════════════════ */}
        <div className="relative z-10 flex-shrink-0" style={{ height: "200px", marginTop: "8px" }}>
          {/* Floor glow */}
          <div
            aria-hidden
            style={{
              position:     "absolute",
              bottom:       "6px",
              left:         "50%",
              transform:    "translateX(-50%)",
              width:        "300px",
              height:       "26px",
              background:   "radial-gradient(ellipse, rgba(37,99,235,0.28) 0%, transparent 70%)",
              filter:       "blur(10px)",
              zIndex:       0,
              pointerEvents: "none",
            }}
          />
          <Image
            src="/car_hero_nobg.png"
            alt=""
            fill
            priority
            sizes="(max-width: 512px) 100vw, 512px"
            className="object-contain object-center"
            style={{
              mixBlendMode: "screen",
              filter:
                "drop-shadow(0 0 20px rgba(37,99,235,0.55))" +
                " drop-shadow(0 0 10px rgba(96,165,250,0.30))" +
                " brightness(1.10) saturate(1.12)",
              zIndex: 1,
            }}
          />
        </div>

        {/* ══ ONBOARDING (conditional) ════════════════════════════════════════ */}
        <div className="px-5 mt-3 relative z-10">
          <OnboardingCard />
        </div>

        {/* ══ PRIMARY CTA — 新規見積もり ══════════════════════════════════════ */}
        <div className="px-5 mt-3 relative z-10">
          <Link
            href="/estimates"
            className="flex items-center gap-3.5 rounded-[18px] active:scale-[0.98] transition-transform duration-100"
            style={{
              padding:        "15px 18px",
              background:     "linear-gradient(135deg, rgba(37,99,235,0.28), rgba(29,78,216,0.20))",
              border:         "1px solid rgba(59,130,246,0.50)",
              boxShadow:      "0 0 24px rgba(37,99,235,0.10), inset 0 1px 0 rgba(255,255,255,0.06)",
              backdropFilter: "blur(12px)",
            }}
          >
            {/* Icon */}
            <div
              className="flex items-center justify-center flex-shrink-0 text-xl"
              style={{
                width:        "42px",
                height:       "42px",
                borderRadius: "12px",
                background:   "linear-gradient(135deg, #2563eb, #1d4ed8)",
                boxShadow:    "0 0 14px rgba(37,99,235,0.40)",
              }}
            >
              📝
            </div>

            {/* Text */}
            <div className="flex-1 min-w-0">
              <div className="text-[14px] font-semibold leading-tight" style={{ color: "#f8fafc" }}>
                新規見積もり作成
              </div>
              <div
                className="text-[11px] mt-0.5 leading-tight"
                style={{ color: "rgba(255,255,255,0.55)" }}
              >
                New Estimate · Step by Step
              </div>
            </div>

            {/* Arrow */}
            <div
              className="text-[14px] flex-shrink-0"
              style={{ color: "rgba(255,255,255,0.30)" }}
            >
              ›
            </div>
          </Link>
        </div>

        {/* ══ SECONDARY GRID ════════════════════════════════════════════════ */}
        <div className="px-5 mt-2.5 grid grid-cols-2 gap-2.5 relative z-10">
          {[
            { icon: "📋", label: "見積もり一覧",  sub: "Estimate List",    href: "/estimates"    },
            { icon: "📋", label: "作業管理",       sub: "Work Management",  href: "/work-orders"  },
            { icon: "👥", label: "顧客管理",       sub: "Customers",        href: "/customers"    },
            { icon: "🚗", label: "車両管理",       sub: "Vehicles",         href: "/vehicles"     },
            { icon: "📅", label: "予約",           sub: "Reservations",     href: "/reservations" },
            { icon: "💬", label: "LINE",           sub: "Messaging",        href: "/line"         },
          ].map(item => (
            <Link
              key={item.href}
              href={item.href}
              className="flex items-center gap-3 rounded-[16px] active:scale-[0.97] transition-transform duration-100"
              style={{
                padding:        "13px 14px",
                background:     "rgba(255,255,255,0.04)",
                border:         "1px solid rgba(59,130,246,0.18)",
                backdropFilter: "blur(12px)",
              }}
            >
              <span className="text-[18px] leading-none flex-shrink-0">{item.icon}</span>
              <div className="min-w-0 flex-1">
                <div className="text-[12px] font-semibold leading-tight truncate" style={{ color: "#f8fafc" }}>
                  {item.label}
                </div>
                <div
                  className="text-[9px] mt-0.5 leading-tight truncate"
                  style={{ color: "rgba(255,255,255,0.35)" }}
                >
                  {item.sub}
                </div>
              </div>
            </Link>
          ))}
        </div>

        {/* ══ BOTTOM UTILITIES ════════════════════════════════════════════════ */}
        <div className="px-5 mt-2.5 mb-4 grid grid-cols-2 gap-2.5 relative z-10">
          {[
            { icon: "🛒", label: "商品注文", sub: "Orders",   href: "/product-orders" },
            { icon: "⚙️", label: "設定",     sub: "Settings", href: "/settings"       },
          ].map(item => (
            <Link
              key={item.href}
              href={item.href}
              className="flex items-center gap-3 rounded-[14px] active:scale-[0.97] transition-transform duration-100"
              style={{
                padding:        "12px 13px",
                background:     "rgba(255,255,255,0.03)",
                border:         "1px solid rgba(59,130,246,0.12)",
                backdropFilter: "blur(12px)",
              }}
            >
              <span className="text-[16px] leading-none flex-shrink-0">{item.icon}</span>
              <div className="min-w-0 flex-1">
                <div
                  className="text-[12px] font-semibold leading-tight truncate"
                  style={{ color: "rgba(255,255,255,0.65)" }}
                >
                  {item.label}
                </div>
                <div
                  className="text-[9px] mt-0.5 leading-tight"
                  style={{ color: "rgba(255,255,255,0.28)" }}
                >
                  {item.sub}
                </div>
              </div>
            </Link>
          ))}
        </div>

      </div>
    </MainLayout>
  );
}
