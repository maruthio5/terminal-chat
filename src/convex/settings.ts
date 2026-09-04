import { v } from "convex/values";
import { mutation, query, MutationCtx } from "./_generated/server";
import { Doc, Id } from "./_generated/dataModel";
import { requireUserId } from "./users";

export const DEFAULT_SETTINGS = {
  lastSeenVisibility: "everyone",
  profilePhotoVisibility: "everyone",
  storyVisibility: "friends",
  readReceiptsEnabled: true,
  typingIndicatorEnabled: true,
  friendRequestsFrom: "everyone",
  messagesFrom: "friends",
  autoDownloadMedia: "wifi",
  keepMediaDays: 30,
} as const;

/** Fetch a user's settings row from a mutation context, creating it with defaults on first access. */
export async function getSettingsRow(
  ctx: MutationCtx,
  userId: Id<"users">,
): Promise<Doc<"privacySettings">> {
  const existing = await ctx.db
    .query("privacySettings")
    .withIndex("by_user", (q) => q.eq("userId", userId))
    .first();
  if (existing) return existing;
  const id = await ctx.db.insert("privacySettings", {
    userId,
    ...DEFAULT_SETTINGS,
  });
  const row = await ctx.db.get(id);
  if (!row) throw new Error("Failed to create settings row");
  return row;
}

export const mySettings = query({
  args: {},
  handler: async (ctx) => {
    const meId = await requireUserId(ctx);
    return await ctx.db
      .query("privacySettings")
      .withIndex("by_user", (q) => q.eq("userId", meId))
      .first();
  },
});

/** Settings the viewer is allowed to see for a target user (privacy-filtered). */
export async function visibleSettingsOf(
  ctx: MutationCtx | QueryCtxLike,
  targetId: Id<"users">,
) {
  const row = await ctx.db
    .query("privacySettings")
    .withIndex("by_user", (q) => q.eq("userId", targetId))
    .first();
  return {
    readReceiptsEnabled: row?.readReceiptsEnabled ?? true,
    typingIndicatorEnabled: row?.typingIndicatorEnabled ?? true,
  };
}
type QueryCtxLike = { db: { query: MutationCtx["db"]["query"] } };

export const updateSettings = mutation({
  args: {
    lastSeenVisibility: v.optional(
      v.union(v.literal("everyone"), v.literal("friends"), v.literal("nobody")),
    ),
    profilePhotoVisibility: v.optional(
      v.union(v.literal("everyone"), v.literal("friends"), v.literal("nobody")),
    ),
    storyVisibility: v.optional(
      v.union(v.literal("friends"), v.literal("everyone")),
    ),
    readReceiptsEnabled: v.optional(v.boolean()),
    typingIndicatorEnabled: v.optional(v.boolean()),
    friendRequestsFrom: v.optional(
      v.union(
        v.literal("everyone"),
        v.literal("friendsOfFriends"),
        v.literal("nobody"),
      ),
    ),
    messagesFrom: v.optional(
      v.union(v.literal("friends"), v.literal("everyone")),
    ),
    autoDownloadMedia: v.optional(
      v.union(v.literal("always"), v.literal("wifi"), v.literal("never")),
    ),
    keepMediaDays: v.optional(v.number()),
  },
  handler: async (ctx, patch) => {
    const meId = await requireUserId(ctx);
    const row = await getSettingsRow(ctx, meId);
    const updates: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(patch)) {
      if (value !== undefined) updates[key] = value;
    }
    if (updates.keepMediaDays !== undefined) {
      const days = updates.keepMediaDays as number;
      if (days < 1 || days > 365)
        throw new Error("keepMediaDays must be between 1 and 365");
    }
    await ctx.db.patch(row._id, updates);
    return { ok: true };
  },
});

/** One-time first-login bootstrap: derive a username/bio for brand-new accounts. */
export const ensureProfileBootstrap = mutation({
  args: {},
  handler: async (ctx) => {
    const meId = await requireUserId(ctx);
    const me = await ctx.db.get(meId);
    if (!me) throw new Error("User not found");
    if (me.username) return { created: false };

    const baseEmail = (me.email ?? "").split("@")[0]?.toLowerCase() ?? "";
    let candidate = baseEmail.replace(/[^a-z0-9_]/g, "").slice(0, 18);
    if (candidate.length < 3) candidate = "user" + meId.slice(-8).toLowerCase();
    let attempt = candidate;
    for (let i = 0; i < 20; i++) {
      const taken = await ctx.db
        .query("users")
        .withIndex("by_username", (q) => q.eq("username", attempt))
        .first();
      if (!taken || taken._id === meId) break;
      attempt = `${candidate}${i + 2}`.slice(0, 20);
    }
    await ctx.db.patch(meId, {
      username: attempt,
      name: me.name ?? attempt,
      createdAt: me.createdAt ?? Date.now(),
    });
    return { created: true, username: attempt };
  },
});
