import { Bell, Check, BellOff, MessageSquare, Smile, UserPlus, Users } from "lucide-react";
import { cn } from "@/lib/utils";
import type { FunctionReturnType } from "convex/server";
import type { api } from "@/convex/_generated/api";

export type NotificationItem = FunctionReturnType<typeof api.notifications.list>[number];

const KIND_ICONS = {
  friend_request: UserPlus,
  friend_accepted: Check,
  message: MessageSquare,
  mention: Smile,
  story_reply: MessageSquare,
  system: Users,
} as const;

export function notificationIcon(kind: NotificationItem["kind"]) {
  return KIND_ICONS[kind] ?? Bell;
}

export function notificationIsMuted(kind: NotificationItem["kind"]) {
  return kind === "message";
}

export function NotificationRow({
  n,
  muted,
  unread,
  onClick,
}: {
  n: NotificationItem;
  muted?: boolean;
  unread: boolean;
  onClick?: () => void;
}) {
  const Icon = notificationIcon(n.kind);
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex w-full items-start gap-3 rounded-lg px-3 py-2.5 text-left transition-colors",
        unread ? "bg-brand-soft/70 hover:bg-brand-soft" : "hover:bg-muted/60",
        muted && "opacity-70",
      )}
    >
      <span
        className={cn(
          "mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-full",
          unread ? "bg-brand text-brand-contrast" : "bg-muted text-muted-foreground",
        )}
      >
        <Icon className="size-4" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-medium">{n.title}</span>
        {n.body && <span className="block truncate text-xs text-muted-foreground">{n.body}</span>}
      </span>
      {unread && <span className="mt-2 size-2 shrink-0 rounded-full bg-brand" />}
    </button>
  );
}

export { BellOff };
