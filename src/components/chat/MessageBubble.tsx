import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { Check, CheckCheck, Clock, Pencil, SmilePlus, Trash2 } from "lucide-react";
import { useState } from "react";
import type { FunctionReturnType } from "convex/server";
import type { api } from "@/convex/_generated/api";

type ListMessagesResult = FunctionReturnType<typeof api.messages.listMessages>;
export type MessageItem = NonNullable<ListMessagesResult>["messages"][number];

const QUICK_REACTIONS = ["👍", "❤️", "😂", "😮", "😢", "🙏"];

export function MessageBubble({
  m,
  showAvatar,
  senderName,
  senderImage,
  onReply,
  onEdit,
  onDelete,
  onToggleReaction,
  canModerate,
}: {
  m: MessageItem;
  showAvatar: boolean;
  senderName: string;
  senderImage: string | null | undefined;
  onReply: (m: MessageItem) => void;
  onEdit: (m: MessageItem) => void;
  onDelete: (m: MessageItem) => void;
  onToggleReaction: (m: MessageItem, emoji: string) => void;
  canModerate: boolean;
}) {
  const [pickerOpen, setPickerOpen] = useState(false);
  const mine = m.mine;
  const deleted = Boolean(m.deletedAt);

  // aggregate reactions by emoji
  const reactionGroups = new Map<string, number>();
  for (const r of m.reactions) {
    reactionGroups.set(r.emoji, (reactionGroups.get(r.emoji) ?? 0) + 1);
  }
  const myReactions = new Set(
    m.reactions.filter((r: { userId: string; emoji: string }) => r.userId && r.emoji).map((r) => r.emoji),
  );

  const readByOthers = !deleted && m.seq > 0; // replaced below by receipt logic in parent render

  return (
    <div
      className={cn("group flex w-full gap-2", mine ? "flex-row-reverse" : "flex-row")}
      data-message-id={m._id}
    >
      <div className="w-8 shrink-0">
        {showAvatar && !mine && (
          <span className="block">
            <span className="sr-only">{senderName}</span>
          </span>
        )}
      </div>

      <div className={cn("flex max-w-[78%] flex-col", mine ? "items-end" : "items-start")}>
        {showAvatar && !mine && (
          <span className="mb-0.5 px-1 text-[11px] font-medium text-muted-foreground">
            {senderName}
          </span>
        )}

        <div className={cn("flex items-end gap-1", mine ? "flex-row" : "flex-row-reverse")}>
          {/* hover actions */}
          <div className="mb-1 flex items-center gap-0.5 opacity-0 transition-opacity group-hover:opacity-100 focus-within:opacity-100">
            <Popover open={pickerOpen} onOpenChange={setPickerOpen}>
              <PopoverTrigger asChild>
                <Button variant="ghost" size="icon" className="size-7" aria-label="React">
                  <SmilePlus className="size-3.5" />
                </Button>
              </PopoverTrigger>
              <PopoverContent side="top" className="w-auto p-1.5">
                <div className="flex gap-0.5">
                  {QUICK_REACTIONS.map((emoji) => (
                    <button
                      key={emoji}
                      type="button"
                      className="rounded-lg p-1.5 text-lg transition-transform hover:scale-125 hover:bg-muted"
                      onClick={() => {
                        onToggleReaction(m, emoji);
                        setPickerOpen(false);
                      }}
                    >
                      {emoji}
                    </button>
                  ))}
                </div>
              </PopoverContent>
            </Popover>
            <Button
              variant="ghost"
              size="icon"
              className="size-7"
              aria-label="Reply"
              onClick={() => onReply(m)}
            >
              <ReplyIcon />
            </Button>
            {mine && m.kind === "text" && !deleted && (
              <Button
                variant="ghost"
                size="icon"
                className="size-7"
                aria-label="Edit"
                onClick={() => onEdit(m)}
              >
                <Pencil className="size-3.5" />
              </Button>
            )}
            {(mine || canModerate) && !deleted && (
              <Button
                variant="ghost"
                size="icon"
                className="size-7 text-destructive"
                aria-label="Delete"
                onClick={() => onDelete(m)}
              >
                <Trash2 className="size-3.5" />
              </Button>
            )}
          </div>

          {/* bubble */}
          <div
            className={cn(
              "rounded-2xl px-3.5 py-2 text-sm shadow-sm",
              deleted
                ? "border border-dashed border-border bg-transparent italic text-muted-foreground"
                : mine
                  ? "bg-brand text-brand-contrast rounded-br-md"
                  : "bg-muted rounded-bl-md",
              m.expiresAt && !deleted && "ring-1 ring-destructive/40",
            )}
          >
            {m.replyTo && !deleted && (
              <div
                className={cn(
                  "mb-1.5 rounded-lg border-l-2 px-2 py-1 text-xs",
                  mine ? "border-brand-contrast/50 bg-brand-contrast/10" : "border-brand bg-background/60",
                )}
              >
                <p className="font-semibold">{m.replyTo.senderName}</p>
                <p className="truncate opacity-80">{m.replyTo.preview}</p>
              </div>
            )}

            {deleted ? (
              <span className="flex items-center gap-1.5">
                <Trash2 className="size-3.5" />
                Message deleted
              </span>
            ) : m.kind === "image" && m.media ? (
              <a href={m.media.url} target="_blank" rel="noopener noreferrer" className="block">
                <img
                  src={m.media.url}
                  alt={m.media.name}
                  className="max-h-64 rounded-xl object-cover"
                  loading="lazy"
                />
              </a>
            ) : m.kind === "voice" && m.media ? (
              <audio controls src={m.media.url} className="h-8 max-w-56" />
            ) : m.kind === "file" && m.media ? (
              <a
                href={m.media.url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 underline-offset-2 hover:underline"
              >
                📎 <span className="max-w-44 truncate">{m.media.name}</span>
              </a>
            ) : (
              <p className="whitespace-pre-wrap break-words">{m.text}</p>
            )}

            {m.expiresAt && !deleted && (
              <span className="mt-1 flex items-center gap-1 text-[10px] opacity-70">
                <Clock className="size-3" />
                disappears
              </span>
            )}
          </div>
        </div>

        {/* reactions + meta */}
        <div
          className={cn(
            "mt-1 flex flex-wrap items-center gap-1 px-1",
            mine ? "justify-end" : "justify-start",
          )}
        >
          {[...reactionGroups.entries()].map(([emoji, count]) => (
            <button
              key={emoji}
              type="button"
              onClick={() => onToggleReaction(m, emoji)}
              className={cn(
                "flex items-center gap-0.5 rounded-full border bg-background px-1.5 py-0.5 text-xs shadow-sm transition-transform hover:scale-105",
                myReactions.has(emoji) && "border-brand",
              )}
            >
              <span>{emoji}</span>
              {count > 1 && <span className="text-[10px] font-semibold">{count}</span>}
            </button>
          ))}
          <span className="flex items-center gap-1 text-[10px] text-muted-foreground">
            {m.editedAt && <span>(edited)</span>}
            {m.mine &&
              (readByOthers ? (
                <CheckCheck className="size-3 text-brand" aria-label="Read" />
              ) : (
                <Check className="size-3" aria-label="Delivered" />
              ))}
          </span>
        </div>
      </div>
    </div>
  );
}

function ReplyIcon() {
  return (
    <svg
      className="size-3.5"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <polyline points="9 17 4 12 9 7" />
      <path d="M20 18v-2a4 4 0 0 0-4-4H4" />
    </svg>
  );
}
