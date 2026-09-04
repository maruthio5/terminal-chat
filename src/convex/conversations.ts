import { v } from "convex/values";
import { mutation, query, MutationCtx, QueryCtx } from "./_generated/server";
import { Id } from "./_generated/dataModel";
import { requireUserId } from "./users";
import { getFriendIds } from "./friends";
import { isBlockedEitherWay } from "./blocks";
import { getSettingsRow } from "./settings";
import { pushNotification } from "./notifications";

export const directKeyFor = (a: Id<"users">, b: Id<"users">) =>
  a < b ? `direct:${a}:${b}` : `direct:${b}:${a}`;

/** Get the existing direct conversation between two users, if any. */
export async function getDirectConversation(
  ctx: QueryCtx,
  a: Id<"users">,
  b: Id<"users">,
) {
  const key = directKeyFor(a, b);
  return await ctx.db
    .query("conversations")
    .withIndex("by_direct_key", (q) => q.eq("directKey", key))
    .first();
}

/** Create the direct conversation between two friends if it doesn't exist. */
export async function ensureDirectConversation(
  ctx: MutationCtx,
  a: Id<"users">,
  b: Id<"users">,
): Promise<Id<"conversations">> {
  const existing = await getDirectConversation(ctx, a, b);
  if (existing) return existing._id;

  const now = Date.now();
  const conversationId = await ctx.db.insert("conversations", {
    kind: "direct",
    directKey: directKeyFor(a, b),
    createdById: a,
    createdAt: now,
    lastMessageAt: now,
    msgSeq: 0,
  });
  await Promise.all([
    ctx.db.insert("conversationMembers", {
      conversationId,
      userId: a,
      role: "owner",
      joinedAt: now,
      unreadCount: 0,
      notificationsMuted: false,
    }),
    ctx.db.insert("conversationMembers", {
      conversationId,
      userId: b,
      role: "owner",
      joinedAt: now,
      unreadCount: 0,
      notificationsMuted: false,
    }),
  ]);
  return conversationId;
}

async function getMembership(ctx: QueryCtx, conversationId: Id<"conversations">, userId: Id<"users">) {
  return await ctx.db
    .query("conversationMembers")
    .withIndex("by_conversation_user", (q) =>
      q.eq("conversationId", conversationId).eq("userId", userId),
    )
    .first();
}

export const listConversations = query({
  args: {},
  handler: async (ctx) => {
    const meId = await requireUserId(ctx);
    const memberships = await ctx.db
      .query("conversationMembers")
      .withIndex("by_user", (q) => q.eq("userId", meId))
      .collect();

    const items = await Promise.all(
      memberships.map(async (m) => {
        const c = await ctx.db.get(m.conversationId);
        if (!c) return null;

        // other participants (up to 9 for group headers)
        const allMembers = await ctx.db
          .query("conversationMembers")
          .withIndex("by_conversation", (q) => q.eq("conversationId", c._id))
          .collect();
        const otherIds = allMembers
          .filter((x) => x.userId !== meId)
          .slice(0, 9)
          .map((x) => x.userId);
        const others = (await Promise.all(otherIds.map((id) => ctx.db.get(id))))
          .filter(Boolean)
          .map((u) => ({
            _id: u!._id,
            name: u!.name ?? null,
            image: u!.image ?? null,
            username: u!.username ?? null,
            lastSeenAt: u!.lastSeenAt ?? null,
          }));

        const title =
          c.kind === "group"
            ? (c.title ?? "Group chat")
            : (others[0]?.name ?? "Direct message");

        const typingOthers =
          c.kind === "direct"
            ? (allMembers.find((x) => x.userId !== meId)?.typingAt ?? undefined)
            : undefined;

        return {
          _id: c._id,
          kind: c.kind,
          title,
          imageUrl: c.imageUrl ?? null,
          others,
          memberCount: allMembers.length,
          unreadCount: m.unreadCount,
          muted: m.notificationsMuted,
          lastMessageAt: c.lastMessageAt,
          lastMessagePreview: c.lastMessagePreview ?? null,
          lastMessageSenderId: c.lastMessageSenderId ?? null,
          disappearingSeconds: c.disappearingSeconds ?? null,
          myTypingAt: m.typingAt ?? null,
          otherTypingAt: typingOthers ?? null,
        };
      }),
    );

    return items
      .filter((i): i is NonNullable<typeof i> => i !== null)
      .sort((a, b) => b.lastMessageAt - a.lastMessageAt);
  },
});

export const getConversation = query({
  args: { conversationId: v.id("conversations") },
  handler: async (ctx, { conversationId }) => {
    const meId = await requireUserId(ctx);
    const c = await ctx.db.get(conversationId);
    if (!c) return null;
    const me = await getMembership(ctx, conversationId, meId);
    if (!me) return null; // not a member — do not leak existence

    const allMembers = await ctx.db
      .query("conversationMembers")
      .withIndex("by_conversation", (q) => q.eq("conversationId", conversationId))
      .collect();
    const others = await Promise.all(
      allMembers
        .filter((x) => x.userId !== meId)
        .map(async (x) => {
          const u = await ctx.db.get(x.userId);
          if (!u) return null;
          return {
            _id: u._id,
            name: u.name ?? null,
            image: u.image ?? null,
            username: u.username ?? null,
            bio: u.bio ?? null,
            lastSeenAt: u.lastSeenAt ?? null,
            role: x.role,
          };
        }),
    );

    const otherTypingRows = allMembers.filter(
      (x) => x.userId !== meId && x.typingAt && Date.now() - x.typingAt < 6000,
    );

    const myRead = await ctx.db
      .query("messageReads")
      .withIndex("by_conversation_user", (q) =>
        q.eq("conversationId", conversationId).eq("userId", meId),
      )
      .first();

    return {
      _id: c._id,
      kind: c.kind,
      title: c.kind === "group" ? (c.title ?? "Group chat") : (others[0]?.name ?? "Direct message"),
      imageUrl: c.imageUrl ?? null,
      createdById: c.createdById,
      createdAt: c.createdAt,
      disappearingSeconds: c.disappearingSeconds ?? null,
      myRole: me.role,
      muted: me.notificationsMuted,
      unreadCount: me.unreadCount,
      others: others.filter((o): o is NonNullable<typeof o> => o !== null),
      memberCount: allMembers.length,
      otherTyping:
        c.kind === "direct"
          ? otherTypingRows.length > 0
          : otherTypingRows.length > 0,
      otherTypingNames:
        c.kind === "group"
          ? (
              await Promise.all(
                otherTypingRows.map(async (x) => (await ctx.db.get(x.userId))?.name ?? "Someone"),
              )
            ).slice(0, 3)
          : [],
      lastReadSeq: myRead?.lastReadSeq ?? 0,
    };
  },
});

/** Find an existing direct conversation with a friend (or create one). */
export const openDirectWith = mutation({
  args: { userId: v.id("users") },
  handler: async (ctx, { userId }) => {
    const meId = await requireUserId(ctx);
    if (meId === userId) throw new Error("You cannot message yourself");
    const friendshipIds = await getFriendIds(ctx, meId);
    const isFriend = friendshipIds.includes(userId);
    if (!isFriend) {
      const settings = await getSettingsRow(ctx, userId);
      const blocked = await isBlockedEitherWay(ctx, meId, userId);
      if (blocked) throw new Error("You cannot message this user");
      if ((settings?.messagesFrom ?? "friends") === "friends")
        throw new Error("You can only message friends");
    }
    return await ensureDirectConversation(ctx, meId, userId);
  },
});

export const createGroup = mutation({
  args: {
    title: v.string(),
    memberIds: v.array(v.id("users")),
  },
  handler: async (ctx, { title, memberIds }) => {
    const meId = await requireUserId(ctx);
    const clean = title.trim();
    if (clean.length < 1 || clean.length > 60)
      throw new Error("Group name must be 1-60 characters");

    const friendIds = new Set(await getFriendIds(ctx, meId));
    const unique = [...new Set(memberIds)].filter((id) => id !== meId);
    if (unique.some((id) => !friendIds.has(id)))
      throw new Error("You can only add friends to a group");
    if (unique.length < 1) throw new Error("Add at least one friend");

    for (const id of unique) {
      if (await isBlockedEitherWay(ctx, meId, id))
        throw new Error("You cannot create a group with a blocked user");
    }

    const now = Date.now();
    const conversationId = await ctx.db.insert("conversations", {
      kind: "group",
      title: clean,
      createdById: meId,
      createdAt: now,
      lastMessageAt: now,
      msgSeq: 0,
    });

    const inserts: Promise<unknown>[] = [
      ctx.db.insert("conversationMembers", {
        conversationId,
        userId: meId,
        role: "owner",
        joinedAt: now,
        unreadCount: 0,
        notificationsMuted: false,
      }),
    ];
    for (const id of unique) {
      inserts.push(
        ctx.db.insert("conversationMembers", {
          conversationId,
          userId: id,
          role: "member",
          joinedAt: now,
          unreadCount: 0,
          notificationsMuted: false,
        }),
      );
      inserts.push(
        pushNotification(ctx, {
          userId: id,
          kind: "system",
          title: `Added you to ${clean}`,
          actorId: meId,
          conversationId,
        }),
      );
    }
    await Promise.all(inserts);
    return conversationId;
  },
});

export const addMembers = mutation({
  args: {
    conversationId: v.id("conversations"),
    memberIds: v.array(v.id("users")),
  },
  handler: async (ctx, { conversationId, memberIds }) => {
    const meId = await requireUserId(ctx);
    const c = await ctx.db.get(conversationId);
    if (!c || c.kind !== "group") throw new Error("Group not found");
    const me = await getMembership(ctx, conversationId, meId);
    if (!me || me.role === "member") throw new Error("Only group admins can add members");

    const friendIds = new Set(await getFriendIds(ctx, meId));
    for (const id of memberIds) {
      if (!friendIds.has(id)) continue;
      const existing = await getMembership(ctx, conversationId, id);
      if (existing) continue;
      if (await isBlockedEitherWay(ctx, meId, id)) continue;
      await ctx.db.insert("conversationMembers", {
        conversationId,
        userId: id,
        role: "member",
        joinedAt: Date.now(),
        unreadCount: 0,
        notificationsMuted: false,
      });
      const u = await ctx.db.get(id);
      await pushNotification(ctx, {
        userId: id,
        kind: "system",
        title: `Added you to ${c.title ?? "a group"}`,
        actorId: meId,
        conversationId,
      });
    }
    return { ok: true };
  },
});

export const leaveGroup = mutation({
  args: { conversationId: v.id("conversations") },
  handler: async (ctx, { conversationId }) => {
    const meId = await requireUserId(ctx);
    const me = await getMembership(ctx, conversationId, meId);
    if (!me) throw new Error("You are not in this group");
    const c = await ctx.db.get(conversationId);
    await ctx.db.delete(me._id);

    if (c && c.kind === "group") {
      const remaining = await ctx.db
        .query("conversationMembers")
        .withIndex("by_conversation", (q) => q.eq("conversationId", conversationId))
        .collect();
      if (remaining.length === 0) {
        await ctx.db.delete(conversationId);
      } else if (me.role === "owner") {
        await ctx.db.patch(remaining[0]._id, { role: "owner" });
      }
    }
    return { ok: true };
  },
});

export const updateGroup = mutation({
  args: {
    conversationId: v.id("conversations"),
    title: v.optional(v.string()),
    disappearingSeconds: v.optional(v.number()),
  },
  handler: async (ctx, { conversationId, title, disappearingSeconds }) => {
    const meId = await requireUserId(ctx);
    const me = await getMembership(ctx, conversationId, meId);
    if (!me || me.role === "member") throw new Error("Only group admins can update the group");
    const patch: Record<string, string | number> = {};
    if (title !== undefined) {
      const clean = title.trim();
      if (clean.length < 1 || clean.length > 60)
        throw new Error("Group name must be 1-60 characters");
      patch.title = clean;
    }
    if (disappearingSeconds !== undefined) {
      if (![0, 3600, 86400, 604800].includes(disappearingSeconds))
        throw new Error("Invalid disappearing timer");
      patch.disappearingSeconds = disappearingSeconds;
    }
    await ctx.db.patch(conversationId, patch);
    return { ok: true };
  },
});

export const setMuted = mutation({
  args: { conversationId: v.id("conversations"), muted: v.boolean() },
  handler: async (ctx, { conversationId, muted }) => {
    const meId = await requireUserId(ctx);
    const me = await getMembership(ctx, conversationId, meId);
    if (!me) throw new Error("Conversation not found");
    await ctx.db.patch(me._id, { notificationsMuted: muted });
    return { ok: true };
  },
});
