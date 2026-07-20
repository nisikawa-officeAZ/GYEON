// OBS-1B — 404 page for the 11 existing `notFound()` call sites.
//
// ── DELIBERATELY NOT A CLIENT COMPONENT, AND DELIBERATELY SILENT ────────────
// A not-found is a NORMAL, expected outcome — a mistyped URL, a deleted record,
// a route guarded by `notFound()` in production. It is not an incident.
//
// So this file:
//   • carries no "use client" (Next's builtin not-found is a Server Component);
//   • generates NO support code — there is no failure for support to correlate;
//   • reports NO observability event — counting 404s as errors would bury real
//     crashes in routine noise and make the uncaught-error alert useless.
//
// This is the one boundary in OBS-1B that intentionally emits nothing.

export default function NotFound() {
  return (
    <div className="min-h-[60vh] flex items-center justify-center px-4 py-10">
      <div className="w-full max-w-lg text-center">
        <h1 className="text-xl font-bold mb-3">ページが見つかりません</h1>
        <p className="text-sm leading-7 text-slate-300 mb-5">
          URLが正しいか確認するか、ホームへ戻ってください。
        </p>
        <div className="flex flex-wrap gap-3 justify-center">
          <a
            href="/"
            className="rounded-md border border-slate-600 bg-slate-800 px-5 py-2.5 text-sm hover:bg-slate-700"
          >
            ホームへ戻る
          </a>
        </div>
      </div>
    </div>
  );
}
