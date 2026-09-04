import { UserAvatar } from "@/components/UserAvatar";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import type { FunctionReturnType } from "convex/server";
import { useMutation, useQuery } from "convex/react";
import { MessageSquare, Search, Users } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router";
import { toast } from "sonner";

type Friend = FunctionReturnType<typeof api.friends.myFriends>[number];
type SearchResult = FunctionReturnType<typeof api.users.searchUsers>[number];

type PickableUser = {
  _id: string;
  name: string | null;
  image: string | null;
  username: string | null;
};

/** Dialog for starting a direct chat or creating a group from friends + user search. */
export function NewChatDialog({
  open,
  onOpenChange,
  mode,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mode: "direct" | "group";
}) {
  const navigate = useNavigate();
  const [term, setTerm] = useState("");
  const [selected, setSelected] = useState<string[]>([]);
  const [groupName, setGroupName] = useState("");
  const [busy, setBusy] = useState(false);

  const friends = useQuery(api.friends.myFriends, open ? {} : "skip");
  const search = useQuery(
    api.users.searchUsers,
    open && term.trim().length >= 2 ? { term } : "skip",
  );
  const openDirect = useMutation(api.conversations.openDirectWith);
  const createGroup = useMutation(api.conversations.createGroup);

  useEffect(() => {
    if (!open) {
      setTerm("");
      setSelected([]);
      setGroupName("");
    }
  }, [open]);

  const people = useMemo(() => {
    const map = new Map<string, PickableUser>();
    for (const f of (friends ?? []) as Friend[]) map.set(f._id, f);
    for (const u of (search ?? []) as SearchResult[]) map.set(u._id, u);
    const q = term.trim().toLowerCase();
    const list = [...map.values()];
    if (!q) return list;
    return list.filter(
      (p) =>
        (p.name ?? "").toLowerCase().includes(q) || (p.username ?? "").includes(q),
    );
  }, [friends, search, term]);

  const toggle = (id: string) => {
    if (mode === "direct") {
      setSelected([id]);
    } else {
      setSelected((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
    }
  };

  async function confirm() {
    setBusy(true);
    try {
      if (mode === "direct") {
        const conversationId = await openDirect({ userId: selected[0] as Id<"users"> });
        navigate(`/app?c=${conversationId}`);
        onOpenChange(false);
      } else {
        const conversationId = await createGroup({
          title: groupName.trim(),
          memberIds: selected as Id<"users">[],
        });
        navigate(`/app?c=${conversationId}`);
        onOpenChange(false);
        toast.success(`Group “${groupName.trim()}” created`);
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setBusy(false);
    }
  }

  const canConfirm =
    mode === "direct" ? selected.length === 1 : selected.length >= 1 && groupName.trim().length >= 1;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {mode === "direct" ? <MessageSquare className="size-4" /> : <Users className="size-4" />}
            {mode === "direct" ? "New chat" : "New group"}
          </DialogTitle>
          <DialogDescription>
            {mode === "direct"
              ? "Pick a friend to start chatting."
              : "Name your group and pick at least one friend."}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          {mode === "group" && (
            <Input
              value={groupName}
              onChange={(e) => setGroupName(e.target.value)}
              placeholder="Group name"
              maxLength={60}
            />
          )}
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={term}
              onChange={(e) => setTerm(e.target.value)}
              placeholder="Search friends or all users"
              className="pl-8"
            />
          </div>
          <div className="max-h-64 space-y-0.5 overflow-y-auto scrollbar-thin">
            {people.length === 0 ? (
              <p className="py-6 text-center text-sm text-muted-foreground">
                {term.length >= 2 ? "No one found" : "Add friends first to start chats"}
              </p>
            ) : (
              people.map((p) => (
                <button
                  key={p._id}
                  type="button"
                  onClick={() => toggle(p._id)}
                  className="flex w-full items-center gap-2.5 rounded-lg px-2 py-1.5 text-left hover:bg-muted"
                >
                  <UserAvatar name={p.name} image={p.image} size="sm" />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium">{p.name ?? "Anonymous"}</span>
                    {p.username && (
                      <span className="block truncate text-xs text-muted-foreground">@{p.username}</span>
                    )}
                  </span>
                  {selected.includes(p._id) && (
                    <span className="flex size-5 items-center justify-center rounded-full bg-brand text-brand-contrast">
                      ✓
                    </span>
                  )}
                </button>
              ))
            )}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={busy}>
            Cancel
          </Button>
          <Button onClick={confirm} disabled={!canConfirm || busy}>
            {busy ? "Working…" : mode === "direct" ? "Start chat" : "Create group"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
