import { v } from "convex/values";
import { mutation, query, MutationCtx, QueryCtx } from "./_generated/server";
import { Id } from "./_generated/dataModel";
import { requireUserId } from "./users";
import { getSettingsRow } from "./settings";
import { isBlockedEitherWay } from "./blocks";
import { pushNotification } from "./notifications";

const PREVIEW_LEN = 80;

function makePreview(kind: string, text?: string | null): string {
  if (kind === "image") return "📷 Photo";
  if (kind === "file") return "📎 File";
  if (kind === "voice") return "🎤 Voice message";
  const t = (text ?? "").trim();
  return t.length > PREVIEW_LEN ? t.slice(0, PREVIEW_LEN - 1) + "…" : t || "Message";
}

async function getMembership(
  ctx: QueryCtx,
  conversationId: Id<"conversations">,
  userId: Id<"users">,
) {
  return await ctx.db
    .query("conversationMembers")
    .withIndex("by_conversation_user", (q) =>
      q.eq("conversationId", conversationId).eq("userId", userId),
    )
    .first();
}

async function getReadRow(
  ctx: QueryCtx,
  conversationId: Id<"conversations">,
  userId: Id<"users">,
) {
  return await ctx.db
    .query("messageReads")
    .withIndex("by_conversation_user", (q) =>
      q.eq("conversationId", conversationId).eq("userId", userId),
    )
    .first();
}

async function notifyMessage(
  ctx: MutationCtx,
  conversationId: Id<"conversations">,
  senderId: Id<"users">,
  preview: string,
  messageId: Id<"messages">,
) {
  const members = await ctx.db
    .query("conversationMembers")
    .withIndex("by_conversation", (q) => q.eq("conversationId", conversationId))
    .collect();
  const sender = await ctx.db.get(senderId);
  const senderName = sender?.name ?? "Someone";
  await Promise.all(
    members
      .filter((m) => m.userId !== senderId && !m.notificationsMuted)
      .map((m) =>
        pushNotification(ctx, {
          userId: m.userId,
          kind: "message",
          title: senderName,
          body: preview,
          actorId: senderId,
          conversationId,
          messageId,
        }),
      ),
  );
}

const MESSAGE_PAGE = 60;

/** Paged, member-guarded message list, newest last. */
export const listMessages = query({
  args: {
    conversationId: v.id("conversations"),
    beforeSeq: v.optional(v.number()),
  },
  handler: async (ctx, { conversationId, beforeSeq }) => {
    const meId = await requireUserId(ctx);
    const me = await getMembership(ctx, conversationId, meId);
    if (!me) return null;

    const rows = await ctx.db
      .query("messages")
      .withIndex("by_conversation_seq", (q) =>
        beforeSeq !== undefined
          ? q.eq("conversationId", conversationId).lt("seq", beforeSeq)
          : q.eq("conversationId", conversationId),
      )
      .order("desc")
      .take(MESSAGE_PAGE);
    rows.reverse();

    const reactionLists = await Promise.all(
      rows.map((m) =>
        ctx.db
          .query("messageReactions")
          .withIndex("by_message", (q) => q.eq("messageId", m._id))
          .collect(),
      ),
    );
    const myRead = await getReadRow(ctx, conversationId, meId);

    const otherReadRows = await ctx.db
      .query("messageReads")
      .withIndex("by_conversation_user", (q) => q.eq("conversationId", conversationId))
      .collect();
    const otherSeqs = otherReadRows
      .filter((r) => r.userId !== meId)
      .map((r) => r.lastReadSeq);
    const maxOtherRead = otherSeqs.length ? Math.max(...otherSeqs) : 0;

    // resolve media URLs and reply previews
    const withMeta = await Promise.all(
      rows.map(async (m, i) => {
        let media: { url: string; kind: string; name: string; mimeType: string } | null = null;
        if (m.mediaId) {
          const doc = await ctx.db.get(m.mediaId);
          if (doc) {
            const url = await ctx.storage.getUrl(doc.storageId);
            media = { url: url ?? "", kind: doc.kind, name: doc.name, mimeType: doc.mimeType };
          }
        }
        let replyTo: { _id: string; senderName: string; preview: string } | null = null;
        if (m.replyToId) {
          const r = await ctx.db.get(m.replyToId);
          if (r) {
            const sender = await ctx.db.get(r.senderId);
            const deleted = Boolean(r.deletedAt);
            replyTo = {
              _id: r._id,
              senderName: sender?.name ?? "Unknown",
              preview: deleted
                ? "Message deleted"
                : makePreview(r.kind, r.text),
            };
          }
        }
        const rx = (reactionLists[i] ?? []).map((r) => ({ emoji: r.emoji, userId: r.userId }));
        return {
          _id: m._id,
          seq: m.seq,
          senderId: m.senderId,
          kind: m.kind,
          text: m.text ?? null,
          media,
          replyTo,
          editedAt: m.editedAt ?? null,
          deletedAt: m.deletedAt ?? null,
          expiresAt: m.expiresAt ?? null,
          createdAt: m.createdAt,
          reactions: rx,
          mine: m.senderId === meId,
        };
      }),
    );

    return {
      messages: withMeta,
      myLastReadSeq: myRead?.lastReadSeq ?? 0,
      maxOtherReadSeq: maxOtherRead,
      hasMore: rows.length === MESSAGE_PAGE,
      oldestSeq: rows[0]?.seq ?? null,
    };
  },
});

export const sendMessage = mutation({
  args: {
    conversationId: v.id("conversations"),
    kind: v.union(v.literal("text"), v.literal("image"), v.literal("file"), v.literal("voice")),
    text: v.optional(v.string()),
    mediaId: v.optional(v.id("media")),
    replyToId: v.optional(v.id("messages")),
    replyToStoryId: v.optional(v.id("stories")),
  },
  handler: async (ctx, { conversationId, kind, text, mediaId, replyToId, replyToStoryId }) => {
    const meId = await requireUserId(ctx);
    const me = await getMembership(ctx, conversationId, meId);
    if (!me) throw new Error("Conversation not found");

    const conversation = await ctx.db.get(conversationId);
    if (!conversation) throw new Error("Conversation not found");

    // direct conversations respect blocks + recipient policy
    if (conversation.kind === "direct") {
      const others = await ctx.db
        .query("conversationMembers")
        .withIndex("by_conversation", (q) => q.eq("conversationId", conversationId))
        .collect();
      const other = others.find((m2) => m2.userId !== meId);
      if (other && (await isBlockedEitherWay(ctx, meId, other.userId))) {
        throw new Error("You can no longer message this user");
      }
    }

    if (kind === "text") {
      const clean = (text ?? "").trim();
      if (!clean) throw new Error("Message cannot be empty");
      if (clean.length > 4000) throw new Error("Message is too long (max 4000 characters)");
    } else if (!mediaId) {
      throw new Error("Media is required for this message type");
    }

    if (replyToId) {
      const target = await ctx.db.get(replyToId);
      if (!target || target.conversationId !== conversationId)
        throw new Error("Invalid reply target");
    }

    const now = Date.now();
    const seq = conversation.msgSeq + 1;
    const disappearingSeconds = conversation.disappearingSeconds ?? 0;

    const messageId = await ctx.db.insert("messages", {
      conversationId,
      seq,
      senderId: meId,
      kind,
      text: kind === "text" ? text!.trim() : text?.slice(0, 200),
      mediaId,
      replyToId,
      replyToStoryId,
      expiresAt: disappearingSeconds > 0 ? now + disappearingSeconds * 1000 : undefined,
      createdAt: now,
    });

    await ctx.db.patch(conversationId, {
      lastMessageAt: now,
      lastMessagePreview: makePreview(kind, kind === "text" ? text : undefined),
      lastMessageSenderId: meId,
      msgSeq: seq,
    });

    // unread counts for everyone except sender
    const members = await ctx.db
      .query("conversationMembers")
      .withIndex("by_conversation", (q) => q.eq("conversationId", conversationId))
      .collect();
    await Promise.all(
      members
        .filter((m2) => m2.userId !== meId)
        .map((m2) => ctx.db.patch(m2._id, { unreadCount: m2.unreadCount + 1 })),
    );

    await notifyMessage(
      ctx,
      conversationId,
      meId,
      makePreview(kind, kind === "text" ? text : undefined),
      messageId,
    );

    return messageId;
  },
});

export const editMessage = mutation({
  args: { messageId: v.id("messages"), text: v.string() },
  handler: async (ctx, { messageId, text }) => {
    const meId = await requireUserId(ctx);
    const m = await ctx.db.get(messageId);
    if (!m) throw new Error("Message not found");
    if (m.senderId !== meId) throw new Error("You can only edit your own messages");
    if (m.deletedAt) throw new Error("Message was deleted");
    if (m.kind !== "text") throw new Error("Only text messages can be edited");
    const clean = text.trim();
    if (!clean) throw new Error("Message cannot be empty");
    if (clean.length > 4000) throw new Error("Message is too long");

    await ctx.db.patch(messageId, { text: clean, editedAt: Date.now() });

    const conversation = await ctx.db.get(m.conversationId);
    if (conversation && conversation.lastMessagePreview && m.seq === conversation.msgSeq) {
      await ctx.db.patch(m.conversationId, {
        lastMessagePreview: makePreview("text", clean),
      });
    }
    return { ok: true };
  },
});

export const deleteMessage = mutation({
  args: { messageId: v.id("messages") },
  handler: async (ctx, { messageId }) => {
    const meId = await requireUserId(ctx);
    const m = await ctx.db.get(messageId);
    if (!m) throw new Error("Message not found");
    if (m.senderId !== meId) throw new Error("You can only delete your own messages");
    if (m.deletedAt) return { ok: true };

    await ctx.db.patch(messageId, {
      deletedAt: Date.now(),
      text: undefined,
      mediaId: undefined,
    });

    const conversation = await ctx.db.get(m.conversationId);
    if (conversation && m.seq === conversation.msgSeq) {
      await ctx.db.patch(m.conversationId, { lastMessagePreview: "Message deleted" });
    }
    return { ok: true };
  },
});

export const toggleReaction = mutation({
  args: { messageId: v.id("messages"), emoji: v.string() },
  handler: async (ctx, { messageId, emoji }) => {
    const meId = await requireUserId(ctx);
    const m = await ctx.db.get(messageId);
    if (!m) throw new Error("Message not found");
    if (!(await getMembership(ctx, m.conversationId, meId)))
      throw new Error("Conversation not found");

    const mine = await ctx.db
      .query("messageReactions")
      .withIndex("by_message_user", (q) => q.eq("messageId", messageId).eq("userId", meId))
      .filter((q) => q.eq(q.field("emoji"), emoji))
      .first();
    if (mine) {
      await ctx.db.delete(mine._id);
      return { added: false };
    }
    await ctx.db.insert("messageReactions", {
      messageId,
      userId: meId,
      emoji,
      createdAt: Date.now(),
    });
    return { added: true };
  },
});

export const setTyping = mutation({
  args: { conversationId: v.id("conversations"), typing: v.boolean() },
  handler: async (ctx, { conversationId, typing }) => {
    const meId = await requireUserId(ctx);
    const me = await getMembership(ctx, conversationId, meId);
    if (!me) throw new Error("Conversation not found");
    const settings = await getSettingsRow(ctx, meId);
    if (typing && settings && !settings.typingIndicatorEnabled) return { ok: true };
    const now = Date.now();
    const value = typing ? now : undefined;
    if (me.typingAt !== value) {
      await ctx.db.patch(me._id, { typingAt: value });
    }
    return { ok: true };
  },
});

export const markRead = mutation({
  args: { conversationId: v.id("conversations") },
  handler: async (ctx, { conversationId }) => {
    const meId = await requireUserId(ctx);
    const me = await getMembership(ctx, conversationId, meId);
    if (!me) throw new Error("Conversation not found");

    const now = Date.now();
    if (me.unreadCount !== 0) {
      await ctx.db.patch(me._id, { unreadCount: 0 });
    }

    const conversation = await ctx.db.get(conversationId);
    const latestSeq = conversation?.msgSeq ?? 0;
    const read = await getReadRow(ctx, conversationId, meId);
    const settings = await getSettingsRow(ctx, meId);
    const shareReadReceipts = settings?.readReceiptsEnabled ?? true;
    const nextSeq = shareReadReceipts ? latestSeq : Math.min(read?.lastReadSeq ?? 0, latestSeq);

    if (!read) {
      await ctx.db.insert("messageReads", {
        conversationId,
        userId: meId,
        lastReadSeq: nextSeq,
        updatedAt: now,
      });
    } else if (read.lastReadSeq < nextSeq) {
      await ctx.db.patch(read._id, { lastReadSeq: nextSeq, updatedAt: now });
    }

    // clear message notifications for this conversation
    const notifs = await ctx.db
      .query("notifications")
      .withIndex("by_user_created", (q) => q.eq("userId", meId))
      .order("desc")
      .take(50);
    await Promise.all(
      notifs
        .filter((n) => n.kind === "message" && n.conversationId === conversationId && !n.readAt)
        .map((n) => ctx.db.patch(n._id, { readAt: now })),
    );
    return { ok: true };
  },
});
