"use client";

import { useState } from "react";
import { markNewsRead } from "@/lib/news/news";
import {
  NEWS_CATEGORY_LABEL, NEWS_CATEGORY_ICON,
  NEWS_PRIORITY_LABEL, NEWS_PRIORITY_STYLE, youtubeId,
  type DealerNews,
} from "@/lib/news/news-types";

function formatDate(iso: string | null): string {
  if (!iso) return "";
  return iso.slice(0, 10).replace(/-/g, "/");
}

function NewsCard({ item, onRead }: { item: DealerNews; onRead: (id: string) => void }) {
  const [open, setOpen] = useState(false);
  const [read, setRead] = useState(item.is_read);
  const style = NEWS_PRIORITY_STYLE[item.priority];
  const isUrgent = item.priority === "urgent";
  const yt = youtubeId(item.youtube_url);

  function toggle() {
    const next = !open;
    setOpen(next);
    if (next && !read) {
      setRead(true);
      onRead(item.id);
      void markNewsRead(item.id);
    }
  }

  return (
    <div
      className={[
        "rounded-xl border bg-[#0f172a] overflow-hidden transition-colors",
        isUrgent ? "border-red-600/50 shadow-[0_0_0_1px_rgba(220,38,38,0.25)]" : style.border,
      ].join(" ")}
    >
      {isUrgent && (
        <div className="bg-red-600/15 border-b border-red-600/40 px-4 py-1.5 flex items-center gap-1.5">
          <span className="text-red-400 text-xs">⚠</span>
          <span className="text-[11px] font-bold text-red-300 tracking-wide">緊急のお知らせ</span>
        </div>
      )}

      <button onClick={toggle} className="w-full text-left px-4 py-3 flex items-start gap-3">
        <span className="text-lg leading-none mt-0.5 shrink-0">{NEWS_CATEGORY_ICON[item.category]}</span>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-slate-800 text-slate-400 border border-slate-700">
              {NEWS_CATEGORY_LABEL[item.category]}
            </span>
            {item.priority !== "normal" && (
              <span className={`text-[10px] px-1.5 py-0.5 rounded-full border ${style.badge}`}>
                {NEWS_PRIORITY_LABEL[item.priority]}
              </span>
            )}
            {!read && <span className="w-1.5 h-1.5 rounded-full bg-blue-400 inline-block" />}
            <span className="ml-auto text-[10px] text-slate-500">{formatDate(item.publish_start_at ?? item.created_at)}</span>
          </div>
          <p className={`text-sm mt-1 leading-snug ${read ? "text-slate-300" : "text-slate-100 font-semibold"}`}>
            {item.title}
          </p>
        </div>
        <span className="text-slate-600 text-xs shrink-0 mt-1">{open ? "▲" : "▼"}</span>
      </button>

      {open && (
        <div className="px-4 pb-4 pt-1 flex flex-col gap-3 border-t border-slate-800/60">
          {item.body && (
            <p className="text-xs text-slate-300 leading-relaxed whitespace-pre-wrap">{item.body}</p>
          )}

          {item.image_url && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={item.image_url} alt="" className="rounded-lg border border-slate-800 max-h-80 object-contain w-full bg-black/30" />
          )}

          {yt && (
            <div className="relative w-full" style={{ paddingBottom: "56.25%" }}>
              <iframe
                className="absolute inset-0 w-full h-full rounded-lg border border-slate-800"
                src={`https://www.youtube.com/embed/${yt}`}
                title={item.title}
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
              />
            </div>
          )}

          <div className="flex flex-wrap gap-2">
            {item.pdf_url && (
              <a href={item.pdf_url} target="_blank" rel="noopener noreferrer"
                className="text-[11px] px-3 py-1.5 rounded-lg border border-slate-700 text-slate-300 hover:border-blue-600 hover:text-blue-300 transition-colors">
                📄 PDFを開く
              </a>
            )}
            {item.external_url && (
              <a href={item.external_url} target="_blank" rel="noopener noreferrer"
                className="text-[11px] px-3 py-1.5 rounded-lg border border-slate-700 text-slate-300 hover:border-blue-600 hover:text-blue-300 transition-colors">
                🔗 詳細リンク
              </a>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default function NewsClient({ initialNews }: { initialNews: DealerNews[] }) {
  const [items, setItems] = useState(initialNews);

  function markReadLocal(id: string) {
    setItems((prev) => prev.map((n) => (n.id === id ? { ...n, is_read: true } : n)));
  }

  if (items.length === 0) {
    return (
      <div className="rounded-xl border border-slate-800 bg-[#0f172a] py-12 text-center">
        <p className="text-3xl mb-2">📭</p>
        <p className="text-sm text-slate-400">現在お知らせはありません</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      {items.map((item) => (
        <NewsCard key={item.id} item={item} onRead={markReadLocal} />
      ))}
    </div>
  );
}
