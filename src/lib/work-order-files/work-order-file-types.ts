// DealerOS — Work Order File Types (PHASE40)
// Column names match the Supabase work_order_files table exactly (snake_case).

export type WorkOrderFileType = 'photo' | 'document' | 'video' | 'other';

export type WorkOrderFilePhase =
  | 'before'
  | 'during'
  | 'after'
  | 'damage'
  | 'delivery'
  | 'other';

export interface WorkOrderFileDB {
  id:            string;
  dealer_id:     string;
  work_order_id: string;
  file_type:     WorkOrderFileType;
  phase:         WorkOrderFilePhase;
  title:         string | null;
  description:   string | null;
  file_name:     string | null;
  file_path:     string;
  file_url:      string | null;
  mime_type:     string | null;
  file_size:     number | null;
  sort_order:    number;
  is_public:     boolean;
  created_at:    string;
  updated_at:    string;
}

// Fields for INSERT — dealer_id and file_path are always server-set
export type WorkOrderFileInput = {
  dealer_id:     string;   // server-injected
  work_order_id: string;
  file_type:     WorkOrderFileType;
  phase:         WorkOrderFilePhase;
  title:         string | null;
  description:   string | null;
  file_name:     string | null;
  file_path:     string;   // storage path — server-generated
  file_url:      string | null;
  mime_type:     string | null;
  file_size:     number | null;
  sort_order:    number;
  is_public:     boolean;
};

// Fields allowed for UPDATE (phase/title/description/sort_order/is_public only)
export type WorkOrderFileUpdateInput = {
  phase?:       WorkOrderFilePhase;
  title?:       string | null;
  description?: string | null;
  sort_order?:  number;
  is_public?:   boolean;
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

const FILE_TYPE_LABELS: Record<WorkOrderFileType, string> = {
  photo:    '写真',
  document: '書類',
  video:    '動画',
  other:    'その他',
};

const PHASE_LABELS: Record<WorkOrderFilePhase, string> = {
  before:   '施工前',
  during:   '施工中',
  after:    '施工後',
  damage:   '傷・状態',
  delivery: '納車',
  other:    'その他',
};

export function workOrderFileTypeLabel(type: WorkOrderFileType | string): string {
  return FILE_TYPE_LABELS[type as WorkOrderFileType] ?? type;
}

export function workOrderFilePhaseLabel(phase: WorkOrderFilePhase | string): string {
  return PHASE_LABELS[phase as WorkOrderFilePhase] ?? phase;
}

// Generates the storage path for a file.
// Convention: {dealer_id}/{work_order_id}/{phase}/{uuid}_{sanitized_file_name}
export function workOrderFileStoragePath(
  dealerId:     string,
  workOrderId:  string,
  phase:        WorkOrderFilePhase,
  fileName:     string,
  uniquePrefix: string,
): string {
  // Sanitize: remove path traversal chars, keep extension
  const safe = fileName.replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 100);
  return `${dealerId}/${workOrderId}/${phase}/${uniquePrefix}_${safe}`;
}

// All phases in display order
export const WORK_ORDER_FILE_PHASES: WorkOrderFilePhase[] = [
  'before', 'during', 'after', 'damage', 'delivery', 'other',
];

// ─── Media type helpers ───────────────────────────────────────────────────────

/**
 * Returns true when the file is a photo.
 * Checks MIME type first; falls back to file extension.
 * HEIC/HEIF included for iPhone photos.
 */
export function isPhoto(mimeType: string | null, fileName: string | null): boolean {
  if (mimeType?.startsWith("image/")) return true;
  const ext = (fileName ?? "").split(".").pop()?.toLowerCase() ?? "";
  return ["jpg", "jpeg", "png", "gif", "webp", "heic", "heif"].includes(ext);
}

/**
 * Returns true when the file is a video.
 * Checks MIME type first; falls back to file extension.
 */
export function isVideo(mimeType: string | null, fileName: string | null): boolean {
  if (mimeType?.startsWith("video/")) return true;
  const ext = (fileName ?? "").split(".").pop()?.toLowerCase() ?? "";
  return ["mp4", "mov", "avi", "webm", "m4v", "3gp"].includes(ext);
}

/**
 * Returns true when the file is any media asset (photo or video).
 * Use this to distinguish media from documents and other file types.
 */
export function isMedia(mimeType: string | null, fileName: string | null): boolean {
  return isPhoto(mimeType, fileName) || isVideo(mimeType, fileName);
}
