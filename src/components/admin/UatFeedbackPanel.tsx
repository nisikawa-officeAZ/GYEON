"use client";

// PHASE63: UAT feedback panel.

import { useState, useTransition } from "react";
import {
  UatFeedback,
  UatFeedbackStatus,
  UatSession,
  uatFeedbackStatusLabel,
  uatFeedbackStatusColor,
  uatSessionStatusLabel,
  UAT_FEEDBACK_CATEGORIES,
} from "@/lib/uat/uat-types";
import {
  createFeedback,
  updateFeedback,
  createSession,
  completeSession,
} from "@/lib/uat/uat";

interface Props {
  dealerId:  string;
  sessions:  UatSession[];
  feedback:  UatFeedback[];
  onRefresh: () => void;
}

const FEEDBACK_STATUS_OPTIONS: UatFeedbackStatus[] = [
  "open", "accepted", "planned", "rejected", "implemented",
];

function FeedbackRow({
  item,
  onRefresh,
}: {
  item: UatFeedback;
  onRefresh: () => void;
}) {
  const [status,    setStatus]    = useState<UatFeedbackStatus>(item.status);
  const [isPending, startTrans]   = useTransition();
  const [saved,     setSaved]     = useState(false);

  const handleSave = () => {
    startTrans(async () => {
      const result = await updateFeedback(item.id, status);
      if (result.success) { setSaved(true); onRefresh(); }
    });
  };

  const stars = item.rating ? "★".repeat(item.rating) + "☆".repeat(5 - item.rating) : "—";

  return (
    <div className="px-4 py-3 border-b border-slate-800/50 last:border-0">
      <div className="flex items-start gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1 flex-wrap">
            {item.category && (
              <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-800 text-slate-400 border border-slate-700">
                {item.category}
              </span>
            )}
            <span className="text-[10px] text-amber-400">{stars}</span>
            <span className={`text-[10px] px-1.5 py-0.5 rounded border ${uatFeedbackStatusColor(item.status)}`}>
              {uatFeedbackStatusLabel(item.status)}
            </span>
          </div>
          <p className="text-xs font-medium text-slate-200">{item.title}</p>
          {item.description && (
            <p className="text-[10px] text-slate-500 mt-0.5">{item.description}</p>
          )}
          <p className="text-[10px] text-slate-600 mt-1">{item.created_at.slice(0, 10)}</p>
        </div>

        {/* Status update */}
        <div className="flex items-center gap-1.5 shrink-0">
          <select
            value={status}
            onChange={e => { setStatus(e.target.value as UatFeedbackStatus); setSaved(false); }}
            className="text-[10px] bg-slate-800 border border-slate-700 rounded px-2 py-1 text-slate-200"
          >
            {FEEDBACK_STATUS_OPTIONS.map(s => (
              <option key={s} value={s}>{uatFeedbackStatusLabel(s)}</option>
            ))}
          </select>
          <button
            onClick={handleSave}
            disabled={isPending}
            className="text-[10px] px-2 py-1 rounded bg-blue-700 hover:bg-blue-600 text-white disabled:opacity-40 transition-colors"
          >
            {isPending ? "..." : "保存"}
          </button>
          {saved && <span className="text-[10px] text-green-400">✓</span>}
        </div>
      </div>
    </div>
  );
}

export default function UatFeedbackPanel({ dealerId, sessions, feedback, onRefresh }: Props) {
  const [isPending,   startTrans]   = useTransition();
  const [showForm,    setShowForm]  = useState(false);
  const [showSession, setShowSess]  = useState(false);
  const [sessionId,   setSessionId] = useState(sessions[0]?.id ?? "");
  const [category,    setCategory]  = useState("");
  const [rating,      setRating]    = useState(3);
  const [title,       setTitle]     = useState("");
  const [description, setDesc]      = useState("");
  const [formError,   setFormError] = useState<string | null>(null);
  const [sessSummary, setSessSumm]  = useState("");

  const activeSession  = sessions.find(s => s.status === "active");
  const targetSession  = sessionId || activeSession?.id;

  const handleCreateSession = () => {
    startTrans(async () => {
      const result = await createSession(dealerId);
      if (result.success) { setShowSess(false); onRefresh(); }
    });
  };

  const handleCompleteSession = () => {
    if (!activeSession) return;
    startTrans(async () => {
      const result = await completeSession(activeSession.id, dealerId, sessSummary);
      if (result.success) { setSessSumm(""); onRefresh(); }
    });
  };

  const handleAddFeedback = () => {
    if (!title.trim() || !targetSession) return;
    setFormError(null);
    startTrans(async () => {
      const result = await createFeedback({
        sessionId:   targetSession,
        category,
        rating,
        title,
        description,
      });
      if (!result.success) {
        setFormError(result.error ?? "Failed");
      } else {
        setTitle(""); setDesc(""); setRating(3); setCategory("");
        setShowForm(false);
        onRefresh();
      }
    });
  };

  return (
    <div className="flex flex-col gap-4">
      {/* Sessions */}
      <div className="flex flex-wrap items-center gap-2">
        <p className="text-[10px] text-slate-500 font-semibold uppercase tracking-wider">Sessions</p>
        {sessions.map(s => (
          <button
            key={s.id}
            onClick={() => setSessionId(s.id)}
            className={`text-[10px] px-2 py-1 rounded border transition-colors ${
              sessionId === s.id
                ? "bg-blue-700 text-white border-blue-600"
                : "bg-slate-800 text-slate-400 border-slate-700 hover:bg-slate-700"
            }`}
          >
            {uatSessionStatusLabel(s.status)} {s.started_at.slice(0, 10)}
          </button>
        ))}

        {/* Start new session */}
        {!activeSession && (
          <button
            onClick={() => setShowSess(s => !s)}
            className="text-[10px] px-2 py-1 rounded border border-slate-600 text-slate-400 hover:bg-slate-800"
          >
            + セッション開始
          </button>
        )}

        {/* Complete active session */}
        {activeSession && (
          <div className="flex items-center gap-1.5">
            <input
              type="text"
              placeholder="セッションサマリー..."
              value={sessSummary}
              onChange={e => setSessSumm(e.target.value)}
              className="text-[10px] bg-slate-800 border border-slate-700 rounded px-2 py-1 text-slate-200 placeholder:text-slate-600 w-40"
            />
            <button
              onClick={handleCompleteSession}
              disabled={isPending}
              className="text-[10px] px-2 py-1 rounded bg-green-800 hover:bg-green-700 text-white disabled:opacity-40"
            >
              完了
            </button>
          </div>
        )}

        {showSession && (
          <button
            onClick={handleCreateSession}
            disabled={isPending}
            className="text-[10px] px-2 py-1 rounded bg-blue-700 text-white disabled:opacity-40"
          >
            {isPending ? "作成中..." : "作成確定"}
          </button>
        )}
      </div>

      {/* Add feedback */}
      <div className="flex items-center justify-between">
        <p className="text-[10px] text-slate-500">
          {feedback.length} feedback items
        </p>
        <button
          onClick={() => setShowForm(s => !s)}
          disabled={!targetSession}
          className="text-[10px] px-2.5 py-1.5 rounded bg-slate-700 hover:bg-slate-600 text-slate-200 disabled:opacity-40 transition-colors"
        >
          フィードバック追加
        </button>
      </div>

      {showForm && (
        <div className="p-3 rounded-lg border border-slate-700 bg-slate-900/40 flex flex-col gap-2">
          <div className="flex gap-2">
            <div className="flex-1">
              <label className="block text-[10px] text-slate-500 mb-1">カテゴリ</label>
              <select
                value={category}
                onChange={e => setCategory(e.target.value)}
                className="w-full text-[10px] bg-slate-800 border border-slate-700 rounded px-2 py-1.5 text-slate-200"
              >
                <option value="">— 選択 —</option>
                {UAT_FEEDBACK_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-[10px] text-slate-500 mb-1">評価</label>
              <select
                value={rating}
                onChange={e => setRating(Number(e.target.value))}
                className="text-[10px] bg-slate-800 border border-slate-700 rounded px-2 py-1.5 text-slate-200"
              >
                {[1,2,3,4,5].map(n => <option key={n} value={n}>{n}★</option>)}
              </select>
            </div>
          </div>
          <input
            type="text"
            placeholder="タイトル *"
            value={title}
            onChange={e => setTitle(e.target.value)}
            className="text-[10px] bg-slate-800 border border-slate-700 rounded px-2 py-1.5 text-slate-200 placeholder:text-slate-600"
          />
          <textarea
            rows={2}
            placeholder="詳細説明..."
            value={description}
            onChange={e => setDesc(e.target.value)}
            className="text-[10px] bg-slate-800 border border-slate-700 rounded px-2 py-1.5 text-slate-200 placeholder:text-slate-600 resize-none"
          />
          {formError && <p className="text-[10px] text-red-400">{formError}</p>}
          <div className="flex gap-2 justify-end">
            <button onClick={() => setShowForm(false)} className="text-[10px] px-2 py-1 rounded border border-slate-600 text-slate-400">キャンセル</button>
            <button
              onClick={handleAddFeedback}
              disabled={!title.trim() || isPending}
              className="text-[10px] px-2 py-1 rounded bg-blue-700 hover:bg-blue-600 text-white disabled:opacity-40"
            >
              {isPending ? "..." : "追加"}
            </button>
          </div>
        </div>
      )}

      {/* Feedback list */}
      <div className="rounded-xl border border-slate-800 overflow-hidden">
        {feedback.length === 0 ? (
          <p className="text-[10px] text-slate-600 text-center py-4">フィードバックはまだ登録されていません</p>
        ) : (
          feedback
            .filter(f => !targetSession || f.session_id === targetSession)
            .map(f => <FeedbackRow key={f.id} item={f} onRefresh={onRefresh} />)
        )}
      </div>
    </div>
  );
}
