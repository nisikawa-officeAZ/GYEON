"use client";

import { useState, useEffect, useTransition } from "react";
import {
  createNews, updateNews, setNewsStatus, deleteNews, type NewsInput,
} from "@/lib/news/manage-news";
import {
  getDistributionPreview, sendTestDelivery, createDelivery,
  getDeliveryHistory, cancelDelivery, type DistributionPreview,
} from "@/lib/news/distribution";
import {
  NEWS_CATEGORIES, NEWS_CATEGORY_LABEL, NEWS_PRIORITIES, NEWS_PRIORITY_LABEL,
  type GyeonNews, type NewsCategory, type NewsPriority, type NewsStatus,
} from "@/lib/news/news-types";
import {
  NEWS_AUDIENCES, NEWS_AUDIENCE_LABEL, NEWS_CHANNELS, NEWS_CHANNELS_LABEL,
  DELIVERY_JOB_STATUS_LABEL, DELIVERY_CHANNEL_LABEL,
  type NewsAudience, type NewsChannels, type NewsDeliveryJob,
} from "@/lib/news/distribution-types";

const inp = "w-full bg-[#0b1120] border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-100 placeholder:text-slate-600 focus:outline-none focus:ring-1 focus:ring-blue-600 focus:border-blue-600";
const lbl = "text-[11px] font-semibold text-slate-400";

const EMPTY: NewsInput = {
  category: "announcement", priority: "normal", title: "", body: "",
  image_url: "", pdf_url: "", youtube_url: "", external_url: "",
  status: "draft", publish_start_at: "", publish_end_at: "",
  summary: "", body_html: "", body_text: "",
  target_audience: "all_dealers", target_dealer_ids: [], channels: "in_app", scheduled_at: "",
};

function toInput(n: GyeonNews): NewsInput {
  return {
    category: n.category, priority: n.priority, title: n.title, body: n.body ?? "",
    image_url: n.image_url ?? "", pdf_url: n.pdf_url ?? "", youtube_url: n.youtube_url ?? "",
    external_url: n.external_url ?? "", status: n.status,
    publish_start_at: n.publish_start_at ? n.publish_start_at.slice(0, 16) : "",
    publish_end_at:   n.publish_end_at ? n.publish_end_at.slice(0, 16) : "",
    summary: n.summary ?? "", body_html: n.body_html ?? "", body_text: n.body_text ?? "",
    target_audience: n.target_audience ?? "all_dealers",
    target_dealer_ids: n.target_dealer_ids ?? [],
    channels: n.channels ?? "in_app",
    scheduled_at: n.scheduled_at ? n.scheduled_at.slice(0, 16) : "",
  };
}

const statusBadge: Record<NewsStatus, string> = {
  draft:     "bg-slate-800 text-slate-400 border-slate-700",
  published: "bg-emerald-900/30 text-emerald-300 border-emerald-700/40",
  archived:  "bg-amber-900/30 text-amber-300 border-amber-700/40",
};

// Display-only labels for the status enum (DB values are unchanged).
const STATUS_LABEL: Record<NewsStatus, string> = {
  draft:     "下書き",
  published: "公開",
  archived:  "アーカイブ",
};

export default function NewsAdminClient({ initialNews }: { initialNews: GyeonNews[] }) {
  const [news, setNews] = useState(initialNews);
  const [editing, setEditing] = useState<{ id: string | null; data: NewsInput } | null>(null);
  const [editorTab, setEditorTab] = useState<"edit" | "preview">("edit");
  const [preview, setPreview] = useState<NewsInput | null>(null);
  const [distribute, setDistribute] = useState<GyeonNews | null>(null);
  const [history, setHistory] = useState<GyeonNews | null>(null);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function refresh(updater: (prev: GyeonNews[]) => GyeonNews[]) { setNews(updater); }

  function openNew() { setError(null); setEditorTab("edit"); setEditing({ id: null, data: { ...EMPTY } }); }
  function openEdit(n: GyeonNews) { setError(null); setEditorTab("edit"); setEditing({ id: n.id, data: toInput(n) }); }

  function save() {
    if (!editing) return;
    setError(null);
    startTransition(async () => {
      const res = editing.id
        ? await updateNews(editing.id, editing.data)
        : await createNews(editing.data);
      if ("error" in res) { setError(res.error); return; }
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
          <h1 className="text-base font-bold text-slate-100">お知らせ管理</h1>
          <p className="text-xs text-slate-500 mt-0.5">ディーラー向けお知らせの作成・配信（アプリ内 / メール / LINE）</p>
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
                <span className={`text-[10px] px-1.5 py-0.5 rounded-full border ${statusBadge[n.status]}`}>{STATUS_LABEL[n.status]}</span>
                <span className="text-[10px] text-slate-500">{NEWS_CATEGORY_LABEL[n.category]}</span>
                {n.priority !== "normal" && (
                  <span className="text-[10px] text-amber-400">{NEWS_PRIORITY_LABEL[n.priority]}</span>
                )}
                <span className="text-[10px] text-slate-600">· {NEWS_CHANNELS_LABEL[n.channels ?? "in_app"]}</span>
              </div>
              <p className="text-sm text-slate-200 truncate mt-0.5">{n.title}</p>
            </div>
            <div className="flex items-center gap-1.5 shrink-0">
              <button onClick={() => openEdit(n)} className="text-[11px] px-2 py-1 rounded border border-slate-700 text-slate-300 hover:text-slate-100 hover:border-slate-500">編集</button>
              <button onClick={() => setPreview(toInput(n))} className="text-[11px] px-2 py-1 rounded border border-slate-700 text-slate-300 hover:text-slate-100 hover:border-slate-500">プレビュー</button>
              <button onClick={() => { setError(null); setDistribute(n); }} className="text-[11px] px-2 py-1 rounded border border-blue-700/50 text-blue-300 hover:bg-blue-900/30">配信</button>
              <button onClick={() => setHistory(n)} className="text-[11px] px-2 py-1 rounded border border-slate-700 text-slate-400 hover:text-slate-200 hover:border-slate-500">履歴</button>
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
          <div className={`bg-[#0f172a] border border-slate-700 rounded-2xl w-full my-8 p-5 flex flex-col gap-4 ${editorTab === "preview" ? "max-w-3xl" : "max-w-lg"}`} onClick={(e) => e.stopPropagation()}>
            <p className="text-sm font-bold text-slate-100">{editing.id ? "お知らせを編集" : "新規お知らせ"}</p>

            {/* Edit / Email-preview tabs */}
            <div className="flex items-center gap-1 border-b border-slate-800 pb-2">
              <button
                type="button"
                onClick={() => setEditorTab("edit")}
                className={`text-xs px-3 py-1.5 rounded-lg border transition-colors ${editorTab === "edit" ? "border-blue-600 text-blue-300 bg-blue-900/20" : "border-transparent text-slate-400 hover:text-slate-200"}`}
              >
                編集
              </button>
              <button
                type="button"
                onClick={() => setEditorTab("preview")}
                className={`text-xs px-3 py-1.5 rounded-lg border transition-colors ${editorTab === "preview" ? "border-blue-600 text-blue-300 bg-blue-900/20" : "border-transparent text-slate-400 hover:text-slate-200"}`}
              >
                メールプレビュー
              </button>
            </div>

            {editorTab === "preview" ? (
              <EmailPreviewBody data={editing.data} />
            ) : (
            <>
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
              <label className={lbl}>要約（summary）</label>
              <input value={editing.data.summary ?? ""} onChange={(e) => setEditing({ ...editing, data: { ...editing.data, summary: e.target.value } })} className={inp} placeholder="一覧やプレビューに表示される短い説明" />
            </div>
            <div className="flex flex-col gap-1">
              <label className={lbl}>本文（アプリ内表示）</label>
              <textarea rows={3} value={editing.data.body ?? ""} onChange={(e) => setEditing({ ...editing, data: { ...editing.data, body: e.target.value } })} className={`${inp} resize-none`} />
            </div>

            {/* HTML email content */}
            <div className="rounded-lg border border-slate-800 bg-slate-900/30 p-3 flex flex-col gap-3">
              <p className="text-[11px] font-semibold text-slate-300">HTMLメール内容</p>
              <div className="flex flex-col gap-1">
                <label className={lbl}>HTML本文（body_html）— AI生成HTMLを貼り付け</label>
                <textarea rows={5} value={editing.data.body_html ?? ""} onChange={(e) => setEditing({ ...editing, data: { ...editing.data, body_html: e.target.value } })} className={`${inp} resize-none font-mono text-[11px]`} placeholder="<table>...</table>" />
              </div>
              <div className="flex flex-col gap-1">
                <label className={lbl}>プレーンテキスト代替（body_text）</label>
                <textarea rows={3} value={editing.data.body_text ?? ""} onChange={(e) => setEditing({ ...editing, data: { ...editing.data, body_text: e.target.value } })} className={`${inp} resize-none`} placeholder="HTML非対応環境向けのテキスト版" />
              </div>
              <button
                type="button"
                onClick={() => setEditorTab("preview")}
                className="self-start text-[11px] px-2.5 py-1 rounded border border-slate-700 text-slate-300 hover:text-slate-100 hover:border-slate-500"
              >
                メールプレビュー
              </button>
            </div>

            {/* Targeting + channels */}
            <div className="grid grid-cols-2 gap-3">
              <div className="flex flex-col gap-1">
                <label className={lbl}>配信対象</label>
                <select value={editing.data.target_audience} onChange={(e) => setEditing({ ...editing, data: { ...editing.data, target_audience: e.target.value as NewsAudience } })} className={inp}>
                  {NEWS_AUDIENCES.map((a) => <option key={a} value={a} className="bg-[#0b1120]">{NEWS_AUDIENCE_LABEL[a]}</option>)}
                </select>
              </div>
              <div className="flex flex-col gap-1">
                <label className={lbl}>配信チャネル</label>
                <select value={editing.data.channels} onChange={(e) => setEditing({ ...editing, data: { ...editing.data, channels: e.target.value as NewsChannels } })} className={inp}>
                  {NEWS_CHANNELS.map((c) => <option key={c} value={c} className="bg-[#0b1120]">{NEWS_CHANNELS_LABEL[c]}</option>)}
                </select>
              </div>
            </div>
            {editing.data.target_audience === "selected_dealers" && (
              <div className="flex flex-col gap-1">
                <label className={lbl}>対象店舗ID（カンマまたは改行区切り）</label>
                <textarea
                  rows={2}
                  value={(editing.data.target_dealer_ids ?? []).join("\n")}
                  onChange={(e) => setEditing({ ...editing, data: { ...editing.data, target_dealer_ids: e.target.value.split(/[\s,]+/).filter(Boolean) } })}
                  className={`${inp} resize-none font-mono text-[11px]`}
                  placeholder="dealer-uuid-1, dealer-uuid-2"
                />
              </div>
            )}

            <div className="grid grid-cols-2 gap-3">
              <div className="flex flex-col gap-1">
                <label className={lbl}>公開開始</label>
                <input type="datetime-local" value={editing.data.publish_start_at ?? ""} onChange={(e) => setEditing({ ...editing, data: { ...editing.data, publish_start_at: e.target.value } })} className={inp} />
              </div>
              <div className="flex flex-col gap-1">
                <label className={lbl}>配信予約日時（scheduled_at）</label>
                <input type="datetime-local" value={editing.data.scheduled_at ?? ""} onChange={(e) => setEditing({ ...editing, data: { ...editing.data, scheduled_at: e.target.value } })} className={inp} />
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
            </>
            )}

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

      {preview && <EmailPreviewModal data={preview} onClose={() => setPreview(null)} />}
      {distribute && <DistributeModal news={distribute} onClose={() => setDistribute(null)} />}
      {history && <HistoryModal news={history} onClose={() => setHistory(null)} />}
    </div>
  );
}

// ── Email preview body (subject / preheader / HTML / plain-text) ──────────────
// Shared by the editor "メールプレビュー" tab and the standalone preview modal.
// The HTML is rendered inside a sandboxed <iframe> with an EMPTY sandbox
// attribute — scripts are NOT allowed to execute.

function EmailPreviewBody({ data }: { data: NewsInput }) {
  const [view, setView] = useState<"desktop" | "mobile">("desktop");
  const width = view === "desktop" ? 640 : 375;
  const hasHtml = !!data.body_html?.trim();
  const hasText = !!data.body_text?.trim();
  const preheader = data.summary?.trim();

  const emptyBox = "rounded-lg border border-dashed border-slate-700 bg-slate-900/40 text-slate-500 text-xs text-center py-8";

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <p className="text-[11px] font-semibold text-slate-300">受信者に表示されるメールのプレビュー</p>
        <div className="flex items-center gap-1">
          <button type="button" onClick={() => setView("desktop")} className={`text-[11px] px-2 py-1 rounded border ${view === "desktop" ? "border-blue-600 text-blue-300 bg-blue-900/20" : "border-slate-700 text-slate-400"}`}>デスクトップ</button>
          <button type="button" onClick={() => setView("mobile")} className={`text-[11px] px-2 py-1 rounded border ${view === "mobile" ? "border-blue-600 text-blue-300 bg-blue-900/20" : "border-slate-700 text-slate-400"}`}>モバイル</button>
        </div>
      </div>

      {/* Envelope header: subject / sender / preheader (preview text) */}
      <div className="rounded-lg border border-slate-800 bg-slate-900/40 p-3 text-xs space-y-1">
        <div className="flex gap-2"><span className="text-slate-500 w-24 shrink-0">件名</span><span className="text-slate-200 font-medium">{data.title || "(無題)"}</span></div>
        <div className="flex gap-2"><span className="text-slate-500 w-24 shrink-0">差出人</span><span className="text-slate-300">GYEON Business Hub &lt;no-reply@gyeon&gt;</span></div>
        {preheader && <div className="flex gap-2"><span className="text-slate-500 w-24 shrink-0">プレビューテキスト</span><span className="text-slate-400">{preheader}</span></div>}
      </div>

      {/* HTML body preview (sandboxed) */}
      <div>
        <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-1">HTML本文プレビュー</p>
        {hasHtml ? (
          <div className="flex justify-center bg-slate-200 rounded-lg p-4 overflow-x-auto">
            <iframe
              title="email-preview"
              sandbox=""
              srcDoc={data.body_html ?? ""}
              style={{ width, height: 480, border: "0", background: "#fff", borderRadius: 6 }}
            />
          </div>
        ) : (
          <div className={emptyBox}>HTML本文が入力されていません</div>
        )}
      </div>

      {/* Plain text fallback preview */}
      <div>
        <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-1">プレーンテキスト代替プレビュー</p>
        {hasText ? (
          <pre className="rounded-lg border border-slate-800 bg-[#0b1120] p-3 text-xs text-slate-300 whitespace-pre-wrap break-words font-sans max-h-64 overflow-y-auto">{data.body_text}</pre>
        ) : (
          <div className={emptyBox}>テキスト本文が入力されていません</div>
        )}
      </div>
    </div>
  );
}

// ── Standalone email preview modal (list "プレビュー" button) ──────────────────

function EmailPreviewModal({ data, onClose }: { data: NewsInput; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-[60] bg-black/70 flex items-start justify-center overflow-y-auto p-4" onClick={onClose}>
      <div className="bg-[#0f172a] border border-slate-700 rounded-2xl w-full max-w-3xl my-8 p-5 flex flex-col gap-4" onClick={(e) => e.stopPropagation()}>
        <p className="text-sm font-bold text-slate-100">メールプレビュー</p>

        <EmailPreviewBody data={data} />

        <div className="flex justify-end">
          <button onClick={onClose} className="px-3 py-2 text-xs text-slate-400 rounded-lg border border-slate-700 hover:text-slate-200">閉じる</button>
        </div>
      </div>
    </div>
  );
}

// ── Distribute (preview audience → test send → confirm queue) ─────────────────

function DistributeModal({ news, onClose }: { news: GyeonNews; onClose: () => void }) {
  const [pending, startTransition] = useTransition();
  const [data, setData] = useState<DistributionPreview | null>(null);
  const [confirmed, setConfirmed] = useState(false);
  const [msg, setMsg] = useState<{ text: string; kind: "ok" | "err" } | null>(null);

  useEffect(() => {
    let active = true;
    startTransition(async () => {
      const res = await getDistributionPreview(news.id);
      if (!active) return;
      if ("error" in res) setMsg({ text: res.error, kind: "err" });
      else setData(res);
    });
    return () => { active = false; };
  }, [news.id]);

  function test() {
    setMsg(null);
    startTransition(async () => {
      const res = await sendTestDelivery(news.id);
      if ("error" in res) setMsg({ text: res.error, kind: "err" });
      else setMsg({ text: "テスト送信を実行しました（自分宛のみ・実送信は基盤フェーズのため無効）。履歴で確認できます。", kind: "ok" });
    });
  }

  function confirmSend() {
    setMsg(null);
    startTransition(async () => {
      const res = await createDelivery(news.id);
      if ("error" in res) setMsg({ text: res.error, kind: "err" });
      else setMsg({ text: `配信をキューに登録しました（${res.jobs.length}チャネル）。実送信は今後のワーカーで行われます。`, kind: "ok" });
    });
  }

  const inAppOnly = data && data.channels.length === 0;

  return (
    <div className="fixed inset-0 z-[60] bg-black/70 flex items-start justify-center overflow-y-auto p-4" onClick={onClose}>
      <div className="bg-[#0f172a] border border-slate-700 rounded-2xl w-full max-w-md my-8 p-5 flex flex-col gap-4" onClick={(e) => e.stopPropagation()}>
        <p className="text-sm font-bold text-slate-100">配信： <span className="text-slate-300 font-normal">{news.title}</span></p>

        {!data ? (
          <p className="text-xs text-slate-500">対象を集計中…</p>
        ) : (
          <>
            <div className="rounded-lg border border-slate-800 bg-slate-900/40 p-3 text-xs space-y-2">
              <div className="flex justify-between"><span className="text-slate-500">配信対象</span><span className="text-slate-200">{NEWS_AUDIENCE_LABEL[data.audience]}</span></div>
              <div className="flex justify-between"><span className="text-slate-500">チャネル</span>
                <span className="text-slate-200">{inAppOnly ? "アプリ内のみ" : data.channels.map((c) => DELIVERY_CHANNEL_LABEL[c]).join(" + ")}</span>
              </div>
              <div className="flex justify-between"><span className="text-slate-500">対象店舗数</span><span className="text-slate-100 font-semibold">{data.recipientCount}件</span></div>
              <div className="flex justify-between"><span className="text-slate-500">メール宛先あり</span><span className="text-slate-300">{data.withEmail}件</span></div>
              {data.withoutEmail > 0 && <div className="flex justify-between"><span className="text-slate-500">メール未登録</span><span className="text-amber-400">{data.withoutEmail}件</span></div>}
            </div>

            {inAppOnly && (
              <p className="text-[11px] text-amber-400">このお知らせはチャネルが「アプリ内のみ」です。メール／LINE配信するには編集で配信チャネルを変更してください。</p>
            )}

            {/* Test send */}
            <div className="rounded-lg border border-slate-800 p-3 flex items-center justify-between gap-3">
              <p className="text-[11px] text-slate-400">まず自分（Super Admin）宛にテスト送信</p>
              <button onClick={test} disabled={pending || inAppOnly === true} className="text-[11px] px-3 py-1.5 rounded border border-slate-600 text-slate-200 hover:border-slate-400 disabled:opacity-40">テスト送信</button>
            </div>

            {/* Confirm gate */}
            <label className="flex items-start gap-2 text-[11px] text-slate-300">
              <input type="checkbox" checked={confirmed} onChange={(e) => setConfirmed(e.target.checked)} className="mt-0.5" />
              実際の店舗（{data.recipientCount}件）へ配信をキュー登録することを確認しました。
            </label>
          </>
        )}

        {msg && <p className={`text-[11px] ${msg.kind === "ok" ? "text-emerald-400" : "text-red-400"}`}>{msg.text}</p>}

        <div className="flex justify-end gap-2">
          <button onClick={onClose} className="px-3 py-2 text-xs text-slate-400 rounded-lg border border-slate-700 hover:text-slate-200">閉じる</button>
          <button
            onClick={confirmSend}
            disabled={pending || !confirmed || !data || inAppOnly === true || (data?.recipientCount ?? 0) === 0}
            className="px-4 py-2 text-xs font-semibold rounded-lg bg-blue-600 hover:bg-blue-500 text-white disabled:opacity-40"
          >
            {pending ? "処理中…" : "配信をキュー登録"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Delivery history ──────────────────────────────────────────────────────────

function HistoryModal({ news, onClose }: { news: GyeonNews; onClose: () => void }) {
  const [pending, startTransition] = useTransition();
  const [jobs, setJobs] = useState<NewsDeliveryJob[] | null>(null);

  function load() {
    startTransition(async () => {
      const res = await getDeliveryHistory(news.id);
      setJobs(res);
    });
  }
  useEffect(() => { load(); }, [news.id]); // eslint-disable-line react-hooks/exhaustive-deps

  function cancel(jobId: string) {
    startTransition(async () => {
      const res = await cancelDelivery(jobId);
      if (!("error" in res)) load();
    });
  }

  return (
    <div className="fixed inset-0 z-[60] bg-black/70 flex items-start justify-center overflow-y-auto p-4" onClick={onClose}>
      <div className="bg-[#0f172a] border border-slate-700 rounded-2xl w-full max-w-2xl my-8 p-5 flex flex-col gap-4" onClick={(e) => e.stopPropagation()}>
        <p className="text-sm font-bold text-slate-100">配信履歴： <span className="text-slate-300 font-normal">{news.title}</span></p>

        {jobs === null ? (
          <p className="text-xs text-slate-500">読み込み中…</p>
        ) : jobs.length === 0 ? (
          <p className="text-xs text-slate-500 text-center py-6">配信履歴はまだありません</p>
        ) : (
          <div className="border border-slate-800 rounded-lg overflow-hidden">
            <table className="w-full text-[11px]">
              <thead>
                <tr className="border-b border-slate-800 text-slate-500">
                  {["チャネル", "状態", "対象", "送信", "失敗", "保留", "除外", "作成日", "送信日", ""].map((h) => (
                    <th key={h} className="text-left px-2.5 py-2 font-semibold whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/40">
                {jobs.map((j) => (
                  <tr key={j.id} className="text-slate-300">
                    <td className="px-2.5 py-2 whitespace-nowrap">
                      {DELIVERY_CHANNEL_LABEL[j.channel]}{j.is_test && <span className="ml-1 text-[9px] text-amber-400">TEST</span>}
                    </td>
                    <td className="px-2.5 py-2 whitespace-nowrap">{DELIVERY_JOB_STATUS_LABEL[j.status]}</td>
                    <td className="px-2.5 py-2">{j.total_count}</td>
                    <td className="px-2.5 py-2 text-emerald-400">{j.sent_count}</td>
                    <td className="px-2.5 py-2 text-red-400">{j.failed_count}</td>
                    <td className="px-2.5 py-2 text-slate-400">{j.pending_count}</td>
                    <td className="px-2.5 py-2 text-slate-500">{j.skipped_count}</td>
                    <td className="px-2.5 py-2 text-slate-500 whitespace-nowrap">{fmtDate(j.created_at)}</td>
                    <td className="px-2.5 py-2 text-slate-500 whitespace-nowrap">{fmtDate(j.sent_at)}</td>
                    <td className="px-2.5 py-2">
                      {(j.status === "draft" || j.status === "scheduled") && (
                        <button onClick={() => cancel(j.id)} disabled={pending} className="text-[10px] px-1.5 py-0.5 rounded border border-red-800/40 text-red-400 hover:bg-red-950/30">取消</button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <div className="flex justify-end">
          <button onClick={onClose} className="px-3 py-2 text-xs text-slate-400 rounded-lg border border-slate-700 hover:text-slate-200">閉じる</button>
        </div>
      </div>
    </div>
  );
}

function fmtDate(d: string | null): string {
  if (!d) return "—";
  return new Date(d).toLocaleString("ja-JP", { month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" });
}

// Map a NewsInput back into GyeonNews-ish shape for optimistic list updates.
function normalize(d: NewsInput) {
  const clean = (v: string | null) => (v && v.trim() ? v.trim() : null);
  return {
    category: d.category, priority: d.priority, title: d.title.trim(),
    body: clean(d.body), image_url: clean(d.image_url), pdf_url: clean(d.pdf_url),
    youtube_url: clean(d.youtube_url), external_url: clean(d.external_url),
    status: d.status, publish_start_at: clean(d.publish_start_at), publish_end_at: clean(d.publish_end_at),
    summary: clean(d.summary), body_html: clean(d.body_html), body_text: clean(d.body_text),
    target_audience: d.target_audience, target_dealer_ids: d.target_dealer_ids, channels: d.channels,
    scheduled_at: clean(d.scheduled_at),
  };
}
