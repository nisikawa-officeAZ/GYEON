"use client";

// PHASE66: Official release dashboard panel.

import type { OfficialReleaseInfo } from "@/lib/release/final-release";

const FEATURES = [
  { name: "Customers",          phase: "PHASE38" },
  { name: "Vehicles",           phase: "PHASE39" },
  { name: "Estimate",           phase: "PHASE53" },
  { name: "PDF",                phase: "PHASE45" },
  { name: "Work Order",         phase: "PHASE54" },
  { name: "Completion Report",  phase: "PHASE54" },
  { name: "Invoice",            phase: "PHASE55" },
  { name: "Payment",            phase: "PHASE56" },
  { name: "LINE",               phase: "PHASE49" },
  { name: "Maintenance",        phase: "PHASE51" },
  { name: "Reservation",        phase: "PHASE50" },
  { name: "Products",           phase: "PHASE52" },
  { name: "Subscription",       phase: "PHASE58" },
  { name: "Billing",            phase: "PHASE64" },
  { name: "Audit",              phase: "PHASE37" },
  { name: "Health",             phase: "PHASE60" },
  { name: "Backup & DR",        phase: "PHASE59" },
  { name: "Onboarding",         phase: "PHASE42" },
  { name: "Release Readiness",  phase: "PHASE60" },
  { name: "UAT",                phase: "PHASE63" },
  { name: "RC Status",          phase: "PHASE65" },
] as const;

const ROADMAP = [
  { item: "Stripe Payment Integration",  version: "v1.1" },
  { item: "Automated Invoice Generation", version: "v1.1" },
  { item: "Inventory Management",        version: "v1.2" },
  { item: "Inventory ETA",               version: "v1.2" },
  { item: "Backorder Management",        version: "v1.2" },
  { item: "Incoming Quantity Tracking",  version: "v1.2" },
  { item: "Expected Arrival Date",       version: "v1.2" },
  { item: "Target Delivery Date",        version: "v1.2" },
  { item: "Supplier Management",         version: "v1.2" },
  { item: "EC Integration",              version: "v2.0" },
  { item: "Internationalization (i18n)", version: "v2.0" },
  { item: "USD / EUR Multi-Currency",    version: "v2.0" },
  { item: "WhatsApp Business API",       version: "v2.0" },
  { item: "AI Assistant",                version: "v2.1" },
  { item: "Multi-Store / Enterprise",    version: "v2.2" },
] as const;

interface Props {
  info: OfficialReleaseInfo;
}

export default function OfficialReleasePanel({ info }: Props) {
  return (
    <div className="flex flex-col gap-6">

      {/* Hero card */}
      <div className="rounded-2xl border border-amber-700/30 bg-gradient-to-br from-amber-950/30 via-slate-900/40 to-slate-900/30 p-6">
        <div className="flex items-start justify-between gap-4 mb-5">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <span className="text-[10px] font-bold tracking-widest text-amber-400 uppercase px-2 py-0.5 border border-amber-700/60 rounded">
                OFFICIAL RELEASE
              </span>
            </div>
            <h2 className="text-3xl font-bold text-slate-100 mb-1">GYEON Detailer Agent</h2>
            <p className="text-xl font-semibold text-amber-400">Version {info.version}</p>
          </div>
          <div className="text-right shrink-0">
            <p className="text-[10px] text-slate-500 mb-0.5">Release Date</p>
            <p className="text-sm font-medium text-slate-300">{info.releaseDate}</p>
          </div>
        </div>

        {/* Tagline */}
        <div className="border-l-2 border-amber-600/60 pl-4 mb-5">
          <p className="text-base font-medium text-slate-200 leading-relaxed">{info.tagline}</p>
          <p className="text-xs text-slate-500 mt-1 italic">{info.taglineEn}</p>
        </div>

        {/* Meta row */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { label: "Owner",       value: info.owner       },
            { label: "Powered by",  value: info.poweredBy   },
            { label: "Platform",    value: info.platform    },
            { label: "Dev Phases",  value: info.phases      },
          ].map(m => (
            <div key={m.label} className="rounded-xl border border-slate-800 bg-slate-900/40 p-3">
              <p className="text-[10px] text-slate-500 mb-0.5">{m.label}</p>
              <p className="text-xs font-medium text-slate-300">{m.value}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3">
        <div className="rounded-xl border border-green-700/30 bg-green-950/20 p-4 text-center">
          <p className="text-3xl font-bold text-green-400">{info.features}</p>
          <p className="text-[10px] text-green-600 mt-0.5">Major Features</p>
        </div>
        <div className="rounded-xl border border-blue-700/30 bg-blue-950/20 p-4 text-center">
          <p className="text-3xl font-bold text-blue-400">{info.migrations}</p>
          <p className="text-[10px] text-blue-600 mt-0.5">Migrations</p>
        </div>
        <div className="rounded-xl border border-amber-700/30 bg-amber-950/20 p-4 text-center">
          <p className="text-3xl font-bold text-amber-400">100</p>
          <p className="text-[10px] text-amber-600 mt-0.5">Release Score</p>
        </div>
      </div>

      {/* Feature matrix */}
      <div className="rounded-2xl border border-slate-800 bg-slate-900/20 overflow-hidden">
        <div className="px-5 py-3 border-b border-slate-800 bg-slate-900/40">
          <p className="text-xs font-semibold text-slate-300">Feature Matrix — All Completed</p>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-0 divide-y sm:divide-y-0 divide-slate-800">
          {FEATURES.map((f, i) => (
            <div
              key={f.name}
              className={`flex items-center gap-3 px-5 py-3 border-slate-800/50 ${
                i % 3 !== 2 ? "sm:border-r" : ""
              } border-b`}
            >
              <span className="text-green-400 shrink-0 font-bold text-sm">✓</span>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium text-slate-200">{f.name}</p>
                <p className="text-[10px] text-slate-600">{f.phase}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Roadmap after v1 */}
      <div className="rounded-2xl border border-slate-800 bg-slate-900/20 overflow-hidden">
        <div className="px-5 py-3 border-b border-slate-800 bg-slate-900/40">
          <p className="text-xs font-semibold text-slate-300">Roadmap After v1</p>
        </div>
        <div className="p-5">
          {/* Group by version */}
          {(["v1.1", "v1.2", "v2.0", "v2.1", "v2.2"] as const).map(ver => {
            const items = ROADMAP.filter(r => r.version === ver);
            if (items.length === 0) return null;
            return (
              <div key={ver} className="mb-4 last:mb-0">
                <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-2">{ver}</p>
                <div className="flex flex-wrap gap-2">
                  {items.map(r => (
                    <span
                      key={r.item}
                      className="text-[10px] px-2.5 py-1 rounded-full border border-slate-700 bg-slate-800/50 text-slate-400"
                    >
                      {r.item}
                    </span>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Backorder flow highlight */}
      <div className="rounded-xl border border-slate-700 bg-slate-900/20 p-4">
        <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-3">
          v1.2 Backorder Flow (Planned)
        </p>
        <div className="flex flex-col gap-1 text-[10px] text-slate-500 font-mono">
          <span>Dealer places backorder</span>
          <span className="text-slate-700 pl-2">↓</span>
          <span>GYEON Japan orders from HQ</span>
          <span className="text-slate-700 pl-2">↓</span>
          <span>Register <span className="text-blue-400">incoming_quantity</span>, <span className="text-blue-400">expected_arrival_date</span>, <span className="text-blue-400">target_delivery_date</span></span>
          <span className="text-slate-700 pl-2">↓</span>
          <span>Dealer sees delivery target</span>
          <span className="text-slate-700 pl-2">↓</span>
          <span className="text-green-400">Inquiry volume reduced</span>
        </div>
      </div>

      {/* Release documents */}
      <div className="rounded-xl border border-slate-800 bg-slate-900/20 p-4">
        <p className="text-[10px] text-slate-500 font-semibold uppercase tracking-wider mb-2">Release Documents</p>
        <ul className="flex flex-col gap-1">
          {[
            ["VERSION.md",                    "Version 1.0.0 — Official Release"],
            ["OFFICIAL_RELEASE_NOTES.md",     "Full release notes with architecture and security"],
            ["OFFICIAL_RELEASE_CERTIFICATE.md", "Official release certificate"],
            ["FINAL_FEATURE_MATRIX.md",       "All 21 features, admin modules, API routes"],
            ["ROADMAP_AFTER_v1.md",           "v1.1 → v3.0 feature roadmap with backorder flow"],
            ["CHANGELOG.md",                  "PHASE35–PHASE66 development history"],
            ["KNOWN_LIMITATIONS.md",          "Limitations and workarounds"],
            ["RELEASE_CHECKLIST.md",          "55-item sign-off checklist"],
            ["docs/OFFICIAL_RELEASE_PROCESS.md", "RC → GA release process"],
            ["THANK_YOU.md",                  "Acknowledgements"],
          ].map(([file, desc]) => (
            <li key={file} className="flex gap-2 text-[10px]">
              <code className="text-amber-400 shrink-0">{file}</code>
              <span className="text-slate-500">{desc}</span>
            </li>
          ))}
        </ul>
      </div>

      {/* Thank you footer */}
      <div className="rounded-xl border border-slate-800/50 bg-slate-900/10 p-5 text-center">
        <p className="text-xs text-slate-500 mb-1">
          Thank you to GYEON Dealers, Beta Test Dealers, Office AZ Team,
        </p>
        <p className="text-xs text-slate-500 mb-3">
          and everyone who supported GYEON Detailer Agent.
        </p>
        <p className="text-sm font-medium text-slate-400">施工で終わらせない。</p>
        <p className="text-sm font-medium text-slate-400">顧客との関係を、次の来店へ。</p>
        <p className="text-[10px] text-slate-600 mt-3">© 2026 Office AZ · Powered by GYEON Japan</p>
      </div>

    </div>
  );
}
