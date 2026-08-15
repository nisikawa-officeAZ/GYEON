import MainLayout from "@/components/layout/MainLayout";

// C2C4 — loading skeleton for the Estimate Wizard settings page.
export default function Loading() {
  return (
    <MainLayout>
      <div className="max-w-3xl mx-auto p-4 sm:p-6 flex flex-col gap-6" aria-busy="true" aria-label="読み込み中">
        <div className="flex flex-col gap-2">
          <div className="h-5 w-40 bg-slate-800 rounded animate-pulse" />
          <div className="h-3 w-72 bg-slate-800/60 rounded animate-pulse" />
        </div>
        <div className="h-24 bg-slate-900/60 border border-slate-800 rounded-xl animate-pulse" />
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="h-32 bg-slate-900/60 border border-slate-800 rounded-xl animate-pulse" />
        ))}
        <span className="sr-only">読み込み中です…</span>
      </div>
    </MainLayout>
  );
}
