import { v } from "convex/values";
import { mutation, query, MutationCtx } from "./_generated/server";
import { Id } from "./_generated/dataModel";
import { requireUserId } from "./users";

/**
 * Create (or coalesce) an in-app notification. Message notifications for the
 * same conversation are merged so active chats don't flood the list.
 */
export async function pushNotification(
  ctx: MutationCtx,
  args: {
    userId: Id<"users">;
    kind:
      | "friend_request"
      | "friend_accepted"
      | "message"
      | "mention"
      | "story_reply"
      | "system";
    title: string;
    body?: string;
    actorId?: Id<"users">;
    conversationId?: Id<"conversations">;
    messageId?: Id<"messages">;
    storyId?: Id<"stories">;
  },
) {
  if (args.kind === "message" && args.conversationId) {
    const existing = await ctx.db
      .query("notifications")
      .withIndex("by_user_created", (q) => q.eq("userId", args.userId))
      .order("desc")
      .take(30);
    const match = existing.find(
      (n) =>
        n.kind === "message" &&
        n.conversationId === args.conversationId &&
        !n.readAt,
    );
    if (match) {
      await ctx.db.patch(match._id, {
        body: args.body ?? match.body,
        actorId: args.actorId ?? match.actorId,
        messageId: args.messageId ?? match.messageId,
        createdAt: Date.now(),
      });
      return;
    }
  }
  await ctx.db.insert("notifications", {
    userId: args.userId,
    kind: args.kind,
    title: args.title,
    body: args.body,
    actorId: args.actorId,
    conversationId: args.conversationId,
    messageId: args.messageId,
    storyId: args.storyId,
    createdAt: Date.now(),
  });
}

export const list = query({
  args: {},
  handler: async (ctx) => {
    const meId = await requireUserId(ctx);
    const rows = await ctx.db
      .query("notifications")
      .withIndex("by_user_created", (q) => q.eq("userId", meId))
      .order("desc")
      .take(50);
    const items = await Promise.all(
      rows.map(async (n) => {
        const actor = n.actorId ? await ctx.db.get(n.actorId) : null;
        return {
          _id: n._id,
          kind: n.kind,
          title: n.title,
          body: n.body ?? null,
          conversationId: n.conversationId ?? null,
          messageId: n.messageId ?? null,
          storyId: n.storyId ?? null,
          readAt: n.readAt ?? null,
          createdAt: n.createdAt,
          actor: actor
            ? { _id: actor._id, name: actor.name ?? null, image: actor.image ?? null }
            : null,
        };
      }),
    );
    return items;
  },
});

export const unreadCount = query({
  args: {},
  handler: async (ctx) => {
    const meId = await requireUserId(ctx);
    const rows = await ctx.db
      .query("notifications")
      .withIndex("by_user_created", (q) => q.eq("userId", meId))
      .order("desc")
      .take(100);
    return rows.filter((n) => !n.readAt).length;
  },
});

export const markRead = mutation({
  args: { notificationId: v.id("notifications") },
  handler: async (ctx, { notificationId }) => {
    const meId = await requireUserId(ctx);
    const n = await ctx.db.get(notificationId);
    if (!n || n.userId !== meId) throw new Error("Notification not found");
    if (!n.readAt) await ctx.db.patch(notificationId, { readAt: Date.now() });
    return { ok: true };
  },
});

export const markAllRead = mutation({
  args: {},
  handler: async (ctx) => {
    const meId = await requireUserId(ctx);
    const rows = await ctx.db
      .query("notifications")
      .withIndex("by_user_created", (q) => q.eq("userId", meId))
      .order("desc")
      .take(100);
    const now = Date.now();
    for (const n of rows) {
      if (!n.readAt) await ctx.db.patch(n._id, { readAt: now });
    }
    return { ok: true };
  },
});
