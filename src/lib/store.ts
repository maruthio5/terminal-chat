import { create } from "zustand";
import { persist } from "zustand/middleware";

export type ThemeMode = "light" | "dark" | "system";

type ChatDraft = { text: string; replyToId: string | null };

type LocalFirstState = {
  /** per-conversation composer drafts — survive reloads and reconnects */
  drafts: Record<string, ChatDraft>;
  setDraft: (conversationId: string, patch: Partial<ChatDraft>) => void;
  clearDraft: (conversationId: string) => void;

  /** ids of conversations open locally (drives read marking) */
  openConversationId: string | null;
  setOpenConversationId: (id: string | null) => void;

  /** optimistic outbox metadata: messages the user sent that are still syncing */
  pendingMessageIds: string[];
  addPendingMessage: (id: string) => void;
  removePendingMessage: (id: string) => void;

  theme: ThemeMode;
  setTheme: (theme: ThemeMode) => void;

  deviceId: string;
};

function makeDeviceId(): string {
  try {
    const existing = localStorage.getItem("echoline-device-id");
    if (existing) return existing;
    const id =
      typeof crypto !== "undefined" && "randomUUID" in crypto
        ? crypto.randomUUID()
        : `dev-${Math.random().toString(36).slice(2)}-${Date.now()}`;
    localStorage.setItem("echoline-device-id", id);
    return id;
  } catch {
    return "ephemeral-device";
  }
}

export const useLocalFirst = create<LocalFirstState>()(
  persist(
    (set) => ({
      drafts: {},
      setDraft: (conversationId, patch) =>
        set((s) => ({
          drafts: {
            ...s.drafts,
            [conversationId]: {
              text: s.drafts[conversationId]?.text ?? "",
              replyToId: s.drafts[conversationId]?.replyToId ?? null,
              ...patch,
            },
          },
        })),
      clearDraft: (conversationId) =>
        set((s) => {
          const next = { ...s.drafts };
          delete next[conversationId];
          return { drafts: next };
        }),

      openConversationId: null,
      setOpenConversationId: (id) => set({ openConversationId: id }),

      pendingMessageIds: [],
      addPendingMessage: (id) =>
        set((s) => ({
          pendingMessageIds: s.pendingMessageIds.includes(id)
            ? s.pendingMessageIds
            : [...s.pendingMessageIds, id],
        })),
      removePendingMessage: (id) =>
        set((s) => ({
          pendingMessageIds: s.pendingMessageIds.filter((p) => p !== id),
        })),

      theme: "system",
      setTheme: (theme) => set({ theme }),

      deviceId: makeDeviceId(),
    }),
    {
      name: "echoline-local-first",
      partialize: (s) => ({
        drafts: s.drafts,
        theme: s.theme,
        deviceId: s.deviceId,
      }),
    },
  ),
);
