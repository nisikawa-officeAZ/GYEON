"use client";

const actions = [
  { label: "Preview",      icon: "⊡" },
  { label: "Download PDF", icon: "↓" },
  { label: "Print",        icon: "⊟" },
  { label: "Send",         icon: "→" },
];

export default function PDFActions() {
  return (
    <div className="flex flex-wrap gap-2">
      {actions.map((action) => (
        <button
          key={action.label}
          type="button"
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
            action.label === "Download PDF"
              ? "bg-[#1d4ed8] hover:bg-[#1e40af] text-white"
              : "bg-[#1e293b] hover:bg-slate-700 text-slate-300 border border-slate-700"
          }`}
        >
          <span className="text-base leading-none">{action.icon}</span>
          {action.label}
        </button>
      ))}
    </div>
  );
}
