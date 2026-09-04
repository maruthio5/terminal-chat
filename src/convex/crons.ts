import { cronJobs } from "convex/server";
import { internalMutation } from "./_generated/server";
import { internal } from "./_generated/api";

const crons = cronJobs();

/** Purge expired stories + their view receipts every 10 minutes. */
export const purgeExpiredStories = internalMutation({
  args: {},
  handler: async (ctx) => {
    const now = Date.now();
    const expired = await ctx.db
      .query("stories")
      .withIndex("by_expires", (q) => q.lt("expiresAt", now))
      .take(200);
    for (const story of expired) {
      const views = await ctx.db
        .query("storyViews")
        .withIndex("by_story", (q) => q.eq("storyId", story._id))
        .collect();
      for (const view of views) await ctx.db.delete(view._id);
      await ctx.db.delete(story._id);
    }
    return { purged: expired.length };
  },
});

/** Purge expired disappearing messages every minute. */
export const purgeExpiredMessages = internalMutation({
  args: {},
  handler: async (ctx) => {
    const now = Date.now();
    const expired = await ctx.db
      .query("messages")
      .withIndex("by_expires", (q) => q.lt("expiresAt", now))
      .take(300);
    for (const message of expired) {
      const reactions = await ctx.db
        .query("messageReactions")
        .withIndex("by_message", (q) => q.eq("messageId", message._id))
        .collect();
      for (const reaction of reactions) await ctx.db.delete(reaction._id);
      await ctx.db.delete(message._id);
    }
    return { purged: expired.length };
  },
});

crons.interval(
  "purge stories",
  { minutes: 10 },
  internal.crons.purgeExpiredStories,
);
crons.interval(
  "purge disappearing messages",
  { minutes: 5 },
  internal.crons.purgeExpiredMessages,
);

export default crons;
