import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { requireUserId } from "./users";

/** Upsert this device's sync heartbeat. Called from a client interval. */
export const heartbeat = mutation({
  args: {
    deviceId: v.string(),
    platform: v.optional(v.string()),
  },
  handler: async (ctx, { deviceId, platform }) => {
    const meId = await requireUserId(ctx);
    const existing = await ctx.db
      .query("syncState")
      .withIndex("by_user_device", (q) =>
        q.eq("userId", meId).eq("deviceId", deviceId),
      )
      .first();
    const now = Date.now();
    if (existing) {
      await ctx.db.patch(existing._id, { lastSyncedAt: now, platform });
    } else {
      await ctx.db.insert("syncState", {
        userId: meId,
        deviceId: deviceId.slice(0, 64),
        platform: platform?.slice(0, 64),
        lastSyncedAt: now,
      });
    }
    return { ok: true, syncedAt: now };
  },
});

/** Devices that synced recently (last 30 days). */
export const myDevices = query({
  args: {},
  handler: async (ctx) => {
    const meId = await requireUserId(ctx);
    const rows = await ctx.db
      .query("syncState")
      .withIndex("by_user", (q) => q.eq("userId", meId))
      .collect();
    const cutoff = Date.now() - 30 * 24 * 60 * 60 * 1000;
    return rows
      .filter((r) => r.lastSyncedAt >= cutoff)
      .sort((a, b) => b.lastSyncedAt - a.lastSyncedAt)
      .map((r) => ({
        _id: r._id,
        deviceId: r.deviceId,
        platform: r.platform ?? null,
        lastSyncedAt: r.lastSyncedAt,
      }));
  },
});
