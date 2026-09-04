import { v } from "convex/values";
import { mutation, query, QueryCtx } from "./_generated/server";
import { Id } from "./_generated/dataModel";
import { requireUserId } from "./users";

/** True when either user has blocked the other. */
export async function isBlockedEitherWay(
  ctx: QueryCtx,
  a: Id<"users">,
  b: Id<"users">,
): Promise<boolean> {
  const [aBlockedB, bBlockedA] = await Promise.all([
    ctx.db
      .query("blocks")
      .withIndex("by_pair", (q) => q.eq("blockerId", a).eq("blockedId", b))
      .first(),
    ctx.db
      .query("blocks")
      .withIndex("by_pair", (q) => q.eq("blockerId", b).eq("blockedId", a))
      .first(),
  ]);
  return Boolean(aBlockedB ?? bBlockedA);
}

export const blockUser = mutation({
  args: { userId: v.id("users") },
  handler: async (ctx, { userId }) => {
    const meId = await requireUserId(ctx);
    if (meId === userId) throw new Error("You cannot block yourself");
    const existing = await ctx.db
      .query("blocks")
      .withIndex("by_pair", (q) => q.eq("blockerId", meId).eq("blockedId", userId))
      .first();
    if (!existing) {
      await ctx.db.insert("blocks", {
        blockerId: meId,
        blockedId: userId,
        createdAt: Date.now(),
      });
    }
    return { ok: true };
  },
});

export const unblockUser = mutation({
  args: { userId: v.id("users") },
  handler: async (ctx, { userId }) => {
    const meId = await requireUserId(ctx);
    const existing = await ctx.db
      .query("blocks")
      .withIndex("by_pair", (q) => q.eq("blockerId", meId).eq("blockedId", userId))
      .first();
    if (existing) await ctx.db.delete(existing._id);
    return { ok: true };
  },
});

export const myBlocks = query({
  args: {},
  handler: async (ctx) => {
    const meId = await requireUserId(ctx);
    const rows = await ctx.db
      .query("blocks")
      .withIndex("by_blocker", (q) => q.eq("blockerId", meId))
      .collect();
    const items = await Promise.all(
      rows.map(async (b) => {
        const u = await ctx.db.get(b.blockedId);
        return {
          _id: b._id,
          createdAt: b.createdAt,
          user: u
            ? { _id: u._id, name: u.name ?? null, image: u.image ?? null, username: u.username ?? null }
            : null,
        };
      }),
    );
    return items.filter((i) => i.user !== null);
  },
});

export const report = mutation({
  args: {
    targetKind: v.union(
      v.literal("user"),
      v.literal("message"),
      v.literal("conversation"),
      v.literal("story"),
    ),
    targetId: v.string(),
    reason: v.union(
      v.literal("spam"),
      v.literal("harassment"),
      v.literal("inappropriate"),
      v.literal("other"),
    ),
    details: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const meId = await requireUserId(ctx);
    await ctx.db.insert("reports", {
      reporterId: meId,
      targetKind: args.targetKind,
      targetId: args.targetId,
      reason: args.reason,
      details: args.details?.slice(0, 1000),
      status: "open",
      createdAt: Date.now(),
    });
    return { ok: true };
  },
});
