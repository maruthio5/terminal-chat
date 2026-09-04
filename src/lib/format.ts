import { format, isToday, isYesterday, formatDistanceToNowStrict } from "date-fns";

export function formatMessageTime(ts: number) {
  return format(ts, "HH:mm");
}

export function formatChatListTime(ts: number) {
  if (isToday(ts)) return format(ts, "HH:mm");
  if (isYesterday(ts)) return "Yesterday";
  return format(ts, "MMM d");
}

export function formatDayDivider(ts: number) {
  if (isToday(ts)) return "Today";
  if (isYesterday(ts)) return "Yesterday";
  return format(ts, "EEEE, MMM d");
}

export function formatRelative(ts: number) {
  return `${formatDistanceToNowStrict(ts)} ago`;
}

export function formatCountdown(expiresAt: number) {
  const remaining = expiresAt - Date.now();
  if (remaining <= 0) return "gone";
  const minutes = Math.floor(remaining / 60_000);
  if (minutes < 60) return `${Math.max(minutes, 1)}m`;
  const hours = Math.floor(minutes / 60);
  return `${hours}h`;
}

export function initialsOf(name: string | null | undefined) {
  if (!name) return "?";
  const parts = name.trim().split(/\s+/).slice(0, 2);
  return parts.map((p) => p[0]?.toUpperCase() ?? "").join("") || "?";
}

export function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
