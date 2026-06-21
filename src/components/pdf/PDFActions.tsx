"use client";

export default function PDFActions() {
  return (
    <div className="flex flex-wrap gap-2">
      <button
        type="button"
        onClick={() => window.print()}
        className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors bg-[#1d4ed8] hover:bg-[#1e40af] text-white"
      >
        <span className="text-base leading-none">⊟</span>
        Print / Save PDF
      </button>
    </div>
  );
}
