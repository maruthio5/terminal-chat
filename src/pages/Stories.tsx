import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Progress } from "@/components/ui/progress";
import { Textarea } from "@/components/ui/textarea";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import type { FunctionReturnType } from "convex/server";
import { useAuth } from "@/hooks/use-auth";
import { formatCountdown, formatRelative, initialsOf } from "@/lib/format";
import { uploadMedia } from "@/lib/upload";
import { useMutation, useQuery } from "convex/react";
import { ChevronLeft, ChevronRight, Eye, Plus, Send, Trash2, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";

type StoryGroup = FunctionReturnType<typeof api.stories.feed>[number];
type StoryItem = StoryGroup["stories"][number];

const BACKGROUNDS = ["aurora", "sunset", "ocean", "orchid", "ember"] as const;
type Background = (typeof BACKGROUNDS)[number];

export default function StoriesPage() {
  const { user: me } = useAuth();
  const feed = useQuery(api.stories.feed);

  const [creating, setCreating] = useState(false);
  const [viewing, setViewing] = useState<StoryGroup | null>(null);

  const createStory = useMutation(api.stories.create);
  const removeStory = useMutation(api.stories.remove);

  async function handleCreated() {
    setCreating(false);
    toast.success("Story published — it disappears in 24h");
  }

  return (
    <div className="mx-auto flex h-full w-full max-w-3xl flex-col px-4 py-4">
      <header className="mb-4 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold tracking-tight">Stories</h1>
          <p className="text-sm text-muted-foreground">
            Share moments that vanish after 24 hours.
          </p>
        </div>
        <Button onClick={() => setCreating(true)}>
          <Plus className="mr-2 size-4" /> New story
        </Button>
      </header>

      {feed === undefined ? (
        <div className="flex flex-1 items-center justify-center">
          <div className="size-6 animate-spin rounded-full border-2 border-brand border-t-transparent" />
        </div>
      ) : feed.length === 0 ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-2 text-center">
          <div className="story-ring relative flex size-16 items-center justify-center rounded-full p-1">
            <span className="flex size-full items-center justify-center rounded-full bg-brand-soft text-xl font-black text-brand-strong">
              {initialsOf(me?.name)}
            </span>
          </div>
          <p className="text-sm font-semibold">No stories yet</p>
          <p className="max-w-xs text-sm text-muted-foreground">
            Create the first one — text with a gradient background or a photo.
          </p>
        </div>
      ) : (
        <div className="flex flex-wrap gap-4 overflow-y-auto pb-6 scrollbar-thin">
          {feed.map((g) => {
            const unseen = g.stories.some((s) => !s.viewedByMe);
            return (
              <button
                key={g.author._id}
                type="button"
                className="group flex w-20 flex-col items-center gap-1.5"
                onClick={() => setViewing(g)}
              >
                <span
                  className={
                    "story-ring relative flex size-16 items-center justify-center rounded-full p-[3px]" +
                    (unseen ? "" : " opacity-50")
                  }
                >
                  <span className="flex size-full items-center justify-center overflow-hidden rounded-full border-2 border-background bg-brand-soft">
                    {g.author.image ? (
                      <img src={g.author.image} alt={g.author.name ?? "story"} className="size-full object-cover" />
                    ) : (
                      <span className="text-lg font-black text-brand-strong">
                        {initialsOf(g.author.name)}
                      </span>
                    )}
                  </span>
                </span>
                <span className="w-full truncate text-center text-xs font-medium">
                  {g.isMe ? "Your story" : (g.author.name ?? "Anonymous")}
                </span>
              </button>
            );
          })}
        </div>
      )}

      <CreateStoryDialog
        open={creating}
        onClose={() => setCreating(false)}
        onCreated={handleCreated}
        onCreate={createStory}
      />

      {viewing && (
        <StoryViewer
          group={viewing}
          onClose={() => setViewing(null)}
          onRemove={removeStory}
        />
      )}
    </div>
  );
}

function CreateStoryDialog({
  open,
  onClose,
  onCreated,
  onCreate,
}: {
  open: boolean;
  onClose: () => void;
  onCreated: () => void;
  onCreate: ReturnType<typeof useMutation<typeof api.stories.create>>;
}) {
  const [mode, setMode] = useState<"text" | "image">("text");
  const [text, setText] = useState("");
  const [background, setBackground] = useState<Background>("aurora");
  const [busy, setBusy] = useState(false);

  async function publishText() {
    setBusy(true);
    try {
      await onCreate({ kind: "text", text, background });
      onCreated();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not publish story");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>New story</DialogTitle>
          <DialogDescription>Visible to friends for 24 hours.</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-2">
            <Button
              type="button"
              variant={mode === "text" ? "default" : "outline"}
              onClick={() => setMode("text")}
            >
              Text
            </Button>
            <Button
              type="button"
              variant={mode === "image" ? "default" : "outline"}
              disabled
              title="Photo stories coming soon"
            >
              Photo
            </Button>
          </div>
          <Textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="What's happening?"
            maxLength={280}
            rows={3}
          />
          <div className="flex gap-2">
            {BACKGROUNDS.map((b) => (
              <button
                key={b}
                type="button"
                aria-label={`Background ${b}`}
                onClick={() => setBackground(b)}
                className={`story-${b} size-8 rounded-lg border-2 transition-transform hover:scale-105 ${
                  background === b ? "border-brand" : "border-transparent"
                }`}
              />
            ))}
          </div>
          <p className="text-xs text-muted-foreground">{text.length}/280</p>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={busy}>
            Cancel
          </Button>
          <Button onClick={publishText} disabled={busy || !text.trim()}>
            {busy ? "Publishing…" : "Publish"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function StoryViewer({
  group,
  onClose,
  onRemove,
}: {
  group: StoryGroup;
  onClose: () => void;
  onRemove: ReturnType<typeof useMutation<typeof api.stories.remove>>;
}) {
  const [index, setIndex] = useState(0);
  const [replyText, setReplyText] = useState("");
  const recordView = useMutation(api.stories.recordView);
  const replyToStory = useMutation(api.stories.replyToStory);
  const viewers = useQuery(
    api.stories.viewers,
    group.isMe && group.stories[index] ? { storyId: group.stories[index]._id as Id<"stories"> } : "skip",
  );

  const current = group.stories[index];

  useEffect(() => {
    if (current && !group.isMe) {
      void recordView({ storyId: current._id as Id<"stories"> }).catch(() => {});
    }
  }, [current?._id, group.isMe, recordView, current]);

  const next = () => (index < group.stories.length - 1 ? setIndex(index + 1) : onClose());
  const prev = () => (index > 0 ? setIndex(index - 1) : undefined);

  async function sendReply() {
    if (!current || !replyText.trim()) return;
    try {
      await replyToStory({ storyId: current._id as Id<"stories">, text: replyText.trim() });
      setReplyText("");
      toast.success("Reply sent 💬");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not send reply");
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-black/90 backdrop-blur-sm">
      {/* progress bars */}
      <div className="flex gap-1 px-3 pt-3">
        {group.stories.map((s, i) => (
          <Progress key={s._id} value={i <= index ? 100 : 0} className="h-1 bg-white/25" />
        ))}
      </div>

      <div className="flex items-center gap-3 px-4 py-3 text-white">
        {group.author.image ? (
          <img src={group.author.image} alt="" className="size-8 rounded-full object-cover" />
        ) : (
          <span className="flex size-8 items-center justify-center rounded-full bg-white/20 text-xs font-bold">
            {initialsOf(group.author.name)}
          </span>
        )}
        <div className="flex-1">
          <p className="text-sm font-semibold">{group.isMe ? "Your story" : group.author.name}</p>
          {current && (
            <p className="text-xs text-white/70">
              {formatRelative(current.createdAt)} · {formatCountdown(current.expiresAt)} left
            </p>
          )}
        </div>
        {group.isMe && current && (
          <Button
            variant="ghost"
            size="icon"
            className="text-white hover:bg-white/15"
            onClick={async () => {
              try {
                await onRemove({ storyId: current._id as Id<"stories"> });
                toast.success("Story deleted");
                onClose();
              } catch (err) {
                toast.error(err instanceof Error ? err.message : "Could not delete");
              }
            }}
            aria-label="Delete story"
          >
            <Trash2 className="size-4" />
          </Button>
        )}
        <Button
          variant="ghost"
          size="icon"
          className="text-white hover:bg-white/15"
          onClick={onClose}
          aria-label="Close viewer"
        >
          <X className="size-5" />
        </Button>
      </div>

      {/* content */}
      <div className="relative flex min-h-0 flex-1 items-center justify-center px-4">
        <button
          type="button"
          className="absolute inset-y-0 left-0 w-1/3"
          onClick={prev}
          aria-label="Previous"
        />
        <button
          type="button"
          className="absolute inset-y-0 right-0 w-1/3"
          onClick={next}
          aria-label="Next"
        />
        {current ? (
          current.kind === "text" ? (
            <div className={`story-${current.background ?? "aurora"} flex aspect-[9/16] max-h-full w-full max-w-sm items-center justify-center rounded-2xl p-6`}>
              <p className="text-center text-2xl font-bold text-white drop-shadow">
                {current.text}
              </p>
            </div>
          ) : (
            <img
              src={current.mediaId ? `/api/media/${current.mediaId}` : undefined}
              alt="story"
              className="max-h-full max-w-full rounded-2xl object-contain"
            />
          )
        ) : null}

        {index > 0 && (
          <ChevronLeft className="pointer-events-none absolute left-2 top-1/2 size-6 text-white/60" />
        )}
        {index < group.stories.length - 1 && (
          <ChevronRight className="pointer-events-none absolute right-2 top-1/2 size-6 text-white/60" />
        )}
      </div>

      {/* footer: viewers or reply */}
      <div className="px-4 pb-6 pt-3">
        {group.isMe ? (
          <div className="mx-auto max-w-sm rounded-xl bg-white/10 p-3 text-white">
            <p className="mb-1 flex items-center gap-1.5 text-sm font-semibold">
              <Eye className="size-4" />
              {viewers ? `${viewers.length} view${viewers.length === 1 ? "" : "s"}` : "…"}
            </p>
            {viewers && viewers.length > 0 && (
              <ul className="space-y-1">
                {viewers.slice(0, 5).map((v) => (
                  <li key={v._id} className="flex items-center gap-2 text-xs">
                    <span className="flex size-5 items-center justify-center rounded-full bg-white/20 font-bold">
                      {initialsOf(v.name)}
                    </span>
                    {v.name ?? "Someone"}
                    <span className="ml-auto text-white/60">{formatRelative(v.viewedAt)}</span>
                  </li>
                ))}
                {viewers.length > 5 && (
                  <li className="text-xs text-white/60">and {viewers.length - 5} more…</li>
                )}
              </ul>
            )}
          </div>
        ) : (
          <div className="mx-auto flex max-w-sm items-center gap-2">
            <input
              value={replyText}
              onChange={(e) => setReplyText(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && sendReply()}
              placeholder="Reply to story…"
              className="flex-1 rounded-full border border-white/25 bg-white/10 px-4 py-2 text-sm text-white placeholder:text-white/50 focus:outline-none focus:ring-2 focus:ring-white/40"
            />
            <Button
              size="icon"
              className="rounded-full"
              onClick={sendReply}
              disabled={!replyText.trim()}
              aria-label="Send reply"
            >
              <Send className="size-4" />
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
