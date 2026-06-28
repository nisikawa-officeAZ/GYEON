"use client";

import { useState, useTransition } from "react";
import {
  createResource, updateResource, setResourceStatus, deleteResource,
  uploadResourceFile, type ResourceInput,
} from "@/lib/resources/manage-resources";
import {
  RESOURCE_CATEGORIES, RESOURCE_CATEGORY_LABEL, formatFileSize,
  type GyeonResource, type ResourceCategory, type ResourceStatus,
} from "@/lib/resources/resource-types";

const inp = "w-full bg-[#0b1120] border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-100 placeholder:text-slate-600 focus:outline-none focus:ring-1 focus:ring-blue-600 focus:border-blue-600";
const lbl = "text-[11px] font-semibold text-slate-400";

const EMPTY: ResourceInput = {
  category: "catalog", title: "", description: "", file_path: "", file_name: "",
  file_type: "", file_size: null, youtube_url: "", external_url: "",
  product_id: "", version: "", status: "draft",
};

function toInput(r: GyeonResource): ResourceInput {
  return {
    category: r.category, title: r.title, description: r.description ?? "",
    file_path: r.file_path ?? "", file_name: r.file_name ?? "", file_type: r.file_type ?? "",
    file_size: r.file_size, youtube_url: r.youtube_url ?? "", external_url: r.external_url ?? "",
    product_id: r.product_id ?? "", version: r.version ?? "", status: r.status,
  };
}

const statusBadge: Record<ResourceStatus, string> = {
  draft:     "bg-slate-800 text-slate-400 border-slate-700",
  published: "bg-emerald-900/30 text-emerald-300 border-emerald-700/40",
  archived:  "bg-amber-900/30 text-amber-300 border-amber-700/40",
};

export default function ResourcesAdminClient({ initialResources }: { initialResources: GyeonResource[] }) {
  const [list, setList] = useState(initialResources);
  const [editing, setEditing] = useState<{ id: string | null; data: ResourceInput } | null>(null);
  const [pending, startTransition] = useTransition();
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function openNew() { setError(null); setEditing({ id: null, data: { ...EMPTY } }); }
  function openEdit(r: GyeonResource) { setError(null); setEditing({ id: r.id, data: toInput(r) }); }

  async function handleFile(file: File) {
    if (!editing) return;
    setUploading(true);
    setError(null);
    try {
      const fd = new FormData();
      fd.set("file", file);
      fd.set("category", editing.data.category);
      const res = await uploadResourceFile(fd);
      if ("error" in res) { setError(res.error); return; }
      setEditing((cur) => cur && ({
        ...cur,
        data: { ...cur.data, file_path: res.path, file_name: res.name, file_type: res.type, file_size: res.size },
      }));
    } finally {
      setUploading(false);
    }
  }

  function save() {
    if (!editing) return;
    setError(null);
    startTransition(async () => {
      const res = editing.id
        ? await updateResource(editing.id, editing.data)
        : await createResource(editing.data);
      if ("error" in res) { setError(res.error); return; }
      if (editing.id) {
        setList((prev) => prev.map((r) => (r.id === editing.id ? { ...r, ...normalize(editing.data) } : r)));
      } else {
        const id = (res as { id: string }).id;
        setList((prev) => [{
          id, created_by: null, created_at: new Date().toISOString(), updated_at: new Date().toISOString(),
          ...normalize(editing.data),
        } as GyeonResource, ...prev]);
      }
      setEditing(null);
    });
  }

  function changeStatus(id: string, status: ResourceStatus) {
    startTransition(async () => {
      const res = await setResourceStatus(id, status);
      if (!("error" in res)) setList((prev) => prev.map((r) => (r.id === id ? { ...r, status } : r)));
    });
  }

  function remove(id: string) {
    if (!confirm("このリソースを削除しますか?")) return;
    startTransition(async () => {
      const res = await deleteResource(id);
      if (!("error" in res)) setList((prev) => prev.filter((r) => r.id !== id));
    });
  }

  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-base font-bold text-slate-100">Resource Management</h1>
          <p className="text-xs text-slate-500 mt-0.5">公式素材・カタログ・SDS/TDS・動画の管理</p>
        </div>
        <button onClick={openNew} className="px-3 py-2 text-xs font-semibold rounded-lg bg-blue-600 hover:bg-blue-500 text-white transition-colors">
          ＋ 新規追加
        </button>
      </div>

      <div className="border border-slate-800 rounded-xl overflow-hidden">
        {list.length === 0 ? (
          <p className="text-sm text-slate-500 text-center py-10">リソースはまだありません</p>
        ) : list.map((r, i) => (
          <div key={r.id} className={`flex items-center gap-3 px-4 py-3 ${i < list.length - 1 ? "border-b border-slate-800/60" : ""}`}>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className={`text-[10px] px-1.5 py-0.5 rounded-full border ${statusBadge[r.status]}`}>{r.status}</span>
                <span className="text-[10px] text-slate-500">{RESOURCE_CATEGORY_LABEL[r.category]}</span>
                {r.version && <span className="text-[10px] text-blue-400">v{r.version}</span>}
                {r.file_size ? <span className="text-[10px] text-slate-600">{formatFileSize(r.file_size)}</span> : null}
              </div>
              <p className="text-sm text-slate-200 truncate mt-0.5">{r.title}</p>
            </div>
            <div className="flex items-center gap-1.5 shrink-0">
              <button onClick={() => openEdit(r)} className="text-[11px] px-2 py-1 rounded border border-slate-700 text-slate-300 hover:text-slate-100 hover:border-slate-500">編集</button>
              {r.status !== "published" && (
                <button onClick={() => changeStatus(r.id, "published")} className="text-[11px] px-2 py-1 rounded border border-emerald-700/40 text-emerald-300 hover:bg-emerald-900/30">公開</button>
              )}
              {r.status === "published" && (
                <button onClick={() => changeStatus(r.id, "archived")} className="text-[11px] px-2 py-1 rounded border border-amber-700/40 text-amber-300 hover:bg-amber-900/30">アーカイブ</button>
              )}
              <button onClick={() => remove(r.id)} className="text-[11px] px-2 py-1 rounded border border-red-800/40 text-red-400 hover:bg-red-950/30">削除</button>
            </div>
          </div>
        ))}
      </div>

      {editing && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-start justify-center overflow-y-auto p-4" onClick={() => setEditing(null)}>
          <div className="bg-[#0f172a] border border-slate-700 rounded-2xl w-full max-w-lg my-8 p-5 flex flex-col gap-4" onClick={(e) => e.stopPropagation()}>
            <p className="text-sm font-bold text-slate-100">{editing.id ? "リソースを編集" : "新規リソース"}</p>

            <div className="grid grid-cols-2 gap-3">
              <div className="flex flex-col gap-1">
                <label className={lbl}>カテゴリ</label>
                <select value={editing.data.category} onChange={(e) => setEditing({ ...editing, data: { ...editing.data, category: e.target.value as ResourceCategory } })} className={inp}>
                  {RESOURCE_CATEGORIES.map((c) => <option key={c} value={c} className="bg-[#0b1120]">{RESOURCE_CATEGORY_LABEL[c]}</option>)}
                </select>
              </div>
              <div className="flex flex-col gap-1">
                <label className={lbl}>バージョン</label>
                <input placeholder="1.0" value={editing.data.version ?? ""} onChange={(e) => setEditing({ ...editing, data: { ...editing.data, version: e.target.value } })} className={inp} />
              </div>
            </div>

            <div className="flex flex-col gap-1">
              <label className={lbl}>タイトル *</label>
              <input value={editing.data.title} onChange={(e) => setEditing({ ...editing, data: { ...editing.data, title: e.target.value } })} className={inp} />
            </div>
            <div className="flex flex-col gap-1">
              <label className={lbl}>説明</label>
              <textarea rows={3} value={editing.data.description ?? ""} onChange={(e) => setEditing({ ...editing, data: { ...editing.data, description: e.target.value } })} className={`${inp} resize-none`} />
            </div>

            {/* File upload */}
            <div className="flex flex-col gap-1.5">
              <label className={lbl}>ファイル</label>
              <input
                type="file"
                onChange={(e) => { const f = e.target.files?.[0]; if (f) void handleFile(f); }}
                className="text-xs text-slate-400 file:mr-2 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:bg-slate-700 file:text-slate-200 file:text-xs"
              />
              {uploading && <p className="text-[10px] text-blue-400">アップロード中…</p>}
              {editing.data.file_name && (
                <p className="text-[10px] text-emerald-400">✓ {editing.data.file_name} {editing.data.file_size ? `(${formatFileSize(editing.data.file_size)})` : ""}</p>
              )}
            </div>

            <div className="grid grid-cols-1 gap-2">
              <input placeholder="YouTube URL（動画の場合）" value={editing.data.youtube_url ?? ""} onChange={(e) => setEditing({ ...editing, data: { ...editing.data, youtube_url: e.target.value } })} className={inp} />
              <input placeholder="外部リンクURL" value={editing.data.external_url ?? ""} onChange={(e) => setEditing({ ...editing, data: { ...editing.data, external_url: e.target.value } })} className={inp} />
              <input placeholder="関連製品ID（任意・gyeon_products.id）" value={editing.data.product_id ?? ""} onChange={(e) => setEditing({ ...editing, data: { ...editing.data, product_id: e.target.value } })} className={inp} />
            </div>

            <div className="flex flex-col gap-1">
              <label className={lbl}>ステータス</label>
              <select value={editing.data.status} onChange={(e) => setEditing({ ...editing, data: { ...editing.data, status: e.target.value as ResourceStatus } })} className={inp}>
                <option value="draft" className="bg-[#0b1120]">下書き</option>
                <option value="published" className="bg-[#0b1120]">公開</option>
                <option value="archived" className="bg-[#0b1120]">アーカイブ</option>
              </select>
            </div>

            {error && <p className="text-xs text-red-400">{error}</p>}

            <div className="flex justify-end gap-2 pt-1">
              <button onClick={() => setEditing(null)} className="px-3 py-2 text-xs text-slate-400 rounded-lg border border-slate-700 hover:text-slate-200">キャンセル</button>
              <button onClick={save} disabled={pending || uploading} className="px-4 py-2 text-xs font-semibold rounded-lg bg-blue-600 hover:bg-blue-500 text-white disabled:opacity-50">
                {pending ? "保存中…" : "保存"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function normalize(d: ResourceInput) {
  const clean = (v: string | null) => (v && v.trim() ? v.trim() : null);
  return {
    category: d.category, title: d.title.trim(), description: clean(d.description),
    file_path: clean(d.file_path), file_name: clean(d.file_name), file_type: clean(d.file_type),
    file_size: typeof d.file_size === "number" && d.file_size > 0 ? d.file_size : null,
    youtube_url: clean(d.youtube_url), external_url: clean(d.external_url),
    product_id: clean(d.product_id), version: clean(d.version), status: d.status,
  };
}
