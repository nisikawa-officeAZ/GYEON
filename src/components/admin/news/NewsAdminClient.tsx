"use client";

import { useState, useTransition } from "react";
import {
  createNews, updateNews, setNewsStatus, deleteNews, type NewsInput,
} from "@/lib/news/manage-news";
import {
  NEWS_CATEGORIES, NEWS_CATEGORY_LABEL, NEWS_PRIORITIES, NEWS_PRIORITY_LABEL,
  type GyeonNews, type NewsCategory, type NewsPriority, type NewsStatus,
} from "@/lib/news/news-types";

const inp = "w-full bg-[#0b1120] border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-100 placeholder:text-slate-600 focus:outline-none focus:ring-1 focus:ring-blue-600 focus:border-blue-600";
const lbl = "text-[11px] font-semibold text-slate-400";

const EMPTY: NewsInput = {
  category: "announcement", priority: "normal", title: "", body: "",
  image_url: "", pdf_url: "", youtube_url: "", external_url: "",
  status: "draft", publish_start_at: "", publish_end_at: "",
};

function toInput(n: GyeonNews): NewsInput {
  return {
    category: n.category, priority: n.priority, title: n.title, body: n.body ?? "",
    image_url: n.image_url ?? "", pdf_url: n.pdf_url ?? "", youtube_url: n.youtube_url ?? "",
    external_url: n.external_url ?? "", status: n.status,
    publish_start_at: n.publish_start_at ? n.publish_start_at.slice(0, 16) : "",
    publish_end_at:   n.publish_end_at ? n.publish_end_at.slice(0, 16) : "",
  };
}

const statusBadge: Record<NewsStatus, string> = {
  draft:     "bg-slate-800 text-slate-400 border-slate-700",
  published: "bg-emerald-900/30 text-emerald-300 border-emerald-700/40",
  archived:  "bg-amber-900/30 text-amber-300 border-amber-700/40",
};

export default function NewsAdminClient({ initialNews }: { initialNews: GyeonNews[] }) {
  const [news, setNews] = useState(initialNews);
  const [editing, setEditing] = useState<{ id: string | null; data: NewsInput } | null>(null);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function refresh(updater: (prev: GyeonNews[]) => GyeonNews[]) { setNews(updater); }

  function openNew() { setError(null); setEditing({ id: null, data: { ...EMPTY } }); }
  function openEdit(n: GyeonNews) { setError(null); setEditing({ id: n.id, data: toInput(n) }); }

  function save() {
    if (!editing) return;
    setError(null);
    startTransition(async () => {
      const res = editing.id
        ? await updateNews(editing.id, editing.data)
        : await createNews(editing.data);
      if ("error" in res) { setError(res.error); return; }
      // Reflect locally (simplest: reload list shape from edited data)
      if (editing.id) {
        refresh((prev) => prev.map((n) => (n.id === editing.id ? { ...n, ...normalize(editing.data) } : n)));
      } else {
        const id = (res as { id: string }).id;
        refresh((prev) => [{
          id, created_by: null, created_at: new Date().toISOString(), updated_at: new Date().toISOString(),
          ...normalize(editing.data),
        } as GyeonNews, ...prev]);
      }
      setEditing(null);
    });
  }

  function changeStatus(id: string, status: NewsStatus) {
    startTransition(async () => {
      const res = await setNewsStatus(id, status);
      if (!("error" in res)) refresh((prev) => prev.map((n) => (n.id === id ? { ...n, status } : n)));
    });
  }

  function remove(id: string) {
    if (!confirm("このお知らせを削除しますか?")) return;
    startTransition(async () => {
      const res = await deleteNews(id);
      if (!("error" in res)) refresh((prev) => prev.filter((n) => n.id !== id));
    });
  }

  return (
    <div className="flex flex-col gap-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-base font-bold text-slate-100">News Management</h1>
          <p className="text-xs text-slate-500 mt-0.5">ディーラー向けお知らせの作成・公開・アーカイブ</p>
        </div>
        <button onClick={openNew} className="px-3 py-2 text-xs font-semibold rounded-lg bg-blue-600 hover:bg-blue-500 text-white transition-colors">
          ＋ 新規作成
        </button>
      </div>

      {/* List */}
      <div className="border border-slate-800 rounded-xl overflow-hidden">
        {news.length === 0 ? (
          <p className="text-sm text-slate-500 text-center py-10">お知らせはまだありません</p>
        ) : news.map((n, i) => (
          <div key={n.id} className={`flex items-center gap-3 px-4 py-3 ${i < news.length - 1 ? "border-b border-slate-800/60" : ""}`}>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className={`text-[10px] px-1.5 py-0.5 rounded-full border ${statusBadge[n.status]}`}>{n.status}</span>
                <span className="text-[10px] text-slate-500">{NEWS_CATEGORY_LABEL[n.category]}</span>
                {n.priority !== "normal" && (
                  <span className="text-[10px] text-amber-400">{NEWS_PRIORITY_LABEL[n.priority]}</span>
                )}
              </div>
              <p className="text-sm text-slate-200 truncate mt-0.5">{n.title}</p>
            </div>
            <div className="flex items-center gap-1.5 shrink-0">
              <button onClick={() => openEdit(n)} className="text-[11px] px-2 py-1 rounded border border-slate-700 text-slate-300 hover:text-slate-100 hover:border-slate-500">編集</button>
              {n.status !== "published" && (
                <button onClick={() => changeStatus(n.id, "published")} className="text-[11px] px-2 py-1 rounded border border-emerald-700/40 text-emerald-300 hover:bg-emerald-900/30">公開</button>
              )}
              {n.status === "published" && (
                <button onClick={() => changeStatus(n.id, "archived")} className="text-[11px] px-2 py-1 rounded border border-amber-700/40 text-amber-300 hover:bg-amber-900/30">アーカイブ</button>
              )}
              <button onClick={() => remove(n.id)} className="text-[11px] px-2 py-1 rounded border border-red-800/40 text-red-400 hover:bg-red-950/30">削除</button>
            </div>
          </div>
        ))}
      </div>

      {/* Editor modal */}
      {editing && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-start justify-center overflow-y-auto p-4" onClick={() => setEditing(null)}>
          <div className="bg-[#0f172a] border border-slate-700 rounded-2xl w-full max-w-lg my-8 p-5 flex flex-col gap-4" onClick={(e) => e.stopPropagation()}>
            <p className="text-sm font-bold text-slate-100">{editing.id ? "お知らせを編集" : "新規お知らせ"}</p>

            <div className="grid grid-cols-2 gap-3">
              <div className="flex flex-col gap-1">
                <label className={lbl}>カテゴリ</label>
                <select value={editing.data.category} onChange={(e) => setEditing({ ...editing, data: { ...editing.data, category: e.target.value as NewsCategory } })} className={inp}>
                  {NEWS_CATEGORIES.map((c) => <option key={c} value={c} className="bg-[#0b1120]">{NEWS_CATEGORY_LABEL[c]}</option>)}
                </select>
              </div>
              <div className="flex flex-col gap-1">
                <label className={lbl}>優先度</label>
                <select value={editing.data.priority} onChange={(e) => setEditing({ ...editing, data: { ...editing.data, priority: e.target.value as NewsPriority } })} className={inp}>
                  {NEWS_PRIORITIES.map((p) => <option key={p} value={p} className="bg-[#0b1120]">{NEWS_PRIORITY_LABEL[p]}</option>)}
                </select>
              </div>
            </div>

            <div className="flex flex-col gap-1">
              <label className={lbl}>タイトル *</label>
              <input value={editing.data.title} onChange={(e) => setEditing({ ...editing, data: { ...editing.data, title: e.target.value } })} className={inp} />
            </div>
            <div className="flex flex-col gap-1">
              <label className={lbl}>本文</label>
              <textarea rows={4} value={editing.data.body ?? ""} onChange={(e) => setEditing({ ...editing, data: { ...editing.data, body: e.target.value } })} className={`${inp} resize-none`} />
            </div>

            <div className="grid grid-cols-1 gap-2">
              <input placeholder="画像URL" value={editing.data.image_url ?? ""} onChange={(e) => setEditing({ ...editing, data: { ...editing.data, image_url: e.target.value } })} className={inp} />
              <input placeholder="PDF URL" value={editing.data.pdf_url ?? ""} onChange={(e) => setEditing({ ...editing, data: { ...editing.data, pdf_url: e.target.value } })} className={inp} />
              <input placeholder="YouTube URL" value={editing.data.youtube_url ?? ""} onChange={(e) => setEditing({ ...editing, data: { ...editing.data, youtube_url: e.target.value } })} className={inp} />
              <input placeholder="外部リンクURL" value={editing.data.external_url ?? ""} onChange={(e) => setEditing({ ...editing, data: { ...editing.data, external_url: e.target.value } })} className={inp} />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="flex flex-col gap-1">
                <label className={lbl}>公開開始</label>
                <input type="datetime-local" value={editing.data.publish_start_at ?? ""} onChange={(e) => setEditing({ ...editing, data: { ...editing.data, publish_start_at: e.target.value } })} className={inp} />
              </div>
              <div className="flex flex-col gap-1">
                <label className={lbl}>公開終了</label>
                <input type="datetime-local" value={editing.data.publish_end_at ?? ""} onChange={(e) => setEditing({ ...editing, data: { ...editing.data, publish_end_at: e.target.value } })} className={inp} />
              </div>
            </div>

            <div className="flex flex-col gap-1">
              <label className={lbl}>ステータス</label>
              <select value={editing.data.status} onChange={(e) => setEditing({ ...editing, data: { ...editing.data, status: e.target.value as NewsStatus } })} className={inp}>
                <option value="draft" className="bg-[#0b1120]">下書き</option>
                <option value="published" className="bg-[#0b1120]">公開</option>
                <option value="archived" className="bg-[#0b1120]">アーカイブ</option>
              </select>
            </div>

            {error && <p className="text-xs text-red-400">{error}</p>}

            <div className="flex justify-end gap-2 pt-1">
              <button onClick={() => setEditing(null)} className="px-3 py-2 text-xs text-slate-400 rounded-lg border border-slate-700 hover:text-slate-200">キャンセル</button>
              <button onClick={save} disabled={pending} className="px-4 py-2 text-xs font-semibold rounded-lg bg-blue-600 hover:bg-blue-500 text-white disabled:opacity-50">
                {pending ? "保存中…" : "保存"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// Map a NewsInput back into GyeonNews-ish shape for optimistic list updates.
function normalize(d: NewsInput) {
  const clean = (v: string | null) => (v && v.trim() ? v.trim() : null);
  return {
    category: d.category, priority: d.priority, title: d.title.trim(),
    body: clean(d.body), image_url: clean(d.image_url), pdf_url: clean(d.pdf_url),
    youtube_url: clean(d.youtube_url), external_url: clean(d.external_url),
    status: d.status, publish_start_at: clean(d.publish_start_at), publish_end_at: clean(d.publish_end_at),
  };
}
