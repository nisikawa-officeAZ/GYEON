"use client";

import { useState, useTransition, useEffect, useRef } from "react";
import {
  WorkOrderFileDB,
  WorkOrderFilePhase,
  WorkOrderFileType,
  workOrderFilePhaseLabel,
  WORK_ORDER_FILE_PHASES,
  isPhoto,
  isVideo,
} from "@/lib/work-order-files/work-order-file-types";
import { getWorkOrderFiles }    from "@/lib/work-order-files/get-work-order-files";
import { uploadWorkOrderFile }  from "@/lib/work-order-files/upload-work-order-file";
import { deleteWorkOrderFile }  from "@/lib/work-order-files/delete-work-order-file";
import { updateWorkOrderFile }  from "@/lib/work-order-files/update-work-order-file";

// ─── Sub-components ───────────────────────────────────────────────────────────

function formatFileSize(bytes: number | null): string {
  if (!bytes) return "";
  if (bytes < 1024)        return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

// ─── File card ────────────────────────────────────────────────────────────────

interface FileCardProps {
  file:     WorkOrderFileDB;
  onDelete: (id: string) => void;
  onUpdate: (id: string, fd: FormData) => void;
  pending:  boolean;
}

function FileCard({ file, onDelete, onUpdate, pending }: FileCardProps) {
  const [editing,     setEditing]     = useState(false);
  const [editTitle,   setEditTitle]   = useState(file.title ?? "");
  const [editDesc,    setEditDesc]    = useState(file.description ?? "");
  const [editPhase,   setEditPhase]   = useState<WorkOrderFilePhase>(file.phase);
  const [confirmDel,  setConfirmDel]  = useState(false);

  function handleSave() {
    const fd = new FormData();
    fd.set("phase",       editPhase);
    fd.set("title",       editTitle);
    fd.set("description", editDesc);
    onUpdate(file.id, fd);
    setEditing(false);
  }

  return (
    <div className="bg-[#0f172a] border border-slate-700 rounded-lg overflow-hidden">
      {/* Preview */}
      {isPhoto(file.mime_type, file.file_name) && file.file_url ? (
        <a href={file.file_url} target="_blank" rel="noopener noreferrer">
          <img
            src={file.file_url}
            alt={file.title ?? file.file_name ?? ""}
            className="w-full h-28 object-cover"
          />
        </a>
      ) : isVideo(file.mime_type, file.file_name) && file.file_url ? (
        <a href={file.file_url} target="_blank" rel="noopener noreferrer">
          <div className="w-full h-28 flex flex-col items-center justify-center bg-slate-800/50 gap-1">
            <span className="text-2xl text-slate-400">🎥</span>
            <span className="text-[9px] text-slate-500">動画を開く</span>
          </div>
        </a>
      ) : (
        <div className="w-full h-28 flex items-center justify-center bg-slate-800/50">
          <span className="text-2xl text-slate-600">
            {file.file_type === "document" ? "📄" : "📎"}
          </span>
        </div>
      )}

      {/* Info */}
      <div className="p-2">
        {editing ? (
          <div className="flex flex-col gap-1.5">
            {/* Phase selector */}
            <select
              value={editPhase}
              onChange={(e) => setEditPhase(e.target.value as WorkOrderFilePhase)}
              className="bg-[#1e293b] border border-slate-700 rounded px-2 py-1 text-[11px] text-slate-300 focus:outline-none focus:border-[#1d4ed8]"
            >
              {WORK_ORDER_FILE_PHASES.map((p) => (
                <option key={p} value={p}>{workOrderFilePhaseLabel(p)}</option>
              ))}
            </select>
            <input
              type="text"
              value={editTitle}
              onChange={(e) => setEditTitle(e.target.value)}
              placeholder="タイトル"
              className="bg-[#1e293b] border border-slate-700 rounded px-2 py-1 text-xs text-slate-100 placeholder-slate-600 focus:outline-none focus:border-[#1d4ed8]"
            />
            <input
              type="text"
              value={editDesc}
              onChange={(e) => setEditDesc(e.target.value)}
              placeholder="説明"
              className="bg-[#1e293b] border border-slate-700 rounded px-2 py-1 text-xs text-slate-400 placeholder-slate-600 focus:outline-none focus:border-[#1d4ed8]"
            />
            <div className="flex gap-1">
              <button
                onClick={handleSave}
                disabled={pending}
                className="flex-1 text-[11px] bg-[#1d4ed8] hover:bg-[#1e40af] text-white rounded px-2 py-1 transition-colors disabled:opacity-50"
              >
                保存
              </button>
              <button
                onClick={() => setEditing(false)}
                className="flex-1 text-[11px] text-slate-400 hover:text-slate-100 hover:bg-slate-700 rounded px-2 py-1 transition-colors"
              >
                キャンセル
              </button>
            </div>
          </div>
        ) : (
          <>
            <p className="text-xs text-slate-200 truncate font-medium">
              {file.title ?? file.file_name ?? "—"}
            </p>
            {file.description && (
              <p className="text-[10px] text-slate-500 truncate mt-0.5">{file.description}</p>
            )}
            {file.file_size && (
              <p className="text-[10px] text-slate-600 mt-0.5">{formatFileSize(file.file_size)}</p>
            )}
            <div className="flex gap-1 mt-1.5">
              <button
                onClick={() => setEditing(true)}
                className="flex-1 text-[10px] text-slate-400 hover:text-slate-100 hover:bg-slate-700 rounded px-1.5 py-1 transition-colors"
              >
                編集
              </button>
              {confirmDel ? (
                <>
                  <button
                    onClick={() => onDelete(file.id)}
                    disabled={pending}
                    className="flex-1 text-[10px] bg-red-600 hover:bg-red-700 text-white rounded px-1.5 py-1 transition-colors disabled:opacity-50"
                  >
                    削除確認
                  </button>
                  <button
                    onClick={() => setConfirmDel(false)}
                    className="text-[10px] text-slate-500 hover:text-slate-300 rounded px-1.5 py-1 transition-colors"
                  >
                    ✕
                  </button>
                </>
              ) : (
                <button
                  onClick={() => setConfirmDel(true)}
                  className="flex-1 text-[10px] text-slate-500 hover:text-red-400 hover:bg-slate-700 rounded px-1.5 py-1 transition-colors"
                >
                  削除
                </button>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// ─── Upload area ──────────────────────────────────────────────────────────────

interface UploadAreaProps {
  workOrderId:   string;
  activePhase:   WorkOrderFilePhase;
  onUploadDone:  () => void;
}

function UploadArea({ workOrderId, activePhase, onUploadDone }: UploadAreaProps) {
  const [pending,    startTransition] = useTransition();
  const [error,      setError]        = useState<string | null>(null);
  const [dragOver,   setDragOver]     = useState(false);
  const [uploadPhase, setUploadPhase] = useState<WorkOrderFilePhase>(activePhase);
  const [fileType,   setFileType]     = useState<WorkOrderFileType>("photo");
  const inputRef = useRef<HTMLInputElement>(null);

  // Sync phase when tab changes
  useEffect(() => { setUploadPhase(activePhase); }, [activePhase]);

  async function handleFiles(files: FileList | null) {
    if (!files || files.length === 0) return;
    setError(null);

    for (const file of Array.from(files)) {
      const fd = new FormData();
      fd.set("work_order_id", workOrderId);
      fd.set("file",          file);
      fd.set("phase",         uploadPhase);
      fd.set("file_type",     fileType);

      await new Promise<void>((resolve) => {
        startTransition(async () => {
          const result = await uploadWorkOrderFile(fd);
          if (result?.error) setError(result.error);
          resolve();
        });
      });
    }

    onUploadDone();
  }

  return (
    <div className="flex flex-col gap-2">
      {/* Phase & Type selectors */}
      <div className="flex gap-2">
        <select
          value={uploadPhase}
          onChange={(e) => setUploadPhase(e.target.value as WorkOrderFilePhase)}
          className="bg-[#0f172a] border border-slate-700 rounded px-2 py-1.5 text-xs text-slate-300 focus:outline-none focus:border-[#1d4ed8]"
        >
          {WORK_ORDER_FILE_PHASES.map((p) => (
            <option key={p} value={p}>{workOrderFilePhaseLabel(p)}</option>
          ))}
        </select>
        <select
          value={fileType}
          onChange={(e) => setFileType(e.target.value as WorkOrderFileType)}
          className="bg-[#0f172a] border border-slate-700 rounded px-2 py-1.5 text-xs text-slate-300 focus:outline-none focus:border-[#1d4ed8]"
        >
          <option value="photo">写真</option>
          <option value="document">書類</option>
          <option value="video">動画</option>
          <option value="other">その他</option>
        </select>
      </div>

      {/* Drop zone */}
      <div
        onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragOver(false);
          handleFiles(e.dataTransfer.files);
        }}
        onClick={() => inputRef.current?.click()}
        className={`border-2 border-dashed rounded-lg px-4 py-6 text-center cursor-pointer transition-colors ${
          dragOver
            ? "border-[#1d4ed8] bg-[#1d4ed8]/10"
            : "border-slate-700 hover:border-slate-500"
        } ${pending ? "opacity-50 pointer-events-none" : ""}`}
      >
        <p className="text-xs text-slate-400">
          {pending ? "アップロード中..." : "クリックまたはドラッグ&ドロップ"}
        </p>
        <p className="text-[10px] text-slate-600 mt-1">JPEG, PNG, PDF, MP4 / 最大20MB</p>
      </div>

      <input
        ref={inputRef}
        type="file"
        multiple
        accept="image/*,application/pdf,video/mp4,video/quicktime"
        className="hidden"
        onChange={(e) => handleFiles(e.target.files)}
      />

      {error && (
        <p className="text-xs text-red-400 bg-red-900/20 border border-red-800 rounded px-3 py-2">
          {error}
        </p>
      )}
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

interface WorkOrderFilesProps {
  workOrderId: string;
}

export default function WorkOrderFiles({ workOrderId }: WorkOrderFilesProps) {
  const [files,       setFiles]       = useState<WorkOrderFileDB[]>([]);
  const [loading,     setLoading]     = useState(true);
  const [activePhase, setActivePhase] = useState<WorkOrderFilePhase>("before");
  const [pending,     startTransition] = useTransition();

  function refresh() {
    setLoading(true);
    getWorkOrderFiles(workOrderId).then((data) => {
      setFiles(data);
      setLoading(false);
    });
  }

  // Initial load
  useEffect(() => { refresh(); }, [workOrderId]); // eslint-disable-line react-hooks/exhaustive-deps

  function handleDelete(id: string) {
    startTransition(async () => {
      await deleteWorkOrderFile(id);
      refresh();
    });
  }

  function handleUpdate(id: string, fd: FormData) {
    startTransition(async () => {
      await updateWorkOrderFile(id, fd);
      refresh();
    });
  }

  // Files for the active phase tab
  const phaseFiles = files.filter((f) => f.phase === activePhase);

  // Phase counts for tabs
  const phaseCounts = WORK_ORDER_FILE_PHASES.reduce<Record<string, number>>((acc, p) => {
    acc[p] = files.filter((f) => f.phase === p).length;
    return acc;
  }, {});

  return (
    <div className="flex flex-col gap-4">

      {/* Phase tabs */}
      <div className="flex gap-1 flex-wrap">
        {WORK_ORDER_FILE_PHASES.map((phase) => (
          <button
            key={phase}
            onClick={() => setActivePhase(phase)}
            className={`text-xs px-3 py-1.5 rounded-lg font-medium transition-colors ${
              activePhase === phase
                ? "bg-[#1d4ed8] text-white"
                : "bg-slate-800 text-slate-400 hover:text-slate-100 hover:bg-slate-700"
            }`}
          >
            {workOrderFilePhaseLabel(phase)}
            {phaseCounts[phase] > 0 && (
              <span className="ml-1.5 text-[10px] opacity-80">({phaseCounts[phase]})</span>
            )}
          </button>
        ))}
      </div>

      {/* Upload area */}
      <UploadArea
        workOrderId={workOrderId}
        activePhase={activePhase}
        onUploadDone={refresh}
      />

      {/* File grid */}
      {loading ? (
        <p className="text-xs text-slate-500 py-4 text-center">読み込み中...</p>
      ) : phaseFiles.length === 0 ? (
        <p className="text-xs text-slate-600 py-4 text-center">
          {workOrderFilePhaseLabel(activePhase)}のファイルはありません。
        </p>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
          {phaseFiles.map((file) => (
            <FileCard
              key={file.id}
              file={file}
              onDelete={handleDelete}
              onUpdate={handleUpdate}
              pending={pending}
            />
          ))}
        </div>
      )}

      {/* Total count */}
      {files.length > 0 && (
        <p className="text-[10px] text-slate-600 text-right">
          合計 {files.length} ファイル
        </p>
      )}
    </div>
  );
}
