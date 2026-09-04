import { v } from "convex/values";
import { mutation, query, QueryCtx } from "./_generated/server";
import { Id } from "./_generated/dataModel";
import { requireUserId } from "./users";
import { getSettingsRow } from "./settings";
import { pushNotification } from "./notifications";
import { ensureDirectConversation } from "./conversations";

/** All established friend ids for a user. */
export async function getFriendIds(
  ctx: QueryCtx,
  userId: Id<"users">,
): Promise<Id<"users">[]> {
  const [asA, asB] = await Promise.all([
    ctx.db.query("friendships").withIndex("by_userA", (q) => q.eq("userAId", userId)).collect(),
    ctx.db.query("friendships").withIndex("by_userB", (q) => q.eq("userBId", userId)).collect(),
  ]);
  return [...asA.map((f) => f.userBId), ...asB.map((f) => f.userAId)];
}

async function getFriendship(
  ctx: QueryCtx,
  a: Id<"users">,
  b: Id<"users">,
) {
  const [first, second] = a < b ? [a, b] : [b, a];
  return await ctx.db
    .query("friendships")
    .withIndex("by_userA", (q) => q.eq("userAId", first))
    .filter((q) => q.eq(q.field("userBId"), second))
    .first();
}

async function existingPendingRequest(ctx: QueryCtx, from: Id<"users">, to: Id<"users">) {
  const [sent, received] = await Promise.all([
    ctx.db
      .query("friendRequests")
      .withIndex("by_from_status", (q) => q.eq("fromId", from).eq("status", "pending"))
      .filter((q) => q.eq(q.field("toId"), to))
      .first(),
    ctx.db
      .query("friendRequests")
      .withIndex("by_to_status", (q) => q.eq("toId", from).eq("status", "pending"))
      .filter((q) => q.eq(q.field("fromId"), to))
      .first(),
  ]);
  return sent ?? received;
}

export const myFriends = query({
  args: {},
  handler: async (ctx) => {
    const meId = await requireUserId(ctx);
    const friendIds = await getFriendIds(ctx, meId);
    const friends = await Promise.all(
      friendIds.map(async (id) => {
        const u = await ctx.db.get(id);
        if (!u) return null;
        return {
          _id: u._id,
          name: u.name ?? null,
          image: u.image ?? null,
          username: u.username ?? null,
          bio: u.bio ?? null,
          lastSeenAt: u.lastSeenAt ?? null,
        };
      }),
    );
    return friends
      .filter((f): f is NonNullable<typeof f> => f !== null)
      .sort((a, b) => (a.name ?? "").localeCompare(b.name ?? ""));
  },
});

export const incomingRequests = query({
  args: {},
  handler: async (ctx) => {
    const meId = await requireUserId(ctx);
    const rows = await ctx.db
      .query("friendRequests")
      .withIndex("by_to_status", (q) => q.eq("toId", meId).eq("status", "pending"))
      .collect();
    const items = await Promise.all(
      rows.map(async (r) => {
        const from = await ctx.db.get(r.fromId);
        return {
          _id: r._id,
          createdAt: r.createdAt,
          message: r.message ?? null,
          from: from
            ? { _id: from._id, name: from.name ?? null, image: from.image ?? null, username: from.username ?? null }
            : null,
        };
      }),
    );
    return items
      .filter((i) => i.from !== null)
      .sort((a, b) => b.createdAt - a.createdAt);
  },
});

export const outgoingRequests = query({
  args: {},
  handler: async (ctx) => {
    const meId = await requireUserId(ctx);
    const rows = await ctx.db
      .query("friendRequests")
      .withIndex("by_from_status", (q) => q.eq("fromId", meId).eq("status", "pending"))
      .collect();
    const items = await Promise.all(
      rows.map(async (r) => {
        const to = await ctx.db.get(r.toId);
        return {
          _id: r._id,
          createdAt: r.createdAt,
          to: to
            ? { _id: to._id, name: to.name ?? null, image: to.image ?? null, username: to.username ?? null }
            : null,
        };
      }),
    );
    return items
      .filter((i) => i.to !== null)
      .sort((a, b) => b.createdAt - a.createdAt);
  },
});

/** Send a friend request, honoring the recipient's friend-request policy and blocks. */
export const sendRequest = mutation({
  args: {
    toUserId: v.id("users"),
    message: v.optional(v.string()),
  },
  handler: async (ctx, { toUserId, message }) => {
    const meId = await requireUserId(ctx);
    if (meId === toUserId) throw new Error("You cannot add yourself");

    const target = await ctx.db.get(toUserId);
    if (!target) throw new Error("User not found");

    if (await getFriendship(ctx, meId, toUserId))
      throw new Error("You are already friends");

    if (await existingPendingRequest(ctx, meId, toUserId))
      throw new Error("A request already exists between you");

    const settings = await getSettingsRow(ctx, toUserId);
    const policy = settings?.friendRequestsFrom ?? "everyone";
    if (policy === "nobody") throw new Error(`${target.name ?? "This user"} is not accepting friend requests`);

    if (policy === "friendsOfFriends") {
      const [mine, theirs] = await Promise.all([
        getFriendIds(ctx, meId),
        getFriendIds(ctx, toUserId),
      ]);
      const mutual = mine.some((id) => theirs.includes(id));
      if (!mutual) throw new Error("You need a mutual friend to add this user");
    }

    const blocked = await ctx.db
      .query("blocks")
      .withIndex("by_pair", (q) => q.eq("blockerId", toUserId).eq("blockedId", meId))
      .first();
    if (blocked) throw new Error("You cannot send this request");

    const requestId = await ctx.db.insert("friendRequests", {
      fromId: meId,
      toId: toUserId,
      status: "pending",
      message: message?.slice(0, 200),
      createdAt: Date.now(),
    });

    await pushNotification(ctx, {
      userId: toUserId,
      kind: "friend_request",
      title: "New friend request",
      body: message?.slice(0, 120),
      actorId: meId,
    });

    return requestId;
  },
});

export const acceptRequest = mutation({
  args: { requestId: v.id("friendRequests") },
  handler: async (ctx, { requestId }) => {
    const meId = await requireUserId(ctx);
    const req = await ctx.db.get(requestId);
    if (!req || req.toId !== meId) throw new Error("Request not found");
    if (req.status !== "pending") throw new Error("Request is no longer pending");

    await ctx.db.patch(requestId, { status: "accepted", respondedAt: Date.now() });

    const [first, second] =
      req.fromId < req.toId ? [req.fromId, req.toId] : [req.toId, req.fromId];
    await ctx.db.insert("friendships", {
      userAId: first,
      userBId: second,
      createdAt: Date.now(),
    });

    await ensureDirectConversation(ctx, req.fromId, req.toId);

    await pushNotification(ctx, {
      userId: req.fromId,
      kind: "friend_accepted",
      title: "Friend request accepted",
      actorId: meId,
    });

    return { ok: true };
  },
});

export const declineRequest = mutation({
  args: { requestId: v.id("friendRequests") },
  handler: async (ctx, { requestId }) => {
    const meId = await requireUserId(ctx);
    const req = await ctx.db.get(requestId);
    if (!req || req.toId !== meId) throw new Error("Request not found");
    if (req.status !== "pending") throw new Error("Request is no longer pending");
    await ctx.db.patch(requestId, { status: "declined", respondedAt: Date.now() });
    return { ok: true };
  },
});

export const cancelRequest = mutation({
  args: { requestId: v.id("friendRequests") },
  handler: async (ctx, { requestId }) => {
    const meId = await requireUserId(ctx);
    const req = await ctx.db.get(requestId);
    if (!req || req.fromId !== meId) throw new Error("Request not found");
    if (req.status !== "pending") throw new Error("Request is no longer pending");
    await ctx.db.patch(requestId, { status: "cancelled", respondedAt: Date.now() });
    return { ok: true };
  },
});

export const removeFriend = mutation({
  args: { friendUserId: v.id("users") },
  handler: async (ctx, { friendUserId }) => {
    const meId = await requireUserId(ctx);
    const friendship = await getFriendship(ctx, meId, friendUserId);
    if (!friendship) throw new Error("You are not friends");
    await ctx.db.delete(friendship._id);
    return { ok: true };
  },
});
