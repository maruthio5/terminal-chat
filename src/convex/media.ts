import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { requireUserId } from "./users";

/** Get a short-lived upload URL for client-side file upload to Convex storage. */
export const generateUploadUrl = mutation({
  args: {},
  handler: async (ctx) => {
    await requireUserId(ctx);
    return await ctx.storage.generateUploadUrl();
  },
});

const MAX_BYTES = 10 * 1024 * 1024; // 10 MB client-side share cap

/** Register uploaded media metadata and return the media document id. */
export const registerUpload = mutation({
  args: {
    kind: v.union(v.literal("image"), v.literal("file"), v.literal("voice")),
    name: v.string(),
    mimeType: v.string(),
    size: v.number(),
    storageId: v.id("_storage"),
    width: v.optional(v.number()),
    height: v.optional(v.number()),
    durationMs: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const meId = await requireUserId(ctx);
    if (args.size > MAX_BYTES)
      throw new Error("File is larger than the 10 MB limit");
    const mediaId = await ctx.db.insert("media", {
      ownerId: meId,
      kind: args.kind,
      name: args.name.slice(0, 200),
      mimeType: args.mimeType,
      size: args.size,
      storageId: args.storageId,
      width: args.width,
      height: args.height,
      durationMs: args.durationMs,
      createdAt: Date.now(),
    });
    return mediaId;
  },
});

/** Resolve a media document to a servable URL (caller must pass a real id). */
export const getMediaUrl = query({
  args: { mediaId: v.id("media") },
  handler: async (ctx, { mediaId }) => {
    const media = await ctx.db.get(mediaId);
    if (!media) return null;
    const url = await ctx.storage.getUrl(media.storageId);
    return {
      url,
      kind: media.kind,
      name: media.name,
      mimeType: media.mimeType,
      size: media.size,
      width: media.width ?? null,
      height: media.height ?? null,
      durationMs: media.durationMs ?? null,
    };
  },
});
