// GYEON Resource Center — shared types & display metadata.
// Pure module (no DB / no "use server"). Safe for client or server import.

export const RESOURCE_BUCKET = "gyeon-resources";

export type ResourceCategory =
  | "product_photo"
  | "product_png"
  | "gyeon_logo"
  | "gyeon_japan_logo"
  | "catalog"
  | "sds"
  | "tds"
  | "install_manual"
  | "pop"
  | "poster"
  | "sns"
  | "video";

export type ResourceStatus = "draft" | "published" | "archived";

export interface GyeonResource {
  id:           string;
  category:     ResourceCategory;
  title:        string;
  description:  string | null;
  file_path:    string | null;
  file_name:    string | null;
  file_type:    string | null;
  file_size:    number | null;
  youtube_url:  string | null;
  external_url: string | null;
  product_id:   string | null;
  version:      string | null;
  status:       ResourceStatus;
  created_by:   string | null;
  created_at:   string;
  updated_at:   string;
}

export const RESOURCE_CATEGORIES: ResourceCategory[] = [
  "product_photo", "product_png", "gyeon_logo", "gyeon_japan_logo",
  "catalog", "sds", "tds", "install_manual", "pop", "poster", "sns", "video",
];

export const RESOURCE_CATEGORY_LABEL: Record<ResourceCategory, string> = {
  product_photo:    "製品写真",
  product_png:      "透過PNG製品画像",
  gyeon_logo:       "GYEONロゴ",
  gyeon_japan_logo: "GYEON Japanロゴ",
  catalog:          "カタログ",
  sds:              "SDS",
  tds:              "TDS",
  install_manual:   "施工マニュアル",
  pop:              "POP",
  poster:           "ポスター",
  sns:              "SNS素材",
  video:            "動画 / YouTube",
};

export const RESOURCE_CATEGORY_ICON: Record<ResourceCategory, string> = {
  product_photo:    "📷",
  product_png:      "🖼️",
  gyeon_logo:       "🅖",
  gyeon_japan_logo: "🇯🇵",
  catalog:          "📖",
  sds:              "🧪",
  tds:              "📄",
  install_manual:   "🔧",
  pop:              "🪧",
  poster:           "🖨️",
  sns:              "📱",
  video:            "🎬",
};

export function formatFileSize(bytes: number | null): string {
  if (!bytes || bytes <= 0) return "";
  const units = ["B", "KB", "MB", "GB"];
  let i = 0;
  let n = bytes;
  while (n >= 1024 && i < units.length - 1) { n /= 1024; i++; }
  return `${n.toFixed(n < 10 && i > 0 ? 1 : 0)} ${units[i]}`;
}
