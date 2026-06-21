export type NotificationType = "info" | "success" | "warning" | "error" | "reminder";

export interface NotificationDB {
  id:          string;
  dealer_id:   string;
  user_id:     string | null;
  type:        NotificationType;
  title:       string;
  message:     string | null;
  entity_type: string | null;
  entity_id:   string | null;
  customer_id: string | null;
  is_read:     boolean;
  read_at:     string | null;
  created_at:  string;
}

export function notificationTypeIcon(type: NotificationType): string {
  switch (type) {
    case "info":     return "ℹ";
    case "success":  return "✓";
    case "warning":  return "⚠";
    case "error":    return "✕";
    case "reminder": return "◷";
  }
}

export function notificationTypeColor(type: NotificationType): string {
  switch (type) {
    case "info":     return "text-blue-400";
    case "success":  return "text-green-400";
    case "warning":  return "text-amber-400";
    case "error":    return "text-red-400";
    case "reminder": return "text-purple-400";
  }
}
