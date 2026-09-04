import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { requireUserId } from "./users";
import { getFriendIds } from "./friends";
import { getSettingsRow } from "./settings";
import { pushNotification } from "./notifications";
import { ensureDirectConversation } from "./conversations";

const STORY_TTL_MS = 24 * 60 * 60 * 1000;
const BACKGROUNDS = ["aurora", "sunset", "ocean", "orchid", "ember"] as const;

/** Active (unexpired) stories from the viewer + their friends, grouped by author. */
export const feed = query({
  args: {},
  handler: async (ctx) => {
    const meId = await requireUserId(ctx);
    const now = Date.now();

    const authorIds = new Set(await getFriendIds(ctx, meId));
    authorIds.add(meId);

    const mine = await ctx.db
      .query("stories")
      .withIndex("by_author", (q) => q.eq("authorId", meId))
      .collect();

    const friendRows = await Promise.all(
      [...authorIds]
        .filter((id) => id !== meId)
        .map(async (id) =>
          ctx.db
            .query("stories")
            .withIndex("by_author", (q) => q.eq("authorId", id))
            .collect(),
        ),
    );

    const all = [...mine, ...friendRows.flat()].filter((s) => s.expiresAt > now);
    all.sort((a, b) => a.createdAt - b.createdAt);

    const myViews = new Set(
      (
        await ctx.db
          .query("storyViews")
          .withIndex("by_viewer", (q) => q.eq("viewerId", meId))
          .collect()
      ).map((v) => v.storyId),
    );

    const groups = new Map<
      string,
      {
        author: { _id: string; name: string | null; image: string | null; username: string | null };
        isMe: boolean;
        stories: {
          _id: string;
          kind: string;
          text: string | null;
          background: string | null;
          mediaId: string | null;
          createdAt: number;
          expiresAt: number;
          viewedByMe: boolean;
          viewCount: number;
        }[];
      }
    >();

    for (const s of all) {
      const author = await ctx.db.get(s.authorId);
      if (!author) continue;
      const key = s.authorId;
      if (!groups.has(key)) {
        groups.set(key, {
          author: {
            _id: author._id,
            name: author.name ?? null,
            image: author.image ?? null,
            username: author.username ?? null,
          },
          isMe: s.authorId === meId,
          stories: [],
        });
      }
      const views = await ctx.db
        .query("storyViews")
        .withIndex("by_story", (q) => q.eq("storyId", s._id))
        .collect();
      groups.get(key)!.stories.push({
        _id: s._id,
        kind: s.kind,
        text: s.text ?? null,
        background: s.background ?? null,
        mediaId: s.mediaId ?? null,
        createdAt: s.createdAt,
        expiresAt: s.expiresAt,
        viewedByMe: myViews.has(s._id),
        viewCount: s.authorId === meId ? views.length : 0, // only author sees count
      });
    }

    // me first, then unviewed, then viewed
    const list = [...groups.values()];
    list.sort((a, b) => {
      if (a.isMe !== b.isMe) return a.isMe ? -1 : 1;
      const aUnseen = a.stories.some((s) => !s.viewedByMe) ? 0 : 1;
      const bUnseen = b.stories.some((s) => !s.viewedByMe) ? 0 : 1;
      if (aUnseen !== bUnseen) return aUnseen - bUnseen;
      const aLatest = Math.max(...a.stories.map((s) => s.createdAt));
      const bLatest = Math.max(...b.stories.map((s) => s.createdAt));
      return bLatest - aLatest;
    });
    return list;
  },
});

export const create = mutation({
  args: {
    kind: v.union(v.literal("text"), v.literal("image")),
    text: v.optional(v.string()),
    background: v.optional(v.string()),
    mediaId: v.optional(v.id("media")),
  },
  handler: async (ctx, { kind, text, background, mediaId }) => {
    const meId = await requireUserId(ctx);
    if (kind === "text") {
      const clean = (text ?? "").trim();
      if (!clean) throw new Error("Story text is required");
      if (clean.length > 280) throw new Error("Story text is too long (max 280 characters)");
    } else if (!mediaId) {
      throw new Error("Image stories require media");
    }
    const settings = await getSettingsRow(ctx, meId);
    void settings;

    const now = Date.now();
    const storyId = await ctx.db.insert("stories", {
      authorId: meId,
      kind,
      text: kind === "text" ? text!.trim() : text?.slice(0, 280),
      background:
        kind === "text" && background && (BACKGROUNDS as readonly string[]).includes(background)
          ? background
          : "aurora",
      mediaId,
      createdAt: now,
      expiresAt: now + STORY_TTL_MS,
    });
    return storyId;
  },
});

export const remove = mutation({
  args: { storyId: v.id("stories") },
  handler: async (ctx, { storyId }) => {
    const meId = await requireUserId(ctx);
    const story = await ctx.db.get(storyId);
    if (!story || story.authorId !== meId) throw new Error("Story not found");
    const views = await ctx.db
      .query("storyViews")
      .withIndex("by_story", (q) => q.eq("storyId", storyId))
      .collect();
    await Promise.all(views.map((v2) => ctx.db.delete(v2._id)));
    await ctx.db.delete(storyId);
    return { ok: true };
  },
});

/** Record a view (deduped per viewer). */
export const recordView = mutation({
  args: { storyId: v.id("stories") },
  handler: async (ctx, { storyId }) => {
    const meId = await requireUserId(ctx);
    const story = await ctx.db.get(storyId);
    if (!story) throw new Error("Story not found");
    const existing = await ctx.db
      .query("storyViews")
      .withIndex("by_story_viewer", (q) => q.eq("storyId", storyId).eq("viewerId", meId))
      .first();
    if (!existing) {
      await ctx.db.insert("storyViews", { storyId, viewerId: meId, viewedAt: Date.now() });
    }
    return { ok: true };
  },
});

/** Viewers of one of my stories (author only). */
export const viewers = query({
  args: { storyId: v.id("stories") },
  handler: async (ctx, { storyId }) => {
    const meId = await requireUserId(ctx);
    const story = await ctx.db.get(storyId);
    if (!story || story.authorId !== meId) return null;
    const rows = await ctx.db
      .query("storyViews")
      .withIndex("by_story", (q) => q.eq("storyId", storyId))
      .collect();
    rows.sort((a, b) => b.viewedAt - a.viewedAt);
    return await Promise.all(
      rows.map(async (v2) => {
        const u = await ctx.db.get(v2.viewerId);
        return {
          _id: v2.viewerId,
          viewedAt: v2.viewedAt,
          name: u?.name ?? null,
          image: u?.image ?? null,
          username: u?.username ?? null,
        };
      }),
    );
  },
});

/** Reply to a story: routes into the direct conversation and notifies the author. */
export const replyToStory = mutation({
  args: { storyId: v.id("stories"), text: v.string() },
  handler: async (ctx, { storyId, text }) => {
    const meId = await requireUserId(ctx);
    const story = await ctx.db.get(storyId);
    if (!story) throw new Error("Story not found");
    if (story.authorId === meId) throw new Error("This is your own story");
    const clean = text.trim();
    if (!clean) throw new Error("Reply cannot be empty");
    if (clean.length > 1000) throw new Error("Reply is too long");

    const conversationId = await ensureDirectConversation(ctx, meId, story.authorId);

    const now = Date.now();
    const conversation = await ctx.db.get(conversationId);
    const seq = (conversation?.msgSeq ?? 0) + 1;
    const messageId = await ctx.db.insert("messages", {
      conversationId,
      seq,
      senderId: meId,
      kind: "text",
      text: clean,
      replyToStoryId: storyId,
      createdAt: now,
    });
    await ctx.db.patch(conversationId, {
      lastMessageAt: now,
      lastMessagePreview: `↩️ Replied to a story: ${clean.slice(0, 60)}`,
      lastMessageSenderId: meId,
      msgSeq: seq,
    });

    const members = await ctx.db
      .query("conversationMembers")
      .withIndex("by_conversation", (q) => q.eq("conversationId", conversationId))
      .collect();
    await Promise.all(
      members
        .filter((m) => m.userId !== meId)
        .map((m) => ctx.db.patch(m._id, { unreadCount: m.unreadCount + 1 })),
    );

    const me = await ctx.db.get(meId);
    await pushNotification(ctx, {
      userId: story.authorId,
      kind: "story_reply",
      title: `${me?.name ?? "Someone"} replied to your story`,
      body: clean.slice(0, 120),
      actorId: meId,
      conversationId,
      messageId,
      storyId,
    });

    return { conversationId, messageId };
  },
});

export const BACKGROUNDS_LIST = BACKGROUNDS;
