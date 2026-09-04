import { getAuthUserId } from "@convex-dev/auth/server";
import { v } from "convex/values";
import { query, mutation, QueryCtx } from "./_generated/server";
import { Id } from "./_generated/dataModel";

/**
 * Get the current signed in user. Returns null if the user is not signed in.
 * Usage: const signedInUser = await ctx.runQuery(api.authHelpers.currentUser);
 * THIS FUNCTION IS READ-ONLY. DO NOT MODIFY.
 */
export const currentUser = query({
  args: {},
  handler: async (ctx) => {
    const user = await getCurrentUser(ctx);

    if (user === null) {
      return null;
    }

    return user;
  },
});

/**
 * Use this function internally to get the current user data. Remember to handle the null user case.
 * @param ctx
 * @returns
 */
export const getCurrentUser = async (ctx: QueryCtx) => {
  const userId = await getAuthUserId(ctx);
  if (userId === null) {
    return null;
  }
  return await ctx.db.get(userId);
};

/** Require auth and return the user id. */
export async function requireUserId(ctx: QueryCtx): Promise<Id<"users">> {
  const userId = await getAuthUserId(ctx);
  if (userId === null) throw new Error("Not authenticated");
  return userId;
}

/** Lightweight public identity used across chat/story UIs. */
export const publicUser = (u: {
  _id: Id<"users">;
  name?: string | null;
  image?: string | null;
  username?: string | null;
  lastSeenAt?: number | null;
}) => ({
  _id: u._id,
  name: u.name ?? null,
  image: u.image ?? null,
  username: u.username ?? null,
  lastSeenAt: u.lastSeenAt ?? null,
});

/** Full-text search across name + username (deduped, self excluded). */
export const searchUsers = query({
  args: { term: v.string() },
  handler: async (ctx, { term }) => {
    const meId = await requireUserId(ctx);
    const q = term.trim();
    if (q.length < 2) return [];

    const [byName, byUsername] = await Promise.all([
      ctx.db
        .query("users")
        .withSearchIndex("search_name", (s) => s.search("name", q))
        .take(10),
      ctx.db
        .query("users")
        .withSearchIndex("search_username", (s) => s.search("username", q))
        .take(10),
    ]);

    const seen = new Set<Id<"users">>([meId]);
    const results = [];
    for (const u of [...byUsername, ...byName]) {
      if (seen.has(u._id)) continue;
      seen.add(u._id);
      results.push(publicUser(u));
      if (results.length >= 12) break;
    }
    return results;
  },
});

const USERNAME_RE = /^[a-z0-9_]{3,20}$/;

/** Create or update the signed-in user's profile. */
export const updateProfile = mutation({
  args: {
    name: v.optional(v.string()),
    username: v.optional(v.string()),
    bio: v.optional(v.string()),
    image: v.optional(v.string()),
  },
  handler: async (ctx, { name, username, bio, image }) => {
    const meId = await requireUserId(ctx);
    const me = await ctx.db.get(meId);
    if (!me) throw new Error("User not found");

    const patch: Record<string, string | number> = {};
    if (name !== undefined) {
      const trimmed = name.trim();
      if (trimmed.length < 1 || trimmed.length > 50)
        throw new Error("Name must be 1-50 characters");
      patch.name = trimmed;
    }
    if (username !== undefined) {
      const uname = username.trim().toLowerCase();
      if (!USERNAME_RE.test(uname))
        throw new Error(
          "Username must be 3-20 characters: lowercase letters, numbers, underscores",
        );
      const existing = await ctx.db
        .query("users")
        .withIndex("by_username", (idx) => idx.eq("username", uname))
        .first();
      if (existing && existing._id !== meId)
        throw new Error("That username is taken");
      patch.username = uname;
    }
    if (bio !== undefined) {
      if (bio.length > 200) throw new Error("Bio must be 200 characters or fewer");
      patch.bio = bio;
    }
    if (image !== undefined) patch.image = image;

    await ctx.db.patch(meId, patch);
    return { ok: true };
  },
});

/** Presence heartbeat — call on a short interval from active clients. */
export const heartbeat = mutation({
  args: {},
  handler: async (ctx) => {
    const meId = await requireUserId(ctx);
    await ctx.db.patch(meId, { lastSeenAt: Date.now() });
  },
});
