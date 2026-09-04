import { ConversationList, type ConversationListItem } from "@/components/chat/ConversationList";
import { ChatHeaderMenu, type ConversationDetail } from "@/components/chat/ChatHeaderMenu";
import { MessageBubble, type MessageItem } from "@/components/chat/MessageBubble";
import { NewChatDialog } from "@/components/chat/NewChatDialog";
import { ReportDialog } from "@/components/ReportDialog";
import { UserAvatar } from "@/components/UserAvatar";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { useAuth } from "@/hooks/use-auth";
import { formatBytes, formatDayDivider, formatMessageTime } from "@/lib/format";
import { formatLastSeen } from "@/hooks/use-presence";
import { useLocalFirst } from "@/lib/store";
import { uploadMedia, imageDimensions } from "@/lib/upload";
import { cn } from "@/lib/utils";
import { useMutation, useQuery } from "convex/react";
import {
  ArrowDown,
  FileAudio,
  ImagePlus,
  Loader2,
  Mic,
  Paperclip,
  Send,
  Timer,
  X,
} from "lucide-react";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useSearchParams } from "react-router";
import { toast } from "sonner";

export default function MessagesPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const urlConversationId = searchParams.get("c");
  const { user: me } = useAuth();

  const conversations = useQuery(api.conversations.listConversations);
  const activeId = useMemo(() => {
    if (urlConversationId) return urlConversationId;
    const first = conversations?.[0];
    return first?._id ?? null;
  }, [urlConversationId, conversations]);

  const conversation = useQuery(
    api.conversations.getConversation,
    activeId ? { conversationId: activeId as Id<"conversations"> } : "skip",
  );
  const messageData = useQuery(
    api.messages.listMessages,
    activeId ? { conversationId: activeId as Id<"conversations"> } : "skip",
  );
  const myFriends = useQuery(api.friends.myFriends);

  const sendMessage = useMutation(api.messages.sendMessage);
  const editMessage = useMutation(api.messages.editMessage);
  const deleteMessage = useMutation(api.messages.deleteMessage);
  const toggleReaction = useMutation(api.messages.toggleReaction);
  const setTyping = useMutation(api.messages.setTyping);
  const markRead = useMutation(api.messages.markRead);
  const generateUploadUrl = useMutation(api.media.generateUploadUrl);
  const registerUpload = useMutation(api.media.registerUpload);

  const { drafts, setDraft, clearDraft, setOpenConversationId } = useLocalFirst();

  const [text, setText] = useState("");
  const [replyTo, setReplyTo] = useState<MessageItem | null>(null);
  const [editing, setEditing] = useState<MessageItem | null>(null);
  const [dialogMode, setDialogMode] = useState<"direct" | "group" | null>(null);
  const [sending, setSending] = useState(false);
  const [attachment, setAttachment] = useState<File | null>(null);
  const [recording, setRecording] = useState<MediaRecorder | null>(null);
  const [atBottom, setAtBottom] = useState(true);

  const scrollRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const typingTimer = useRef<number | null>(null);
  const lastTypingSent = useRef(0);

  const draft = (activeId && drafts[activeId]) || { text: "", replyToId: null };

  // keep URL in sync with the active conversation
  useEffect(() => {
    if (activeId && activeId !== urlConversationId) {
      setSearchParams((prev) => {
        const next = new URLSearchParams(prev);
        next.set("c", activeId);
        return next;
      }, { replace: true });
    }
  }, [activeId, urlConversationId, setSearchParams]);

  // load persisted draft when switching conversations
  useEffect(() => {
    setText(draft.text);
    setReplyTo(null);
    setEditing(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeId]);

  // track which conversation is open (drives notifications/read marking)
  useEffect(() => {
    setOpenConversationId(activeId);
    return () => setOpenConversationId(null);
  }, [activeId, setOpenConversationId]);

  // mark read when opening / receiving while open
  useEffect(() => {
    if (!activeId) return;
    const unread = conversations?.find((c) => c._id === activeId)?.unreadCount ?? 0;
    if (unread > 0 || conversation?.unreadCount) {
      void markRead({ conversationId: activeId as Id<"conversations"> }).catch(() => {});
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeId, conversations, conversation?.unreadCount]);

  const scrollToBottom = useCallback((behavior: ScrollBehavior = "smooth") => {
    bottomRef.current?.scrollIntoView({ behavior, block: "end" });
  }, []);

  useEffect(() => {
    if (atBottom) scrollToBottom(messageData ? "smooth" : "auto");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [messageData?.messages.length, activeId]);

  const handleScroll = () => {
    const el = scrollRef.current;
    if (!el) return;
    const nearBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 120;
    setAtBottom(nearBottom);
  };

  const updateDraft = (newText: string) => {
    setText(newText);
    if (activeId) setDraft(activeId, { text: newText });
  };

  const notifyTyping = () => {
    if (!activeId) return;
    const now = Date.now();
    if (now - lastTypingSent.current < 2500) return;
    lastTypingSent.current = now;
    void setTyping({ conversationId: activeId as Id<"conversations">, typing: true }).catch(() => {});
    if (typingTimer.current) window.clearTimeout(typingTimer.current);
    typingTimer.current = window.setTimeout(() => {
      void setTyping({ conversationId: activeId as Id<"conversations">, typing: false }).catch(() => {});
    }, 5000);
  };

  async function doSend(kind: "text" | "image" | "file" | "voice", file?: File, seconds?: number) {
    if (!activeId) return;
    const trimmed = kind === "text" ? text.trim() : text.trim() || undefined;
    if (kind === "text" && !trimmed) return;
    setSending(true);
    try {
      let mediaId: Id<"media"> | undefined;
      if (file) {
        const dims = kind === "image" ? await imageDimensions(file) : {};
        mediaId = (await uploadMedia(generateUploadUrl, registerUpload, file, {
          width: dims.width,
          height: dims.height,
          durationMs: seconds,
        })) as unknown as Id<"media">;
      }
      await sendMessage({
        conversationId: activeId as Id<"conversations">,
        kind,
        text: kind === "text" ? trimmed : trimmed?.slice(0, 200),
        mediaId,
        replyToId: (replyTo?._id as Id<"messages">) ?? undefined,
      });
      if (activeId) {
        clearDraft(activeId);
        setDraft(activeId, { replyToId: null });
      }
      setText("");
      setReplyTo(null);
      setAtBottom(true);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not send message");
    } finally {
      setSending(false);
    }
  }

  async function handleSendText() {
    if (editing) {
      const clean = text.trim();
      if (!clean) return;
      try {
        await editMessage({ messageId: editing._id as Id<"messages">, text: clean });
        setEditing(null);
        setText("");
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Could not edit message");
      }
      return;
    }
    await doSend("text");
  }

  async function handleAttachmentChosen(file: File) {
    const kind = file.type.startsWith("image/") ? "image" : "file";
    await doSend(kind, file);
  }

  async function startRecording() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const rec = new MediaRecorder(stream);
      const chunks: BlobPart[] = [];
      const startedAt = Date.now();
      rec.ondataavailable = (e) => chunks.push(e.data);
      rec.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop());
        const seconds = Math.round((Date.now() - startedAt) / 1000);
        const blob = new Blob(chunks, { type: rec.mimeType || "audio/webm" });
        const file = new File([blob], `voice-${Date.now()}.webm`, { type: blob.type });
        await doSend("voice", file, seconds);
      };
      rec.start();
      setRecording(rec);
    } catch {
      toast.error("Microphone access was denied");
    }
  }

  function stopRecording(send: boolean) {
    if (!recording) return;
    (recording as unknown as { _send?: boolean })._send = send;
    const origOnStop = recording.onstop;
    recording.onstop = async (e) => {
      if (!send) {
        // discard: replace handler before default logic runs
        (recording as unknown as { ondataavailable?: unknown }).ondataavailable = null;
      }
      await origOnStop?.call(recording, e as unknown as Event);
    };
    recording.stop();
    setRecording(null);
  }

  async function confirmSendAttachment() {
    if (!attachment) return;
    const file = attachment;
    setAttachment(null);
    await handleAttachmentChosen(file);
  }

  if (!conversations) {
    return (
      <div className="flex h-full items-center justify-center">
        <Loader2 className="size-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="flex h-full">
      {/* list pane */}
      <aside className="hidden w-full shrink-0 border-r md:block md:w-80 lg:w-96">
        <ConversationList
          conversations={conversations as ConversationListItem[]}
          activeId={activeId}
          onSelect={(id) => setSearchParams({ c: id })}
          onNewChat={() => setDialogMode("direct")}
          onNewGroup={() => setDialogMode("group")}
          loading={false}
        />
      </aside>

      {/* chat pane */}
      <section className="flex min-w-0 flex-1 flex-col">
        {!activeId || !conversation ? (
          <EmptyState onNewChat={() => setDialogMode("direct")} hasChats={conversations.length > 0} />
        ) : (
          <ChatView
            conversation={conversation as ConversationDetail}
            messageData={messageData ?? undefined}
            meId={me?._id ?? ""}
            myFriends={myFriends}
            text={text}
            setText={updateDraft}
            notifyTyping={notifyTyping}
            onSend={handleSendText}
            sending={sending}
            replyTo={replyTo}
            setReplyTo={setReplyTo}
            editing={editing}
            setEditing={(m) => {
              setEditing(m);
              if (m) setText(m.text ?? "");
            }}
            cancelEdit={() => {
              setEditing(null);
              setText("");
            }}
            onDelete={(m) =>
              deleteMessage({ messageId: m._id as Id<"messages"> }).catch((err) =>
                toast.error(err instanceof Error ? err.message : "Could not delete"),
              )
            }
            onToggleReaction={(m, emoji) =>
              toggleReaction({
                messageId: m._id as Id<"messages">,
                emoji,
              }).catch((err) => toast.error(err instanceof Error ? err.message : "Failed"))
            }
            onPickImage={() => fileInputRef.current?.click()}
            onPickFile={() => fileInputRef.current?.click()}
            recording={recording}
            startRecording={startRecording}
            stopRecording={stopRecording}
            atBottom={atBottom}
            onScroll={handleScroll}
            scrollRef={scrollRef}
            bottomRef={bottomRef}
            draftText={draft.text}
            draftReplyToId={draft.replyToId}
          />
        )}
      </section>

      <NewChatDialog
        open={dialogMode !== null}
        onOpenChange={(o) => !o && setDialogMode(null)}
        mode={dialogMode ?? "direct"}
      />

      <input
        ref={fileInputRef}
        type="file"
        className="hidden"
        accept="image/*,.pdf,.doc,.docx,.txt,.zip,audio/*"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) {
            if (f.size > 10 * 1024 * 1024) {
              toast.error("Files are limited to 10 MB");
            } else {
              setAttachment(f);
            }
          }
          e.target.value = "";
        }}
      />
      {attachment && (
        <AttachmentPreview
          file={attachment}
          onRemove={() => setAttachment(null)}
          onConfirm={confirmSendAttachment}
        />
      )}
    </div>
  );
}

function EmptyState({ onNewChat, hasChats }: { onNewChat: () => void; hasChats: boolean }) {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-3 p-8 text-center">
      <div className="flex size-14 items-center justify-center rounded-2xl bg-brand-soft text-brand-strong">
        <Send className="size-6" />
      </div>
      <p className="text-base font-semibold">
        {hasChats ? "Pick a conversation" : "Welcome to EchoLine"}
      </p>
      <p className="max-w-xs text-sm text-muted-foreground">
        {hasChats
          ? "Select a chat from the list to start messaging."
          : "Add a friend, start a direct chat, or create a group — your messages stay in sync everywhere."}
      </p>
      <Button onClick={onNewChat} className="mt-1">
        <Send className="mr-2 size-4" /> Start a chat
      </Button>
    </div>
  );
}

function ChatView(props: {
  conversation: ConversationDetail;
  messageData:
    | {
        messages: MessageItem[];
        myLastReadSeq: number;
        maxOtherReadSeq: number;
        hasMore: boolean;
        oldestSeq: number | null;
      }
    | null
    | undefined;
  meId: string;
  myFriends: { _id: string; name: string | null; image: string | null; username: string | null }[] | undefined;
  text: string;
  setText: (t: string) => void;
  notifyTyping: () => void;
  onSend: () => void;
  sending: boolean;
  replyTo: MessageItem | null;
  setReplyTo: (m: MessageItem | null) => void;
  editing: MessageItem | null;
  setEditing: (m: MessageItem | null) => void;
  cancelEdit: () => void;
  onDelete: (m: MessageItem) => void;
  onToggleReaction: (m: MessageItem, emoji: string) => void;
  onPickImage: () => void;
  onPickFile: () => void;
  recording: MediaRecorder | null;
  startRecording: () => void;
  stopRecording: (send: boolean) => void;
  atBottom: boolean;
  onScroll: () => void;
  scrollRef: React.RefObject<HTMLDivElement | null>;
  bottomRef: React.RefObject<HTMLDivElement | null>;
  draftText: string;
  draftReplyToId: string | null;
}) {
  const { conversation: c } = props;
  const isGroup = c.kind === "group";
  const other = c.others[0];

  // stable per-message sender info
  const nameById = useMemo(() => {
    const map = new Map<string, string>();
    for (const o of c.others) map.set(o._id, o.name ?? "Someone");
    return map;
  }, [c.others]);

  let prevSenderId: string | null = null;
  let prevDay = "";

  return (
    <div className="flex h-full min-w-0 flex-col">
      {/* header */}
      <header className="flex h-14 shrink-0 items-center gap-3 border-b px-3 sm:px-4">
        <UserAvatar
          name={isGroup ? c.title : other?.name}
          image={isGroup ? c.imageUrl : other?.image}
          size="sm"
          showPresence={!isGroup}
          lastSeenAt={!isGroup ? other?.lastSeenAt : null}
        />
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold">{c.title}</p>
          <p className="truncate text-xs text-muted-foreground">
            {c.otherTyping ? (
              <span className="flex items-center gap-1 text-brand">
                typing
                <span className="typing-dot ml-0.5 inline-block size-1 rounded-full bg-current" />
                <span className="typing-dot inline-block size-1 rounded-full bg-current" />
                <span className="typing-dot inline-block size-1 rounded-full bg-current" />
              </span>
            ) : isGroup ? (
              `${c.memberCount} members`
            ) : (
              formatLastSeen(other?.lastSeenAt)
            )}
          </p>
        </div>
        {c.disappearingSeconds ? (
          <span className="hidden items-center gap-1 rounded-full bg-destructive/10 px-2 py-1 text-[11px] font-medium text-destructive sm:flex">
            <Timer className="size-3" />
            {c.disappearingSeconds >= 86400
              ? `${c.disappearingSeconds / 86400}d`
              : `${c.disappearingSeconds / 3600}h`}{" "}
            timer
          </span>
        ) : null}
        <ReportDialog
          targetKind="conversation"
          targetId={c._id}
          label="Report conversation"
        />
        <ChatHeaderMenu conversation={c} myFriends={props.myFriends} />
      </header>

      {/* messages */}
      <div
        ref={props.scrollRef}
        onScroll={props.onScroll}
        className="min-h-0 flex-1 space-y-1 overflow-y-auto px-3 py-4 scrollbar-thin sm:px-6"
      >
        {props.messageData == null ? (
          <div className="flex h-full items-center justify-center">
            <Loader2 className="size-5 animate-spin text-muted-foreground" />
          </div>
        ) : props.messageData.messages.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center gap-2 text-center">
            <div className="flex size-12 items-center justify-center rounded-2xl bg-brand-soft text-brand-strong">
              <Send className="size-5" />
            </div>
            <p className="text-sm font-medium">No messages yet</p>
            <p className="text-xs text-muted-foreground">Break the ice — say hi! 👋</p>
          </div>
        ) : (
          props.messageData.messages.map((m) => {
            const day = formatDayDivider(m.createdAt);
            const showDivider = day !== prevDay;
            if (showDivider) prevDay = day;
            const showAvatar = isGroup && m.senderId !== prevSenderId;
            const senderName = m.mine ? "You" : (nameById.get(m.senderId) ?? "Someone");
            prevSenderId = m.senderId;

            return (
              <div key={m._id}>
                {showDivider && (
                  <div className="my-3 flex items-center gap-3">
                    <span className="h-px flex-1 bg-border" />
                    <span className="text-[11px] font-medium text-muted-foreground">{day}</span>
                    <span className="h-px flex-1 bg-border" />
                  </div>
                )}
                <MessageBubble
                  m={m}
                  showAvatar={showAvatar}
                  senderName={senderName}
                  senderImage={null}
                  onReply={props.setReplyTo}
                  onEdit={props.setEditing}
                  onDelete={props.onDelete}
                  onToggleReaction={props.onToggleReaction}
                  canModerate={isGroup && c.myRole !== "member"}
                />
              </div>
            );
          })
        )}
        <div ref={props.bottomRef} className="h-px" />
      </div>

      {!props.atBottom && (
        <button
          type="button"
          onClick={() => props.bottomRef.current?.scrollIntoView({ behavior: "smooth" })}
          className="absolute bottom-24 right-6 z-10 flex size-9 items-center justify-center rounded-full border bg-background shadow-md transition-colors hover:bg-muted"
          aria-label="Scroll to latest"
        >
          <ArrowDown className="size-4" />
        </button>
      )}

      {/* composer */}
      <footer className="shrink-0 border-t bg-background/80 px-3 py-2.5 sm:px-4">
        {props.editing && (
          <div className="mb-1.5 flex items-center gap-2 rounded-lg bg-muted px-3 py-1.5 text-xs">
            <span className="font-medium text-brand">Editing message</span>
            <span className="min-w-0 flex-1 truncate text-muted-foreground">
              {props.editing.text}
            </span>
            <button type="button" onClick={props.cancelEdit} aria-label="Cancel edit">
              <X className="size-3.5" />
            </button>
          </div>
        )}
        {(props.replyTo || props.draftReplyToId) && !props.editing && (
          <div className="mb-1.5 flex items-center gap-2 rounded-lg bg-muted px-3 py-1.5 text-xs">
            <span className="font-medium text-brand">Replying to</span>
            <span className="min-w-0 flex-1 truncate text-muted-foreground">
              {props.replyTo?.replyTo?.preview ??
                props.replyTo?.text ??
                props.draftReplyToId}
            </span>
            <button
              type="button"
              onClick={() => props.setReplyTo(null)}
              aria-label="Cancel reply"
            >
              <X className="size-3.5" />
            </button>
          </div>
        )}

        <div className="flex items-end gap-1.5">
          <input type="hidden" />
          <Button
            variant="ghost"
            size="icon"
            className="size-9 shrink-0"
            onClick={props.onPickImage}
            aria-label="Send image"
          >
            <ImagePlus className="size-4.5" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="size-9 shrink-0"
            aria-label="Send file"
            onClick={props.onPickFile}
          >
            <Paperclip className="size-4" />
          </Button>
          {props.recording ? (
            <>
              <span className="flex h-9 flex-1 items-center gap-2 rounded-lg bg-destructive/10 px-3 text-sm text-destructive">
                <span className="size-2 animate-pulse rounded-full bg-destructive" />
                Recording… tap send or discard
              </span>
              <Button
                variant="ghost"
                size="icon"
                className="size-9 shrink-0"
                onClick={() => props.stopRecording(false)}
                aria-label="Discard recording"
              >
                <X className="size-4" />
              </Button>
              <Button
                size="icon"
                className="size-9 shrink-0"
                onClick={() => props.stopRecording(true)}
                aria-label="Send recording"
              >
                <Send className="size-4" />
              </Button>
            </>
          ) : (
            <>
              <Textarea
                value={props.text}
                onChange={(e) => {
                  props.setText(e.target.value);
                  props.notifyTyping();
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    void props.onSend();
                  }
                }}
                placeholder="Write a message…"
                rows={1}
                className="max-h-32 min-h-9 flex-1 resize-none py-2"
                aria-label="Message"
              />
              {props.text.trim() ? (
                <Button
                  size="icon"
                  className="size-9 shrink-0"
                  onClick={props.onSend}
                  disabled={props.sending}
                  aria-label="Send"
                >
                  {props.sending ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : (
                    <Send className="size-4" />
                  )}
                </Button>
              ) : (
                <Button
                  size="icon"
                  variant="secondary"
                  className="size-9 shrink-0"
                  onClick={props.startRecording}
                  aria-label="Record voice message"
                >
                  <Mic className="size-4" />
                </Button>
              )}
            </>
          )}
        </div>
      </footer>
    </div>
  );
}

function AttachmentPreview({
  file,
  onRemove,
  onConfirm,
}: {
  file: File;
  onRemove: () => void;
  onConfirm: () => void;
}) {
  const isImage = file.type.startsWith("image/");
  return (
    <Dialog open onOpenChange={(o) => !o && onRemove()}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Send attachment</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          {isImage ? (
            <img
              src={URL.createObjectURL(file)}
              alt={file.name}
              className="max-h-64 w-full rounded-xl object-contain"
            />
          ) : (
            <div className="flex items-center gap-3 rounded-xl border p-3">
              <FileAudio className="size-5 text-muted-foreground" />
              <div className="min-w-0">
                <p className="truncate text-sm font-medium">{file.name}</p>
                <p className="text-xs text-muted-foreground">{formatBytes(file.size)}</p>
              </div>
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onRemove}>
            Cancel
          </Button>
          <Button onClick={onConfirm}>
            <Send className="mr-2 size-4" /> Send
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
