import { useEffect } from "react";
import { api } from "@/convex/_generated/api";
import { useMutation } from "convex/react";
import { useLocalFirst } from "@/lib/store";

/** Periodic presence + device sync heartbeat while the app is open. */
export function usePresenceHeartbeat() {
  const userHeartbeat = useMutation(api.users.heartbeat);
  const deviceHeartbeat = useMutation(api.sync.heartbeat);
  const deviceId = useLocalFirst((s) => s.deviceId);

  useEffect(() => {
    let stopped = false;
    const beat = async () => {
      if (stopped) return;
      try {
        await Promise.all([
          userHeartbeat(),
          deviceHeartbeat({
            deviceId,
            platform: typeof navigator !== "undefined" ? navigator.platform : undefined,
          }),
        ]);
      } catch {
        // offline — local-first mode keeps working, retries on next tick
      }
    };
    void beat();
    const timer = window.setInterval(beat, 30_000);
    return () => {
      stopped = true;
      window.clearInterval(timer);
    };
  }, [userHeartbeat, deviceHeartbeat, deviceId]);
}

/** "online" if seen in the last 65s (heartbeat interval + slack). */
export function isRecentlyActive(lastSeenAt: string | number | null | undefined) {
  if (!lastSeenAt) return false;
  return Date.now() - Number(lastSeenAt) < 65_000;
}

export function formatLastSeen(lastSeenAt: string | number | null | undefined) {
  if (!lastSeenAt) return "offline";
  const diff = Date.now() - Number(lastSeenAt);
  if (diff < 65_000) return "online";
  const minutes = Math.floor(diff / 60_000);
  if (minutes < 60) return `last seen ${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `last seen ${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `last seen ${days}d ago`;
}
