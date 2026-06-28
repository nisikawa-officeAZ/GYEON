"use client";

import { useMemo, useState } from "react";
import { recordResourceDownload } from "@/lib/resources/resources";
import {
  RESOURCE_CATEGORY_LABEL, RESOURCE_CATEGORY_ICON, RESOURCE_CATEGORIES,
  formatFileSize, type GyeonResource, type ResourceCategory,
} from "@/lib/resources/resource-types";

function ResourceCard({ r }: { r: GyeonResource }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const isLinkOnly = !r.file_path && (r.external_url || r.youtube_url);

  async function handleDownload() {
    setBusy(true);
    setError(null);
    try {
      const res = await recordResourceDownload(r.id);
      if ("error" in res) { setError(res.error); return; }
      window.open(res.url, "_blank", "noopener,noreferrer");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="rounded-xl border border-slate-800 bg-[#0f172a] p-4 flex flex-col gap-3">
      <div className="flex items-start gap-3">
        <span className="text-2xl leading-none shrink-0">{RESOURCE_CATEGORY_ICON[r.category]}</span>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-slate-100 leading-snug">{r.title}</p>
          <div className="flex items-center gap-2 mt-1 flex-wrap">
            <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-slate-800 text-slate-400 border border-slate-700">
              {RESOURCE_CATEGORY_LABEL[r.category]}
            </span>
            {r.version && (
              <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-blue-950/40 text-blue-300 border border-blue-700/40">
                v{r.version}
              </span>
            )}
            {r.file_size ? <span className="text-[10px] text-slate-500">{formatFileSize(r.file_size)}</span> : null}
          </div>
        </div>
      </div>

      {r.description && <p className="text-[11px] text-slate-400 leading-relaxed line-clamp-3">{r.description}</p>}

      <div className="mt-auto flex items-center gap-2">
        <button
          onClick={handleDownload}
          disabled={busy}
          className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-blue-700 hover:bg-blue-600 disabled:opacity-50 text-white transition-colors"
        >
          {busy ? "準備中…" : isLinkOnly ? "🔗 開く" : "⬇ ダウンロード"}
        </button>
        {error && <span className="text-[10px] text-red-400">{error}</span>}
      </div>
    </div>
  );
}

export default function ResourcesClient({ initialResources }: { initialResources: GyeonResource[] }) {
  const [category, setCategory] = useState<ResourceCategory | "all">("all");
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    const term = query.trim().toLowerCase();
    return initialResources.filter((r) => {
      if (category !== "all" && r.category !== category) return false;
      if (term) {
        const hay = `${r.title} ${r.description ?? ""}`.toLowerCase();
        if (!hay.includes(term)) return false;
      }
      return true;
    });
  }, [initialResources, category, query]);

  return (
    <div className="flex flex-col gap-4">
      {/* Search + filter */}
      <div className="flex flex-col gap-3">
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="素材を検索…"
          className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-100 placeholder:text-slate-600 focus:outline-none focus:ring-1 focus:ring-blue-600 focus:border-blue-600"
        />
        <div className="flex gap-1.5 flex-wrap">
          <button
            onClick={() => setCategory("all")}
            className={`text-[11px] px-2.5 py-1 rounded-full border transition-colors ${
              category === "all"
                ? "bg-blue-600/20 text-blue-300 border-blue-700/40"
                : "bg-slate-900 text-slate-400 border-slate-700 hover:text-slate-200"
            }`}
          >
            すべて
          </button>
          {RESOURCE_CATEGORIES.map((c) => (
            <button
              key={c}
              onClick={() => setCategory(c)}
              className={`text-[11px] px-2.5 py-1 rounded-full border transition-colors ${
                category === c
                  ? "bg-blue-600/20 text-blue-300 border-blue-700/40"
                  : "bg-slate-900 text-slate-400 border-slate-700 hover:text-slate-200"
              }`}
            >
              {RESOURCE_CATEGORY_ICON[c]} {RESOURCE_CATEGORY_LABEL[c]}
            </button>
          ))}
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="rounded-xl border border-slate-800 bg-[#0f172a] py-12 text-center">
          <p className="text-3xl mb-2">🔍</p>
          <p className="text-sm text-slate-400">該当する素材がありません</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {filtered.map((r) => <ResourceCard key={r.id} r={r} />)}
        </div>
      )}

      {/* Future: ZIP bulk download */}
      <p className="text-[10px] text-slate-600 text-center pt-2">
        ※ 一括ZIPダウンロードは今後対応予定です
      </p>
    </div>
  );
}
