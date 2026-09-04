import { authTables } from "@convex-dev/auth/server";
import { defineSchema, defineTable } from "convex/server";
import { Infer, v } from "convex/values";

// default user roles. can add / remove based on the project as needed
export const ROLES = {
  ADMIN: "admin",
  USER: "user",
  MEMBER: "member",
} as const;

export const roleValidator = v.union(
  v.literal(ROLES.ADMIN),
  v.literal(ROLES.USER),
  v.literal(ROLES.MEMBER),
);
export type Role = Infer<typeof roleValidator>;

// ---- domain enums ----

export const visibilityValidator = v.union(
  v.literal("everyone"),
  v.literal("friends"),
  v.literal("nobody"),
);

export const friendRequestPolicyValidator = v.union(
  v.literal("everyone"),
  v.literal("friendsOfFriends"),
  v.literal("nobody"),
);

export const messagePolicyValidator = v.union(
  v.literal("friends"),
  v.literal("everyone"),
);

export const conversationKindValidator = v.union(
  v.literal("direct"),
  v.literal("group"),
);

export const memberRoleValidator = v.union(
  v.literal("owner"),
  v.literal("admin"),
  v.literal("member"),
);

export const messageKindValidator = v.union(
  v.literal("text"),
  v.literal("image"),
  v.literal("file"),
  v.literal("voice"),
  v.literal("system"),
);

export const mediaKindValidator = v.union(
  v.literal("image"),
  v.literal("file"),
  v.literal("voice"),
);

export const notificationKindValidator = v.union(
  v.literal("friend_request"),
  v.literal("friend_accepted"),
  v.literal("message"),
  v.literal("mention"),
  v.literal("story_reply"),
  v.literal("system"),
);

export const requestStatusValidator = v.union(
  v.literal("pending"),
  v.literal("accepted"),
  v.literal("declined"),
  v.literal("cancelled"),
);

export const reportTargetValidator = v.union(
  v.literal("user"),
  v.literal("message"),
  v.literal("conversation"),
  v.literal("story"),
);

export const reportReasonValidator = v.union(
  v.literal("spam"),
  v.literal("harassment"),
  v.literal("inappropriate"),
  v.literal("other"),
);

export const reportStatusValidator = v.union(
  v.literal("open"),
  v.literal("reviewing"),
  v.literal("resolved"),
  v.literal("dismissed"),
);

export const autoDownloadValidator = v.union(
  v.literal("always"),
  v.literal("wifi"),
  v.literal("never"),
);

const schema = defineSchema(
  {
    // default auth tables using convex auth.
    ...authTables, // do not remove or modify

    // users: identity + presence (profile data lives here to avoid duplication)
    users: defineTable({
      name: v.optional(v.string()), // name of the user. do not remove
      image: v.optional(v.string()), // image of the user. do not remove
      email: v.optional(v.string()), // email of the user. do not remove
      emailVerificationTime: v.optional(v.number()), // email verification time. do not remove
      isAnonymous: v.optional(v.boolean()), // is the user anonymous. do not remove
      role: v.optional(roleValidator), // role of the user. do not remove

      username: v.optional(v.string()),
      bio: v.optional(v.string()),
      lastSeenAt: v.optional(v.number()),
      createdAt: v.optional(v.number()),
    })
      .index("email", ["email"]) // index for the email. do not remove or modify
      .index("by_username", ["username"])
      .searchIndex("search_name", { searchField: "name" })
      .searchIndex("search_username", { searchField: "username" }),

    // friend requests between users
    friendRequests: defineTable({
      fromId: v.id("users"),
      toId: v.id("users"),
      status: requestStatusValidator,
      message: v.optional(v.string()),
      createdAt: v.number(),
      respondedAt: v.optional(v.number()),
    })
      .index("by_to_status", ["toId", "status"])
      .index("by_from_status", ["fromId", "status"])
      .index("by_pair", ["fromId", "toId"]),

    // established friendships (userAId is always the lexicographically smaller id)
    friendships: defineTable({
      userAId: v.id("users"),
      userBId: v.id("users"),
      createdAt: v.number(),
    })
      .index("by_userA", ["userAId"])
      .index("by_userB", ["userBId"]),

    // blocks: blocker no longer receives anything from blocked
    blocks: defineTable({
      blockerId: v.id("users"),
      blockedId: v.id("users"),
      createdAt: v.number(),
    })
      .index("by_blocker", ["blockerId"])
      .index("by_pair", ["blockerId", "blockedId"]),

    // conversations (direct conversations carry a canonical pair key)
    conversations: defineTable({
      kind: conversationKindValidator,
      title: v.optional(v.string()),
      imageUrl: v.optional(v.string()),
      directKey: v.optional(v.string()),
      createdById: v.id("users"),
      createdAt: v.number(),
      lastMessageAt: v.number(),
      lastMessagePreview: v.optional(v.string()),
      lastMessageSenderId: v.optional(v.id("users")),
      disappearingSeconds: v.optional(v.number()), // 0 / undefined = off
      msgSeq: v.number(), // monotonic per-conversation message counter
    }).index("by_direct_key", ["directKey"]),

    // per-user membership in a conversation
    conversationMembers: defineTable({
      conversationId: v.id("conversations"),
      userId: v.id("users"),
      role: memberRoleValidator,
      joinedAt: v.number(),
      unreadCount: v.number(),
      notificationsMuted: v.boolean(),
      typingAt: v.optional(v.number()),
    })
      .index("by_user", ["userId"])
      .index("by_conversation", ["conversationId"])
      .index("by_conversation_user", ["conversationId", "userId"]),

    // messages; seq orders the conversation, expiresAt powers disappearing messages
    messages: defineTable({
      conversationId: v.id("conversations"),
      seq: v.number(),
      senderId: v.id("users"),
      kind: messageKindValidator,
      text: v.optional(v.string()),
      mediaId: v.optional(v.id("media")),
      replyToId: v.optional(v.id("messages")),
      replyToStoryId: v.optional(v.id("stories")),
      editedAt: v.optional(v.number()),
      deletedAt: v.optional(v.number()),
      expiresAt: v.optional(v.number()),
      createdAt: v.number(),
    })
      .index("by_conversation_seq", ["conversationId", "seq"])
      .index("by_sender", ["senderId"])
      .index("by_expires", ["expiresAt"])
      .index("by_story", ["replyToStoryId"]),

    // emoji reactions on messages
    messageReactions: defineTable({
      messageId: v.id("messages"),
      userId: v.id("users"),
      emoji: v.string(),
      createdAt: v.number(),
    })
      .index("by_message", ["messageId"])
      .index("by_message_user", ["messageId", "userId"]),

    // per-user read pointer per conversation (drives read receipts)
    messageReads: defineTable({
      conversationId: v.id("conversations"),
      userId: v.id("users"),
      lastReadSeq: v.number(),
      updatedAt: v.number(),
    }).index("by_conversation_user", ["conversationId", "userId"]),

    // uploaded media metadata
    media: defineTable({
      ownerId: v.id("users"),
      kind: mediaKindValidator,
      name: v.string(),
      mimeType: v.string(),
      size: v.number(),
      storageId: v.id("_storage"),
      width: v.optional(v.number()),
      height: v.optional(v.number()),
      durationMs: v.optional(v.number()),
      createdAt: v.number(),
    }).index("by_owner_created", ["ownerId", "createdAt"]),

    // 24-hour stories
    stories: defineTable({
      authorId: v.id("users"),
      kind: v.union(v.literal("text"), v.literal("image")),
      text: v.optional(v.string()),
      background: v.optional(v.string()),
      mediaId: v.optional(v.id("media")),
      createdAt: v.number(),
      expiresAt: v.number(),
    })
      .index("by_author", ["authorId"])
      .index("by_expires", ["expiresAt"]),

    // story view receipts
    storyViews: defineTable({
      storyId: v.id("stories"),
      viewerId: v.id("users"),
      viewedAt: v.number(),
    })
      .index("by_story", ["storyId"])
      .index("by_story_viewer", ["storyId", "viewerId"])
      .index("by_viewer", ["viewerId"]),

    // in-app notifications
    notifications: defineTable({
      userId: v.id("users"),
      kind: notificationKindValidator,
      title: v.string(),
      body: v.optional(v.string()),
      actorId: v.optional(v.id("users")),
      conversationId: v.optional(v.id("conversations")),
      messageId: v.optional(v.id("messages")),
      storyId: v.optional(v.id("stories")),
      readAt: v.optional(v.number()),
      createdAt: v.number(),
    }).index("by_user_created", ["userId", "createdAt"]),

    // abuse reports (admin panel in Part 2 consumes these)
    reports: defineTable({
      reporterId: v.id("users"),
      targetKind: reportTargetValidator,
      targetId: v.string(),
      reason: reportReasonValidator,
      details: v.optional(v.string()),
      status: reportStatusValidator,
      createdAt: v.number(),
      resolvedAt: v.optional(v.number()),
    }).index("by_status_created", ["status", "createdAt"]),

    // privacy + storage preferences (one doc per user)
    privacySettings: defineTable({
      userId: v.id("users"),
      lastSeenVisibility: visibilityValidator,
      profilePhotoVisibility: visibilityValidator,
      storyVisibility: v.union(v.literal("friends"), v.literal("everyone")),
      readReceiptsEnabled: v.boolean(),
      typingIndicatorEnabled: v.boolean(),
      friendRequestsFrom: friendRequestPolicyValidator,
      messagesFrom: messagePolicyValidator,
      autoDownloadMedia: autoDownloadValidator,
      keepMediaDays: v.number(),
    }).index("by_user", ["userId"]),

    // multi-device sync bookkeeping (one doc per user per device)
    syncState: defineTable({
      userId: v.id("users"),
      deviceId: v.string(),
      platform: v.optional(v.string()),
      lastSyncedAt: v.number(),
    })
      .index("by_user", ["userId"])
      .index("by_user_device", ["userId", "deviceId"]),
  },
  {
    schemaValidation: false,
  },
);

export default schema;
