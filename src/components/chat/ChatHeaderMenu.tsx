import { UserAvatar } from "@/components/UserAvatar";
import type { FunctionReturnType } from "convex/server";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { useMutation, useQuery } from "convex/react";
import {
  BellOff,
  BellRing,
  DoorOpen,
  Plus,
  Search,
  Timer,
  UserPlus,
} from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";

export type ConversationDetail = NonNullable<
  FunctionReturnType<typeof api.conversations.getConversation>
>;

type Friend = {
  _id: string;
  name: string | null;
  image: string | null;
  username: string | null;
};

const DISAPPEARING_OPTIONS = [
  { value: 0, label: "Off" },
  { value: 3600, label: "1 hour" },
  { value: 86400, label: "24 hours" },
  { value: 604800, label: "1 week" },
] as const;

export function ChatHeaderMenu({
  conversation,
  myFriends,
}: {
  conversation: ConversationDetail;
  myFriends: Friend[] | undefined;
}) {
  const [addOpen, setAddOpen] = useState(false);
  const [addTerm, setAddTerm] = useState("");
  const [muted, setMutedState] = useState(conversation.muted);

  const setMuted = useMutation(api.conversations.setMuted);
  const updateGroup = useMutation(api.conversations.updateGroup);
  const addMembers = useMutation(api.conversations.addMembers);
  const leaveGroup = useMutation(api.conversations.leaveGroup);

  const isGroup = conversation.kind === "group";
  const canManage = isGroup && conversation.myRole !== "member";

  const addable = useMemo(() => {
    if (!myFriends) return [];
    const memberIds = new Set<string>(conversation.others.map((o) => o._id));
    const q = addTerm.trim().toLowerCase();
    return myFriends
      .filter((f) => !memberIds.has(f._id))
      .filter((f) => !q || (f.name ?? "").toLowerCase().includes(q) || (f.username ?? "").includes(q));
  }, [myFriends, conversation.others, addTerm]);

  async function handleAddMember(id: Id<"users">) {
    try {
      await addMembers({ conversationId: conversation._id, memberIds: [id] });
      toast.success("Member added");
      setAddTerm("");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not add member");
    }
  }

  async function handleToggleMute(next: boolean) {
    setMutedState(next);
    try {
      await setMuted({ conversationId: conversation._id, muted: next });
    } catch {
      setMutedState(!next);
      toast.error("Could not update notifications");
    }
  }

  async function handleDisappearing(seconds: number) {
    try {
      await updateGroup({
        conversationId: conversation._id,
        disappearingSeconds: seconds,
      });
      toast.success(
        seconds === 0 ? "Disappearing messages off" : `Messages disappear after ${DISAPPEARING_OPTIONS.find((o) => o.value === seconds)?.label}`,
      );
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not update timer");
    }
  }

  async function handleLeave() {
    try {
      await leaveGroup({ conversationId: conversation._id });
      toast.success("You left the group");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not leave group");
    }
  }

  const other = conversation.others[0];

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="size-8" aria-label="Conversation options">
          <svg className="size-4" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
            <circle cx="12" cy="5" r="1.6" />
            <circle cx="12" cy="12" r="1.6" />
            <circle cx="12" cy="19" r="1.6" />
          </svg>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-64">
        <DropdownMenuLabel className="font-normal">
          <div className="flex items-center gap-2.5">
            <UserAvatar
              name={isGroup ? conversation.title : other?.name}
              image={isGroup ? conversation.imageUrl : other?.image}
              size="sm"
            />
            <div className="min-w-0">
              <p className="truncate text-sm font-medium">
                {isGroup ? conversation.title : (other?.name ?? "Direct message")}
              </p>
              <p className="text-xs text-muted-foreground">
                {isGroup
                  ? `${conversation.memberCount} members`
                  : (other?.username ? `@${other.username}` : "")}
              </p>
            </div>
          </div>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />

        <div className="flex items-center justify-between px-2 py-1.5 text-sm">
          <span className="flex items-center gap-2">
            {muted ? <BellOff className="size-4" /> : <BellRing className="size-4" />}
            Notifications
          </span>
          <Switch checked={muted} onCheckedChange={handleToggleMute} aria-label="Mute notifications" />
        </div>

        {isGroup && canManage && (
          <>
            <DropdownMenuItem onSelect={(e) => { e.preventDefault(); setAddOpen(true); }}>
              <UserPlus className="mr-2 size-4" /> Add members
            </DropdownMenuItem>
            <div className="flex items-center justify-between gap-2 px-2 py-1.5 text-sm">
              <span className="flex items-center gap-2">
                <Timer className="size-4" /> Disappearing
              </span>
              <select
                className="rounded-md border bg-background px-1.5 py-0.5 text-xs"
                value={conversation.disappearingSeconds ?? 0}
                onChange={(e) => handleDisappearing(Number(e.target.value))}
                aria-label="Disappearing message timer"
              >
                {DISAPPEARING_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </div>
          </>
        )}

        <DropdownMenuSeparator />
        <DropdownMenuItem
          className="text-destructive focus:text-destructive"
          onSelect={(e) => {
            e.preventDefault();
            handleLeave();
          }}
        >
          <DoorOpen className="mr-2 size-4" />
          {isGroup ? "Leave group" : "Close chat"}
        </DropdownMenuItem>
      </DropdownMenuContent>

      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Add members</DialogTitle>
            <DialogDescription>Pick friends to add to {conversation.title}.</DialogDescription>
          </DialogHeader>
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={addTerm}
              onChange={(e) => setAddTerm(e.target.value)}
              placeholder="Search friends"
              className="pl-8"
            />
          </div>
          <div className="max-h-56 space-y-1 overflow-y-auto">
            {addable.length === 0 ? (
              <p className="py-4 text-center text-sm text-muted-foreground">
                All your friends are already here
              </p>
            ) : (
              addable.map((f) => (
                <button
                  key={f._id}
                  type="button"
                  onClick={() => handleAddMember(f._id as unknown as Id<"users">)}
                  className="flex w-full items-center gap-2.5 rounded-lg px-2 py-1.5 text-left hover:bg-muted"
                >
                  <UserAvatar name={f.name} image={f.image} size="sm" />
                  <span className="min-w-0 flex-1 truncate text-sm">{f.name ?? f.username}</span>
                  <Plus className="size-4 text-muted-foreground" />
                </button>
              ))
            )}
          </div>
        </DialogContent>
      </Dialog>
    </DropdownMenu>
  );
}
