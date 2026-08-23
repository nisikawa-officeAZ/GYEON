export default function EstimateWizardPanelLoading() {
  return (
    <div className="mx-auto w-full max-w-[1280px]" role="status" aria-live="polite" aria-label="設定を読み込み中">
      <div className="flex min-h-32 items-center gap-3 rounded-2xl border border-[#263955] bg-[#111826]/90 px-6 py-5 text-[#91b9ff] backdrop-blur-xl">
        <span className="h-2.5 w-2.5 animate-pulse rounded-full bg-[#5f9cff] shadow-[0_0_16px_rgba(95,156,255,0.8)]" />
        <div>
          <p className="text-sm font-semibold text-slate-100">設定を読み込んでいます</p>
          <p className="mt-1 text-[10px] font-semibold tracking-[0.18em] text-[#8191ad]">LOADING SETTINGS</p>
        </div>
      </div>
    </div>
  );
}
