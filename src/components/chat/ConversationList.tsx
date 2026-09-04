import { UserAvatar } from "@/components/UserAvatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { formatChatListTime } from "@/lib/format";
import { Check, CheckCheck, MessageSquarePlus, Search, Users } from "lucide-react";
import { useMemo, useState } from "react";
import type { FunctionReturnType } from "convex/server";
import type { api } from "@/convex/_generated/api";

export type ConversationListItem = FunctionReturnType<typeof api.conversations.listConversations>[number];

function statusIcon(unread: number, mine: boolean, seen: boolean) {
  if (unread > 0) return null;
  if (!mine) return null;
  return seen ? (
    <CheckCheck className="size-3.5 shrink-0 text-brand" aria-label="Read" />
  ) : (
    <Check className="size-3.5 shrink-0 text-muted-foreground" aria-label="Delivered" />
  );
}

export function ConversationList({
  conversations,
  activeId,
  onSelect,
  onNewChat,
  onNewGroup,
  loading,
}: {
  conversations: ConversationListItem[] | undefined;
  activeId: string | null;
  onSelect: (id: string) => void;
  onNewChat: () => void;
  onNewGroup: () => void;
  loading: boolean;
}) {
  const [term, setTerm] = useState("");

  const filtered = useMemo(() => {
    if (!conversations) return [];
    const q = term.trim().toLowerCase();
    if (!q) return conversations;
    return conversations.filter(
      (c) =>
        c.title.toLowerCase().includes(q) ||
        (c.lastMessagePreview ?? "").toLowerCase().includes(q),
    );
  }, [conversations, term]);

  return (
    <div className="flex h-full flex-col">
      <div className="space-y-2 border-b p-3">
        <div className="flex items-center gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={term}
              onChange={(e) => setTerm(e.target.value)}
              placeholder="Search chats"
              className="pl-8"
              aria-label="Search conversations"
            />
          </div>
          <Button size="icon" variant="ghost" onClick={onNewGroup} aria-label="New group">
            <Users className="size-4" />
          </Button>
          <Button size="icon" onClick={onNewChat} aria-label="New chat">
            <MessageSquarePlus className="size-4" />
          </Button>
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto scrollbar-thin">
        {loading ? (
          <div className="space-y-2 p-3">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="h-14 animate-pulse rounded-lg bg-muted/60" />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center gap-2 px-6 py-12 text-center">
            <div className="flex size-11 items-center justify-center rounded-full bg-brand-soft text-brand-strong">
              <MessageSquarePlus className="size-5" />
            </div>
            <p className="text-sm font-medium">
              {term ? "No chats match your search" : "No conversations yet"}
            </p>
            <p className="text-xs text-muted-foreground">
              {term ? "Try a different search" : "Add a friend and say hello 👋"}
            </p>
          </div>
        ) : (
          <ul className="space-y-0.5 p-2">
            {filtered.map((c) => {
              const active = c._id === activeId;
              const typing = c.otherTypingAt && Date.now() - c.otherTypingAt < 6000;
              const preview = typing
                ? "typing…"
                : (c.lastMessageSenderId != null && c.lastMessagePreview) || c.lastMessagePreview;
              return (
                <li key={c._id}>
                  <button
                    type="button"
                    onClick={() => onSelect(c._id)}
                    className={cn(
                      "flex w-full items-center gap-3 rounded-xl px-2.5 py-2.5 text-left transition-colors",
                      active ? "bg-brand-soft" : "hover:bg-muted/70",
                    )}
                  >
                    <UserAvatar
                      name={c.kind === "group" ? c.title : c.others[0]?.name}
                      image={c.kind === "group" ? c.imageUrl : c.others[0]?.image}
                      size="md"
                      showPresence={c.kind === "direct"}
                      lastSeenAt={c.kind === "direct" ? c.others[0]?.lastSeenAt : null}
                    />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5">
                        <span className="truncate text-sm font-semibold">{c.title}</span>
                        {c.kind === "group" && (
                          <span className="text-[10px] text-muted-foreground">
                            {c.memberCount}
                          </span>
                        )}
                        <span className="ml-auto shrink-0 text-[11px] text-muted-foreground">
                          {formatChatListTime(c.lastMessageAt)}
                        </span>
                      </div>
                      <div className="mt-0.5 flex items-center gap-1.5">
                        <span
                          className={cn(
                            "truncate text-xs",
                            typing ? "text-brand" : "text-muted-foreground",
                          )}
                        >
                          {preview ?? "Say something…"}
                        </span>
                        <span className="ml-auto flex shrink-0 items-center gap-1">
                          {statusIcon(
                            c.unreadCount,
                            c.lastMessageSenderId != null,
                            false,
                          )}
                          {c.unreadCount > 0 && (
                            <span className="flex min-w-5 items-center justify-center rounded-full bg-brand px-1.5 text-[10px] font-bold text-brand-contrast">
                              {c.unreadCount > 99 ? "99+" : c.unreadCount}
                            </span>
                          )}
                          {c.muted && <span className="text-[10px] text-muted-foreground">🔇</span>}
                        </span>
                      </div>
                    </div>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
