// GYEON News Center — shared types & display metadata.
// Pure module (no DB / no "use server"). Safe for client or server import.

import type { NewsAudience, NewsChannels } from "./distribution-types";

export type NewsCategory =
  | "announcement"
  | "new_product"
  | "stock_arrival"
  | "backorder"
  | "event"
  | "training"
  | "technical"
  | "system";

export type NewsPriority = "normal" | "important" | "urgent";

export type NewsStatus = "draft" | "published" | "archived";

export interface GyeonNews {
  id:               string;
  category:         NewsCategory;
  priority:         NewsPriority;
  title:            string;
  body:             string | null;
  image_url:        string | null;
  pdf_url:          string | null;
  youtube_url:      string | null;
  external_url:     string | null;
  status:           NewsStatus;
  publish_start_at: string | null;
  publish_end_at:   string | null;
  created_by:       string | null;
  created_at:       string;
  updated_at:       string;
  // PHASE89: distribution fields (present after migration 089)
  summary?:           string | null;
  body_html?:         string | null;
  body_text?:         string | null;
  target_audience?:   NewsAudience;
  target_dealer_ids?: string[] | null;
  channels?:          NewsChannels;
  scheduled_at?:      string | null;
}

/** News as seen by a dealer, enriched with this user's read state. */
export interface DealerNews extends GyeonNews {
  is_read: boolean;
}

export const NEWS_CATEGORIES: NewsCategory[] = [
  "announcement", "new_product", "stock_arrival", "backorder",
  "event", "training", "technical", "system",
];

export const NEWS_CATEGORY_LABEL: Record<NewsCategory, string> = {
  announcement: "お知らせ",
  new_product:  "新製品",
  stock_arrival:"入荷",
  backorder:    "入荷待ち",
  event:        "イベント",
  training:     "研修",
  technical:    "技術情報",
  system:       "システム",
};

export const NEWS_CATEGORY_ICON: Record<NewsCategory, string> = {
  announcement: "📢",
  new_product:  "✨",
  stock_arrival:"📦",
  backorder:    "⏳",
  event:        "🎉",
  training:     "🎓",
  technical:    "🔧",
  system:       "⚙️",
};

export const NEWS_PRIORITIES: NewsPriority[] = ["normal", "important", "urgent"];

export const NEWS_PRIORITY_LABEL: Record<NewsPriority, string> = {
  normal:    "通常",
  important: "重要",
  urgent:    "緊急",
};

/** Badge/border styling per priority (dark-luxury palette). */
export const NEWS_PRIORITY_STYLE: Record<NewsPriority, { badge: string; border: string }> = {
  normal: {
    badge:  "bg-slate-800 text-slate-400 border-slate-700",
    border: "border-slate-800",
  },
  important: {
    badge:  "bg-amber-950/40 text-amber-300 border-amber-700/40",
    border: "border-amber-700/30",
  },
  urgent: {
    badge:  "bg-red-950/50 text-red-300 border-red-600/50",
    border: "border-red-600/50",
  },
};

/** Extract a YouTube video id from common URL shapes (watch / youtu.be / embed). */
export function youtubeId(url: string | null): string | null {
  if (!url) return null;
  const m = url.match(
    /(?:youtube\.com\/(?:watch\?v=|embed\/)|youtu\.be\/)([A-Za-z0-9_-]{11})/,
  );
  return m ? m[1] : null;
}
