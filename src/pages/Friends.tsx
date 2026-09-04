import { ReportDialog } from "@/components/ReportDialog";
import { UserAvatar } from "@/components/UserAvatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { useMutation, useQuery } from "convex/react";
import { Ban, Check, Search, UserMinus, UserPlus, X } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

type Person = {
  _id: string;
  name: string | null;
  image: string | null;
  username: string | null;
  bio?: string | null;
  lastSeenAt?: string | number | null;
};

export default function FriendsPage() {
  const [tab, setTab] = useState("friends");
  const [searchOpen, setSearchOpen] = useState(false);
  const [term, setTerm] = useState("");

  const friends = useQuery(api.friends.myFriends);
  const incoming = useQuery(api.friends.incomingRequests);
  const outgoing = useQuery(api.friends.outgoingRequests);
  const blocks = useQuery(api.blocks.myBlocks);
  const search = useQuery(api.users.searchUsers, term.trim().length >= 2 ? { term } : "skip");

  const sendRequest = useMutation(api.friends.sendRequest);
  const acceptRequest = useMutation(api.friends.acceptRequest);
  const declineRequest = useMutation(api.friends.declineRequest);
  const cancelRequest = useMutation(api.friends.cancelRequest);
  const removeFriend = useMutation(api.friends.removeFriend);
  const blockUser = useMutation(api.blocks.blockUser);
  const unblockUser = useMutation(api.blocks.unblockUser);

  const friendIds = new Set((friends ?? []).map((f) => f._id));
  const outgoingIds = new Set((outgoing ?? []).map((r) => r.to?._id));

  async function run(fn: () => Promise<unknown>, ok: string) {
    try {
      await fn();
      toast.success(ok);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Something went wrong");
    }
  }

  const incomingCount = incoming?.length ?? 0;

  return (
    <div className="mx-auto flex h-full w-full max-w-3xl flex-col px-4 py-4">
      <header className="mb-4 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold tracking-tight">Friends</h1>
          <p className="text-sm text-muted-foreground">
            Manage your circle, requests, and blocked accounts.
          </p>
        </div>
        <Button onClick={() => setSearchOpen((s) => !s)} variant={searchOpen ? "secondary" : "default"}>
          <Search className="mr-2 size-4" />
          Find people
        </Button>
      </header>

      {searchOpen && (
        <div className="mb-4 space-y-2 rounded-xl border bg-card p-3 shadow-sm">
          <Input
            value={term}
            onChange={(e) => setTerm(e.target.value)}
            placeholder="Search by name or @username (min 2 chars)"
            autoFocus
          />
          <div className="max-h-56 space-y-0.5 overflow-y-auto scrollbar-thin">
            {term.trim().length < 2 ? (
              <p className="py-4 text-center text-sm text-muted-foreground">
                Type at least 2 characters to search
              </p>
            ) : search === undefined ? (
              <p className="py-4 text-center text-sm text-muted-foreground">Searching…</p>
            ) : search.length === 0 ? (
              <p className="py-4 text-center text-sm text-muted-foreground">No users found</p>
            ) : (
              search.map((u) => (
                <PersonRow
                  key={u._id}
                  person={u}
                  subtitle={u.username ? `@${u.username}` : undefined}
                  action={
                    friendIds.has(u._id) ? (
                      <span className="text-xs font-medium text-emerald-600">Friends</span>
                    ) : outgoingIds.has(u._id) ? (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() =>
                          run(
                            () => cancelRequest({ requestId: outgoing!.find((r) => r.to?._id === u._id)!._id as Id<"friendRequests"> }),
                            "Request cancelled",
                          )
                        }
                      >
                        Pending
                      </Button>
                    ) : (
                      <Button
                        size="sm"
                        onClick={() =>
                          run(() => sendRequest({ toUserId: u._id as Id<"users"> }), "Request sent")
                        }
                      >
                        <UserPlus className="mr-1 size-3.5" /> Add
                      </Button>
                    )
                  }
                />
              ))
            )}
          </div>
        </div>
      )}

      <Tabs value={tab} onValueChange={setTab} className="flex min-h-0 flex-1 flex-col">
        <TabsList className="w-fit">
          <TabsTrigger value="friends">
            Friends {friends ? `(${friends.length})` : ""}
          </TabsTrigger>
          <TabsTrigger value="requests">
            Requests{incomingCount > 0 ? ` (${incomingCount})` : ""}
          </TabsTrigger>
          <TabsTrigger value="blocked">Blocked</TabsTrigger>
        </TabsList>

        <TabsContent value="friends" className="min-h-0 flex-1 overflow-y-auto scrollbar-thin">
          {friends === undefined ? (
            <ListSkeleton />
          ) : friends.length === 0 ? (
            <EmptyBlock
              title="No friends yet"
              body="Use Find people to search by name or username and send a request."
            />
          ) : (
            <ul className="space-y-1 pb-6">
              {friends.map((f) => (
                <PersonRow
                  key={f._id}
                  person={f}
                  subtitle={f.username ? `@${f.username}` : (f.bio ?? undefined)}
                  action={
                    <div className="flex gap-1">
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() =>
                          run(() => removeFriend({ friendUserId: f._id as Id<"users"> }), "Friend removed")
                        }
                        aria-label={`Remove ${f.name ?? "friend"}`}
                      >
                        <UserMinus className="size-4" />
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="text-destructive"
                        onClick={() =>
                          run(() => blockUser({ userId: f._id as Id<"users"> }), "User blocked")
                        }
                        aria-label={`Block ${f.name ?? "friend"}`}
                      >
                        <Ban className="size-4" />
                      </Button>
                    </div>
                  }
                />
              ))}
            </ul>
          )}
        </TabsContent>

        <TabsContent value="requests" className="min-h-0 flex-1 overflow-y-auto scrollbar-thin">
          <div className="space-y-6 pb-6">
            <section>
              <h2 className="mb-2 text-sm font-semibold text-muted-foreground">Received</h2>
              {incoming === undefined ? (
                <ListSkeleton />
              ) : incoming.length === 0 ? (
                <p className="rounded-xl border border-dashed p-4 text-center text-sm text-muted-foreground">
                  No pending requests
                </p>
              ) : (
                <ul className="space-y-1">
                  {incoming.map((r) =>
                    r.from ? (
                      <PersonRow
                        key={r._id}
                        person={r.from}
                        subtitle={r.message ?? r.from.username ?? undefined}
                        action={
                          <div className="flex gap-1">
                            <Button
                              size="sm"
                              onClick={() =>
                                run(() => acceptRequest({ requestId: r._id as Id<"friendRequests"> }), "Friend added 🎉")
                              }
                            >
                              <Check className="mr-1 size-3.5" /> Accept
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() =>
                                run(() => declineRequest({ requestId: r._id as Id<"friendRequests"> }), "Request declined")
                              }
                            >
                              <X className="mr-1 size-3.5" /> Decline
                            </Button>
                          </div>
                        }
                      />
                    ) : null,
                  )}
                </ul>
              )}
            </section>
            <section>
              <h2 className="mb-2 text-sm font-semibold text-muted-foreground">Sent</h2>
              {outgoing === undefined ? (
                <ListSkeleton />
              ) : outgoing.length === 0 ? (
                <p className="rounded-xl border border-dashed p-4 text-center text-sm text-muted-foreground">
                  No sent requests
                </p>
              ) : (
                <ul className="space-y-1">
                  {outgoing.map((r) =>
                    r.to ? (
                      <PersonRow
                        key={r._id}
                        person={r.to}
                        subtitle={r.to.username ? `@${r.to.username}` : undefined}
                        action={
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() =>
                              run(() => cancelRequest({ requestId: r._id as Id<"friendRequests"> }), "Request cancelled")
                            }
                          >
                            Cancel
                          </Button>
                        }
                      />
                    ) : null,
                  )}
                </ul>
              )}
            </section>
          </div>
        </TabsContent>

        <TabsContent value="blocked" className="min-h-0 flex-1 overflow-y-auto scrollbar-thin">
          {blocks === undefined ? (
            <ListSkeleton />
          ) : blocks.length === 0 ? (
            <EmptyBlock title="No blocked users" body="Blocked accounts can't message or add you." />
          ) : (
            <ul className="space-y-1 pb-6">
              {blocks.map((b) =>
                b.user ? (
                  <PersonRow
                    key={b._id}
                    person={b.user}
                    subtitle={b.user.username ? `@${b.user.username}` : undefined}
                    action={
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() =>
                          run(() => unblockUser({ userId: b.user!._id as Id<"users"> }), "User unblocked")
                        }
                      >
                        Unblock
                      </Button>
                    }
                  />
                ) : null,
              )}
            </ul>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}

function PersonRow({
  person,
  subtitle,
  action,
}: {
  person: Person;
  subtitle?: string;
  action: React.ReactNode;
}) {
  return (
    <li className="flex items-center gap-3 rounded-xl border bg-card px-3 py-2.5 shadow-sm">
      <UserAvatar name={person.name} image={person.image} size="md" />
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold">{person.name ?? "Anonymous"}</p>
        {subtitle && <p className="truncate text-xs text-muted-foreground">{subtitle}</p>}
      </div>
      {action}
    </li>
  );
}

function ListSkeleton() {
  return (
    <div className="space-y-2 py-2">
      {Array.from({ length: 4 }).map((_, i) => (
        <div key={i} className="h-14 animate-pulse rounded-xl bg-muted/60" />
      ))}
    </div>
  );
}

function EmptyBlock({ title, body }: { title: string; body: string }) {
  return (
    <div className="rounded-xl border border-dashed p-8 text-center">
      <p className="text-sm font-medium">{title}</p>
      <p className="mt-1 text-xs text-muted-foreground">{body}</p>
    </div>
  );
}
